# -*- coding: utf-8 -*-
"""成绩扩展：等级制 / 排名开关 / 成绩单打印 / 家长只读 / 修正留痕 / 雷达图 / 进步榜"""
from __future__ import annotations

import html
import secrets
from datetime import datetime, timedelta
from flask import Response, request

from extcore import (bp, db, require, resp_ok, resp_err, now, body, uid,
                     teacher_of_student, gen_code, get_setting, set_setting, T, audit)

BP = bp("scores")
E = lambda s: html.escape(str(s if s is not None else ""), quote=True)

DEFAULTS = {"grade_mode": "score", "pass_line": "60", "excellent_line": "85",
            "show_rank": "0"}


def _cfg():
    return {k: get_setting(T, uid(), "scores." + k, v) for k, v in DEFAULTS.items()}


def _level(pct, cfg):
    if pct >= float(cfg["excellent_line"]):
        return "优秀"
    if pct >= 70:
        return "良好"
    if pct >= float(cfg["pass_line"]):
        return "及格"
    return "待提高"


def _owned(scid):
    return db().execute("SELECT * FROM scores WHERE id=? AND teacher_id=?",
                        (scid, uid())).fetchone()


# ---------------------------------------------------------------- 23/24/30 设置
@BP.get("/settings")
@require("teacher")
def settings():
    return resp_ok(settings=_cfg())


@BP.post("/settings")
@require("teacher")
def save_settings():
    d = body()
    for k in DEFAULTS:
        if k in d:
            set_setting(T, uid(), "scores." + k, str(d[k]))
    return resp_ok(settings=_cfg())


# ---------------------------------------------------------------- 27 修正留痕 / 撤回
@BP.post("/edit/<int:scid>")
@require("teacher")
def edit_score(scid):
    row = _owned(scid)
    if not row:
        return resp_err("成绩记录不存在", 404)
    try:
        new = float(body().get("score"))
    except (TypeError, ValueError):
        return resp_err("请填写有效分数")
    if new < 0 or new > row["full_score"]:
        return resp_err("分数需在 0 ~ 满分之间")
    reason = str(body().get("reason") or "")[:200]
    db().execute("UPDATE scores SET score=? WHERE id=?", (new, scid))
    db().execute(
        "INSERT INTO score_edits(score_id,teacher_id,old_score,new_score,reason,created_at) "
        "VALUES(?,?,?,?,?,?)", (scid, uid(), row["score"], new, reason, now()))
    db().commit()
    audit("score.edit", "成绩 %d：%s -> %s" % (scid, row["score"], new))
    return resp_ok(score=new)


@BP.get("/edits")
@require("teacher")
def edit_history():
    rows = db().execute(
        "SELECT e.*,s.name AS student_name FROM score_edits e "
        "JOIN scores sc ON sc.id=e.score_id JOIN students s ON s.id=sc.student_id "
        "WHERE e.teacher_id=? ORDER BY e.id DESC LIMIT 200", (uid(),)).fetchall()
    return resp_ok(items=[dict(r) for r in rows])


@BP.post("/revoke/<int:scid>")
@require("teacher")
def revoke(scid):
    if not _owned(scid):
        return resp_err("成绩记录不存在", 404)
    db().execute("UPDATE scores SET revoked=1 WHERE id=?", (scid,))
    db().commit()
    audit("score.revoke", "撤回成绩 %d" % scid)
    return resp_ok()


