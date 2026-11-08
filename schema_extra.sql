-- 启课 · 扩展功能表（由 init_db 在 schema.sql 之后执行，全部 IF NOT EXISTS）
-- 约定：features/mod_*.py 只使用这里定义的表与列，不自行建表/加列。

-- ---------------------------------------------------------------- 班级与组织
CREATE TABLE IF NOT EXISTS classes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  grade       TEXT    NOT NULL DEFAULT '',
  school      TEXT    NOT NULL DEFAULT '',
  join_code   TEXT    NOT NULL DEFAULT '',
  archived    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL
);
CREATE TABLE IF NOT EXISTS class_staff (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id    INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  role        TEXT    NOT NULL DEFAULT 'subject',   -- owner | subject
  subject     TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL,
  UNIQUE(class_id, teacher_id)
);
CREATE TABLE IF NOT EXISTS join_requests (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id       INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_email  TEXT    NOT NULL,
  student_name   TEXT    NOT NULL DEFAULT '',
  status         TEXT    NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  created_at     TEXT    NOT NULL
);
CREATE TABLE IF NOT EXISTS student_groups (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id    INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  created_at  TEXT    NOT NULL
);
CREATE TABLE IF NOT EXISTS student_group_members (
  group_id    INTEGER NOT NULL REFERENCES student_groups(id) ON DELETE CASCADE,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  is_leader   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(group_id, student_id)
);

-- ---------------------------------------------------------------- 模板 / 批量
CREATE TABLE IF NOT EXISTS exam_templates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  subject     TEXT    NOT NULL DEFAULT '',
  full_score  REAL    NOT NULL DEFAULT 100,
  created_at  TEXT    NOT NULL
);
CREATE TABLE IF NOT EXISTS homework_templates (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id   INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  title        TEXT    NOT NULL,
  subject      TEXT    NOT NULL DEFAULT '',
  description  TEXT    NOT NULL DEFAULT '',
  mode         TEXT    NOT NULL DEFAULT 'online',
  allow_late   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL
);

-- ---------------------------------------------------------------- 作业 / 题库 / 提交
CREATE TABLE IF NOT EXISTS quiz_questions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  homework_id INTEGER NOT NULL REFERENCES homeworks(id) ON DELETE CASCADE,
  qtype       TEXT    NOT NULL DEFAULT 'single',  -- single | multi | judge | blank
  title       TEXT    NOT NULL,
  options     TEXT    NOT NULL DEFAULT '[]',      -- JSON 数组
  answer      TEXT    NOT NULL DEFAULT '',
  score       REAL    NOT NULL DEFAULT 0,
  sort_no     INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS quiz_answers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  homework_id INTEGER NOT NULL REFERENCES homeworks(id) ON DELETE CASCADE,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  answers     TEXT    NOT NULL DEFAULT '{}',
  auto_score  REAL    NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL,
  UNIQUE(homework_id, student_id)
);
CREATE TABLE IF NOT EXISTS submission_versions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  content       TEXT    NOT NULL DEFAULT '',
  file_id       TEXT    NOT NULL DEFAULT '',
  file_name     TEXT    NOT NULL DEFAULT '',
  created_at    TEXT    NOT NULL
);
CREATE TABLE IF NOT EXISTS submission_files (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  file_id       TEXT    NOT NULL,
  file_name     TEXT    NOT NULL DEFAULT '',
  created_at    TEXT    NOT NULL
);
CREATE TABLE IF NOT EXISTS annotations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  teacher_id    INTEGER NOT NULL,
  file_id       TEXT    NOT NULL DEFAULT '',
  pos_x         REAL    NOT NULL DEFAULT 0,
  pos_y         REAL    NOT NULL DEFAULT 0,
  text          TEXT    NOT NULL DEFAULT '',
  created_at    TEXT    NOT NULL
);
CREATE TABLE IF NOT EXISTS peer_reviews (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  reviewer_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  score         REAL    NOT NULL DEFAULT 0,
  comment       TEXT    NOT NULL DEFAULT '',
  anonymous     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL
);
CREATE TABLE IF NOT EXISTS leave_requests (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  homework_id INTEGER NOT NULL REFERENCES homeworks(id) ON DELETE CASCADE,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  reason      TEXT    NOT NULL DEFAULT '',
  status      TEXT    NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  created_at  TEXT    NOT NULL
);
CREATE TABLE IF NOT EXISTS homework_tags (
  homework_id INTEGER NOT NULL REFERENCES homeworks(id) ON DELETE CASCADE,
  tag         TEXT    NOT NULL,
  PRIMARY KEY(homework_id, tag)
);

