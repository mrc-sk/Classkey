// 无头 Edge + CDP：真实渲染并检查界面，截图到 .uicheck/
import fs from 'node:fs';
import path from 'node:path';

const CDP = 'http://127.0.0.1:9222';
const APP = 'http://127.0.0.1:5173/';
const OUT = path.resolve('C:/Users/Administrator/WorkBuddy/2026-11-07-16-34-11/.uicheck');
fs.mkdirSync(OUT, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitCDP() {
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(CDP + '/json/version'); if (r.ok) return await r.json(); }
    catch (e) { /* not ready */ }
    await wait(300);
  }
  throw new Error('CDP 未就绪');
}

const version = await waitCDP();
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let seq = 0;
const pending = new Map();
const jsErrors = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    return;
  }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    jsErrors.push('EXCEPTION: ' + (d.text || '') + ' ' + (d.exception?.description || ''));
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    jsErrors.push('CONSOLE: ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  }
};
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++seq; pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
await send('Emulation.setDeviceMetricsOverride',
  { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);

// 清掉上一次运行的登录态与动画标记，每次都从真实的首次访问开始
try {
  await send('Storage.clearDataForOrigin',
    { origin: 'http://127.0.0.1:5173',
      storageTypes: 'cookies,local_storage,session_storage' }, sessionId);
} catch (e) { console.log('  清理浏览器存储:', e.message); }

const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate',
    { expression: expr, awaitPromise: true, returnByValue: true }, sessionId);
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
  }
  return r.result.value;
};
const navigate = async (url) => {
  await send('Page.navigate', { url }, sessionId);
  await wait(1400);
};
const shot = async (name) => {
  const r = await send('Page.captureScreenshot',
    { format: 'png', captureBeyondViewport: false }, sessionId);
  const f = path.join(OUT, name + '.png');
  fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
  console.log('  shot -> ' + name + '.png');
};

async function login(role, email, password) {
  return evaluate(`(async()=>{
    const b=await (await fetch('/api/bootstrap')).json();
    const r=await fetch('/api/auth/login',{method:'POST',
      headers:{'Content-Type':'application/json','X-CSRF-Token':b.csrf},
      body:JSON.stringify({role:${JSON.stringify(role)},email:${JSON.stringify(email)},password:${JSON.stringify(password)}})});
    return {status:r.status, body:await r.json()};
  })()`);
}
async function logout() {
  return evaluate(`(async()=>{
    const b=await (await fetch('/api/bootstrap')).json();
    const r=await fetch('/api/auth/logout',{method:'POST',headers:{'X-CSRF-Token':b.csrf}});
    return r.status;
  })()`);
}
const nav = (page) => evaluate(`document.querySelector('[data-act="nav"][data-page="${page}"]').click(); true`);

// 让演示账号里始终有能体现新功能的数据（只在缺失时补，重复运行不会堆积）
async function ensureDemoData() {
  return evaluate(`(async()=>{
    const b=await (await fetch('/api/bootstrap')).json();
    const H={'Content-Type':'application/json','X-CSRF-Token':b.csrf};
    const post=(u,d)=>fetch(u,{method:'POST',headers:H,body:JSON.stringify(d)});
    const stu=await (await fetch('/api/teacher/students')).json();
    const sc=await (await fetch('/api/teacher/scores')).json();
    if(!sc.scores.some(x=>x.exam_name==='演示·第一次月考') && stu.students.length){
      const exams=[['演示·第一次月考',72],['演示·期中测验',85],['演示·期末测验',93]];
      for(const s of stu.students.slice(0,3)){
        for(const [name,base] of exams){
          await post('/api/teacher/scores',{student_id:s.id,exam_name:name,
            subject:'数学',score:base+(s.id%3)*3-3,full_score:100,mode:'direct'});
        }
      }
    }
    const hw=await (await fetch('/api/teacher/homeworks')).json();
    if(!hw.homeworks.some(x=>x.title==='演示·定向作业') && stu.students.length){
      await post('/api/teacher/homeworks',{title:'演示·定向作业',subject:'数学',
        mode:'online',target_mode:'selected',student_ids:[stu.students[0].id],
        due_at:'2026-12-01T18:00'});
    }
    if(!hw.homeworks.some(x=>x.title==='演示·已截止作业')){
      await post('/api/teacher/homeworks',{title:'演示·已截止作业',subject:'语文',
        mode:'online',due_at:'2020-01-01T08:00'});
    }
    return true;
  })()`);
}

