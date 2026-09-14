// GUI 加机器人脚本面板
const fs = require('fs');
const path = require('path');
const appDir = __dirname;

// 1. index.html
let h = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
h = h.replace(
  '    <button data-nav="inject"><span class="ic">📥</span>脚本注入</button>',
  '    <button data-nav="inject"><span class="ic">📥</span>脚本注入</button>\n    <button data-nav="robot"><span class="ic">🤖</span>机器人脚本</button>'
);
h = h.replace(
  '  <!-- 日志 -->',
  `  <!-- ⑫ 机器人脚本 -->
  <div class="panel" id="panel-robot">
    <div class="card">
      <div class="row">
        <button class="btn-primary" id="rb-list">查看机器人配置</button>
        <span class="hint">读取 AutoRunRobot.txt（定时行）+ RobotManage.txt（脚本段）</span>
      </div>
      <div class="box" id="rb-out"></div>
      <hr>
      <h4>新增定时机器人</h4>
      <div class="row">
        <label>名称</label><input type="text" id="rb-name" placeholder="如 全图清怪 / BOSS刷怪" style="width:150px;">
        <label style="min-width:auto;">间隔</label><input type="number" id="rb-interval" value="60" style="width:70px;">
        <select id="rb-unit" style="width:90px;">
          <option value="SEC">秒</option>
          <option value="MIN">分钟</option>
          <option value="HOUR">小时</option>
        </select>
        <label style="min-width:auto;">类型</label>
        <div class="seg" id="rb-type-seg">
          <button data-rt="clear" class="active">清怪</button>
          <button data-rt="spawn">刷怪</button>
        </div>
      </div>
      <div class="row" id="rb-row-clear">
        <label>清怪地图</label>
        <input type="text" id="rb-maps" placeholder="多个地图用逗号分隔，如 D717,shuai209,Q004">
        <span class="hint">生成 CLEARMAPMON 命令</span>
      </div>
      <div class="row" id="rb-row-spawn" style="display:none;">
        <label>刷怪地图</label><input type="text" id="rb-map" placeholder="地图代码" style="width:100px;">
        <label style="min-width:auto;">怪物</label><input type="text" id="rb-mon" placeholder="怪物名" style="width:120px;">
        <label style="min-width:auto;">数量</label><input type="number" id="rb-count" value="1" style="width:60px;">
      </div>
      <div class="row">
        <button class="btn-primary" id="rb-add" style="margin-left:84px;">新增机器人</button>
      </div>
      <hr>
      <h4>删除机器人</h4>
      <div class="row">
        <label>名称</label>
        <input type="text" id="rb-dname" placeholder="机器人名称" style="width:150px;">
        <button class="btn-danger" id="rb-del">删除</button>
      </div>
    </div>
  </div>

  <!-- 日志 -->`
);
fs.writeFileSync(path.join(appDir, 'index.html'), h);
console.log('index.html 已加机器人面板');

// 2. renderer.js
let r = fs.readFileSync(path.join(appDir, 'renderer.js'), 'utf8');
r = r.replace(
  "inject: '脚本注入' }",
  "inject: '脚本注入', robot: '机器人脚本' }"
);
r += `
// ===== 机器人脚本面板 =====
let rbType = 'clear';
wireSeg('rb-type-seg', d => {
  rbType = d.rt;
  $('rb-row-clear').style.display = rbType === 'clear' ? 'flex' : 'none';
  $('rb-row-spawn').style.display = rbType === 'spawn' ? 'flex' : 'none';
});
$('rb-list').onclick = async () => {
  const root = $('root').value.trim();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const r = await window.api.robotList(root);
  out('rb-out', r.log.join('\\n'));
};
$('rb-add').onclick = async () => {
  const root = $('root').value.trim();
  const name = $('rb-name').value.trim();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  if (!name) return appendLog('请填写机器人名称', 'err');
  const opts = {
    name, interval: parseInt($('rb-interval').value, 10) || 60,
    unit: $('rb-unit').value, type: rbType,
    maps: $('rb-maps').value.split(',').map(x => x.trim()).filter(Boolean),
    map: $('rb-map').value.trim(), mon: $('rb-mon').value.trim(),
    count: parseInt($('rb-count').value, 10) || 1
  };
  const r = await window.api.robotAdd(root, opts);
  out('rb-out', r.log.join('\\n'));
};
$('rb-del').onclick = async () => {
  const root = $('root').value.trim();
  const name = $('rb-dname').value.trim();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  if (!name) return appendLog('请填写机器人名称', 'err');
  const r = await window.api.robotDel(root, name);
  out('rb-out', r.log.join('\\n'));
};
`;
fs.writeFileSync(path.join(appDir, 'renderer.js'), r);
console.log('renderer.js 已加机器人逻辑');

// 3. preload.js
let p = fs.readFileSync(path.join(appDir, 'preload.js'), 'utf8');
p = p.replace(
  '  doInject: (o) => ipcRenderer.invoke(\'do-inject\', o),',
  `  doInject: (o) => ipcRenderer.invoke('do-inject', o),
  robotList: (root) => ipcRenderer.invoke('robot-list', root),
  robotAdd: (root, opts) => ipcRenderer.invoke('robot-add', { root, opts }),
  robotDel: (root, name) => ipcRenderer.invoke('robot-del', { root, name }),`
);
fs.writeFileSync(path.join(appDir, 'preload.js'), p);
console.log('preload.js 已加机器人 API');

// 4. main.js
let m = fs.readFileSync(path.join(appDir, 'main.js'), 'utf8');
m = m.replace(
  "ipcMain.handle('do-inject'",
  `ipcMain.handle('robot-list', (e, root) => {
  if (!root) return { log: ['错误: 未选择引擎根目录'] };
  const r = lib.readRobots(root);
  if (!r.ok) return { log: [r.msg] };
  const log = ['=== 机器人脚本（' + r.dir + '）===', 'AutoRunRobot.txt 定时行 ' + r.robots.length + ' 条：'];
  for (const rb of r.robots) log.push('  ' + (rb.enabled ? '✓' : '✗禁用') + ' #AutoRun NPC ' + rb.unit + ' ' + rb.value + ' @' + rb.section);
  log.push('RobotManage.txt 段 ' + r.sections.length + ' 个：');
  for (const sec of r.sections) log.push('  [@' + sec + ']');
  return { log };
});

ipcMain.handle('robot-add', (e, { root, opts }) => {
  if (!root) return { log: ['错误: 未选择引擎根目录'] };
  const a = lib.addRobot(root, opts);
  return { log: [a.ok ? '已新增 ' + a.section + '（' + a.runLine + '）' : a.msg] };
});

ipcMain.handle('robot-del', (e, { root, name }) => {
  if (!root) return { log: ['错误: 未选择引擎根目录'] };
  const d = lib.delRobot(root, name);
  return { log: [d.ok ? '已删除 ' + name + '（定时行已注释，段已移除）' : d.msg] };
});

ipcMain.handle('do-inject'`
);
fs.writeFileSync(path.join(appDir, 'main.js'), m);
console.log('main.js 已加机器人 IPC');
