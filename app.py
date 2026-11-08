# -*- coding: utf-8 -*-
"""启课 · 师生作业与成绩平台 —— 轻量 Flask 后端（SQLite，无外部依赖）"""
from __future__ import annotations

import csv
import io
import json as jsonlib
import os
import re
import secrets
import sqlite3
import threading
import time
import urllib.request
import zipfile
from datetime import datetime, timedelta
from functools import wraps

from flask import (Flask, Response, abort, g, jsonify, render_template,
                   request, send_file, session)
from werkzeug.security import check_password_hash, generate_password_hash

BASE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE, "data")
UPLOAD_DIR = os.path.join(BASE, "uploads")
DB_PATH = os.path.join(DATA_DIR, "qike.db")
SECRET_PATH = os.path.join(DATA_DIR, "secret.key")
SCHEMA_PATH = os.path.join(BASE, "schema.sql")
ASSET_DIR = os.path.join(BASE, "assets")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

if not os.path.exists(SECRET_PATH):
    with open(SECRET_PATH, "wb") as fh:
        fh.write(secrets.token_bytes(32))
with open(SECRET_PATH, "rb") as fh:
    SECRET_KEY = fh.read()

app = Flask(__name__, static_folder="static", template_folder="templates")
app.secret_key = SECRET_KEY
app.json.ensure_ascii = False
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    # 部署到 HTTPS 后设置 QIKE_HTTPS=1，Cookie 才会标记为 Secure
    SESSION_COOKIE_SECURE=os.environ.get("QIKE_HTTPS") == "1",
    MAX_CONTENT_LENGTH=12 * 1024 * 1024,
)


@app.after_request
def security_headers(res):
    # 不限制 frame-ancestors，避免影响本地预览面板 / 校园网嵌入
    res.headers.setdefault("X-Content-Type-Options", "nosniff")
    res.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    res.headers.setdefault(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; font-src 'self' data:; connect-src 'self'; "
        "base-uri 'self'; form-action 'self'; object-src 'none'",
    )
    # 静态资源缓存 1 小时（配合 ETag 条件请求）；sw.js 必须每次校验才能更新
    if request.path.startswith(("/static/", "/assets/")):
        # Flask 静态文件默认会写 Cache-Control，必须显式覆盖
        res.headers["Cache-Control"] = "public, max-age=300, must-revalidate"
    if request.path == "/static/sw.js":
        res.headers["Service-Worker-Allowed"] = "/"
        res.headers["Cache-Control"] = "no-cache"
    if request.path.startswith("/api/") or request.path == "/":
        res.headers.setdefault("Cache-Control", "no-store")
    return res


@app.after_request
def audit_write(res):
    """统一操作审计：所有成功的 API 写操作留痕（登录等匿名操作也记录）。"""
    if (request.method in ("POST", "PUT", "PATCH", "DELETE")
            and request.path.startswith("/api/") and res.status_code < 400):
        try:
            u = me() or {}
            db().execute(
                "INSERT INTO audit_logs(actor_role,actor_id,action,detail,ip,created_at) "
                "VALUES(?,?,?,?,?,?)",
                (u.get("role", ""), u.get("id", 0),
                 request.method + " " + request.path, "", request.remote_addr or "", now()),
            )
            db().commit()
        except Exception:
            pass
    return res


ALLOWED_EXT = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".txt", ".md", ".csv", ".zip", ".rar", ".7z", ".py", ".js",
    ".html", ".css", ".json",
}
MAX_FILE = 10 * 1024 * 1024
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# 登录限流：同一身份 + 邮箱连续失败 5 次锁定 10 分钟
_ATTEMPTS: dict[tuple[str, str], tuple[int, float]] = {}
_ATTEMPT_LOCK = threading.Lock()


def init_db() -> None:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys=ON")
    for path in (SCHEMA_PATH, os.path.join(BASE, "schema_extra.sql")):
        if os.path.isfile(path):
            with open(path, encoding="utf-8") as fh:
                con.executescript(fh.read())
    # 旧库平滑升级：补齐后续版本新增的列，已有数据不受影响
    migrations = [
        ("teachers", "mail_webhook", "TEXT NOT NULL DEFAULT ''"),
        ("teachers", "totp_secret", "TEXT NOT NULL DEFAULT ''"),
        ("teachers", "remind_before", "INTEGER NOT NULL DEFAULT 24"),
        ("homeworks", "target_mode", "TEXT NOT NULL DEFAULT 'all'"),
        ("homeworks", "allow_late", "INTEGER NOT NULL DEFAULT 0"),
        ("homeworks", "class_id", "INTEGER NOT NULL DEFAULT 0"),
        ("homeworks", "scheduled_at", "TEXT NOT NULL DEFAULT ''"),
        ("homeworks", "allow_resubmit", "INTEGER NOT NULL DEFAULT 0"),
        ("students", "class_id", "INTEGER NOT NULL DEFAULT 0"),
        ("students", "parent_contact", "TEXT NOT NULL DEFAULT ''"),
        ("students", "note", "TEXT NOT NULL DEFAULT ''"),
        ("students", "enrolled_at", "TEXT NOT NULL DEFAULT ''"),
        ("scores", "revoked", "INTEGER NOT NULL DEFAULT 0"),
    ]
    for table, column, decl in migrations:
        cols = {r["name"] for r in con.execute("PRAGMA table_info(%s)" % table)}
        if column not in cols:
            con.execute("ALTER TABLE %s ADD COLUMN %s %s" % (table, column, decl))
    # 安全升级：旧库里存过的明文查看密码一次性转成哈希并清空明文
    for r in con.execute(
        "SELECT id,view_password,view_hash FROM scores WHERE view_password<>''"
    ).fetchall():
        digest = r["view_hash"] or generate_password_hash(r["view_password"])
        con.execute("UPDATE scores SET view_hash=?,view_password='' WHERE id=?",
                    (digest, r["id"]))
    con.commit()
    con.close()


init_db()


def db() -> sqlite3.Connection:
    if "db" not in g:
        con = sqlite3.connect(DB_PATH, timeout=10)
        con.row_factory = sqlite3.Row
        con.execute("PRAGMA foreign_keys=ON")
        g.db = con
    return g.db


@app.teardown_appcontext
def close_db(_exc=None):
    con = g.pop("db", None)
    if con is not None:
        con.close()


def now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def gen_code(n: int = 8) -> str:
    # 去掉 0/O/1/I 等易混字符，方便老师抄写发给学生
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(n))


def body() -> dict:
    return request.get_json(silent=True) or {}


def resp_ok(**payload):
    return jsonify(ok=True, **payload)


def resp_err(message: str, status: int = 400):
    return jsonify(error=message), status


def csrf_token() -> str:
    if not session.get("csrf"):
        session["csrf"] = secrets.token_urlsafe(24)
    return session["csrf"]


