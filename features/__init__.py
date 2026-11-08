# -*- coding: utf-8 -*-
"""启课扩展模块包 —— 模块开发契约（所有子模块必须遵守）。

== 后端 ==
每个模块一个文件 features/mod_<名称>.py，必须定义模块级变量::

    BP = extcore.bp("<名称>")

URL 前缀由 app.py 统一注册为 /api/x/<名称>，例如 mod_batch.py 里的
@BP.post("/scores/batch") 最终是 POST /api/x/batch/scores/batch。

导入规范（禁止直接 import app，禁止 flask.create_app）::

    from extcore import (db, me, require, resp_ok, resp_err, now, body, uid, role,
                         gen_code, push_student_notification, push_notification,
                         teacher_of_student, homework_for_student, target_ids,
                         parse_due, is_overdue, json_loads, json_dumps,
                         get_setting, set_setting, T, ST, APP, audit,
                         csv_response, teacher_students, DATA_DIR, UPLOAD_DIR, BASE)

- 所有写接口都要加 @require("teacher") 或 @require("student")；公开只读接口例外，
  但必须自己做 token / 有效期校验。
- POST/PUT/DELETE 受全局 CSRF 保护，前端一律用 Qike.api() 发请求（自动带 token）。
- 越权校验必须做：老师只能操作 teacher_id = uid() 的资源；学生只能操作自己的。
  学生所属老师可用 teacher_of_student(student_id) 判断。
- 不要自己建表 / 加列。可用表与列见 schema_extra.sql 和 app.init_db 的 migrations。
- 可选定义模块级函数 tick()，app.py 的调度线程每 60 秒会在 app_context 里调用一次，
  用于定时发布、截止提醒、自动备份。必须自己去重（reminder_log 等），异常自行吞掉。
- 现有主表：teachers, students(id,teacher_id,email,name,student_no,password_hash,
  initial_password,class_id,parent_contact,note,enrolled_at),
  homeworks(id,teacher_id,title,subject,description,due_at,mode,target_mode,allow_late,
  class_id,scheduled_at,allow_resubmit,attachment_id,attachment_name,created_at),
  homework_targets, submissions, scores(id,teacher_id,student_id,exam_name,subject,
  score,full_score,remark,mode,view_code,view_password,view_hash,revoked,created_at),
  student_notifications, notifications, files。
- scores.view_password 一律不再写入（只存 view_hash）；解锁校验用
  werkzeug.security.check_password_hash(row["view_hash"], pwd)。

== 前端 ==
每个模块一个文件 static/ext-<名称>.js，在 app.js 之后同步加载，写法::

    (function () {
      const Q = window.Qike;
      if (!Q) return;
      Q.PAGES['teacher:xxx'] = async function () { return '<div class="card">…</div>'; };
      Q.NAV.teacher.push({ id:'xxx', label:'…', icon:'grid', title:'…' });
      Q.CLICK['someAction'] = async (el) => { ... };
      Q.FORMS['fSomething'] = async (f) => { ... };
      Q.SUBMIT_TRIGGER['submitSomething'] = 'fSomething';
    })();

- 可用：Q.api(path, method, data)（自动 CSRF）、Q.upload(file)、Q.toast、Q.fail、
  Q.esc/Q.attr（HTML 转义，拼字符串必须用）、Q.icon(name,size)、Q.fmtTime、Q.fmtSize、
  Q.empty(msg)、Q.copyText、Q.$ / Q.$$、Q.openModal({title,body,foot,wide})、
  Q.closeModal()、Q.renderShell()、Q.go(page)、Q.reload()、Q.S（状态）、
  Q.NAV / Q.PAGES / Q.CLICK / Q.FORMS / Q.SUBMIT_TRIGGER（都是引用，可直接加键）。
- 页面函数返回 HTML 字符串；页面里的按钮用 data-act="…" 对应 Q.CLICK 的键；
  表单用 id="f…" 对应 Q.FORMS 的键（submit 事件自动拦截）。
- 弹窗里的按钮若不在 form 内，用 data-act + Q.SUBMIT_TRIGGER 映射触发对应表单提交。
- 样式不要写独立 css 文件（避免多模块改同一文件）。在模块 JS 开头用一次
  `document.head.insertAdjacentHTML('beforeend', '<style>…你的 CSS…</style>')` 注入，
  新 class 一律以 ext- 前缀命名。优先复用已有 class
  （card / btn / input / tbl / badge / field / form-grid / hw-card / stat / section-head /
  radio-card / note / tiny / row / spread / hidden / dist-row / rank-no / pick-list /
  pick-item / modal / empty / progress / chip / bar 等）。
- CSP：不允许内联 <script>，不允许外链 CDN；内联 style 属性允许。
- 不要修改 app.js / app.py / index.html / schema_extra.sql（由主代理统一集成）。

== 模块分工 ==
batch   : ★1 成绩批量录入、★2 粘贴 Excel/CSV 导入（含预览）、3 考试模板、
          6 学生批量操作、7 批量私信、48 标准格式全量导入导出
classes : ★8 多班级、9 班级码与加入审核、10 多老师协作与科任权限、
          11 年级汇总、12 学生分组、13 学生档案、14 结班归档
quiz    : 4 作业模板 + 复制上次、5 定时发布、★15 题库自动判分、16 重交与版本历史、
          17 草稿自动保存、18 拖拽上传/多附件/进度、19 预览与批注、20 互评、
          21 请假补交、22 知识点标签
scores  : 23 等级制、24 排名开关、★25 成绩单打印（window.print，一人一页）、
          ★26 家长只读链接、27 修正留痕与撤回、28 雷达图、29 进步榜/临界生、
          30 自定义分数线、43 查看密码重新生成（后端主代理已做 regen 接口，
          前端在成绩页提供「重新生成密码」按钮）
notify  : 32 学生留言、33 公告栏、★34 截止前自动提醒（tick 实现）、35 已读回执、
          36 免打扰与通知偏好
ops     : 37 深色模式、38 PWA、39 全局搜索、40 日历视图、41 待办看板、42 无障碍、
          44 审计日志查询页（记录由 app.py 统一写入）、45 自动备份与保留策略（tick）、
          46 登录设备管理与两步验证、50 自定义品牌与多语言

== 明确不做 ==
31 真实邮件/短信服务商接入、49 单点登录（用户已排除）。
47 HTTPS 部署脚本由主代理编写，不在子模块范围内。
"""
