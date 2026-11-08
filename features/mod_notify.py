# -*- coding: utf-8 -*-
"""通知扩展：公告栏 / 师生留言 / 截止前自动提醒 / 已读回执 / 免打扰偏好"""
from __future__ import annotations

from datetime import datetime
from flask import request

from extcore import (bp, db, require, resp_ok, resp_err, now, body, uid, role,
                     push_student_notification, parse_due, get_setting, set_setting, ST)

BP = bp("notify")


def _tid_for_student():
    row = db().execute("SELECT teacher_id FROM students WHERE id=?", (uid(),)).fetchone()
    return row["teacher_id"] if row else None


# ---------------------------------------------------------------- 33 公告栏
@BP.get("/announcements")
def ann_list():
    if role() == "teacher":
        rows = db().execute("SELECT * FROM announcements WHERE teacher_id=? ORDER BY pinned DESC,id DESC",
                            (uid(),)).fetchall()
    else:
        tid = _tid_for_student()
        rows = db().execute(
            "SELECT id,title,body,pinned,created_at FROM announcements WHERE teacher_id=? "
            "AND (expires_at='' OR expires_at>=?) ORDER BY pinned DESC,id DESC",
            (tid, now())).fetchall() if tid else []
    return resp_ok(items=[dict(r) for r in rows])


@BP.post("/announcements")
@require("teacher")
def ann_add():
    d = body()
    title = str(d.get("title") or "").strip()
    if not title:
        return resp_err("请填写公告标题")
    db().execute(
        "INSERT INTO announcements(teacher_id,title,body,pinned,expires_at,created_at) "
        "VALUES(?,?,?,?,?,?)",
        (uid(), title, str(d.get("body") or "")[:2000], 1 if d.get("pinned") else 0,
         str(d.get("expires_at") or "").strip(), now()))
    db().commit()
    tid = uid()
    for s in db().execute("SELECT id FROM students WHERE teacher_id=?", (tid,)).fetchall():
        push_student_notification(s["id"], "announce", "新公告：" + title,
                                  str(d.get("body") or "")[:200])
    return resp_ok()


@BP.delete("/announcements/<int:aid>")
@require("teacher")
def ann_del(aid):
    db().execute("DELETE FROM announcements WHERE id=? AND teacher_id=?", (aid, uid()))
    db().commit()
    return resp_ok()


# ---------------------------------------------------------------- 32 师生留言
@BP.get("/messages")
def msg_list():
    if role() == "teacher":
        rows = db().execute(
            "SELECT m.*,s.name AS student_name FROM messages m "
            "JOIN students s ON s.id=m.student_id WHERE m.teacher_id=? ORDER BY m.id DESC LIMIT 200",
            (uid(),)).fetchall()
    else:
        rows = db().execute("SELECT * FROM messages WHERE student_id=? ORDER BY id DESC LIMIT 200",
                            (uid(),)).fetchall()
    return resp_ok(items=[dict(r) for r in rows])


@BP.post("/messages")
def msg_add():
    d = body()
    text = str(d.get("body") or "").strip()[:1000]
    if not text:
        return resp_err("请填写内容")
    if role() == "student":
        tid = _tid_for_student()
        sid = uid()
        direction = "to_teacher"
    else:
        sid = d.get("student_id")
        if not db().execute("SELECT 1 FROM students WHERE id=? AND teacher_id=?", (sid, uid())).fetchone():
            return resp_err("学生不存在", 404)
        tid = uid()
        direction = "to_student"
    db().execute(
        "INSERT INTO messages(student_id,teacher_id,direction,body,created_at) "
        "VALUES(?,?,?,?,?)", (sid, tid, direction, text, now()))
    db().commit()
    if direction == "to_student":
        push_student_notification(sid, "message", "老师给你留言了", text[:120])
    return resp_ok()