@app.before_request
def csrf_guard():
    if (request.method in ("POST", "PUT", "PATCH", "DELETE")
            and request.path.startswith("/api/")):
        expected = session.get("csrf")
        given = request.headers.get("X-CSRF-Token", "")
        if not expected or not given or not secrets.compare_digest(str(expected), str(given)):
            return resp_err("安全校验失败，请刷新页面后重试", 403)


def rate_blocked(key) -> bool:
    with _ATTEMPT_LOCK:
        rec = _ATTEMPTS.get(key)
        return bool(rec and rec[1] > time.time())


def rate_fail(key) -> None:
    with _ATTEMPT_LOCK:
        fails, _until = _ATTEMPTS.get(key, (0, 0.0))
        fails += 1
        _ATTEMPTS[key] = (0, time.time() + 600) if fails >= 5 else (fails, 0.0)


def rate_ok(key) -> None:
    with _ATTEMPT_LOCK:
        _ATTEMPTS.pop(key, None)


def me():
    if not session.get("uid") or not session.get("role"):
        return None
    return {
        "role": session["role"],
        "id": session["uid"],
        "email": session.get("email", ""),
        "name": session.get("name", ""),
    }


def require(role: str):
    def deco(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            user = me()
            if not user:
                return resp_err("请先登录", 401)
            if user["role"] != role:
                return resp_err("当前身份无权访问", 403)
            return fn(*args, **kwargs)
        return wrapped
    return deco


def set_session(role: str, row: sqlite3.Row) -> None:
    old_csrf = session.get("csrf")
    session.clear()                       # 防会话固定
    session.update(role=role, uid=row["id"], email=row["email"],
                   name=row["name"], unlocked=[])
    if old_csrf:
        session["csrf"] = old_csrf


def push_notification(teacher_id: int, kind: str, title: str, text: str,
                      important: bool = False) -> None:
    con = db()
    con.execute(
        "INSERT INTO notifications(teacher_id,kind,title,body,created_at) VALUES(?,?,?,?,?)",
        (teacher_id, kind, title, text, now()),
    )
    con.commit()
    row = con.execute(
        "SELECT phone,notify_enabled,sms_webhook FROM teachers WHERE id=?",
        (teacher_id,),
    ).fetchone()
    # 真实短信需要外部短信服务商；这里留出可配置的 webhook，填了才发。
    if row and important and row["notify_enabled"] and row["sms_webhook"] and row["phone"]:
        payload = jsonlib.dumps(
            {"phone": row["phone"], "title": title, "body": text}
        ).encode("utf-8")
        try:
            req = urllib.request.Request(
                row["sms_webhook"], data=payload,
                headers={"Content-Type": "application/json"}, method="POST",
            )
            urllib.request.urlopen(req, timeout=3).close()
        except Exception:
            pass


def teacher_of_student(student_id: int):
    row = db().execute("SELECT teacher_id FROM students WHERE id=?", (student_id,)).fetchone()
    return row["teacher_id"] if row else None


def push_student_notification(student_id: int, kind: str, title: str, text: str) -> None:
    db().execute(
        "INSERT INTO student_notifications(student_id,kind,title,body,created_at) "
        "VALUES(?,?,?,?,?)", (student_id, kind, title, text, now()),
    )
    db().commit()


def target_ids(hid: int) -> list[int]:
    return [r["student_id"] for r in db().execute(
        "SELECT student_id FROM homework_targets WHERE homework_id=?", (hid,)
    ).fetchall()]


def homework_for_student(hid: int, student_id: int):
    """学生是否属于该作业的目标范围；返回作业行或 None。"""
    return db().execute(
        "SELECT h.* FROM homeworks h WHERE h.id=? AND "
        "(h.scheduled_at='' OR h.scheduled_at<=?) AND "
        "(h.target_mode='all' OR EXISTS(SELECT 1 FROM homework_targets t "
        " WHERE t.homework_id=h.id AND t.student_id=?))",
        (hid, now(), student_id),
    ).fetchone()


def parse_due(value: str):
    text = (value or "").strip().replace("T", " ")
    if not text:
        return None
    for fmt, width in (("%Y-%m-%d %H:%M", 16), ("%Y-%m-%d", 10)):
        try:
            return datetime.strptime(text[:width], fmt)
        except ValueError:
            continue
    return None


def is_overdue(hw) -> bool:
    due = parse_due(hw["due_at"])
    return due is not None and due < datetime.now()


# ---------------------------------------------------------------- 页面 / 资产

@app.get("/")
def index():
    return render_template("index.html")


@app.get("/assets/<path:name>")
def assets(name):
    path = os.path.abspath(os.path.join(ASSET_DIR, name))
    if not path.startswith(os.path.abspath(ASSET_DIR)) or not os.path.isfile(path):
        abort(404)
    return send_file(path)


@app.get("/api/bootstrap")
def bootstrap():
    user = me()
    profile = None
    if user and user["role"] == "teacher":
        row = db().execute(
            "SELECT id,email,name,school,grade,class_name,phone,notify_enabled,"
            "sms_webhook,mail_webhook,created_at FROM teachers WHERE id=?", (user["id"],)
        ).fetchone()
        profile = dict(row) if row else None
    elif user and user["role"] == "student":
        row = db().execute(
            "SELECT s.id,s.email,s.name,s.student_no,s.teacher_id,"
            "t.school,t.grade,t.class_name,t.name AS teacher_name "
            "FROM students s JOIN teachers t ON t.id=s.teacher_id WHERE s.id=?",
            (user["id"],),
        ).fetchone()
        profile = dict(row) if row else None
    return resp_ok(
        csrf=csrf_token(), user=user, profile=profile,
        app={"name": "启课", "tagline": "师生作业与成绩平台"},
    )


# ---------------------------------------------------------------- 认证

@app.post("/api/auth/register")
def register():
    d = body()
    email = (d.get("email") or "").strip().lower()
    pwd = d.get("password") or ""
    name = (d.get("name") or "").strip()
    phone = (d.get("phone") or "").strip()
    if not EMAIL_RE.fullmatch(email):
        return resp_err("请输入正确的邮箱地址")
    if len(pwd) < 8:
        return resp_err("密码至少 8 位")
    if not name:
        return resp_err("请填写姓名")
    if phone and not re.fullmatch(r"1\d{10}", phone):
        return resp_err("请输入正确的 11 位手机号")
    con = db()
    try:
        cur = con.execute(
            "INSERT INTO teachers(email,password_hash,name,school,grade,class_name,"
            "phone,created_at) VALUES(?,?,?,?,?,?,?,?)",
            (email, generate_password_hash(pwd), name,
             (d.get("school") or "").strip(), (d.get("grade") or "").strip(),
             (d.get("class_name") or "").strip(), phone, now()),
        )
        con.commit()
    except sqlite3.IntegrityError:
        return resp_err("该邮箱已注册，请直接登录", 409)
    row = con.execute("SELECT * FROM teachers WHERE id=?", (cur.lastrowid,)).fetchone()
    set_session("teacher", row)
    return resp_ok(csrf=csrf_token(), user=me())


@app.post("/api/auth/login")
def login():
    d = body()
    role = d.get("role")
    email = (d.get("email") or "").strip().lower()
    pwd = d.get("password") or ""
    if role not in ("teacher", "student"):
        return resp_err("请选择登录身份")
    if not email or not pwd:
        return resp_err("请填写邮箱和密码")
    key = (role, email)
    if rate_blocked(key):
        return resp_err("尝试次数过多，请 10 分钟后再试", 429)
    con = db()
    table = "teachers" if role == "teacher" else "students"
    row = con.execute(f"SELECT * FROM {table} WHERE email=?", (email,)).fetchone()
    if not row or not check_password_hash(row["password_hash"], pwd):
        rate_fail(key)
        return resp_err("邮箱或密码不正确", 401)
    rate_ok(key)
    # 可选两步验证：老师绑定 TOTP 后，登录必须带上验证器里的 6 位码
    if role == "teacher" and row["totp_secret"]:
        try:
            from features.mod_ops import _totp as _totp_check
        except Exception:
            _totp_check = None
        if _totp_check:
            code = (d.get("totp") or "").strip()
            valid = (_totp_check(row["totp_secret"], time.time() - 30),
                     _totp_check(row["totp_secret"]),
                     _totp_check(row["totp_secret"], time.time() + 30))
            if not code or code not in valid:
                return resp_err("请输入验证器 App 中的 6 位两步验证码", 403)
    con.execute(f"UPDATE {table} SET last_login_at=? WHERE id=?", (now(), row["id"]))
    con.commit()
    set_session(role, row)
    return resp_ok(csrf=csrf_token(), user=me())


@app.post("/api/auth/logout")
def logout():
    session.clear()
    return resp_ok()


@app.post("/api/auth/password")
def change_password():
    user = me()
    if not user:
        return resp_err("请先登录", 401)
    d = body()
    old = d.get("old_password") or ""
    new = d.get("new_password") or ""
    if len(new) < 8:
        return resp_err("新密码至少 8 位")
    con = db()
    table = "teachers" if user["role"] == "teacher" else "students"
    row = con.execute(f"SELECT password_hash FROM {table} WHERE id=?", (user["id"],)).fetchone()
    if not row or not check_password_hash(row["password_hash"], old):
        return resp_err("原密码不正确", 403)
    if user["role"] == "student":
        con.execute("UPDATE students SET password_hash=?,initial_password='' WHERE id=?",
                    (generate_password_hash(new), user["id"]))
    else:
        con.execute("UPDATE teachers SET password_hash=? WHERE id=?",
                    (generate_password_hash(new), user["id"]))
    con.commit()
    return resp_ok()


@app.post("/api/auth/forgot")
def forgot_password():
    """老师忘记密码：向设置的邮件网关投递一次性重置码（15 分钟有效）。"""
    email = (body().get("email") or "").strip().lower()
    if not EMAIL_RE.fullmatch(email):
        return resp_err("请输入正确的邮箱地址")
    con = db()
    row = con.execute("SELECT id,email,mail_webhook FROM teachers WHERE email=?", (email,)).fetchone()
    if not row:
        return resp_err("该邮箱尚未注册老师账号", 404)
    webhook = (row["mail_webhook"] or "").strip()
    if not webhook:
        return resp_err("尚未配置邮件网关，无法自助找回。请联系管理员在服务器运行 "
                        "python reset_teacher.py 重置。", 400)
    code = "%06d" % secrets.randbelow(1000000)
    expires = (datetime.now() + timedelta(minutes=15)).strftime("%Y-%m-%d %H:%M:%S")
    con.execute("UPDATE password_resets SET used=1 WHERE teacher_id=? AND used=0", (row["id"],))
    con.execute(
        "INSERT INTO password_resets(teacher_id,code_hash,expires_at,used,created_at) "
        "VALUES(?,?,?,0,?)", (row["id"], generate_password_hash(code), expires, now()),
    )
    payload = jsonlib.dumps({
        "channel": "email", "to": email, "code": code,
        "title": "启课 · 密码重置", "body": "你的密码重置码是 %s，15 分钟内有效。" % code,
    }).encode("utf-8")
    try:
        req = urllib.request.Request(
            webhook, data=payload,
            headers={"Content-Type": "application/json"}, method="POST",
        )
        urllib.request.urlopen(req, timeout=4).close()
    except Exception:
        con.rollback()
        return resp_err("邮件网关不可用，重置码未发送，请稍后重试", 502)
    con.commit()
    return resp_ok(sent=True, email=email)


@app.post("/api/auth/reset")
def reset_password():
    d = body()
    email = (d.get("email") or "").strip().lower()
    code = (d.get("code") or "").strip()
    new = d.get("new_password") or ""
    key = ("reset", email)
    if rate_blocked(key):
        return resp_err("尝试次数过多，请 10 分钟后再试", 429)
    if len(new) < 8:
        return resp_err("新密码至少 8 位")
    con = db()
    row = con.execute("SELECT id FROM teachers WHERE email=?", (email,)).fetchone()
    rec = con.execute(
        "SELECT * FROM password_resets WHERE teacher_id=? AND used=0 "
        "ORDER BY id DESC LIMIT 1", (row["id"],)
    ).fetchone() if row else None
    if (not rec or rec["expires_at"] < datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            or not check_password_hash(rec["code_hash"], code)):
        rate_fail(key)
        return resp_err("重置码不正确或已过期", 403)
    rate_ok(key)
    con.execute("UPDATE teachers SET password_hash=? WHERE id=?",
                (generate_password_hash(new), row["id"]))
    con.execute("UPDATE password_resets SET used=1 WHERE id=?", (rec["id"],))
    con.commit()
    return resp_ok()


# ---------------------------------------------------------------- 老师 · 资料

@app.put("/api/teacher/profile")
@require("teacher")
def update_profile():
    d = body()
    name = (d.get("name") or "").strip()
    phone = (d.get("phone") or "").strip()
    if not name:
        return resp_err("请填写姓名")
    if phone and not re.fullmatch(r"1\d{10}", phone):
        return resp_err("请输入正确的 11 位手机号")
    con = db()
    current = con.execute("SELECT mail_webhook FROM teachers WHERE id=?",
                          (session["uid"],)).fetchone()
    # 旧版前端不传该字段时保留原值，避免误清空
    mail_hook = ((d.get("mail_webhook") or "").strip() if "mail_webhook" in d
                 else (current["mail_webhook"] if current else ""))
    con.execute(
        "UPDATE teachers SET name=?,school=?,grade=?,class_name=?,phone=?,"
        "notify_enabled=?,sms_webhook=?,mail_webhook=? WHERE id=?",
        (name, (d.get("school") or "").strip(), (d.get("grade") or "").strip(),
         (d.get("class_name") or "").strip(), phone,
         1 if d.get("notify_enabled", True) else 0,
         (d.get("sms_webhook") or "").strip(), mail_hook, session["uid"]),
    )
    con.commit()
    return resp_ok()


@app.get("/api/teacher/overview")
@require("teacher")
def teacher_overview():
    con = db()
    tid = session["uid"]
    students = con.execute("SELECT COUNT(*) c FROM students WHERE teacher_id=?", (tid,)).fetchone()["c"]
    homeworks = con.execute("SELECT COUNT(*) c FROM homeworks WHERE teacher_id=?", (tid,)).fetchone()["c"]
    pending = con.execute(
        "SELECT COUNT(*) c FROM submissions s JOIN homeworks h ON h.id=s.homework_id "
        "WHERE h.teacher_id=? AND (s.comment IS NULL OR s.comment='')", (tid,)
    ).fetchone()["c"]
    scores = con.execute("SELECT COUNT(*) c FROM scores WHERE teacher_id=?", (tid,)).fetchone()["c"]
    unread = con.execute(
        "SELECT COUNT(*) c FROM notifications WHERE teacher_id=? AND is_read=0", (tid,)
    ).fetchone()["c"]
    return resp_ok(students=students, homeworks=homeworks, pending=pending,
                   scores=scores, unread=unread)


# ---------------------------------------------------------------- 老师 · 学生

@app.get("/api/teacher/students")
@require("teacher")
def list_students():
    rows = db().execute(
        "SELECT id,email,name,student_no,initial_password,created_at,last_login_at "
        "FROM students WHERE teacher_id=? ORDER BY id", (session["uid"],)
    ).fetchall()
    return resp_ok(students=[dict(r) for r in rows])


def create_one_student(email: str, name: str, student_no: str):
    pwd = gen_code(8)
    cur = db().execute(
        "INSERT INTO students(teacher_id,email,name,student_no,password_hash,"
        "initial_password,created_at) VALUES(?,?,?,?,?,?,?)",
        (session["uid"], email, name, student_no,
         generate_password_hash(pwd), pwd, now()),
    )
    return {"id": cur.lastrowid, "email": email, "name": name,
            "student_no": student_no, "initial_password": pwd}


@app.post("/api/teacher/students")
@require("teacher")
def add_student():
    d = body()
    email = (d.get("email") or "").strip().lower()
    name = (d.get("name") or "").strip()
    student_no = (d.get("student_no") or "").strip()
    if not EMAIL_RE.fullmatch(email):
        return resp_err("请输入正确的学生邮箱")
    if not name:
        return resp_err("请填写学生姓名")
    try:
        student = create_one_student(email, name, student_no)
        db().commit()
    except sqlite3.IntegrityError:
        return resp_err("该邮箱已存在（可能属于其他班级）", 409)
    return resp_ok(student=student)


@app.post("/api/teacher/students/batch")
@require("teacher")
def add_students_batch():
    """每行：姓名,邮箱,学号（学号可省略）"""
    text = body().get("text") or ""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if not lines:
        return resp_err("请粘贴学生名单")
    if len(lines) > 200:
        return resp_err("单次最多 200 人")
    created, skipped = [], []
    con = db()
    for line in lines:
        parts = [p.strip() for p in re.split(r"[,，\t;；]", line) if p.strip()]
        if len(parts) < 2 or not EMAIL_RE.fullmatch(parts[1].lower()):
            skipped.append(line)
            continue
        try:
            con.execute("SAVEPOINT batch_one")
            created.append(create_one_student(parts[1].lower(), parts[0],
                                              parts[2] if len(parts) > 2 else ""))
            con.execute("RELEASE batch_one")
        except sqlite3.IntegrityError:
            con.execute("ROLLBACK TO batch_one")
            con.execute("RELEASE batch_one")
            skipped.append(line)
    con.commit()
    return resp_ok(created=created, skipped=skipped)


@app.post("/api/teacher/students/<int:sid>/reset")
@require("teacher")
def reset_student_password(sid):
    row = db().execute("SELECT * FROM students WHERE id=? AND teacher_id=?",
                       (sid, session["uid"])).fetchone()
    if not row:
        return resp_err("学生不存在", 404)
    pwd = gen_code(8)
    db().execute("UPDATE students SET password_hash=?,initial_password=? WHERE id=?",
                 (generate_password_hash(pwd), pwd, sid))
    db().commit()
    return resp_ok(password=pwd)


@app.delete("/api/teacher/students/<int:sid>")
@require("teacher")
def delete_student(sid):
    cur = db().execute("DELETE FROM students WHERE id=? AND teacher_id=?",
                       (sid, session["uid"]))
    db().commit()
    if cur.rowcount == 0:
        return resp_err("学生不存在", 404)
    return resp_ok()


@app.get("/api/teacher/students/export")
@require("teacher")
def export_students():
    rows = db().execute(
        "SELECT name,email,student_no,initial_password,created_at FROM students "
        "WHERE teacher_id=? ORDER BY id", (session["uid"],)
    ).fetchall()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["姓名", "邮箱", "学号", "登录密码", "添加时间"])
    for r in rows:
        writer.writerow([r["name"], r["email"], r["student_no"],
                         r["initial_password"] or "（学生已自行修改）", r["created_at"]])
    data = "\ufeff" + buf.getvalue()
    return Response(
        data, mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=students.csv"},
    )


