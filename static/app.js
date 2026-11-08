/* 启课 · 前端逻辑（原生 JS，无构建步骤） */
(function () {
  'use strict';

  /* ---------------------------------------------------------- 图标 */
  const ICONS = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 16l4-5 3 3 5-7"/>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    refresh: '<path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 8.2-8.2 2 2-2 2 2 2-3 3-2-2-2 2"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2z"/>',
    school: '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="M5 11v6c0 1.5 3.1 3 7 3s7-1.5 7-3v-6"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.4 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.4-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.8 1.1z"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    send: '<path d="m22 2-7 20-4-9-9-4 20-7z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    sparkle: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  };
  function icon(name, size) {
    return '<svg class="ic" width="' + (size || 18) + '" height="' + (size || 18) +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>';
  }

  /* ---------------------------------------------------------- 状态 & 工具 */
  const S = { csrf: '', user: null, profile: null, page: 'overview', unread: 0,
              hwCache: [], scoreCache: [], studentCache: [] };
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const attr = esc;

  async function api(path, method, data) {
    method = method || 'GET';
    const opt = { method: method, headers: {} };
    if (data !== undefined && data !== null) {
      opt.headers['Content-Type'] = 'application/json';
      opt.body = JSON.stringify(data);
    }
    if (method !== 'GET') opt.headers['X-CSRF-Token'] = S.csrf;
    const res = await fetch(path, opt);
    let j;
    try { j = await res.json(); } catch (e) { throw new Error('服务器返回异常 (' + res.status + ')'); }
    if (!res.ok || j.error) throw new Error(j.error || ('请求失败 (' + res.status + ')'));
    return j;
  }

  async function upload(file) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', {
      method: 'POST', headers: { 'X-CSRF-Token': S.csrf }, body: fd,
    });
    let j;
    try { j = await res.json(); } catch (e) { throw new Error('上传失败'); }
    if (!res.ok || j.error) throw new Error(j.error || '上传失败');
    return j.file;
  }

  let toastTimer = null;
  function toast(msg, kind) {
    const el = $('#toast');
    el.textContent = msg;
    el.className = 'toast show' + (kind === 'err' ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast'; }, 2800);
  }
  function fail(e) { toast(e && e.message ? e.message : '操作失败', 'err'); }

  function copyText(text) {
    const done = () => toast('已复制到剪贴板');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallback());
    } else fallback();
    function fallback() {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败，请手动选中', 'err'); }
      ta.remove();
    }
  }
  const fmtSize = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  const fmtTime = (s) => (s || '').replace('T', ' ');
  const MODE = { online: '在线作答', upload: '网上提交', notice: '只留不交' };
  const MODE_BADGE = { online: 'blue', upload: 'violet', notice: 'gray' };
  const initials = (s) => (s || '?').trim().slice(0, 1).toUpperCase();

  function empty(msg, action) {
    return '<div class="empty"><div class="big">' + icon('inbox', 26) + '</div><p>' + esc(msg) +
      '</p>' + (action || '') + '</div>';
  }
  function setLoading() {
    $('#pageContent').innerHTML = '<div class="loading"><div class="spinner"></div>正在加载…</div>';
  }

  /* ---------------------------------------------------------- 弹窗 */
  function openModal(o) {
    closeModal();
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML =
      '<div class="modal ' + (o.wide ? 'wide' : '') + '">' +
        '<div class="modal-head"><h3>' + esc(o.title || '') + '</h3>' +
        '<button class="modal-x" data-act="closeModal" type="button">' + icon('x', 16) + '</button></div>' +
        '<div class="modal-body">' + (o.body || '') + '</div>' +
        (o.foot ? '<div class="modal-foot">' + o.foot + '</div>' : '') +
      '</div>';
    mask.addEventListener('click', (e) => { if (e.target === mask) closeModal(); });
    $('#modalRoot').appendChild(mask);
    return mask;
  }
  function closeModal() { $('#modalRoot').innerHTML = ''; }
  function confirmModal(title, text, onYes) {
    openModal({
      title: title,
      body: '<div class="note">' + esc(text) + '</div>',
      foot: '<button class="btn ghost" data-act="closeModal" type="button">取消</button>' +
            '<button class="btn danger" id="confirmYes" type="button">确认删除</button>',
    });
    $('#confirmYes').addEventListener('click', async () => {
      try { await onYes(); closeModal(); } catch (e) { fail(e); }
    });
  }

  /* ---------------------------------------------------------- 开场动画 */
  function initSplash() {
    const el = $('#splash');
    if (!el) return;
    const played = sessionStorage.getItem('qike_splash') === '1';
    if (played) { el.remove(); return; }
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      sessionStorage.setItem('qike_splash', '1');
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 560);
    };
    const timer = setTimeout(finish, 2950);
    $('#skipSplash').addEventListener('click', () => { clearTimeout(timer); finish(); });
  }

  /* ---------------------------------------------------------- 导航定义 */
  const NAV = {
    teacher: [
      { id: 'overview', label: '工作台', icon: 'grid', title: '工作台' },
      { id: 'students', label: '学生管理', icon: 'users', title: '学生管理' },
      { id: 'homeworks', label: '作业管理', icon: 'book', title: '作业管理' },
      { id: 'scores', label: '成绩管理', icon: 'chart', title: '成绩管理' },
      { id: 'analytics', label: '成绩分析', icon: 'sparkle', title: '成绩分析' },
      { id: 'notices', label: '通知中心', icon: 'bell', title: '通知中心' },
      { id: 'settings', label: '设置', icon: 'gear', title: '账号与班级设置' },
    ],
    student: [
      { id: 'overview', label: '我的首页', icon: 'grid', title: '我的首页' },
      { id: 'homeworks', label: '我的作业', icon: 'book', title: '我的作业' },
      { id: 'scores', label: '我的成绩', icon: 'chart', title: '我的成绩' },
      { id: 'notices', label: '消息通知', icon: 'bell', title: '消息通知' },
      { id: 'settings', label: '账号设置', icon: 'gear', title: '账号设置' },
    ],
  };

  /* ---------------------------------------------------------- 认证视图 */
  function renderAuth(mode, role) {
    mode = mode || 'login'; role = role || 'teacher';
    const card = $('#authCard');
    if (mode === 'register') {
      card.innerHTML =
        '<h2>创建老师账号</h2><p class="sub">只需邮箱 + 重要通知手机号，学校信息可以之后再补。</p>' +
        '<form id="fRegister">' +
          '<div class="form-grid">' +
            '<div class="field"><label>姓名 *</label><input class="input" name="name" required placeholder="例如：王老师"></div>' +
            '<div class="field"><label>重要通知手机号 *</label><input class="input" name="phone" required inputmode="numeric" maxlength="11" placeholder="11 位手机号"></div>' +
            '<div class="field full"><label>邮箱 *</label><input class="input" name="email" type="email" required placeholder="teacher@example.com"></div>' +
            '<div class="field full"><label>登录密码 *</label><input class="input" name="password" type="password" required minlength="8" placeholder="至少 8 位"><div class="hint">密码以加密哈希保存，不会明文存储。</div></div>' +
            '<div class="field"><label>学校</label><input class="input" name="school" placeholder="选填"></div>' +
            '<div class="field"><label>年级 / 班级</label><input class="input" name="class_name" placeholder="例如：高三（2）班"></div>' +
          '</div>' +
          '<button class="btn primary block" type="submit">注册并进入工作台</button>' +
        '</form>' +
        '<div class="mt16 tiny" style="text-align:center">已有账号？<span class="auth-link" data-act="gotoLogin">返回登录</span></div>';
    } else {
      card.innerHTML =
        '<div class="tabs">' +
          '<button type="button" data-act="loginTab" data-role="teacher" class="' + (role === 'teacher' ? 'active' : '') + '">我是老师</button>' +
          '<button type="button" data-act="loginTab" data-role="student" class="' + (role === 'student' ? 'active' : '') + '">我是学生</button>' +
        '</div>' +
        '<h2>欢迎回来</h2>' +
        '<p class="sub">' + (role === 'teacher'
          ? '用注册时的邮箱登录，继续管理你的班级。'
          : '用老师发给你的邮箱和密码登录，无需注册、无需手机号。') + '</p>' +
        '<form id="fLogin">' +
          '<input type="hidden" name="role" value="' + role + '">' +
          '<div class="field"><label>邮箱</label><input class="input" name="email" type="email" required placeholder="name@example.com" autocomplete="username"></div>' +
          '<div class="field"><label>密码</label><input class="input" name="password" type="password" required placeholder="请输入密码" autocomplete="current-password"></div>' +
          (role === 'teacher'
            ? '<div class="field"><label>两步验证码（已启用才需要）</label><input class="input" name="totp" inputmode="numeric" maxlength="6" placeholder="未启用请留空" autocomplete="one-time-code"></div>'
            : '') +
          '<button class="btn primary block" type="submit">登录</button>' +
        '</form>' +
        '<div class="mt16 tiny" style="text-align:center">还没有老师账号？<span class="auth-link" data-act="gotoRegister">用邮箱注册</span></div>' +
        (role === 'teacher'
          ? '<div class="tiny" style="text-align:center;margin-top:8px"><span class="auth-link" data-act="forgotPwd">忘记密码？</span></div>'
          : '');
    }
  }

  function modalForgot(step, email) {
    if (step === 2) {
      openModal({
        title: '输入重置码并设置新密码',
        body: '<form id="fReset">' +
          '<input type="hidden" name="email" value="' + attr(email) + '">' +
          '<div class="note blue mb16">重置码已发送到 ' + esc(email) + '，15 分钟内有效。</div>' +
          '<div class="field"><label>6 位重置码</label><input class="input mono" name="code" required maxlength="6" inputmode="numeric" placeholder="例如 483920"></div>' +
          '<div class="field"><label>新密码（至少 8 位）</label><input class="input" name="new_password" type="password" required minlength="8"></div>' +
          '</form>',
        foot: '<button class="btn ghost" data-act="closeModal" type="button">取消</button>' +
              '<button class="btn primary" type="submit" form="fReset">重置并登录</button>',
      });
      return;
    }
    openModal({
      title: '找回老师账号密码',
      body: '<form id="fForgot">' +
        '<div class="field"><label>注册邮箱</label><input class="input" name="email" type="email" required placeholder="teacher@example.com"></div>' +
        '</form>' +
        '<div class="note mt16">' + icon('mail', 15) +
        ' 系统会向该邮箱发送一次性重置码，需要在「设置 → 邮件 Webhook」里配置邮件网关。若尚未配置，请在服务器上运行 <code>python reset_teacher.py 你的邮箱</code> 重置。</div>',
      foot: '<button class="btn ghost" data-act="closeModal" type="button">取消</button>' +
            '<button class="btn primary" type="submit" form="fForgot">发送重置码</button>',
    });
  }

  /* ---------------------------------------------------------- 应用骨架 */
  function renderShell() {
    const u = S.user, p = S.profile || {};
    const cls = u.role === 'teacher'
      ? ([p.school, p.grade, p.class_name].filter(Boolean).join(' · ') || '未填写班级信息')
      : ([p.school, p.class_name].filter(Boolean).join(' · ') || '我的班级');
    const sub = u.role === 'teacher'
      ? ((p.name || '') + ' · 老师')
      : ((p.teacher_name || '') + ' 老师 · ' + (p.student_no || '学生'));
    $('#sideClass').innerHTML = '<div class="t">' + esc(cls) + '</div><div class="s">' + esc(sub) + '</div>';
    const items = NAV[u.role];
    const navHtml = (mobile) => items.map((n) =>
      '<button type="button" data-act="nav" data-page="' + n.id + '" class="' + (S.page === n.id ? 'active' : '') + '">' +
        icon(n.icon, mobile ? 19 : 18) + '<span>' + esc(n.label) + '</span>' +
        (n.id === 'notices' && S.unread && !mobile ? '<span class="ncount">' + S.unread + '</span>' : '') +
      '</button>').join('');
    $('#sideNav').innerHTML = navHtml(false);
    $('#mobileNav').innerHTML = navHtml(true);
    $('#userChip').innerHTML =
      '<div class="avatar">' + esc(initials(u.name)) + '</div>' +
      '<div><div class="nm">' + esc(u.name) + '</div><div class="rl">' +
      (u.role === 'teacher' ? '老师' : '学生') + '</div></div>';
    const rf = $('[data-act="refresh"]');
    if (rf) rf.innerHTML = icon('refresh', 17);
    const bell = $('[data-act="gotoNotices"]');
    if (bell) {
      bell.innerHTML = icon('bell', 18) +
        (S.unread ? '<span class="bell-dot">' + (S.unread > 9 ? '9+' : S.unread) + '</span>' : '');
      bell.title = S.unread ? S.unread + ' 条未读消息' : '消息通知';
    }
  }

  async function go(page) {
    const items = NAV[S.user.role];
    const nav = items.find((n) => n.id === page) || items[0];
    S.page = nav.id;
    $('#crumb').textContent = S.user.role === 'teacher' ? '老师端 / ' + nav.label : '学生端 / ' + nav.label;
    $('#pageTitle').textContent = nav.title;
    $$('[data-act="nav"]').forEach((b) => b.classList.toggle('active', b.dataset.page === S.page));
    setLoading();
    try {
      const key = S.user.role + ':' + S.page;
      $('#pageContent').innerHTML = await PAGES[key]();
      if (S.page === 'notices' && S.unread) {
        S.unread = 0; renderShell();
        api((S.user.role === 'teacher' ? '/api/teacher' : '/api/student') +
            '/notifications/read', 'POST').catch(() => {});
      }
    } catch (e) {
      $('#pageContent').innerHTML = '<div class="card">' +
        empty(e.message, '<button class="btn soft" data-act="refresh" type="button">重新加载</button>') + '</div>';
      fail(e);
    }
  }

  async function boot() {
    try {
      const d = await api('/api/bootstrap');
      S.csrf = d.csrf; S.user = d.user; S.profile = d.profile;
      if (S.user) {
        $('#authView').classList.add('hidden');
        $('#appView').classList.remove('hidden');
        const ov = await api(S.user.role === 'teacher' ? '/api/teacher/overview' : '/api/student/overview')
          .catch(() => ({}));
        S.unread = ov.unread || 0;
        renderShell();
        await go('overview');
      } else {
        $('#appView').classList.add('hidden');
        $('#authView').classList.remove('hidden');
        renderAuth();
      }
    } catch (e) { toast('初始化失败：' + e.message, 'err'); }
  }

  /* ============================================================ 老师页面 */
  function statCard(num, label, ic, color) {
    return '<div class="stat"><div class="stat-ic ' + (color || '') + '">' + icon(ic, 19) +
      '</div><div class="num">' + esc(num) + '</div><div class="label">' + esc(label) + '</div></div>';
  }

  async function pageTeacherOverview() {
    const [o, h] = await Promise.all([api('/api/teacher/overview'), api('/api/teacher/homeworks')]);
    S.unread = o.unread;
    const recent = h.homeworks.slice(0, 5);
    let list;
    if (!recent.length) {
      list = empty('还没有发布作业，去布置第一份吧。',
        '<button class="btn primary" data-act="addHomework" type="button">' + icon('plus', 15) + ' 发布作业</button>');
    } else {
      list = '<div class="table-wrap"><table class="tbl"><thead><tr><th>作业</th><th>提交方式</th><th>截止</th><th>提交进度</th><th></th></tr></thead><tbody>' +
        recent.map((w) => {
          const pct = w.total_students ? Math.round(w.submitted_count / w.total_students * 100) : 0;
          return '<tr><td><strong>' + esc(w.title) + '</strong><div class="tiny">' + esc(w.subject || '未设科目') +
            ' · ' + (w.target_mode === 'selected' ? '指定 ' + w.total_students + ' 人' : '全班') + '</div></td>' +
            '<td><span class="badge ' + MODE_BADGE[w.mode] + '">' + MODE[w.mode] + '</span></td>' +
            '<td class="tiny">' + (w.due_at && w.overdue ? '<span class="badge red">已截止</span> ' : '') +
            esc(w.due_at ? fmtTime(w.due_at) : '不限时') + '</td>' +
            '<td style="min-width:130px"><div class="progress"><i style="width:' + pct + '%"></i></div>' +
            '<div class="tiny mt8">' + w.submitted_count + ' / ' + w.total_students + ' 人</div></td>' +
            '<td style="text-align:right"><button class="btn soft sm" data-act="viewSubmissions" data-id="' + w.id + '" type="button">查看提交</button></td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    return '<div class="stat-grid">' +
        statCard(o.students, '本班学生', 'users', '') +
        statCard(o.homeworks, '已发布作业', 'book', 'g') +
        statCard(o.pending, '待批改提交', 'inbox', 'a') +
        statCard(o.scores, '成绩记录', 'chart', 's') +
      '</div>' +
      '<div class="card"><div class="section-head"><div><h3>最近发布的作业</h3>' +
        '<div class="desc">共 ' + h.homeworks.length + ' 条 · 点击「查看提交」可批改</div></div>' +
        '<button class="btn soft sm" data-act="nav" data-page="homeworks" type="button">管理作业 ' + icon('arrow', 14) + '</button></div>' +
        list + '</div>' +
      '<div class="card"><div class="section-head"><h3>快捷操作</h3></div><div class="row wrap">' +
        '<button class="btn primary" data-act="addStudent" type="button">' + icon('plus', 15) + ' 添加学生</button>' +
        '<button class="btn soft" data-act="addHomework" type="button">' + icon('book', 15) + ' 发布作业</button>' +
        '<button class="btn green" data-act="addScore" type="button">' + icon('chart', 15) + ' 发布成绩</button>' +
        '<button class="btn ghost" data-act="exportStudents" type="button">' + icon('download', 15) + ' 导出账号密码表</button>' +
        '<button class="btn ghost" data-act="nav" data-page="analytics" type="button">' + icon('sparkle', 15) + ' 看成绩分析</button>' +
      '</div></div>';
  }

  async function pageStudents() {
    const d = await api('/api/teacher/students');
    const list = d.students;
    let table;
    if (!list.length) {
      table = empty('还没有学生。添加学生后系统会自动生成登录密码，把它发给学生即可。',
        '<button class="btn primary" data-act="addStudent" type="button">' + icon('plus', 15) + ' 添加第一位学生</button>');
    } else {
      table = '<div class="table-wrap"><table class="tbl"><thead><tr><th>姓名</th><th>学号</th><th>邮箱</th><th>登录密码</th><th>最近登录</th><th style="text-align:right">操作</th></tr></thead><tbody>' +
        list.map((s) =>
          '<tr><td><div class="row"><span class="avatar" style="width:28px;height:28px;font-size:12px;border-radius:8px">' + esc(initials(s.name)) +
            '</span><strong>' + esc(s.name) + '</strong></div></td>' +
            '<td class="tiny">' + esc(s.student_no || '—') + '</td>' +
            '<td>' + esc(s.email) + '</td>' +
            '<td><span class="mono" style="color:' + (s.initial_password ? 'var(--blue-dark)' : 'var(--ink3)') + '">' +
              (s.initial_password ? esc(s.initial_password) : '已自行修改') + '</span></td>' +
            '<td class="tiny">' + esc(s.last_login_at || '未登录') + '</td>' +
            '<td><div class="acts">' +
              '<button class="btn soft sm" data-act="copyStudent" data-id="' + s.id + '" type="button">' + icon('copy', 13) + ' 复制凭据</button>' +
              '<button class="btn ghost sm" data-act="resetPwd" data-id="' + s.id + '" type="button">重置</button>' +
              '<button class="btn danger sm" data-act="delStudent" data-id="' + s.id + '" type="button">删除</button>' +
            '</div></td></tr>').join('') + '</tbody></table></div>';
    }
    S.studentCache = list;
    return '<div class="card"><div class="section-head"><div><h3>学生名单</h3>' +
      '<div class="desc">共 ' + list.length + ' 人 · 「邮箱 + 密码」就是要发给学生的登录凭据</div></div>' +
      '<div class="row wrap">' +
        '<button class="btn ghost sm" data-act="batchStudents" type="button">批量导入</button>' +
        '<button class="btn ghost sm" data-act="exportStudents" type="button">' + icon('download', 14) + ' 导出 CSV</button>' +
        '<button class="btn primary sm" data-act="addStudent" type="button">' + icon('plus', 14) + ' 添加学生</button>' +
      '</div></div>' + table + '</div>' +
      '<div class="card"><div class="note blue">' + icon('shield', 15) +
      ' 学生无需注册、无需手机号：老师在这里创建账号并生成密码，学生在登录页选择「我是学生」，用这个邮箱和密码登录即可。学生自行改密后，密码不再对老师可见，老师可重置。</div></div>';
  }

  async function pageHomeworks() {
    const d = await api('/api/teacher/homeworks');
    S.hwCache = d.homeworks;
    const cards = d.homeworks.length ? '<div class="hw-grid">' + d.homeworks.map((w) => {
      const pct = w.total_students ? Math.round(w.submitted_count / w.total_students * 100) : 0;
      return '<div class="hw-card">' +
        '<div class="row spread"><span class="badge ' + MODE_BADGE[w.mode] + '">' + MODE[w.mode] + '</span>' +
        '<span class="tiny">' + esc(w.created_at) + '</span></div>' +
        '<div class="ttl">' + esc(w.title) + '</div>' +
        '<div class="desc">' + esc(w.description || w.subject || '老师未填写说明') + '</div>' +
        '<div class="meta">' + icon('clock', 13) + ' ' + esc(w.due_at ? '截止 ' + fmtTime(w.due_at) : '不限时') +
        (w.attachment_name ? ' · ' + icon('file', 13) + ' ' + esc(w.attachment_name) : '') + '</div>' +
        '<div class="row wrap" style="gap:6px;margin:10px 0">' +
          '<span class="chip">' + icon('users', 13) + ' ' +
            (w.target_mode === 'selected'
              ? '指定 ' + w.total_students + ' 人' + (w.target_names.length ? '：' + esc(w.target_names.slice(0, 3).join('、') + (w.target_names.length > 3 ? '…' : '')) : '')
              : '全班 ' + w.class_size + ' 人') + '</span>' +
          (w.overdue ? '<span class="badge red">已截止</span>' : '') +
          (w.allow_late ? '<span class="chip">允许补交</span>' : '') +
        '</div>' +
        '<div class="progress"><i style="width:' + pct + '%"></i></div>' +
        '<div class="tiny">' + w.submitted_count + ' / ' + w.total_students + ' 人已提交 · ' + w.reviewed_count + ' 份已批改</div>' +
        '<div class="foot"><button class="btn soft sm" data-act="viewSubmissions" data-id="' + w.id + '" type="button">查看提交与批改</button>' +
        '<button class="btn danger sm" data-act="delHomework" data-id="' + w.id + '" type="button">删除</button></div>' +
      '</div>';
    }).join('') + '</div>' : empty('还没有作业，点击右上角发布第一份。');
    return '<div class="section-head"><div><h3>全部作业</h3><div class="desc">共 ' + d.homeworks.length + ' 条</div></div>' +
      '<button class="btn primary" data-act="addHomework" type="button">' + icon('plus', 15) + ' 发布作业</button></div>' + cards;
  }

  async function pageScores() {
    const [d, stu] = await Promise.all([api('/api/teacher/scores'), api('/api/teacher/students')]);
    S.scoreCache = d.scores; S.studentCache = stu.students;
    let table;
    if (!d.scores.length) {
      table = empty('还没有成绩记录。',
        '<button class="btn primary" data-act="addScore" type="button">' + icon('plus', 15) + ' 发布第一条成绩</button>');
    } else {
      table = '<div class="table-wrap"><table class="tbl"><thead><tr><th>学生</th><th>考试 / 测验</th><th>科目</th><th>分数</th><th>发布方式</th><th>代号 / 密码</th><th>时间</th><th style="text-align:right">操作</th></tr></thead><tbody>' +
        d.scores.map((s) =>
          '<tr><td><strong>' + esc(s.student_name) + '</strong><div class="tiny">' + esc(s.student_email) + '</div></td>' +
          '<td>' + esc(s.exam_name) + '</td><td class="tiny">' + esc(s.subject || '—') + '</td>' +
          '<td><span class="score-num' + (s.score / s.full_score < .6 ? ' low' : '') + '">' + esc(s.score) +
            '</span><span class="tiny"> / ' + esc(s.full_score) + '</span></td>' +
          '<td>' + (s.mode === 'direct'
            ? '<span class="badge green">直接发送</span>'
            : '<span class="badge violet">' + icon('lock', 12) + ' 密码保护</span>') + '</td>' +
          '<td>' + (s.mode === 'locked'
            ? '<span class="mono tiny">' + esc(s.view_code) + '</span><br><span class="mono tiny">' + esc(s.view_password) + '</span>'
            : '<span class="tiny">登录即见</span>') + '</td>' +
          '<td class="tiny">' + esc(s.created_at) + '</td>' +
          '<td><div class="acts">' +
            (s.mode === 'locked' ? '<button class="btn soft sm" data-act="copyScore" data-id="' + s.id + '" type="button">' + icon('copy', 13) + ' 复制凭据</button>' : '') +
            '<button class="btn danger sm" data-act="delScore" data-id="' + s.id + '" type="button">删除</button>' +
          '</div></td></tr>').join('') + '</tbody></table></div>';
    }
    return '<div class="card"><div class="section-head"><div><h3>成绩记录</h3>' +
      '<div class="desc">共 ' + d.scores.length + ' 条 · 两种发布方式可混用</div></div>' +
      '<div class="row wrap">' +
        '<button class="btn ghost sm" data-act="exportScores" type="button">' + icon('download', 14) + ' 导出 CSV</button>' +
        '<button class="btn soft sm" data-act="nav" data-page="analytics" type="button">' + icon('sparkle', 14) + ' 成绩分析</button>' +
        '<button class="btn primary sm" data-act="addScore" type="button">' + icon('plus', 14) + ' 发布成绩</button>' +
      '</div></div>' + table + '</div>' +
      '<div class="card"><div class="note blue">' + icon('lock', 15) +
      ' 「直接发送」= 老师指定学生邮箱，学生登录就能看到；「密码保护」= 生成成绩代号 + 查看密码，老师把这两个发给学生，学生登录后输入才解锁。</div></div>';
  }

  async function pageNotices() {
    const d = await api('/api/teacher/notifications');
    const items = d.notifications;
    const body = items.length ? items.map((n) =>
      '<div class="notice-item ' + (n.is_read ? '' : 'unread') + '">' +
        '<div class="notice-ic">' + icon(n.kind === 'score' ? 'chart' : (n.kind === 'submission' ? 'inbox' : 'book'), 17) + '</div>' +
        '<div class="grow"><div class="tt">' + esc(n.title) + '</div><div class="bb">' + esc(n.body) + '</div></div>' +
        '<div class="tm">' + esc(n.created_at) + '</div></div>').join('')
      : empty('暂无通知。发布作业、收到提交、发布成绩时会自动记录。');
    return '<div class="card"><div class="section-head"><div><h3>通知中心</h3>' +
      '<div class="desc">站内消息 · 手机号：' + esc(S.profile && S.profile.phone ? S.profile.phone : '未绑定') + '</div></div>' +
      '<button class="btn soft sm" data-act="readNotices" type="button">全部标为已读</button></div>' + body + '</div>' +
      '<div class="card"><div class="note">' + icon('phone', 15) +
      ' 真实短信需要第三方短信服务商。设置页填写「短信 Webhook」后，成绩发布等重要通知会同时向该地址推送一条含手机号与内容的请求；不填则只保留站内通知，不影响任何功能。</div></div>';
  }

  async function pageAnalytics() {
    const d = await api('/api/teacher/analytics');
    if (!d.total) {
      return '<div class="card">' + empty('还没有成绩数据，发布成绩后这里会自动生成班级分析。',
        '<button class="btn primary" data-act="addScore" type="button">' + icon('plus', 15) + ' 发布第一条成绩</button>') + '</div>';
    }
    const peak = Math.max(1, ...d.distribution.map((x) => x.count));
    const bars = d.distribution.map((b, i) =>
      '<div class="dist-row"><div class="dist-label">' + esc(b.label) + '</div>' +
      '<div class="dist-track"><i class="b' + i + '" style="width:' +
        Math.round(b.count / peak * 100) + '%"></i></div>' +
      '<div class="dist-num">' + b.count + ' 人次</div></div>').join('');
    const examTable = '<div class="table-wrap"><table class="tbl"><thead><tr>' +
      '<th>考试 / 测验</th><th>科目</th><th>人数</th><th>平均</th><th>最高</th><th>最低</th><th>及格率</th><th>优秀率</th>' +
      '</tr></thead><tbody>' + d.exams.map((e) =>
        '<tr><td><strong>' + esc(e.exam_name) + '</strong></td><td class="tiny">' + esc(e.subject || '—') + '</td>' +
        '<td>' + e.count + '</td><td><span class="score-num">' + e.avg + '</span></td>' +
        '<td class="tiny">' + e.max + '</td><td class="tiny">' + e.min + '</td>' +
        '<td>' + e.pass_rate + '%</td><td>' + e.excellent_rate + '%</td></tr>').join('') +
      '</tbody></table></div>';
    const rankRows = d.ranking.map((r, i) =>
      '<tr><td><span class="rank-no' + (i < 3 ? ' top' : '') + '">' + (i + 1) + '</span></td>' +
      '<td><strong>' + esc(r.name) + '</strong><div class="tiny">' + esc(r.email) + '</div></td>' +
      '<td class="tiny">' + r.count + ' 条</td>' +
      '<td style="min-width:150px"><div class="progress"><i style="width:' + Math.min(100, r.avg) + '%"></i></div>' +
      '<div class="tiny mt8">' + r.avg + ' 分</div></td></tr>').join('');
    return '<div class="stat-grid">' +
        statCard(d.total, '成绩记录', 'chart', '') +
        statCard(d.avg, '平均得分率', 'sparkle', 'g') +
        statCard(d.pass_rate + '%', '及格率', 'check', 'a') +
        statCard(d.excellent_rate + '%', '优秀率（≥90）', 'inbox', 's') +
      '</div>' +
      '<div class="card"><div class="section-head"><div><h3>分数段分布</h3>' +
        '<div class="desc">已统一换算为百分制得分率，满分不同的考试也能一起比较</div></div>' +
        '<button class="btn ghost sm" data-act="exportScores" type="button">' + icon('download', 14) + ' 导出明细 CSV</button></div>' +
        bars + '</div>' +
      '<div class="card"><div class="section-head"><h3>各次考试汇总</h3></div>' + examTable + '</div>' +
      '<div class="card"><div class="section-head"><div><h3>学生平均分排行</h3>' +
        '<div class="desc">共 ' + d.student_count + ' 位学生 · 按平均得分率排序</div></div></div>' +
      '<div class="table-wrap"><table class="tbl"><thead><tr><th>名次</th><th>学生</th><th>记录数</th><th>平均得分率</th></tr></thead><tbody>' +
      rankRows + '</tbody></table></div></div>';
  }

  async function pageStudentNotices() {
    const d = await api('/api/student/notifications');
    const icons = { homework: 'book', review: 'edit', score: 'chart' };
    const body = d.notifications.length ? d.notifications.map((n) =>
      '<div class="notice-item ' + (n.is_read ? '' : 'unread') + '">' +
        '<div class="notice-ic">' + icon(icons[n.kind] || 'bell', 17) + '</div>' +
        '<div class="grow"><div class="tt">' + esc(n.title) + '</div><div class="bb">' + esc(n.body) + '</div></div>' +
        '<div class="tm">' + esc(n.created_at) + '</div></div>').join('')
      : empty('暂无消息。老师发布新作业、批改作业或发成绩时，这里会收到提醒。');
    return '<div class="card"><div class="section-head"><div><h3>消息通知</h3>' +
      '<div class="desc">' + (d.unread ? d.unread + ' 条未读 · ' : '') + '进入本页即自动标记已读</div></div>' +
      '<button class="btn soft sm" data-act="readNotices" type="button">全部标为已读</button></div>' + body + '</div>';
  }

  async function pageSettings() {
    const p = S.profile || {};
    return '<div class="card"><div class="section-head"><h3>学校与班级信息</h3></div>' +
      '<form id="fProfile"><div class="form-grid">' +
        '<div class="field"><label>姓名 *</label><input class="input" name="name" required value="' + attr(p.name || '') + '"></div>' +
        '<div class="field"><label>重要通知手机号 *</label><input class="input" name="phone" required maxlength="11" value="' + attr(p.phone || '') + '"></div>' +
        '<div class="field"><label>学校</label><input class="input" name="school" value="' + attr(p.school || '') + '"></div>' +
        '<div class="field"><label>年级</label><input class="input" name="grade" value="' + attr(p.grade || '') + '"></div>' +
        '<div class="field full"><label>班级名称</label><input class="input" name="class_name" value="' + attr(p.class_name || '') + '"></div>' +
        '<div class="field full"><label>短信 Webhook（选填）</label><input class="input" name="sms_webhook" placeholder="https://…" value="' + attr(p.sms_webhook || '') + '">' +
          '<div class="hint">填入你的短信网关地址后，重要通知会同时推送；留空则只记录站内通知。</div></div>' +
        '<div class="field full"><label>邮件 Webhook（选填，用于找回密码）</label><input class="input" name="mail_webhook" placeholder="https://…" value="' + attr(p.mail_webhook || '') + '">' +
          '<div class="hint">配置后，登录页「忘记密码」会向该网关投递一次性重置码（含邮箱与 6 位码）；留空时只能在服务器运行 python reset_teacher.py 重置。</div></div>' +
        '<div class="field full"><label class="row" style="cursor:pointer"><input type="checkbox" name="notify_enabled" ' + (p.notify_enabled ? 'checked' : '') + '> 开启重要通知</label></div>' +
      '</div><button class="btn primary" type="submit">保存资料</button></form></div>' +
      '<div class="card"><div class="section-head"><h3>修改登录密码</h3></div>' +
      '<form id="fPassword"><div class="form-grid">' +
        '<div class="field"><label>原密码</label><input class="input" name="old_password" type="password" required></div>' +
        '<div class="field"><label>新密码（至少 8 位）</label><input class="input" name="new_password" type="password" required minlength="8"></div>' +
      '</div><button class="btn soft" type="submit">更新密码</button></form></div>' +
      '<div class="card"><div class="section-head"><div><h3>数据与备份</h3>' +
        '<div class="desc">数据只保存在本机，建议定期下载留存</div></div></div>' +
      '<div class="row wrap">' +
        '<button class="btn soft" data-act="backupAll" type="button">' + icon('download', 15) + ' 下载完整备份（zip）</button>' +
        '<button class="btn ghost" data-act="exportScores" type="button">' + icon('download', 15) + ' 导出成绩 CSV</button>' +
        '<button class="btn ghost" data-act="exportStudents" type="button">' + icon('download', 15) + ' 导出账号密码表</button>' +
      '</div><div class="note blue mt16">' + icon('shield', 15) +
      ' 完整备份包含数据库一致性快照 + 全部作业附件；把 zip 里的 qike.db 放回 data/ 目录、uploads/ 放回项目根目录即可恢复。</div></div>';
  }

  /* ============================================================ 学生页面 */
  async function pageStudentOverview() {
    const [o, h, sc] = await Promise.all([
      api('/api/student/overview'), api('/api/student/homeworks'), api('/api/student/scores'),
    ]);
    S.hwCache = h.homeworks;
    const todo = h.homeworks.filter((w) => !w.submission_id).slice(0, 4);
    const list = todo.length ? todo.map((w) =>
      '<div class="notice-item"><div class="notice-ic">' + icon('book', 17) + '</div>' +
      '<div class="grow"><div class="tt">' + esc(w.title) + '</div><div class="bb">' +
      esc(MODE[w.mode]) + ' · ' + esc(w.subject || '未设科目') +
      (w.due_at ? ' · 截止 ' + esc(fmtTime(w.due_at)) : '') + '</div></div>' +
      '<button class="btn soft sm" data-act="openHomework" data-id="' + w.id + '" type="button">去完成</button></div>').join('')
      : empty('太好了，当前没有待办作业。');
    return '<div class="stat-grid">' +
        statCard(o.total, '班级作业', 'book', '') +
        statCard(o.done, '我的提交', 'check', 'g') +
        statCard(o.reviewed, '已批改', 'edit', 'a') +
        statCard(o.scores, '成绩记录', 'chart', 's') +
      '</div>' +
      '<div class="card"><div class="section-head"><div><h3>待办作业</h3>' +
        '<div class="desc">' + esc((S.profile && S.profile.school) || '') + ' · ' + esc((S.profile && S.profile.teacher_name) || '') + ' 老师</div></div>' +
        '<button class="btn soft sm" data-act="nav" data-page="homeworks" type="button">全部作业 ' + icon('arrow', 14) + '</button></div>' +
        list + '</div>' +
      '<div class="card"><div class="section-head"><h3>成绩速览</h3>' +
        '<button class="btn soft sm" data-act="nav" data-page="scores" type="button">查看成绩</button></div>' +
        '<div class="row wrap">' + (sc.scores.length
          ? sc.scores.slice(0, 4).map((s) => '<span class="chip">' + esc(s.exam_name) + ' <strong>' + esc(s.score) + '</strong> / ' + esc(s.full_score) + '</span>').join('')
          : '<span class="tiny">暂无可直接查看的成绩</span>') +
        (sc.locked_count ? '<span class="badge violet">' + icon('lock', 12) + ' ' + sc.locked_count + ' 条需用密码解锁</span>' : '') +
      '</div></div>';
  }

  async function pageStudentHomeworks() {
    const d = await api('/api/student/homeworks');
    S.hwCache = d.homeworks;
    const cards = d.homeworks.length ? '<div class="hw-grid">' + d.homeworks.map((w) => {
      const done = !!w.submission_id;
      const blocked = !w.can_submit && w.mode !== 'notice';
      return '<div class="hw-card">' +
        '<div class="row spread"><div class="row wrap" style="gap:6px">' +
          '<span class="badge ' + MODE_BADGE[w.mode] + '">' + MODE[w.mode] + '</span>' +
          (w.overdue ? '<span class="badge red">已截止</span>' : '') + '</div>' +
        (done ? '<span class="badge green">' + icon('check', 12) + (w.my_status === 'acked' ? ' 已知悉' : ' 已提交') + '</span>'
              : (w.overdue ? '<span class="badge gray">未提交</span>' : '<span class="badge amber">待完成</span>')) + '</div>' +
        '<div class="ttl">' + esc(w.title) + '</div>' +
        '<div class="desc">' + esc(w.description || w.subject || '老师未填写说明') + '</div>' +
        '<div class="meta">' + icon('clock', 13) + ' ' + esc(w.due_at ? '截止 ' + fmtTime(w.due_at) : '不限时') +
          (w.overdue ? (w.allow_late ? ' · 老师允许补交' : ' · 已停止提交') : '') + '</div>' +
        (w.comment ? '<div class="note blue">老师评语：' + esc(w.comment) + (w.score ? ' · 得分 ' + esc(w.score) : '') + '</div>' : '') +
        '<div class="foot"><span class="tiny">' + esc(w.created_at) + '</span>' +
        '<button class="btn ' + (done ? 'ghost' : (blocked ? 'soft' : 'primary')) + ' sm" data-act="openHomework" data-id="' + w.id + '" type="button">' +
          (done ? '查看 / 修改' : (blocked ? '查看详情' : '去完成')) + '</button></div></div>';
    }).join('') + '</div>' : empty('老师还没有发布作业。');
    return '<div class="section-head"><div><h3>我的作业</h3><div class="desc">共 ' + d.homeworks.length + ' 条</div></div></div>' + cards;
  }

  async function pageStudentScores() {
    const d = await api('/api/student/scores');
    const cards = d.scores.length ? '<div class="hw-grid">' + d.scores.map((s) =>
      '<div class="hw-card"><div class="row spread">' +
        '<span class="badge ' + (s.mode === 'locked' ? 'violet' : 'green') + '">' +
        (s.mode === 'locked' ? icon('lock', 12) + ' 已解锁' : '老师直发') + '</span>' +
        '<span class="tiny">' + esc(s.created_at) + '</span></div>' +
        '<div class="ttl">' + esc(s.exam_name) + '</div>' +
        '<div class="row spread"><div><div class="score-num' + (s.score / s.full_score < .6 ? ' low' : '') + '">' + esc(s.score) +
          '</div><div class="tiny">满分 ' + esc(s.full_score) + ' · ' + esc(s.subject || '未设科目') + '</div></div>' +
        '<div style="text-align:right"><div class="tiny">' + esc(s.remark || '') + '</div></div></div>' +
      '</div>').join('') + '</div>' : empty('暂无可直接查看的成绩。');
    const rate = (s) => s.full_score ? s.score / s.full_score * 100 : 0;
    const rates = d.scores.map(rate);
    const avgRate = rates.length ? (rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(1) : 0;
    const summary = '<div class="stat-grid">' +
        statCard(d.scores.length, '已查看成绩', 'chart', '') +
        statCard(avgRate, '平均得分率', 'sparkle', 'g') +
        statCard(rates.length ? Math.max.apply(null, rates).toFixed(1) : 0, '最好一次', 'check', 'a') +
        statCard(d.locked_count, '待解锁', 'lock', 's') +
      '</div>';
    const ordered = d.scores.slice().reverse().slice(-8);
    const trend = ordered.length > 1
      ? '<div class="card"><div class="section-head"><div><h3>成绩趋势</h3>' +
        '<div class="desc">按发布时间排列，已统一换算为得分率（%）</div></div></div>' +
        '<div class="trend-chart">' + ordered.map((s) => {
          const v = Math.max(2, Math.min(100, rate(s)));
          return '<div class="trend-col"><div class="trend-num">' + v.toFixed(0) + '</div>' +
            '<div class="trend-track"><i style="height:' + v + '%"></i></div>' +
            '<div class="trend-label">' + esc(s.exam_name.slice(0, 6)) + '</div></div>';
        }).join('') + '</div></div>'
      : '';
    return summary + trend +
      '<div class="card"><div class="section-head"><div><h3>我的成绩</h3>' +
      '<div class="desc">老师直接发送的成绩会显示在这里</div></div></div>' + cards + '</div>' +
      '<div class="card"><div class="section-head"><div><h3>用代号密码打开成绩</h3>' +
        '<div class="desc">老师单独发给你的成绩，需要输入代号和查看密码' +
        (d.locked_count ? ' · 当前有 ' + d.locked_count + ' 条待解锁' : '') + '</div></div></div>' +
      '<form id="fUnlock"><div class="form-grid">' +
        '<div class="field"><label>成绩代号</label><input class="input mono" name="code" required placeholder="例如 QK-A3K9M2"></div>' +
        '<div class="field"><label>查看密码</label><input class="input mono" name="password" required placeholder="老师发来的密码"></div>' +
      '</div><button class="btn primary" type="submit">' + icon('lock', 15) + ' 解锁并查看</button></form>' +
      '<div class="note blue mt16">解锁结果只保存在本次登录会话中；退出登录后需要重新输入。</div></div>';
  }

  async function pageStudentSettings() {
    const p = S.profile || {};
    return '<div class="card"><div class="section-head"><h3>我的账号</h3></div>' +
      '<div class="row wrap">' +
        '<span class="chip">' + icon('mail', 13) + ' ' + esc(p.email || '') + '</span>' +
        '<span class="chip">' + icon('school', 13) + ' ' + esc([p.school, p.class_name].filter(Boolean).join(' · ') || '未填写') + '</span>' +
        '<span class="chip">' + icon('users', 13) + ' ' + esc(p.teacher_name || '') + ' 老师</span>' +
      '</div></div>' +
      '<div class="card"><div class="section-head"><h3>修改登录密码</h3>' +
        '<div class="desc">改密后老师将无法再看到你的密码，如需找回请让老师重置。</div></div>' +
      '<form id="fPassword"><div class="form-grid">' +
        '<div class="field"><label>原密码（老师发的密码）</label><input class="input" name="old_password" type="password" required></div>' +
        '<div class="field"><label>新密码（至少 8 位）</label><input class="input" name="new_password" type="password" required minlength="8"></div>' +
      '</div><button class="btn primary" type="submit">更新密码</button></form></div>';
  }

  const PAGES = {
    'teacher:overview': pageTeacherOverview, 'teacher:students': pageStudents,
    'teacher:homeworks': pageHomeworks, 'teacher:scores': pageScores,
    'teacher:analytics': pageAnalytics,
    'teacher:notices': pageNotices, 'teacher:settings': pageSettings,
    'student:overview': pageStudentOverview, 'student:homeworks': pageStudentHomeworks,
    'student:scores': pageStudentScores, 'student:notices': pageStudentNotices,
    'student:settings': pageStudentSettings,
  };

  /* ============================================================ 弹窗内容 */
  function modalAddStudent() {
    openModal({
      title: '添加学生 · 自动生成登录密码',
      body: '<form id="fAddStudent"><div class="form-grid">' +
        '<div class="field"><label>学生姓名 *</label><input class="input" name="name" required placeholder="例如：李明"></div>' +
        '<div class="field"><label>学号</label><input class="input" name="student_no" placeholder="选填"></div>' +
        '<div class="field full"><label>学生邮箱 *</label><input class="input" name="email" type="email" required placeholder="student@example.com"></div>' +
      '</div></form>' +
      '<div class="note blue">' + icon('mail', 15) + ' 系统生成 8 位登录密码。把「邮箱 + 密码」发给学生，学生在登录页选「我是学生」即可登录，无需注册、无需手机号。</div>',
      foot: '<button class="btn ghost" data-act="closeModal" type="button">取消</button>' +
            '<button class="btn primary" data-act="submitAddStudent" type="button">添加并生成密码</button>',
    });
  }

  function showCredential(name, email, password, extra) {
    const text = '启课 · 学生登录信息\n姓名：' + name + '\n邮箱：' + email + '\n登录密码：' + password + '\n登录页请选择「我是学生」';
    openModal({
      title: '账号已创建 · 请发给学生',
      body: '<div class="row" style="margin-bottom:14px"><div class="avatar" style="width:42px;height:42px">' +
          esc(initials(name)) + '</div><div><strong>' + esc(name) + '</strong><div class="tiny">' + esc(email) + '</div></div></div>' +
        '<div class="cred-grid"><div class="cred"><div class="k">登录邮箱</div><div class="v" style="font-size:14px">' + esc(email) + '</div></div>' +
        '<div class="cred"><div class="k">登录密码</div><div class="v">' + esc(password) + '</div></div></div>' +
        (extra || '') +
        '<div class="note mt16">' + icon('shield', 15) + ' 请通过私下渠道发送。学生登录后可在「账号设置」里自行改密，改密后此密码失效。</div>',
      foot: '<button class="btn ghost" data-act="closeModal" type="button">关闭</button>' +
            '<button class="btn primary" data-act="copy" data-text="' + attr(text) + '" type="button">' + icon('copy', 15) + ' 复制完整凭据</button>',
    });
  }

  function modalBatch() {
    openModal({
      title: '批量导入学生',
      body: '<form id="fBatch"><div class="field"><label>名单（每行一位学生）</label>' +
        '<textarea class="input" name="text" rows="9" placeholder="李明,liming@example.com,202601&#10;王华,wanghua@example.com,202602"></textarea>' +
        '<div class="hint">格式：姓名,邮箱,学号（学号可省略）。支持逗号 / 中文逗号 / 制表符分隔，单次最多 200 人。</div></div></form>' +
        '<div class="note blue">导入后每位学生都会生成独立的登录密码，可在列表中逐个复制，或用「导出 CSV」一次拿全。</div>',
      foot: '<button class="btn ghost" data-act="closeModal" type="button">取消</button>' +
            '<button class="btn primary" data-act="submitBatch" type="button">批量生成账号</button>',
    });
  }

  async function modalAddHomework() {
    const list = S.studentCache && S.studentCache.length
      ? S.studentCache : (await api('/api/teacher/students')).students;
    S.studentCache = list;
    const picks = list.length
      ? '<div class="pick-list">' + list.map((s) =>
          '<label class="pick-item"><input type="checkbox" name="sid" value="' + s.id + '">' +
          '<span class="avatar" style="width:22px;height:22px;font-size:11px;border-radius:7px">' +
          esc(initials(s.name)) + '</span><strong>' + esc(s.name) + '</strong>' +
          '<span class="tiny">' + esc(s.student_no || s.email) + '</span></label>').join('') + '</div>'
      : '<div class="note">还没有学生，先去「学生管理」添加学生吧。</div>';
    openModal({
      title: '发布作业',
      body: '<form id="fAddHomework">' +
        '<div class="field"><label>作业标题 *</label><input class="input" name="title" required placeholder="例如：第三单元课后习题"></div>' +
        '<div class="form-grid">' +
          '<div class="field"><label>科目</label><input class="input" name="subject" placeholder="例如：数学"></div>' +
          '<div class="field"><label>截止时间</label><input class="input" name="due_at" type="datetime-local"></div>' +
        '</div>' +
        '<div class="field"><label>派发给</label><div class="radio-cards" style="grid-template-columns:1fr 1fr">' +
          '<label class="radio-card on" data-group="target_mode"><input type="radio" name="target_mode" value="all" checked hidden><strong>全班同学</strong><span>所有学生都能看到</span></label>' +
          '<label class="radio-card" data-group="target_mode"><input type="radio" name="target_mode" value="selected" hidden><strong>指定学生</strong><span>只推送给勾选的人</span></label>' +
        '</div></div>' +
        '<div id="targetBox" class="hidden"><div class="field"><label>选择学生（可多选）</label>' + picks +
          '<div class="row mt8" style="gap:8px">' +
            '<button class="btn ghost sm" data-act="pickAll" type="button">全选</button>' +
            '<button class="btn ghost sm" data-act="pickNone" type="button">清空</button>' +
            '<span class="tiny">共 ' + list.length + ' 人</span></div></div></div>' +
        '<div class="field"><label>作业说明</label><textarea class="input" name="description" rows="3" placeholder="写清要求、范围、格式…"></textarea></div>' +
        '<div class="field"><label>提交方式</label><div class="radio-cards">' +
          '<label class="radio-card on" data-group="mode"><input type="radio" name="mode" value="online" checked hidden><strong>在线作答</strong><span>学生在网页里输入文字完成</span></label>' +
          '<label class="radio-card" data-group="mode"><input type="radio" name="mode" value="upload" hidden><strong>网上提交</strong><span>学生上传文件或填写内容</span></label>' +
          '<label class="radio-card" data-group="mode"><input type="radio" name="mode" value="notice" hidden><strong>只留不交</strong><span>纯通知，线下完成，不需提交</span></label>' +
        '</div></div>' +
        '<div class="field"><label class="row" style="cursor:pointer;gap:8px">' +
          '<input type="checkbox" name="allow_late"> 允许截止时间后补交（默认逾期即停止提交）</label></div>' +
        '<div class="field"><label>作业附件（选填）</label>' +
          '<label class="btn ghost sm" style="cursor:pointer">' + icon('upload', 14) + ' 选择文件' +
          '<input type="file" data-upload="homework" hidden></label>' +
          '<input type="hidden" id="hwAttachId"><input type="hidden" id="hwAttachName">' +
          '<div id="hwAttachLabel" class="hint">支持文档 / 图片 / 压缩包，单文件 ≤ 10MB</div></div>' +
      '</form>',
      foot: '<button class="btn ghost" data-act="closeModal" type="button">取消</button>' +
            '<button class="btn primary" data-act="submitAddHomework" type="button">' + icon('send', 15) + ' 发布作业</button>',
    });
  }

  async function modalSubmissions(hid) {
    const d = await api('/api/teacher/homeworks/' + hid + '/submissions');
    const w = d.homework;
    const rows = d.items.length ? d.items.map((it) => {
      const done = !!it.submission_id;
      return '<tr><td><strong>' + esc(it.name) + '</strong><div class="tiny">' + esc(it.student_no || it.email) + '</div></td>' +
        '<td>' + (done ? '<span class="badge green">' + (it.status === 'acked' ? '已知悉' : (it.status === 'reviewed' ? '已批改' : '已提交')) + '</span>'
                       : '<span class="badge gray">未提交</span>') + '</td>' +
        '<td style="max-width:240px"><div style="white-space:pre-wrap;word-break:break-word">' + esc(it.content || '—') + '</div>' +
          (it.file_id ? '<a class="tiny" href="/api/file/' + attr(it.file_id) + '">' + icon('download', 12) + ' ' + esc(it.file_name) + '</a>' : '') + '</td>' +
        '<td class="tiny">' + esc(it.submitted_at || '—') + '</td>' +
        '<td>' + (it.score || it.comment ? '<strong>' + esc(it.score || '—') + '</strong><div class="tiny">' + esc(it.comment || '') + '</div>' : '—') + '</td>' +
        '<td style="text-align:right">' + (done && it.content
          ? '<button class="btn soft sm" data-act="review" data-id="' + it.submission_id + '" data-hid="' + attr(hid) + '" data-score="' + attr(it.score || '') + '" data-comment="' + attr(it.comment || '') + '" type="button">批改</button>'
          : '<span class="tiny">—</span>') + '</td></tr>';
    }).join('') : '<tr><td colspan="6" class="tiny" style="text-align:center;padding:28px">还没有学生，先去添加学生吧。</td></tr>';
    openModal({
      title: '《' + w.title + '》· 提交情况', wide: true,
      body: '<div class="row wrap mb16">' +
          '<span class="chip">' + esc(MODE[w.mode]) + '</span>' +
          '<span class="chip">' + icon('clock', 13) + ' ' + esc(w.due_at ? fmtTime(w.due_at) : '不限时') + '</span>' +
          '<span class="chip">' + d.items.filter((x) => x.submission_id).length + ' / ' + d.items.length + ' 已提交</span>' +
        '</div>' +
        (w.description ? '<div class="note blue mb16">' + esc(w.description) + '</div>' : '') +
        '<div class="table-wrap"><table class="tbl"><thead><tr><th>学生</th><th>状态</th><th>作答 / 附件</th><th>提交时间</th><th>批改</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>',
      foot: '<button class="btn ghost" data-act="closeModal" type="button">关闭</button>',
    });
  }

  function modalReview(subid, score, comment, hid) {
    openModal({
      title: '批改作业',
      body: '<form id="fReview"><input type="hidden" name="subid" value="' + attr(subid) + '">' +
        '<input type="hidden" name="hid" value="' + attr(hid || '') + '">' +
        '<div class="field"><label>得分 / 等级</label><input class="input" name="score" value="' + attr(score || '') + '" placeholder="例如：95 或 A"></div>' +
        '<div class="field"><label>评语</label><textarea class="input" name="comment" rows="4" placeholder="写点反馈…">' + esc(comment || '') + '</textarea></div>' +
      '</form>',
      foot: '<button class="btn ghost" data-act="closeModal" type="button">取消</button>' +
            '<button class="btn primary" data-act="submitReview" type="button">保存批改</button>',
    });
  }

  async function modalAddScore() {
    const list = S.studentCache && S.studentCache.length
      ? S.studentCache : (await api('/api/teacher/students')).students;
    if (!list.length) {
      toast('请先添加学生', 'err'); return;
    }
    openModal({
      title: '发布成绩',
      body: '<form id="fAddScore">' +
        '<div class="field"><label>选择学生 *</label><select class="select" name="student_id" required>' +
          list.map((s) => '<option value="' + s.id + '">' + esc(s.name) + ' · ' + esc(s.email) + '</option>').join('') +
        '</select></div>' +
        '<div class="form-grid">' +
          '<div class="field"><label>考试 / 测验名称 *</label><input class="input" name="exam_name" required placeholder="例如：期中测验"></div>' +
          '<div class="field"><label>科目</label><input class="input" name="subject" placeholder="例如：数学"></div>' +
          '<div class="field"><label>分数 *</label><input class="input" name="score" type="number" step="0.1" required></div>' +
          '<div class="field"><label>满分</label><input class="input" name="full_score" type="number" step="0.1" value="100"></div>' +
        '</div>' +
        '<div class="field"><label>备注</label><input class="input" name="remark" placeholder="选填，例如：班级第 3 名"></div>' +
        '<div class="field"><label>发布方式</label><div class="radio-cards" style="grid-template-columns:1fr 1fr">' +
          '<label class="radio-card on" data-group="publishMode"><input type="radio" name="publishMode" value="direct" checked hidden><strong>直接发送</strong><span>发到该学生邮箱账号，登录即见</span></label>' +
          '<label class="radio-card" data-group="publishMode"><input type="radio" name="publishMode" value="locked" hidden><strong>代号密码保护</strong><span>生成代号 + 密码，由你发给学生解锁</span></label>' +
        '</div></div>' +
        '<div id="scoreCredBox" class="hidden"><div class="form-grid">' +
          '<div class="field"><label>成绩代号</label><input class="input mono" name="view_code" placeholder="留空自动生成"></div>' +
          '<div class="field"><label>查看密码</label><input class="input mono" name="view_password" placeholder="留空自动生成"></div>' +
        '</div><div class="hint">留空时系统自动生成，发布后会把代号与密码显示给你复制。</div></div>' +
      '</form>',
      foot: '<button class="btn ghost" data-act="closeModal" type="button">取消</button>' +
            '<button class="btn green" data-act="submitAddScore" type="button">' + icon('send', 15) + ' 发布成绩</button>',
    });
  }

  function showScoreCredential(res, exam, studentName) {
    const text = '启课 · 成绩查看凭据\n考试：' + exam + '\n成绩代号：' + res.view_code + '\n查看密码：' + res.view_password + '\n登录后进入「我的成绩」输入即可查看';
    openModal({
      title: '成绩已发布 · 请把凭据发给学生',
      body: '<div class="row mb16"><span class="badge violet">' + icon('lock', 12) + ' 密码保护</span>' +
          '<span class="tiny">' + esc(studentName) + ' · ' + esc(exam) + '</span></div>' +
        '<div class="cred-grid"><div class="cred"><div class="k">成绩代号</div><div class="v">' + esc(res.view_code) + '</div></div>' +
        '<div class="cred"><div class="k">查看密码</div><div class="v">' + esc(res.view_password) + '</div></div></div>' +
        '<div class="note mt16">学生在「我的成绩」页输入这两项才能打开该条成绩。密码以哈希方式保存，老师端可随时在成绩表里重新复制。</div>',
      foot: '<button class="btn ghost" data-act="closeModal" type="button">关闭</button>' +
            '<button class="btn primary" data-act="copy" data-text="' + attr(text) + '" type="button">' + icon('copy', 15) + ' 复制凭据</button>',
    });
  }

  function modalStudentHomework(hid) {
    const w = (S.hwCache || []).find((x) => x.id === hid);
    if (!w) { toast('作业数据已过期，请刷新', 'err'); return; }
    const done = !!w.submission_id;
    const blocked = !w.can_submit && w.mode !== 'notice';
    let form = '';
    if (blocked) {
      form = '<div class="note red-note">' + icon('clock', 15) +
        ' 这份作业已过截止时间，老师未开启补交，现在只能查看内容。' +
        (done ? ' 你之前提交的内容与老师评语仍保留在下方。' : '') + '</div>';
    } else if (w.mode === 'notice') {
      form = '<div class="note blue">这份作业只需查看，不需要提交。看完点「标记已知悉」，老师就能看到。</div>' +
        '<div class="mt16"><button class="btn primary" data-act="ackWork" data-id="' + w.id + '" type="button">' +
        icon('check', 15) + (done ? '已标记已知悉（可再次点击）' : '标记已知悉') + '</button></div>';
    } else {
      form = '<form id="fSubmitWork"><input type="hidden" name="hid" value="' + w.id + '">' +
        '<input type="hidden" id="workFileId"><input type="hidden" id="workFileName">' +
        (w.mode === 'upload'
          ? '<div class="field"><label>上传作业文件</label>' +
            '<label class="btn ghost sm" style="cursor:pointer">' + icon('upload', 14) + ' 选择文件' +
            '<input type="file" data-upload="work" hidden></label>' +
            '<div id="workFileLabel" class="hint">支持文档 / 图片 / 压缩包，单文件 ≤ 10MB</div></div>'
          : '') +
        '<div class="field"><label>' + (w.mode === 'online' ? '作答内容 *' : '补充说明（选填）') + '</label>' +
          '<textarea class="input" name="content" rows="6" placeholder="在这里写你的答案…">' + esc(w.my_content || '') + '</textarea></div>' +
        (done ? '<div class="note mt16">已提交过，重新提交会覆盖上一次内容（老师的批改会保留）。</div>' : '') +
      '</form>';
    }
    const foot = (w.mode === 'notice' || blocked)
      ? '<button class="btn ghost" data-act="closeModal" type="button">关闭</button>'
      : '<button class="btn ghost" data-act="closeModal" type="button">取消</button>' +
        '<button class="btn primary" data-act="submitWork" type="button">' + icon('send', 15) + ' 提交作业</button>';
    openModal({
      title: w.title,
      body: '<div class="row wrap mb16">' +
          '<span class="chip">' + esc(w.subject || '未设科目') + '</span>' +
          '<span class="badge ' + MODE_BADGE[w.mode] + '">' + esc(MODE[w.mode]) + '</span>' +
          (w.due_at ? '<span class="chip">' + icon('clock', 13) + ' 截止 ' + esc(fmtTime(w.due_at)) + '</span>' : '') +
        '</div>' +
        (w.description ? '<div class="note blue mb16" style="white-space:pre-wrap">' + esc(w.description) + '</div>' : '') +
        (w.attachment_id ? '<div class="mb16"><a class="btn ghost sm" href="/api/file/' + attr(w.attachment_id) + '">' +
          icon('download', 14) + ' 下载老师附件：' + esc(w.attachment_name) + '</a></div>' : '') +
        (w.comment ? '<div class="note mb16"><strong>老师评语：</strong>' + esc(w.comment) +
          (w.score ? ' · 得分 ' + esc(w.score) : '') + '</div>' : '') +
        form,
      foot: foot,
    });
  }

  /* ============================================================ 事件 */
  const CLICK = {
    closeModal: () => closeModal(),
    loginTab: (el) => renderAuth('login', el.dataset.role),
    gotoRegister: () => renderAuth('register'),
    gotoLogin: () => renderAuth('login'),
    forgotPwd: () => modalForgot(1),
    gotoNotices: () => go('notices'),
    pickAll: () => $$('input[name="sid"]').forEach((x) => { x.checked = true; }),
    pickNone: () => $$('input[name="sid"]').forEach((x) => { x.checked = false; }),
    nav: (el) => go(el.dataset.page),
    refresh: () => go(S.page),
    copy: (el) => copyText(el.dataset.text || ''),
    logout: async () => {
      try { await api('/api/auth/logout', 'POST'); } catch (e) { /* ignore */ }
      location.reload();
    },
    addStudent: () => modalAddStudent(),
    batchStudents: () => modalBatch(),
    exportStudents: () => { location.href = '/api/teacher/students/export'; toast('已开始下载账号密码表'); },
    exportScores: () => { location.href = '/api/teacher/scores/export'; toast('已开始下载成绩明细'); },
    backupAll: () => { location.href = '/api/teacher/backup'; toast('已开始下载完整备份'); },
    copyStudent: (el) => {
      const s = (S.studentCache || []).find((x) => x.id === Number(el.dataset.id));
      if (!s) return;
      copyText('启课 · 学生登录信息\n姓名：' + s.name + '\n邮箱：' + s.email +
        '\n登录密码：' + (s.initial_password || '（学生已自行修改，请重置）') + '\n登录页请选择「我是学生」');
    },
    resetPwd: (el) => confirmModal('重置登录密码', '原密码会立即失效，请确认已通知学生。', async () => {
      const r = await api('/api/teacher/students/' + el.dataset.id + '/reset', 'POST');
      const s = (S.studentCache || []).find((x) => x.id === Number(el.dataset.id));
      await go('students');
      if (s) showCredential(s.name, s.email, r.password);
    }),
    delStudent: (el) => confirmModal('删除学生', '该学生的所有作业提交与成绩记录都会一并删除，且不可恢复。', async () => {
      await api('/api/teacher/students/' + el.dataset.id, 'DELETE');
      toast('已删除'); await go('students');
    }),
    addHomework: () => modalAddHomework().catch(fail),
    viewSubmissions: (el) => modalSubmissions(el.dataset.id).catch(fail),
    review: (el) => modalReview(el.dataset.id, el.dataset.score, el.dataset.comment, el.dataset.hid),
    delHomework: (el) => confirmModal('删除作业', '该作业及所有学生提交都会一并删除，且不可恢复。', async () => {
      await api('/api/teacher/homeworks/' + el.dataset.id, 'DELETE');
      toast('已删除'); await go(S.page);
    }),
    addScore: () => modalAddScore().catch(fail),
    copyScore: (el) => {
      const s = (S.scoreCache || []).find((x) => x.id === Number(el.dataset.id));
      if (!s) return;
      copyText('启课 · 成绩查看凭据\n考试：' + s.exam_name + '\n成绩代号：' + s.view_code +
        '\n查看密码：' + s.view_password + '\n登录后进入「我的成绩」输入即可查看');
    },
    delScore: (el) => confirmModal('删除成绩', '该成绩记录会被删除，学生将无法再查看。', async () => {
      await api('/api/teacher/scores/' + el.dataset.id, 'DELETE');
      toast('已删除'); await go('scores');
    }),
    readNotices: async () => {
      try {
        await api((S.user.role === 'teacher' ? '/api/teacher' : '/api/student') +
                  '/notifications/read', 'POST');
        S.unread = 0; renderShell(); await go('notices'); toast('已全部标为已读');
      } catch (e) { fail(e); }
    },
    openHomework: (el) => modalStudentHomework(Number(el.dataset.id)),
    ackWork: async (el) => {
      try { await api('/api/student/homeworks/' + el.dataset.id + '/ack', 'POST'); closeModal(); await go(S.page); toast('已标记已知悉'); }
      catch (e) { fail(e); }
    },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = CLICK[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
    Promise.resolve(fn(el)).catch(fail);
  });

  /* 表单提交 */
  const FORMS = {
    fLogin: async (f) => {
      const fd = new FormData(f);
      const r = await api('/api/auth/login', 'POST', {
        role: fd.get('role'), email: fd.get('email'), password: fd.get('password'),
        totp: fd.get('totp') || '',
      });
      S.csrf = r.csrf || S.csrf;
      location.reload();
    },
    fForgot: async (f) => {
      const fd = new FormData(f);
      const email = String(fd.get('email') || '').trim().toLowerCase();
      await api('/api/auth/forgot', 'POST', { email: email });
      modalForgot(2, email);
      toast('重置码已发送到邮箱');
    },
    fReset: async (f) => {
      const fd = new FormData(f);
      await api('/api/auth/reset', 'POST', {
        email: fd.get('email'), code: fd.get('code'), new_password: fd.get('new_password'),
      });
      closeModal();
      renderAuth('login', 'teacher');
      toast('密码已重置，请用新密码登录');
    },
    fRegister: async (f) => {
      const fd = new FormData(f);
      const phone = String(fd.get('phone') || '').trim();
      if (!/^1\d{10}$/.test(phone)) throw new Error('请输入正确的 11 位手机号');
      await api('/api/auth/register', 'POST', {
        name: fd.get('name'), email: fd.get('email'), password: fd.get('password'),
        phone: phone, school: fd.get('school'), class_name: fd.get('class_name'),
      });
      location.reload();
    },
    fAddStudent: async (f) => {
      const fd = new FormData(f);
      const r = await api('/api/teacher/students', 'POST', {
        name: fd.get('name'), email: fd.get('email'), student_no: fd.get('student_no'),
      });
      await go('students');
      showCredential(r.student.name, r.student.email, r.student.initial_password);
      toast('学生账号已创建');
    },
    fBatch: async (f) => {
      const fd = new FormData(f);
      const r = await api('/api/teacher/students/batch', 'POST', { text: fd.get('text') });
      closeModal(); await go('students');
      toast('成功导入 ' + r.created.length + ' 人' + (r.skipped.length ? '，跳过 ' + r.skipped.length + ' 行' : ''));
    },
    fAddHomework: async (f) => {
      const fd = new FormData(f);
      const targetMode = fd.get('target_mode') || 'all';
      const ids = $$('input[name="sid"]:checked').map((x) => Number(x.value));
      if (targetMode === 'selected' && !ids.length) throw new Error('请至少勾选一位学生');
      await api('/api/teacher/homeworks', 'POST', {
        title: fd.get('title'), subject: fd.get('subject'), description: fd.get('description'),
        due_at: fd.get('due_at'), mode: fd.get('mode'),
        target_mode: targetMode, student_ids: ids,
        allow_late: fd.get('allow_late') === 'on',
        attachment_id: $('#hwAttachId') ? $('#hwAttachId').value : '',
        attachment_name: $('#hwAttachName') ? $('#hwAttachName').value : '',
      });
      closeModal(); await go('homeworks');
      toast(targetMode === 'selected' ? '作业已发布给指定的 ' + ids.length + ' 位学生' : '作业已发布给全班');
    },
    fReview: async (f) => {
      const fd = new FormData(f);
      await api('/api/teacher/submissions/' + fd.get('subid') + '/review', 'POST', {
        score: fd.get('score'), comment: fd.get('comment'),
      });
      const hid = fd.get('hid');
      closeModal();
      if (S.page === 'homeworks' || S.page === 'overview') await go(S.page);
      if (hid) await modalSubmissions(hid);
      toast('批改已保存');
    },
    fAddScore: async (f) => {
      const fd = new FormData(f);
      const mode = fd.get('publishMode');
      const payload = {
        student_id: Number(fd.get('student_id')), exam_name: fd.get('exam_name'),
        subject: fd.get('subject'), score: fd.get('score'), full_score: fd.get('full_score'),
        remark: fd.get('remark'), mode: mode,
      };
      if (mode === 'locked') {
        payload.view_code = fd.get('view_code') || undefined;
        payload.view_password = fd.get('view_password') || undefined;
      }
      const r = await api('/api/teacher/scores', 'POST', payload);
      closeModal(); await go('scores');
      if (mode === 'locked') {
        const s = (S.scoreCache || []).find((x) => x.id === r.id);
        showScoreCredential(r, payload.exam_name, s ? s.student_name : '');
      } else toast('成绩已直接发送到学生账号');
    },
    fSubmitWork: async (f) => {
      const fd = new FormData(f);
      await api('/api/student/homeworks/' + fd.get('hid') + '/submit', 'POST', {
        content: fd.get('content'),
        file_id: $('#workFileId') ? $('#workFileId').value : '',
      });
      closeModal(); await go(S.page); toast('作业提交成功');
    },
    fUnlock: async (f) => {
      const fd = new FormData(f);
      await api('/api/student/scores/unlock', 'POST', {
        code: fd.get('code'), password: fd.get('password'),
      });
      await go('scores'); toast('成绩已解锁');
    },
    fProfile: async (f) => {
      const fd = new FormData(f);
      const phone = String(fd.get('phone') || '').trim();
      if (!/^1\d{10}$/.test(phone)) throw new Error('请输入正确的 11 位手机号');
      await api('/api/teacher/profile', 'PUT', {
        name: fd.get('name'), phone: phone, school: fd.get('school'), grade: fd.get('grade'),
        class_name: fd.get('class_name'), sms_webhook: fd.get('sms_webhook'),
        mail_webhook: fd.get('mail_webhook'),
        notify_enabled: fd.get('notify_enabled') === 'on',
      });
      const b = await api('/api/bootstrap'); S.profile = b.profile; S.csrf = b.csrf;
      renderShell(); toast('资料已保存');
    },
    fPassword: async (f) => {
      const fd = new FormData(f);
      await api('/api/auth/password', 'POST', {
        old_password: fd.get('old_password'), new_password: fd.get('new_password'),
      });
      f.reset(); toast('密码已更新');
    },
  };

  document.addEventListener('submit', (e) => {
    const f = e.target;
    const fn = FORMS[f.id];
    if (!fn) return;
    e.preventDefault();
    const btn = f.querySelector('button[type="submit"]') || $('[data-act="' + ({
      fAddStudent: 'submitAddStudent', fBatch: 'submitBatch', fAddHomework: 'submitAddHomework',
      fReview: 'submitReview', fAddScore: 'submitAddScore', fSubmitWork: 'submitWork',
    }[f.id] || '') + '"]');
    if (btn) btn.disabled = true;
    Promise.resolve(fn(f)).catch(fail).finally(() => { if (btn) btn.disabled = false; });
  });

  /* 表单里若干按钮在 modal-foot，用 data-act 触发对应 form 的提交 */
  const SUBMIT_TRIGGER = {
    submitAddStudent: 'fAddStudent', submitBatch: 'fBatch', submitAddHomework: 'fAddHomework',
    submitReview: 'fReview', submitAddScore: 'fAddScore', submitWork: 'fSubmitWork',
  };
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || CLICK[el.dataset.act]) return;
    const formId = SUBMIT_TRIGGER[el.dataset.act];
    if (!formId) return;
    const f = document.getElementById(formId);
    if (f) f.requestSubmit();
  });

  /* radio-card 选中态 + 发布方式联动 */
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.type === 'radio' && t.closest('.radio-card')) {
      const group = t.name;
      $$('.radio-card[data-group="' + group + '"]').forEach((c) => c.classList.remove('on'));
      t.closest('.radio-card').classList.add('on');
      if (group === 'publishMode') {
        const box = $('#scoreCredBox');
        if (box) box.classList.toggle('hidden', t.value !== 'locked');
      }
      if (group === 'target_mode') {
        const box = $('#targetBox');
        if (box) box.classList.toggle('hidden', t.value !== 'selected');
      }
    }
  });

  /* 附件上传 */
  document.addEventListener('change', async (e) => {
    const t = e.target;
    if (!t.matches('input[type="file"][data-upload]')) return;
    if (!t.files || !t.files[0]) return;
    const kind = t.dataset.upload;
    const idEl = $(kind === 'homework' ? '#hwAttachId' : '#workFileId');
    const nameEl = $(kind === 'homework' ? '#hwAttachName' : '#workFileName');
    const label = $(kind === 'homework' ? '#hwAttachLabel' : '#workFileLabel');
    if (!idEl || !label) return;
    label.textContent = '正在上传…';
    try {
      const f = await upload(t.files[0]);
      idEl.value = f.id; nameEl.value = f.name;
      label.innerHTML = icon('check', 14) + ' 已选择：' + esc(f.name) + ' <span class="tiny">(' + fmtSize(f.size) + ')</span>';
      toast('附件已上传');
    } catch (err) { t.value = ''; label.textContent = '上传失败，请重试'; fail(err); }
  });

  /* ---------------------------------------------------------- 扩展点
     外部模块脚本（static/ext-*.js）在本文件之后同步加载，通过 window.Qike
     注册新页面 / 导航 / 按钮动作 / 表单。延迟一拍启动，确保注册完成。 */
  window.Qike = {
    api: api, upload: upload, toast: toast, fail: fail, esc: esc, attr: attr,
    icon: icon, fmtTime: fmtTime, fmtSize: fmtSize, empty: empty,
    copyText: copyText, initials: initials, $: $, $$: $$,
    openModal: openModal, closeModal: closeModal,
    renderShell: renderShell, go: go, setLoading: setLoading,
    S: S, NAV: NAV, PAGES: PAGES, CLICK: CLICK, FORMS: FORMS,
    SUBMIT_TRIGGER: SUBMIT_TRIGGER, MODE: MODE, MODE_BADGE: MODE_BADGE,
    reload: () => go(S.page),
  };

  /* 启动 */
  initSplash();
  setTimeout(boot, 0);
})();
