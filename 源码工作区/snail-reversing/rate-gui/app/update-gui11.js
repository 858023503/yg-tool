// GUI 加目录同步面板
const fs = require('fs');
const path = require('path');
const appDir = __dirname;

// 1. index.html
let h = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
h = h.replace(
  '    <button data-nav="robot"><span class="ic">🤖</span>机器人脚本</button>',
  '    <button data-nav="robot"><span class="ic">🤖</span>机器人脚本</button>\n    <button data-nav="sync"><span class="ic">📡</span>目录同步</button>'
);
h = h.replace(
  '  <!-- 日志 -->',
  `  <!-- ⑬ 目录同步（FTP） -->
  <div class="panel" id="panel-sync">
    <div class="card">
      <h4>FTP 服务器</h4>
      <div class="row">
        <label>主机</label><input type="text" id="sy-host" placeholder="如 192.168.1.100" style="width:150px;">
        <label style="min-width:auto;">端口</label><input type="number" id="sy-port" value="21" style="width:70px;">
        <label style="min-width:auto;">用户</label><input type="text" id="sy-user" style="width:110px;">
        <label style="min-width:auto;">密码</label><input type="password" id="sy-pass" style="width:110px;">
      </div>
      <div class="row">
        <label>同步规则</label>
        <input type="text" id="sy-rule" placeholder="本地目录=远程目录，如 Mir200/Envir=/Envir" style="flex:1;">
        <span class="hint">多条规则用 ; 分隔</span>
      </div>
      <div class="row">
        <button class="btn-primary" id="sy-run">开始同步</button>
        <button class="btn-default" id="sy-save">保存配置</button>
        <span class="hint">配置保存在工具目录 sync-config.json</span>
      </div>
      <div class="box" id="sy-out" style="max-height:280px;"></div>
    </div>
  </div>

  <!-- 日志 -->`
);
fs.writeFileSync(path.join(appDir, 'index.html'), h);
console.log('index.html 已加同步面板');

// 2. renderer.js
let r = fs.readFileSync(path.join(appDir, 'renderer.js'), 'utf8');
r = r.replace(
  "robot: '机器人脚本' }",
  "robot: '机器人脚本', sync: '目录同步' }"
);
r += `
// ===== 目录同步面板 =====
const syCfg = () => ({
  host: $('sy-host').value.trim(), port: parseInt($('sy-port').value, 10) || 21,
  user: $('sy-user').value.trim(), pass: $('sy-pass').value,
  rules: $('sy-rule').value.split(';').map(x => x.trim()).filter(Boolean).map(x => {
    const [l, rr] = x.split('=');
    return { local: l.trim(), remote: (rr || '').trim() || '/' + l.trim().split('/').pop() };
  })
});
$('sy-save').onclick = async () => {
  const c = syCfg();
  const r = await window.api.syncSave(c);
  out('sy-out', r.log.join('\\n'));
};
$('sy-run').onclick = async () => {
  const root = $('root').value.trim();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const c = syCfg();
  if (!c.host) return appendLog('请填写 FTP 主机', 'err');
  if (!c.rules.length) return appendLog('请填写同步规则', 'err');
  out('sy-out', '连接 ' + c.host + ':' + c.port + ' ...');
  const r = await window.api.syncRun(root, c);
  out('sy-out', r.log.join('\\n'));
};
`;
fs.writeFileSync(path.join(appDir, 'renderer.js'), r);
console.log('renderer.js 已加同步逻辑');

// 3. preload.js
let p = fs.readFileSync(path.join(appDir, 'preload.js'), 'utf8');
p = p.replace(
  '  robotDel: (root, name) => ipcRenderer.invoke(\'robot-del\', { root, name }),',
  `  robotDel: (root, name) => ipcRenderer.invoke('robot-del', { root, name }),
  syncSave: (cfg) => ipcRenderer.invoke('sync-save', cfg),
  syncRun: (root, cfg) => ipcRenderer.invoke('sync-run', { root, cfg }),`
);
fs.writeFileSync(path.join(appDir, 'preload.js'), p);
console.log('preload.js 已加同步 API');

// 4. main.js
let m = fs.readFileSync(path.join(appDir, 'main.js'), 'utf8');
m = m.replace(
  "ipcMain.handle('robot-list'",
  `ipcMain.handle('sync-save', (e, cfg) => {
  const r = lib.saveSyncConfig(cfg);
  return { log: ['配置已保存: ' + r.file] };
});

ipcMain.handle('sync-run', async (e, { root, cfg }) => {
  const log = ['=== 目录同步到 ' + cfg.host + ':' + cfg.port + ' ==='];
  for (const rule of cfg.rules) log.push('规则: ' + rule.local + ' → ' + rule.remote);
  const r = await lib.ftpSync(root, cfg, m => log.push('  ' + m));
  if (!r.ok) { log.push(r.msg); return { log }; }
  log.push('完成: 上传 ' + r.uploaded + ' / 跳过 ' + r.skipped + ' / 失败 ' + r.failed);
  for (const e of r.errors.slice(0, 8)) log.push('  ✗ ' + e);
  return { log };
});

ipcMain.handle('robot-list'`
);
fs.writeFileSync(path.join(appDir, 'main.js'), m);
console.log('main.js 已加同步 IPC');