# ---------------------------------------------------------------- 老师 · 作业

@app.get("/api/teacher/homeworks")
@require("teacher")
def teacher_homeworks():
    con = db()
    rows = con.execute(
        "SELECT h.*, "
        "(SELECT COUNT(*) FROM students WHERE teacher_id=h.teacher_id) AS class_size, "
        "CASE WHEN h.target_mode='selected' "
        "  THEN (SELECT COUNT(*) FROM homework_targets t WHERE t.homework_id=h.id) "
        "  ELSE (SELECT COUNT(*) FROM students WHERE teacher_id=h.teacher_id) END "
        "  AS total_students, "
        "(SELECT COUNT(*) FROM submissions sub WHERE sub.homework_id=h.id AND "
        "   (h.target_mode='all' OR EXISTS(SELECT 1 FROM homework_targets t "
        "    WHERE t.homework_id=h.id AND t.student_id=sub.student_id))) AS submitted_count, "
        "(SELECT COUNT(*) FROM submissions sub WHERE sub.homework_id=h.id "
        "   AND sub.comment<>'' AND (h.target_mode='all' OR EXISTS(SELECT 1 FROM "
        "    homework_targets t WHERE t.homework_id=h.id AND t.student_id=sub.student_id))) "
        "  AS reviewed_count "
        "FROM homeworks h WHERE h.teacher_id=? ORDER BY h.id DESC", (session["uid"],)
    ).fetchall()
    targets = {}
    for r in con.execute(
        "SELECT t.homework_id,s.name FROM homework_targets t "
        "JOIN students s ON s.id=t.student_id "
        "JOIN homeworks h ON h.id=t.homework_id WHERE h.teacher_id=? "
        "ORDER BY t.homework_id,s.id", (session["uid"],)
    ).fetchall():
        targets.setdefault(r["homework_id"], []).append(r["name"])
    items = []
    for r in rows:
        item = dict(r)
        item["overdue"] = 1 if is_overdue(item) else 0
        item["target_names"] = targets.get(r["id"], [])
        items.append(item)
    return resp_ok(homeworks=items)


