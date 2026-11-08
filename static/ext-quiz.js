/* 作业工具箱：模板 / 题库自动判分 / 标签 / 补交审批 / 重交 / 请假 / 版本 */
(function () {
  const Q = window.Qike; if (!Q) return;
  const E = Q.esc, A = Q.attr;
  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '.ext-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 16px}' +
    '.ext-tabs .btn{padding:7px 13px;font-size:12.5px}' +
    '.ext-q{border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:10px;background:#fbfdff}' +
    '.ext-q .t{font-weight:600;margin-bottom:8px}' +
    '.ext-q label{display:inline-flex;align-items:center;gap:5px;margin-right:12px;font-size:13px}' +
    '.ext-list{display:flex;flex-direction:column;gap:8px}' +
    '.ext-item{border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:13px}' +
    '</style>');

  let tTab = 'tpl', sTab = 'paper', selHw = 0, selQHw = 0;

  const TT = [['tpl', '作业模板'], ['questions', '题库判分'], ['tags', '知识点标签'], ['leaves', '补交审批']];
  const ST = [['paper', '在线答题'], ['versions', '提交版本'], ['leave', '请假补交']];

  function tabs(list, cur) {
    return '<div class="ext-tabs">' + list.map(function (t) {
      return '<button class="btn ' + (t[0] === cur ? 'primary' : 'ghost') + ' sm" type="button" ' +
        'data-act="quizTab" data-tab="' + t[0] + '">' + E(t[1]) + '</button>';
    }).join('') + '</div>';
  }
  function opts(rows, sel, blank) {
    return '<option value="0">' + E(blank) + '</option>' + rows.map(function (h) {
      return '<option value="' + h.id + '" ' + (+h.id === +sel ? 'selected' : '') + '>' + E(h.title) + '</option>';
    }).join('');
  }

  async function teacherPage() {
    let body = '';
    if (tTab === 'tpl') {
      const d = await Q.api('/api/x/quiz/templates');
      body = '<form id="quizTplForm"><div class="form-grid">' +
        '<div class="field"><label>模板名称</label><input class="input" name="title" required placeholder="例如：每周周测"></div>' +
        '<div class="field"><label>科目</label><input class="input" name="subject"></div></div>' +
        '<div class="field"><label>作业说明</label><textarea class="input" name="description" rows="2"></textarea></div>' +
        '<button class="btn primary sm" type="submit">保存为模板</button></form>' +
        '<div class="ext-list mt16">' + (d.items.length ? d.items.map(function (x) {
          return '<div class="ext-item"><strong>' + E(x.title) + '</strong> <span class="tiny">' + E(x.subject) +
            ' · ' + E(x.mode) + '</span> <button class="btn ghost sm" type="button" data-act="quizUseTpl" ' +
            'data-id="' + x.id + '" data-title="' + A(x.title) + '" data-subject="' + A(x.subject) +
            '" data-desc="' + A(x.description) + '">用它布置</button> ' +
            '<button class="btn ghost sm" type="button" data-act="quizDelTpl" data-id="' + x.id + '">删除</button></div>';
        }).join('') : '<div class="tiny">还没有模板</div>') + '</div>';
    } else if (tTab === 'questions') {
      const hws = (await Q.api('/api/teacher/homeworks')).homeworks || [];
      const qs = selQHw ? (await Q.api('/api/x/quiz/questions/' + selQHw)).items : [];
      const lines = qs.map(function (q) {
        const op = (q.options || []).join(',');
        return [q.qtype, q.title, op, q.answer, q.score].join('|');
      }).join('\n');
      body = '<div class="field"><label>选择作业</label><select class="input" id="quizQHwSel">' +
        opts(hws, selQHw, '请选择作业') + '</select></div>' +
        '<div class="field"><label>题目（每行一题：题型|题干|选项逗号分隔|答案|分值）</label>' +
        '<textarea class="input" id="quizQText" rows="9" placeholder="single|1+1=?|2,3,4|2|5">' + E(lines) + '</textarea>' +
        '<div class="hint">题型：single 单选 / multi 多选 / judge 判断 / blank 填空；多选题答案用 | 分隔多个选项。' +
        '保存后学生在「在线答题」里作答，系统自动判分并写入成绩。</div></div>' +
        '<button class="btn primary sm" type="button" data-act="quizSaveQ">保存题目</button>' +
        (qs.length ? '<div class="tiny mt8">当前 ' + qs.length + ' 题，合计 ' +
          qs.reduce(function (a, b) { return a + (+b.score || 0); }, 0) + ' 分</div>' : '');
    } else if (tTab === 'tags') {
      const hws = (await Q.api('/api/teacher/homeworks')).homeworks || [];
      const tg = await Q.api('/api/x/quiz/tags');
      body = '<div class="field"><label>作业</label><select class="input" id="quizTagHw">' +
        opts(hws, 0, '请选择作业') + '</select></div>' +
        '<div class="field"><label>知识点标签（逗号分隔）</label><input class="input" id="quizTagText" placeholder="例如：函数,一元二次"></div>' +
        '<button class="btn primary sm" type="button" data-act="quizSaveTag">保存标签</button>' +
        '<div class="mt16 tiny">已有标签：' + (tg.tags.length ? tg.tags.map(E).join(' / ') : '无') + '</div>';
    } else {
      const d = await Q.api('/api/x/quiz/leaves');
      body = '<div class="ext-list">' + (d.items.length ? d.items.map(function (x) {
        return '<div class="ext-item"><strong>' + E(x.student_name || '学生') + '</strong> · ' +
          E(x.title || '') + '<div class="tiny">' + E(x.reason) + ' · ' + E(x.status) + '</div>' +
          (x.status === 'pending' ? ' <button class="btn soft sm" type="button" data-act="quizApprove" data-id="' +
            x.id + '" data-ok="1">批准补交</button> <button class="btn ghost sm" type="button" ' +
            'data-act="quizApprove" data-id="' + x.id + '" data-ok="0">拒绝</button>' : '') + '</div>';
      }).join('') : '<div class="tiny">暂无补交申请</div>') + '</div>';
    }
    return '<div class="card"><div class="section-head"><div><h3>作业工具箱</h3>' +
      '<div class="desc">模板复用、客观题自动判分、知识点归类与补交审批</div></div></div>' +
      tabs(TT, tTab) + body + '</div>';
  }

  async function studentPage() {
    let body = '';
    const hws = (await Q.api('/api/student/homeworks')).homeworks || [];
    if (sTab === 'paper') {
      let paper = '';
      if (selHw) {
        const p = await Q.api('/api/x/quiz/paper/' + selHw).catch(function () { return { questions: [] }; });
        paper = p.questions.length
          ? '<form id="quizAnswerForm">' + p.questions.map(function (q, i) {
            let inp;
            if (q.qtype === 'single' || q.qtype === 'multi') {
              const op = (q.options || []).map(function (o) {
                return '<label><input type="' + (q.qtype === 'single' ? 'radio' : 'checkbox') +
                  '" name="q_' + q.id + '" value="' + A(o) + '"> ' + E(o) + '</label>';
              }).join('');
              inp = '<div class="ext-q">' + op + '</div>';
            } else if (q.qtype === 'judge') {
              inp = '<div class="ext-q"><label><input type="radio" name="q_' + q.id +
                '" value="正确"> 正确</label><label><input type="radio" name="q_' + q.id +
                '" value="错误"> 错误</label></div>';
            } else {
              inp = '<input class="input" name="q_' + q.id + '" placeholder="填写答案">';
            }
            return '<div class="ext-q"><div class="t">' + (i + 1) + '. ' + E(q.title) +
              ' <span class="tiny">(' + E(q.qtype) + ' · ' + E(q.score) + '分)</span></div>' + inp + '</div>';
          }).join('') + '<button class="btn primary" type="submit">提交并自动判分</button></form>'
          : '<div class="tiny">这份作业没有客观题，可到「我的作业」正常提交。</div>';
      }
      body = '<div class="field"><label>选择作业</label><select class="input" id="quizHwSel">' +
        opts(hws, selHw, '请选择作业') + '</select></div>' + paper;
    } else if (sTab === 'versions') {
      const v = selHw ? await Q.api('/api/x/quiz/versions/' + selHw).catch(function () { return { items: [] }; }) : { items: [] };
      body = '<div class="field"><label>选择作业</label><select class="input" id="quizHwSel">' +
        opts(hws, selHw, '请选择作业') + '</select></div>' +
        '<div class="ext-list">' + (v.items.length ? v.items.map(function (x) {
          return '<div class="ext-item"><span class="tiny">' + E(x.created_at) + '</span><div>' +
            E(String(x.content || '').slice(0, 160)) + '</div></div>';
        }).join('') : '<div class="tiny">暂无历史版本（老师开启重交后，每次重交会保留旧版本）</div>') + '</div>';
    } else {
      const l = await Q.api('/api/x/quiz/leaves');
      body = '<form id="quizLeaveForm"><div class="field"><label>作业</label>' +
        '<select class="input" name="homework_id">' + opts(hws, 0, '请选择作业') + '</select></div>' +
        '<div class="field"><label>原因</label><textarea class="input" name="reason" rows="2" required></textarea></div>' +
        '<button class="btn primary sm" type="submit">提交补交 / 请假申请</button></form>' +
        '<div class="ext-list mt16">' + (l.items.length ? l.items.map(function (x) {
          return '<div class="ext-item">' + E(x.reason) + ' <span class="badge">' + E(x.status) + '</span></div>';
        }).join('') : '') + '</div>';
    }
    return '<div class="card"><div class="section-head"><div><h3>我的答题</h3>' +
      '<div class="desc">客观题自动判分、重交版本与补交申请</div></div></div>' +
      tabs(ST, sTab) + body + '</div>';
  }

  Q.PAGES['teacher:quiz'] = teacherPage;
  Q.PAGES['student:quizdo'] = studentPage;
  Q.NAV.teacher.push({ id: 'quiz', label: '作业工具箱', icon: 'book', title: '作业工具箱' });
  Q.NAV.student.push({ id: 'quizdo', label: '在线答题', icon: 'edit', title: '在线答题' });

  Q.CLICK.quizTab = function (el) {
    if (Q.S.user.role === 'teacher') tTab = el.dataset.tab; else sTab = el.dataset.tab;
    Q.reload();
  };
  document.addEventListener('change', function (e) {
    if (e.target.id === 'quizHwSel') { selHw = +e.target.value; Q.reload(); }
    if (e.target.id === 'quizQHwSel') { selQHw = +e.target.value; Q.reload(); }
  });
  Q.CLICK.quizDelTpl = async function (el) {
    await Q.api('/api/x/quiz/templates/' + el.dataset.id, 'DELETE'); Q.toast('已删除'); Q.reload();
  };
  Q.CLICK.quizUseTpl = function (el) {
    Q.toast('已复制模板内容，可在「作业管理」里新建作业时粘贴');
    Q.copyText(el.dataset.title + '\n' + el.dataset.desc);
  };
  Q.CLICK.quizSaveQ = async function () {
    if (!selQHw) throw new Error('请先选择作业');
    const lines = (document.getElementById('quizQText').value || '').split('\n').filter(function (x) { return x.trim(); });
    const qs = lines.map(function (line) {
      const p = line.split('|');
      const typeMap = { '单选': 'single', '多选': 'multi', '判断': 'judge', '填空': 'blank' };
      return { qtype: typeMap[p[0]] || p[0] || 'single', title: (p[1] || '').trim(),
        options: (p[2] || '').split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean),
        answer: (p[3] || '').trim(), score: +(p[4] || 0) || 0 };
    });
    await Q.api('/api/x/quiz/questions/' + selQHw, 'POST', { questions: qs });
    Q.toast('题目已保存，学生可开始答题'); Q.reload();
  };
  Q.CLICK.quizSaveTag = async function () {
    const hid = +document.getElementById('quizTagHw').value;
    if (!hid) throw new Error('请先选择作业');
    const tags = (document.getElementById('quizTagText').value || '').split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
    await Q.api('/api/x/quiz/tags', 'POST', { homework_id: hid, tags: tags });
    Q.toast('标签已保存'); Q.reload();
  };
  Q.CLICK.quizApprove = async function (el) {
    await Q.api('/api/x/quiz/leaves/' + el.dataset.id + '/review', 'POST', { approve: el.dataset.ok === '1' });
    Q.toast('已处理'); Q.reload();
  };

  Q.FORMS.quizTplForm = async function (f) {
    const fd = new FormData(f);
    await Q.api('/api/x/quiz/templates', 'POST', {
      title: fd.get('title'), subject: fd.get('subject'), description: fd.get('description'),
      mode: 'online'
    });
    Q.toast('模板已保存'); Q.reload();
  };
  Q.FORMS.quizLeaveForm = async function (f) {
    const fd = new FormData(f);
    await Q.api('/api/x/quiz/leaves', 'POST', { homework_id: +fd.get('homework_id'), reason: fd.get('reason') });
    Q.toast('申请已提交'); Q.reload();
  };
  Q.FORMS.quizAnswerForm = async function (f) {
    if (!selHw) throw new Error('请先选择作业');
    const answers = {};
    Q.$$('[name^="q_"]', f).forEach(function (el) {
      const id = el.name.slice(2);
      if (el.type === 'checkbox') {
        if (el.checked) answers[id] = (answers[id] ? answers[id] + '|' : '') + el.value;
      } else if (el.type === 'radio') {
        if (el.checked) answers[id] = el.value;
      } else { answers[id] = el.value; }
    });
    const r = await Q.api('/api/x/quiz/paper/' + selHw + '/answer', 'POST', { answers: answers });
    Q.openModal({ title: '自动判分完成', body: '<div class="card" style="border:0;box-shadow:none">' +
      '<div class="stat"><div class="num">' + E(r.score) + ' / ' + E(r.total) + '</div>' +
      '<div class="tiny">客观题得分已写入提交记录，老师可在批改页看到。</div></div></div>',
      foot: '<button class="btn primary" data-act="closeModal" type="button">知道了</button>' });
  };
})();
