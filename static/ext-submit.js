/* 提交增强：草稿自动保存 / 拖拽多附件 / 进度 / 附件预览 / 老师批注 */
(function () {
  const Q = window.Qike; if (!Q) return;
  const E = Q.esc, A = Q.attr;
  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '.ext-drop{border:2px dashed #a9c8e8;border-radius:14px;padding:22px;text-align:center;' +
    'background:#f7fbff;cursor:pointer;transition:.2s}' +
    '.ext-drop.on{border-color:#4E95D9;background:#eaf4ff}' +
    '.ext-drop .t{font-size:13px;color:#4b6480;margin-top:8px}' +
    '.ext-files{display:flex;flex-direction:column;gap:6px;margin-top:10px}' +
    '.ext-file{display:flex;align-items:center;gap:8px;font-size:12.5px;border:1px solid var(--line);' +
    'border-radius:9px;padding:7px 10px}' +
    '.ext-prev{max-width:100%;max-height:280px;border:1px solid var(--line);border-radius:10px;margin:10px 0}' +
    '</style>');
  let hw = 0, sub = 0, pending = [], annoX = 0.5, annoY = 0.5;

  function opts(rows, sel) {
    return '<option value="0">请选择作业</option>' + rows.map(function (h) {
      return '<option value="' + h.id + '" ' + (+h.id === +sel ? 'selected' : '') + '>' + E(h.title) + '</option>';
    }).join('');
  }
  function draftKey() { return 'qike.draft.' + hw; }

  Q.PAGES['student:submitx'] = async function () {
    const d = await Q.api('/api/student/homeworks');
    const list = d.homeworks || [];
    const draft = hw ? (localStorage.getItem(draftKey()) || '') : '';
    return '<div class="card"><div class="section-head"><div><h3>附件与草稿</h3>' +
      '<div class="desc">内容自动存草稿，支持一次拖多个文件</div></div></div>' +
      '<div class="field"><label>选择作业</label><select class="input" id="subHwSel">' +
      opts(list, hw) + '</select></div>' +
      '<div class="field"><label>作答内容（自动保存草稿）</label>' +
      '<textarea class="input" id="subDraft" rows="5" placeholder="刷新或关掉页面也不会丢">' + E(draft) + '</textarea>' +
      '<div class="hint" id="subDraftTip">' + (draft ? '已恢复上次草稿' : '输入即自动保存到本机浏览器') + '</div></div>' +
      '<div class="field"><label>附件（可拖入多个文件，单个 ≤ 10MB）</label>' +
      '<div class="ext-drop" id="subDrop"><div>' + Q.icon('upload', 26) + '</div>' +
      '<div class="t">把文件拖到这里，或点击选择</div>' +
      '<input type="file" id="subFile" multiple hidden></div>' +
      '<div class="ext-files" id="subFiles">' + pending.map(function (f, i) {
        return '<div class="ext-file">' + Q.icon('file', 14) + ' ' + E(f.name) +
          ' <span class="tiny">' + Q.fmtSize(f.size) + '</span></div>';
      }).join('') + '</div><div class="hint" id="subProgress"></div></div>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap">' +
        '<button class="btn primary" type="button" data-act="subSave">提交内容与附件</button>' +
        '<button class="btn soft" type="button" data-act="subResubmit">重交（保留旧版本）</button>' +
        '<button class="btn ghost" type="button" data-act="subPeer">互评同学作业</button>' +
      '</div><div class="hint mt8">重交需老师开启「允许重交」；互评默认匿名，可在作业工具箱查看。</div></div>';
  };

  Q.PAGES['teacher:annotatex'] = async function () {
    const hws = (await Q.api('/api/teacher/homeworks')).homeworks || [];
    let items = [], notes = [], preview = '';
    if (hw) {
      const d = await Q.api('/api/teacher/homeworks/' + hw + '/submissions').catch(function () { return { items: [] }; });
      items = d.items || [];
    }
    if (sub) {
      notes = (await Q.api('/api/x/quiz/annotations/' + sub).catch(function () { return { items: [] }; })).items || [];
      const it = items.find(function (x) { return +x.submission_id === +sub; });
      const fid = (it && it.file_id) ? it.file_id : '';
      if (fid && it.file_name && /\.(png|jpe?g|gif|webp|bmp)$/i.test(it.file_name)) {
        preview = '<img class="ext-prev" id="subPrevImg" src="/api/file/' + A(fid) + '?inline=1" alt="提交附件">';
      } else if (fid && it.file_name && /\.pdf$/i.test(it.file_name)) {
        preview = '<iframe class="ext-prev" style="width:100%;height:320px;border:1px solid var(--line);border-radius:10px" ' +
          'src="/api/file/' + A(fid) + '?inline=1" title="PDF 在线预览"></iframe>';
      } else if (it && it.content) {
        preview = '<div class="ext-item" style="white-space:pre-wrap">' + E(String(it.content).slice(0, 800)) + '</div>';
      }
    }
    return '<div class="card"><div class="section-head"><div><h3>作业批注</h3>' +
      '<div class="desc">预览学生提交、按位置留下批注</div></div></div>' +
      '<div class="field"><label>作业</label><select class="input" id="subTHwSel">' + opts(hws, hw) + '</select></div>' +
      '<div class="field"><label>学生提交</label><select class="input" id="subSubSel">' +
      '<option value="0">请选择提交</option>' + items.filter(function (x) { return x.submission_id; })
        .map(function (x) {
          return '<option value="' + x.submission_id + '" ' + (+x.submission_id === +sub ? 'selected' : '') + '>' +
            E(x.name) + ' · ' + E(x.status || '') + '</option>';
        }).join('') + '</select></div>' + preview +
      (sub ? '<div class="form-grid"><div class="field"><label>横向位置 %</label>' +
        '<input class="input" id="subAnnoX" type="number" min="0" max="100" value="' + Math.round(annoX * 100) + '"></div>' +
        '<div class="field"><label>纵向位置 %</label>' +
        '<input class="input" id="subAnnoY" type="number" min="0" max="100" value="' + Math.round(annoY * 100) + '"></div></div>' +
        '<div class="field"><label>批注内容</label><input class="input" id="subAnnoText" placeholder="例如：这一步推导再检查一下"></div>' +
        '<button class="btn primary sm" type="button" data-act="subAddAnno">添加批注</button>' : '') +
      '<div class="ext-files mt16">' + (notes.length ? notes.map(function (n) {
        return '<div class="ext-file">' + Q.icon('edit', 14) + ' <strong>' + E(n.text) + '</strong>' +
          '<span class="tiny">(' + E(Math.round(n.pos_x * 100)) + '%, ' + E(Math.round(n.pos_y * 100)) + '%) ' +
          E(n.created_at) + '</span></div>';
      }).join('') : '<div class="tiny">暂无批注</div>') + '</div></div>';
  };

  Q.NAV.student.push({ id: 'submitx', label: '附件与草稿', icon: 'upload', title: '附件与草稿' });
  Q.NAV.teacher.push({ id: 'annotatex', label: '作业批注', icon: 'edit', title: '作业批注' });

  document.addEventListener('change', function (e) {
    if (e.target.id === 'subHwSel') { hw = +e.target.value; Q.reload(); }
    if (e.target.id === 'subTHwSel') { hw = +e.target.value; sub = 0; Q.reload(); }
    if (e.target.id === 'subSubSel') { sub = +e.target.value; Q.reload(); }
    if (e.target.id === 'subFile' && e.target.files) {
      Array.from(e.target.files).forEach(function (f) { pending.push({ name: f.name, size: f.size, file: f }); });
      renderPending();
    }
  });
  document.addEventListener('input', function (e) {
    if (e.target.id === 'subDraft' && hw) {
      localStorage.setItem(draftKey(), e.target.value);
      const tip = document.getElementById('subDraftTip');
      if (tip) tip.textContent = '草稿已自动保存 · ' + new Date().toLocaleTimeString();
    }
  });
  document.addEventListener('dragover', function (e) {
    const d = e.target.closest && e.target.closest('#subDrop');
    if (d) { e.preventDefault(); d.classList.add('on'); }
  });
  document.addEventListener('dragleave', function (e) {
    const d = e.target.closest && e.target.closest('#subDrop');
    if (d) d.classList.remove('on');
  });
  document.addEventListener('drop', function (e) {
    const d = e.target.closest && e.target.closest('#subDrop');
    if (!d) return;
    e.preventDefault(); d.classList.remove('on');
    Array.from(e.dataTransfer.files || []).forEach(function (f) {
      pending.push({ name: f.name, size: f.size, file: f });
    });
    renderPending();
  });
  document.addEventListener('click', function (e) {
    const d = e.target.closest && e.target.closest('#subDrop');
    if (d && !e.target.closest('input[type="file"]')) {
      const f = document.getElementById('subFile'); if (f) f.click();
    }
    const img = e.target.closest && e.target.closest('#subPrevImg');
    if (img) {
      const r = img.getBoundingClientRect();
      annoX = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      annoY = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      const x = document.getElementById('subAnnoX'), y = document.getElementById('subAnnoY');
      if (x) x.value = Math.round(annoX * 100);
      if (y) y.value = Math.round(annoY * 100);
      Q.toast('已选取批注位置');
    }
  });
  function renderPending() {
    const box = document.getElementById('subFiles');
    if (box) box.innerHTML = pending.map(function (f) {
      return '<div class="ext-file">' + Q.icon('file', 14) + ' ' + E(f.name) +
        ' <span class="tiny">' + Q.fmtSize(f.size) + '</span></div>';
    }).join('');
  }

  Q.CLICK.subSave = async function () {
    if (!hw) throw new Error('请先选择作业');
    const content = (document.getElementById('subDraft') || {}).value || '';
    const prog = document.getElementById('subProgress');
    const uploaded = [];
    for (let i = 0; i < pending.length; i++) {
      if (prog) prog.textContent = '正在上传 ' + (i + 1) + ' / ' + pending.length + ' …';
      const f = await Q.upload(pending[i].file);
      uploaded.push({ id: f.id, name: f.name });
    }
    if (prog) prog.textContent = '正在保存…';
    await Q.api('/api/student/homeworks/' + hw + '/submit', 'POST', { content: content, file_id: '', file_name: '' });
    if (uploaded.length) await Q.api('/api/x/quiz/files/' + hw, 'POST', { files: uploaded });
    localStorage.removeItem(draftKey());
    pending = [];
    Q.toast('提交已保存' + (uploaded.length ? '，含 ' + uploaded.length + ' 个附件' : ''));
    Q.reload();
  };
  Q.CLICK.subResubmit = async function () {
    if (!hw) throw new Error('请先选择作业');
    const content = (document.getElementById('subDraft') || {}).value || '';
    await Q.api('/api/x/quiz/resubmit/' + hw, 'POST', { content: content });
    Q.toast('已提交新版本，旧版本已保留'); Q.reload();
  };
  Q.CLICK.subPeer = async function () {
    const r = await Q.api('/api/x/quiz/peer/feed');
    const items = r.items || [];
    if (!items.length) {
      Q.openModal({ title: '互评同学作业', body: '<div class="empty"><p>暂时没有可互评的提交</p></div>',
        foot: '<button class="btn ghost" data-act="closeModal" type="button">关闭</button>' });
      return;
    }
    Q.openModal({
      title: '互评同学作业',
      body: '<form id="subPeerForm"><div class="field"><label>选择一份同学提交（匿名）</label>' +
        '<select class="input" name="subid">' + items.map(function (x) {
          return '<option value="' + x.submission_id + '">' + E(x.title) + ' · ' +
            E(String(x.content || '附件提交').slice(0, 28)) + '</option>';
        }).join('') + '</select></div>' +
        '<div class="form-grid"><div class="field"><label>评分（0–100）</label>' +
        '<input class="input" name="score" type="number" min="0" max="100" value="80"></div>' +
        '<div class="field"><label class="row" style="cursor:pointer"><input type="checkbox" name="anonymous" checked> 匿名评价</label></div></div>' +
        '<div class="field"><label>评语</label><textarea class="input" name="comment" rows="3" required placeholder="写得好的地方、可以改进的地方…"></textarea></div>' +
        '</form>',
      foot: '<button class="btn primary" data-act="submitSubPeer" type="button">提交互评</button>' +
        '<button class="btn ghost" data-act="closeModal" type="button">取消</button>'
    });
  };
  Q.SUBMIT_TRIGGER.submitSubPeer = 'subPeerForm';
  Q.FORMS.subPeerForm = async function (f) {
    const fd = new FormData(f);
    await Q.api('/api/x/quiz/peer/' + fd.get('subid'), 'POST', {
      score: +fd.get('score'), comment: fd.get('comment'),
      anonymous: fd.get('anonymous') === 'on'
    });
    Q.closeModal(); Q.toast('互评已提交，谢谢你的反馈');
  };

  Q.CLICK.subAddAnno = async function () {
    const x = +(document.getElementById('subAnnoX') || {}).value || 0;
    const y = +(document.getElementById('subAnnoY') || {}).value || 0;
    const text = (document.getElementById('subAnnoText') || {}).value || '';
    if (!text) throw new Error('请填写批注内容');
    await Q.api('/api/x/quiz/annotations/' + sub, 'POST',
      { x: x / 100, y: y / 100, text: text });
    Q.toast('批注已添加'); Q.reload();
  };
})();