@app.post("/api/teacher/homeworks")
@require("teacher")
def create_homework():
    d = body()
    title = (d.get("title") or "").strip()
    mode = d.get("mode") or "online"
    if not title:
        return resp_err("请填写作业标题")
    if mode not in ("online", "upload", "notice"):
        return resp_err("提交方式不正确")
    target_mode = d.get("target_mode") or "all"
    if target_mode not in ("all", "selected"):
        return resp_err("派发范围不正确")
    con = db()
    recipients = []
    if target_mode == "selected":
        try:
            recipients = sorted({int(x) for x in (d.get("student_ids") or [])})
        except (TypeError, ValueError):
            return resp_err("学生名单格式不正确")
        if not recipients:
            return resp_err("请至少选择一位学生")
        marks = ",".join("?" for _ in recipients)
        valid = con.execute(
            "SELECT COUNT(*) c FROM students WHERE teacher_id=? AND id IN (%s)" % marks,
            [session["uid"]] + recipients,
        ).fetchone()["c"]
        if valid != len(recipients):
            return resp_err("所选学生不属于本班", 403)
    else:
        recipients = [r["id"] for r in con.execute(
            "SELECT id FROM students WHERE teacher_id=?", (session["uid"],)
        ).fetchall()]
    cur = con.execute(
        "INSERT INTO homeworks(teacher_id,title,subject,description,due_at,mode,"
        "target_mode,allow_late,attachment_id,attachment_name,created_at) "
        "VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        (session["uid"], title, (d.get("subject") or "").strip(),
         (d.get("description") or "").strip(), (d.get("due_at") or "").strip(),
         mode, target_mode, 1 if d.get("allow_late") else 0,
         (d.get("attachment_id") or "").strip(),
         (d.get("attachment_name") or "").strip(), now()),
    )
    hid = cur.lastrowid
    if target_mode == "selected":
        con.executemany(
            "INSERT INTO homework_targets(homework_id,student_id) VALUES(?,?)",
            [(hid, sid) for sid in recipients],
        )
    con.commit()
    scope = "全班 %d 人" % len(recipients) if target_mode == "all" else "指定的 %d 位学生" % len(recipients)
    push_notification(session["uid"], "homework", "作业已发布",
                      f"《{title}》已发布给{scope}", important=False)
    for sid in recipients:
        push_student_notification(
            sid, "homework", "新作业：" + title,
            "老师发布了《%s》，%s" % (title, "请查看要求并按时完成。" if mode != "notice" else "这份作业只需查看。"),
        )
    return resp_ok(id=hid, recipients=len(recipients))


