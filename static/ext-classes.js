/* 启课 · 扩展模块「班级与协作」—— 通过 window.Qike 注册，app.js 之后同步加载 */
(function () {
  'use strict';
  var Q = window.Qike;
  if (!Q) return;

  /* ---------------------------------------------------------- 样式（ext- 前缀） */
  document.head.insertAdjacentHTML('beforeend',
    '<style>' +
    '.ext-tabs{display:flex;flex-wrap:wrap;gap:6px;border-bottom:1px solid var(--line,#e7e9f0);margin-top:6px}' +
    '.ext-tab{border:0;background:transparent;padding:9px 14px;font-size:13px;font-weight:600;color:var(--ink3,#8a93a6);cursor:pointer;border-bottom:2px solid transparent}' +
    '.ext-tab.on{color:var(--blue,#3b7ddd);border-bottom-color:var(--blue,#3b7ddd)}' +
    '.ext-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:10px 0}' +
    '.ext-hint{font-size:12px;color:var(--ink3,#8a93a6);line-height:1.6;margin:6px 0}' +
    '.ext-actions{display:flex;flex-wrap:wrap;gap:6px;align-items:center}' +
    '.ext-tag{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:600;background:var(--bg2,#eef1f6);color:var(--ink2,#5b647a)}' +
    '.ext-tag.ext-ok{background:rgba(34,197,94,.12);color:#15803d}' +
    '.ext-tag.ext-bad{background:rgba(239,68,68,.10);color:#b91c1c}' +
    '.ext-tag.ext-warn{background:rgba(234,179,8,.16);color:#a16207}' +
    '.ext-linkrow{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line,#eef0f5)}' +
    '.ext-linkrow code{font-size:13px;background:var(--bg2,#f3f5f9);padding:3px 8px;border-radius:6px}' +
    '.ext-danger{background:rgba(239,68,68,.08);color:#b91c1c;border-color:#fecaca}' +
    '.ext-staff-sec{margin-top:16px}' +
    '.ext-group-card{border:1px solid var(--line,#e7e9f0);border-radius:12px;padding:12px 14px;margin:12px 0}' +
    '.ext-members{margin:8px 0}' +
    '.ext-member{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px dashed var(--line,#eef0f5)}' +
    '.ext-list{max-height:34vh;overflow:auto;border:1px solid var(--line,#e7e9f0);border-radius:10px;padding:6px}' +
    '.ext-list label{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;cursor:pointer}' +
    '.ext-list label:hover{background:var(--bg2,#f3f5f9)}' +
    '.ext-join-mask{position:fixed;inset:0;z-index:9999;background:rgba(20,28,45,.55);display:flex;align-items:center;justify-content:center;padding:16px}' +
    '.ext-join-card{width:100%;max-width:440px;background:#fff;border-radius:16px;padding:20px;box-shadow:0 18px 50px rgba(0,0,0,.25)}' +
    '</style>');

  var P = '/api/x/classes';
  var TAB = 'manage';   // classes 页当前选项卡
  var CUR = 0;          // 当前班级偏好
  var CLASSES = [];     // 班级缓存
  var STUDENTS = [];    // 学生缓存
  var GRP_CID = 0;      // 分组页当前班级

  /* ---------------------------------------------------------- 小工具 */
  function esc(v) { return Q.esc(v == null ? '' : v); }
  function fld(label, control) {
    return '<div class="field"><label>' + Q.esc(label) + '</label>' + control + '</div>';
  }
  function txt(name, val, ph) {
    return '<input class="input" name="' + Q.esc(name) + '" value="' +
      Q.attr(val == null ? '' : val) + '" placeholder="' + Q.attr(ph || '') + '">';
  }
  function foot(okAct, okLabel, cls) {
    return '<button class="btn ghost" data-act="closeModal" type="button">取消</button>' +
      '<button class="btn ' + (cls || 'primary') + '" data-act="' + Q.esc(okAct) +
      '" type="button">' + Q.esc(okLabel) + '</button>';
  }
  function dangerNote(t) {
    return '<div class="note ext-danger">' + Q.icon('shield', 15) + ' ' + Q.esc(t) + '</div>';
  }
  function activeClasses() {
    return CLASSES.filter(function (c) { return !c.archived; });
  }
  function classOptions(list, selId) {
    return list.map(function (c) {
      return '<option value="' + Q.esc(c.id) + '"' +
        (String(c.id) === String(selId) ? ' selected' : '') + '>' +
        Q.esc(c.name) + (c.archived ? '（已归档）' : '') + '</option>';
    }).join('');
  }
  function className(cid) {
    var n = '未分班';
    CLASSES.forEach(function (c) { if (c.id === cid) n = c.name; });
    return n;
  }
  async function loadClasses(force) {
    if (CLASSES.length && !force) return CLASSES;
    var r = await Q.api(P + '/');
    CLASSES = r.classes || [];
    return CLASSES;
  }
  async function loadStudents(force) {
    if (STUDENTS.length && !force) return STUDENTS;
    var r = await Q.api(P + '/students');
    STUDENTS = r.students || [];
    return STUDENTS;
  }
  async function loadCurrent() {
    var r = await Q.api(P + '/current');
    CUR = r.class_id || 0;
    return CUR;
  }
  async function loadBase() {
    await Promise.all([loadClasses(true), loadCurrent()]);
  }

  /* ---------------------------------------------------------- classes 页 · 选项卡外壳 */
  async function tabHtml(tab) {
    if (tab === 'join') return await renderJoin();
    if (tab === 'staff') return await renderStaff();
    if (tab === 'summary') return await renderSummary();
    if (tab === 'profiles') return await renderProfiles();
    return await renderManage();
  }
  async function setTab(tab) {
    TAB = tab;
    var panel = Q.$('#classesPanel');
    if (panel) panel.innerHTML = await tabHtml(tab);
    Q.$$('#classesTabs .ext-tab').forEach(function (b) {
      b.classList.toggle('on', b.dataset.tab === tab);
    });
  }
  async function pageClasses() {
    await loadBase();
    var tabs = [
      ['manage', '班级管理'], ['join', '加入审核'], ['staff', '科任协作'],
      ['summary', '跨班汇总'], ['profiles', '学生档案'],
    ];
    var bar = '<div class="ext-tabs" id="classesTabs">' + tabs.map(function (t) {
      return '<button class="ext-tab' + (t[0] === TAB ? ' on' : '') +
        '" data-act="classesSwitchTab" data-tab="' + Q.esc(t[0]) + '" type="button">' +
        Q.esc(t[1]) + '</button>';
    }).join('') + '</div>';
    return '<div class="card"><div class="section-head"><div><h3>班级与协作</h3>' +
        '<div class="desc">多班级、班级码加入审核、科任老师协作、跨班汇总与学生档案。当前班级：<strong>' +
        Q.esc(className(CUR)) + '</strong></div></div></div>' + bar + '</div>' +
      '<div id="classesPanel">' + await tabHtml(TAB) + '</div>';
  }

  /* ---------------------------------------------------------- 班级管理 */
  async function renderManage() {
    var rows = CLASSES.length ? CLASSES.map(function (c) {
      return '<tr>' +
        '<td><strong>' + esc(c.name) + '</strong>' +
          '<div class="tiny">' + esc(c.grade || '—') + ' · ' + esc(c.school || '—') + '</div></td>' +
        '<td>' + (c.archived
          ? '<span class="ext-tag ext-warn">已归档</span>'
          : '<span class="ext-tag ext-ok">进行中</span>') + '</td>' +
        '<td class="mono">' + esc(c.join_code || '—') + '</td>' +
        '<td>' + esc(c.student_count) + ' 人</td>' +
        '<td class="ext-actions">' +
          '<button class="btn ghost sm" data-act="classesCopyJoin" data-code="' + Q.attr(c.join_code || '') + '" type="button">' + Q.icon('copy', 14) + ' 加入链接</button>' +
          '<button class="btn ghost sm" data-act="classesEditClass" data-id="' + Q.esc(c.id) + '" type="button">' + Q.icon('edit', 14) + ' 编辑</button>' +
          '<button class="btn ghost sm" data-act="classesRegenCode" data-id="' + Q.esc(c.id) + '" type="button">' + Q.icon('refresh', 14) + ' 换码</button>' +
          '<button class="btn ' + (c.archived ? 'soft' : 'ghost') + ' sm" data-act="classesArchive" data-id="' + Q.esc(c.id) + '" data-archived="' + Q.esc(c.archived) + '" type="button">' + (c.archived ? '恢复' : '结班归档') + '</button>' +
          '<button class="btn danger sm" data-act="classesDeleteClass" data-id="' + Q.esc(c.id) + '" type="button">' + Q.icon('trash', 14) + ' 删除</button>' +
        '</td></tr>';
    }).join('') : '';
    var curSel = '<select class="select" id="classesCurrentSel">' +
      '<option value="0">未设置</option>' + classOptions(activeClasses(), CUR) + '</select>';
    return '<div class="card"><div class="section-head"><div><h3>班级管理</h3>' +
        '<div class="desc">新建 / 编辑班级、复制班级码加入链接、学生分班与结班归档。</div></div>' +
        '<div class="ext-actions">' +
          '<button class="btn primary" data-act="classesOpenCreate" type="button">' + Q.icon('plus', 15) + ' 新建班级</button>' +
          '<button class="btn soft" data-act="classesOpenAssign" type="button">' + Q.icon('users', 15) + ' 学生分班</button>' +
        '</div></div>' +
        '<div class="ext-toolbar"><span class="tiny">当前班级偏好：</span>' + curSel +
          '<button class="btn soft sm" data-act="classesSaveCurrent" type="button">设为当前</button></div>' +
        (rows ? '<div class="table-wrap"><table class="tbl"><thead><tr>' +
          '<th>班级</th><th>状态</th><th>班级码</th><th>人数</th><th>操作</th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table></div>'
          : '<div class="note">还没有班级，点击「新建班级」开始。</div>') +
        '</div>';
  }

  /* ---------------------------------------------------------- 加入审核 */
  async function renderJoin() {
    var r = await Q.api(P + '/join-requests');
    var reqs = r.requests || [];
    var pending = reqs.filter(function (x) { return x.status === 'pending'; }).length;
    var rows = reqs.length ? reqs.map(function (x) {
      var st = x.status === 'pending' ? '<span class="ext-tag ext-warn">待审核</span>'
        : (x.status === 'approved' ? '<span class="ext-tag ext-ok">已通过</span>'
                                   : '<span class="ext-tag ext-bad">已拒绝</span>');
      var act = x.status === 'pending'
        ? '<button class="btn soft sm" data-act="classesReview" data-id="' + Q.esc(x.id) + '" data-action="approve" type="button">通过</button>' +
          '<button class="btn ghost sm" data-act="classesReview" data-id="' + Q.esc(x.id) + '" data-action="reject" type="button">拒绝</button>'
        : '<span class="tiny">—</span>';
      return '<tr><td><strong>' + esc(x.student_name) + '</strong>' +
        '<div class="tiny">' + esc(x.student_email) + '</div></td>' +
        '<td>' + esc(x.class_name) + '</td><td>' + st + '</td>' +
        '<td class="tiny">' + esc(x.created_at) + '</td>' +
        '<td class="ext-actions">' + act + '</td></tr>';
    }).join('') : '';
    var links = activeClasses().map(function (c) {
      return '<div class="ext-linkrow"><code>' + esc(c.join_code || '—') + '</code>' +
        '<span class="tiny">' + esc(c.name) + '</span>' +
        '<button class="btn ghost sm" data-act="classesCopyJoin" data-code="' + Q.attr(c.join_code || '') + '" type="button">' + Q.icon('copy', 14) + ' 复制加入链接</button></div>';
    }).join('') || '<div class="note">还没有可加入的班级。</div>';
    return '<div class="card"><div class="section-head"><div><h3>班级码与加入链接</h3>' +
        '<div class="desc">把链接发给学生，学生无需账号即可提交加入申请；你在这里审核，通过后再手动添加学生账号。</div></div></div>' +
        links + '</div>' +
      '<div class="card"><div class="section-head"><div><h3>加入申请</h3>' +
        '<div class="desc">待审核 ' + pending + ' 条。</div></div></div>' +
        (rows ? '<div class="table-wrap"><table class="tbl"><thead><tr>' +
          '<th>申请人</th><th>申请班级</th><th>状态</th><th>时间</th><th>操作</th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table></div>'
          : '<div class="note">还没有加入申请。</div>') +
        '</div>';
  }

  /* ---------------------------------------------------------- 科任协作 */
  async function renderStaff() {
    var act = activeClasses();
    var data = await Promise.all(act.map(function (c) {
      return Q.api(P + '/' + c.id + '/staff').then(function (r) {
        return { cls: c, staff: r.staff || [] };
      });
    }));
    var sections = data.length ? data.map(function (d) {
      var rows = d.staff.length ? d.staff.map(function (s) {
        return '<tr><td><strong>' + esc(s.name) + '</strong>' +
          '<div class="tiny">' + esc(s.email) + '</div></td>' +
          '<td>' + esc(s.subject || '—') + '</td>' +
          '<td><span class="ext-tag">' + esc(s.role) + '</span></td>' +
          '<td><button class="btn danger sm" data-act="classesRemoveStaff" data-cid="' + Q.esc(d.cls.id) + '" data-id="' + Q.esc(s.id) + '" type="button">移除</button></td></tr>';
      }).join('') : '<tr><td colspan="4" class="tiny">还没有科任老师。</td></tr>';
      return '<div class="ext-staff-sec"><div class="section-head"><h3>' + esc(d.cls.name) + '</h3></div>' +
        '<div class="table-wrap"><table class="tbl"><thead><tr>' +
        '<th>老师</th><th>科目</th><th>角色</th><th>操作</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }).join('') : '<div class="note">还没有进行中的班级，请先新建班级。</div>';
    var form = '<form id="fClassesStaffAdd" class="form-grid">' +
      fld('班级', '<select class="select" name="class_id">' + classOptions(act, 0) + '</select>') +
      fld('老师邮箱', txt('email', '', '已注册老师的邮箱')) +
      fld('任教学科', txt('subject', '', '例如：数学')) +
      '<div class="field"><label>&nbsp;</label><button class="btn primary" type="submit">添加科任老师</button></div>' +
      '</form>';
    return '<div class="card"><div class="section-head"><div><h3>科任协作</h3>' +
        '<div class="desc">按已注册老师的邮箱添加科任老师，可查看与移除（仅班级负责人可管理）。</div></div></div>' +
        (act.length ? form : '<div class="note">请先新建一个进行中的班级。</div>') +
        '</div>' + sections;
  }

  /* ---------------------------------------------------------- 跨班汇总 */
  async function renderSummary() {
    var r = await Q.api(P + '/summary');
    var rows = (r.summary || []).map(function (s) {
      return '<tr><td><strong>' + esc(s.name) + '</strong>' +
        (s.archived ? ' <span class="ext-tag ext-warn">已归档</span>' : '') +
        '<div class="tiny">' + esc(s.grade || '—') + ' ' + esc(s.school || '') + '</div></td>' +
        '<td>' + esc(s.student_count) + '</td>' +
        '<td>' + esc(s.homework_count) + '</td>' +
        '<td>' + (s.avg_score == null ? '—' : esc(s.avg_score)) + '</td></tr>';
    }).join('');
    return '<div class="card"><div class="section-head"><div><h3>跨班汇总</h3>' +
        '<div class="desc">按班级统计学生人数、作业数与平均分（含未分班学生）。</div></div>' +
        '<button class="btn ghost sm" data-act="classesRefresh" type="button">' + Q.icon('refresh', 14) + ' 刷新</button></div>' +
        (rows ? '<div class="table-wrap"><table class="tbl"><thead><tr>' +
          '<th>班级</th><th>学生人数</th><th>作业数</th><th>平均分</th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table></div>'
          : '<div class="note">暂无数据。</div>') + '</div>';
  }

  /* ---------------------------------------------------------- 学生档案 */
  async function renderProfiles() {
    var list = await loadStudents();
    var rows = list.length ? list.map(function (s) {
      return '<tr><td><strong>' + esc(s.name) + '</strong>' +
        '<div class="tiny">' + esc(s.email) + '</div></td>' +
        '<td class="tiny">' + esc(s.student_no || '—') + '</td>' +
        '<td>' + esc(className(s.class_id)) + '</td>' +
        '<td>' + esc(s.parent_contact || '—') + '</td>' +
        '<td>' + esc(s.note || '—') + '</td>' +
        '<td class="tiny">' + esc(s.enrolled_at || '—') + '</td>' +
        '<td><button class="btn soft sm" data-act="classesEditProfile" data-id="' + Q.esc(s.id) + '" type="button">' + Q.icon('edit', 14) + ' 编辑档案</button></td></tr>';
    }).join('') : '';
    return '<div class="card"><div class="section-head"><div><h3>学生档案</h3>' +
        '<div class="desc">维护家长联系方式、备注与入学时间。</div></div></div>' +
        (rows ? '<div class="table-wrap"><table class="tbl"><thead><tr>' +
          '<th>学生</th><th>学号</th><th>班级</th><th>家长联系</th><th>备注</th><th>入学时间</th><th>操作</th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table></div>'
          : '<div class="note">还没有学生，请先在「学生管理」添加。</div>') + '</div>';
  }

  /* ---------------------------------------------------------- groups 页 · 学生分组 */
  async function groupsBoxHtml(cid) {
    if (!cid) return '<div class="note">请先新建并选择一个进行中的班级。</div>';
    var r = await Q.api(P + '/groups/' + cid);
    var groups = r.groups || [];
    if (!groups.length) return '<div class="note">还没有分组，点击「新建分组」创建。</div>';
    return groups.map(function (g) {
      var members = g.members.length ? g.members.map(function (m) {
        return '<div class="ext-member"><span>' +
          (m.is_leader ? '<span class="ext-tag ext-ok">组长</span> ' : '') + esc(m.name) +
          '</span><span class="ext-actions">' +
          '<button class="btn ghost sm" data-act="classesToggleLeader" data-gid="' + Q.esc(g.id) + '" data-sid="' + Q.esc(m.student_id) + '" data-leader="' + Q.esc(m.is_leader) + '" type="button">' + (m.is_leader ? '取消组长' : '设为组长') + '</button>' +
          '<button class="btn danger sm" data-act="classesRemoveMember" data-gid="' + Q.esc(g.id) + '" data-sid="' + Q.esc(m.student_id) + '" type="button">移除</button>' +
          '</span></div>';
      }).join('') : '<div class="tiny">还没有成员。</div>';
      return '<div class="ext-group-card"><div class="section-head"><h3>' + esc(g.name) + '</h3>' +
        '<span class="ext-actions">' +
          '<button class="btn ghost sm" data-act="classesRenameGroup" data-id="' + Q.esc(g.id) + '" data-name="' + Q.attr(g.name) + '" type="button">重命名</button>' +
          '<button class="btn danger sm" data-act="classesDeleteGroup" data-id="' + Q.esc(g.id) + '" type="button">删除</button>' +
        '</span></div>' +
        '<div class="ext-members">' + members + '</div>' +
        '<button class="btn soft sm" data-act="classesOpenAddMembers" data-gid="' + Q.esc(g.id) + '" type="button">' + Q.icon('plus', 14) + ' 添加成员</button>' +
        '</div>';
    }).join('');
  }
  async function refreshGroupsBox() {
    var box = Q.$('#classesGroupsBox');
    if (box) box.innerHTML = await groupsBoxHtml(GRP_CID);
  }
  async function pageGroups() {
    await loadBase();
    await loadStudents(true);
    var act = activeClasses();
    var valid = act.some(function (c) { return c.id === GRP_CID; });
    if (!valid) GRP_CID = act.length ? act[0].id : 0;
    var sel = '<select class="select" id="classesGroupCid">' + classOptions(act, GRP_CID) + '</select>';
    return '<div class="card"><div class="section-head"><div><h3>学生分组</h3>' +
        '<div class="desc">按班级建立小组，添加本班成员并可标记 / 取消组长。</div></div></div>' +
        '<div class="ext-toolbar"><span class="tiny">选择班级：</span>' + sel +
          '<button class="btn soft sm" data-act="classesLoadGroups" type="button">加载分组</button>' +
          '<button class="btn primary sm" data-act="classesOpenGroupCreate" type="button">' + Q.icon('plus', 14) + ' 新建分组</button>' +
        '</div>' +
        '<div id="classesGroupsBox">' + await groupsBoxHtml(GRP_CID) + '</div></div>';
  }

  /* ---------------------------------------------------------- 弹窗 */
  function openCreate() {
    Q.openModal({
      title: '新建班级',
      body: '<form id="fClassesCreate" class="form-grid">' +
        fld('班级名称 *', txt('name', '', '例如：高三（2）班')) +
        fld('年级', txt('grade', '', '例如：高三')) +
        fld('学校', txt('school', '', '例如：实验中学')) +
        '</form>',
      foot: foot('classesSubmitCreate', '创建班级', 'primary'),
    });
  }
  function openEdit(el) {
    var c = CLASSES.find(function (x) { return String(x.id) === String(el.dataset.id); });
    if (!c) return;
    Q.openModal({
      title: '编辑班级',
      body: '<form id="fClassesEdit" class="form-grid">' +
        '<input type="hidden" name="class_id" value="' + Q.attr(c.id) + '">' +
        fld('班级名称 *', txt('name', c.name, '')) +
        fld('年级', txt('grade', c.grade, '')) +
        fld('学校', txt('school', c.school, '')) +
        '</form>',
      foot: foot('classesSubmitEdit', '保存', 'primary'),
    });
  }
  async function openAssign() {
    try {
      var list = await loadStudents();
      var opts = '<option value="0">未分班</option>' + classOptions(activeClasses(), 0);
      var picks = list.length ? list.map(function (s) {
        return '<label><input type="checkbox" name="classes_sid" value="' + Q.esc(s.id) + '"> ' +
          esc(s.name) + ' <span class="tiny">' + esc(s.student_no || s.email) + '</span></label>';
      }).join('') : '<div class="note">还没有学生。</div>';
      Q.openModal({
        title: '学生分班', wide: true,
        body: '<form id="fClassesAssign">' +
          fld('目标班级', '<select class="select" name="class_id">' + opts + '</select>') +
          '<div class="ext-hint">勾选要分配的学生，统一设置到所选班级（选「未分班」可移出班级）。</div>' +
          '<div class="ext-list">' + picks + '</div></form>',
        foot: foot('classesSubmitAssign', '保存分配', 'primary'),
      });
    } catch (e) { Q.fail(e); }
  }
  function editProfile(el) {
    var s = STUDENTS.find(function (x) { return String(x.id) === String(el.dataset.id); });
    if (!s) return;
    // openModal 会自行 esc 标题，这里传原文即可。
    Q.openModal({
      title: '学生档案 · ' + s.name,
      body: '<form id="fClassesProfile" class="form-grid">' +
        '<input type="hidden" name="student_id" value="' + Q.attr(s.id) + '">' +
        fld('家长联系方式', txt('parent_contact', s.parent_contact, '例如：家长手机号')) +
        fld('入学时间', txt('enrolled_at', s.enrolled_at, '例如：2026-09-01')) +
        fld('备注', '<textarea class="input" name="note" rows="3" placeholder="选填">' + Q.esc(s.note || '') + '</textarea>') +
        '</form>',
      foot: foot('classesSubmitProfile', '保存档案', 'primary'),
    });
  }
  function openGroupCreate() {
    if (!GRP_CID) { Q.toast('请先新建并选择一个班级', 'err'); return; }
    Q.openModal({
      title: '新建分组',
      body: '<form id="fClassesGroupCreate" class="form-grid">' +
        fld('分组名称 *', txt('name', '', '例如：第一组')) + '</form>',
      foot: foot('classesSubmitGroupCreate', '创建', 'primary'),
    });
  }
  function openRenameGroup(el) {
    Q.openModal({
      title: '重命名分组',
      body: '<form id="fClassesGroupRename" class="form-grid">' +
        '<input type="hidden" name="group_id" value="' + Q.attr(el.dataset.id) + '">' +
        fld('分组名称 *', txt('name', el.dataset.name, '')) + '</form>',
      foot: foot('classesSubmitGroupRename', '保存', 'primary'),
    });
  }
  function openAddMembers(el) {
    var stu = STUDENTS.filter(function (s) { return s.class_id === GRP_CID; });
    var list = stu.length ? stu.map(function (s) {
      return '<label><input type="checkbox" name="classes_gm" value="' + Q.esc(s.id) + '"> ' +
        esc(s.name) + ' <span class="tiny">' + esc(s.student_no || s.email) + '</span></label>';
    }).join('') : '<div class="note">本班暂无学生。</div>';
    Q.openModal({
      title: '添加成员到分组',
      body: '<form id="fClassesAddMembers">' +
        '<input type="hidden" name="group_id" value="' + Q.attr(el.dataset.gid) + '">' +
        '<div class="ext-list">' + list + '</div></form>',
      foot: foot('classesSubmitAddMembers', '添加勾选学生', 'primary'),
    });
  }

  /* ---------------------------------------------------------- CLICK 动作（classes 前缀） */
  Q.CLICK['classesSwitchTab'] = function (el) { return setTab(el.dataset.tab); };
  Q.CLICK['classesRefresh'] = function () { return Q.reload(); };
  Q.CLICK['classesOpenCreate'] = function () { return openCreate(); };
  Q.CLICK['classesEditClass'] = function (el) { return openEdit(el); };
  Q.CLICK['classesOpenAssign'] = function () { return openAssign(); };
  Q.CLICK['classesEditProfile'] = function (el) { return editProfile(el); };
  Q.CLICK['classesOpenGroupCreate'] = function () { return openGroupCreate(); };
  Q.CLICK['classesRenameGroup'] = function (el) { return openRenameGroup(el); };
  Q.CLICK['classesOpenAddMembers'] = function (el) { return openAddMembers(el); };

  Q.CLICK['classesCopyJoin'] = function (el) {
    var code = el.dataset.code || '';
    if (!code) { Q.toast('该班级暂无班级码', 'err'); return; }
    Q.copyText(location.origin + location.pathname + '#join=' + encodeURIComponent(code));
    Q.toast('加入链接已复制');
  };
  Q.CLICK['classesSaveCurrent'] = async function () {
    var sel = Q.$('#classesCurrentSel');
    var cid = sel ? Number(sel.value) : 0;
    await Q.api(P + '/current', 'POST', { class_id: cid });
    CUR = cid;
    Q.toast('已设为当前班级');
    await Q.reload();
  };
  Q.CLICK['classesRegenCode'] = async function (el) {
    await Q.api(P + '/' + el.dataset.id + '/join-code', 'POST');
    Q.toast('班级码已更新');
    await Q.reload();
  };
  Q.CLICK['classesArchive'] = async function (el) {
    var next = el.dataset.archived === '1' ? 0 : 1;
    await Q.api(P + '/' + el.dataset.id + '/archive', 'PUT', { archived: next });
    Q.toast(next ? '已结班归档' : '已恢复为进行中');
    await Q.reload();
  };
  Q.CLICK['classesDeleteClass'] = function (el) {
    var id = el.dataset.id;
    Q.openModal({
      title: '删除班级',
      body: dangerNote('删除会解绑该班学生（改为未分班），并删除其加入申请、协作与分组数据，且不可恢复。'),
      foot: '<button class="btn ghost" data-act="closeModal" type="button">取消</button>' +
        '<button class="btn danger" data-act="classesDeleteClassConfirm" data-id="' + Q.esc(id) + '" type="button">确认删除</button>',
    });
  };
  Q.CLICK['classesDeleteClassConfirm'] = async function (el) {
    await Q.api(P + '/' + el.dataset.id, 'DELETE');
    Q.closeModal(); Q.toast('班级已删除');
    await Q.reload();
  };
  Q.CLICK['classesReview'] = async function (el) {
    await Q.api(P + '/join-requests/' + el.dataset.id + '/review', 'POST',
                { action: el.dataset.action });
    Q.toast(el.dataset.action === 'approve' ? '已通过' : '已拒绝');
    await Q.reload();
  };
  Q.CLICK['classesRemoveStaff'] = async function (el) {
    await Q.api(P + '/' + el.dataset.cid + '/staff/' + el.dataset.id, 'DELETE');
    Q.toast('已移除科任老师');
    await Q.reload();
  };
  Q.CLICK['classesLoadGroups'] = async function () {
    var sel = Q.$('#classesGroupCid');
    GRP_CID = sel ? Number(sel.value) : 0;
    await refreshGroupsBox();
  };
  Q.CLICK['classesDeleteGroup'] = function (el) {
    var id = el.dataset.id;
    Q.openModal({
      title: '删除分组',
      body: dangerNote('删除后该分组及其成员关系将被移除，不可恢复。'),
      foot: '<button class="btn ghost" data-act="closeModal" type="button">取消</button>' +
        '<button class="btn danger" data-act="classesDeleteGroupConfirm" data-id="' + Q.esc(id) + '" type="button">确认删除</button>',
    });
  };
  Q.CLICK['classesDeleteGroupConfirm'] = async function (el) {
    await Q.api(P + '/groups/' + el.dataset.id, 'DELETE');
    Q.closeModal(); Q.toast('分组已删除');
    await refreshGroupsBox();
  };
  Q.CLICK['classesToggleLeader'] = async function (el) {
    var next = el.dataset.leader === '1' ? 0 : 1;
    await Q.api(P + '/groups/' + el.dataset.gid + '/members/' + el.dataset.sid,
                'PUT', { is_leader: next });
    Q.toast(next ? '已设为组长' : '已取消组长');
    await refreshGroupsBox();
  };
  Q.CLICK['classesRemoveMember'] = async function (el) {
    await Q.api(P + '/groups/' + el.dataset.gid + '/members/' + el.dataset.sid, 'DELETE');
    Q.toast('已移除成员');
    await refreshGroupsBox();
  };
  Q.CLICK['classesJoinClose'] = function () {
    var r = Q.$('#classesJoinRoot');
    if (r) r.remove();
    if (location.hash.indexOf('#join=') === 0) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  };

  /* ---------------------------------------------------------- FORMS（classes 前缀） */
  Q.FORMS['fClassesCreate'] = async function (f) {
    var fd = new FormData(f);
    var name = String(fd.get('name') || '').trim();
    if (!name) throw new Error('请填写班级名称');
    await Q.api(P + '/', 'POST', {
      name: name, grade: String(fd.get('grade') || '').trim(),
      school: String(fd.get('school') || '').trim(),
    });
    Q.closeModal(); Q.toast('班级已创建'); await Q.reload();
  };
  Q.FORMS['fClassesEdit'] = async function (f) {
    var fd = new FormData(f);
    var cid = Number(fd.get('class_id'));
    var name = String(fd.get('name') || '').trim();
    if (!name) throw new Error('请填写班级名称');
    await Q.api(P + '/' + cid, 'PUT', {
      name: name, grade: String(fd.get('grade') || '').trim(),
      school: String(fd.get('school') || '').trim(),
    });
    Q.closeModal(); Q.toast('已保存'); await Q.reload();
  };
  Q.FORMS['fClassesAssign'] = async function (f) {
    var fd = new FormData(f);
    var ids = Array.from(f.querySelectorAll('input[name="classes_sid"]:checked'))
      .map(function (x) { return Number(x.value); });
    if (!ids.length) throw new Error('请至少勾选一位学生');
    var r = await Q.api(P + '/students/assign', 'POST',
                        { class_id: Number(fd.get('class_id') || 0), student_ids: ids });
    Q.closeModal(); Q.toast('已分配 ' + r.updated + ' 位学生'); await Q.reload();
  };
  Q.FORMS['fClassesStaffAdd'] = async function (f) {
    var fd = new FormData(f);
    var cid = Number(fd.get('class_id') || 0);
    if (!cid) throw new Error('请先新建一个进行中的班级');
    var email = String(fd.get('email') || '').trim();
    if (!email) throw new Error('请填写老师邮箱');
    await Q.api(P + '/' + cid + '/staff', 'POST', {
      email: email, subject: String(fd.get('subject') || '').trim(),
    });
    Q.toast('已添加科任老师'); await Q.reload();
  };
  Q.FORMS['fClassesProfile'] = async function (f) {
    var fd = new FormData(f);
    await Q.api(P + '/students/' + Number(fd.get('student_id')), 'PUT', {
      parent_contact: String(fd.get('parent_contact') || '').trim(),
      note: String(fd.get('note') || '').trim(),
      enrolled_at: String(fd.get('enrolled_at') || '').trim(),
    });
    Q.closeModal(); Q.toast('档案已保存'); await Q.reload();
  };
  Q.FORMS['fClassesGroupCreate'] = async function (f) {
    var fd = new FormData(f);
    var name = String(fd.get('name') || '').trim();
    if (!name) throw new Error('请填写分组名称');
    if (!GRP_CID) throw new Error('请先选择一个班级');
    await Q.api(P + '/groups/' + GRP_CID, 'POST', { name: name });
    Q.closeModal(); Q.toast('分组已创建'); await refreshGroupsBox();
  };
  Q.FORMS['fClassesGroupRename'] = async function (f) {
    var fd = new FormData(f);
    var name = String(fd.get('name') || '').trim();
    if (!name) throw new Error('请填写分组名称');
    await Q.api(P + '/groups/' + Number(fd.get('group_id')), 'PUT', { name: name });
    Q.closeModal(); Q.toast('已重命名'); await refreshGroupsBox();
  };
  Q.FORMS['fClassesAddMembers'] = async function (f) {
    var fd = new FormData(f);
    var ids = Array.from(f.querySelectorAll('input[name="classes_gm"]:checked'))
      .map(function (x) { return Number(x.value); });
    if (!ids.length) throw new Error('请至少勾选一位学生');
    await Q.api(P + '/groups/' + Number(fd.get('group_id')) + '/members', 'POST',
                { student_ids: ids });
    Q.closeModal(); Q.toast('已添加成员'); await refreshGroupsBox();
  };
  Q.FORMS['fClassesJoin'] = async function (f) {
    var fd = new FormData(f);
    var name = String(fd.get('student_name') || '').trim();
    var email = String(fd.get('student_email') || '').trim();
    if (!name) throw new Error('请填写姓名');
    if (!email) throw new Error('请填写邮箱');
    // 匿名访客也可能在 bootstrap 完成前提交，兜底取一次 csrf。
    if (!Q.S.csrf) {
      var b = await Q.api('/api/bootstrap');
      Q.S.csrf = b.csrf;
    }
    await Q.api(P + '/join/' + encodeURIComponent(joinCodeFromLocation()), 'POST',
                { student_name: name, student_email: email });
    f.classList.add('hidden');
    var info = Q.$('#classesJoinInfo');
    if (info) info.textContent = '申请已提交，请等待老师审核。你可以关闭本窗口。';
  };

  /* 弹窗内在 form 外的提交按钮 -> 触发对应表单 */
  Q.SUBMIT_TRIGGER['classesSubmitCreate'] = 'fClassesCreate';
  Q.SUBMIT_TRIGGER['classesSubmitEdit'] = 'fClassesEdit';
  Q.SUBMIT_TRIGGER['classesSubmitAssign'] = 'fClassesAssign';
  Q.SUBMIT_TRIGGER['classesSubmitProfile'] = 'fClassesProfile';
  Q.SUBMIT_TRIGGER['classesSubmitGroupCreate'] = 'fClassesGroupCreate';
  Q.SUBMIT_TRIGGER['classesSubmitGroupRename'] = 'fClassesGroupRename';
  Q.SUBMIT_TRIGGER['classesSubmitAddMembers'] = 'fClassesAddMembers';

  /* ---------------------------------------------------------- 公开加入覆盖层 */
  function joinCodeFromLocation() {
    var m = (location.hash || '').match(/^#join=(.+)$/);
    if (m) return decodeURIComponent(m[1]);
    m = (location.search || '').match(/[?&]join=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }
  function initJoinOverlay() {
    var code = joinCodeFromLocation();
    if (!code) return;
    var root = document.createElement('div');
    root.id = 'classesJoinRoot';
    root.className = 'ext-join-mask';
    document.body.appendChild(root);
    root.innerHTML = '<div class="ext-join-card card">' +
      '<div class="section-head"><div><h3>申请加入班级</h3>' +
        '<div class="desc" id="classesJoinInfo">正在读取班级信息…</div></div>' +
        '<button class="btn ghost sm" data-act="classesJoinClose" type="button">关闭</button></div>' +
      '<form id="fClassesJoin">' +
        '<div class="form-grid">' +
          fld('你的姓名 *', txt('student_name', '', '例如：李明')) +
          fld('邮箱 *', txt('student_email', '', '用于老师联系你')) +
        '</div>' +
        '<div class="ext-hint">提交后仅写入加入申请，不会创建账号，也不会展示班级内部信息。</div>' +
        '<button class="btn primary" type="submit">提交申请</button>' +
      '</form></div>';
    Q.api(P + '/join/' + encodeURIComponent(code)).then(function (r) {
      var info = Q.$('#classesJoinInfo');
      if (info) {
        info.textContent = '班级：' + r.name +
          (r.grade ? ' · ' + r.grade : '') + (r.school ? ' · ' + r.school : '');
      }
    }).catch(function (e) {
      var info = Q.$('#classesJoinInfo');
      if (info) info.textContent = e.message || '班级码无效';
      var f = Q.$('#fClassesJoin');
      if (f) f.classList.add('hidden');
    });
  }

  /* ---------------------------------------------------------- 注册页面 / 导航（最多 2 个） */
  Q.PAGES['teacher:classes'] = pageClasses;
  Q.PAGES['teacher:groups'] = pageGroups;
  Q.NAV.teacher.push({ id: 'classes', label: '班级', icon: 'school', title: '班级与协作' });
  Q.NAV.teacher.push({ id: 'groups', label: '分组', icon: 'users', title: '学生分组' });

  initJoinOverlay();
})();
