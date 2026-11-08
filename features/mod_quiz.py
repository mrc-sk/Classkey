# -*- coding: utf-8 -*-
"""作业扩展：模板 / 定时发布 / 题库自动判分 / 版本 / 多附件 / 批注 / 互评 / 请假 / 标签"""
from __future__ import annotations

from datetime import datetime
from flask import request

from extcore import (bp, db, require, resp_ok, resp_err, now, body, uid,
                     push_student_notification, teacher_of_student,
                     json_loads, json_dumps,
                     parse_due, is_overdue, homework_for_student)

BP = bp("quiz")


def _hw(hid):
    return db().execute("SELECT * FROM homeworks WHERE id=? AND teacher_id=?",
                        (hid, uid())).fetchone()


def _targets(con, hw):
    if hw["target_mode"] == "all":
        return con.execute("SELECT id FROM students WHERE teacher_id=?",
                           (hw["teacher_id"],)).fetchall()
    return con.execute("SELECT student_id AS id FROM homework_targets WHERE homework_id=?",
                       (hw["id"],)).fetchall()


def _sub(hid):
    return db().execute("SELECT * FROM submissions WHERE homework_id=? AND student_id=?",
                        (hid, uid())).fetchone()


# ---------------------------------------------------------------- 4 作业模板
@BP.get("/templates")
@require("teacher")
def tpl_list():
    rows = db().execute("SELECT * FROM homework_templates WHERE teacher_id=? ORDER BY id DESC",
                        (uid(),)).fetchall()
    return resp_ok(items=[dict(r) for r in rows])


@BP.post("/templates")
@require("teacher")
def tpl_add():
    d = body()
    title = (d.get("title") or "").strip()
    if not title:
        return resp_err("请填写模板名称")
    db().execute(
        "INSERT INTO homework_templates(teacher_id,title,subject,description,mode,allow_late,created_at) "
        "VALUES(?,?,?,?,?,?,?)",
        (uid(), title, (d.get("subject") or "").strip(), (d.get("description") or "").strip(),
         d.get("mode") or "online", 1 if d.get("allow_late") else 0, now()))
    db().commit()
    return resp_ok()


@BP.delete("/templates/<int:tid>")
@require("teacher")
def tpl_del(tid):
    db().execute("DELETE FROM homework_templates WHERE id=? AND teacher_id=?", (tid, uid()))
    db().commit()
    return resp_ok()


@BP.get("/copy-last")
@require("teacher")
def copy_last():
    r = db().execute("SELECT * FROM homeworks WHERE teacher_id=? ORDER BY id DESC LIMIT 1",
                     (uid(),)).fetchone()
    return resp_ok(homework=dict(r) if r else None)


# ---------------------------------------------------------------- 22 知识点标签
@BP.get("/tags")
@require("teacher")
def tag_list():
    rows = db().execute(
        "SELECT DISTINCT ht.tag FROM homework_tags ht JOIN homeworks h ON h.id=ht.homework_id "
        "WHERE h.teacher_id=? ORDER BY ht.tag", (uid(),)).fetchall()
    return resp_ok(tags=[r["tag"] for r in rows])


@BP.post("/tags")
@require("teacher")
def tag_set():
    d = body()
    hid = d.get("homework_id")
    if not _hw(hid):
        return resp_err("作业不存在", 404)
    tags = [str(x).strip()[:20] for x in (d.get("tags") or []) if str(x).strip()][:12]
    db().execute("DELETE FROM homework_tags WHERE homework_id=?", (hid,))
    for t in tags:
        db().execute("INSERT OR IGNORE INTO homework_tags(homework_id,tag) VALUES(?,?)", (hid, t))
    db().commit()
    return resp_ok(tags=tags)


@BP.get("/by-tag")
@require("teacher")
def by_tag():
    tag = (request.args.get("tag") or "").strip()
    rows = db().execute(
        "SELECT h.id,h.title,h.subject,h.due_at FROM homeworks h "
        "JOIN homework_tags t ON t.homework_id=h.id "
        "WHERE h.teacher_id=? AND t.tag=? ORDER BY h.id DESC", (uid(), tag)).fetchall()
    return resp_ok(items=[dict(r) for r in rows])


