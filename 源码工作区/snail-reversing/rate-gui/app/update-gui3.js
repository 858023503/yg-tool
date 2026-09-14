// 更新 GUI：① 爆率调整加"按物品(加在物品后)" + "#CHILD 区间"
const fs = require('fs');

// ---- index.html ----
let h = fs.readFileSync('index.html', 'utf8');
// 范围加"按物品"
h = h.replace(
  '          <button data-scope="map">按地图</button>',
  '          <button data-scope="map">按地图</button>\n          <button data-scope="goods">按物品(加在物品后)</button>'
);
// 地图行后加"按物品"行
h = h.replace(
  '      <div class="row" id="row-map" style="display:none;">\n        <label>地图代码</label>\n        <input type="text" id="map" placeholder="MonGen.txt 地图代码，如 shuai209 / Q004">\n        <span class="hint">从 MonGen.txt 查该地图刷的怪</span>\n      </div>',
  '      <div class="row" id="row-map" style="display:none;">\n        <label>地图代码</label>\n        <input type="text" id="map" placeholder="MonGen.txt 地图代码，如 shuai209 / Q004">\n        <span class="hint">从 MonGen.txt 查该地图刷的怪</span>\n      </div>\n      <div class="row" id="row-gitem" style="display:none;">\n        <label>目标物品</label>\n        <input type="text" id="gitem" placeholder="加在哪个物品后（全服查找）">\n        <label style="min-width:auto;">追加物品</label>\n        <input type="text" id="gnew" placeholder="追加什么物品">\n      </div>'
);
// 爆率类型加"#CHILD 区间"
h = h.replace(
  '          <button data-cat="child">随机爆率 #CHILD 1/N</button>',
  '          <button data-cat="child">随机 #CHILD 1/N</button>\n          <button data-cat="range">#CHILD 区间</button>'
);
// 爆率行后加区间行
h = h.replace(
  '      <div class="row">\n        <button class="btn-primary" id="btn-run" style="margin-left:102px;">执行修改</button>\n      </div>',
  '      <div class="row" id="row-range" style="display:none;">\n        <label>随机区间</label>\n        <input type="number" id="range-start" placeholder="开始(如10)">\n        <label style="min-width:auto;">~</label>\n        <input type="number" id="range-end" placeholder="结束(如100)">\n        <span class="hint">N 在区间内随机，生成 #CHILD 1/N</span>\n      </div>\n      <div class="row">\n        <button class="btn-primary" id="btn-run" style="margin-left:102px;">执行修改</button>\n      </div>'
);
fs.writeFileSync('index.html', h);
console.log('index.html 已更新');

// ---- renderer.js ----
let r = fs.readFileSync('renderer.js', 'utf8');
// scope 切换加 goods
r = r.replace(
  "wireSeg('scope-seg', d => { scope = d.scope; $('row-mon').style.display = scope === 'mon' ? 'flex' : 'none'; $('row-map').style.display = scope === 'map' ? 'flex' : 'none'; });",
  "wireSeg('scope-seg', d => { scope = d.scope; $('row-mon').style.display = scope === 'mon' ? 'flex' : 'none'; $('row-map').style.display = scope === 'map' ? 'flex' : 'none'; $('row-gitem').style.display = scope === 'goods' ? 'flex' : 'none'; });"
);
// cat 切换加 range
r = r.replace(
  "wireSeg('cat-seg', d => { cat = d.cat; });",
  "wireSeg('cat-seg', d => { cat = d.cat; $('row-range').style.display = cat === 'range' ? 'flex' : 'none'; });"
);
// 执行参数传 goods/range
r = r.replace(
  "const r = await window.api.doOp({ root, scope, mon, mapCode: $('map').value.trim(), op, item, rate, count, cat });",
  "const r = await window.api.doOp({ root, scope, mon, mapCode: $('map').value.trim(), gitem: $('gitem').value.trim(), gnew: $('gnew').value.trim(), rs: parseInt($('range-start').value, 10), re: parseInt($('range-end').value, 10), op, item, rate, count, cat });"
);
fs.writeFileSync('renderer.js', r);
console.log('renderer.js 已更新');