@app.delete("/api/teacher/homeworks/<int:hid>")
@require("teacher")
def delete_homework(hid):
    cur = db().execute("DELETE FROM homeworks WHERE id=? AND teacher_id=?",
                       (hid, session["uid"]))
    db().commit()
    if cur.rowcount == 0:
        return resp_err("作业不存在", 404)
    return resp_ok()


@app.get("/api/teacher/homeworks/<int:hid>/submissions")
@require("teacher")
def homework_submissions(hid):
    hw = db().execute("SELECT * FROM homeworks WHERE id=? AND teacher_id=?",
                      (hid, session["uid"])).fetchone()
    if not hw:
        return resp_err("作业不存在", 404)
    rows = db().execute(
        "SELECT s.id AS student_id,s.name,s.email,s.student_no,"
        "sub.id AS submission_id,sub.content,sub.file_id,sub.file_name,sub.status,"
        "sub.score,sub.comment,sub.submitted_at "
        "FROM students s LEFT JOIN submissions sub "
        "ON sub.student_id=s.id AND sub.homework_id=? "
        "WHERE s.teacher_id=? ORDER BY s.id", (hid, session["uid"])
    ).fetchall()
    if hw["target_mode"] == "selected":
        ids = set(target_ids(hid))
        rows = [r for r in rows if r["student_id"] in ids]
    detail = dict(hw)
    detail["overdue"] = 1 if is_overdue(detail) else 0
    return resp_ok(homework=detail, items=[dict(r) for r in rows])


@app.post("/api/teacher/submissions/<int:subid>/review")
@require("teacher")
def review_submission(subid):
    row = db().execute(
        "SELECT sub.id,sub.student_id,h.teacher_id,h.title FROM submissions sub "
        "JOIN homeworks h ON h.id=sub.homework_id WHERE sub.id=?", (subid,)
    ).fetchone()
    if not row or row["teacher_id"] != session["uid"]:
        return resp_err("无权批改该提交", 403)
    d = body()
    score = (d.get("score") or "").strip()
    comment = (d.get("comment") or "").strip()
    db().execute(
        "UPDATE submissions SET score=?,comment=?,status='reviewed',updated_at=? WHERE id=?",
        (score, comment, now(), subid),
    )
    db().commit()
    push_student_notification(
        row["student_id"], "review", "作业已批改：《%s》" % row["title"],
        ("得分 %s。" % score if score else "") + (comment or "老师已查看你的作业。"),
    )
    return resp_ok()


# ---------------------------------------------------------------- 老师 · 成绩

@app.get("/api/teacher/scores")
@require("teacher")
def teacher_scores():
    rows = db().execute(
        "SELECT sc.*,s.name AS student_name,s.email AS student_email,s.student_no "
        "FROM scores sc JOIN students s ON s.id=sc.student_id "
        "WHERE sc.teacher_id=? ORDER BY sc.id DESC", (session["uid"],)
    ).fetchall()
    items = []
    for r in rows:
        item = dict(r)
        # 安全：查看密码只存哈希，列表接口永远不回传任何可复制的密码
        item.pop("view_password", None)
        item.pop("view_hash", None)
        items.append(item)
    return resp_ok(scores=items)


