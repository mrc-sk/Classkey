# -*- coding: utf-8 -*-
"""启课 · 扩展模块「班级与协作」。

URL 前缀由 app.py 统一注册为 /api/x/classes。
覆盖功能：8 多班级（CRUD / 学生分班 / 当前班级偏好）、
9 班级码与公开加入申请 + 老师审核、10 多老师协作（class_staff）、
11 跨班汇总、12 学生分组（含组长）、13 学生档案读写、14 结班归档。

约定：所有「写」接口均 @require("teacher") 且校验资源 teacher_id = uid()；
公开 /join/<code> 自行把班级码当作令牌校验，不依赖登录态、不建账号、不泄露内部信息。
"""
from __future__ import annotations

import re

import extcore
from extcore import (db, require, resp_ok, resp_err, now, body, uid,
                     gen_code, get_setting, set_setting, T)

BP = extcore.bp("classes")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
CURRENT_KEY = "classes.current_class"


# ---------------------------------------------------------------- 归属校验工具
def _own_class(cid):
    """取回且仅取回属于当前老师（teacher_id=uid()）的班级。"""
    return db().execute(
        "SELECT * FROM classes WHERE id=? AND teacher_id=?", (cid, uid())
    ).fetchone()


def _own_student(sid):
    """取回且仅取回属于当前老师的学生。"""
    return db().execute(
        "SELECT * FROM students WHERE id=? AND teacher_id=?", (sid, uid())
    ).fetchone()


def _own_group(gid):
    """分组没有 teacher_id 列，归属通过 class_id -> classes.teacher_id 推导。"""
    return db().execute(
        "SELECT g.* FROM student_groups g JOIN classes c ON c.id=g.class_id "
        "WHERE g.id=? AND c.teacher_id=?", (gid, uid())
    ).fetchone()


def _own_request(rid):
    """加入申请的归属同样通过班级推导。"""
    return db().execute(
        "SELECT jr.* FROM join_requests jr JOIN classes c ON c.id=jr.class_id "
        "WHERE jr.id=? AND c.teacher_id=?", (rid, uid())
    ).fetchone()


def _new_join_code(con):
    while True:
        code = gen_code(6)
        if not con.execute("SELECT 1 FROM classes WHERE join_code=?",
                           (code,)).fetchone():
            return code


def _truthy(v):
    return v in (1, True, "1", "true", "True", "yes", "on")


# ================================================================ 8 / 14 多班级 · 归档
@BP.get("/")
@require("teacher")
def classes_list():
    rows = db().execute(
        "SELECT c.*, "
        "(SELECT COUNT(*) FROM students s WHERE s.class_id=c.id AND s.teacher_id=?) "
        "AS student_count "
        "FROM classes c WHERE c.teacher_id=? ORDER BY c.archived, c.id",
        (uid(), uid()),
    ).fetchall()
    return resp_ok(classes=[dict(r) for r in rows])


@BP.post("/")
@require("teacher")
def classes_create():
    d = body()
    name = (d.get("name") or "").strip()
    if not name:
        return resp_err("请填写班级名称")
    con = db()
    code = _new_join_code(con)
    cur = con.execute(
        "INSERT INTO classes(teacher_id,name,grade,school,join_code,archived,created_at) "
        "VALUES(?,?,?,?,?,0,?)",
        (uid(), name, (d.get("grade") or "").strip(),
         (d.get("school") or "").strip(), code, now()),
    )
    con.commit()
    return resp_ok(id=cur.lastrowid, join_code=code)


@BP.put("/<int:cid>")
@require("teacher")
def classes_update(cid):
    if not _own_class(cid):
        return resp_err("班级不存在或无权操作", 404)
    d = body()
    name = (d.get("name") or "").strip()
    if not name:
        return resp_err("请填写班级名称")
    db().execute(
        "UPDATE classes SET name=?,grade=?,school=? WHERE id=? AND teacher_id=?",
        (name, (d.get("grade") or "").strip(), (d.get("school") or "").strip(),
         cid, uid()),
    )
    db().commit()
    return resp_ok()


