/* 启课 · 扩展模块「批量与效率」—— 通过 window.Qike 注册，app.js 之后同步加载 */
(function () {
  'use strict';
  var Q = window.Qike;
  if (!Q) return;

  /* ---------------------------------------------------------- 样式（ext- 前缀） */
  document.head.insertAdjacentHTML('beforeend',
    '<style>' +
    '.ext-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:10px 0}' +
    '.ext-hint{font-size:12px;color:var(--ink3,#8a93a6);line-height:1.6;margin:6px 0}' +
    '.ext-grid-wrap{max-height:50vh;overflow:auto;border:1px solid var(--line,#e7e9f0);border-radius:10px}' +
    '.ext-grid{width:100%;border-collapse:collapse;font-size:13px}' +
    '.ext-grid th,.ext-grid td{padding:8px 10px;border-bottom:1px solid var(--line,#eef0f5);text-align:left;vertical-align:middle}' +
    '.ext-grid th{position:sticky;top:0;background:var(--bg2,#f7f8fb);z-index:1;white-space:nowrap}' +
    '.ext-grid input.ext-score{width:92px}' +
    '.ext-ok{background:rgba(34,197,94,.10);color:#15803d}' +
    '.ext-bad{background:rgba(239,68,68,.10);color:#b91c1c}' +
    '.ext-warn{background:rgba(234,179,8,.14);color:#a16207}' +
    '.ext-tag{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:600}' +
    '.ext-list{max-height:38vh;overflow:auto;border:1px solid var(--line,#e7e9f0);border-radius:10px;padding:6px}' +
    '.ext-list label{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;cursor:pointer}' +
    '.ext-list label:hover{background:var(--bg2,#f3f5f9)}' +
    '.ext-ta{width:100%;min-height:150px;font-family:ui-monospace,Consolas,monospace;font-size:12px}' +
    '.ext-preview{margin-top:12px}' +
    '.ext-tpl{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid var(--line,#eef0f5)}' +
    '.ext-mt{margin-top:16px}' +
    '.ext-danger{background:rgba(239,68,68,.08);color:#b91c1c;border-color:#fecaca}' +
    '</style>');

  var P = '/api/x/batch';
  var STU = [];          // 老师名下学生（用于匹配 / 勾选）
  var TPLS = [];         // 考试模板缓存
  var PASTE = [];        // ★2 粘贴成绩解析结果
  var IMPORT_ROWS = [];  // 48 标准格式导入预览结果
  var IMPORT_KIND = 'students';
  var REMOVE_IDS = [];   // 6 批量移出待确认的 id

  /* ---------------------------------------------------------- 小工具 */
  function fld(label, control) {
    return '<div class="field"><label>' + Q.esc(label) + '</label>' + control + '</div>';
  }
  function txt(name, val, ph) {
    return '<input class="input" name="' + Q.esc(name) + '" value="' +
      Q.attr(val == null ? '' : val) + '" placeholder="' + Q.attr(ph || '') + '">';
  }
  function num(name, val) {
    return '<input class="input" name="' + Q.esc(name) +
      '" type="number" step="0.1" min="0" value="' + Q.attr(val == null ? 100 : val) + '">';
  }
  function foot(okAct, okLabel, cls) {
    return '<button class="btn ghost" data-act="closeModal" type="button">取消</button>' +
      '<button class="btn ' + (cls || 'primary') + '" data-act="' + Q.esc(okAct) +
      '" type="button">' + Q.esc(okLabel) + '</button>';
  }
  function dangerNote(t) {
    return '<div class="note ext-danger">' + Q.icon('shield', 15) + ' ' + Q.esc(t) + '</div>';
  }
  async function loadStudents(force) {
    if (STU.length && !force) return STU;
    var r = await Q.api(P + '/students');
    STU = r.students || [];
    return STU;
  }
  function pickListHtml(list) {
    if (!list.length) return '<div class="note">还没有学生，先去「学生管理」添加学生吧。</div>';
    return '<div class="ext-toolbar">' +
        '<button class="btn ghost sm" data-act="batchPickAll" type="button">全选</button>' +
        '<button class="btn ghost sm" data-act="batchPickNone" type="button">清空</button>' +
        '<span class="tiny">共 ' + list.length + ' 人</span></div>' +
      '<div class="ext-list">' + list.map(function (s) {
        return '<label><input type="checkbox" name="batch_sid" value="' + Q.esc(s.id) + '">' +
          '<strong>' + Q.esc(s.name) + '</strong>' +
          '<span class="tiny">' + Q.esc(s.student_no || s.email) + '</span></label>';
      }).join('') + '</div>';
  }
  function pickedIds() {
    return Q.$$('input[name="batch_sid"]:checked').map(function (x) { return Number(x.value); });
  }

  /* ★1 批量成绩（密码保护）凭据展示 */
  function showCredentials(list, exam) {
    var body = '<div class="ext-hint">《' + Q.esc(exam) +
      '》为密码保护成绩，请把每行的「代号 + 密码」分别发给对应学生。</div>' +
      '<div class="ext-grid-wrap"><table class="ext-grid"><thead><tr>' +
      '<th>学生</th><th>成绩代号</th><th>查看密码</th></tr></thead><tbody>' +
      list.map(function (c) {
        return '<tr><td>' + Q.esc(c.name) + '</td><td class="mono">' + Q.esc(c.view_code) +
          '</td><td class="mono">' + Q.esc(c.view_password) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    var text = list.map(function (c) {
      return c.name + '  代号：' + c.view_code + '  密码：' + c.view_password;
    }).join('\n');
    Q.openModal({
      title: '批量成绩查看凭据', wide: true, body: body,
      foot: '<button class="btn ghost" data-act="closeModal" type="button">关闭</button>' +
        '<button class="btn primary" data-act="copy" data-text="' + Q.attr(text) +
        '" type="button">复制全部</button>',
    });
  }

  /* ★2 粘贴成绩：前端解析 + 按 姓名/邮箱/学号 匹配 */
  function matchStudent(key) {
    var k = String(key || '').trim().toLowerCase();
    if (!k) return null;
    var s = STU.find(function (x) { return (x.email || '').toLowerCase() === k; });
    if (s) return s;
    s = STU.find(function (x) { return (x.student_no || '').toLowerCase() === k; });
    if (s) return s;
    s = STU.find(function (x) { return (x.name || '').toLowerCase() === k; });
    return s || null;
  }
  function parsePaste(text) {
    var out = [];
    String(text || '').split(/\r?\n/).forEach(function (ln) {
      if (!ln.trim()) return;
      var parts = ln.split(/[,，\t;；]/).map(function (x) { return x.trim(); });
      if (parts.length < 2) {
        out.push({ key: parts[0] || '', score: '', remark: '', match: null, num: 0,
                   error: '至少需要「标识,分数」两列' });
        return;
      }
      var k = parts[0];
      // 跳过表头行（首列像字段名且第二列不是数字）
      if (/^(姓名|name|学号|邮箱|学生|标识)$/i.test(k) && isNaN(Number(parts[1]))) return;
      var score = parts[1];
      var remark = parts.slice(2).join(' ');
      var m = matchStudent(k);
      var numv = Number(score);
      var error = '';
      if (!m) error = '未匹配到学生';
      else if (score === '' || isNaN(numv)) error = '分数不是数字';
      out.push({ key: k, score: score, remark: remark, match: m, num: numv, error: error });
    });
    return out;
  }
  function renderPastePreview(list) {
    var box = Q.$('#batchPastePreview');
    var info = Q.$('#batchPasteInfo');
    if (!box) return;
    if (!list.length) { box.innerHTML = '<div class="note">暂无数据，请先在上方粘贴。</div>'; return; }
    var okCount = list.filter(function (r) { return !r.error && r.match; }).length;
    if (info) info.textContent = '共 ' + list.length + ' 行，可导入 ' + okCount + ' 行';
    var rows = list.map(function (r, i) {
      var ok = !r.error && r.match;
      var cls = ok ? 'ext-ok' : 'ext-bad';
      return '<tr class="' + cls + '"><td>' + (i + 1) + '</td>' +
        '<td>' + Q.esc(r.key) + '</td>' +
        '<td>' + (r.match ? Q.esc(r.match.name) + ' <span class="tiny">' +
          Q.esc(r.match.email) + '</span>' : '—') + '</td>' +
        '<td>' + Q.esc(r.score) + '</td>' +
        '<td>' + Q.esc(r.remark) + '</td>' +
        '<td><span class="ext-tag ' + cls + '">' + Q.esc(ok ? '匹配' : r.error) + '</span></td></tr>';
    }).join('');
    box.innerHTML = '<div class="ext-grid-wrap"><table class="ext-grid"><thead><tr>' +
      '<th>#</th><th>标识</th><th>匹配学生</th><th>分数</th><th>备注</th><th>状态</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  /* 48 标准格式导入预览表格 */
  function renderImportPreview(r) {
    var box = Q.$('#batchImportPreview');
    if (!box) return;
    var items = r.items || [];
    var info = Q.$('#batchImportInfo');
    if (info) info.textContent = '共 ' + items.length + ' 行 · 可新增 ' + (r.ok || 0) +
      ' · 更新 ' + (r.update || 0) + ' · 错误 ' + (r.bad || 0);
    if (!items.length) { box.innerHTML = '<div class="note">没有解析到数据行。</div>'; return; }
    var rows = items.map(function (it, i) {
      var cls = it.status === 'error' ? 'ext-bad' :
        (it.status === 'update' ? 'ext-warn' : 'ext-ok');
      var label = it.status === 'error' ? '错误' :
        (it.status === 'update' ? '更新' : '可导入');
      return '<tr class="' + cls + '"><td>' + (i + 1) + '</td>' +
        '<td>' + Q.esc((it.cols || []).join(' | ')) + '</td>' +
        '<td><span class="ext-tag ' + cls + '">' + label + '</span></td>' +
        '<td>' + Q.esc(it.msg || '') + '</td></tr>';
    }).join('');
    box.innerHTML = '<div class="ext-grid-wrap"><table class="ext-grid"><thead><tr>' +
      '<th>#</th><th>原始行</th><th>状态</th><th>说明</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  /* ---------------------------------------------------------- 页面 */
  async function pageBatch() {
    var res = await Promise.all([loadStudents(true), Q.api(P + '/templates')]);
    var list = res[0], tpls = res[1].templates || [];
    return '<div class="card"><div class="section-head"><div><h3>成绩批量录入</h3>' +
        '<div class="desc">全班一张表格逐格填分，一次保存；也可直接粘贴 Excel / CSV 导入。</div></div></div>' +
      '<div class="row wrap">' +
        '<button class="btn primary" data-act="batchOpenGrid" type="button">' +
          Q.icon('grid', 15) + ' 全班成绩表格</button>' +
        '<button class="btn soft" data-act="batchOpenPaste" type="button">' +
          Q.icon('upload', 15) + ' 粘贴导入成绩</button>' +
        '<button class="btn ghost" data-act="batchOpenTemplates" type="button">' +
          Q.icon('book', 15) + ' 考试模板（' + tpls.length + '）</button>' +
      '</div></div>' +
      '<div class="card"><div class="section-head"><div><h3>学生批量操作</h3>' +
        '<div class="desc">当前共 ' + list.length + ' 位学生，所有操作都会校验归属。</div></div></div>' +
      '<div class="row wrap">' +
        '<button class="btn soft" data-act="batchOpenReset" type="button">' +
          Q.icon('key', 15) + ' 批量重置密码</button>' +
        '<button class="btn soft" data-act="batchOpenEdit" type="button">' +
          Q.icon('edit', 15) + ' 批量改学号/班级</button>' +
        '<button class="btn danger" data-act="batchOpenRemove" type="button">' +
          Q.icon('trash', 15) + ' 批量移出</button>' +
        '<button class="btn soft" data-act="batchOpenMessage" type="button">' +
          Q.icon('send', 15) + ' 批量私信</button>' +
      '</div></div>' +
      '<div class="card"><div class="note blue">' + Q.icon('shield', 15) +
        ' 批量录入的成绩会逐条推送学生通知；「密码保护」会为每位学生生成独立的成绩代号与查看密码。</div></div>';
  }

  async function pageDataIO() {
    return '<div class="card"><div class="section-head"><div><h3>标准格式导出</h3>' +
        '<div class="desc">带 BOM 的 UTF-8 CSV，可直接用 Excel 打开，也可原样粘贴回下方导入。</div></div></div>' +
      '<div class="row wrap">' +
        '<button class="btn soft" data-act="batchExport" data-kind="students" type="button">' +
          Q.icon('download', 15) + ' 导出学生</button>' +
        '<button class="btn soft" data-act="batchExport" data-kind="scores" type="button">' +
          Q.icon('download', 15) + ' 导出成绩</button>' +
        '<button class="btn soft" data-act="batchExport" data-kind="homeworks" type="button">' +
          Q.icon('download', 15) + ' 导出作业</button>' +
      '</div></div>' +
      '<div class="card"><div class="section-head"><div><h3>标准格式导入</h3>' +
        '<div class="desc">粘贴上面导出的 CSV（含表头），先预览匹配结果，再确认导入。</div></div></div>' +
      '<div id="batchImportBox">' +
        fld('数据类型', '<select class="select" id="batchImportKind">' +
          '<option value="students">学生</option><option value="scores">成绩</option>' +
          '<option value="homeworks">作业</option></select>') +
        fld('粘贴标准 CSV', '<textarea class="input ext-ta" id="batchImportText" ' +
          'placeholder="姓名,邮箱,学号,登录密码,班级ID,添加时间&#10;李明,liming@example.com,202601,,0,"></textarea>') +
        '<div class="ext-hint">第一行必须是表头；支持逗号或制表符分隔。学生按邮箱匹配（已存在则更新学号/班级），成绩按 邮箱/学号/姓名 匹配本班学生。</div>' +
      '</div>' +
      '<div class="ext-toolbar">' +
        '<button class="btn soft sm" data-act="batchPreviewImport" type="button">' +
          Q.icon('check', 14) + ' 解析并预览</button>' +
        '<button class="btn primary sm" data-act="batchCommitImport" type="button">' +
          Q.icon('upload', 14) + ' 确认导入</button>' +
        '<span class="tiny" id="batchImportInfo"></span>' +
      '</div>' +
      '<div id="batchImportPreview" class="ext-preview"></div></div>';
  }

  /* ---------------------------------------------------------- 弹窗 */
  async function openGrid(prefill) {
    try {
      var list = await loadStudents();
      if (!list.length) { Q.toast('请先添加学生', 'err'); return; }
      var tplRes = await Q.api(P + '/templates');
      TPLS = tplRes.templates || [];
      var pf = prefill || {};
      var rows = list.map(function (s) {
        return '<tr><td><strong>' + Q.esc(s.name) + '</strong><div class="tiny">' +
          Q.esc(s.email) + '</div></td>' +
          '<td class="tiny">' + Q.esc(s.student_no || '—') + '</td>' +
          '<td><input class="input ext-score" type="number" step="0.1" min="0" name="bs_' +
            Q.esc(s.id) + '" placeholder="—"></td>' +
          '<td><input class="input" type="text" name="br_' + Q.esc(s.id) +
            '" placeholder="选填"></td></tr>';
      }).join('');
      var opts = '<option value="">— 选择常用考试 —</option>' + TPLS.map(function (t) {
        return '<option value="' + Q.esc(t.id) + '">' + Q.esc(t.name) + ' · ' +
          Q.esc(t.subject || '') + ' / ' + Q.esc(t.full_score) + '</option>';
      }).join('');
      Q.openModal({
        title: '成绩批量录入 · 全班逐格填分',
        wide: true,
        body: '<form id="fBatchGrid">' +
          '<div class="form-grid">' +
            fld('考试 / 测验名称 *', txt('exam_name', pf.name || '', '例如：期中测验')) +
            fld('科目', txt('subject', pf.subject || '', '例如：数学')) +
            fld('满分', num('full_score', pf.full_score || 100)) +
            fld('发布方式', '<select class="select" name="mode">' +
              '<option value="direct">直接发送（登录即见）</option>' +
              '<option value="locked">密码保护（每人独立代号）</option></select>') +
          '</div>' +
          '<div class="ext-toolbar"><span class="tiny">套用模板：</span>' +
            '<select class="select" id="batchTplSel" style="width:auto;min-width:170px">' +
            opts + '</select>' +
            '<button class="btn ghost sm" data-act="batchApplyTpl" type="button">套用</button>' +
            '<button class="btn ghost sm" data-act="batchOpenTemplates" type="button">管理模板</button>' +
          '</div>' +
          '<div class="ext-hint">只填有成绩的学生即可，留空的学生不会录入；分数须在 0 ~ 满分之间，保存后逐条推送学生通知。</div>' +
          '<div class="ext-grid-wrap"><table class="ext-grid"><thead><tr>' +
          '<th>学生</th><th>学号</th><th>分数</th><th>备注</th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
          '</form>',
        foot: foot('batchSubmitGrid', '一次保存全部成绩', 'primary'),
      });
    } catch (e) { Q.fail(e); }
  }

  async function openPaste() {
    try {
      await loadStudents();
      PASTE = [];
      Q.openModal({
        title: '粘贴 Excel / CSV 导入成绩',
        wide: true,
        body: '<form id="fBatchPaste">' +
          '<div class="form-grid">' +
            fld('考试 / 测验名称 *', txt('exam_name', '', '例如：第三单元测验')) +
            fld('科目', txt('subject', '', '例如：数学')) +
            fld('满分', num('full_score', 100)) +
            '<div class="field"><label>发布方式</label><div class="note">统一按「直接发送」导入。</div></div>' +
          '</div>' +
          '<div class="field"><label>粘贴成绩数据</label>' +
            '<textarea class="input ext-ta" id="batchPasteText" name="text" ' +
            'placeholder="李明,95,进步明显&#10;liming@example.com,88&#10;202601,76,缺考补录"></textarea>' +
            '<div class="ext-hint">每行一位学生：标识（姓名 / 邮箱 / 学号）,分数,备注（备注可省略）。支持逗号、中文逗号、制表符、分号分隔；可含表头行。</div>' +
          '</div></form>' +
          '<div class="ext-toolbar">' +
            '<button class="btn soft sm" data-act="batchParsePaste" type="button">' +
              Q.icon('check', 14) + ' 解析并预览</button>' +
            '<span class="tiny" id="batchPasteInfo"></span>' +
          '</div>' +
          '<div id="batchPastePreview" class="ext-preview"></div>',
        foot: foot('batchConfirmPaste', '确认导入', 'primary'),
      });
    } catch (e) { Q.fail(e); }
  }

  async function openTemplates() {
    try {
      var r = await Q.api(P + '/templates');
      TPLS = r.templates || [];
      var list = TPLS.length ? TPLS.map(function (t) {
        return '<div class="ext-tpl"><div><strong>' + Q.esc(t.name) + '</strong>' +
          '<div class="tiny">' + Q.esc(t.subject || '—') + ' · 满分 ' +
          Q.esc(t.full_score) + '</div></div>' +
          '<div class="row" style="gap:6px">' +
            '<button class="btn soft sm" data-act="batchApplyTpl2" data-id="' +
              Q.esc(t.id) + '" type="button">套用</button>' +
            '<button class="btn danger sm" data-act="batchDelTpl" data-id="' +
              Q.esc(t.id) + '" type="button">删除</button>' +
          '</div></div>';
      }).join('') : '<div class="note">还没有模板，在下方保存一个常用考试吧。</div>';
      Q.openModal({
        title: '考试模板',
        body: '<div class="section-head"><h3>常用考试</h3></div>' + list +
          '<form id="fBatchTemplate" class="ext-mt"><div class="form-grid">' +
            fld('模板名称 *', txt('tpl_name', '', '例如：单元测验')) +
            fld('科目', txt('tpl_subject', '', '例如：数学')) +
            fld('满分', num('tpl_full', 100)) +
          '</div></form>',
        foot: foot('batchSaveTpl', '保存为模板', 'primary'),
      });
    } catch (e) { Q.fail(e); }
  }

  async function openReset() {
    try {
      var list = await loadStudents();
      Q.openModal({
        title: '批量重置登录密码',
        body: '<div class="note">重置后原密码立即失效，会为每位勾选的学生生成一组新密码。</div>' +
          '<form id="fBatchReset">' + pickListHtml(list) + '</form>',
        foot: foot('batchSubmitReset', '生成新密码', 'primary'),
      });
    } catch (e) { Q.fail(e); }
  }

  async function openEdit() {
    try {
      var res = await Promise.all([loadStudents(), Q.api(P + '/classes')]);
      var list = res[0], classes = res[1].classes || [];
      var opts = '<option value="">不修改班级</option>' +
        '<option value="0">未分班（班级 ID 0）</option>' +
        classes.map(function (c) {
          return '<option value="' + Q.esc(c.id) + '">' + Q.esc(c.name) +
            '（ID ' + Q.esc(c.id) + '）</option>';
        }).join('');
      var rows = list.length ? list.map(function (s) {
        return '<tr><td><label class="row" style="gap:6px">' +
          '<input type="checkbox" name="batch_sid" value="' + Q.esc(s.id) + '">' +
          Q.esc(s.name) + '</label><div class="tiny">' + Q.esc(s.email) + '</div></td>' +
          '<td class="tiny">' + Q.esc(s.student_no || '—') + '</td>' +
          '<td><input class="input" name="bno_' + Q.esc(s.id) + '" value="' +
          Q.attr(s.student_no || '') + '" placeholder="新学号（留空不改）"></td></tr>';
      }).join('') : '';
      Q.openModal({
        title: '批量改学号 / 班级', wide: true,
        body: '<form id="fBatchEdit">' +
          fld('统一设置班级（对勾选学生生效）',
              '<select class="select" name="class_id">' + opts + '</select>') +
          '<div class="ext-hint">下拉来自「班级」数据；若还没有班级，可直接选「未分班」或填数字班级 ID。选「不修改」则保持原班级。</div>' +
          '<div class="ext-toolbar">' +
            '<button class="btn ghost sm" data-act="batchPickAll" type="button">全选</button>' +
            '<button class="btn ghost sm" data-act="batchPickNone" type="button">清空</button></div>' +
          (rows ? '<div class="ext-grid-wrap"><table class="ext-grid"><thead><tr>' +
            '<th>勾选学生</th><th>现学号</th><th>新学号（留空不改）</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>'
            : '<div class="note">还没有学生。</div>') +
          '</form>',
        foot: foot('batchSubmitEdit', '保存修改', 'primary'),
      });
    } catch (e) { Q.fail(e); }
  }

  async function openRemove() {
    try {
      var list = await loadStudents();
      Q.openModal({
        title: '批量移出学生',
        body: dangerNote('移出会删除学生账号及其所有作业提交、成绩记录，且不可恢复。请谨慎操作。') +
          '<form id="fBatchRemove">' + pickListHtml(list) + '</form>',
        foot: foot('batchSubmitRemove', '下一步', 'danger'),
      });
    } catch (e) { Q.fail(e); }
  }

  async function openMessage() {
    try {
      var list = await loadStudents();
      Q.openModal({
        title: '批量私信 · 站内通知',
        body: '<form id="fBatchMessage">' +
          fld('通知标题 *', txt('title', '', '例如：本周五测验提醒')) +
          fld('通知内容 *',
              '<textarea class="input" name="body" rows="4" placeholder="写点内容…"></textarea>') +
          pickListHtml(list) + '</form>',
        foot: foot('batchSubmitMessage', '发送给勾选学生', 'primary'),
      });
    } catch (e) { Q.fail(e); }
  }

  /* ---------------------------------------------------------- 按钮动作（batch 前缀） */
  Q.CLICK['batchOpenGrid'] = function () { return openGrid(); };
  Q.CLICK['batchOpenPaste'] = function () { return openPaste(); };
  Q.CLICK['batchOpenTemplates'] = function () { return openTemplates(); };
  Q.CLICK['batchOpenReset'] = function () { return openReset(); };
  Q.CLICK['batchOpenEdit'] = function () { return openEdit(); };
  Q.CLICK['batchOpenRemove'] = function () { return openRemove(); };
  Q.CLICK['batchOpenMessage'] = function () { return openMessage(); };

  Q.CLICK['batchApplyTpl'] = function () {
    var sel = Q.$('#batchTplSel');
    if (!sel || !sel.value) { Q.toast('请先选择模板', 'err'); return; }
    var t = TPLS.find(function (x) { return String(x.id) === String(sel.value); });
    if (!t) return;
    var f = Q.$('#fBatchGrid');
    if (!f) return;
    f.querySelector('[name="exam_name"]').value = t.name;
    f.querySelector('[name="subject"]').value = t.subject || '';
    f.querySelector('[name="full_score"]').value = t.full_score;
    Q.toast('已套用模板：' + t.name);
  };
  Q.CLICK['batchApplyTpl2'] = function (el) {
    var t = TPLS.find(function (x) { return String(x.id) === String(el.dataset.id); });
    if (t) return openGrid({ name: t.name, subject: t.subject, full_score: t.full_score });
  };
  Q.CLICK['batchDelTpl'] = async function (el) {
    try {
      await Q.api(P + '/templates/' + el.dataset.id, 'DELETE');
      Q.toast('已删除');
      return openTemplates();
    } catch (e) { Q.fail(e); }
  };
  Q.CLICK['batchParsePaste'] = function () {
    var ta = Q.$('#batchPasteText');
    PASTE = parsePaste(ta ? ta.value : '');
    renderPastePreview(PASTE);
  };
  Q.CLICK['batchPickAll'] = function () {
    Q.$$('input[name="batch_sid"]').forEach(function (x) { x.checked = true; });
  };
  Q.CLICK['batchPickNone'] = function () {
    Q.$$('input[name="batch_sid"]').forEach(function (x) { x.checked = false; });
  };
  Q.CLICK['batchRemoveConfirm'] = async function () {
    try {
      var r = await Q.api(P + '/students/remove', 'POST', { ids: REMOVE_IDS });
      REMOVE_IDS = [];
      Q.closeModal();
      Q.toast('已移出 ' + r.count + ' 位学生');
      await Q.reload();
    } catch (e) { Q.fail(e); }
  };
  Q.CLICK['batchExport'] = function (el) {
    var kind = el.dataset.kind || 'students';
    location.href = P + '/export/' + kind;
    Q.toast('已开始下载 ' + kind + ' CSV');
  };
  Q.CLICK['batchPreviewImport'] = async function () {
    var sel = Q.$('#batchImportKind'), ta = Q.$('#batchImportText');
    if (!sel || !ta) return;
    IMPORT_KIND = sel.value;
    try {
      var r = await Q.api(P + '/import/preview', 'POST',
                          { kind: IMPORT_KIND, text: ta.value });
      IMPORT_ROWS = r.items || [];
      renderImportPreview(r);
    } catch (e) { Q.fail(e); }
  };
  Q.CLICK['batchCommitImport'] = async function () {
    if (!IMPORT_ROWS.length) { Q.toast('请先解析预览', 'err'); return; }
    var rows = IMPORT_ROWS.filter(function (i) { return i.status !== 'error'; })
                          .map(function (i) { return i.cols || []; });
    if (!rows.length) { Q.toast('没有可导入的行', 'err'); return; }
    try {
      var r = await Q.api(P + '/import/commit', 'POST',
                          { kind: IMPORT_KIND, items: rows });
      Q.toast('导入完成：新增 ' + r.created + ' · 更新 ' + r.updated +
              ' · 跳过 ' + r.skipped);
      IMPORT_ROWS = [];
      var box = Q.$('#batchImportPreview'); if (box) box.innerHTML = '';
      var info = Q.$('#batchImportInfo'); if (info) info.textContent = '';
      await Q.reload();
    } catch (e) { Q.fail(e); }
  };

  /* ---------------------------------------------------------- 表单提交 */
  Q.FORMS['fBatchGrid'] = async function (f) {
    var fd = new FormData(f);
    var exam = String(fd.get('exam_name') || '').trim();
    if (!exam) throw new Error('请填写考试 / 测验名称');
    var items = [];
    STU.forEach(function (s) {
      var v = fd.get('bs_' + s.id);
      if (v === null || String(v).trim() === '') return;
      items.push({ student_id: s.id, score: Number(v),
                   remark: String(fd.get('br_' + s.id) || '').trim() });
    });
    if (!items.length) throw new Error('请至少填写一位学生的分数');
    var r = await Q.api(P + '/scores/batch', 'POST', {
      exam_name: exam, subject: String(fd.get('subject') || '').trim(),
      full_score: Number(fd.get('full_score') || 100),
      mode: String(fd.get('mode') || 'direct'), items: items,
    });
    Q.closeModal();
    Q.toast('已录入 ' + r.created + ' 条成绩');
    if (r.credentials && r.credentials.length) {
      showCredentials(r.credentials, exam);
    } else {
      await Q.reload();
    }
  };

  Q.FORMS['fBatchPaste'] = async function (f) {
    var fd = new FormData(f);
    var exam = String(fd.get('exam_name') || '').trim();
    if (!exam) throw new Error('请填写考试 / 测验名称');
    var ta = Q.$('#batchPasteText');
    var parsed = ta ? parsePaste(ta.value) : (PASTE || []);
    var items = parsed.filter(function (r) { return !r.error && r.match; })
                      .map(function (r) {
                        return { student_id: r.match.id, score: r.num, remark: r.remark };
                      });
    if (!items.length) throw new Error('没有可导入的成绩，请先粘贴并解析预览');
    var r = await Q.api(P + '/scores/batch', 'POST', {
      exam_name: exam, subject: String(fd.get('subject') || '').trim(),
      full_score: Number(fd.get('full_score') || 100), mode: 'direct', items: items,
    });
    PASTE = [];
    Q.closeModal();
    Q.toast('已导入 ' + r.created + ' 条成绩');
    await Q.reload();
  };

  Q.FORMS['fBatchTemplate'] = async function (f) {
    var fd = new FormData(f);
    var name = String(fd.get('tpl_name') || '').trim();
    if (!name) throw new Error('请填写模板名称');
    await Q.api(P + '/templates', 'POST', {
      name: name, subject: String(fd.get('tpl_subject') || '').trim(),
      full_score: Number(fd.get('tpl_full') || 100),
    });
    Q.toast('模板已保存');
    return openTemplates();
  };

  Q.FORMS['fBatchReset'] = async function () {
    var ids = pickedIds();
    if (!ids.length) throw new Error('请至少勾选一位学生');
    var r = await Q.api(P + '/students/reset-passwords', 'POST', { ids: ids });
    var body = '<div class="ext-hint">请把新密码分别发给学生（可复制整表）。</div>' +
      '<div class="ext-grid-wrap"><table class="ext-grid"><thead><tr>' +
      '<th>姓名</th><th>邮箱</th><th>新密码</th></tr></thead><tbody>' +
      r.items.map(function (i) {
        return '<tr><td>' + Q.esc(i.name) + '</td><td>' + Q.esc(i.email) +
          '</td><td class="mono">' + Q.esc(i.password) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    var text = r.items.map(function (i) {
      return i.name + ',' + i.email + ',' + i.password;
    }).join('\n');
    Q.openModal({
      title: '已重置 ' + r.count + ' 位学生的密码', wide: true, body: body,
      foot: '<button class="btn ghost" data-act="closeModal" type="button">关闭</button>' +
        '<button class="btn primary" data-act="copy" data-text="' + Q.attr(text) +
        '" type="button">复制全部</button>',
    });
  };

  Q.FORMS['fBatchEdit'] = async function (f) {
    var fd = new FormData(f);
    var ids = pickedIds();
    if (!ids.length) throw new Error('请至少勾选一位学生');
    var items = [];
    ids.forEach(function (id) {
      var v = fd.get('bno_' + id);
      if (v !== null && String(v).trim() !== '') {
        items.push({ id: id, student_no: String(v).trim() });
      }
    });
    var cidRaw = String(fd.get('class_id') || '').trim();
    var payload = { ids: ids, items: items };
    if (cidRaw !== '') payload.class_id = Number(cidRaw);
    var r = await Q.api(P + '/students/batch-edit', 'POST', payload);
    Q.closeModal();
    Q.toast('已更新 ' + r.updated + ' 位学生');
    await Q.reload();
  };

  Q.FORMS['fBatchRemove'] = async function () {
    var ids = pickedIds();
    if (!ids.length) throw new Error('请至少勾选一位学生');
    REMOVE_IDS = ids;
    Q.openModal({
      title: '再次确认',
      body: dangerNote('即将删除 ' + ids.length + ' 位学生及其全部数据，操作不可恢复。'),
      foot: '<button class="btn ghost" data-act="closeModal" type="button">取消</button>' +
        '<button class="btn danger" data-act="batchRemoveConfirm" type="button">确认移出</button>',
    });
  };

  Q.FORMS['fBatchMessage'] = async function (f) {
    var fd = new FormData(f);
    var ids = pickedIds();
    if (!ids.length) throw new Error('请至少勾选一位学生');
    var r = await Q.api(P + '/messages/batch', 'POST', {
      ids: ids, title: String(fd.get('title') || '').trim(),
      body: String(fd.get('body') || '').trim(),
    });
    Q.closeModal();
    Q.toast('已发送给 ' + r.count + ' 位学生');
  };

  /* 弹窗内不在 form 里的提交按钮 → 触发对应表单 */
  Q.SUBMIT_TRIGGER['batchSubmitGrid'] = 'fBatchGrid';
  Q.SUBMIT_TRIGGER['batchConfirmPaste'] = 'fBatchPaste';
  Q.SUBMIT_TRIGGER['batchSaveTpl'] = 'fBatchTemplate';
  Q.SUBMIT_TRIGGER['batchSubmitReset'] = 'fBatchReset';
  Q.SUBMIT_TRIGGER['batchSubmitEdit'] = 'fBatchEdit';
  Q.SUBMIT_TRIGGER['batchSubmitRemove'] = 'fBatchRemove';
  Q.SUBMIT_TRIGGER['batchSubmitMessage'] = 'fBatchMessage';

  /* ---------------------------------------------------------- 注册页面 / 导航 */
  Q.PAGES['teacher:batch'] = pageBatch;
  Q.PAGES['teacher:dataio'] = pageDataIO;
  Q.NAV.teacher.push({ id: 'batch', label: '批量录入', icon: 'grid', title: '批量与效率' });
  Q.NAV.teacher.push({ id: 'dataio', label: '导入导出', icon: 'download', title: '数据导入导出' });
})();
