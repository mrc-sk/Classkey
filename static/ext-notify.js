/* 通知扩展：公告栏 / 师生留言 / 已读回执 / 提醒与免打扰设置 */
(function () {
  const Q = window.Qike; if (!Q) return;
  const E = Q.esc, A = Q.attr;
  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '.ext-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 16px}' +
    '.ext-list{display:flex;flex-direction:column;gap:8px}' +
    '.ext-item{border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:13px}' +
    '</style>');
  let tTab = 'ann', sTab = 'ann';
  const TT = [['ann', '公告栏'], ['msg', '师生留言'], ['receipts', '已读回执'], ['prefs', '提醒设置']];
  const ST = [['ann', '班级公告'], ['msg', '给老师留言'], ['prefs', '通知偏好']];

  function tabs(list, cur) {
    return '<div class="ext-tabs">' + list.map(function (t) {
      return '<button class="btn ' + (t[0] === cur ? 'primary' : 'ghost') + ' sm" type="button" ' +
        'data-act="ntTab" data-tab="' + t[0] + '">' + E(t[1]) + '</button>';
    }).join('') + '</div>';
  }

  function announcements(items, isTeacher) {
    return (items.length ? items.map(function (x) {
      return '<div class="ext-item">' + (x.pinned ? '<span class="badge amber">置顶</span> ' : '') +
        '<strong>' + E(x.title) + '</strong><div class="tiny">' + E(x.created_at) + '</div>' +
        '<div style="margin-top:6px;white-space:pre-wrap">' + E(x.body) + '</div>' +
        (isTeacher ? ' <button class="btn ghost sm" type="button" data-act="ntDelAnn" data-id="' + x.id + '">删除</button>' : '') +
        '</div>';
    }).join('') : '<div class="tiny">暂无公告</div>');
  }
  function messages(items, isTeacher) {
    return (items.length ? items.map(function (x) {
      return '<div class="ext-item"><span class="badge ' + (x.direction === 'to_teacher' ? 'blue' : 'green') + '">' +
        (x.direction === 'to_teacher' ? '学生提问' : '老师回复') + '</span> ' +
        (isTeacher ? '<strong>' + E(x.student_name) + '</strong> ' : '') +
        '<div style="margin-top:6px;white-space:pre-wrap">' + E(x.body) + '</div>' +
        '<div class="tiny">' + E(x.created_at) + (x.is_read ? ' · 已读' : ' · 未读') + '</div></div>';
    }).join('') : '<div class="tiny">暂无留言</div>');
  }

  Q.PAGES['teacher:noticex'] = async function () {
    let body = '';
    if (tTab === 'ann') {
      const d = await Q.api('/api/x/notify/announcements');
      body = '<form id="ntAnnForm"><div class="field"><label>公告标题</label>' +
        '<input class="input" name="title" required></div>' +
        '<div class="field"><label>内容</label><textarea class="input" name="body" rows="3"></textarea></div>' +
        '<div class="form-grid"><div class="field"><label>有效期至（选填）</label>' +
        '<input class="input" name="expires_at" type="datetime-local"></div>' +
        '<div class="field"><label class="row" style="cursor:pointer"><input type="checkbox" name="pinned"> 置顶显示</label></div></div>' +
        '<button class="btn primary sm" type="submit">发布公告（同时推送给学生）</button></form>' +
        '<div class="ext-list mt16">' + announcements(d.items, true) + '</div>';
    } else if (tTab === 'msg') {
      const d = await Q.api('/api/x/notify/messages');
      const stu = await Q.api('/api/teacher/students');
      body = '<form id="ntMsgForm"><div class="field"><label>回复给</label>' +
        '<select class="input" name="student_id">' + (stu.students || []).map(function (s) {
          return '<option value="' + s.id + '">' + E(s.name) + '</option>';
        }).join('') + '</select></div>' +
        '<div class="field"><label>内容</label><textarea class="input" name="body" rows="2" required></textarea></div>' +
        '<button class="btn primary sm" type="submit">发送留言</button></form>' +
        '<div class="ext-list mt16">' + messages(d.items, true) + '</div>';
    } else if (tTab === 'receipts') {
      const d = await Q.api('/api/x/notify/receipts');
      body = '<table class="tbl"><thead><tr><th>学生</th><th>邮箱</th><th>未读消息</th></tr></thead><tbody>' +
        ((d.items || []).map(function (x) {
          return '<tr><td>' + E(x.name) + '</td><td>' + E(x.email) + '</td><td>' +
            (x.unread ? '<span class="badge amber">' + E(x.unread) + ' 条未读</span>' : '<span class="badge green">全部已读</span>') +
            '</td></tr>';
        }).join('') || '<tr><td colspan="3">暂无学生</td></tr>') + '</tbody></table>';
    } else {
      const d = await Q.api('/api/x/notify/prefs');
      body = '<form id="ntPrefsForm"><div class="field"><label>作业截止前多少小时自动提醒（1–72）</label>' +
        '<input class="input" name="remind_before" type="number" min="1" max="72" value="' + A(d.remind_before || 24) + '"></div>' +
        '<button class="btn primary sm" type="submit">保存</button></form>' +
        '<div class="hint">系统每分钟扫描一次即将截止且尚未提交的作业，只提醒一次；开启免打扰的学生不会收到。</div>';
    }
    return '<div class="card"><div class="section-head"><div><h3>沟通与通知</h3>' +
      '<div class="desc">公告、留言、已读回执与自动提醒</div></div></div>' + tabs(TT, tTab) + body + '</div>';
  };

  Q.PAGES['student:msgx'] = async function () {
    let body = '';
    if (sTab === 'ann') {
      const d = await Q.api('/api/x/notify/announcements');
      body = '<div class="ext-list">' + announcements(d.items, false) + '</div>';
    } else if (sTab === 'msg') {
      const d = await Q.api('/api/x/notify/messages');
      body = '<form id="ntStuMsgForm"><div class="field"><label>想问老师什么？</label>' +
        '<textarea class="input" name="body" rows="3" required></textarea></div>' +
        '<button class="btn primary sm" type="submit">发送</button></form>' +
        '<div class="ext-list mt16">' + messages(d.items, false) + '</div>';
    } else {
      const d = await Q.api('/api/x/notify/prefs');
      body = '<form id="ntStuPrefsForm"><div class="field"><label class="row" style="cursor:pointer">' +
        '<input type="checkbox" name="quiet" ' + (d.quiet ? 'checked' : '') + '> 免打扰（不接收截止提醒）</label></div>' +
        '<div class="field"><label class="row" style="cursor:pointer">' +
        '<input type="checkbox" name="digest" ' + (d.digest ? 'checked' : '') + '> 接收新作业 / 成绩摘要</label></div>' +
        '<button class="btn primary sm" type="submit">保存偏好</button></form>';
    }
    return '<div class="card"><div class="section-head"><div><h3>班级沟通</h3>' +
      '<div class="desc">公告、留言与通知偏好</div></div></div>' + tabs(ST, sTab) + body + '</div>';
  };

  Q.NAV.teacher.push({ id: 'noticex', label: '沟通与通知', icon: 'mail', title: '沟通与通知' });
  Q.NAV.student.push({ id: 'msgx', label: '班级沟通', icon: 'mail', title: '班级沟通' });
  Q.CLICK.ntTab = function (el) {
    if (Q.S.user.role === 'teacher') tTab = el.dataset.tab; else sTab = el.dataset.tab;
    Q.reload();
  };
  Q.CLICK.ntDelAnn = async function (el) {
    await Q.api('/api/x/notify/announcements/' + el.dataset.id, 'DELETE');
    Q.toast('公告已删除'); Q.reload();
  };
  Q.FORMS.ntAnnForm = async function (f) {
    const fd = new FormData(f);
    await Q.api('/api/x/notify/announcements', 'POST', {
      title: fd.get('title'), body: fd.get('body'), expires_at: fd.get('expires_at'),
      pinned: fd.get('pinned') === 'on'
    });
    Q.toast('公告已发布并推送给学生'); Q.reload();
  };
  Q.FORMS.ntMsgForm = async function (f) {
    const fd = new FormData(f);
    await Q.api('/api/x/notify/messages', 'POST', { student_id: +fd.get('student_id'), body: fd.get('body') });
    Q.toast('留言已发送'); Q.reload();
  };
  Q.FORMS.ntStuMsgForm = async function (f) {
    const fd = new FormData(f);
    await Q.api('/api/x/notify/messages', 'POST', { body: fd.get('body') });
    Q.toast('已发送给老师'); Q.reload();
  };
  Q.FORMS.ntPrefsForm = async function (f) {
    const fd = new FormData(f);
    await Q.api('/api/x/notify/prefs', 'POST', { remind_before: +fd.get('remind_before') });
    Q.toast('已保存'); Q.reload();
  };
  Q.FORMS.ntStuPrefsForm = async function (f) {
    const fd = new FormData(f);
    await Q.api('/api/x/notify/prefs', 'POST',
      { quiet: fd.get('quiet') === 'on', digest: fd.get('digest') === 'on' });
    Q.toast('偏好已保存'); Q.reload();
  };
})();
