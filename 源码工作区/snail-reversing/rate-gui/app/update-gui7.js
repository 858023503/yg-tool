// GUI 加货币兑换面板
const fs = require('fs');
const path = require('path');
const appDir = __dirname;

// ---- index.html ----
let h = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
h = h.replace(
  '<button data-tab="search" id="tab-search">脚本搜索</button>',
  '<button data-tab="search" id="tab-search">脚本搜索</button>\n      <button data-tab="exchange" id="tab-exchange">货币兑换</button>'
);
h = h.replace(
  '    </div>\n  </div>\n</body>',
  `    </div>
    <!-- ===== 货币兑换 NPC ===== -->
    <div class="panel" id="panel-exchange" style="display:none;">
      <h3>生成货币兑换 NPC</h3>
      <div class="row">
        <label>引擎根目录</label>
        <input type="text" id="x-root" placeholder="例如 D:\\Mirserver怀念毕业端">
        <button id="x-browse">选择</button>
      </div>
      <div class="row">
        <label>地图代码</label><input type="text" id="x-map" placeholder="如 3" style="width:100px;">
        <label style="min-width:auto;">X</label><input type="number" id="x-posx" style="width:70px;">
        <label style="min-width:auto;">Y</label><input type="number" id="x-posy" style="width:70px;">
        <label style="min-width:auto;">NPC名</label><input type="text" id="x-npc" placeholder="NPC 名称">
      </div>
      <div class="row">
        <label>消耗</label>
        <select id="x-from" style="width:110px;">
          <option value="金币">金币</option>
          <option value="元宝">元宝</option>
          <option value="金刚石">金刚石</option>
          <option value="灵符">灵符</option>
          <option value="声望">声望</option>
          <option value="荣誉">荣誉</option>
          <option value="自定义变量">自定义变量(U11等)</option>
        </select>
        <input type="number" id="x-from-amt" placeholder="消耗数量" style="width:100px;">
        <label style="min-width:auto;">获得</label>
        <select id="x-to" style="width:110px;">
          <option value="元宝">元宝</option>
          <option value="金币">金币</option>
          <option value="金刚石">金刚石</option>
          <option value="灵符">灵符</option>
          <option value="声望">声望</option>
          <option value="荣誉">荣誉</option>
        </select>
        <input type="number" id="x-to-amt" placeholder="获得数量" style="width:100px;">
      </div>
      <div class="row" id="x-row-var" style="display:none;">
        <label>自定义货币变量</label>
        <input type="text" id="x-var" placeholder="如 U11 / 蜗牛币|U11" style="width:180px;">
        <span class="hint">填写货币变量名</span>
      </div>
      <div class="row">
        <label>重复次数</label>
        <input type="number" id="x-count" value="1" min="1" max="5" style="width:70px;">
        <span class="hint">1-5，生成多个兑换入口</span>
        <button class="btn-primary" id="x-run" style="margin-left:20px;">生成兑换 NPC</button>
      </div>
      <div class="box" id="x-out" style="white-space:pre;font-family:Consolas,monospace;font-size:12px;max-height:220px;overflow:auto;"></div>
    </div>
  </div>
</body>`
);
fs.writeFileSync(path.join(appDir, 'index.html'), h);
console.log('index.html 已加兑换面板');

// ---- renderer.js ----
let r = fs.readFileSync(path.join(appDir, 'renderer.js'), 'utf8');
r = r.replace(
  "['adjust', 'random', 'mongen', 'currency', 'search']",
  "['adjust', 'random', 'mongen', 'currency', 'search', 'exchange']"
);
r += `
// ===== 货币兑换面板 =====
$('x-browse').onclick = async () => {
  const d = await window.api.pickDir();
  if (d) $('x-root').value = d;
};
$('x-from').onchange = () => {
  $('x-row-var').style.display = $('x-from').value === '自定义变量' ? 'flex' : 'none';
};
$('x-run').onclick = async () => {
  const root = $('x-root').value.trim();
  const from = $('x-from').value, to = $('x-to').value;
  const fromName = from === '自定义变量' ? ($('x-var').value.trim() || 'U11') : from;
  if (!root || !$('x-map').value.trim() || !$('x-posx').value || !$('x-posy').value || !$('x-npc').value.trim()) {
    return out('x-out', '请填写：引擎根目录、地图、坐标、NPC名');
  }
  if (!parseInt($('x-from-amt').value, 10) || !parseInt($('x-to-amt').value, 10)) {
    return out('x-out', '请填写消耗数量和获得数量');
  }
  const r = await window.api.addExchange({
    root,
    mapCode: $('x-map').value.trim(), x: $('x-posx').value, y: $('x-posy').value,
    npcName: $('x-npc').value.trim(), count: parseInt($('x-count').value, 10) || 1,
    items: [{
      from: fromName, fromName, fromAmount: parseInt($('x-from-amt').value, 10),
      to, toName: to, toAmount: parseInt($('x-to-amt').value, 10)
    }]
  });
  out('x-out', r.log.join('\\n'));
};
`;
fs.writeFileSync(path.join(appDir, 'renderer.js'), r);
console.log('renderer.js 已加兑换逻辑');

// ---- preload.js ----
let p = fs.readFileSync(path.join(appDir, 'preload.js'), 'utf8');
p = p.replace(
  'scriptReplace: (o) => ipcRenderer.invoke(\'script-replace\', o),',
  `scriptReplace: (o) => ipcRenderer.invoke('script-replace', o),
    addExchange: (o) => ipcRenderer.invoke('add-exchange', o),`
);
fs.writeFileSync(path.join(appDir, 'preload.js'), p);
console.log('preload.js 已加兑换 API');

// ---- main.js ----
let m = fs.readFileSync(path.join(appDir, 'main.js'), 'utf8');
m = m.replace(
  "ipcMain.handle('script-search'",
  `ipcMain.handle('add-exchange', (e, o) => {
  if (!o.root) return { log: ['错误: 未选择引擎根目录'] };
  const r = lib.addExchangeNpc(o.root, o);
  if (!r.ok) return { log: [r.msg] };
  const log = ['=== 货币兑换 NPC 生成完成 ===', 'NPC: ' + r.npc,
    'MerChant.txt: ' + r.merchant + (r.updated ? '（已更新）' : '（已追加）'),
    '脚本: ' + r.scriptFile + '（' + r.scriptLines + ' 行）',
    '提示: 重启引擎或 @reloadnpc 重新加载所有NPC生效'];
  return { log };
});

ipcMain.handle('script-search'`
);
fs.writeFileSync(path.join(appDir, 'main.js'), m);
require('child_process').execSync('node --check main.js', { stdio: 'inherit' });
console.log('main.js 已加兑换 IPC，语法 OK');
