// 更新 GUI：加「按地图查看」「物品产出查询」两个 tab
const fs = require('fs');

// ---- index.html ----
let h = fs.readFileSync('index.html', 'utf8');
// tabs 加两个
h = h.replace(
  '    <button data-tab="random">随机爆率转换</button>\n  </div>',
  '    <button data-tab="random">随机爆率转换</button>\n    <button data-tab="mapview">按地图查看</button>\n    <button data-tab="itemfind">物品产出查询</button>\n  </div>'
);
// 随机转换 panel 后加两个 panel
h = h.replace(
  '  <!-- ③ 随机转换 -->',
  '  <!-- ④ 按地图查看 -->\n  <div class="panel" id="panel-mapview">\n    <div class="card">\n      <div class="row">\n        <label>地图代码</label>\n        <input type="text" id="mv-map" placeholder="MonGen.txt 地图代码，如 shuai209 / Q004 / 3">\n        <button class="btn-primary" id="btn-mapview">查询地图刷怪</button>\n      </div>\n      <div class="hint">从 MonGen.txt 查该地图刷哪些怪，并显示每个怪的爆率概况（动态刷怪脚本的怪无法获取）。</div>\n    </div>\n  </div>\n\n  <!-- ⑤ 物品产出查询 -->\n  <div class="panel" id="panel-itemfind">\n    <div class="card">\n      <div class="row">\n        <label>物品名</label>\n        <input type="text" id="if-item" placeholder="如 金币 / 裁决之杖">\n        <button class="btn-primary" id="btn-itemfind">全服查询产出</button>\n      </div>\n      <div class="hint">扫描全部爆率文件，找出哪些怪掉该物品及其爆率。</div>\n    </div>\n  </div>\n\n  <!-- ③ 随机转换 -->'
);
fs.writeFileSync('index.html', h);
console.log('index.html 已更新');

// ---- renderer.js ----
let r = fs.readFileSync('renderer.js', 'utf8');
r += `
// --- ④ 按地图查看 ---
$('btn-mapview').onclick = async () => {
  const root = $('root').value.trim();
  const mapCode = $('mv-map').value.trim();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  if (!mapCode) return appendLog('请填写地图代码', 'err');
  appendLog('—— 查询地图 ' + mapCode + ' ——', 'head');
  const res = await window.api.mapView({ root, mapCode });
  for (const l of res.log) {
    if (l.startsWith('✓')) appendLog(l, 'ok');
    else if (l.startsWith('✗')) appendLog(l, 'err');
    else if (l.startsWith('——')) appendLog(l, 'head');
    else appendLog(l);
  }
};

// --- ⑤ 物品产出查询 ---
$('btn-itemfind').onclick = async () => {
  const root = $('root').value.trim();
  const item = $('if-item').value.trim();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  if (!item) return appendLog('请填写物品名', 'err');
  appendLog('—— 查询物品「' + item + '」产出 ——', 'head');
  const res = await window.api.itemFind({ root, item });
  for (const l of res.log) {
    if (l.startsWith('✓')) appendLog(l, 'ok');
    else if (l.startsWith('✗')) appendLog(l, 'err');
    else if (l.startsWith('——')) appendLog(l, 'head');
    else appendLog(l);
  }
};
`;
fs.writeFileSync('renderer.js', r);
console.log('renderer.js 已更新');

// ---- preload.js ----
let p = fs.readFileSync('preload.js', 'utf8');
p = p.replace(
  '  doRandom: (args) => ipcRenderer.invoke(\'do-random\', args),',
  '  doRandom: (args) => ipcRenderer.invoke(\'do-random\', args),\n  mapView: (args) => ipcRenderer.invoke(\'map-view\', args),\n  itemFind: (args) => ipcRenderer.invoke(\'item-find\', args),'
);
fs.writeFileSync('preload.js', p);
console.log('preload.js 已更新');