@app.post("/api/teacher/scores")
@require("teacher")
def create_score():
    d = body()
    stu = db().execute("SELECT * FROM students WHERE id=? AND teacher_id=?",
                       (d.get("student_id"), session["uid"])).fetchone()
    if not stu:
        return resp_err("请选择本班学生")
    exam = (d.get("exam_name") or "").strip()
    if not exam:
        return resp_err("请填写考试 / 测验名称")
    try:
        score = float(d.get("score"))
        full = float(d.get("full_score") or 100)
    except (TypeError, ValueError):
        return resp_err("请填写有效分数")
    if full <= 0 or score < 0 or score > full:
        return resp_err("分数需在 0 ~ 满分之间")
    mode = d.get("mode") or "direct"
    if mode not in ("direct", "locked"):
        return resp_err("发布方式不正确")
    code, plain, digest = "", "", ""
    if mode == "locked":
        code = (d.get("view_code") or ("QK-" + gen_code(6))).strip().upper()
        plain = (d.get("view_password") or gen_code(6)).strip()
        if len(code) < 4 or len(plain) < 4:
            return resp_err("成绩代号与查看密码至少 4 位")
        if db().execute("SELECT 1 FROM scores WHERE view_code=?", (code,)).fetchone():
            return resp_err("该成绩代号已存在，请换一个")
        digest = generate_password_hash(plain)
    cur = db().execute(
        "INSERT INTO scores(teacher_id,student_id,exam_name,subject,score,full_score,"
        "remark,mode,view_code,view_password,view_hash,created_at) "
        "VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        (session["uid"], stu["id"], exam, (d.get("subject") or "").strip(),
         score, full, (d.get("remark") or "").strip(), mode, code, "", digest, now()),
    )
    db().commit()
    push_notification(session["uid"], "score", "成绩已发布",
                      f"{stu['name']} · {exam}", important=True)
    if mode == "locked":
        push_student_notification(
            stu["id"], "score", "新成绩待解锁：" + exam,
            "老师发来一条密码保护的成绩，请向老师索取成绩代号与查看密码，在「我的成绩」中打开。",
        )
    else:
        push_student_notification(
            stu["id"], "score", "新成绩：" + exam,
            "%s · %g / %g 分已发布，登录即可查看。" % (exam, score, full),
        )
    return resp_ok(id=cur.lastrowid, mode=mode, view_code=code, view_password=plain)


@app.post("/api/teacher/scores/<int:scid>/regen")
@require("teacher")
def regen_score_password(scid):
    """密码只存哈希，老师无法取回旧密码；需要重新发放时生成一组新代号 + 密码。"""
    row = db().execute(
        "SELECT * FROM scores WHERE id=? AND teacher_id=? AND mode='locked'",
        (scid, session["uid"]),
    ).fetchone()
    if not row:
        return resp_err("成绩记录不存在或不是密码保护成绩", 404)
    code = "QK-" + gen_code(6)
    while db().execute("SELECT 1 FROM scores WHERE view_code=? AND id<>?", (code, scid)).fetchone():
        code = "QK-" + gen_code(6)
    plain = gen_code(6)
    db().execute("UPDATE scores SET view_code=?,view_hash=?,view_password='' WHERE id=?",
                 (code, generate_password_hash(plain), scid))
    db().commit()
    push_student_notification(
        row["student_id"], "score", "成绩查看密码已更新：" + row["exam_name"],
        "老师重新生成了成绩代号与查看密码，请向老师索取新的一组。",
    )
    return resp_ok(view_code=code, view_password=plain)


@app.delete("/api/teacher/scores/<int:scid>")
@require("teacher")
def delete_score(scid):
    cur = db().execute("DELETE FROM scores WHERE id=? AND teacher_id=?",
                       (scid, session["uid"]))
    db().commit()
    if cur.rowcount == 0:
        return resp_err("成绩记录不存在", 404)
    return resp_ok()


@app.get("/api/teacher/analytics")
@require("teacher")
def teacher_analytics():
    """按考试 / 学生聚合，统一换算成百分制得分率，满分不同的考试也能一起比较。"""
    rows = db().execute(
        "SELECT sc.*,s.name AS student_name,s.email AS student_email "
        "FROM scores sc JOIN students s ON s.id=sc.student_id "
        "WHERE sc.teacher_id=? ORDER BY sc.id", (session["uid"],)
    ).fetchall()
    buckets = [{"label": "0-59", "count": 0}, {"label": "60-69", "count": 0},
               {"label": "70-79", "count": 0}, {"label": "80-89", "count": 0},
               {"label": "90-100", "count": 0}]
    exams, students = {}, {}
    all_pct = []
    for r in rows:
        pct = (r["score"] / r["full_score"] * 100) if r["full_score"] else 0
        all_pct.append(pct)
        exams.setdefault((r["exam_name"], r["subject"]), []).append(pct)
        stu = students.setdefault(r["student_id"],
                                  {"name": r["student_name"], "email": r["student_email"], "vals": []})
        stu["vals"].append(pct)
        idx = 0 if pct < 60 else 1 if pct < 70 else 2 if pct < 80 else 3 if pct < 90 else 4
        buckets[idx]["count"] += 1
    exam_list = []
    for (name, subject), vals in exams.items():
        exam_list.append({
            "exam_name": name, "subject": subject, "count": len(vals),
            "avg": round(sum(vals) / len(vals), 1), "max": round(max(vals), 1),
            "min": round(min(vals), 1),
            "pass_rate": round(100 * sum(v >= 60 for v in vals) / len(vals), 1),
            "excellent_rate": round(100 * sum(v >= 90 for v in vals) / len(vals), 1),
        })
    exam_list.sort(key=lambda x: (-x["count"], x["exam_name"]))
    ranking = [{
        "name": v["name"], "email": v["email"], "count": len(v["vals"]),
        "avg": round(sum(v["vals"]) / len(v["vals"]), 1),
    } for v in students.values()]
    ranking.sort(key=lambda x: -x["avg"])
    total = len(all_pct)
    return resp_ok(
        total=total,
        student_count=db().execute("SELECT COUNT(*) c FROM students WHERE teacher_id=?",
                                   (session["uid"],)).fetchone()["c"],
        avg=round(sum(all_pct) / total, 1) if total else 0,
        pass_rate=round(100 * sum(v >= 60 for v in all_pct) / total, 1) if total else 0,
        excellent_rate=round(100 * sum(v >= 90 for v in all_pct) / total, 1) if total else 0,
        distribution=buckets, exams=exam_list, ranking=ranking,
    )


@app.get("/api/teacher/scores/export")
@require("teacher")
def export_scores():
    rows = db().execute(
        "SELECT sc.*,s.name AS student_name,s.email AS student_email,s.student_no "
        "FROM scores sc JOIN students s ON s.id=sc.student_id "
        "WHERE sc.teacher_id=? ORDER BY sc.id DESC", (session["uid"],)
    ).fetchall()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["姓名", "学号", "邮箱", "考试/测验", "科目", "分数", "满分",
                "得分率(%)", "发布方式", "成绩代号", "查看密码", "备注", "发布时间"])
    for r in rows:
        rate = round(r["score"] / r["full_score"] * 100, 1) if r["full_score"] else ""
        w.writerow([r["student_name"], r["student_no"], r["student_email"],
                    r["exam_name"], r["subject"], r["score"], r["full_score"], rate,
                    "直接发送" if r["mode"] == "direct" else "代号密码保护",
                    r["view_code"], r["view_password"], r["remark"], r["created_at"]])
    return Response(
        "\ufeff" + buf.getvalue(), mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=scores.csv"},
    )