-- ---------------------------------------------------------------- 成绩 / 家长 / 设置
CREATE TABLE IF NOT EXISTS score_edits (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  score_id    INTEGER NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
  teacher_id  INTEGER NOT NULL,
  old_score   REAL,
  new_score   REAL,
  reason      TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL
);
CREATE TABLE IF NOT EXISTS parent_links (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  token       TEXT    NOT NULL UNIQUE,
  expires_at  TEXT    NOT NULL DEFAULT '',
  revoked     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL
);
CREATE TABLE IF NOT EXISTS teacher_settings (
  teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  key         TEXT    NOT NULL,
  value       TEXT    NOT NULL DEFAULT '',
  PRIMARY KEY(teacher_id, key)
);
CREATE TABLE IF NOT EXISTS student_settings (
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  key         TEXT    NOT NULL,
  value       TEXT    NOT NULL DEFAULT '',
  PRIMARY KEY(student_id, key)
);
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

-- ---------------------------------------------------------------- 通知 / 沟通
CREATE TABLE IF NOT EXISTS announcements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  body        TEXT    NOT NULL DEFAULT '',
  pinned      INTEGER NOT NULL DEFAULT 0,
  expires_at  TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  direction   TEXT    NOT NULL DEFAULT 'to_teacher',
  body        TEXT    NOT NULL DEFAULT '',
  reply_to    INTEGER NOT NULL DEFAULT 0,
  is_read     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL
);
CREATE TABLE IF NOT EXISTS reminder_log (
  homework_id INTEGER NOT NULL REFERENCES homeworks(id) ON DELETE CASCADE,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  kind        TEXT    NOT NULL,
  PRIMARY KEY(homework_id, student_id, kind)
);

-- ---------------------------------------------------------------- 运维 / 安全
CREATE TABLE IF NOT EXISTS audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_role  TEXT    NOT NULL DEFAULT '',
  actor_id    INTEGER NOT NULL DEFAULT 0,
  action      TEXT    NOT NULL,
  detail      TEXT    NOT NULL DEFAULT '',
  ip          TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL
);
CREATE TABLE IF NOT EXISTS login_devices (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  token       TEXT    NOT NULL UNIQUE,
  ua          TEXT    NOT NULL DEFAULT '',
  ip          TEXT    NOT NULL DEFAULT '',
  last_seen   TEXT    NOT NULL,
  created_at  TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_classes_teacher   ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_quiz_hw           ON quiz_questions(homework_id);
CREATE INDEX IF NOT EXISTS idx_versions_sub      ON submission_versions(submission_id);
CREATE INDEX IF NOT EXISTS idx_parent_token      ON parent_links(token);
CREATE INDEX IF NOT EXISTS idx_audit_time        ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_student  ON messages(student_id, is_read);
CREATE INDEX IF NOT EXISTS idx_homework_tags_tag ON homework_tags(tag);

-- v4 查询优化：覆盖工作台/批改/成绩列表/截止扫描的常用过滤
CREATE INDEX IF NOT EXISTS idx_scores_teacher     ON scores(teacher_id, exam_name);
CREATE INDEX IF NOT EXISTS idx_submissions_hw2    ON submissions(homework_id, status);
CREATE INDEX IF NOT EXISTS idx_homeworks_due      ON homeworks(teacher_id, due_at);
CREATE INDEX IF NOT EXISTS idx_students_class     ON students(teacher_id, class_id);
CREATE INDEX IF NOT EXISTS idx_announcements_t    ON announcements(teacher_id, pinned);
