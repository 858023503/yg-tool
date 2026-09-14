// GUI 加 MonGen（刷怪配置）面板
const fs = require('fs');
const path = require('path');
const appDir = __dirname;

// ---- index.html ----
let h = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
// tab 加 MonGen
h = h.replace(
  '<button data-tab="random" id="tab-random">随机转换</button>',
  '<button data-tab="random" id="tab-random">随机转换</button>\n      <button data-tab="mongen" id="tab-mongen">刷怪配置</button>'
);
// panel 加 MonGen（在随机转换 panel 后）
h = h.replace(
  '    </div>\n  </div>\n</body>',
  `    </div>
    <!-- ===== 刷怪配置（MonGen.txt） ===== -->
    <div class="panel" id="panel-mongen" style="display:none;">
      <h3>刷怪配置（MonGen.txt）</h3>
      <div class="row">
        <label>引擎根目录</label>
        <input type="text" id="m-root" placeholder="例如 D:\\Mirserver怀念毕业端">
        <button id="m-browse">选择</button>
      </div>
      <div class="row">
        <label>地图代码</label>
        <input type="text" id="m-map" placeholder="留空=全部，如 shuai209 / Q004">
        <button class="btn-primary" id="m-list">查看刷怪</button>
      </div>
      <div class="box" id="m-out" style="white-space:pre;font-family:Consolas,monospace;font-size:12px;max-height:260px;overflow:auto;"></div>
      <hr>
      <h4>追加刷怪行</h4>
      <div class="row">
        <label>地图</label><input type="text" id="m-amap" placeholder="地图代码" style="width:90px;">
        <label style="min-width:auto;">X</label><input type="number" id="m-ax" style="width:60px;">
        <label style="min-width:auto;">Y</label><input type="number" id="m-ay" style="width:60px;">
        <label style="min-width:auto;">怪物</label><input type="text" id="m-amon" placeholder="怪物名">
      </div>
      <div class="row">
        <label>数量</label><input type="number" id="m-acount" value="1" style="width:60px;">
        <label style="min-width:auto;">范围</label><input type="number" id="m-arange" value="0" style="width:60px;">
        <label style="min-width:auto;">间隔(秒)</label><input type="number" id="m-ainterval" value="0" style="width:80px;">
        <label style="min-width:auto;">时间</label><input type="number" id="m-atime" value="0" style="width:60px;">
        <label style="min-width:auto;">触发</label><input type="number" id="m-atrigger" value="0" style="width:60px;">
        <button class="btn-primary" id="m-add">追加</button>
      </div>
      <hr>
      <h4>删除刷怪行</h4>
      <div class="row">
        <label>地图</label><input type="text" id="m-dmap" placeholder="地图代码" style="width:90px;">
        <label style="min-width:auto;">怪物</label><input type="text" id="m-dmon" placeholder="怪物名">
        <button class="btn-danger" id="m-del">删除</button>
      </div>
    </div>
  </div>
</body>`
);
fs.writeFileSync(path.join(appDir, 'index.html'), h);
console.log('index.html 已加 MonGen 面板');

// ---- renderer.js ----
let r = fs.readFileSync(path.join(appDir, 'renderer.js'), 'utf8');
// tab 切换加 mongen
r = r.replace(
  "['adjust', 'random']",
  "['adjust', 'random', 'mongen']"
);
// MonGen 事件
r += `
// ===== MonGen 面板 =====
$('m-browse').onclick = async () => {
  const d = await window.api.pickDir();
  if (d) $('m-root').value = d;
};
$('m-list').onclick = async () => {
  const root = $('m-root').value.trim();
  if (!root) return out('m-out', '请先选择引擎根目录');
  out('m-out', '查询中...');
  const r = await window.api.mongenList(root, $('m-map').value.trim());
  out('m-out', r.log.join('\\n'));
};
$('m-add').onclick = async () => {
  const p = {
    root: $('m-root').value.trim(),
    map: $('m-amap').value.trim(), x: $('m-ax').value.trim(), y: $('m-ay').value.trim(),
    mon: $('m-amon').value.trim(), count: $('m-acount').value.trim(),
    range: $('m-arange').value.trim(), interval: $('m-ainterval').value.trim(),
    time: $('m-atime').value.trim(), trigger: $('m-atrigger').value.trim()
  };
  if (!p.root || !p.map || !p.x || !p.y || !p.mon) return out('m-out', '请填写：引擎根目录、地图、X、Y、怪物名');
  const r = await window.api.mongenAdd(p);
  out('m-out', r.log.join('\\n'));
};
$('m-del').onclick = async () => {
  const root = $('m-root').value.trim(), map = $('m-dmap').value.trim(), mon = $('m-dmon').value.trim();
  if (!root || !map || !mon) return out('m-out', '请填写：引擎根目录、地图、怪物名');
  const r = await window.api.mongenDel(root, map, mon);
  out('m-out', r.log.join('\\n'));
};
`;
fs.writeFileSync(path.join(appDir, 'renderer.js'), r);
console.log('renderer.js 已加 MonGen 逻辑');

// ---- preload.js ----
let p = fs.readFileSync(path.join(appDir, 'preload.js'), 'utf8');
p = p.replace(
  'pickDir: () => ipcRenderer.invoke(\'pick-dir\'),',
  `pickDir: () => ipcRenderer.invoke('pick-dir'),
    mongenList: (root, map) => ipcRenderer.invoke('mongen-list', { root, map }),
    mongenAdd: (p) => ipcRenderer.invoke('mongen-add', p),
    mongenDel: (root, map, mon) => ipcRenderer.invoke('mongen-del', { root, map, mon }),`
);
fs.writeFileSync(path.join(appDir, 'preload.js'), p);
console.log('preload.js 已加 MonGen API');
