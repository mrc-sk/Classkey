# -*- coding: utf-8 -*-
"""运维扩展：审计 / 全局搜索 / 日历 / 待办看板 / 设备 / 备份 / 两步验证 / 品牌"""
from __future__ import annotations

import base64
import glob
import hashlib
import hmac
import os
import secrets
import struct
import time
import zipfile
from datetime import datetime, timedelta
from flask import Response, request, send_file

from extcore import (bp, db, require, resp_ok, resp_err, now, body, uid, role, me,
                     push_notification, BASE, DATA_DIR, UPLOAD_DIR,
                     get_setting, set_setting, APP, T, audit)

BP = bp("ops")
BACKUP_DIR = os.path.join(BASE, "backups")


# ---------------------------------------------------------------- 44 审计日志
@BP.get("/audit")
@require("teacher")
def audit_list():
    rows = db().execute(
        "SELECT * FROM audit_logs WHERE actor_id=? AND actor_role='teacher' "
        "ORDER BY id DESC LIMIT 200", (uid(),)).fetchall()
    return resp_ok(items=[dict(r) for r in rows])


# ---------------------------------------------------------------- 39 全局搜索
@BP.get("/search")
def search():
    q = (request.args.get("q") or "").strip()[:60]
    if not q:
        return resp_ok(items=[])
    like = "%" + q + "%"
    items = []
    if role() == "teacher":
        for r in db().execute(
            "SELECT id,name,email FROM students WHERE teacher_id=? AND "
            "(name LIKE ? OR email LIKE ? OR student_no LIKE ?) LIMIT 20", (uid(), like, like, like)):
            items.append({"type": "学生", "label": r["name"], "sub": r["email"]})
        for r in db().execute(
            "SELECT id,title,subject FROM homeworks WHERE teacher_id=? AND "
            "(title LIKE ? OR description LIKE ?) LIMIT 20", (uid(), like, like)):
            items.append({"type": "作业", "label": r["title"], "sub": r["subject"]})
        for r in db().execute(
            "SELECT id,exam_name,subject FROM scores WHERE teacher_id=? AND exam_name LIKE ? LIMIT 20",
            (uid(), like)):
            items.append({"type": "成绩", "label": r["exam_name"], "sub": r["subject"]})
    else:
        for r in db().execute(
            "SELECT h.id,h.title FROM homeworks h JOIN students s ON s.teacher_id=h.teacher_id "
            "WHERE s.id=? AND h.title LIKE ? LIMIT 20", (uid(), like)):
            items.append({"type": "作业", "label": r["title"], "sub": ""})
        for r in db().execute("SELECT exam_name,subject FROM scores WHERE student_id=? "
                              "AND exam_name LIKE ? LIMIT 20", (uid(), like)):
            items.append({"type": "成绩", "label": r["exam_name"], "sub": r["subject"]})
    return resp_ok(items=items)


# ---------------------------------------------------------------- 40 日历视图
@BP.get("/calendar")
def calendar():
    events = []
    if role() == "teacher":
        hws = db().execute("SELECT id,title,due_at,scheduled_at FROM homeworks WHERE teacher_id=?",
                           (uid(),)).fetchall()
    else:
        hws = db().execute(
            "SELECT h.id,h.title,h.due_at,h.scheduled_at FROM homeworks h "
            "JOIN students s ON s.teacher_id=h.teacher_id WHERE s.id=?", (uid(),)).fetchall()
    for h in hws:
        if h["due_at"]:
            events.append({"date": h["due_at"][:10], "title": h["title"], "kind": "截止"})
        elif h["scheduled_at"]:
            events.append({"date": h["scheduled_at"][:10], "title": h["title"], "kind": "发布"})
    return resp_ok(events=events)