console.log('渲染检查开始');
await navigate(APP); await wait(700);
// 清掉旧版本 Service Worker 缓存，确保验证的是最新静态资源
await evaluate(`if(window.caches){caches.keys().then(ks=>ks.forEach(k=>caches.delete(k)))}; true`);
await wait(300);
await evaluate(`sessionStorage.removeItem('qike_splash'); location.reload(); true`);
await wait(2100);                                  // 品牌文字与光环出现后取帧
await shot('00-splash');                          // 开场动画进行中
await wait(1600);                                  // 等开场动画播完
await shot('01-login');
console.log('  登录页标题:', await evaluate('document.title'));

let r = await login('teacher', 'teacher_demo@qike.local', 'Teach12345');
console.log('  老师登录:', r.status, r.body.user?.role);
if (r.status === 200) await ensureDemoData();
await navigate(APP); await wait(1200);
console.log('  侧栏分组:', await evaluate(`!!document.querySelector('.anim-nav-group')`),
  '动作已注册:', await evaluate(`!!(window.Qike && Qike.CLICK.animNavMore)`),
  '侧栏项:', await evaluate(`document.querySelectorAll('#sideNav [data-act="nav"]').length`),
  'align:', await evaluate(`getComputedStyle(document.querySelector('.side-nav')).alignContent`),
  '行距:', await evaluate(`(function(){var a=document.querySelector('#sideNav [data-page="overview"]').getBoundingClientRect();var b=document.querySelector('#sideNav [data-page="students"]').getBoundingClientRect();return Math.round(b.top-a.top)})()`));
await shot('02-teacher-overview');
console.log('  工作台统计卡:', await evaluate(`document.querySelectorAll('.stat').length`));

await nav('students'); await wait(900); await shot('03-teacher-students');
console.log('  学生表行数:', await evaluate(`document.querySelectorAll('.tbl tbody tr').length`));

await nav('scores'); await wait(900); await shot('04-teacher-scores');
console.log('  成绩表行数:', await evaluate(`document.querySelectorAll('.tbl tbody tr').length`));

await evaluate(`document.querySelector('[data-act="addScore"]').click(); true`);
await wait(500); await shot('05-publish-score-modal');
console.log('  发布成绩弹窗:', await evaluate(`!!document.querySelector('.modal')`));
await evaluate(`document.querySelector('[data-act="closeModal"]').click(); true`);

await nav('analytics'); await wait(1000); await shot('09-teacher-analytics');
console.log('  分析页统计卡 / 分布条:', await evaluate(
  `document.querySelectorAll('.stat').length + '/' + document.querySelectorAll('.dist-row').length`));
console.log('  分析页排名行:', await evaluate(
  `document.querySelectorAll('.rank-no').length`));

// 批改闭环：作业管理 → 查看提交 → 批改 → 自动回到提交列表
await nav('homeworks'); await wait(800);
const found = await evaluate(`(async()=>{
  const btns=[...document.querySelectorAll('[data-act="viewSubmissions"]')];
  for(let i=0;i<btns.length;i++){
    btns[i].click();
    await new Promise(r=>setTimeout(r,650));
    if(document.querySelector('[data-act="review"]')) return i;
    document.querySelector('[data-act="closeModal"]')?.click();
    await new Promise(r=>setTimeout(r,150));
  }
  return -1;
})()`);
console.log('  找到可批改的作业索引:', found);
if (found >= 0) {
  await evaluate(`document.querySelector('[data-act="review"]').click(); true`);
  await wait(500);
  console.log('  批改弹窗:', await evaluate(`!!document.getElementById('fReview')`));
  await evaluate(`document.getElementById('fReview').requestSubmit(); true`);
  await wait(1100);
  console.log('  批改后弹窗:', await evaluate(`(document.querySelector('.modal-head h3')||{}).textContent||''`));
  await shot('08-review-loop');
  await evaluate(`document.querySelector('[data-act="closeModal"]')?.click(); true`);
}