# ---------------------------------------------------------------- 25 成绩单打印
@BP.post("/report")
@require("teacher")
def report():
    """返回打印友好的 HTML：一人一页，浏览器打印可另存 PDF，中文不乱码、无需第三方库。"""
    d = body()
    sid = d.get("student_id")
    stu = db().execute("SELECT * FROM students WHERE id=? AND teacher_id=?", (sid, uid())).fetchone()
    if not stu:
        return resp_err("学生不存在", 404)
    tea = db().execute("SELECT * FROM teachers WHERE id=?", (uid(),)).fetchone()
    cfg = _cfg()
    rows = db().execute(
        "SELECT * FROM scores WHERE student_id=? AND revoked=0 ORDER BY id", (sid,)).fetchall()
    trs = "".join(
        "<tr><td>%s</td><td>%s</td><td>%s</td><td>%g / %g</td><td>%s</td></tr>" % (
            E(r["created_at"]), E(r["exam_name"]), E(r["subject"]), r["score"], r["full_score"],
            E(_level(r["score"] / r["full_score"] * 100 if r["full_score"] else 0, cfg)))
        for r in rows) or '<tr><td colspan="5">暂无成绩记录</td></tr>'
    vals = [r["score"] / r["full_score"] * 100 for r in rows if r["full_score"]]
    avg = sum(vals) / len(vals) if vals else 0
    page = """<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>成绩单 - %s</title><style>
@page{size:A4;margin:18mm}body{font-family:"Microsoft YaHei",sans-serif;color:#1b2b40;margin:0}
.hd{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #4E95D9;padding-bottom:12px}
h1{font-size:22px;margin:0;color:#2f6fb5}.sub{font-size:12px;color:#6b7d92;margin-top:6px}
.meta{margin:18px 0;font-size:14px;line-height:1.9}
table{width:100%%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #d7e2ee;padding:9px;text-align:left}
th{background:#eef5fd}.sum{margin-top:16px;padding:12px;background:#f4f9ff;border-radius:8px;font-size:14px}
.ft{margin-top:26px;font-size:12px;color:#8a99aa;display:flex;justify-content:space-between}
@media print{.noprint{display:none}body{padding:0}}
</style></head><body>
<div class="noprint" style="padding:10px;background:#eef5fd;text-align:center">
<button onclick="window.print()" style="padding:8px 18px">打印 / 另存为 PDF</button></div>
<div class="hd"><div><h1>%s · 学生成绩单</h1><div class="sub">%s %s %s</div></div>
<div style="font-size:12px;color:#6b7d92">生成时间 %s</div></div>
<div class="meta"><strong>姓名：</strong>%s　<strong>学号：</strong>%s　<strong>邮箱：</strong>%s<br>
<strong>班级：</strong>%s　<strong>任课老师：</strong>%s</div>
<table><thead><tr><th>日期</th><th>考试 / 测验</th><th>科目</th><th>分数</th><th>等级</th></tr></thead>
<tbody>%s</tbody></table>
<div class="sum">共 <strong>%d</strong> 条成绩　百分制平均 <strong>%.1f</strong>　整体评价 <strong>%s</strong>
（及格线 %s / 优秀线 %s）</div>
<div class="ft"><span>本成绩单由启课生成，仅供学生与家长查看</span><span>教师签名：____________</span></div>
</body></html>""" % (
        E(stu["name"]), E(tea["school"] or "启课"), E(tea["grade"]), E(tea["class_name"]),
        E(now()), E(stu["name"]), E(stu["student_no"]), E(stu["email"]),
        E(" / ".join(x for x in [tea["school"], tea["grade"], tea["class_name"]] if x) or "未填写"),
        E(tea["name"]), trs, len(rows), avg, E(_level(avg, cfg)),
        E(cfg["pass_line"]), E(cfg["excellent_line"]))
    return resp_ok(html=page)


# ---------------------------------------------------------------- 26 家长只读链接
@BP.get("/parent-links")
@require("teacher")
def link_list():
    rows = db().execute(
        "SELECT p.*,s.name AS student_name FROM parent_links p "
        "JOIN students s ON s.id=p.student_id WHERE p.teacher_id=? ORDER BY p.id DESC",
        (uid(),)).fetchall()
    return resp_ok(items=[dict(r) for r in rows])