@app.get("/api/teacher/backup")
@require("teacher")
def backup_all():
    """数据库一致性快照 + 全部附件，打成 zip 供老师本地留存。"""
    snap = os.path.join(DATA_DIR, ".backup_snapshot.db")
    buf = io.BytesIO()
    try:
        src = sqlite3.connect(DB_PATH)
        dst = sqlite3.connect(snap)
        try:
            src.backup(dst)
        finally:
            dst.close()
            src.close()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            with open(snap, "rb") as fh:
                z.writestr("qike.db", fh.read())
            for fn in sorted(os.listdir(UPLOAD_DIR)):
                path = os.path.join(UPLOAD_DIR, fn)
                if os.path.isfile(path):
                    with open(path, "rb") as fh:
                        z.writestr("uploads/" + fn, fh.read())
            z.writestr("README.txt",
                       "启课完整备份\n\nqike.db = 数据库快照（把文件放回 data/ 目录即可恢复）\n"
                       "uploads/ = 作业附件\n生成时间：" + now() + "\n")
    finally:
        if os.path.isfile(snap):
            os.remove(snap)
    name = "qike-backup-" + datetime.now().strftime("%Y%m%d-%H%M") + ".zip"
    return Response(
        buf.getvalue(), mimetype="application/zip",
        headers={"Content-Disposition": 'attachment; filename="%s"' % name},
    )


# ---------------------------------------------------------------- 老师 · 通知

@app.get("/api/teacher/notifications")
@require("teacher")
def teacher_notifications():
    rows = db().execute(
        "SELECT * FROM notifications WHERE teacher_id=? ORDER BY id DESC LIMIT 100",
        (session["uid"],)
    ).fetchall()
    return resp_ok(notifications=[dict(r) for r in rows])


@app.post("/api/teacher/notifications/read")
@require("teacher")
def read_notifications():
    db().execute("UPDATE notifications SET is_read=1 WHERE teacher_id=?",
                 (session["uid"],))
    db().commit()
    return resp_ok()


# ---------------------------------------------------------------- 学生

@app.get("/api/student/homeworks")
@require("student")
def student_homeworks():
    tid = teacher_of_student(session["uid"])
    if tid is None:
        return resp_err("账号异常", 403)
    rows = db().execute(
        "SELECT h.*,sub.id AS submission_id,sub.status AS my_status,"
        "sub.content AS my_content,sub.file_id AS my_file_id,"
        "sub.file_name AS my_file_name,sub.score,sub.comment,sub.submitted_at "
        "FROM homeworks h LEFT JOIN submissions sub "
        "ON sub.homework_id=h.id AND sub.student_id=? "
        "WHERE h.teacher_id=? AND (h.scheduled_at='' OR h.scheduled_at<=?) "
        "AND (h.target_mode='all' OR EXISTS("
        "  SELECT 1 FROM homework_targets t WHERE t.homework_id=h.id AND t.student_id=?)) "
        "ORDER BY h.id DESC", (session["uid"], tid, now(), session["uid"])
    ).fetchall()
    items = []
    for r in rows:
        item = dict(r)
        item["overdue"] = 1 if is_overdue(item) else 0
        item["can_submit"] = 0 if (item["overdue"] and not item["allow_late"]) else 1
        items.append(item)
    return resp_ok(homeworks=items)


def save_submission(hid: int, content: str, file_id: str, file_name: str,
                    status: str = "submitted") -> None:
    db().execute(
        "INSERT INTO submissions(homework_id,student_id,content,file_id,file_name,"
        "status,submitted_at,updated_at) VALUES(?,?,?,?,?,?,?,?) "
        "ON CONFLICT(homework_id,student_id) DO UPDATE SET "
        "content=excluded.content,file_id=excluded.file_id,"
        "file_name=excluded.file_name,status=excluded.status,"
        "updated_at=excluded.updated_at",
        (hid, session["uid"], content, file_id, file_name, status, now(), now()),
    )
    db().commit()


@app.post("/api/student/homeworks/<int:hid>/submit")
@require("student")
def submit_homework(hid):
    hw = homework_for_student(hid, session["uid"])
    stu = db().execute("SELECT * FROM students WHERE id=?", (session["uid"],)).fetchone()
    if not hw or not stu or hw["teacher_id"] != stu["teacher_id"]:
        return resp_err("作业不存在或未指派给你", 404)
    if is_overdue(hw) and not hw["allow_late"]:
        return resp_err("已过截止时间，这份作业不能再提交了", 403)
    if hw["mode"] == "notice":
        return resp_err("该作业只需查看，无需提交")
    d = body()
    content = (d.get("content") or "").strip()
    file_id = (d.get("file_id") or "").strip()
    file_name = ""
    if file_id:
        f = db().execute("SELECT * FROM files WHERE id=?", (file_id,)).fetchone()
        if not f or f["owner_role"] != "student" or f["owner_id"] != session["uid"]:
            return resp_err("附件无效，请重新上传")
        file_name = f["original_name"]
    if not content and not file_id:
        return resp_err("请填写作答内容或上传文件")
    save_submission(hid, content, file_id, file_name)
    push_notification(hw["teacher_id"], "submission", "收到新的作业提交",
                      f"{stu['name']} 提交了《{hw['title']}》", important=False)
    return resp_ok()


@app.post("/api/student/homeworks/<int:hid>/ack")
@require("student")
def ack_homework(hid):
    hw = homework_for_student(hid, session["uid"])
    stu = db().execute("SELECT * FROM students WHERE id=?", (session["uid"],)).fetchone()
    if not hw or not stu or hw["teacher_id"] != stu["teacher_id"]:
        return resp_err("作业不存在或未指派给你", 404)
    save_submission(hid, "", "", "", "acked")
    return resp_ok()


@app.get("/api/student/scores")
@require("student")
def student_scores():
    unlocked = set(session.get("unlocked", []))
    rows = db().execute(
        "SELECT * FROM scores WHERE student_id=? ORDER BY id DESC", (session["uid"],)
    ).fetchall()
    visible, locked_count = [], 0
    for r in rows:
        if r["mode"] == "direct" or r["id"] in unlocked:
            item = dict(r)
            item.pop("view_hash", None)
            item.pop("view_password", None)
            visible.append(item)
        else:
            locked_count += 1
    return resp_ok(scores=visible, locked_count=locked_count)


