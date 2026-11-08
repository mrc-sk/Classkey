# -*- coding: utf-8 -*-
"""扩展模块冒烟：验证 6 个新模块的接口都能正常返回。服务启动后运行。"""
import sys
import time
import urllib.request
from selftest import Client
from features.mod_ops import _totp

PASS, FAIL = [], []


def ck(cond, label):
    (PASS if cond else FAIL).append(label)
    print(("  [OK] " if cond else "  [XX] ") + label)


def ok(t, path, method="GET", data=None):
    j = t.call(path, method, data)[0]
    good = "error" not in j
    ck(good, method + " " + path + ("" if good else " -> " + str(j)[:120]))
    return j


def main():
    t = Client("teacher")
    t.call("/api/bootstrap")
    r = t.call("/api/auth/login", "POST", {
        "role": "teacher", "email": "teacher_demo@qike.local",
        "password": "Teach12345"})[0]
    if r.get("error"):
        print("演示老师登录失败：", r)
        sys.exit(1)

    print("\n-- 只读接口 --")
    for p in [
        "/api/x/batch/students", "/api/x/batch/classes", "/api/x/batch/templates",
        "/api/x/classes/", "/api/x/classes/summary", "/api/x/classes/join-requests",
        "/api/x/quiz/templates", "/api/x/quiz/tags", "/api/x/quiz/leaves",
        "/api/x/quiz/copy-last",
        "/api/x/scores/settings", "/api/x/scores/parent-links", "/api/x/scores/edits",
        "/api/x/scores/insight",
        "/api/x/notify/announcements", "/api/x/notify/messages",
        "/api/x/notify/receipts", "/api/x/notify/prefs",
        "/api/x/ops/audit", "/api/x/ops/calendar", "/api/x/ops/board",
        "/api/x/ops/devices", "/api/x/ops/backups", "/api/x/ops/2fa",
        "/api/x/ops/brand", "/api/x/ops/search?q=%E6%9D%8E",
    ]:
        ok(t, p)

    print("\n-- 写接口 --")
    stu = t.call("/api/teacher/students")[0]["students"]
    sid = stu[0]["id"] if stu else 0
    ok(t, "/api/x/quiz/templates", "POST", {"title": "冒烟模板", "subject": "数学", "mode": "online"})
    ok(t, "/api/x/classes/", "POST", {"name": "冒烟班级", "grade": "七年级"})
    ok(t, "/api/x/notify/announcements", "POST", {"title": "冒烟公告", "body": "测试", "pinned": True})
    ok(t, "/api/x/notify/prefs", "POST", {"remind_before": 24})
    ok(t, "/api/x/ops/backups/run", "POST")
    ok(t, "/api/x/ops/brand", "POST", {"name": "启课", "color": "#4E95D9"})
    ok(t, "/api/x/scores/settings", "POST", {"grade_mode": "score", "pass_line": 60,
                                             "excellent_line": 85, "show_rank": "0"})
    if sid:
        link = ok(t, "/api/x/scores/parent-links", "POST", {"student_id": sid, "days": 7})
        if link.get("token"):
            page = t.call("/api/x/scores/p/" + link["token"])[0]
            ck("raw" in page and "学习情况" in page.get("raw", ""), "家长只读页可访问且含学生信息")

    print("\n-- 学生端 --")
    s = Client("student")
    s.call("/api/bootstrap")
    lr = s.call("/api/auth/login", "POST", {
        "role": "student", "email": "liming@qike.local",
        "password": "NewPass12345"})[0]
    if lr.get("error"):
        print("  [!!] 演示学生登录失败，跳过学生端：", lr)
    else:
        for p in ["/api/x/quiz/leaves", "/api/x/quiz/peer/feed",
                  "/api/x/scores/my-rank",
                  "/api/x/notify/announcements",
                  "/api/x/notify/messages", "/api/x/notify/prefs",
                  "/api/x/ops/board", "/api/x/ops/calendar", "/api/x/ops/search?q=%E6%95%B0%E5%AD%A6"]:
            ok(s, p)

    print("\n-- 缓存头 --")
    def headers_of(path):
        with urllib.request.urlopen("http://127.0.0.1:5173" + path, timeout=5) as res:
            return dict(res.headers)
    ck("max-age" in headers_of("/static/anim.css").get("Cache-Control", ""), "静态资源带缓存头")
    ck("no-store" in headers_of("/").get("Cache-Control", ""), "首页 / API 不缓存")

    print("\n-- 两步验证登录强制（测完立即关闭，不影响演示账号） --")
    try:
        secret = t.call("/api/x/ops/2fa/setup", "POST")[0]["secret"]
        ok(t, "/api/x/ops/2fa/verify", "POST", {"code": _totp(secret)})
        x = Client("2fa")
        x.call("/api/bootstrap")
        no_code = x.call("/api/auth/login", "POST", {
            "role": "teacher", "email": "teacher_demo@qike.local",
            "password": "Teach12345"}, expect=403)[0]
        ck("两步验证" in no_code.get("error", ""), "启用 2FA 后无验证码登录被拒绝")
        with_code = x.call("/api/auth/login", "POST", {
            "role": "teacher", "email": "teacher_demo@qike.local",
            "password": "Teach12345", "totp": _totp(secret)})[0]
        ck("user" in with_code, "带正确验证码可正常登录")
    finally:
        t.call("/api/x/ops/2fa/disable", "POST")

    print("\n通过 %d 项，失败 %d 项。" % (len(PASS), len(FAIL)))
    if FAIL:
        print("失败清单：")
        for f in FAIL:
            print("  -", f)
        sys.exit(1)


if __name__ == "__main__":
    main()