@BP.delete("/<int:cid>")
@require("teacher")
def classes_delete(cid):
    if not _own_class(cid):
        return resp_err("班级不存在或无权操作", 404)
    con = db()
    # 解绑学生，避免悬空 class_id；join_requests / class_staff / student_groups
    # 因外键 ON DELETE CASCADE 自动清理。
    con.execute("UPDATE students SET class_id=0 WHERE teacher_id=? AND class_id=?",
                (uid(), cid))
    con.execute("DELETE FROM classes WHERE id=? AND teacher_id=?", (cid, uid()))
    # 若当前偏好指向该班级则清空（set_setting 内部已提交上面的语句）。
    if str(get_setting(T, uid(), CURRENT_KEY, "0")) == str(cid):
        set_setting(T, uid(), CURRENT_KEY, "0")
    con.commit()
    return resp_ok()


@BP.put("/<int:cid>/archive")
@require("teacher")
def classes_archive(cid):
    """14 结班归档：archived=1 后班级码停止接受新申请。"""
    if not _own_class(cid):
        return resp_err("班级不存在或无权操作", 404)
    archived = 1 if _truthy(body().get("archived")) else 0
    db().execute("UPDATE classes SET archived=? WHERE id=? AND teacher_id=?",
                 (archived, cid, uid()))
    db().commit()
    if archived and str(get_setting(T, uid(), CURRENT_KEY, "0")) == str(cid):
        set_setting(T, uid(), CURRENT_KEY, "0")
    return resp_ok(archived=archived)


# ---------------------------------------------------------------- 当前班级偏好
@BP.get("/current")
@require("teacher")
def classes_current():
    try:
        cid = int(get_setting(T, uid(), CURRENT_KEY, "0"))
    except (TypeError, ValueError):
        cid = 0
    return resp_ok(class_id=cid)


@BP.post("/current")
@require("teacher")
def classes_set_current():
    try:
        cid = int(body().get("class_id") or 0)
    except (TypeError, ValueError):
        return resp_err("班级 ID 无效")
    if cid and not _own_class(cid):
        return resp_err("班级不存在或无权操作", 404)
    set_setting(T, uid(), CURRENT_KEY, str(cid))
    return resp_ok(class_id=cid)


# ---------------------------------------------------------------- 学生列表 / 分班 / 档案
@BP.get("/students")
@require("teacher")
def classes_students():
    rows = db().execute(
        "SELECT id,name,email,student_no,class_id,parent_contact,note,enrolled_at "
        "FROM students WHERE teacher_id=? ORDER BY id", (uid(),)
    ).fetchall()
    return resp_ok(students=[dict(r) for r in rows])


@BP.post("/students/assign")
@require("teacher")
def classes_assign():
    """8 把学生分配到 class_id（0 表示未分班），仅能操作本班学生。"""
    d = body()
    ids = d.get("student_ids")
    if not isinstance(ids, list) or not ids:
        return resp_err("请选择要分配的学生")
    clean = []
    for x in ids:
        try:
            clean.append(int(x))
        except (TypeError, ValueError):
            continue
    clean = list(dict.fromkeys(clean))
    if not clean:
        return resp_err("请选择要分配的学生")
    try:
        cid = int(d.get("class_id") or 0)
    except (TypeError, ValueError):
        return resp_err("班级 ID 无效")
    if cid and not _own_class(cid):
        return resp_err("班级不存在或无权操作", 404)
    ph = ",".join("?" for _ in clean)
    owned = db().execute(
        "SELECT id FROM students WHERE teacher_id=? AND id IN (%s)" % ph,
        [uid()] + clean,
    ).fetchall()
    owned_ids = [r["id"] for r in owned]
    if not owned_ids:
        return resp_err("没有可分配的学生")
    con = db()
    con.execute(
        "UPDATE students SET class_id=? WHERE teacher_id=? AND id IN (%s)"
        % ",".join("?" for _ in owned_ids),
        [cid, uid()] + owned_ids,
    )
    con.commit()
    return resp_ok(updated=len(owned_ids))


@BP.put("/students/<int:sid>")
@require("teacher")
def classes_student_update(sid):
    """13 学生档案：家长联系方式 / 备注 / 入学时间。"""
    if not _own_student(sid):
        return resp_err("学生不存在或无权操作", 404)
    d = body()
    db().execute(
        "UPDATE students SET parent_contact=?,note=?,enrolled_at=? "
        "WHERE id=? AND teacher_id=?",
        ((d.get("parent_contact") or "").strip(),
         (d.get("note") or "").strip(),
         (d.get("enrolled_at") or "").strip(),
         sid, uid()),
    )
    db().commit()
    return resp_ok()