@BP.post("/parent-links")
@require("teacher")
def link_add():
    d = body()
    sid = d.get("student_id")
    if not db().execute("SELECT 1 FROM students WHERE id=? AND teacher_id=?", (sid, uid())).fetchone():
        return resp_err("学生不存在", 404)
    days = max(1, min(365, int(d.get("days") or 30)))
    token = secrets.token_urlsafe(24)
    exp = (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d %H:%M")
    db().execute(
        "INSERT INTO parent_links(student_id,teacher_id,token,expires_at,created_at) "
        "VALUES(?,?,?,?,?)", (sid, uid(), token, exp, now()))
    db().commit()
    return resp_ok(token=token, expires_at=exp,
                   url="/api/x/scores/p/" + token)


@BP.post("/parent-links/<int:lid>/revoke")
@require("teacher")
def link_revoke(lid):
    db().execute("UPDATE parent_links SET revoked=1 WHERE id=? AND teacher_id=?", (lid, uid()))
    db().commit()
    return resp_ok()


@BP.get("/p/<token>")
def parent_view(token):
    """公开只读页：凭链接查看，无需注册。无内联 script，符合 CSP。"""
    link = db().execute("SELECT * FROM parent_links WHERE token=?", (token,)).fetchone()
    if not link or link["revoked"]:
        return Response("<h3>链接已失效</h3>", mimetype="text/html; charset=utf-8")
    if link["expires_at"] and link["expires_at"] < now():
        return Response("<h3>链接已过期</h3>", mimetype="text/html; charset=utf-8")
    stu = db().execute("SELECT * FROM students WHERE id=?", (link["student_id"],)).fetchone()
    tea = db().execute("SELECT * FROM teachers WHERE id=?", (link["teacher_id"],)).fetchone()
    if not stu or not tea:
        return Response("<h3>数据不存在</h3>", mimetype="text/html; charset=utf-8")
    scores = db().execute(
        "SELECT * FROM scores WHERE student_id=? AND revoked=0 ORDER BY id DESC",
        (stu["id"],)).fetchall()
    hws = db().execute(
        "SELECT h.title,h.subject,h.due_at,sub.status FROM homeworks h "
        "LEFT JOIN submissions sub ON sub.homework_id=h.id AND sub.student_id=? "
        "WHERE h.teacher_id=? ORDER BY h.id DESC LIMIT 30", (stu["id"], tea["id"])).fetchall()
    srows = "".join("<tr><td>%s</td><td>%s</td><td>%s</td><td>%g / %g</td></tr>" % (
        E(r["created_at"]), E(r["exam_name"]), E(r["subject"]), r["score"], r["full_score"])
        for r in scores) or '<tr><td colspan="4">暂无成绩</td></tr>'
    hrows = "".join("<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>" % (
        E(r["title"]), E(r["subject"]), E(r["due_at"] or "不限时"),
        E({"submitted": "已提交", "acked": "已知悉", "reviewed": "已批改"}.get(r["status"], "待完成")))
        for r in hws) or '<tr><td colspan="4">暂无作业</td></tr>'
    page = """<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>%s · 学习情况</title>
<style>body{font-family:"Microsoft YaHei",sans-serif;background:#f4f8fd;color:#1b2b40;margin:0;padding:24px}
.wrap{max-width:820px;margin:auto}.hd{background:linear-gradient(120deg,#4E95D9,#74b6e8);color:#fff;
padding:24px 28px;border-radius:18px}.hd h1{margin:0;font-size:22px}.hd p{margin:8px 0 0;font-size:13px;opacity:.9}
.card{background:#fff;border-radius:16px;padding:20px 24px;margin-top:16px;box-shadow:0 6px 24px rgba(30,70,120,.08)}
h2{font-size:16px;margin:0 0 14px;color:#2f6fb5}table{width:100%%;border-collapse:collapse;font-size:13px}
th,td{padding:10px;border-bottom:1px solid #e6eef7;text-align:left}th{color:#6b7d92;font-weight:600}
.ft{text-align:center;color:#8a99aa;font-size:12px;margin-top:18px}</style></head><body><div class="wrap">
<div class="hd"><h1>%s · 学习情况</h1><p>%s · %s 老师 · 只读视图，无需登录</p></div>
<div class="card"><h2>成绩记录</h2><table><thead><tr><th>日期</th><th>考试</th><th>科目</th><th>分数</th></tr></thead>
<tbody>%s</tbody></table></div>
<div class="card"><h2>作业完成情况</h2><table><thead><tr><th>作业</th><th>科目</th><th>截止</th><th>状态</th></tr></thead>
<tbody>%s</tbody></table></div><div class="ft">链接有效期至 %s · 启课</div></div></body></html>""" % (
        E(stu["name"]), E(stu["name"]), E(tea["school"] or "启课"), E(tea["name"]),
        srows, hrows, E(link["expires_at"]))
    return Response(page, mimetype="text/html; charset=utf-8")


# ---------------------------------------------------------------- 24 学生端排名开关
@BP.get("/my-rank")
@require("student")
def my_rank():
    """老师在成绩工具里关闭「对学生公开排名」时，这里不返回任何名次信息。"""
    tid = teacher_of_student(uid())
    if not tid or get_setting(T, tid, "scores.show_rank", "0") != "1":
        return resp_ok(show_rank=False)
    rows = db().execute(
        "SELECT student_id, AVG(score/full_score*100) AS avg FROM scores "
        "WHERE teacher_id=? AND full_score>0 AND revoked=0 "
        "GROUP BY student_id ORDER BY avg DESC", (tid,)).fetchall()
    rank = next((i + 1 for i, r in enumerate(rows) if r["student_id"] == uid()), None)
    return resp_ok(show_rank=True, rank=rank, total=len(rows))


# ---------------------------------------------------------------- 28/29 雷达与进步榜
@BP.get("/insight")
@require("teacher")
def insight():
    cfg = _cfg()
    rows = db().execute(
        "SELECT sc.*,s.name AS student_name FROM scores sc JOIN students s ON s.id=sc.student_id "
        "WHERE sc.teacher_id=? AND sc.revoked=0 ORDER BY sc.id", (uid(),)).fetchall()
    subjects, by_stu = {}, {}
    for r in rows:
        pct = r["score"] / r["full_score"] * 100 if r["full_score"] else 0
        subjects.setdefault(r["subject"] or "未分科", []).append(pct)
        by_stu.setdefault(r["student_id"], {"name": r["student_name"], "vals": []})["vals"].append(pct)
    radar = [{"subject": k, "avg": round(sum(v) / len(v), 1)} for k, v in subjects.items()]
    progress, borderline = [], []
    for sid, info in by_stu.items():
        vals = info["vals"]
        last = vals[-1] if vals else 0
        delta = round(last - vals[-2], 1) if len(vals) >= 2 else 0.0
        progress.append({"name": info["name"], "last": round(last, 1), "delta": delta})
        if float(cfg["pass_line"]) - 5 <= last < float(cfg["pass_line"]):
            borderline.append({"name": info["name"], "last": round(last, 1)})
    progress.sort(key=lambda x: x["delta"], reverse=True)
    return resp_ok(radar=radar, progress=progress[:20], borderline=borderline,
                   settings=cfg, show_rank=cfg["show_rank"] == "1")