@app.post("/api/student/scores/unlock")
@require("student")
def unlock_score():
    d = body()
    code = (d.get("code") or "").strip().upper()
    pwd = (d.get("password") or "").strip()
    if not code or not pwd:
        return resp_err("请填写成绩代号和查看密码")
    row = db().execute(
        "SELECT * FROM scores WHERE student_id=? AND mode='locked' AND view_code=?",
        (session["uid"], code),
    ).fetchone()
    if not row:
        return resp_err("代号不存在或不属于你，请核对老师给的信息", 404)
    if not row["view_hash"] or not check_password_hash(row["view_hash"], pwd):
        return resp_err("查看密码不正确", 403)
    unlocked = set(session.get("unlocked", []))
    unlocked.add(row["id"])
    session["unlocked"] = list(unlocked)
    item = dict(row)
    item.pop("view_hash", None)
    item.pop("view_password", None)
    return resp_ok(score=item)


@app.get("/api/student/overview")
@require("student")
def student_overview():
    tid = teacher_of_student(session["uid"])
    con = db()
    total = con.execute(
        "SELECT COUNT(*) c FROM homeworks WHERE teacher_id=? AND (target_mode='all' "
        "OR EXISTS(SELECT 1 FROM homework_targets t WHERE t.homework_id=homeworks.id "
        " AND t.student_id=?))", (tid, session["uid"]),
    ).fetchone()["c"]
    done = con.execute("SELECT COUNT(*) c FROM submissions WHERE student_id=?",
                       (session["uid"],)).fetchone()["c"]
    reviewed = con.execute(
        "SELECT COUNT(*) c FROM submissions WHERE student_id=? AND comment<>''",
        (session["uid"],),
    ).fetchone()["c"]
    scores = con.execute("SELECT COUNT(*) c FROM scores WHERE student_id=?",
                         (session["uid"],)).fetchone()["c"]
    unread = con.execute(
        "SELECT COUNT(*) c FROM student_notifications WHERE student_id=? AND is_read=0",
        (session["uid"],),
    ).fetchone()["c"]
    return resp_ok(total=total, done=done, reviewed=reviewed, scores=scores, unread=unread)


@app.get("/api/student/notifications")
@require("student")
def student_notifications():
    rows = db().execute(
        "SELECT * FROM student_notifications WHERE student_id=? ORDER BY id DESC LIMIT 100",
        (session["uid"],),
    ).fetchall()
    unread = db().execute(
        "SELECT COUNT(*) c FROM student_notifications WHERE student_id=? AND is_read=0",
        (session["uid"],),
    ).fetchone()["c"]
    return resp_ok(notifications=[dict(r) for r in rows], unread=unread)


@app.post("/api/student/notifications/read")
@require("student")
def read_student_notifications():
    db().execute("UPDATE student_notifications SET is_read=1 WHERE student_id=?",
                 (session["uid"],))
    db().commit()
    return resp_ok()


# ---------------------------------------------------------------- 附件

@app.post("/api/upload")
def upload_file():
    user = me()
    if not user:
        return resp_err("请先登录", 401)
    f = request.files.get("file")
    if not f or not f.filename:
        return resp_err("请选择文件")
    raw_name = f.filename.replace("\\", "/").split("/")[-1][:120]
    ext = os.path.splitext(raw_name)[1].lower()
    if ext not in ALLOWED_EXT:
        return resp_err("不支持该文件类型")
    data = f.read()
    if len(data) > MAX_FILE:
        return resp_err("文件不能超过 10MB")
    if not data:
        return resp_err("文件为空")
    fid = secrets.token_urlsafe(18)
    stored = fid + ext
    with open(os.path.join(UPLOAD_DIR, stored), "wb") as fh:
        fh.write(data)
    db().execute(
        "INSERT INTO files(id,owner_role,owner_id,original_name,stored_name,size,created_at) "
        "VALUES(?,?,?,?,?,?,?)",
        (fid, user["role"], user["id"], raw_name, stored, len(data), now()),
    )
    db().commit()
    return resp_ok(file={"id": fid, "name": raw_name, "size": len(data)})


@app.get("/api/file/<fid>")
def get_file(fid):
    user = me()
    if not user:
        abort(401)
    row = db().execute("SELECT * FROM files WHERE id=?", (fid,)).fetchone()
    if not row:
        abort(404)
    con = db()
    allowed = False
    if user["role"] == "teacher":
        if row["owner_role"] == "teacher" and row["owner_id"] == user["id"]:
            allowed = True
        elif row["owner_role"] == "student":
            allowed = teacher_of_student(row["owner_id"]) == user["id"]
    else:
        if row["owner_role"] == "student" and row["owner_id"] == user["id"]:
            allowed = True
        elif row["owner_role"] == "teacher":
            allowed = teacher_of_student(user["id"]) == row["owner_id"]
    if not allowed:
        abort(403)
    path = os.path.join(UPLOAD_DIR, row["stored_name"])
    if not os.path.isfile(path):
        abort(404)
    # 在线预览只允许 PDF / 图片，且用最严格的 CSP 兜住，避免上传的 HTML/SVG 变成存储型 XSS
    if request.args.get("inline") == "1":
        ext = os.path.splitext(row["original_name"])[1].lower()
        if ext in (".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"):
            res = send_file(path, as_attachment=False)
            res.headers["Content-Security-Policy"] = (
                "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'")
            res.headers["X-Content-Type-Options"] = "nosniff"
            return res
    return send_file(path, as_attachment=True, download_name=row["original_name"])


# ---------------------------------------------------------------- 扩展模块注册
EXT_MODULES = ("batch", "classes", "quiz", "scores", "notify", "ops")
for _n in EXT_MODULES:
    try:
        _m = __import__("features.mod_" + _n, fromlist=["BP"])
        app.register_blueprint(_m.BP, url_prefix="/api/x/" + _n)
        print("[扩展] %s 已加载" % _n)
    except Exception as _e:
        print("[扩展] %s 未加载：%s" % (_n, _e))


def start_scheduler():
    """分钟级统一调度：截止提醒 / 定时发布 / 自动备份，由各模块提供 tick()。"""
    mods = []
    for n in EXT_MODULES:
        try:
            mods.append(__import__("features.mod_" + n, fromlist=["tick"]))
        except Exception:
            pass

    def loop():
        while True:
            time.sleep(60)
            for m in mods:
                try:
                    if hasattr(m, "tick"):
                        with app.app_context():
                            m.tick()
                except Exception:
                    pass

    threading.Thread(target=loop, daemon=True, name="qike-scheduler").start()


if __name__ == "__main__":
    port = int(os.environ.get("QIKE_PORT", "5173"))
    host = os.environ.get("QIKE_HOST", "127.0.0.1")
    cert = os.environ.get("QIKE_SSL_CERT", "")
    key = os.environ.get("QIKE_SSL_KEY", "")
    scheme = "https" if cert and key else "http"
    print(f"启课已启动： {scheme}://127.0.0.1:{port}")
    if host != "127.0.0.1":
        print("局域网已开启：同一网络下用 %s://<本机IP>:%s 访问" % (scheme, port))
    start_scheduler()
    app.run(host=host, port=port, debug=False, threaded=True,
            ssl_context=(cert, key) if cert and key else None)
