# -*- coding: utf-8 -*-
"""启课 · 扩展模块「批量与效率」。

URL 前缀由 app.py 统一注册为 /api/x/batch。
覆盖功能：★1 成绩批量录入、★2 粘贴导入成绩（前端解析预览，复用批量接口）、
3 考试模板 CRUD、6 学生批量操作、7 批量私信、48 标准格式全量导入导出。
"""
from __future__ import annotations

import csv
import io
import re

from werkzeug.security import generate_password_hash

import extcore
from extcore import (db, require, resp_ok, resp_err, now, body, uid,
                     gen_code, push_student_notification, push_notification,
                     csv_response)

BP = extcore.bp("batch")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# 48 · 标准格式表头：导出即按此顺序，导入也按此列序解析（首列用于识别格式）
HEADERS = {
    "students": ["姓名", "邮箱", "学号", "登录密码", "班级ID", "添加时间"],
    "scores": ["姓名", "学号", "邮箱", "考试/测验", "科目", "分数", "满分",
               "发布方式", "备注", "发布时间"],
    "homeworks": ["标题", "科目", "说明", "截止时间", "提交方式", "派发范围", "创建时间"],
}


# ---------------------------------------------------------------- 公共工具
def _all_students():
    """当前老师名下全部学生（含 class_id 等迁移列）。"""
    return [dict(r) for r in db().execute(
        "SELECT * FROM students WHERE teacher_id=? ORDER BY id", (uid(),)
    ).fetchall()]


def _owned_students(ids):
    """按 id 列表取出且仅取出属于当前老师的学生，用于归属校验。"""
    clean = []
    for x in ids or []:
        try:
            clean.append(int(x))
        except (TypeError, ValueError):
            continue
    clean = list(dict.fromkeys(clean))
    if not clean:
        return []
    ph = ",".join("?" for _ in clean)
    return [dict(r) for r in db().execute(
        "SELECT * FROM students WHERE teacher_id=? AND id IN (%s)" % ph,
        [uid()] + clean,
    ).fetchall()]


def _cell(cols, i):
    return str(cols[i]).strip() if i < len(cols) else ""


def _parse_rows(text):
    """解析粘贴的标准 CSV（带 BOM 兼容、引号兼容）；Excel 复制的制表符分隔也支持。"""
    text = (text or "").lstrip("\ufeff")
    lines = text.splitlines()
    first = lines[0] if lines else ""
    delim = "\t" if ("\t" in first and "," not in first) else ","
    out = []
    for row in csv.reader(io.StringIO(text), delimiter=delim):
        cells = [str(c).strip() for c in row]
        if any(cells):
            out.append(cells)
    return out


def _build_ctx():
    """导入匹配上下文：按邮箱 / 学号 / 姓名索引本班学生。"""
    ctx = {"by_email": {}, "by_no": {}, "by_name": {}, "email_set": set()}
    for r in db().execute(
        "SELECT id,name,email,student_no,class_id FROM students WHERE teacher_id=?",
        (uid(),),
    ).fetchall():
        s = dict(r)
        em = (s["email"] or "").lower()
        ctx["by_email"][em] = s
        if s["student_no"]:
            ctx["by_no"][str(s["student_no"]).lower()] = s
        ctx["by_name"][(s["name"] or "").lower()] = s
        ctx["email_set"].add(em)
    return ctx


def _match_student(ctx, name, no, email):
    return (ctx["by_email"].get(email.lower())
            or ctx["by_no"].get(no.lower())
            or ctx["by_name"].get(name.lower()))