# ---------------------------------------------------------------- 15 题库自动判分
@BP.get("/questions/<int:hid>")
@require("teacher")
def q_list(hid):
    if not _hw(hid):
        return resp_err("作业不存在", 404)
    rows = db().execute("SELECT * FROM quiz_questions WHERE homework_id=? ORDER BY sort_no,id",
                        (hid,)).fetchall()
    items = []
    for r in rows:
        it = dict(r)
        it["options"] = json_loads(r["options"], [])
        items.append(it)
    return resp_ok(items=items)


@BP.post("/questions/<int:hid>")
@require("teacher")
def q_save(hid):
    if not _hw(hid):
        return resp_err("作业不存在", 404)
    qs = body().get("questions") or []
    if len(qs) > 60:
        return resp_err("单份作业最多 60 题")
    db().execute("DELETE FROM quiz_questions WHERE homework_id=?", (hid,))
    for i, q in enumerate(qs):
        qtype = q.get("qtype") or "single"
        if qtype not in ("single", "multi", "judge", "blank"):
            continue
        title = str(q.get("title") or "").strip()[:500]
        if not title:
            continue
        try:
            sc = max(0.0, float(q.get("score") or 0))
        except (TypeError, ValueError):
            sc = 0.0
        db().execute(
            "INSERT INTO quiz_questions(homework_id,qtype,title,options,answer,score,sort_no) "
            "VALUES(?,?,?,?,?,?,?)",
            (hid, qtype, title, json_dumps(q.get("options") or []),
             str(q.get("answer") or "").strip()[:200], sc, i))
    db().commit()
    return resp_ok(count=len(qs))


@BP.get("/paper/<int:hid>")
@require("student")
def paper(hid):
    hw = homework_for_student(hid, uid())
    if not hw:
        return resp_err("作业不存在或未指派给你", 404)
    rows = db().execute(
        "SELECT id,qtype,title,options,score,sort_no FROM quiz_questions "
        "WHERE homework_id=? ORDER BY sort_no,id", (hid,)).fetchall()
    items = []
    for r in rows:
        it = dict(r)
        it["options"] = json_loads(r["options"], [])
        items.append(it)
    return resp_ok(title=hw["title"], questions=items, allow_late=hw["allow_late"],
                   overdue=is_overdue(hw))


@BP.post("/paper/<int:hid>/answer")
@require("student")
def answer(hid):
    hw = homework_for_student(hid, uid())
    if not hw:
        return resp_err("作业不存在或未指派给你", 404)
    if is_overdue(hw) and not hw["allow_late"]:
        return resp_err("已过截止时间，无法提交", 403)
    ans = body().get("answers") or {}
    qs = db().execute("SELECT * FROM quiz_questions WHERE homework_id=?", (hid,)).fetchall()
    if not qs:
        return resp_err("这份作业没有题目")
    got, total, detail = 0.0, 0.0, []
    for q in qs:
        sc = float(q["score"] or 0)
        total += sc
        std = (q["answer"] or "").strip()
        given = ans.get(str(q["id"]), "")
        if q["qtype"] == "multi":
            a = {x.strip().upper() for x in std.replace(",", "|").split("|") if x.strip()}
            b = {x.strip().upper() for x in str(given).replace(",", "|").split("|") if x.strip()}
            ok = bool(a) and a == b
        else:
            ok = str(given).strip().upper() == std.upper() and bool(std)
        if ok:
            got += sc
        detail.append({"id": q["id"], "correct": ok})
    db().execute(
        "INSERT INTO quiz_answers(homework_id,student_id,answers,auto_score,created_at) "
        "VALUES(?,?,?,?,?) ON CONFLICT(homework_id,student_id) DO UPDATE SET "
        "answers=excluded.answers,auto_score=excluded.auto_score,created_at=excluded.created_at",
        (hid, uid(), json_dumps(ans), got, now()))
    db().execute(
        "INSERT INTO submissions(homework_id,student_id,content,status,score,comment,submitted_at,updated_at) "
        "VALUES(?,?,?,'reviewed',?,?,?,?) ON CONFLICT(homework_id,student_id) DO UPDATE SET "
        "content=excluded.content,status='reviewed',score=excluded.score,"
        "comment=excluded.comment,updated_at=excluded.updated_at",
        (hid, uid(), json_dumps(ans), str(got),
         "客观题自动判分 %g / %g 分" % (got, total), now(), now()))
    db().commit()
    return resp_ok(score=got, total=total, detail=detail)


