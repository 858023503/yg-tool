// GUI 加端口检测：导航 + 面板 + renderer + preload + main
const fs = require('fs');
const path = require('path');
const appDir = __dirname;

// 1. index.html：导航加"端口检测"（在"货币兑换"后）
let h = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
h = h.replace(
  '    <button data-nav="exchange"><span class="ic">🔄</span>货币兑换</button>',
  '    <button data-nav="exchange"><span class="ic">🔄</span>货币兑换</button>\n    <button data-nav="ports"><span class="ic">🔌</span>端口检测</button>'
);
// 面板：加在日志 card 前
h = h.replace(
  '  <!-- 日志 -->',
  `  <!-- ⑩ 端口检测 -->
  <div class="panel" id="panel-ports">
    <div class="card">
      <div class="row">
        <label>检测</label>
        <button class="btn-primary" id="p-run">检测端口占用</button>
        <span class="hint">扫描 !Setup.txt / Config.ini / LoginGate / SelGate / RunGate / DBServer 的端口配置</span>
      </div>
      <div class="box" id="p-out"></div>
    </div>
  </div>

  <!-- 日志 -->`
);
fs.writeFileSync(path.join(appDir, 'index.html'), h);
console.log('index.html 已加端口面板');

// 2. renderer.js：pageTitles + 事件
let r = fs.readFileSync(path.join(appDir, 'renderer.js'), 'utf8');
r = r.replace(
  "exchange: '货币兑换' }",
  "exchange: '货币兑换', ports: '端口检测' }"
);
r += `
// ===== 端口检测面板 =====
$('p-run').onclick = async () => {
  const root = $('root').value.trim();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  out('p-out', '检测中...');
  const r = await window.api.checkPorts(root);
  out('p-out', r.log.join('\\n'));
};
`;
fs.writeFileSync(path.join(appDir, 'renderer.js'), r);
console.log('renderer.js 已加端口逻辑');

// 3. preload.js
let p = fs.readFileSync(path.join(appDir, 'preload.js'), 'utf8');
p = p.replace(
  '  addExchange: (o) => ipcRenderer.invoke(\'add-exchange\', o),',
  `  addExchange: (o) => ipcRenderer.invoke('add-exchange', o),
  checkPorts: (root) => ipcRenderer.invoke('check-ports', root),`
);
fs.writeFileSync(path.join(appDir, 'preload.js'), p);
console.log('preload.js 已加端口 API');

// 4. main.js
let m = fs.readFileSync(path.join(appDir, 'main.js'), 'utf8');
m = m.replace(
  "ipcMain.handle('add-exchange'",
  `ipcMain.handle('check-ports', async (e, root) => {
  if (!root) return { log: ['错误: 未选择引擎根目录'] };
  const c = await lib.checkPorts(root);
  const log = ['=== 服务端端口占用检测（' + root + '）===', '共 ' + c.total + ' 个端口，占用 ' + c.inUseCount + ' 个：', '状态\\t端口\\t用途'];
  for (const r of c.results) {
    const labels = r.keys.map(k => k.label + '/' + k.key).join(', ');
    log.push((r.inUse ? '■ 占用' : '□ 空闲') + '\\t' + r.port + '\\t' + labels);
  }
  if (c.inUseCount > 0) log.push('提示: 有端口被占用，启动服务端前请先释放或修改配置');
  return { log };
});

ipcMain.handle('add-exchange'`
);
fs.writeFileSync(path.join(appDir, 'main.js'), m);
require('child_process').execSync('node --check main.js', { stdio: 'inherit' });
console.log('main.js 已加端口 IPC，语法 OK');