# ================================================================ 9 班级码 · 公开加入 · 审核
@BP.post("/<int:cid>/join-code")
@require("teacher")
def classes_join_code(cid):
    """重新生成班级码。"""
    if not _own_class(cid):
        return resp_err("班级不存在或无权操作", 404)
    con = db()
    code = _new_join_code(con)
    con.execute("UPDATE classes SET join_code=? WHERE id=? AND teacher_id=?",
                (code, cid, uid()))
    con.commit()
    return resp_ok(join_code=code)


def _active_class_by_code(code):
    """公开接口自行校验：班级码存在、非空、且班级未归档，否则视为无效。"""
    code = (code or "").strip()
    if not code:
        return None
    return db().execute(
        "SELECT id,name,grade,school FROM classes "
        "WHERE join_code=? AND join_code<>'' AND archived=0", (code,)
    ).fetchone()


@BP.get("/join/<code>")
def classes_join_info(code):
    """公开：仅返回用于确认去向的最小、非敏感信息，不含老师/学生/其它班级码。"""
    c = _active_class_by_code(code)
    if not c:
        return resp_err("班级码无效或已停止加入申请", 404)
    return resp_ok(name=c["name"], grade=c["grade"], school=c["school"])


@BP.post("/join/<code>")
def classes_join_apply(code):
    """公开：写 join_requests（不建账号、不泄露任何内部状态）。

    班级码即令牌，自行校验；全局 CSRF 由前端 Qike.api() 自动携带 token 满足。
    """
    c = _active_class_by_code(code)
    if not c:
        return resp_err("班级码无效或已停止加入申请", 404)
    d = body()
    email = (d.get("student_email") or "").strip().lower()
    name = (d.get("student_name") or "").strip()
    if not EMAIL_RE.fullmatch(email) or len(email) > 120:
        return resp_err("请填写正确的邮箱")
    if not name or len(name) > 60:
        return resp_err("请填写姓名（不超过 60 字）")
    con = db()
    # 去重：同班同邮箱已有待审核申请则不重复写入；对外始终返回同一句成功文案。
    exists = con.execute(
        "SELECT 1 FROM join_requests WHERE class_id=? AND student_email=? "
        "AND status='pending'", (c["id"], email),
    ).fetchone()
    if not exists:
        con.execute(
            "INSERT INTO join_requests(class_id,student_email,student_name,status,created_at) "
            "VALUES(?,?,?,'pending',?)", (c["id"], email, name, now()),
        )
        con.commit()
    return resp_ok(message="申请已提交，请等待老师审核")


@BP.get("/join-requests")
@require("teacher")
def classes_join_requests():
    rows = db().execute(
        "SELECT jr.id,jr.class_id,jr.student_email,jr.student_name,jr.status,"
        "jr.created_at,c.name AS class_name "
        "FROM join_requests jr JOIN classes c ON c.id=jr.class_id "
        "WHERE c.teacher_id=? ORDER BY (jr.status='pending') DESC, jr.id DESC",
        (uid(),),
    ).fetchall()
    return resp_ok(requests=[dict(r) for r in rows])


@BP.post("/join-requests/<int:rid>/review")
@require("teacher")
def classes_join_review(rid):
    """老师审核：仅标记状态，不自动创建学生账号。"""
    if not _own_request(rid):
        return resp_err("申请不存在或无权操作", 404)
    action = body().get("action")
    if action not in ("approve", "reject"):
        return resp_err("审核动作不正确")
    status = "approved" if action == "approve" else "rejected"
    db().execute("UPDATE join_requests SET status=? WHERE id=?", (status, rid))
    db().commit()
    return resp_ok(status=status)


# ================================================================ 10 多老师协作
@BP.get("/<int:cid>/staff")
@require("teacher")
def classes_staff_list(cid):
    if not _own_class(cid):
        return resp_err("班级不存在或无权操作", 404)
    rows = db().execute(
        "SELECT cs.id,cs.teacher_id,cs.role,cs.subject,cs.created_at,"
        "t.email,t.name "
        "FROM class_staff cs JOIN teachers t ON t.id=cs.teacher_id "
        "WHERE cs.class_id=? ORDER BY cs.id", (cid,)
    ).fetchall()
    return resp_ok(staff=[dict(r) for r in rows])