@BP.post("/messages/read")
def msg_read():
    if role() == "teacher":
        db().execute("UPDATE messages SET is_read=1 WHERE teacher_id=? AND direction='to_teacher'",
                     (uid(),))
    else:
        db().execute("UPDATE messages SET is_read=1 WHERE student_id=? AND direction='to_student'",
                     (uid(),))
    db().commit()
    return resp_ok()


# ---------------------------------------------------------------- 35 已读回执
@BP.get("/receipts")
@require("teacher")
def receipts():
    rows = db().execute(
        "SELECT s.id,s.name,s.email,"
        "(SELECT COUNT(*) FROM student_notifications n WHERE n.student_id=s.id AND n.is_read=0) AS unread "
        "FROM students s WHERE s.teacher_id=? ORDER BY unread DESC,s.id", (uid(),)).fetchall()
    return resp_ok(items=[dict(r) for r in rows])


# ---------------------------------------------------------------- 36 免打扰 / 通知偏好
@BP.get("/prefs")
def prefs():
    if role() == "student":
        return resp_ok(quiet=get_setting(ST, uid(), "notify.quiet", "0") == "1",
                       digest=get_setting(ST, uid(), "notify.digest", "1") == "1")
    return resp_ok(remind_before=int(get_setting("teacher_settings", uid(),
                                                 "notify.remind_before", "24") or 24))


@BP.post("/prefs")
def save_prefs():
    d = body()
    if role() == "student":
        if "quiet" in d:
            set_setting(ST, uid(), "notify.quiet", "1" if d["quiet"] else "0")
        if "digest" in d:
            set_setting(ST, uid(), "notify.digest", "1" if d["digest"] else "0")
    else:
        set_setting("teacher_settings", uid(), "notify.remind_before",
                    str(max(1, min(72, int(d.get("remind_before") or 24)))))
    return resp_ok()


# ---------------------------------------------------------------- 34 截止前自动提醒
def tick():
    con = db()
    hws = con.execute("SELECT * FROM homeworks WHERE due_at<>''").fetchall()
    for hw in hws:
        due = parse_due(hw["due_at"])
        if not due:
            continue
        hours_left = (due - datetime.now()).total_seconds() / 3600
        if hours_left < 0:
            continue
        teacher = con.execute("SELECT remind_before FROM teachers WHERE id=?",
                              (hw["teacher_id"],)).fetchone()
        before = float(teacher["remind_before"] or 24) if teacher else 24.0
        custom = con.execute(
            "SELECT value FROM teacher_settings WHERE teacher_id=? AND key='notify.remind_before'",
            (hw["teacher_id"],)).fetchone()
        if custom and custom["value"]:
            before = float(custom["value"])
        if hours_left > before:
            continue
        if hw["target_mode"] == "all":
            targets = con.execute("SELECT id FROM students WHERE teacher_id=?",
                                  (hw["teacher_id"],)).fetchall()
        else:
            targets = con.execute(
                "SELECT student_id AS id FROM homework_targets WHERE homework_id=?",
                (hw["id"],)).fetchall()
        for s in targets:
            if con.execute(
                "SELECT 1 FROM reminder_log WHERE homework_id=? AND student_id=? AND kind='due'",
                (hw["id"], s["id"])).fetchone():
                continue
            if con.execute(
                "SELECT 1 FROM submissions WHERE homework_id=? AND student_id=?",
                (hw["id"], s["id"])).fetchone():
                continue
            quiet = con.execute(
                "SELECT value FROM student_settings WHERE student_id=? AND key='notify.quiet'",
                (s["id"],)).fetchone()
            if quiet and quiet["value"] == "1":
                continue
            push_student_notification(
                s["id"], "remind", "作业即将截止：" + hw["title"],
                "距离截止不足 %d 小时，记得及时完成。" % max(1, int(hours_left)))
            con.execute(
                "INSERT OR IGNORE INTO reminder_log(homework_id,student_id,kind) "
                "VALUES(?,?,'due')", (hw["id"], s["id"]))
    con.commit()