def _normalize(kind, cols, ctx):
    """把一行标准 CSV 解析并校验成结构化结果，预览与确认共用（不信任前端结果）。

    status: ok=可新增 / update=已存在将更新 / error=该行不可用。
    """
    item = {"cols": cols}
    if kind == "students":
        name = _cell(cols, 0)
        email = _cell(cols, 1).lower()
        sno = _cell(cols, 2)
        pwd = _cell(cols, 3)
        cid = _cell(cols, 4)
        created = _cell(cols, 5)
        if not name:
            item.update(status="error", msg="姓名为空")
            return item
        if not EMAIL_RE.fullmatch(email):
            item.update(status="error", msg="邮箱格式不正确")
            return item
        try:
            cid_i = int(cid or 0)
        except ValueError:
            cid_i = 0
        status = "update" if email in ctx["email_set"] else "ok"
        item.update(status=status,
                    msg="已存在，将更新学号/班级" if status == "update" else "新增学生",
                    name=name, email=email, student_no=sno, password=pwd,
                    class_id=cid_i, created_at=created)
        return item

    if kind == "scores":
        name, sno, email = _cell(cols, 0), _cell(cols, 1), _cell(cols, 2).lower()
        exam, subject = _cell(cols, 3), _cell(cols, 4)
        score_s, full_s = _cell(cols, 5), _cell(cols, 6)
        mode, remark = _cell(cols, 7), _cell(cols, 8)
        stu = _match_student(ctx, name, sno, email)
        if not stu:
            item.update(status="error", msg="未匹配到本班学生")
            return item
        try:
            score = float(score_s)
            full = float(full_s or 100)
        except (TypeError, ValueError):
            item.update(status="error", msg="分数不是数字")
            return item
        if full <= 0 or score < 0 or score > full:
            item.update(status="error", msg="分数需在 0 ~ 满分之间")
            return item
        item.update(status="ok", msg="匹配：" + (stu["name"] or ""),
                    student_id=stu["id"], exam_name=exam or "导入成绩",
                    subject=subject, score=score, full_score=full,
                    mode=mode if mode in ("direct", "locked") else "direct",
                    remark=remark)
        return item

    # homeworks
    title, subject, desc = _cell(cols, 0), _cell(cols, 1), _cell(cols, 2)
    due, mode, tm = _cell(cols, 3), _cell(cols, 4), _cell(cols, 5)
    if not title:
        item.update(status="error", msg="标题为空")
        return item
    item.update(status="ok", msg="可导入作业", title=title, subject=subject,
                description=desc, due_at=due,
                mode=mode if mode in ("online", "upload", "notice") else "online",
                target_mode=tm if tm in ("all", "selected") else "all")
    return item


# ---------------------------------------------------------------- 辅助列表
@BP.get("/students")
@require("teacher")
def api_students():
    rows = _all_students()
    return resp_ok(students=[{
        "id": r["id"], "name": r["name"], "email": r["email"],
        "student_no": r["student_no"], "class_id": r["class_id"],
    } for r in rows])


@BP.get("/classes")
@require("teacher")
def api_classes():
    rows = db().execute(
        "SELECT id,name FROM classes WHERE teacher_id=? AND archived=0 ORDER BY id",
        (uid(),),
    ).fetchall()
    return resp_ok(classes=[dict(r) for r in rows])