# ---------------------------------------------------------------- 16 重交与版本
@BP.get("/versions/<int:hid>")
@require("student")
def versions(hid):
    sub = _sub(hid)
    if not sub:
        return resp_ok(items=[])
    rows = db().execute("SELECT * FROM submission_versions WHERE submission_id=? ORDER BY id DESC",
                        (sub["id"],)).fetchall()
    return resp_ok(items=[dict(r) for r in rows])


@BP.post("/resubmit/<int:hid>")
@require("student")
def resubmit(hid):
    hw = homework_for_student(hid, uid())
    if not hw:
        return resp_err("作业不存在", 404)
    if not hw["allow_resubmit"]:
        return resp_err("老师未开启重交")
    sub = _sub(hid)
    d = body()
    content = str(d.get("content") or "")[:20000]
    if sub:
        db().execute(
            "INSERT INTO submission_versions(submission_id,content,file_id,file_name,created_at) "
            "VALUES(?,?,?,?,?)",
            (sub["id"], sub["content"], sub["file_id"], sub["file_name"], sub["updated_at"]))
        db().execute("UPDATE submissions SET content=?,status='submitted',updated_at=? WHERE id=?",
                     (content, now(), sub["id"]))
    else:
        db().execute(
            "INSERT INTO submissions(homework_id,student_id,content,status,submitted_at,updated_at) "
            "VALUES(?,?,?,'submitted',?,?)", (hid, uid(), content, now(), now()))
    db().commit()
    return resp_ok()


# ---------------------------------------------------------------- 18 多附件
@BP.post("/files/<int:hid>")
@require("student")
def add_files(hid):
    if not homework_for_student(hid, uid()):
        return resp_err("作业不存在", 404)
    sub = _sub(hid)
    if not sub:
        db().execute(
            "INSERT INTO submissions(homework_id,student_id,content,status,submitted_at,updated_at) "
            "VALUES(?,?,?,'submitted',?,?)", (hid, uid(), "", now(), now()))
        db().commit()
        sub = _sub(hid)
    files = body().get("files") or []
    for f in files[:8]:
        fid = str(f.get("id") or "").strip()
        if not fid:
            continue
        db().execute(
            "INSERT INTO submission_files(submission_id,file_id,file_name,created_at) "
            "VALUES(?,?,?,?)", (sub["id"], fid, str(f.get("name") or "")[:200], now()))
    db().commit()
    return resp_ok()


# ---------------------------------------------------------------- 19 批注
@BP.get("/annotations/<int:subid>")
def anno_list(subid):
    u = db().execute(
        "SELECT h.teacher_id FROM submissions s JOIN homeworks h ON h.id=s.homework_id "
        "WHERE s.id=?", (subid,)).fetchone()
    if not u:
        return resp_err("提交不存在", 404)
    rows = db().execute("SELECT * FROM annotations WHERE submission_id=? ORDER BY id",
                        (subid,)).fetchall()
    return resp_ok(items=[dict(r) for r in rows])


@BP.post("/annotations/<int:subid>")
@require("teacher")
def anno_add(subid):
    row = db().execute(
        "SELECT h.teacher_id FROM submissions s JOIN homeworks h ON h.id=s.homework_id "
        "WHERE s.id=?", (subid,)).fetchone()
    if not row or row["teacher_id"] != uid():
        return resp_err("无权批注", 403)
    d = body()
    db().execute(
        "INSERT INTO annotations(submission_id,teacher_id,file_id,pos_x,pos_y,text,created_at) "
        "VALUES(?,?,?,?,?,?,?)",
        (subid, uid(), str(d.get("file_id") or ""), float(d.get("x") or 0),
         float(d.get("y") or 0), str(d.get("text") or "")[:500], now()))
    db().commit()
    return resp_ok()


