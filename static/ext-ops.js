/* 运维与体验：深色模式 / PWA / 全局搜索 / 日历 / 看板 / 审计 / 设备 / 备份 / 2FA / 品牌 / 多语言 / 无障碍 */
(function () {
  const Q = window.Qike; if (!Q) return;
  const E = Q.esc, A = Q.attr;
  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '.ext-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 16px}' +
    '.ext-top{display:flex;align-items:center;gap:6px}' +
    '.ext-list{display:flex;flex-direction:column;gap:8px}' +
    '.ext-item{border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:13px}' +
    '.anim-cal-head{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin:12px 0 6px;font-size:11.5px;color:var(--ink3);text-align:center}' +
    '.anim-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}' +
    '.anim-cal-cell{min-height:78px;border:1px solid var(--line);border-radius:10px;padding:6px;background:#fbfdff;font-size:11px;overflow:hidden}' +
    '.anim-cal-cell.empty{background:transparent;border-color:transparent}' +
    '.anim-cal-cell.today{border-color:var(--blue);background:#eaf4ff}' +
    '.anim-cal-cell .d{font-weight:700;color:var(--ink2);margin-bottom:4px}' +
    '.anim-cal-cell .e{background:#e6f2fe;color:#2F77C4;border-radius:5px;padding:2px 4px;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.anim-cal-cell .e.warn{background:#fff4df;color:#B7791F}' +
    'body.ext-dark .anim-cal-cell{background:#162236;border-color:#2b3c55}' +
    'body.ext-dark .anim-cal-cell.empty{background:transparent;border-color:transparent}' +
    'body.ext-dark{background:#101827;color:#e6edf7}' +
    'body.ext-dark .card,body.ext-dark .topbar,body.ext-dark .sidebar,body.ext-dark .modal,' +
    'body.ext-dark .input,body.ext-dark select,body.ext-dark textarea,body.ext-dark .hw-card,' +
    'body.ext-dark .stat,body.ext-dark .tbl,body.ext-dark .auth-card{background:#162236!important;color:#e6edf7!important;border-color:#2b3c55!important}' +
    'body.ext-dark .tiny,body.ext-dark .desc,body.ext-dark .hint,body.ext-dark .meta{color:#9fb0c6!important}' +
    'body.ext-dark .tbl th{background:#1c2b42!important}' +
    'body.ext-dark .tbl td{border-color:#2b3c55!important}' +
    'body.ext-big{font-size:17px}' +
    'body.ext-contrast .card,body.ext-contrast .btn{border:2px solid #1b2b40!important}' +
    '</style>');

  let tab = 'board', lang = localStorage.getItem('qike.lang') || 'zh';
  const _n = new Date();
  let calYear = _n.getFullYear(), calMonth = _n.getMonth();
  const TABS = [['board', '待办看板'], ['calendar', '日历'], ['audit', '操作审计'],
                ['devices', '登录设备'], ['backup', '自动备份'], ['2fa', '两步验证'],
                ['brand', '品牌与语言']];
  const DICT = {
    '工作台': 'Dashboard', '学生管理': 'Students', '作业管理': 'Homework', '成绩管理': 'Scores',
    '成绩分析': 'Analytics', '通知中心': 'Notices', '设置': 'Settings', '成绩工具': 'Score Tools',
    '作业工具箱': 'Quiz Tools', '沟通与通知': 'Messages', '批量录入': 'Batch Entry',
    '数据导入导出': 'Import / Export', '班级管理': 'Classes', '学生分组': 'Groups',
    '班级码': 'Class Code', '我的首页': 'Home', '我的作业': 'My Homework',
    '我的成绩': 'My Scores', '消息通知': 'Messages', '账号设置': 'Account',
    '在线答题': 'Quiz', '班级沟通': 'Class Chat', '系统工具': 'Tools'
  };

  function pref(k, d) { return localStorage.getItem('qike.' + k) || d; }
  function setPref(k, v) { localStorage.setItem('qike.' + k, v); }
  function applyPrefs() {
    document.body.classList.toggle('ext-dark', pref('dark', '0') === '1');
    document.body.classList.toggle('ext-big', pref('big', '0') === '1');
    document.body.classList.toggle('ext-contrast', pref('contrast', '0') === '1');
  }
  function applyLang() {
    ['teacher', 'student'].forEach(function (r) {
      Q.NAV[r].forEach(function (n) {
        if (!n._zh) n._zh = n.label;
        n.label = lang === 'en' ? (DICT[n._zh] || n._zh) : n._zh;
      });
    });
    if (Q.S.user) Q.renderShell();
  }
  function applyBrand(b) {
    if (b.name) document.title = b.name + ' · 师生作业与成绩平台';
    if (b.color) document.documentElement.style.setProperty('--blue', b.color);
  }
  function tabs() {
    return '<div class="ext-tabs">' + TABS.map(function (t) {
      return '<button class="btn ' + (t[0] === tab ? 'primary' : 'ghost') + ' sm" type="button" ' +
        'data-act="opsTab" data-tab="' + t[0] + '">' + E(t[1]) + '</button>';
    }).join('') + '</div>';
  }

  Q.PAGES['teacher:tools'] = async function () {
    let body = '';
    if (tab === 'board') {
      const d = await Q.api('/api/x/ops/board');
      body = '<div class="stat-grid">' + (d.cards || []).map(function (c) {
        return '<div class="stat"><div class="num">' + E(c.value) + '</div><div class="tiny">' + E(c.label) + '</div></div>';
      }).join('') + '</div>';
    } else if (tab === 'calendar') {
      const d = await Q.api('/api/x/ops/calendar');
      const ev = {};
      (d.events || []).forEach(function (x) { (ev[x.date] = ev[x.date] || []).push(x); });
      const lead = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
      const days = new Date(calYear, calMonth + 1, 0).getDate();
      const tk = new Date();
      const todayKey = tk.getFullYear() + '-' + String(tk.getMonth() + 1).padStart(2, '0') +
        '-' + String(tk.getDate()).padStart(2, '0');
      let cells = '';
      for (let i = 0; i < lead; i++) cells += '<div class="anim-cal-cell empty"></div>';
      for (let dd = 1; dd <= days; dd++) {
        const key = calYear + '-' + String(calMonth + 1).padStart(2, '0') + '-' +
          String(dd).padStart(2, '0');
        const list = ev[key] || [];
        cells += '<div class="anim-cal-cell' + (key === todayKey ? ' today' : '') + '">' +
          '<div class="d">' + dd + '</div>' +
          list.slice(0, 2).map(function (x) {
            return '<div class="e' + (x.kind === '截止' ? ' warn' : '') + '" title="' + A(x.title) + '">' +
              E(x.title) + '</div>';
          }).join('') +
          (list.length > 2 ? '<div class="tiny">+' + (list.length - 2) + ' 项</div>' : '') + '</div>';
      }
      body = '<div class="row spread"><strong>' + calYear + ' 年 ' + (calMonth + 1) + ' 月</strong>' +
        '<div class="row" style="gap:6px;flex-wrap:wrap">' +
        '<button class="btn ghost sm" data-act="opsCal" data-delta="-1" type="button">上个月</button>' +
        '<button class="btn ghost sm" data-act="opsCal" data-delta="0" type="button">回到本月</button>' +
        '<button class="btn ghost sm" data-act="opsCal" data-delta="1" type="button">下个月</button>' +
        '</div></div><div class="anim-cal-head">' +
        ['一', '二', '三', '四', '五', '六', '日'].map(function (w) { return '<div>' + w + '</div>'; }).join('') +
        '</div><div class="anim-cal">' + cells + '</div>' +
        '<div class="hint mt8">蓝色为发布日，橙色为截止日；按 <kbd>/</kbd> 可快速全局搜索。</div>';
    } else if (tab === 'audit') {
      const d = await Q.api('/api/x/ops/audit');
      body = '<table class="tbl"><thead><tr><th>时间</th><th>操作</th><th>来源 IP</th></tr></thead><tbody>' +
        ((d.items || []).map(function (x) {
          return '<tr><td>' + E(x.created_at) + '</td><td>' + E(x.action) + '</td><td>' + E(x.ip) + '</td></tr>';
        }).join('') || '<tr><td colspan="3">暂无记录</td></tr>') + '</tbody></table>' +
        '<div class="hint">所有成功的 API 写操作自动留痕，包含改分、重置密码、发布作业等。</div>';
    } else if (tab === 'devices') {
      const d = await Q.api('/api/x/ops/devices');
      body = '<div class="ext-list">' + (d.items.length ? d.items.map(function (x) {
        return '<div class="ext-item"><strong>' + E(x.ip || '本机') + '</strong> · ' + E(x.last_seen) +
          '<div class="tiny">' + E(String(x.ua).slice(0, 90)) + '</div>' +
          '<button class="btn ghost sm" type="button" data-act="opsRevokeDevice" data-id="' + x.id + '">移除设备</button></div>';
      }).join('') : '') + '</div>';
    } else if (tab === 'backup') {
      const d = await Q.api('/api/x/ops/backups');
      body = '<button class="btn primary sm" type="button" data-act="opsBackup">立即备份</button>' +
        '<div class="hint">系统每天自动备份一次（数据库 + 全部附件），保留最近 7 份。</div>' +
        '<div class="ext-list mt16">' + (d.items.length ? d.items.map(function (x) {
          return '<div class="ext-item">' + E(x.name) + ' <span class="tiny">' + Q.fmtSize(x.size) + '</span> ' +
            '<a class="btn ghost sm" href="/api/x/ops/backups/download/' + A(x.name) + '">下载</a></div>';
        }).join('') : '<div class="tiny">暂无备份</div>') + '</div>';
    } else if (tab === '2fa') {
      const d = await Q.api('/api/x/ops/2fa');
      body = '<div class="note ' + (d.enabled ? 'green' : 'blue') + '">当前状态：' +
        (d.enabled ? '已启用两步验证' : '未启用') + '</div>' +
        '<div class="row mt16" style="gap:8px"><button class="btn soft sm" type="button" data-act="ops2faSetup">生成密钥</button>' +
        (d.enabled ? '<button class="btn ghost sm" type="button" data-act="ops2faDisable">关闭</button>' : '') + '</div>' +
        '<form id="ops2faForm" class="mt16"><div class="field"><label>验证器 App 中的 6 位验证码</label>' +
        '<input class="input" name="code" maxlength="6" placeholder="000000"></div>' +
        '<button class="btn primary sm" type="submit">验证并启用</button></form>' +
        '<div class="hint">支持 Google Authenticator / Microsoft Authenticator 等标准 TOTP 应用，密钥只存本机数据库。</div>';
    } else {
      const b = await Q.api('/api/x/ops/brand');
      body = '<form id="opsBrandForm"><div class="form-grid">' +
        '<div class="field"><label>产品 / 学校名称</label><input class="input" name="name" value="' + A(b.name) + '"></div>' +
        '<div class="field"><label>主题色</label><input class="input" name="color" value="' + A(b.color) + '" placeholder="#4E95D9"></div>' +
        '<div class="field"><label>校徽 / Logo 地址（选填）</label><input class="input" name="logo" value="' + A(b.logo) + '"></div>' +
        '<div class="field"><label>界面语言</label><select class="input" id="opsLangSel">' +
        '<option value="zh" ' + (lang === 'zh' ? 'selected' : '') + '>简体中文</option>' +
        '<option value="en" ' + (lang === 'en' ? 'selected' : '') + '>English</option></select></div></div>' +
        '<button class="btn primary sm" type="submit">保存品牌设置</button></form>' +
        '<div class="hint">深色模式、大字号、高对比度可在顶栏一键切换，偏好保存在本机浏览器。</div>';
    }
    return '<div class="card"><div class="section-head"><div><h3>系统工具</h3>' +
      '<div class="desc">看板、日历、审计、设备、备份与安全</div></div></div>' + tabs() + body + '</div>';
  };

  Q.NAV.teacher.push({ id: 'tools', label: '系统工具', icon: 'shield', title: '系统工具' });
  Q.CLICK.opsTab = function (el) { tab = el.dataset.tab; Q.reload(); };
  Q.CLICK.opsCal = function (el) {
    const delta = +el.dataset.delta;
    if (delta === 0) { const n = new Date(); calYear = n.getFullYear(); calMonth = n.getMonth(); }
    else { const d = new Date(calYear, calMonth + delta, 1); calYear = d.getFullYear(); calMonth = d.getMonth(); }
    Q.reload();
  };
  Q.CLICK.opsRevokeDevice = async function (el) {
    await Q.api('/api/x/ops/devices/' + el.dataset.id + '/revoke', 'POST');
    Q.toast('设备已移除'); Q.reload();
  };
  Q.CLICK.opsBackup = async function () {
    const r = await Q.api('/api/x/ops/backups/run', 'POST');
    Q.toast('备份已生成：' + r.name); Q.reload();
  };
  Q.CLICK.ops2faSetup = async function () {
    const r = await Q.api('/api/x/ops/2fa/setup', 'POST');
    Q.openModal({ title: '两步验证密钥',
      body: '<div class="ext-item">密钥：<strong>' + E(r.secret) + '</strong></div>' +
        '<div class="hint mt8">在验证器 App 里手动添加该密钥（或用 otpauth 链接导入），然后输入 6 位验证码完成启用。</div>' +
        '<div class="ext-item mt8" style="word-break:break-all">' + E(r.otpauth) + '</div>',
      foot: '<button class="btn ghost" data-act="closeModal" type="button">关闭</button>' });
  };
  Q.CLICK.ops2faDisable = async function () {
    await Q.api('/api/x/ops/2fa/disable', 'POST'); Q.toast('已关闭两步验证'); Q.reload();
  };
  Q.CLICK.opsSearch = function () {
    Q.openModal({ title: '全局搜索',
      body: '<div class="field"><input class="input" id="opsSearchInput" placeholder="学生姓名 / 邮箱 / 作业标题 / 考试名称"></div>' +
        '<div id="opsSearchResult" class="ext-list"></div>',
      foot: '<button class="btn primary" data-act="opsDoSearch" type="button">搜索</button>' +
        '<button class="btn ghost" data-act="closeModal" type="button">关闭</button>' });
    setTimeout(function () {
      const el = document.getElementById('opsSearchInput');
      if (el) el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); Q.CLICK.opsDoSearch(); }
      });
    }, 0);
  };
  Q.CLICK.opsDoSearch = async function () {
    const q = (document.getElementById('opsSearchInput') || {}).value || '';
    const r = await Q.api('/api/x/ops/search?q=' + encodeURIComponent(q));
    const box = document.getElementById('opsSearchResult');
    if (box) box.innerHTML = r.items.length ? r.items.map(function (x) {
      return '<div class="ext-item"><span class="badge blue">' + E(x.type) + '</span> <strong>' +
        E(x.label) + '</strong><div class="tiny">' + E(x.sub) + '</div></div>';
    }).join('') : '<div class="tiny">没有匹配结果</div>';
  };
  Q.CLICK.opsDark = function () {
    setPref('dark', pref('dark', '0') === '1' ? '0' : '1'); applyPrefs();
    Q.toast(pref('dark', '0') === '1' ? '已开启深色模式' : '已恢复浅色');
  };
  Q.CLICK.opsFont = function () {
    setPref('big', pref('big', '0') === '1' ? '0' : '1'); applyPrefs();
    Q.toast('字号已切换');
  };
  Q.CLICK.opsContrast = function () {
    setPref('contrast', pref('contrast', '0') === '1' ? '0' : '1'); applyPrefs();
    Q.toast('对比度已切换');
  };
  Q.CLICK.opsLang = function () {
    lang = lang === 'zh' ? 'en' : 'zh'; setPref('lang', lang); applyLang();
    Q.toast(lang === 'zh' ? '已切换为中文' : 'Switched to English');
  };
  Q.FORMS.ops2faForm = async function (f) {
    const fd = new FormData(f);
    await Q.api('/api/x/ops/2fa/verify', 'POST', { code: fd.get('code') });
    Q.toast('两步验证已启用'); Q.reload();
  };
  Q.FORMS.opsBrandForm = async function (f) {
    const fd = new FormData(f);
    await Q.api('/api/x/ops/brand', 'POST', {
      name: fd.get('name'), color: fd.get('color'), logo: fd.get('logo')
    });
    const sel = document.getElementById('opsLangSel');
    if (sel) { lang = sel.value; setPref('lang', lang); applyLang(); }
    Q.toast('品牌设置已保存'); Q.reload();
  };

  /* 顶栏工具按钮 + 偏好恢复 + PWA 注册 */
  setTimeout(function () {
    applyPrefs(); applyLang();
    Q.api('/api/x/ops/brand').then(applyBrand).catch(function () {});
    setTimeout(function () {
      if (Q.S.user && Q.S.user.role === 'teacher') {
        Q.api('/api/x/ops/login-ping', 'POST').catch(function () {});
      }
    }, 1600);
    const bar = document.querySelector('.top-actions');
    if (bar && !document.getElementById('opsTools')) {
      bar.insertAdjacentHTML('afterbegin', '<div class="ext-top" id="opsTools">' +
        '<button class="icon-btn" data-act="opsSearch" title="全局搜索" type="button">' + Q.icon('inbox', 17) + '</button>' +
        '<button class="icon-btn" data-act="opsDark" title="深色模式" type="button">' + Q.icon('sparkle', 17) + '</button>' +
        '<button class="icon-btn" data-act="opsFont" title="大字号" type="button">' + Q.icon('edit', 17) + '</button>' +
        '<button class="icon-btn" data-act="opsContrast" title="高对比度" type="button">' + Q.icon('shield', 17) + '</button>' +
        '<button class="icon-btn" data-act="opsLang" title="中文 / English" type="button">' + Q.icon('book', 17) + '</button>' +
        '</div>');
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/static/sw.js', { scope: '/' }).catch(function () {});
    }
  }, 0);
})();