# ---------------------------------------------------------------- ★1 成绩批量录入
@BP.post("/scores/batch")
@require("teacher")
def scores_batch():
    d = body()
    exam = (d.get("exam_name") or "").strip()
    if not exam:
        return resp_err("请填写考试 / 测验名称")
    try:
        full = float(d.get("full_score") or 100)
    except (TypeError, ValueError):
        return resp_err("满分无效")
    if full <= 0:
        return resp_err("满分需大于 0")
    mode = d.get("mode") or "direct"
    if mode not in ("direct", "locked"):
        return resp_err("发布方式不正确")
    items = d.get("items")
    if not isinstance(items, list) or not items:
        return resp_err("请填写至少一位学生的分数")

    stu_rows = _all_students()
    owned = {r["id"] for r in stu_rows}
    names = {r["id"]: r["name"] for r in stu_rows}
    # 逐条校验：学生必须属于该老师、分数 0 ~ 满分；全部通过才批量插入
    valid = []
    for i, it in enumerate(items, 1):
        if not isinstance(it, dict):
            return resp_err("第 %d 行数据格式不正确" % i)
        try:
            sid = int(it.get("student_id"))
        except (TypeError, ValueError):
            return resp_err("第 %d 行学生无效" % i)
        if sid not in owned:
            return resp_err("第 %d 行学生不属于本班" % i)
        try:
            score = float(it.get("score"))
        except (TypeError, ValueError):
            return resp_err("第 %d 行分数无效" % i)
        if score < 0 or score > full:
            return resp_err("第 %d 行分数需在 0 ~ %g 之间" % (i, full))
        valid.append((sid, score, (it.get("remark") or "").strip()))

    subject = (d.get("subject") or "").strip()
    created = now()
    con = db()
    credentials = []
    for sid, score, remark in valid:
        code, plain, digest = "", "", ""
        if mode == "locked":
            while True:
                code = "QK-" + gen_code(6)
                if not con.execute("SELECT 1 FROM scores WHERE view_code=?",
                                   (code,)).fetchone():
                    break
            plain = gen_code(6)
            digest = generate_password_hash(plain)
        # view_password 一律不写入，只存 view_hash
        con.execute(
            "INSERT INTO scores(teacher_id,student_id,exam_name,subject,score,"
            "full_score,remark,mode,view_code,view_password,view_hash,created_at) "
            "VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
            (uid(), sid, exam, subject, score, full, remark, mode,
             code, "", digest, created),
        )
        if mode == "locked":
            credentials.append({"student_id": sid, "view_code": code,
                                "view_password": plain})
    con.commit()

    # 逐条推送学生通知
    for sid, score, _ in valid:
        if mode == "locked":
            push_student_notification(
                sid, "score", "新成绩待解锁：" + exam,
                "老师发来一条密码保护的成绩，请向老师索取成绩代号与查看密码，在「我的成绩」中打开。",
            )
        else:
            push_student_notification(
                sid, "score", "新成绩：" + exam,
                "%s · %g / %g 分已发布，登录即可查看。" % (exam, score, full),
            )
    push_notification(uid(), "score", "成绩已批量发布",
                      "%s · 共 %d 条" % (exam, len(valid)))
    for c in credentials:
        c["name"] = names.get(c["student_id"], "")
    return resp_ok(created=len(valid), mode=mode, credentials=credentials)


# ---------------------------------------------------------------- 3 考试模板
@BP.get("/templates")
@require("teacher")
def templates_list():
    rows = db().execute(
        "SELECT id,name,subject,full_score,created_at FROM exam_templates "
        "WHERE teacher_id=? ORDER BY id DESC", (uid(),)
    ).fetchall()
    return resp_ok(templates=[dict(r) for r in rows])


def _template_payload():
    d = body()
    name = (d.get("name") or "").strip()
    if not name:
        return None, resp_err("请填写模板名称")
    try:
        full = float(d.get("full_score") or 100)
    except (TypeError, ValueError):
        return None, resp_err("满分无效")
    if full <= 0:
        return None, resp_err("满分需大于 0")
    return ({"name": name, "subject": (d.get("subject") or "").strip(),
             "full": full}, None)


@BP.post("/templates")
@require("teacher")
def templates_create():
    p, err = _template_payload()
    if err:
        return err
    cur = db().execute(
        "INSERT INTO exam_templates(teacher_id,name,subject,full_score,created_at) "
        "VALUES(?,?,?,?,?)", (uid(), p["name"], p["subject"], p["full"], now()),
    )
    db().commit()
    return resp_ok(id=cur.lastrowid)


@BP.put("/templates/<int:tid>")
@require("teacher")
def templates_update(tid):
    if not db().execute("SELECT 1 FROM exam_templates WHERE id=? AND teacher_id=?",
                        (tid, uid())).fetchone():
        return resp_err("模板不存在", 404)
    p, err = _template_payload()
    if err:
        return err
    db().execute("UPDATE exam_templates SET name=?,subject=?,full_score=? WHERE id=?",
                 (p["name"], p["subject"], p["full"], tid))
    db().commit()
    return resp_ok()


@BP.delete("/templates/<int:tid>")
@require("teacher")
def templates_delete(tid):
    cur = db().execute("DELETE FROM exam_templates WHERE id=? AND teacher_id=?",
                       (tid, uid()))
    db().commit()
    if cur.rowcount == 0:
        return resp_err("模板不存在", 404)
    return resp_ok()


