// GUI：刷怪配置面板加"原刷怪调整"+"动态刷怪配置"两个卡片
const fs = require('fs');
const path = require('path');
const appDir = __dirname;

// 1. index.html：在刷怪配置面板（panel-mongen）末尾追加两个卡片
let h = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
h = h.replace(
  '    </div>\n  </div>\n\n  <!-- ⑦ 版本货币消耗分析 -->',
  `    </div>
    <div class="card" style="margin-top:16px;">
      <h4>原刷怪调整（MonGen.txt 批量修改）</h4>
      <div class="row">
        <label>修改类型</label>
        <div class="seg" id="mg-type-seg">
          <button data-mgt="all" class="active">全服调整</button>
          <button data-mgt="map">按地图</button>
          <button data-mgt="mongen">按怪物</button>
        </div>
        <input type="text" id="mg-name" placeholder="地图代码/怪物名" style="display:none;width:120px;">
      </div>
      <div class="row">
        <label>刷新数量</label>
        <input type="number" id="mg-count" value="1" step="0.1" style="width:90px;">
        <span class="hint">倍（原100只×2=200只）</span>
        <label style="min-width:auto;">刷新时间</label>
        <input type="number" id="mg-time" value="1" step="0.1" style="width:90px;">
        <span class="hint">倍（原60分×0.5=30分）</span>
      </div>
      <div class="row">
        <label>排除刷新时间</label>
        <select id="mg-exd-op" style="width:80px;"><option value=">=">≥</option><option value="<=">≤</option></select>
        <input type="number" id="mg-exd" placeholder="分钟" style="width:80px;">
        <label style="min-width:auto;">排除刷新数量</label>
        <select id="mg-exm-op" style="width:80px;"><option value=">=">≥</option><option value="<=">≤</option></select>
        <input type="number" id="mg-exm" placeholder="只" style="width:80px;">
        <button class="btn-primary" id="mg-adjust" style="margin-left:12px;">执行调整</button>
      </div>
    </div>
    <div class="card" style="margin-top:16px;">
      <h4>动态刷怪配置（有人有怪，无人清怪，性能节约、稳定不卡）</h4>
      <div class="row">
        <label>触发百分比</label><input type="number" id="dy-pro" value="50" style="width:80px;"><span class="hint">% 怪低于此值触发刷怪</span>
        <label style="min-width:auto;">触发人数</label><input type="number" id="dy-count" value="2" style="width:70px;"><span class="hint">人</span>
        <label style="min-width:auto;">刷怪百分比</label><input type="number" id="dy-moncount" value="50" style="width:80px;"><span class="hint">%</span>
      </div>
      <div class="row">
        <label>刷怪间隔</label><input type="number" id="dy-intervaled" value="60" style="width:80px;"><span class="hint">秒</span>
        <label style="min-width:auto;">清怪间隔</label><input type="number" id="dy-interval" value="120" style="width:80px;"><span class="hint">秒</span>
        <label style="min-width:auto;">排除地图</label><input type="text" id="dy-exmap" placeholder="逗号分隔" style="width:150px;">
        <label style="min-width:auto;">排除怪物</label><input type="text" id="dy-exmon" placeholder="逗号分隔" style="width:150px;">
      </div>
      <div class="row">
        <label>排除刷新时间</label>
        <input type="number" id="dy-starttime" placeholder="≥分钟" style="width:80px;">
        <input type="number" id="dy-endtime" placeholder="≤分钟" style="width:80px;">
        <button class="btn-warn" id="dy-run" style="margin-left:12px;">生成动态刷怪</button>
        <span class="hint">会修改 MonGen.txt 并写入 Robot_def，建议先备份</span>
      </div>
    </div>
  </div>

  <!-- ⑦ 版本货币消耗分析 -->`
);
fs.writeFileSync(path.join(appDir, 'index.html'), h);
console.log('index.html 已加刷怪调整/动态刷怪卡片');

