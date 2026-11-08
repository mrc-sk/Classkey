-- 启课 · 师生作业与成绩平台
-- 设计要点：老师用邮箱注册；学生账号由老师创建并派发初始密码，学生无需注册、无需手机号。

CREATE TABLE IF NOT EXISTS teachers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash   TEXT    NOT NULL,
  name            TEXT    NOT NULL,
  school          TEXT    NOT NULL DEFAULT '',
  grade           TEXT    NOT NULL DEFAULT '',
  class_name      TEXT    NOT NULL DEFAULT '',
  phone           TEXT    NOT NULL DEFAULT '',
  notify_enabled  INTEGER NOT NULL DEFAULT 1,
  sms_webhook     TEXT    NOT NULL DEFAULT '',
  mail_webhook    TEXT    NOT NULL DEFAULT '',
  created_at      TEXT    NOT NULL,
  last_login_at   TEXT
);

CREATE TABLE IF NOT EXISTS students (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id        INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  email             TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  name              TEXT    NOT NULL,
  student_no        TEXT    NOT NULL DEFAULT '',
  password_hash     TEXT    NOT NULL,
  -- 老师要能把密码发给学生，因此保留一份明文；学生自行改密后即清空，老师只能重置。
  initial_password  TEXT    NOT NULL DEFAULT '',
  created_at        TEXT    NOT NULL,
  last_login_at     TEXT
);

CREATE TABLE IF NOT EXISTS homeworks (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id       INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  title            TEXT    NOT NULL,
  subject          TEXT    NOT NULL DEFAULT '',
  description      TEXT    NOT NULL DEFAULT '',
  due_at           TEXT    NOT NULL DEFAULT '',
  -- online = 在线作答   upload = 网上提交文件   notice = 只留作业不提交
  mode             TEXT    NOT NULL DEFAULT 'online',
  -- all = 发给全班   selected = 只发给 homework_targets 里指定的学生
  target_mode      TEXT    NOT NULL DEFAULT 'all',
  -- 截止时间过后是否仍允许提交
  allow_late       INTEGER NOT NULL DEFAULT 0,
  attachment_id    TEXT    NOT NULL DEFAULT '',
  attachment_name  TEXT    NOT NULL DEFAULT '',
  created_at       TEXT    NOT NULL
);

-- 定向派发：一份作业可以只指派给部分学生（留空 = 全班）
CREATE TABLE IF NOT EXISTS homework_targets (
  homework_id  INTEGER NOT NULL REFERENCES homeworks(id) ON DELETE CASCADE,
  student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  PRIMARY KEY (homework_id, student_id)
);

-- 学生站内消息：新作业、批改完成、新成绩都会推送
CREATE TABLE IF NOT EXISTS student_notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  kind        TEXT    NOT NULL,
  title       TEXT    NOT NULL,
  body        TEXT    NOT NULL DEFAULT '',
  is_read     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL
);

-- 老师忘记密码：一次性重置码，只存哈希，15 分钟有效
CREATE TABLE IF NOT EXISTS password_resets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  code_hash   TEXT    NOT NULL,
  expires_at  TEXT    NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  homework_id   INTEGER NOT NULL REFERENCES homeworks(id) ON DELETE CASCADE,
  student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  content       TEXT    NOT NULL DEFAULT '',
  file_id       TEXT    NOT NULL DEFAULT '',
  file_name     TEXT    NOT NULL DEFAULT '',
  -- submitted = 已提交   acked = 已知悉   reviewed = 已批改
  status        TEXT    NOT NULL DEFAULT 'submitted',
  score         TEXT    NOT NULL DEFAULT '',
  comment       TEXT    NOT NULL DEFAULT '',
  submitted_at  TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL,
  UNIQUE(homework_id, student_id)
);

CREATE TABLE IF NOT EXISTS scores (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id     INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  student_id     INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  exam_name      TEXT    NOT NULL,
  subject        TEXT    NOT NULL DEFAULT '',
  score          REAL    NOT NULL,
  full_score     REAL    NOT NULL DEFAULT 100,
  remark         TEXT    NOT NULL DEFAULT '',
  -- direct = 直接发到学生账号，登录即见   locked = 需输入成绩代号 + 密码解锁
  mode           TEXT    NOT NULL DEFAULT 'direct',
  view_code      TEXT    NOT NULL DEFAULT '',
  view_password  TEXT    NOT NULL DEFAULT '',
  view_hash      TEXT    NOT NULL DEFAULT '',
  created_at     TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  kind        TEXT    NOT NULL,
  title       TEXT    NOT NULL,
  body        TEXT    NOT NULL DEFAULT '',
  is_read     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
  id             TEXT    PRIMARY KEY,
  owner_role     TEXT    NOT NULL,
  owner_id       INTEGER NOT NULL,
  original_name  TEXT    NOT NULL,
  stored_name    TEXT    NOT NULL,
  size           INTEGER NOT NULL,
  created_at     TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_students_teacher    ON students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_homeworks_teacher   ON homeworks(teacher_id);
CREATE INDEX IF NOT EXISTS idx_submissions_hw      ON submissions(homework_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_scores_student      ON scores(student_id);
CREATE INDEX IF NOT EXISTS idx_scores_code         ON scores(view_code);
CREATE INDEX IF NOT EXISTS idx_notifications_t     ON notifications(teacher_id, is_read);
CREATE INDEX IF NOT EXISTS idx_targets_hw           ON homework_targets(homework_id);
CREATE INDEX IF NOT EXISTS idx_targets_student      ON homework_targets(student_id);
CREATE INDEX IF NOT EXISTS idx_student_notes        ON student_notifications(student_id, is_read);
CREATE INDEX IF NOT EXISTS idx_resets_teacher       ON password_resets(teacher_id, used);
