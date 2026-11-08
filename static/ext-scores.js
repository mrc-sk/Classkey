/* 成绩工具：设置 / 成绩单打印 / 家长链接 / 修正留痕 / 分析洞察 / 密码重新生成 */
(function () {
  const Q = window.Qike; if (!Q) return;
  const E = Q.esc, A = Q.attr;
  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '.ext-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 16px}' +
    '.ext-bar{display:flex;align-items:center;gap:10px;margin-bottom:8px}' +
    '.ext-bar .lab{width:88px;flex:none;font-size:12.5px;color:var(--muted)}' +
    '.ext-bar .track{flex:1;background:#eaf1fa;border-radius:8px;height:12px;overflow:hidden}' +
    '.ext-bar .track i{display:block;height:100%;background:linear-gradient(90deg,#4E95D9,#79c0a8)}' +
    '.ext-list{display:flex;flex-direction:column;gap:8px}' +
    '.ext-item{border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:13px}' +
    '</style>');

  let tab = 'report', pick = 0;
  const TABS = [['report', '成绩单打印'], ['settings', '等级与分数线'], ['links', '家长只读链接'],
                ['regen', '查看密码'], ['edits', '修正记录'], ['insight', '洞察分析']];

  function tabs() {
    return '<div class="ext-tabs">' + TABS.map(function (t) {
      return '<button class="btn ' + (t[0] === tab ? 'primary' : 'ghost') + ' sm" type="button" ' +
        'data-act="scTab" data-tab="' + t[0] + '">' + E(t[1]) + '</button>';
    }).join('') + '</div>';
  }
  async function students() {
    const d = await Q.api('/api/teacher/students');
    return d.students || [];
  }
  function stuOpts(list) {
    return '<option value="0">请选择学生</option>' + list.map(function (s) {
      return '<option value="' + s.id + '" ' + (+s.id === +pick ? 'selected' : '') + '>' +
        E(s.name) + '（' + E(s.student_no || s.email) + '）</option>';
    }).join('');
  }

  Q.PAGES['teacher:scoretools'] = async function () {
    const list = await students();
    let body = '';
    if (tab === 'report') {
      body = '<div class="field"><label>选择学生</label><select class="input" id="scStu">' +
        stuOpts(list) + '</select></div>' +
        '<button class="btn primary sm" type="button" data-act="scPrint">生成 / 打印成绩单</button>' +
        '<div class="hint">生成的是 A4 打印友好页面，一人一页；浏览器里按打印即可另存为 PDF，中文不乱码、无需安装字体或第三方库。</div>';
    } else if (tab === 'settings') {
      const d = await Q.api('/api/x/scores/settings');
      const s = d.settings || {};
      body = '<form id="scSettingsForm"><div class="form-grid">' +
        '<div class="field"><label>显示方式</label><select class="input" name="grade_mode">' +
        '<option value="score" ' + (s.grade_mode === 'score' ? 'selected' : '') + '>分数</option>' +
        '<option value="level" ' + (s.grade_mode === 'level' ? 'selected' : '') + '>等级（优秀/良好/及格/待提高）</option>' +
        '</select></div><div class="field"><label>及格线（百分制）</label><input class="input" name="pass_line" type="number" value="' + A(s.pass_line || 60) + '"></div>' +
        '<div class="field"><label>优秀线（百分制）</label><input class="input" name="excellent_line" type="number" value="' + A(s.excellent_line || 85) + '"></div>' +
        '<div class="field"><label>对学生公开排名</label><select class="input" name="show_rank">' +
        '<option value="0" ' + (s.show_rank !== '1' ? 'selected' : '') + '>不公开</option>' +
        '<option value="1" ' + (s.show_rank === '1' ? 'selected' : '') + '>公开</option></select></div>' +
        '</div><button class="btn primary sm" type="submit">保存设置</button></form>';
    } else if (tab === 'links') {
      const d = await Q.api('/api/x/scores/parent-links');
      body = '<form id="scLinkForm"><div class="form-grid">' +
        '<div class="field"><label>学生</label><select class="input" name="student_id">' + stuOpts(list) + '</select></div>' +
        '<div class="field"><label>有效期（天）</label><input class="input" name="days" type="number" value="30" min="1" max="365"></div>' +
        '</div><button class="btn primary sm" type="submit">生成只读链接</button></form>' +
        '<div class="ext-list mt16">' + (d.items.length ? d.items.map(function (x) {
          const url = location.origin + '/api/x/scores/p/' + x.token;
          return '<div class="ext-item"><strong>' + E(x.student_name) + '</strong> · 有效期至 ' +
            E(x.expires_at) + (x.revoked ? ' <span class="badge gray">已撤销</span>' : '') +
            '<div class="tiny" style="word-break:break-all">' + E(url) + '</div>' +
            '<button class="btn ghost sm" type="button" data-act="scCopyLink" data-url="' + A(url) + '">复制链接</button> ' +
            (x.revoked ? '' : '<button class="btn ghost sm" type="button" data-act="scRevokeLink" data-id="' + x.id + '">撤销</button>') +
            '</div>';
        }).join('') : '<div class="tiny">还没有家长链接</div>') + '</div>' +
        '<div class="hint">家长打开链接即可查看孩子的作业与成绩，<strong>无需注册、无需密码</strong>；链接可随时撤销。</div>';
    } else if (tab === 'regen') {
      const d = await Q.api('/api/teacher/scores');
      const locked = (d.scores || []).filter(function (x) { return x.mode === 'locked'; });
      body = '<div class="note blue">查看密码现在只存哈希，任何人都无法取回旧密码。学生弄丢时，在这里重新生成一组新的代号 + 密码（只显示一次，请立即复制发给学生）。</div>' +
        '<div class="ext-list mt16">' + (locked.length ? locked.map(function (x) {
          return '<div class="ext-item"><strong>' + E(x.exam_name) + '</strong> · ' + E(x.student_name) +
            ' <span class="tiny">代号 ' + E(x.view_code) + '</span> ' +
            '<button class="btn soft sm" type="button" data-act="scRegen" data-id="' + x.id + '">重新生成密码</button></div>';
        }).join('') : '<div class="tiny">暂无密码保护的成绩</div>') + '</div>';
    } else if (tab === 'edits') {
      const d = await Q.api('/api/x/scores/edits');
      body = '<div class="ext-list">' + (d.items.length ? d.items.map(function (x) {
        return '<div class="ext-item">' + E(x.student_name) + ' · ' + E(x.created_at) +
          ' <strong>' + E(x.old_score) + ' → ' + E(x.new_score) + '</strong>' +
          '<div class="tiny">原因：' + E(x.reason || '未填写') + '</div></div>';
      }).join('') : '<div class="tiny">暂无改分记录</div>') + '</div>';
    } else {
      const d = await Q.api('/api/x/scores/insight');
      const bars = (d.radar || []).map(function (r) {
        return '<div class="ext-bar"><span class="lab">' + E(r.subject) + '</span>' +
          '<span class="track"><i style="width:' + Math.max(0, Math.min(100, r.avg)) + '%"></i></span>' +
          '<span class="tiny">' + E(r.avg) + '</span></div>';
      }).join('') || '<div class="tiny">暂无分科数据</div>';
      body = '<div class="card" style="box-shadow:none;border:1px solid var(--line)"><h3>各科掌握度（百分制平均）</h3>' + bars + '</div>' +
        '<div class="card mt16" style="box-shadow:none;border:1px solid var(--line)"><h3>进步榜 / 临界生</h3>' +
        '<table class="tbl"><thead><tr><th>学生</th><th>最近成绩</th><th>较上次</th></tr></thead><tbody>' +
        ((d.progress || []).map(function (p) {
          return '<tr><td>' + E(p.name) + '</td><td>' + E(p.last) + '</td><td>' +
            (p.delta > 0 ? '+' : '') + E(p.delta) + '</td></tr>';
        }).join('') || '<tr><td colspan="3">暂无数据</td></tr>') + '</tbody></table>' +
        '<div class="hint mt8">临界生（距及格线 5 分内）：' +
        ((d.borderline || []).map(function (b) { return E(b.name) + '(' + E(b.last) + ')'; }).join('、') || '无') +
        ' · 排名对学生' + (d.show_rank ? '公开' : '不公开') + '</div></div>';
    }
    return '<div class="card"><div class="section-head"><div><h3>成绩工具</h3>' +
      '<div class="desc">打印、家长只读、改分留痕与学情洞察</div></div></div>' + tabs() + body + '</div>';
  };

  Q.NAV.teacher.push({ id: 'scoretools', label: '成绩工具', icon: 'chart', title: '成绩工具' });
  Q.CLICK.scTab = function (el) { tab = el.dataset.tab; Q.reload(); };
  document.addEventListener('change', function (e) {
    if (e.target.id === 'scStu') pick = +e.target.value;
  });
  Q.CLICK.scPrint = async function () {
    if (!pick) throw new Error('请先选择学生');
    const r = await Q.api('/api/x/scores/report', 'POST', { student_id: pick });
    const w = window.open('', '_blank');
    if (!w) throw new Error('浏览器拦截了新窗口，请允许弹出窗口');
    w.document.write(r.html); w.document.close();
    Q.toast('成绩单已生成，按 Ctrl+P 可另存为 PDF');
  };
  Q.CLICK.scCopyLink = function (el) { Q.copyText(el.dataset.url); };
  Q.CLICK.scRevokeLink = async function (el) {
    await Q.api('/api/x/scores/parent-links/' + el.dataset.id + '/revoke', 'POST');
    Q.toast('链接已撤销'); Q.reload();
  };
  Q.CLICK.scRegen = async function (el) {
    const r = await Q.api('/api/teacher/scores/' + el.dataset.id + '/regen', 'POST');
    Q.openModal({ title: '新的成绩代号与密码',
      body: '<div class="note amber">这组信息只显示一次，请立即复制发给学生；旧代号已失效。</div>' +
        '<div class="ext-item mt16">成绩代号：<strong>' + E(r.view_code) + '</strong></div>' +
        '<div class="ext-item mt8">查看密码：<strong>' + E(r.view_password) + '</strong></div>',
      foot: '<button class="btn primary" type="button" data-act="scCopyCred" ' +
        'data-text="' + A('成绩代号：' + r.view_code + '  查看密码：' + r.view_password) + '">复制整组</button>' +
        '<button class="btn ghost" data-act="closeModal" type="button">关闭</button>' });
  };
  Q.CLICK.scCopyCred = function (el) { Q.copyText(el.dataset.text); };

  Q.FORMS.scSettingsForm = async function (f) {
    const fd = new FormData(f);
    await Q.api('/api/x/scores/settings', 'POST', {
      grade_mode: fd.get('grade_mode'), pass_line: fd.get('pass_line'),
      excellent_line: fd.get('excellent_line'), show_rank: fd.get('show_rank')
    });
    Q.toast('设置已保存'); Q.reload();
  };
  Q.FORMS.scLinkForm = async function (f) {
    const fd = new FormData(f);
    const r = await Q.api('/api/x/scores/parent-links', 'POST',
      { student_id: +fd.get('student_id'), days: +fd.get('days') });
    const url = location.origin + r.url;
    Q.openModal({ title: '家长只读链接已生成',
      body: '<div class="ext-item" style="word-break:break-all">' + E(url) + '</div>' +
        '<div class="hint">有效期至 ' + E(r.expires_at) + '，链接可随时撤销。</div>',
      foot: '<button class="btn primary" type="button" data-act="scCopyLink" data-url="' + A(url) +
        '">复制链接</button><button class="btn ghost" data-act="closeModal" type="button">关闭</button>' });
    Q.reload();
  };
})();