# ---------------------------------------------------------------- 41 待办看板
@BP.get("/board")
def board():
    if role() == "teacher":
        pending = db().execute(
            "SELECT COUNT(*) c FROM submissions sub JOIN homeworks h ON h.id=sub.homework_id "
            "WHERE h.teacher_id=? AND sub.comment=''", (uid(),)).fetchone()["c"]
        late = db().execute(
            "SELECT COUNT(*) c FROM homeworks h WHERE h.teacher_id=? AND h.due_at<>'' "
            "AND h.due_at<?", (uid(), now())).fetchone()["c"]
        week = db().execute(
            "SELECT COUNT(*) c FROM homeworks WHERE teacher_id=? AND created_at>=?",
            (uid(), (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d %H:%M"))).fetchone()["c"]
        unread = db().execute("SELECT COUNT(*) c FROM notifications WHERE teacher_id=? AND is_read=0",
                              (uid(),)).fetchone()["c"]
        return resp_ok(cards=[{"label": "待批改", "value": pending}, {"label": "已截止作业", "value": late},
                              {"label": "近 7 天作业", "value": week}, {"label": "未读通知", "value": unread}])
    todo = db().execute(
        "SELECT COUNT(*) c FROM homeworks h JOIN students s ON s.teacher_id=h.teacher_id "
        "WHERE s.id=? AND h.mode<>'notice' AND NOT EXISTS"
        "(SELECT 1 FROM submissions x WHERE x.homework_id=h.id AND x.student_id=s.id)",
        (uid(),)).fetchone()["c"]
    scores = db().execute("SELECT COUNT(*) c FROM scores WHERE student_id=?", (uid(),)).fetchone()["c"]
    unread = db().execute("SELECT COUNT(*) c FROM student_notifications WHERE student_id=? AND is_read=0",
                          (uid(),)).fetchone()["c"]
    return resp_ok(cards=[{"label": "待完成作业", "value": todo},
                          {"label": "成绩条数", "value": scores}, {"label": "未读消息", "value": unread}])


# ---------------------------------------------------------------- 46 登录设备 / 异地提醒
@BP.post("/login-ping")
def login_ping():
    """登录后由前端调用：记录本次设备，IP 与上次不同时推送异地登录提醒。"""
    u = me()
    if not u or u["role"] != "teacher":
        return resp_ok()
    ip = request.remote_addr or ""
    last = db().execute(
        "SELECT ip FROM login_devices WHERE teacher_id=? ORDER BY id DESC LIMIT 1", (uid(),)
    ).fetchone()
    if last and last["ip"] and ip and last["ip"] != ip:
        push_notification(uid(), "security", "异地登录提醒",
                          "检测到新 IP（%s → %s）登录了你的账号，如非本人请立即修改密码。"
                          % (last["ip"], ip), important=True)
    db().execute(
        "INSERT OR IGNORE INTO login_devices(teacher_id,token,ua,ip,last_seen,created_at) "
        "VALUES(?,?,?,?,?,?)",
        (uid(), secrets.token_urlsafe(12),
         (request.headers.get("User-Agent") or "")[:200], ip, now(), now()))
    db().commit()
    return resp_ok()


@BP.get("/devices")
@require("teacher")
def devices():
    token = secrets.token_urlsafe(12)
    db().execute(
        "INSERT OR IGNORE INTO login_devices(teacher_id,token,ua,ip,last_seen,created_at) "
        "VALUES(?,?,?,?,?,?)",
        (uid(), token, (request.headers.get("User-Agent") or "")[:200],
         request.remote_addr or "", now(), now()))
    db().commit()
    rows = db().execute("SELECT * FROM login_devices WHERE teacher_id=? ORDER BY id DESC",
                        (uid(),)).fetchall()
    return resp_ok(items=[dict(r) for r in rows])


@BP.post("/devices/<int:did>/revoke")
@require("teacher")
def device_revoke(did):
    db().execute("DELETE FROM login_devices WHERE id=? AND teacher_id=?", (did, uid()))
    db().commit()
    return resp_ok()


# ---------------------------------------------------------------- 46 两步验证（TOTP）
def _totp(secret: str, ts=None) -> str:
    key = base64.b32decode(secret + "=" * ((8 - len(secret) % 8) % 8))
    counter = int((ts if ts is not None else time.time()) // 30)
    mac = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    off = mac[-1] & 0x0F
    code = (struct.unpack(">I", mac[off:off + 4])[0] & 0x7FFFFFFF) % 1000000
    return "%06d" % code


@BP.get("/2fa")
@require("teacher")
def twofa_status():
    row = db().execute("SELECT totp_secret FROM teachers WHERE id=?", (uid(),)).fetchone()
    return resp_ok(enabled=bool(row and row["totp_secret"]),
                   pending=get_setting(T, uid(), "2fa.pending", ""))


@BP.post("/2fa/setup")
@require("teacher")
def twofa_setup():
    secret = base64.b32encode(secrets.token_bytes(10)).decode().rstrip("=")
    set_setting(T, uid(), "2fa.pending", secret)
    label = "Classkey:" + (db().execute("SELECT email FROM teachers WHERE id=?", (uid(),)).fetchone()["email"])
    return resp_ok(secret=secret,
                   otpauth="otpauth://totp/%s?secret=%s&issuer=Classkey" % (label, secret))


@BP.post("/2fa/verify")
@require("teacher")
def twofa_verify():
    secret = get_setting(T, uid(), "2fa.pending", "")
    code = str(body().get("code") or "").strip()
    if not secret:
        return resp_err("请先生成密钥")
    if code not in (_totp(secret, time.time() - 30), _totp(secret), _totp(secret, time.time() + 30)):
        return resp_err("验证码不正确", 403)
    db().execute("UPDATE teachers SET totp_secret=? WHERE id=?", (secret, uid()))
    db().commit()
    set_setting(T, uid(), "2fa.pending", "")
    audit("2fa.enable", "开启两步验证")
    return resp_ok(enabled=True)


@BP.post("/2fa/disable")
@require("teacher")
def twofa_disable():
    db().execute("UPDATE teachers SET totp_secret='' WHERE id=?", (uid(),))
    db().commit()
    return resp_ok(enabled=False)


# ---------------------------------------------------------------- 50 自定义品牌
@BP.get("/brand")
def brand_get():
    return resp_ok(name=get_setting(APP, 0, "brand.name", "启课 Classkey"),
                   color=get_setting(APP, 0, "brand.color", "#4E95D9"),
                   logo=get_setting(APP, 0, "brand.logo", ""))


@BP.post("/brand")
@require("teacher")
def brand_set():
    d = body()
    if "name" in d:
        set_setting(APP, 0, "brand.name", str(d["name"])[:40])
    if "color" in d:
        c = str(d["color"])[:20]
        if not c.startswith("#") or len(c) not in (4, 7):
            return resp_err("主题色请用 #RRGGBB 格式")
        set_setting(APP, 0, "brand.color", c)
    if "logo" in d:
        set_setting(APP, 0, "brand.logo", str(d["logo"])[:200])
    return resp_ok()


# ---------------------------------------------------------------- 45 备份
def _make_backup() -> str:
    os.makedirs(BACKUP_DIR, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    path = os.path.join(BACKUP_DIR, "qike-%s.zip" % stamp)
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        dbpath = os.path.join(DATA_DIR, "qike.db")
        if os.path.isfile(dbpath):
            z.write(dbpath, "qike.db")
        for root, _dirs, files in os.walk(UPLOAD_DIR):
            for f in files:
                p = os.path.join(root, f)
                z.write(p, os.path.join("uploads", f))
    files = sorted(glob.glob(os.path.join(BACKUP_DIR, "qike-*.zip")), reverse=True)
    for p in files[7:]:
        try:
            os.remove(p)
        except OSError:
            pass
    return os.path.basename(path)


@BP.get("/backups")
@require("teacher")
def backup_list():
    os.makedirs(BACKUP_DIR, exist_ok=True)
    items = [{"name": os.path.basename(p), "size": os.path.getsize(p)}
             for p in sorted(glob.glob(os.path.join(BACKUP_DIR, "qike-*.zip")), reverse=True)]
    return resp_ok(items=items)


@BP.post("/backups/run")
@require("teacher")
def backup_run():
    name = _make_backup()
    audit("backup.run", name)
    return resp_ok(name=name)


@BP.get("/backups/download/<path:name>")
@require("teacher")
def backup_download(name):
    if os.path.basename(name) != name or not name.startswith("qike-") or not name.endswith(".zip"):
        return resp_err("文件名不合法", 400)
    path = os.path.join(BACKUP_DIR, name)
    if not os.path.isfile(path):
        return resp_err("备份不存在", 404)
    return send_file(path, as_attachment=True, download_name=name)


def tick():
    """每天自动备份一次，保留最近 7 份。"""
    os.makedirs(BACKUP_DIR, exist_ok=True)
    today = datetime.now().strftime("%Y%m%d")
    if glob.glob(os.path.join(BACKUP_DIR, "qike-%s-*.zip" % today)):
        return
    _make_backup()
