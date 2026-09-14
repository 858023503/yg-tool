// GUI 加回收 NPC 生成面板
const fs = require('fs');
const path = require('path');
const appDir = __dirname;

// 1. index.html
let h = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
h = h.replace(
  '    <button data-nav="sync"><span class="ic">📡</span>目录同步</button>',
  '    <button data-nav="sync"><span class="ic">📡</span>目录同步</button>\n    <button data-nav="recycle"><span class="ic">♻️</span>回收NPC</button>'
);
h = h.replace(
  '  <!-- 日志 -->',
  `  <!-- ⑭ 回收 NPC 生成器 -->
  <div class="panel" id="panel-recycle">
    <div class="card">
      <h4>NPC 位置</h4>
      <div class="row">
        <label>地图代码</label><input type="text" id="rc-map" placeholder="如 3" style="width:100px;">
        <label style="min-width:auto;">X</label><input type="number" id="rc-posx" style="width:70px;">
        <label style="min-width:auto;">Y</label><input type="number" id="rc-posy" style="width:70px;">
        <label style="min-width:auto;">NPC名</label><input type="text" id="rc-npc" placeholder="NPC 名称" style="width:140px;">
      </div>
      <div class="row">
        <label>回收给予</label>
        <select id="rc-cur" style="width:110px;">
          <option value="gold">金币</option>
          <option value="gamegold">元宝</option>
          <option value="diy">自定义货币</option>
        </select>
        <input type="text" id="rc-cur-name" placeholder="货币名|变量名，如：蜗牛币|U11" style="width:200px;display:none;">
        <span class="hint" id="rc-cur-hint" style="display:none;">格式为：货币名|变量名，如：蜗牛币|U11</span>
      </div>
      <div class="row" style="align-items:flex-start;">
        <label>回收物品</label>
        <textarea id="rc-items" rows="8" placeholder="每行一个：物品名=回收价格&#10;如：&#10;屠龙=1000&#10;裁决之杖=300&#10;金创药=5" style="flex:1;font-family:Consolas,monospace;font-size:13px;padding:8px;border:1px solid #d8dee8;border-radius:6px;background:#fafbfd;"></textarea>
      </div>
      <div class="row">
        <button class="btn-primary" id="rc-run" style="margin-left:84px;">生成回收 NPC</button>
        <span class="hint">生成 MerChant 注册 + Market_Def 回收脚本（MUL 数量×价格 → GIVE 货币）</span>
      </div>
      <div class="box" id="rc-out"></div>
    </div>
  </div>

  <!-- 日志 -->`
);
fs.writeFileSync(path.join(appDir, 'index.html'), h);
console.log('index.html 已加回收面板');

// 2. renderer.js
let r = fs.readFileSync(path.join(appDir, 'renderer.js'), 'utf8');
r = r.replace(
  "sync: '目录同步' }",
  "sync: '目录同步', recycle: '回收NPC' }"
);
r += `
// ===== 回收 NPC 面板 =====
$('rc-cur').onchange = () => {
  const isDiy = $('rc-cur').value === 'diy';
  $('rc-cur-name').style.display = isDiy ? 'block' : 'none';
  $('rc-cur-hint').style.display = isDiy ? 'inline' : 'none';
};
$('rc-run').onclick = async () => {
  const root = $('root').value.trim();
  const curType = $('rc-cur').value;
  const curName = $('rc-cur-name').value.trim();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  if (!curName && curType === 'diy') return appendLog('自定义货币需填写 货币名|变量名', 'err');
  const items = $('rc-items').value.split('\\n').map(x => x.trim()).filter(Boolean).map(x => {
    const [n, p] = x.split('=');
    return { name: (n || '').trim(), price: parseInt(p, 10) || 1 };
  }).filter(x => x.name);
  if (!items.length) return appendLog('请填写回收物品', 'err');
  const cur = { key: curType, name: curType === 'gold' ? '金币' : (curType === 'gamegold' ? '元宝' : (curName.split('|')[0] || '自定义')), diyVar: curName.split('|')[1] || curName };
  const o = {
    root, mapCode: $('rc-map').value.trim(), x: $('rc-posx').value, y: $('rc-posy').value,
    npcName: $('rc-npc').value.trim(), currency: cur, items
  };
  const r = await window.api.addRecycle(o);
  out('rc-out', r.log.join('\\n'));
};
`;
fs.writeFileSync(path.join(appDir, 'renderer.js'), r);
console.log('renderer.js 已加回收逻辑');

// 3. preload.js
let p = fs.readFileSync(path.join(appDir, 'preload.js'), 'utf8');
p = p.replace(
  '  syncRun: (root, cfg) => ipcRenderer.invoke(\'sync-run\', { root, cfg }),',
  `  syncRun: (root, cfg) => ipcRenderer.invoke('sync-run', { root, cfg }),
  addRecycle: (o) => ipcRenderer.invoke('add-recycle', o),`
);
fs.writeFileSync(path.join(appDir, 'preload.js'), p);
console.log('preload.js 已加回收 API');

// 4. main.js
let m = fs.readFileSync(path.join(appDir, 'main.js'), 'utf8');
m = m.replace(
  "ipcMain.handle('sync-save'",
  `ipcMain.handle('add-recycle', (e, o) => {
  if (!o.root) return { log: ['错误: 未选择引擎根目录'] };
  const r = lib.addRecycleNpc(o.root, o);
  if (!r.ok) return { log: [r.msg] };
  return { log: ['=== 回收 NPC 生成完成 ===', 'NPC: ' + r.npc + '（' + (o.items || []).length + ' 个回收物品）',
    'MerChant.txt: ' + r.merchant + (r.updated ? '（已更新）' : '（已追加）'),
    '脚本: ' + r.scriptFile + '（' + r.scriptLines + ' 行）',
    '提示: 重启引擎或 @reloadnpc 重新加载所有NPC生效'] };
});

ipcMain.handle('sync-save'`
);
fs.writeFileSync(path.join(appDir, 'main.js'), m);
console.log('main.js 已加回收 IPC');