# ---------------------------------------------------------------- 20 互评
@BP.get("/peer/feed")
@require("student")
def peer_feed():
    """同班其他同学的已提交作业（匿名），供学生互评时选择。"""
    tid = teacher_of_student(uid())
    if not tid:
        return resp_err("账号异常", 403)
    rows = db().execute(
        "SELECT sub.id AS submission_id,h.title,sub.content,sub.status "
        "FROM submissions sub JOIN homeworks h ON h.id=sub.homework_id "
        "WHERE h.teacher_id=? AND sub.student_id<>? AND sub.status<>'acked' "
        "ORDER BY sub.id DESC LIMIT 30", (tid, uid())).fetchall()
    items = []
    for r in rows:
        it = dict(r)
        it["content"] = str(r["content"] or "")[:240]
        items.append(it)
    return resp_ok(items=items)


@BP.get("/peer/<int:subid>")
@require("student")
def peer_list(subid):
    rows = db().execute("SELECT * FROM peer_reviews WHERE submission_id=? ORDER BY id DESC",
                        (subid,)).fetchall()
    return resp_ok(items=[dict(r) for r in rows])


@BP.post("/peer/<int:subid>")
@require("student")
def peer_add(subid):
    d = body()
    db().execute(
        "INSERT INTO peer_reviews(submission_id,reviewer_id,score,comment,anonymous,created_at) "
        "VALUES(?,?,?,?,?,?)",
        (subid, uid(), float(d.get("score") or 0), str(d.get("comment") or "")[:1000],
         1 if d.get("anonymous", True) else 0, now()))
    db().commit()
    return resp_ok()


# ---------------------------------------------------------------- 21 请假补交
@BP.get("/leaves")
def leave_list():
    from extcore import role as _role
    if _role() == "teacher":
        rows = db().execute(
            "SELECT l.*,s.name AS student_name,h.title FROM leave_requests l "
            "JOIN students s ON s.id=l.student_id JOIN homeworks h ON h.id=l.homework_id "
            "WHERE h.teacher_id=? ORDER BY l.id DESC", (uid(),)).fetchall()
    else:
        rows = db().execute("SELECT * FROM leave_requests WHERE student_id=? ORDER BY id DESC",
                            (uid(),)).fetchall()
    return resp_ok(items=[dict(r) for r in rows])


@BP.post("/leaves")
@require("student")
def leave_add():
    d = body()
    hid = d.get("homework_id")
    if not homework_for_student(hid, uid()):
        return resp_err("作业不存在", 404)
    db().execute(
        "INSERT INTO leave_requests(homework_id,student_id,reason,created_at) VALUES(?,?,?,?)",
        (hid, uid(), str(d.get("reason") or "")[:500], now()))
    db().commit()
    return resp_ok()


@BP.post("/leaves/<int:lid>/review")
@require("teacher")
def leave_review(lid):
    row = db().execute(
        "SELECT l.*,h.teacher_id FROM leave_requests l JOIN homeworks h ON h.id=l.homework_id "
        "WHERE l.id=?", (lid,)).fetchone()
    if not row or row["teacher_id"] != uid():
        return resp_err("申请不存在", 404)
    status = "approved" if body().get("approve") else "rejected"
    db().execute("UPDATE leave_requests SET status=? WHERE id=?", (status, lid))
    if status == "approved":
        db().execute("UPDATE homeworks SET allow_late=1 WHERE id=?", (row["homework_id"],))
    db().commit()
    push_student_notification(row["student_id"], "homework", "补交申请" + ("已通过" if status == "approved" else "未通过"),
                              "老师处理了你的补交申请。")
    return resp_ok(status=status)


# ---------------------------------------------------------------- 5 定时发布
def tick():
    con = db()
    rows = con.execute("SELECT * FROM homeworks WHERE scheduled_at<>''").fetchall()
    for hw in rows:
        when = parse_due(hw["scheduled_at"])
        if not when or when > datetime.now():
            continue
        for s in _targets(con, hw):
            if con.execute(
                "SELECT 1 FROM reminder_log WHERE homework_id=? AND student_id=? AND kind='publish'",
                (hw["id"], s["id"])).fetchone():
                continue
            push_student_notification(s["id"], "homework", "新作业：" + hw["title"],
                                      "老师布置的作业已到发布时间，请查看并完成。")
            con.execute(
                "INSERT OR IGNORE INTO reminder_log(homework_id,student_id,kind) VALUES(?,?,'publish')",
                (hw["id"], s["id"]))
    con.commit()
