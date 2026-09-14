// GUI 加货币消耗面板
const fs = require('fs');
const path = require('path');
const appDir = __dirname;

// ---- index.html ----
let h = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
h = h.replace(
  '<button data-tab="mongen" id="tab-mongen">刷怪配置</button>',
  '<button data-tab="mongen" id="tab-mongen">刷怪配置</button>\n      <button data-tab="currency" id="tab-currency">货币消耗</button>'
);
h = h.replace(
  '    </div>\n  </div>\n</body>',
  `    </div>
    <!-- ===== 货币消耗分析 ===== -->
    <div class="panel" id="panel-currency" style="display:none;">
      <h3>版本货币消耗分析</h3>
      <div class="row">
        <label>引擎根目录</label>
        <input type="text" id="c-root" placeholder="例如 D:\\Mirserver怀念毕业端">
        <button id="c-browse">选择</button>
        <button class="btn-primary" id="c-run">开始分析</button>
      </div>
      <div class="row">
        <label>过滤</label>
        <label style="min-width:auto;"><input type="checkbox" id="c-drop-qf"> 丢弃 QFunction 消耗</label>
        <label style="min-width:auto;"><input type="checkbox" id="c-drop-qm"> 丢弃 QManage 消耗</label>
      </div>
      <div class="box" id="c-out" style="white-space:pre;font-family:Consolas,monospace;font-size:12px;max-height:320px;overflow:auto;"></div>
    </div>
  </div>
</body>`
);
fs.writeFileSync(path.join(appDir, 'index.html'), h);
console.log('index.html 已加货币面板');

// ---- renderer.js ----
let r = fs.readFileSync(path.join(appDir, 'renderer.js'), 'utf8');
r = r.replace(
  "['adjust', 'random', 'mongen']",
  "['adjust', 'random', 'mongen', 'currency']"
);
r += `
// ===== 货币消耗面板 =====
$('c-browse').onclick = async () => {
  const d = await window.api.pickDir();
  if (d) $('c-root').value = d;
};
$('c-run').onclick = async () => {
  const root = $('c-root').value.trim();
  if (!root) return out('c-out', '请先选择引擎根目录');
  out('c-out', '正在分析版本消耗，请等待...');
  const r = await window.api.currencyReport(root, {
    dropQFunction: $('c-drop-qf').checked,
    dropQManage: $('c-drop-qm').checked
  });
  out('c-out', r.log.join('\\n'));
};
`;
fs.writeFileSync(path.join(appDir, 'renderer.js'), r);
console.log('renderer.js 已加货币逻辑');

// ---- preload.js ----
let p = fs.readFileSync(path.join(appDir, 'preload.js'), 'utf8');
p = p.replace(
  'mongenDel: (root, map, mon) => ipcRenderer.invoke(\'mongen-del\', { root, map, mon }),',
  `mongenDel: (root, map, mon) => ipcRenderer.invoke('mongen-del', { root, map, mon }),
    currencyReport: (root, opts) => ipcRenderer.invoke('currency-report', { root, opts }),`
);
fs.writeFileSync(path.join(appDir, 'preload.js'), p);
console.log('preload.js 已加货币 API');

// ---- main.js ----
let m = fs.readFileSync(path.join(appDir, 'main.js'), 'utf8');
m = m.replace(
  "ipcMain.handle('mongen-list'",
  `ipcMain.handle('currency-report', (e, { root, opts }) => {
  if (!root) return { log: ['错误: 未选择引擎根目录'] };
  const rep = lib.currencyReport(root, opts || {});
  if (!rep.ok) return { log: [rep.msg] };
  const log = ['=== 版本货币消耗分析（' + rep.base + '）===', '共匹配 ' + rep.total + ' 条货币命令：', '', '货币\\t消耗\\t收入\\t检查\\t次数\\t文件数\\tNPC数'];
  for (const c of rep.currencies) {
    log.push(c.currency + '\\t' + c.consume + '\\t' + c.income + '\\t' + c.check + '\\t' + c.count + '\\t' + c.fileCount + '\\t' + c.npcCount);
  }
  log.push('', '=== NPC 消耗排行（前 15）===');
  for (const n of rep.npcs.slice(0, 15)) {
    log.push(n.currency + ' | ' + n.npc + ': 消耗 ' + n.consume + ' / 收入 ' + n.income + '（' + n.count + ' 次）');
  }
  return { log };
});

ipcMain.handle('mongen-list'`
);
fs.writeFileSync(path.join(appDir, 'main.js'), m);
require('child_process').execSync('node --check main.js', { stdio: 'inherit' });
console.log('main.js 已加货币 IPC，语法 OK');
