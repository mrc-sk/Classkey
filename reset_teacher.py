# -*- coding: utf-8 -*-
"""启课 · 服务器本地重置老师密码（未配置邮件网关时的兜底手段）

用法：
    python reset_teacher.py teacher@example.com              # 自动生成新密码并打印
    python reset_teacher.py teacher@example.com NewPass123  # 指定新密码（至少 8 位）
"""
import os
import secrets
import sqlite3
import sys

from werkzeug.security import generate_password_hash

BASE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE, "data", "qike.db")

if not os.path.isdir(os.path.join(BASE, "data")) or not os.path.isfile(DB_PATH):
    raise SystemExit("未找到 data/qike.db，请确认在项目根目录运行本脚本。")


def main():
    if len(sys.argv) < 2:
        raise SystemExit("用法：python reset_teacher.py <老师邮箱> [新密码]")
    email = sys.argv[1].strip().lower()
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
    new = sys.argv[2] if len(sys.argv) > 2 else "".join(secrets.choice(alphabet) for _ in range(10))
    if len(new) < 8:
        raise SystemExit("新密码至少 8 位。")

    con = sqlite3.connect(DB_PATH)
    try:
        row = con.execute("SELECT id,name FROM teachers WHERE email=?", (email,)).fetchone()
        if not row:
            raise SystemExit("该邮箱尚未注册老师账号：%s" % email)
        con.execute("UPDATE teachers SET password_hash=? WHERE id=?",
                    (generate_password_hash(new), row[0]))
        # 让此前发出去的重置码全部失效
        con.execute("UPDATE password_resets SET used=1 WHERE teacher_id=?", (row[0],))
        con.commit()
    finally:
        con.close()
    print("已重置 %s（%s）的登录密码：%s" % (row[1], email, new))
    print("请把新密码通过私下渠道告知老师本人。")


if __name__ == "__main__":
    main()