# ---------------------------------------------------------------- 6 学生批量操作
@BP.post("/students/reset-passwords")
@require("teacher")
def students_reset():
    rows = _owned_students(body().get("ids"))
    if not rows:
        return resp_err("没有可操作的学生")
    con = db()
    out = []
    for r in rows:
        pwd = gen_code(8)
        con.execute("UPDATE students SET password_hash=?,initial_password=? WHERE id=?",
                    (generate_password_hash(pwd), pwd, r["id"]))
        out.append({"id": r["id"], "name": r["name"], "email": r["email"],
                    "password": pwd})
    con.commit()
    return resp_ok(items=out, count=len(out))


@BP.post("/students/batch-edit")
@require("teacher")
def students_batch_edit():
    d = body()
    owned = _owned_students(d.get("ids"))
    owned_ids = {r["id"] for r in owned}
    if not owned_ids:
        return resp_err("没有可操作的学生")
    # 逐人学号：items:[{id,student_no}]；id 必须属于本班
    by_id = {}
    for it in d.get("items") or []:
        if not isinstance(it, dict):
            continue
        try:
            sid = int(it.get("id"))
        except (TypeError, ValueError):
            continue
        if sid not in owned_ids:
            return resp_err("包含不属于本班的学生", 403)
        by_id[sid] = str(it.get("student_no") or "").strip()
    # 统一班级：留空 / 不传表示不修改
    class_id = None
    cid_raw = d.get("class_id", None)
    if cid_raw is not None and str(cid_raw).strip() != "":
        try:
            class_id = int(cid_raw)
        except (TypeError, ValueError):
            return resp_err("班级 ID 无效")
    con = db()
    touched = 0
    for r in owned:
        sid = r["id"]
        sets, args = [], []
        if class_id is not None:
            sets.append("class_id=?")
            args.append(class_id)
        if sid in by_id:
            sets.append("student_no=?")
            args.append(by_id[sid])
        if sets:
            args.append(sid)
            con.execute("UPDATE students SET %s WHERE id=?" % ",".join(sets), args)
            touched += 1
    con.commit()
    return resp_ok(updated=touched)


@BP.post("/students/remove")
@require("teacher")
def students_remove():
    rows = _owned_students(body().get("ids"))
    if not rows:
        return resp_err("没有可操作的学生")
    ph = ",".join("?" for _ in rows)
    cur = db().execute(
        "DELETE FROM students WHERE teacher_id=? AND id IN (%s)" % ph,
        [uid()] + [r["id"] for r in rows],
    )
    db().commit()
    return resp_ok(count=cur.rowcount)


# ---------------------------------------------------------------- 7 批量私信
@BP.post("/messages/batch")
@require("teacher")
def messages_batch():
    d = body()
    title = (d.get("title") or "").strip()
    text = (d.get("body") or "").strip()
    if not title:
        return resp_err("请填写通知标题")
    if not text:
        return resp_err("请填写通知内容")
    rows = _owned_students(d.get("ids"))
    if not rows:
        return resp_err("没有可发送的学生")
    for r in rows:
        push_student_notification(r["id"], "message", title, text)
    return resp_ok(count=len(rows))


# ---------------------------------------------------------------- 48 标准格式导出
@BP.get("/export/<kind>")
@require("teacher")
def export_all(kind):
    if kind not in HEADERS:
        return resp_err("不支持的导出类型", 404)
    con = db()
    if kind == "students":
        rows = con.execute(
            "SELECT name,email,student_no,initial_password,class_id,created_at "
            "FROM students WHERE teacher_id=? ORDER BY id", (uid(),)
        ).fetchall()
        data = [[r["name"], r["email"], r["student_no"],
                 r["initial_password"] or "（学生已自行修改）",
                 r["class_id"], r["created_at"]] for r in rows]
    elif kind == "scores":
        rows = con.execute(
            "SELECT sc.exam_name,sc.subject,sc.score,sc.full_score,sc.mode,sc.remark,"
            "sc.created_at,s.name AS sname,s.email,s.student_no "
            "FROM scores sc JOIN students s ON s.id=sc.student_id "
            "WHERE sc.teacher_id=? ORDER BY sc.id", (uid(),)
        ).fetchall()
        data = [[r["sname"], r["student_no"], r["email"], r["exam_name"],
                 r["subject"], r["score"], r["full_score"], r["mode"],
                 r["remark"], r["created_at"]] for r in rows]
    else:
        rows = con.execute(
            "SELECT title,subject,description,due_at,mode,target_mode,created_at "
            "FROM homeworks WHERE teacher_id=? ORDER BY id", (uid(),)
        ).fetchall()
        data = [[r["title"], r["subject"], r["description"], r["due_at"],
                 r["mode"], r["target_mode"], r["created_at"]] for r in rows]
    return csv_response(kind + ".csv", HEADERS[kind], data)


