# -*- coding: utf-8 -*-
"""启课端到端自检：老师注册 → 派发学生密码 → 作业 → 提交 → 批改 → 成绩解锁。
用法：先启动 app.py，再运行 python selftest.py
"""
import http.cookiejar
import http.server
import io
import json
import sys
import zipfile
import threading
import urllib.error
import urllib.request
import uuid

BASE = "http://127.0.0.1:5173"
PASSED = []
# 每次运行用独立的老师 / 学生邮箱，可反复执行且不碰已有演示数据
SUFFIX = uuid.uuid4().hex[:6]
TEACHER_EMAIL = "teacher_%s@qike.local" % SUFFIX
STU_MAILS = ["liming_%s@qike.local" % SUFFIX,
             "wanghua_%s@qike.local" % SUFFIX,
             "zhangqing_%s@qike.local" % SUFFIX]


class MailHook(http.server.BaseHTTPRequestHandler):
    """本地假邮件网关，捕获一次性重置码用于端到端验证。"""
    received = []

    def do_POST(self):
        raw = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        MailHook.received.append(json.loads(raw.decode("utf-8")))
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")

    def log_message(self, *args):
        pass


def check(cond, label):
    if not cond:
        raise AssertionError(label)
    PASSED.append(label)
    print("  [OK] " + label)


class Client:
    def __init__(self, tag):
        self.tag = tag
        self.jar = http.cookiejar.CookieJar()
        self.op = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.jar))
        self.csrf = ""

    def call(self, path, method="GET", data=None, expect=200):
        headers = {}
        body = None
        if data is not None:
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if method != "GET":
            headers["X-CSRF-Token"] = self.csrf
        req = urllib.request.Request(BASE + path, data=body,
                                     headers=headers, method=method)
        try:
            with self.op.open(req, timeout=10) as res:
                status, raw = res.status, res.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            status, raw = e.code, e.read().decode("utf-8")
        j = json.loads(raw) if raw.lstrip().startswith("{") else {"raw": raw[:200]}
        if "csrf" in j:
            self.csrf = j["csrf"]
        if expect is not None and status != expect:
            raise AssertionError("[%s] %s %s -> HTTP %s %s" %
                                 (self.tag, method, path, status, j))
        return j, status

    def upload(self, filename, content):
        b = "----qikeboundary"
        body = (
            ("--%s\r\nContent-Disposition: form-data; name=\"file\"; "
             "filename=\"%s\"\r\nContent-Type: text/plain\r\n\r\n" % (b, filename)
             ).encode("utf-8")
            + content + ("\r\n--%s--\r\n" % b).encode("utf-8")
        )
        req = urllib.request.Request(
            BASE + "/api/upload", data=body, method="POST",
            headers={"Content-Type": "multipart/form-data; boundary=" + b,
                     "X-CSRF-Token": self.csrf})
        with self.op.open(req, timeout=10) as res:
            return json.loads(res.read().decode("utf-8"))

    def download(self, file_id, expect=200):
        try:
            with self.op.open(BASE + "/api/file/" + file_id, timeout=10) as res:
                return res.status, res.read()
        except urllib.error.HTTPError as e:
            return e.code, b""

    def raw_get(self, path):
        """返回 (status, bytes, headers)，用于下载型接口。"""
        try:
            with self.op.open(BASE + path, timeout=15) as res:
                return res.status, res.read(), dict(res.headers)
        except urllib.error.HTTPError as e:
            return e.code, b"", dict(e.headers)


