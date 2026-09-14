const fs = require('fs');
let idx = fs.readFileSync('rate-gui/app/index.html', 'utf8');
let n = 0;
// 1. 删侧边栏 itemfind 按钮
const s1 = '<button data-nav="itemfind"><span class="ic">🔍</span>物品产出查询</button>';
if (idx.includes(s1)) { idx = idx.replace(s1, ''); n++; console.log('① 侧边栏按钮删'); }
// 2. panel-mapview 加第二 card（物品产出查询——原 itemfind 内容）
const s2 = '      <div class="hint">从 MonGen.txt 查该地图刷哪些怪，并显示每个怪的爆率概况（动态刷怪脚本的怪无法获取）。</div>\n    </div>\n  </div>';
const n2 = '      <div class="hint">从 MonGen.txt 查该地图刷哪些怪，并显示每个怪的爆率概况（动态刷怪脚本的怪无法获取）。</div>\n    </div>\n    <div class="card" style="margin-top:10px;">\n      <div class="row">\n        <label>物品产出查询</label>\n        <input type="text" id="if-item" placeholder="如 金币 / 裁决之杖" style="min-width:220px;">\n        <button class="btn-primary" id="btn-itemfind">全服查询产出</button>\n      </div>\n      <div class="hint">扫描全部爆率文件，找出哪些怪掉该物品及其爆率。</div>\n    </div>\n  </div>';
if (idx.includes(s2)) { idx = idx.replace(s2, n2); n++; console.log('② mapview 加物品产出 card'); }
// 3. 删 panel-itemfind 整块
const s3 = '  <!-- ⑤ 物品产出查询 -->\n  <div class="panel" id="panel-itemfind">\n    <div class="card">\n      <div class="row">\n        <label>物品名</label>\n        <input type="text" id="if-item" placeholder="如 金币 / 裁决之杖">\n        <button class="btn-primary" id="btn-itemfind">全服查询产出</button>\n      </div>\n      <div class="hint">扫描全部爆率文件，找出哪些怪掉该物品及其爆率。</div>\n    </div>\n  </div>\n';
if (idx.includes(s3)) { idx = idx.replace(s3, ''); n++; console.log('③ panel-itemfind 删'); }
fs.writeFileSync('rate-gui/app/index.html', idx);
console.log('index 完成 ' + n + ' 处');
console.log('检查: itemfind 按钮残留:', idx.includes('data-nav="itemfind"'), '| panel-itemfind 残留:', idx.includes('panel-itemfind'), '| if-item 在 mapview:', idx.indexOf('panel-mapview') < idx.indexOf('if-item'));