// 发布作业弹窗：切到「指定学生」，检查多选名单展开
await nav('homeworks'); await wait(700);
await evaluate(`document.querySelector('[data-act="addHomework"]').click(); true`);
await wait(900);
await evaluate(`document.querySelector('input[name="target_mode"][value="selected"]').click(); true`);
await wait(350);
await shot('10-assign-selected-modal');
console.log('  定向名单可见:', await evaluate(
  `!document.getElementById('targetBox').classList.contains('hidden') && document.querySelectorAll('.pick-item').length`));
await evaluate(`document.querySelector('[data-act="closeModal"]').click(); true`);

await nav('settings'); await wait(900); await shot('11-settings-backup');
console.log('  备份按钮:', await evaluate(`!!document.querySelector('[data-act="backupAll"]')`));
console.log('  邮件网关键:', await evaluate(`!!document.querySelector('[name="mail_webhook"]')`));

// 扩展模块页面（老师端）：逐个渲染，确认没有加载失败
for (const p of ['batch','dataio','classes','groups','quiz','scoretools','noticex','tools','annotatex']) {
  const has = await evaluate(`!!document.querySelector('[data-act="nav"][data-page="${p}"]')`);
  if (!has) { console.log('  [XX] 缺少导航', p); continue; }
  await nav(p); await wait(850);
  const txt = await evaluate(`document.getElementById('pageContent').innerText`);
  console.log('  扩展页', p, '字符', txt.length,
    (txt.indexOf('重新加载') >= 0 || txt.indexOf('请求失败') >= 0) ? '[XX 加载失败]' : 'OK');
  await shot('ext-' + p);
}

// 月历网格视图
await nav('tools'); await wait(600);
await evaluate(`document.querySelector('[data-act="opsTab"][data-tab="calendar"]').click(); true`);
await wait(900); await shot('ext-calendar');
console.log('  月历格子:', await evaluate(`document.querySelectorAll('.anim-cal-cell').length`));

await logout();
r = await login('student', 'liming@qike.local', 'NewPass12345');
console.log('  学生登录:', r.status, r.body.user?.role);
await navigate(APP); await wait(1200);
await shot('06-student-overview');
console.log('  学生待办卡:', await evaluate(`document.querySelectorAll('.notice-item').length`));

await nav('homeworks'); await wait(900); await shot('13-student-homeworks');
console.log('  学生端已截止标记:', await evaluate(`document.querySelectorAll('.badge.red').length`));

await nav('scores'); await wait(900); await shot('07-student-scores');
console.log('  学生成绩卡 / 趋势条:', await evaluate(
  `document.querySelectorAll('.hw-card').length + '/' + document.querySelectorAll('.trend-col').length`));

await nav('notices'); await wait(900); await shot('12-student-notices');
console.log('  学生消息条:', await evaluate(`document.querySelectorAll('.notice-item').length`));

for (const p of ['quizdo','msgx','submitx']) {
  const has = await evaluate(`!!document.querySelector('[data-act="nav"][data-page="${p}"]')`);
  if (!has) { console.log('  [XX] 缺少导航', p); continue; }
  await nav(p); await wait(850);
  const txt = await evaluate(`document.getElementById('pageContent').innerText`);
  console.log('  学生扩展页', p, '字符', txt.length,
    (txt.indexOf('重新加载') >= 0 || txt.indexOf('请求失败') >= 0) ? '[XX 加载失败]' : 'OK');
  await shot('ext-student-' + p);
}

await logout();
await navigate(APP); await wait(900);
await evaluate(`document.querySelector('[data-act="forgotPwd"]').click(); true`);
await wait(400); await shot('14-forgot-modal');
console.log('  找回密码弹窗:', await evaluate(`!!document.getElementById('fForgot')`));

console.log('\nJS 错误数:', jsErrors.length);
jsErrors.slice(0, 12).forEach((e) => console.log('  ' + e.slice(0, 220)));
ws.close();
if (jsErrors.length) process.exitCode = 2;