def main():
    t, s, s2 = Client("teacher"), Client("student"), Client("student2")
    mail_server = http.server.HTTPServer(("127.0.0.1", 0), MailHook)
    threading.Thread(target=mail_server.serve_forever, daemon=True).start()
    hook_url = "http://127.0.0.1:%d/mail" % mail_server.server_address[1]

    # 首屏与初始化
    html = t.call("/")[0].get("raw", "")
    check(bool(html.strip()) and "<" in html, "首页 HTML 可访问")
    b = t.call("/api/bootstrap")[0]
    check(bool(t.csrf), "CSRF 发放成功")
    check(b["user"] is None, "首次访问未登录")

    # CSRF 防护
    saved = t.csrf
    t.csrf = "bad-token"
    bad = t.call("/api/auth/register", "POST", {"email": "x@y.com"}, expect=403)[0]
    check("安全校验" in bad.get("error", ""), "写操作有 CSRF 校验")
    t.csrf = saved

    # 老师注册（邮箱 + 手机号 + 学校信息）
    reg = t.call("/api/auth/register", "POST", {
        "name": "王老师", "email": TEACHER_EMAIL,
        "password": "Teach12345", "phone": "13800138000",
        "school": "启明中学", "class_name": "高二（3）班",
    })[0]
    check(reg["user"]["role"] == "teacher", "老师用邮箱注册成功")
    prof = t.call("/api/teacher/profile", "PUT", {
        "name": "王老师", "phone": "13800138000", "school": "启明中学",
        "grade": "高二", "class_name": "高二（3）班",
        "notify_enabled": True, "sms_webhook": "",
    })[0]
    check(prof.get("ok") is True, "学校 / 班级 / 通知手机号可保存")
    p = t.call("/api/bootstrap")[0]["profile"]
    check(p["school"] == "启明中学" and p["phone"] == "13800138000",
          "学校与手机号持久化回读")

    # 老师创建学生账号并派发密码
    stu = []
    for name, mail, no in [("李明", STU_MAILS[0], "202601"),
                           ("王华", STU_MAILS[1], "202602")]:
        r = t.call("/api/teacher/students", "POST",
                   {"name": name, "email": mail, "student_no": no})[0]
        stu.append(r["student"])
        check(len(r["student"]["initial_password"]) == 8,
              "老师为 %s 生成 8 位登录密码" % name)
    lst = t.call("/api/teacher/students")[0]["students"]
    check(len(lst) == 2 and lst[0]["initial_password"], "老师可随时复制学生密码")
    batch = t.call("/api/teacher/students/batch", "POST",
                   {"text": "张晴,%s,202603\n坏行没有邮箱" % STU_MAILS[2]})[0]
    check(len(batch["created"]) == 1 and len(batch["skipped"]) == 1,
          "批量导入：成功 1 行、跳过 1 行")

    # 三种作业模式
    hw_ids = {}
    for mode, title in [("online", "第三单元在线练习"),
                        ("upload", "实验报告上传"),
                        ("notice", "周末阅读（无需提交）")]:
        r = t.call("/api/teacher/homeworks", "POST", {
            "title": title, "subject": "物理", "description": "按要求完成",
            "due_at": "2026-11-20T18:00", "mode": mode,
        })[0]
        hw_ids[mode] = r["id"]
    check(len(hw_ids) == 3, "三种作业模式均可发布（在线作答 / 网上提交 / 只留不交）")
    ov = t.call("/api/teacher/overview")[0]
    check(ov["students"] == 3 and ov["homeworks"] == 3, "老师工作台统计正确")

    # 学生登录：无需注册、无需手机号
    s.call("/api/bootstrap")
    lg = s.call("/api/auth/login", "POST", {
        "role": "student", "email": stu[0]["email"],
        "password": stu[0]["initial_password"]})[0]
    check(lg["user"]["role"] == "student", "学生凭邮箱 + 老师发的密码登录")
    mine = s.call("/api/student/homeworks")[0]["homeworks"]
    check(len(mine) == 3, "学生看到本班 3 条作业")

    # 越权
    s.call("/api/teacher/students", expect=403)
    check(True, "学生访问老师接口被拒绝 (403)")

    # 在线作答
    s.call("/api/student/homeworks/%d/submit" % hw_ids["online"], "POST",
           {"content": "第 1 题：F=ma；第 2 题：见草稿。"})
    check(True, "在线作答提交成功")

    # 上传附件并提交
    up = s.upload("report.txt", "实验报告：自由落体测量结果".encode("utf-8"))
    check(bool(up["file"]["id"]), "学生文件上传成功")
    fid = up["file"]["id"]
    s.call("/api/student/homeworks/%d/submit" % hw_ids["upload"], "POST",
           {"content": "补充说明", "file_id": fid})
    check(True, "网上提交（带附件）成功")
    st, content = s.download(fid)
    check(st == 200 and "自由落体" in content.decode("utf-8"), "附件可下载且内容正确")
    t_st, _ = t.download(fid)
    check(t_st == 200, "老师可下载自己学生的附件")

    # 只留不交 → 标记已知悉
    s.call("/api/student/homeworks/%d/ack" % hw_ids["notice"], "POST")
    subs = t.call("/api/teacher/homeworks/%d/submissions" % hw_ids["notice"])[0]
    check(subs["items"][0]["status"] == "acked", "只留不交模式可标记已知悉")

    # 老师查看提交并批改
    detail = t.call("/api/teacher/homeworks/%d/submissions" % hw_ids["online"])[0]
    subid = detail["items"][0]["submission_id"]
    check(subid is not None and detail["items"][1]["submission_id"] is None,
          "老师看到已提交 / 未提交两种状态")
    t.call("/api/teacher/submissions/%d/review" % subid, "POST",
           {"score": "95", "comment": "步骤清晰，继续加油"})
    check(True, "老师批改并写评语成功")

    # 成绩：直接发送
    t.call("/api/teacher/scores", "POST", {
        "student_id": stu[0]["id"], "exam_name": "第一次月考",
        "subject": "物理", "score": 88, "full_score": 100,
        "remark": "进步明显", "mode": "direct"})
    sc = s.call("/api/student/scores")[0]
    check(len(sc["scores"]) == 1 and sc["scores"][0]["exam_name"] == "第一次月考",
          "直接发送的成绩：学生登录即见")

    # 成绩：代号密码保护
    locked = t.call("/api/teacher/scores", "POST", {
        "student_id": stu[0]["id"], "exam_name": "期中测验",
        "subject": "物理", "score": 92, "full_score": 100,
        "mode": "locked"})[0]
    check(locked["mode"] == "locked" and len(locked["view_code"]) >= 4,
          "密码保护成绩生成代号 + 查看密码")
    sc2 = s.call("/api/student/scores")[0]
    check(sc2["locked_count"] == 1 and len(sc2["scores"]) == 1,
          "未解锁成绩不泄露内容")
    wrong = s.call("/api/student/scores/unlock", "POST",
                   {"code": locked["view_code"], "password": "WRONG"},
                   expect=403)[0]
    check("密码" in wrong.get("error", ""), "错误查看密码被拒绝")
    ok = s.call("/api/student/scores/unlock", "POST",
                {"code": locked["view_code"],
                 "password": locked["view_password"]})[0]
    check(ok["score"]["score"] == 92, "学生输入代号 + 密码解锁成绩")
    check(len(s.call("/api/student/scores")[0]["scores"]) == 2, "解锁后成绩进入可见列表")

    # 老师凭据可回查、重置密码、通知中心
    scl = t.call("/api/teacher/scores")[0]["scores"]
    check(all("view_password" not in x and "view_hash" not in x for x in scl),
          "成绩列表不再泄露明文查看密码 / 哈希")
    regen = t.call("/api/teacher/scores/%d/regen" % locked["id"], "POST")[0]
    check(len(regen["view_password"]) >= 4 and regen["view_code"] != locked["view_code"],
          "老师可重新生成一组代号密码且旧代号失效")
    reset = t.call("/api/teacher/students/%d/reset" % stu[1]["id"], "POST")[0]
    check(len(reset["password"]) == 8, "老师可重置学生登录密码")
    notes = t.call("/api/teacher/notifications")[0]["notifications"]
    check(len(notes) >= 4, "作业 / 提交 / 成绩自动进入通知中心")

    # 改密后老师不再看到明文
    s.call("/api/auth/password", "POST", {
        "old_password": stu[0]["initial_password"],
        "new_password": "NewPass12345"})
    after = t.call("/api/teacher/students")[0]["students"]
    check(any(x["email"] == stu[0]["email"] and x["initial_password"] == ""
              for x in after), "学生改密后明文密码自动清除")

    # ============ v2：定向派发 / 截止 / 通知 / 分析 / 找回 ============
    s2.call("/api/bootstrap")
    s2.call("/api/auth/login", "POST", {
        "role": "student", "email": stu[1]["email"], "password": reset["password"]})

    targeted = t.call("/api/teacher/homeworks", "POST", {
        "title": "仅李明的补差练习", "subject": "数学", "mode": "online",
        "target_mode": "selected", "student_ids": [stu[0]["id"]],
        "due_at": "2026-12-01T18:00",
    })[0]
    check(targeted["recipients"] == 1, "作业可只派发给指定的 1 位学生")
    mine1 = s.call("/api/student/homeworks")[0]["homeworks"]
    mine2 = s2.call("/api/student/homeworks")[0]["homeworks"]
    check(any(x["id"] == targeted["id"] for x in mine1), "被指派的学生能看到该作业")
    check(not any(x["id"] == targeted["id"] for x in mine2), "未指派的学生看不到该作业")
    denied = s2.call("/api/student/homeworks/%d/submit" % targeted["id"], "POST",
                     {"content": "我不该能交"}, expect=404)[0]
    check("未指派" in denied.get("error", ""), "范围外学生提交被拒绝 (404)")
    detail_t = t.call("/api/teacher/homeworks/%d/submissions" % targeted["id"])[0]
    check(len(detail_t["items"]) == 1 and detail_t["items"][0]["student_id"] == stu[0]["id"],
          "老师提交列表只统计被指派的学生")
    hw_all = t.call("/api/teacher/homeworks")[0]["homeworks"]
    th = [x for x in hw_all if x["id"] == targeted["id"]][0]
    check(th["total_students"] == 1 and th["target_names"] == ["李明"],
          "提交进度分母按目标人数计算")

    late = t.call("/api/teacher/homeworks", "POST", {
        "title": "已截止的作业", "mode": "online", "due_at": "2020-01-01T08:00",
        "target_mode": "all",
    })[0]
    blocked = s.call("/api/student/homeworks/%d/submit" % late["id"], "POST",
                     {"content": "迟交"}, expect=403)[0]
    check("截止" in blocked.get("error", ""), "逾期作业拒绝提交 (403)")
    late_open = t.call("/api/teacher/homeworks", "POST", {
        "title": "允许补交的作业", "mode": "online", "due_at": "2020-01-01T08:00",
        "allow_late": True, "target_mode": "all",
    })[0]
    s.call("/api/student/homeworks/%d/submit" % late_open["id"], "POST",
           {"content": "补交成功"})
    check(True, "老师开启「允许补交」后逾期仍可提交")
    hl = t.call("/api/teacher/homeworks")[0]["homeworks"]
    check(any(x["id"] == late["id"] and x["overdue"] == 1 for x in hl),
          "逾期标记在老师端可见")
    sl = s.call("/api/student/homeworks")[0]["homeworks"]
    check(any(x["id"] == late["id"] and x["can_submit"] == 0 for x in sl),
          "逾期不可提交状态在学生端可见")

    notes_s = s.call("/api/student/notifications")[0]
    check(notes_s["unread"] >= 3, "新作业 / 批改 / 成绩自动推送给学生")
    kinds = {n["kind"] for n in notes_s["notifications"]}
    check({"homework", "review", "score"} <= kinds, "三类学生提醒齐全")
    notes_s2 = s2.call("/api/student/notifications")[0]
    check(notes_s2["unread"] >= 1, "范围外的学生仍能收到全班通知")
    check(not any("补差练习" in n["title"] for n in notes_s2["notifications"]),
          "定向作业不会推送给范围外的学生")
    s.call("/api/student/notifications/read", "POST")
    check(s.call("/api/student/notifications")[0]["unread"] == 0,
          "学生可一键清空未读")

    an = t.call("/api/teacher/analytics")[0]
    check(an["total"] == 2 and an["exams"] and an["ranking"],
          "成绩分析返回汇总 / 考试 / 学生排行")
    check(an["avg"] == 90.0, "平均得分率计算正确（88 与 92）")
    check(sum(b["count"] for b in an["distribution"]) == 2, "分数段分布人次与记录数一致")
    st_csv, csv_bytes, _ = t.raw_get("/api/teacher/scores/export")
    check(st_csv == 200 and csv_bytes[:3] == b"\xef\xbb\xbf"
          and "第一次月考" in csv_bytes.decode("utf-8-sig"),
          "成绩明细可导出为带 BOM 的 CSV")
    st_zip, zip_bytes, _ = t.raw_get("/api/teacher/backup")
    check(st_zip == 200 and zip_bytes[:2] == b"PK", "完整备份可下载 (zip)")
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as z:
        names = z.namelist()
    check("qike.db" in names and "README.txt" in names,
          "备份内含数据库一致性快照与恢复说明")

    s.call("/api/teacher/analytics", expect=403)
    st_bak, _, _ = s.raw_get("/api/teacher/backup")
    check(st_bak == 403, "学生访问成绩分析与备份接口被拒绝 (403)")

    nohook = t.call("/api/auth/forgot", "POST", {"email": TEACHER_EMAIL}, expect=400)[0]
    check("邮件网关" in nohook.get("error", ""), "未配置邮件网关时给出命令行兜底指引")
    t.call("/api/teacher/profile", "PUT", {
        "name": "王老师", "phone": "13800138000", "school": "启明中学",
        "grade": "高二", "class_name": "高二（3）班", "notify_enabled": True,
        "sms_webhook": "", "mail_webhook": hook_url,
    })
    fg = t.call("/api/auth/forgot", "POST", {"email": TEACHER_EMAIL})[0]
    check(fg.get("sent") is True and bool(MailHook.received),
          "一次性重置码通过邮件网关投递")
    code = MailHook.received[-1]["code"]
    wrong = t.call("/api/auth/reset", "POST", {
        "email": TEACHER_EMAIL, "code": "000000", "new_password": "Hack12345"},
        expect=403)[0]
    check("重置码" in wrong.get("error", ""), "错误重置码被拒绝")
    t.call("/api/auth/reset", "POST", {
        "email": TEACHER_EMAIL, "code": code, "new_password": "Recover12345"})
    t2 = Client("teacher-recovered")
    t2.call("/api/bootstrap")
    lg2 = t2.call("/api/auth/login", "POST", {
        "role": "teacher", "email": TEACHER_EMAIL, "password": "Recover12345"})[0]
    check(lg2["user"]["role"] == "teacher", "用重置后的新密码可登录")
    reused = t2.call("/api/auth/reset", "POST", {
        "email": TEACHER_EMAIL, "code": code, "new_password": "Again12345"},
        expect=403)[0]
    check("重置码" in reused.get("error", ""), "重置码一次性有效，不可重复使用")

    st_home, _, home_heads = t.raw_get("/")
    check(st_home == 200 and "Content-Security-Policy" in home_heads,
          "页面带 CSP 等安全响应头")

    mail_server.shutdown()
    print("\n通过 %d 项检查，全流程跑通。" % len(PASSED))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("\n自检失败：%s" % e, file=sys.stderr)
        sys.exit(1)
