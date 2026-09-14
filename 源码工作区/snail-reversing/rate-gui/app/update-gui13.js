// GUI 加存销系统面板
const fs = require('fs');
const path = require('path');
const appDir = __dirname;

// 1. index.html
let h = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
h = h.replace(
  '    <button data-nav="recycle"><span class="ic">♻️</span>回收NPC</button>',
  '    <button data-nav="recycle"><span class="ic">♻️</span>回收NPC</button>\n    <button data-nav="sales"><span class="ic">🗂️</span>存销系统</button>'
);
h = h.replace(
  '  <!-- 日志 -->',
  `  <!-- ⑮ 存销系统 -->
  <div class="panel" id="panel-sales">
    <div class="card">
      <h4>存销系统（服务端数据打包）</h4>
      <div class="row">
        <label>生成路径</label>
        <input type="text" id="sl-out" placeholder="如 D:\\存销数据（多区建议 D 盘根目录）">
        <button class="btn-default" id="sl-browse">选择</button>
      </div>
      <div class="row">
        <label>数据目录名</label>
        <input type="text" id="sl-name" placeholder="默认同服名，避免有空格">
      </div>
      <div class="row">
        <label>爆率格式</label>
        <select id="sl-format" style="width:120px;">
          <option value="new">新爆率格式</option>
          <option value="old">原版爆率</option>
        </select>
        <label style="min-width:auto;">分组数</label>
        <input type="number" id="sl-group" value="100" style="width:80px;">
        <span class="hint">个/组</span>
        <label style="min-width:auto;">用户编号</label>
        <select id="sl-uid" style="width:120px;">
          <option value="数字">数字</option>
          <option value="字母">字母</option>
          <option value="数字+字母">数字+字母</option>
        </select>
        <span class="hint">玩家多，请用数字+字母防止重复编号</span>
      </div>
      <div class="row">
        <button class="btn-primary" id="sl-run" style="margin-left:84px;">生成存销数据</button>
      </div>
      <div class="box" id="sl-out"></div>
    </div>
  </div>

  <!-- 日志 -->`
);
fs.writeFileSync(path.join(appDir, 'index.html'), h);
console.log('index.html 已加存销面板');

// 2. renderer.js
let r = fs.readFileSync(path.join(appDir, 'renderer.js'), 'utf8');
r = r.replace(
  "recycle: '回收NPC' }",
  "recycle: '回收NPC', sales: '存销系统' }"
);
r += `
// ===== 存销系统面板 =====
$('sl-browse').onclick = async () => {
  const d = await window.api.selectDir();
  if (d) $('sl-out').value = d;
};
$('sl-run').onclick = async () => {
  const root = $('root').value.trim();
  const outDir = $('sl-out').value.trim();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  if (!outDir) return appendLog('请选择生成路径', 'err');
  out('sl-out', '生成中...');
  const o = {
    root, outDir, name: $('sl-name').value.trim() || '数据包',
    format: $('sl-format').value, groupSize: parseInt($('sl-group').value, 10) || 100,
    userIdType: $('sl-uid').value
  };
  const r = await window.api.genSales(o);
  out('sl-out', r.log.join('\\n'));
};
`;
fs.writeFileSync(path.join(appDir, 'renderer.js'), r);
console.log('renderer.js 已加存销逻辑');

// 3. preload.js
let p = fs.readFileSync(path.join(appDir, 'preload.js'), 'utf8');
p = p.replace(
  '  addRecycle: (o) => ipcRenderer.invoke(\'add-recycle\', o),',
  `  addRecycle: (o) => ipcRenderer.invoke('add-recycle', o),
  genSales: (o) => ipcRenderer.invoke('gen-sales', o),`
);
fs.writeFileSync(path.join(appDir, 'preload.js'), p);
console.log('preload.js 已加存销 API');

// 4. main.js
let m = fs.readFileSync(path.join(appDir, 'main.js'), 'utf8');
m = m.replace(
  "ipcMain.handle('add-recycle'",
  `ipcMain.handle('gen-sales', (e, o) => {
  if (!o.root) return { log: ['错误: 未选择引擎根目录'] };
  const r = lib.genSalesData(o.root, o);
  if (!r.ok) return { log: [r.msg, ...(r.stages || []).map(s => '  ' + s)] };
  return { log: ['=== 存销系统生成 ===', ...r.stages.map(s => '  ' + s), '输出: ' + r.outBase] };
});

ipcMain.handle('add-recycle'`
);
fs.writeFileSync(path.join(appDir, 'main.js'), m);
console.log('main.js 已加存销 IPC');