# ---------------------------------------------------------------- 48 标准格式导入
@BP.post("/import/preview")
@require("teacher")
def import_preview():
    d = body()
    kind = d.get("kind") or "students"
    if kind not in HEADERS:
        return resp_err("不支持的导入类型")
    rows = _parse_rows(d.get("text") or "")
    if len(rows) < 2:
        return resp_err("请粘贴包含表头和至少一行数据的标准 CSV")
    if not rows[0] or rows[0][0] != HEADERS[kind][0]:
        return resp_err("表头不符合「%s」标准格式，请使用本页导出的 CSV" % kind)
    ctx = _build_ctx()
    items = [_normalize(kind, r, ctx) for r in rows[1:]]
    return resp_ok(
        kind=kind, header=HEADERS[kind], items=items, total=len(items),
        ok=sum(1 for i in items if i["status"] == "ok"),
        update=sum(1 for i in items if i["status"] == "update"),
        bad=sum(1 for i in items if i["status"] == "error"),
    )


@BP.post("/import/commit")
@require("teacher")
def import_commit():
    d = body()
    kind = d.get("kind") or "students"
    if kind not in HEADERS:
        return resp_err("不支持的导入类型")
    items = d.get("items")
    if not isinstance(items, list) or not items:
        return resp_err("没有可导入的数据")
    con = db()
    ctx = _build_ctx()
    created = updated = skipped = 0
    for raw in items:
        cols = raw if isinstance(raw, list) else []
        # 重新校验，不信任前端预览结果
        norm = _normalize(kind, cols, ctx)
        if norm["status"] == "error":
            skipped += 1
            continue
        if kind == "students":
            email = norm["email"]
            pwd = norm["password"]
            if not (pwd and 4 <= len(pwd) <= 32 and pwd.isalnum()):
                pwd = gen_code(8)
            created_at = norm["created_at"] or now()
            if email in ctx["email_set"]:
                row = con.execute(
                    "SELECT id FROM students WHERE teacher_id=? AND email=?",
                    (uid(), email),
                ).fetchone()
                if row:
                    con.execute(
                        "UPDATE students SET name=?,student_no=?,class_id=? WHERE id=?",
                        (norm["name"], norm["student_no"], norm["class_id"], row["id"]),
                    )
                    updated += 1
                else:
                    skipped += 1
            else:
                try:
                    con.execute(
                        "INSERT INTO students(teacher_id,email,name,student_no,"
                        "password_hash,initial_password,class_id,created_at) "
                        "VALUES(?,?,?,?,?,?,?,?)",
                        (uid(), email, norm["name"], norm["student_no"],
                         generate_password_hash(pwd), pwd, norm["class_id"], created_at),
                    )
                    ctx["email_set"].add(email)
                    created += 1
                except Exception:
                    skipped += 1
        elif kind == "scores":
            try:
                # 标准格式不含查看密码，导入统一按「直接发送」落地
                con.execute(
                    "INSERT INTO scores(teacher_id,student_id,exam_name,subject,"
                    "score,full_score,remark,mode,view_code,view_password,view_hash,created_at) "
                    "VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                    (uid(), norm["student_id"], norm["exam_name"], norm["subject"],
                     norm["score"], norm["full_score"], norm["remark"], "direct",
                     "", "", "", now()),
                )
                created += 1
            except Exception:
                skipped += 1
        else:
            try:
                con.execute(
                    "INSERT INTO homeworks(teacher_id,title,subject,description,"
                    "due_at,mode,target_mode,created_at) VALUES(?,?,?,?,?,?,?,?)",
                    (uid(), norm["title"], norm["subject"], norm["description"],
                     norm["due_at"], norm["mode"], norm["target_mode"], now()),
                )
                created += 1
            except Exception:
                skipped += 1
    con.commit()
    return resp_ok(created=created, updated=updated, skipped=skipped)