@BP.post("/<int:cid>/staff")
@require("teacher")
def classes_staff_add(cid):
    if not _own_class(cid):
        return resp_err("班级不存在或无权操作", 404)
    d = body()
    email = (d.get("email") or "").strip().lower()
    if not EMAIL_RE.fullmatch(email):
        return resp_err("请填写正确的老师邮箱")
    row = db().execute("SELECT id,name,email FROM teachers WHERE email=?",
                       (email,)).fetchone()
    if not row:
        return resp_err("该邮箱未注册老师账号")
    if row["id"] == uid():
        return resp_err("无需把自己添加为科任老师")
    con = db()
    if con.execute("SELECT 1 FROM class_staff WHERE class_id=? AND teacher_id=?",
                   (cid, row["id"])).fetchone():
        return resp_err("该老师已在协作名单中")
    subject = (d.get("subject") or "").strip()
    con.execute(
        "INSERT INTO class_staff(class_id,teacher_id,role,subject,created_at) "
        "VALUES(?,?,'subject',?,?)", (cid, row["id"], subject, now()),
    )
    con.commit()
    return resp_ok(id=row["id"], name=row["name"], email=row["email"],
                   subject=subject)


@BP.delete("/<int:cid>/staff/<int:sid>")
@require("teacher")
def classes_staff_remove(cid, sid):
    if not _own_class(cid):
        return resp_err("班级不存在或无权操作", 404)
    cur = db().execute(
        "DELETE FROM class_staff WHERE id=? AND class_id=? AND role<>'owner'",
        (sid, cid),
    )
    db().commit()
    if cur.rowcount == 0:
        return resp_err("协作老师不存在", 404)
    return resp_ok()


# ================================================================ 11 跨班汇总
@BP.get("/summary")
@require("teacher")
def classes_summary():
    con = db()
    out = []
    classes = con.execute(
        "SELECT id,name,grade,school,archived FROM classes "
        "WHERE teacher_id=? ORDER BY archived,id", (uid(),)
    ).fetchall()
    for c in classes:
        cid = c["id"]
        sc = con.execute(
            "SELECT COUNT(*) AS n FROM students WHERE teacher_id=? AND class_id=?",
            (uid(), cid),
        ).fetchone()["n"]
        hw = con.execute(
            "SELECT COUNT(*) AS n FROM homeworks WHERE teacher_id=? AND class_id=?",
            (uid(), cid),
        ).fetchone()["n"]
        avg = con.execute(
            "SELECT AVG(sc.score) AS a FROM scores sc "
            "JOIN students s ON s.id=sc.student_id "
            "WHERE sc.teacher_id=? AND s.class_id=?", (uid(), cid),
        ).fetchone()["a"]
        out.append({
            "class_id": cid, "name": c["name"], "grade": c["grade"],
            "school": c["school"], "archived": c["archived"],
            "student_count": sc, "homework_count": hw,
            "avg_score": round(avg, 2) if avg is not None else None,
        })
    # 未分班（class_id=0）学生单独成一组，便于全量掌握。
    sc0 = con.execute(
        "SELECT COUNT(*) AS n FROM students WHERE teacher_id=? AND class_id=0",
        (uid(),),
    ).fetchone()["n"]
    if sc0:
        hw0 = con.execute(
            "SELECT COUNT(*) AS n FROM homeworks WHERE teacher_id=? AND class_id=0",
            (uid(),),
        ).fetchone()["n"]
        avg0 = con.execute(
            "SELECT AVG(sc.score) AS a FROM scores sc "
            "JOIN students s ON s.id=sc.student_id "
            "WHERE sc.teacher_id=? AND s.class_id=0", (uid(),),
        ).fetchone()["a"]
        out.append({
            "class_id": 0, "name": "未分班", "grade": "", "school": "",
            "archived": 0, "student_count": sc0, "homework_count": hw0,
            "avg_score": round(avg0, 2) if avg0 is not None else None,
        })
    return resp_ok(summary=out)


