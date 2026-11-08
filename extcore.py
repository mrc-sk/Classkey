# -*- coding: utf-8 -*-
"""扩展模块公共入口。

所有 features/mod_*.py 只从这里取后端能力，不要直接 import app，
也不要自行建表 / 加列（表统一定义在 schema_extra.sql，列统一在 app.init_db 迁移）。
"""
from __future__ import annotations

import csv
import io
import json as _json
import os

from flask import Blueprint, Response, request, session

import app as _core

BASE = _core.BASE
DATA_DIR = _core.DATA_DIR
UPLOAD_DIR = _core.UPLOAD_DIR


def bp(name: str) -> Blueprint:
    """每个模块创建自己的 Blueprint，注册时统一加 /api/x/<模块名> 前缀。"""
    return Blueprint("x_" + name, __name__)


def db():
    return _core.db()


def me():
    return _core.me()


def require(role: str):
    return _core.require(role)


def resp_ok(**payload):
    return _core.resp_ok(**payload)


def resp_err(message: str, status: int = 400):
    return _core.resp_err(message, status)


def now() -> str:
    return _core.now()


def body() -> dict:
    return request.get_json(silent=True) or {}


def gen_code(n: int = 8) -> str:
    return _core.gen_code(n)


def uid() -> int:
    return session["uid"]


def role() -> str:
    return session["role"]


def push_notification(teacher_id, kind, title, text, important=False):
    return _core.push_notification(teacher_id, kind, title, text, important)


def push_student_notification(student_id, kind, title, text):
    return _core.push_student_notification(student_id, kind, title, text)


def teacher_of_student(student_id):
    return _core.teacher_of_student(student_id)


def homework_for_student(hid, student_id):
    return _core.homework_for_student(hid, student_id)


def target_ids(hid):
    return _core.target_ids(hid)


def parse_due(value):
    return _core.parse_due(value)


def is_overdue(hw):
    return _core.is_overdue(hw)


def json_loads(text, fallback=None):
    try:
        return _json.loads(text or "")
    except Exception:
        return fallback if fallback is not None else {}


def json_dumps(obj) -> str:
    return _json.dumps(obj, ensure_ascii=False)


# ---------------------------------------------------------------- 设置项
def get_setting(table: str, owner_id: int, key: str, default: str = "") -> str:
    assert table in ("teacher_settings", "student_settings", "app_settings")
    if table == "app_settings":
        row = db().execute("SELECT value FROM app_settings WHERE key=?", (key,)).fetchone()
    else:
        col = "teacher_id" if table == "teacher_settings" else "student_id"
        row = db().execute(
            "SELECT value FROM %s WHERE %s=? AND key=?" % (table, col), (owner_id, key)
        ).fetchone()
    return row["value"] if row else default


def set_setting(table: str, owner_id: int, key: str, value: str) -> None:
    assert table in ("teacher_settings", "student_settings", "app_settings")
    if table == "app_settings":
        db().execute(
            "INSERT INTO app_settings(key,value) VALUES(?,?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, str(value))
        )
    else:
        col = "teacher_id" if table == "teacher_settings" else "student_id"
        db().execute(
            "INSERT INTO %s(%s,key,value) VALUES(?,?,?) "
            "ON CONFLICT(%s,key) DO UPDATE SET value=excluded.value"
            % (table, col, col), (owner_id, key, str(value))
        )
    db().commit()


T = "teacher_settings"
ST = "student_settings"
APP = "app_settings"


# ---------------------------------------------------------------- 审计 / 工具
def audit(action: str, detail: str = "") -> None:
    u = me() or {}
    try:
        db().execute(
            "INSERT INTO audit_logs(actor_role,actor_id,action,detail,ip,created_at) "
            "VALUES(?,?,?,?,?,?)",
            (u.get("role", ""), u.get("id", 0), action, detail,
             request.remote_addr or "", now()),
        )
        db().commit()
    except Exception:
        pass


def csv_response(filename: str, header: list[str], rows: list[list]) -> Response:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(header)
    for r in rows:
        w.writerow(r)
    return Response(
        "\ufeff" + buf.getvalue(), mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="%s"' % filename},
    )


def teacher_students(class_id: int = 0):
    """老师名下学生，可按班级过滤。"""
    sql = "SELECT * FROM students WHERE teacher_id=?"
    args = [uid()]
    if class_id:
        sql += " AND class_id=?"
        args.append(class_id)
    return db().execute(sql + " ORDER BY id", args).fetchall()