// 2. renderer.js
let r = fs.readFileSync(path.join(appDir, 'renderer.js'), 'utf8');
r += `
// ===== 原刷怪调整 + 动态刷怪 =====
let mgType = 'all';
wireSeg('mg-type-seg', d => {
  mgType = d.mgt;
  $('mg-name').style.display = mgType === 'all' ? 'none' : 'block';
});
$('mg-adjust').onclick = async () => {
  const root = $('root').value.trim();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const o = {
    root, type: mgType, name: $('mg-name').value.trim(),
    monCount: $('mg-count').value, monDate: $('mg-time').value,
    expressionDate: $('mg-exd-op').value, excludeDateCount: $('mg-exd').value || null,
    expressionMon: $('mg-exm-op').value, excludeMonCount: $('mg-exm').value || null
  };
  const r = await window.api.mgAdjust(o);
  out('m-out', r.log.join('\\n'));
};
$('dy-run').onclick = async () => {
  const root = $('root').value.trim();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const o = {
    root, pro: $('dy-pro').value, count: $('dy-count').value, monCount: $('dy-moncount').value,
    intervaled: $('dy-intervaled').value, interval: $('dy-interval').value,
    excludeMaps: $('dy-exmap').value.split(',').map(x => x.trim()).filter(Boolean),
    excludeMons: $('dy-exmon').value.split(',').map(x => x.trim()).filter(Boolean),
    startTime: $('dy-starttime').value || null, endTime: $('dy-endtime').value || null
  };
  const r = await window.api.dynamicSpawn(o);
  out('m-out', r.log.join('\\n'));
};
`;
fs.writeFileSync(path.join(appDir, 'renderer.js'), r);
console.log('renderer.js 已加刷怪调整/动态逻辑');

// 3. preload.js
let p = fs.readFileSync(path.join(appDir, 'preload.js'), 'utf8');
p = p.replace(
  '  genSales: (o) => ipcRenderer.invoke(\'gen-sales\', o),',
  `  genSales: (o) => ipcRenderer.invoke('gen-sales', o),
  mgAdjust: (o) => ipcRenderer.invoke('mg-adjust', o),
  dynamicSpawn: (o) => ipcRenderer.invoke('dynamic-spawn', o),`
);
fs.writeFileSync(path.join(appDir, 'preload.js'), p);
console.log('preload.js 已加刷怪调整 API');

// 4. main.js
let m = fs.readFileSync(path.join(appDir, 'main.js'), 'utf8');
m = m.replace(
  "ipcMain.handle('gen-sales'",
  `ipcMain.handle('mg-adjust', (e, o) => {
  if (!o.root) return { log: ['错误: 未选择引擎根目录'] };
  const r = lib.adjustMonGen(o.root, o);
  if (!r.ok) return { log: [r.msg] };
  return { log: ['=== 原刷怪调整完成 ===', '刷新数量调整 ' + r.changedCount + ' 行 / 刷新时间调整 ' + r.changedDate + ' 行', '文件: ' + r.file] };
});

ipcMain.handle('dynamic-spawn', (e, o) => {
  if (!o.root) return { log: ['错误: 未选择引擎根目录'] };
  const r = lib.genDynamicSpawn(o.root, o);
  if (!r.ok) return { log: [r.msg] };
  return { log: ['=== 动态刷怪配置生成 ===', '地图 ' + r.maps + ' 个 / MonGen 修改 ' + r.modified + ' 行',
    'MonGen: ' + r.monGenFile, 'AutoRunRobot: ' + r.autoFile, 'RobotManage: ' + r.manageFile,
    '提示: 动态刷怪数据已经处理成功，请重启M2生效'] };
});

ipcMain.handle('gen-sales'`
);
fs.writeFileSync(path.join(appDir, 'main.js'), m);
console.log('main.js 已加刷怪调整 IPC');
