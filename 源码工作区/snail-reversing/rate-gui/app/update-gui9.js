// GUI 加脚本注入：导航 + 面板 + renderer + preload + main
const fs = require('fs');
const path = require('path');
const appDir = __dirname;

// 1. index.html
let h = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
h = h.replace(
  '    <button data-nav="ports"><span class="ic">🔌</span>端口检测</button>',
  '    <button data-nav="ports"><span class="ic">🔌</span>端口检测</button>\n    <button data-nav="inject"><span class="ic">📥</span>脚本注入</button>'
);
h = h.replace(
  '  <!-- 日志 -->',
  `  <!-- ⑪ 脚本注入 -->
  <div class="panel" id="panel-inject">
    <div class="card">
      <div class="row">
        <label>注入名称</label>
        <input type="text" id="i-name" placeholder="注入项名称（用于防重复检测）">
      </div>
      <div class="row">
        <label>注入目标</label>
        <select id="i-target" style="width:180px;">
          <option value="QF">QFunction-0.txt（Market_Def）</option>
          <option value="QM">QManage.txt（MapQuest_Def）</option>
          <option value="custom">自定义路径</option>
        </select>
        <input type="text" id="i-target-file" placeholder="自定义相对路径，如 QuestDiary\\我的脚本.txt" style="display:none;">
      </div>
      <div class="row">
        <label>注入模式</label>
        <div class="seg" id="i-mode-seg">
          <button data-im="append" class="active">追加注入</button>
          <button data-im="overwrite">覆盖注入</button>
          <button data-im="cancel">已注入则取消</button>
        </div>
      </div>
      <div class="row">
        <label>变量替换</label>
        <label style="min-width:auto;"><input type="checkbox" id="i-vars"> 替换注入脚本内占用变量（N$/S$/U 等冲突时自动换名）</label>
      </div>
      <div class="row" style="align-items:flex-start;">
        <label>脚本内容</label>
        <textarea id="i-content" rows="10" placeholder="要注入的脚本段，如：&#10;[@我的功能]&#10;#IF&#10;CHECKGOLD 1000&#10;#ACT&#10;TAKE 金币 1000&#10;GIVE 元宝 1" style="flex:1;font-family:Consolas,monospace;font-size:13px;padding:8px;border:1px solid #d8dee8;border-radius:6px;background:#fafbfd;"></textarea>
      </div>
      <div class="row">
        <button class="btn-primary" id="i-run" style="margin-left:84px;">执行注入</button>
        <span class="hint">重复注入检测：内容前后自动加标记，已注入过会按模式处理</span>
      </div>
      <div class="box" id="i-out"></div>
    </div>
  </div>

  <!-- 日志 -->`
);
fs.writeFileSync(path.join(appDir, 'index.html'), h);
console.log('index.html 已加注入面板');

// 2. renderer.js
let r = fs.readFileSync(path.join(appDir, 'renderer.js'), 'utf8');
r = r.replace(
  "ports: '端口检测' }",
  "ports: '端口检测', inject: '脚本注入' }"
);
r += `
// ===== 脚本注入面板 =====
let iMode = 'append';
wireSeg('i-mode-seg', d => { iMode = d.im; });
$('i-target').onchange = () => {
  $('i-target-file').style.display = $('i-target').value === 'custom' ? 'block' : 'none';
};
$('i-run').onclick = async () => {
  const root = $('root').value.trim();
  const name = $('i-name').value.trim();
  const target = $('i-target').value === 'custom' ? $('i-target-file').value.trim() : $('i-target').value;
  const content = $('i-content').value;
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  if (!name) return appendLog('请填写注入名称', 'err');
  if (!target) return appendLog('请选择注入目标', 'err');
  if (!content.trim()) return appendLog('注入内容为空', 'err');
  out('i-out', '注入中...');
  const r = await window.api.doInject({ root, name, target, content, mode: iMode, varReplace: $('i-vars').checked });
  out('i-out', r.log.join('\\n'));
};
`;
fs.writeFileSync(path.join(appDir, 'renderer.js'), r);
console.log('renderer.js 已加注入逻辑');

// 3. preload.js
let p = fs.readFileSync(path.join(appDir, 'preload.js'), 'utf8');
p = p.replace(
  '  checkPorts: (root) => ipcRenderer.invoke(\'check-ports\', root),',
  `  checkPorts: (root) => ipcRenderer.invoke('check-ports', root),
  doInject: (o) => ipcRenderer.invoke('do-inject', o),`
);
fs.writeFileSync(path.join(appDir, 'preload.js'), p);
console.log('preload.js 已加注入 API');

// 4. main.js
let m = fs.readFileSync(path.join(appDir, 'main.js'), 'utf8');
m = m.replace(
  "ipcMain.handle('check-ports'",
  `ipcMain.handle('do-inject', (e, o) => {
  if (!o.root) return { log: ['错误: 未选择引擎根目录'] };
  const r = lib.injectScript(o.root, o);
  if (!r.ok) return { log: [r.msg] };
  return { log: ['=== 脚本注入完成 ===', '名称: ' + r.name + (r.already ? '（检测到已注入，模式=' + r.mode + '）' : ''), '文件: ' + r.file] };
});

ipcMain.handle('check-ports'`
);
fs.writeFileSync(path.join(appDir, 'main.js'), m);
console.log('main.js 已加注入 IPC');
