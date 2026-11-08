/* 启课 · 全局动效与体验优化（零侵入：只观察 #pageContent 的整体替换） */
(function () {
  const Q = window.Qike; if (!Q) return;
  const E = Q.esc;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let timer = null;

  /* ---------- 骨架屏：把「正在加载…」换成有呼吸感的占位块 ---------- */
  function skeleton(el) {
    if (!el.querySelector('.loading')) return false;
    el.innerHTML = '<div class="anim-skel-wrap" aria-label="正在加载">' +
      '<div class="anim-skel r1"></div><div class="anim-skel r2"></div>' +
      '<div class="anim-skel r3"></div><div class="anim-skel r4"></div></div>';
    return true;
  }

  /* ---------- 数字滚动 ---------- */
  function countUp(el) {
    const raw = (el.textContent || '').trim();
    if (!/^\d+(\.\d+)?$/.test(raw) || el.dataset.animNum === '1') return;
    el.dataset.animNum = '1';
    el.classList.add('anim-num');
    const target = parseFloat(raw);
    const decimals = (raw.split('.')[1] || '').length;
    if (reduce || target === 0) return;
    const dur = 720, t0 = performance.now();
    (function step(t) {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toFixed(decimals);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = raw;
    })(t0);
  }

  /* ---------- 单次页面增强 ---------- */
  function enhance() {
    const root = document.getElementById('pageContent');
    if (!root || skeleton(root)) return;

    // 1) 块级元素错峰入场（过滤嵌套，避免父子同时抖动）
    const blocks = Array.from(root.querySelectorAll('.card, .stat, .hw-card, .notice-item, .ext-item'))
      .filter(function (el) {
        return !el.parentElement || !el.parentElement.closest('.card, .stat, .hw-card, .ext-item');
      });
    blocks.slice(0, 24).forEach(function (el, i) {
      if (el.dataset.animRise === '1') return;
      el.dataset.animRise = '1';
      el.style.animationDelay = (i * 42) + 'ms';
      el.classList.add('anim-rise');
    });
    // 表格行
    Array.from(root.querySelectorAll('.tbl tbody tr')).slice(0, 30).forEach(function (el, i) {
      if (el.dataset.animRise === '1') return;
      el.dataset.animRise = '1';
      el.style.animationDelay = (120 + i * 24) + 'ms';
      el.classList.add('anim-rise');
    });
    // 前几张卡片扫光
    Array.from(root.querySelectorAll('.card')).slice(0, 3).forEach(function (el, i) {
      if (el.dataset.animSheen === '1') return;
      el.dataset.animSheen = '1';
      el.style.setProperty('animation-delay', '0ms');
      el.classList.add('anim-sheen');
      setTimeout(function () { el.classList.remove('anim-sheen'); }, 1400 + i * 120);
    });

    // 2) 统计数字滚动
    root.querySelectorAll('.stat .num').forEach(countUp);

    // 3) 进度条 / 分布条 / 趋势柱生长
    if (!reduce) {
      root.querySelectorAll('.progress i, .dist-track i, .ext-bar .track i').forEach(function (el, i) {
        if (el.dataset.animBar === '1') return;
        el.dataset.animBar = '1';
        el.style.animationDelay = (140 + i * 55) + 'ms';
        el.classList.add('anim-grow-x');
      });
      root.querySelectorAll('.trend-track i').forEach(function (el, i) {
        if (el.dataset.animBar === '1') return;
        el.dataset.animBar = '1';
        el.style.animationDelay = (140 + i * 70) + 'ms';
        el.classList.add('anim-grow-y');
      });
    }

    // 4) 长表格自动分页
    root.querySelectorAll('.tbl').forEach(function (tbl) {
      const body = tbl.tBodies[0];
      if (!body || body.rows.length <= 20 || tbl.dataset.animPaged === '1') return;
      tbl.dataset.animPaged = '1';
      const rows = Array.from(body.rows);
      rows.slice(20).forEach(function (r) { r.style.display = 'none'; });
      const box = document.createElement('div');
      box.className = 'anim-more';
      box.innerHTML = '<button class="btn ghost sm" data-act="animMore" type="button">' +
        '显示全部 ' + rows.length + ' 行</button>';
      tbl.parentElement.insertBefore(box, tbl.nextSibling);
      box.querySelector('button').addEventListener('click', function () {
        rows.forEach(function (r) { r.style.display = ''; });
        box.remove();
      });
    });

    rankBadge();
  }

  /* ---------- 学生端班级排名（老师开启开关后才显示） ---------- */
  async function rankBadge() {
    if (!Q.S.user || Q.S.user.role !== 'student' || Q.S.page !== 'scores') return;
    const root = document.getElementById('pageContent');
    if (!root || root.querySelector('.anim-rank')) return;
    const r = await Q.api('/api/x/scores/my-rank').catch(function () { return {}; });
    if (!r.show_rank || !r.rank) return;
    const cur = document.getElementById('pageContent');
    if (!cur || cur.querySelector('.anim-rank')) return;
    cur.insertAdjacentHTML('afterbegin',
      '<div class="card anim-rank anim-rise" style="margin-bottom:16px">' +
        '<div class="row spread"><div><h3 style="margin:0">班级排名</h3>' +
        '<div class="tiny">按全部考试的百分制平均计算 · 由老师决定是否公开</div></div>' +
        '<div style="font-size:26px;font-weight:800;color:var(--blue-dark);white-space:nowrap">' +
        '第 ' + E(r.rank) + ' / ' + E(r.total) + ' 名</div></div></div>');
  }

  /* ---------- 观察页面整体替换（不观察 subtree，避免数字滚动自触发） ---------- */
  function watch() {
    const root = document.getElementById('pageContent');
    if (!root) { setTimeout(watch, 200); return; }
    const obs = new MutationObserver(function () {
      clearTimeout(timer);
      timer = setTimeout(enhance, 60);
    });
    obs.observe(root, { childList: true });
    enhance();
  }

  /* ---------- 按钮涟漪 ---------- */
  document.addEventListener('pointerdown', function (e) {
    const btn = e.target.closest && e.target.closest('.btn');
    if (!btn || reduce || btn.disabled) return;
    const r = btn.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 1.25;
    const sp = document.createElement('span');
    sp.className = 'anim-ripple';
    sp.style.width = sp.style.height = size + 'px';
    sp.style.left = (e.clientX - r.left - size / 2) + 'px';
    sp.style.top = (e.clientY - r.top - size / 2) + 'px';
    btn.appendChild(sp);
    setTimeout(function () { sp.remove(); }, 620);
  });

  /* ---------- 回到顶部 ---------- */
  const topBtn = document.createElement('button');
  topBtn.className = 'anim-top';
  topBtn.type = 'button';
  topBtn.setAttribute('data-act', 'animTop');
  topBtn.title = '回到顶部';
  topBtn.innerHTML = Q.icon('arrow', 18);
  document.body.appendChild(topBtn);
  window.addEventListener('scroll', function () {
    topBtn.classList.toggle('on', (window.scrollY || document.documentElement.scrollTop) > 380);
  }, { passive: true });
  Q.CLICK.animTop = function () {
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  /* ---------- 快捷键 ---------- */
  function showKeys() {
    Q.openModal({
      title: '键盘快捷键',
      body: '<div class="anim-keys">' +
        '<kbd>/</kbd><span>打开全局搜索</span>' +
        '<kbd>Esc</kbd><span>关闭当前弹窗</span>' +
        '<kbd>?</kbd><span>显示本帮助</span>' +
        '<kbd>R</kbd><span>刷新当前页面（不在输入框内时）</span>' +
        '</div>',
      foot: '<button class="btn primary" data-act="closeModal" type="button">知道了</button>'
    });
  }
  Q.CLICK.animKeys = showKeys;
  document.addEventListener('keydown', function (e) {
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
    if (e.key === 'Escape') {
      if (document.querySelector('.modal-mask')) Q.closeModal();
      return;
    }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/') {
      e.preventDefault();
      if (Q.CLICK.opsSearch) Q.CLICK.opsSearch();
    } else if (e.key === '?') {
      e.preventDefault(); showKeys();
    } else if (e.key === 'r' || e.key === 'R') {
      if (Q.S.user) { e.preventDefault(); Q.reload(); }
    }
  });

  /* ---------- 侧栏分组：扩展功能收进「更多工具」，默认折叠 ---------- */
  const EXT_NAV = ['batch', 'dataio', 'classes', 'groups', 'quiz', 'scoretools',
                   'noticex', 'tools', 'annotatex'];
  const STU_EXT = ['quizdo', 'msgx', 'submitx'];
  const ALL_EXT = EXT_NAV.concat(STU_EXT);

  function applyNavGroup() {
    const nav = document.getElementById('sideNav');
    if (!nav) return;
    const collapsed = localStorage.getItem('qike.navMore') !== '1';
    nav.querySelectorAll('[data-act="nav"]').forEach(function (b) {
      if (ALL_EXT.indexOf(b.dataset.page) >= 0) b.style.display = collapsed ? 'none' : '';
    });
    const chev = nav.querySelector('.anim-nav-group .chev');
    if (chev) chev.textContent = collapsed ? '▸' : '▾';
    const lab = nav.querySelector('.anim-nav-group .lab');
    if (lab) lab.textContent = collapsed ? '更多工具（' + ALL_EXT.length + '）' : '扩展工具';
  }
  function groupNav() {
    const nav = document.getElementById('sideNav');
    if (!nav || nav.querySelector('.anim-nav-group')) return;
    const first = nav.querySelector('[data-page="' + EXT_NAV[0] + '"]') ||
                  nav.querySelector('[data-page="' + STU_EXT[0] + '"]');
    if (!first) return;
    const title = document.createElement('button');
    title.type = 'button';
    title.className = 'anim-nav-group';
    title.setAttribute('data-act', 'animNavMore');
    title.innerHTML = '<span class="lab">更多工具</span><span class="chev">▸</span>';
    nav.insertBefore(title, first);
    applyNavGroup();
  }
  Q.CLICK.animNavMore = function () {
    const on = localStorage.getItem('qike.navMore') === '1';
    localStorage.setItem('qike.navMore', on ? '0' : '1');
    applyNavGroup();
  };
  function watchNav() {
    const nav = document.getElementById('sideNav');
    if (!nav) { setTimeout(watchNav, 200); return; }
    new MutationObserver(function () { groupNav(); }).observe(nav, { childList: true });
    groupNav();
  }
  watchNav();
  watch();
})();