# ================================================================ 12 学生分组
@BP.get("/groups/<int:cid>")
@require("teacher")
def classes_groups(cid):
    if not _own_class(cid):
        return resp_err("班级不存在或无权操作", 404)
    groups = db().execute(
        "SELECT id,class_id,name,created_at FROM student_groups "
        "WHERE class_id=? ORDER BY id", (cid,)
    ).fetchall()
    out = []
    for g in groups:
        members = db().execute(
            "SELECT m.student_id,m.is_leader,s.name,s.student_no "
            "FROM student_group_members m JOIN students s ON s.id=m.student_id "
            "WHERE m.group_id=? ORDER BY m.is_leader DESC, s.id", (g["id"],)
        ).fetchall()
        item = dict(g)
        item["members"] = [dict(m) for m in members]
        out.append(item)
    return resp_ok(groups=out)


@BP.post("/groups/<int:cid>")
@require("teacher")
def classes_group_create(cid):
    if not _own_class(cid):
        return resp_err("班级不存在或无权操作", 404)
    name = (body().get("name") or "").strip()
    if not name:
        return resp_err("请填写分组名称")
    cur = db().execute(
        "INSERT INTO student_groups(class_id,name,created_at) VALUES(?,?,?)",
        (cid, name, now()),
    )
    db().commit()
    return resp_ok(id=cur.lastrowid)


@BP.put("/groups/<int:gid>")
@require("teacher")
def classes_group_update(gid):
    if not _own_group(gid):
        return resp_err("分组不存在或无权操作", 404)
    name = (body().get("name") or "").strip()
    if not name:
        return resp_err("请填写分组名称")
    db().execute("UPDATE student_groups SET name=? WHERE id=?", (name, gid))
    db().commit()
    return resp_ok()


@BP.delete("/groups/<int:gid>")
@require("teacher")
def classes_group_delete(gid):
    if not _own_group(gid):
        return resp_err("分组不存在或无权操作", 404)
    db().execute("DELETE FROM student_groups WHERE id=?", (gid,))
    db().commit()
    return resp_ok()


@BP.post("/groups/<int:gid>/members")
@require("teacher")
def classes_group_members_add(gid):
    g = _own_group(gid)
    if not g:
        return resp_err("分组不存在或无权操作", 404)
    ids = body().get("student_ids")
    if not isinstance(ids, list) or not ids:
        return resp_err("请选择学生")
    clean = []
    for x in ids:
        try:
            clean.append(int(x))
        except (TypeError, ValueError):
            continue
    clean = list(dict.fromkeys(clean))
    if not clean:
        return resp_err("请选择学生")
    con = db()
    ph = ",".join("?" for _ in clean)
    # 仅允许同班、且属于当前老师的学生加入。
    owned = con.execute(
        "SELECT id FROM students WHERE teacher_id=? AND class_id=? AND id IN (%s)" % ph,
        [uid(), g["class_id"]] + clean,
    ).fetchall()
    owned_ids = [r["id"] for r in owned]
    if not owned_ids:
        return resp_err("没有可加入本分组的学生")
    for sid in owned_ids:
        con.execute(
            "INSERT OR IGNORE INTO student_group_members(group_id,student_id,is_leader) "
            "VALUES(?,?,0)", (gid, sid),
        )
    con.commit()
    return resp_ok(added=len(owned_ids))


@BP.put("/groups/<int:gid>/members/<int:sid>")
@require("teacher")
def classes_group_member_leader(gid, sid):
    """标记 / 取消组长（可标组长）。"""
    if not _own_group(gid):
        return resp_err("分组不存在或无权操作", 404)
    is_leader = 1 if _truthy(body().get("is_leader")) else 0
    cur = db().execute(
        "UPDATE student_group_members SET is_leader=? "
        "WHERE group_id=? AND student_id=?", (is_leader, gid, sid),
    )
    db().commit()
    if cur.rowcount == 0:
        return resp_err("该成员不在分组中", 404)
    return resp_ok(is_leader=is_leader)


@BP.delete("/groups/<int:gid>/members/<int:sid>")
@require("teacher")
def classes_group_member_remove(gid, sid):
    if not _own_group(gid):
        return resp_err("分组不存在或无权操作", 404)
    cur = db().execute(
        "DELETE FROM student_group_members WHERE group_id=? AND student_id=?",
        (gid, sid),
    )
    db().commit()
    if cur.rowcount == 0:
        return resp_err("该成员不在分组中", 404)
    return resp_ok()
