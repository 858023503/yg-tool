// 自定义确认模态框（替代 window.confirm：Electron confirm 弹窗后焦点/输入法不恢复会卡输入框，自绘模态无此问题）
function confirmDialog(message, title) {
  return new Promise((resolve) => {
    const mask = $('confirm-mask');
    if (!mask) { resolve(true); return; }
    $('confirm-msg').textContent = message || '';
    if (title) $('confirm-title').textContent = title;
    mask.style.display = 'flex';
    const done = (v) => { mask.style.display = 'none'; resolve(v); };
    $('confirm-ok').onclick = () => done(true);
    $('confirm-cancel').onclick = () => done(false);
  });
}
// 获取引擎根目录；为空时自动弹出选择目录（对齐原版"选择版本目录"）
async function ensureRoot() {
  const el = $('root');
  const v = el ? el.value.trim() : '';
  if (v) { saveRootHistory(v); return v; }
  try {
    const p = await window.api.selectDir();
    if (p) { el.value = p; appendLog('已选择引擎根目录: ' + p); saveRootHistory(p); return p; }
    appendLog('⚠ 未选择目录（弹窗已取消）');
    return null;
  } catch (e) {
    appendLog('❌ 选择目录出错: ' + e.message);
    return null;
  }
}
// 渲染层逻辑 — 3 大块功能
const $ = (id) => document.getElementById(id);
// HTML 转义（表格渲染用）
function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// 输出到结果框
function out(id, text) { appendLog(text); }

// 日志
function appendLog(line, cls) {
  const el = $('log');
  const div = document.createElement('div');
  if (cls) div.className = cls;
  div.textContent = line;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}
const qkLog = (msg, cls) => appendLog(msg, cls);

// ===== 整体爆率优化（还原自虾米） =====
const ooOpts = () => {
  const method = $('oo-method').value;
  const target = $('oo-target').value.trim();
  const o = { method, autoBackup: true };
  if (method === 'monster') o.monsters = target.split(/[,，]/).map(x => x.trim()).filter(Boolean);
  else if (method === 'map') o.maps = target.split(/[,，]/).map(x => x.trim()).filter(Boolean);
  else if (method === 'item') o.items = target.split(/[,，]/).map(x => x.trim()).filter(Boolean);
  const ro = $('oo-range-op').value;
  const rv = $('oo-range-val').value;
  if (ro && rv !== '') { o.rangeOp = ro; o.rangeValue = +rv; }
  o.op = $('oo-op').value;
  o.opValue = +($('oo-op-val').value || '1');
  return o;
};
$('oo-run').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const o = ooOpts();
  appendLog('[整体优化] 目标=' + o.method + ' 范围=' + (o.rangeOp || '-') + (o.rangeValue != null ? o.rangeValue : '') + ' 运算=' + o.op + o.opValue);
  const res = await window.api.overallOptimize(root, o);
  appendLog(res.ok ? '✅ ' + res.msg : '❌ ' + res.msg, res.ok ? 'ok' : 'err');
  refreshBackupList(root);
};
$('oo-backup').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const res = await window.api.backupMonItems(root, '手动');
  appendLog(res.ok ? '✅ ' + res.msg : '❌ ' + res.msg, res.ok ? 'ok' : 'err');
  refreshBackupList(root);
};
const refreshBackupList = async (root) => {
  const b = await window.api.listBackups(root);
  const sel = $('oo-restore');
  sel.innerHTML = '<option value="">选择备份还原…</option>' + (b.list || []).map(x => '<option value="' + x + '">' + x + '</option>').join('');
};
$('oo-restore-btn').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const name = $('oo-restore').value;
  if (!name) return appendLog('请先选择要还原的备份', 'warn');
  const res = await window.api.restoreBackup(root, name);
  appendLog(res.ok ? '✅ ' + res.msg : '❌ ' + res.msg, res.ok ? 'ok' : 'err');
};
$('oo-backup').onclick && null;
// ===== 批量新增爆率（还原自虾米） =====
$('ar-run').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const o = { items: $('ar-items').value.split(/[,，]/).map(x => x.trim()).filter(Boolean), rate: +$('ar-rate').value || 1,
    method: $('ar-method').value, monsters: $('ar-monsters').value.split(/[,，]/).map(x => x.trim()).filter(Boolean) };
  if (!o.items.length) return appendLog('请填写物品名称', 'warn');
  const res = await window.api.addRates(root, o);
  appendLog(res.ok ? '✅ ' + res.msg : '❌ ' + res.msg, res.ok ? 'ok' : 'err');
};
// ===== #CALL 还原（还原自虾米） =====
const crRun = async (apply) => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const res = await window.api.restoreCall(root, { dryRun: !apply });
  appendLog((apply ? '✅ ' : '🔍 ') + res.msg, apply ? 'ok' : '');
  if (res.failList && res.failList.length) $('cr-result').textContent = '解析失败: ' + res.failList.join('；');
  else $('cr-result').textContent = res.msg;
};
$('cr-scan').onclick = () => crRun(false);
$('cr-apply').onclick = () => crRun(true);
// ===== P2：指定删除 / 普通分组 / 二级优化（还原自虾米） =====
$('dr-run').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const content = $('dr-content').value.trim();
  if (!content) return appendLog('请填写要删除的内容', 'warn');
  const res = await window.api.delRates(root, { content, method: $('dr-method').value });
  appendLog(res.ok ? '✅ ' + res.msg : '❌ ' + res.msg, res.ok ? 'ok' : 'err');
};
$('gr-run').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const res = await window.api.groupRates(root, { groupSize: +$('gr-size').value || 5 });
  appendLog(res.ok ? '✅ ' + res.msg : '❌ ' + res.msg, res.ok ? 'ok' : 'err');
};
$('op-run').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const res = await window.api.optimizeRates(root, {});
  appendLog(res.ok ? '✅ ' + res.msg : '❌ ' + res.msg, res.ok ? 'ok' : 'err');
};
// 导航切换（左侧侧边栏）
const pageTitles = { npctool: '快捷操作', adjust: '爆率调整', bulk: '批量调整', random: '随机转换', mapview: '按地图查看', mongen: '刷怪配置', currency: '货币消耗', search: '脚本搜索', exchange: '货币兑换', ports: '端口检测', inject: '脚本注入', m2reload: 'M2 重载', portcfg: '端口配置', itemcfg: '物品管理', mapcfg: '地图配置', engineck: '引擎健检', compare: '文件对比', health: '一键体检', site: '开区网站', robot: '机器人脚本', sync: '目录同步', recycle: '回收NPC', sales: '存销系统', login: '登录器配置' };
document.querySelectorAll('.sidebar nav button').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('.sidebar nav button').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    const t = b.dataset.nav;
    $('panel-' + t).classList.add('active');
    const pt = pageTitles[t];
    if (pt) $('page-title').textContent = pt;
  };
});

// 通用 seg 选择器
function wireSeg(segId, callback) {
  document.querySelectorAll('#' + segId + ' button').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('#' + segId + ' button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      callback(b.dataset);
    };
  });
}

// --- ① 爆率调整 ---
let scope = 'all', op = 'add', cat = 'normal';
wireSeg('scope-seg', d => { scope = d.scope; $('row-mon').style.display = scope === 'mon' ? 'flex' : 'none'; $('row-map').style.display = scope === 'map' ? 'flex' : 'none'; $('row-gitem').style.display = scope === 'goods' ? 'flex' : 'none'; });
wireSeg('op-seg', d => { op = d.op; });
wireSeg('cat-seg', d => { cat = d.cat; $('row-range').style.display = cat === 'range' ? 'flex' : 'none'; });

// --- ② 批量调整 ---
let bscope = 'all', btype = 'normal';
wireSeg('bulk-scope-seg', d => { bscope = d.bs; $('row-bmon').style.display = bscope === 'mon' ? 'flex' : 'none'; $('row-bmap').style.display = bscope === 'map' ? 'flex' : 'none'; });
wireSeg('bulk-type-seg', d => { btype = d.bt; });

// --- ③ 随机转换 ---
let rscope = 'all', rfilter = 'all';
wireSeg('rnd-scope-seg', d => { rscope = d.rs; $('row-rmon').style.display = rscope === 'mon' ? 'flex' : 'none'; $('row-rmap').style.display = rscope === 'map' ? 'flex' : 'none'; });
wireSeg('rnd-filter-seg', d => { rfilter = d.rf; });

// 引擎目录
function saveRootHistory(v) {
  v = (v || '').trim(); if (!v) return;
  let arr = JSON.parse(localStorage.getItem('yge-roots') || '[]');
  arr = arr.filter(x => x !== v); arr.unshift(v);
  if (arr.length > 20) arr = arr.slice(0, 20);
  localStorage.setItem('yge-roots', JSON.stringify(arr));
}
function renderRootHist() {
  const sel = $('root-hist'); if (!sel) return;
  const arr = JSON.parse(localStorage.getItem('yge-roots') || '[]');
  sel.innerHTML = '<option value="">历史版本…</option>' + arr.map(v => '<option value="' + String(v).replace(/"/g, '&quot;') + '">' + String(v).split(/[\\/]/).pop() + '</option>').join('');
}
$('root-hist').onchange = () => {
  const v = $('root-hist').value;
  if (v) { $('root').value = v; saveRootHistory(v); autoFillZone(v); appendLog('已选择引擎根目录: ' + v, 'ok'); }
};
$('btn-root-del').onclick = () => {
  const v = $('root-hist').value;
  if (!v) return appendLog('请先在历史下拉中选择要删除的项', 'warn');
  let arr = JSON.parse(localStorage.getItem('yge-roots') || '[]');
  arr = arr.filter(x => x !== v);
  localStorage.setItem('yge-roots', JSON.stringify(arr));

  renderRootHist();
  appendLog('已从历史删除: ' + v, 'warn');
};
$('btn-dir').onclick = async () => { const p = await window.api.selectDir(); if (p) { $('root').value = p; saveRootHistory(p); autoFillZone(p); } };
// 启动：引擎根目录输入框保持为空（不自动恢复上次），仅渲染历史下拉供手动选择
(function () { renderRootHist(); })();
$('btn-backup').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const r = await window.api.backup(root);
  appendLog(r.msg, r.ok ? 'ok' : 'err');
};

// ① 爆率调整执行
$('btn-run').onclick = async () => {
  const root = await ensureRoot();
  const mon = $('mon').value.trim();
  const item = $('item').value.trim();
  const rate = parseInt($('rate').value, 10) || 0;
  const count = parseInt($('count').value, 10) || 1;
  appendLog('—— 开始执行 ——', 'head');
  const r = await window.api.doOp({ root, scope, mon, mapCode: $('map').value.trim(), gitem: $('gitem').value.trim(), gnew: $('gnew').value.trim(), rs: parseInt($('range-start').value, 10), re: parseInt($('range-end').value, 10), op, item, rate, count, cat });
  r.log.forEach(l => {
    if (l.startsWith('✓')) appendLog(l, 'ok');
    else if (l.startsWith('✗') || l.includes('错误')) appendLog(l, 'err');
    else if (l.startsWith('——')) appendLog(l, 'head');
    else appendLog(l);
  });
};

// ② 批量调整执行
$('btn-bulk').onclick = async () => {
  const root = await ensureRoot();
  const mon = $('bmon').value.trim();
  const opt = {
    rate: parseFloat($('b-rate').value) || 1,
    minRate: $('b-min').value === '' ? null : parseFloat($('b-min').value),
    maxRate: $('b-max').value === '' ? null : parseFloat($('b-max').value),
    maxLimit: $('b-limit').value === '' ? null : parseFloat($('b-limit').value),
    type: btype,
  };
  appendLog('—— 开始批量调整 ——', 'head');
  const r = await window.api.doBulk({ root, scope: bscope, mon, mapCode: $('bmap').value.trim(), opt });
  r.log.forEach(l => {
    if (l.startsWith('✓')) appendLog(l, 'ok');
    else if (l.startsWith('✗') || l.includes('错误')) appendLog(l, 'err');
    else if (l.startsWith('——')) appendLog(l, 'head');
    else appendLog(l);
  });
};

// ③ 随机转换执行
$('btn-random').onclick = async () => {
  const root = await ensureRoot();
  const mon = $('rmon').value.trim();
  const rf = rfilter;
  const opt = { minRate: rf === 'ge100' ? 100 : null, maxRate: rf === 'le1000' ? 1000 : null };
  appendLog('—— 开始随机爆率转换 ——', 'head');
  const r = await window.api.doRandom({ root, scope: rscope, mon, mapCode: $('rmap').value.trim(), opt });
  r.log.forEach(l => {
    if (l.startsWith('✓')) appendLog(l, 'ok');
    else if (l.startsWith('✗') || l.includes('错误')) appendLog(l, 'err');
    else if (l.startsWith('——')) appendLog(l, 'head');
    else appendLog(l);
  });

};

// --- ④ 按地图查看 ---
$('btn-mapview').onclick = async () => {
  const root = await ensureRoot();
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
  const root = await ensureRoot();
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

// ===== MonGen 面板 =====
let mSnap = null; // MonGen 文件快照（还原自虾米文件监控）
$('m-list').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return out('m-out', '请先选择引擎根目录');
  out('m-out', '查询中...');
  mSnap = await window.api.mongenSnapshot(root);
  const r = await window.api.mongenList(root, $('m-map').value.trim());
  out('m-out', (r.log||[]).join('\n'));
};
const mCheck = async (root, action) => {
  if (!mSnap) { appendLog('请先点"查看刷怪"再执行' + action, 'err'); return false; }
  const chk = await window.api.mongenCheck(root, mSnap);
  if (chk.modified) { appendLog('⚠ ' + chk.msg + '（已取消' + action + '，请重新查看）', 'err'); return false; }
  return true;
};
$('m-add').onclick = async () => {
  const root0 = await ensureRoot();
  if (root0 && !(await mCheck(root0, '追加'))) return;
  const p = {
    root: $('root').value.trim(),
    map: $('m-amap').value.trim(), x: $('m-ax').value.trim(), y: $('m-ay').value.trim(),
    mon: $('m-amon').value.trim(), count: $('m-acount').value.trim(),
    range: $('m-arange').value.trim(), interval: $('m-ainterval').value.trim(),
    time: $('m-atime').value.trim(), trigger: $('m-atrigger').value.trim()
  };
  if (!p.root || !p.map || !p.x || !p.y || !p.mon) return out('m-out', '请填写：引擎根目录、地图、X、Y、怪物名');
  const r = await window.api.mongenAdd(p);
  out('m-out', (r.log||[]).join('\n'));
};
$('m-del').onclick = async () => {
  const root = await ensureRoot(); const map = $('m-dmap').value.trim(), mon = $('m-dmon').value.trim();
  if (!root || !map || !mon) return out('m-out', '请填写：引擎根目录、地图、怪物名');
  const r = await window.api.mongenDel(root, map, mon);
  out('m-out', (r.log||[]).join('\n'));
};

// ===== 货币消耗面板 =====
$('c-run').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return out('c-out', '请先选择引擎根目录');
  out('c-out', '正在分析版本消耗，请等待...');
  const r = await window.api.currencyReport(root, {
    dropQFunction: $('c-drop-qf').checked,
    dropQManage: $('c-drop-qm').checked
  });
  out('c-out', (r.log||[]).join('\n'));
};

// ===== 脚本搜索面板 =====
$('s-browse').onclick = async () => {
  const d = await window.api.pickDir();
  if (d) $('s-dir').value = d;
};
// 搜索预设（还原自快捷助手搜索0-30）
$('sr-preset').onchange = () => { const v = $('sr-preset').value; if (v) $('s-search').value = v; };
const sOpts = () => {
  const root = $('root') ? $('root').value.trim() : '';
  let dir = $('s-dir').value.trim();
  if (!dir && root) dir = root.replace(/[\\/]+$/, '') + '/Mir200/Envir';  // 默认用顶部已选引擎根目录的 Envir
  return {
    dir,
    search: $('s-search').value,
    replace: $('s-replace').value,
    isCase: $('s-case').checked,
    isChildren: $('s-child').checked,
    types: [$('s-type').value.trim() || '.txt'],
    matchMode: $('sr-mode') ? $('sr-mode').value : 'contains'
  };
};

$('s-run').onclick = async () => {
  const o = sOpts();
  if (!o.dir || !o.search) return out('s-out', '请填写搜索目录和搜索内容');
  out('s-out', '搜索中...');
  const r = await window.api.scriptSearch(o);
  out('s-out', (r.log||[]).join('\n'));
};
$('s-replace-btn').onclick = async () => {
  const o = sOpts();
  if (!o.dir || !o.search) return out('s-out', '请填写搜索目录和搜索内容');
  if (o.replace === '' && !(await confirmDialog('替换内容为空，确定继续替换？（等于删除匹配内容）'))) return;
  out('s-out', '替换中...');
  const r = await window.api.scriptReplace(o);
  out('s-out', (r.log||[]).join('\n'));
};

// ===== 端口检测面板 =====


// ===== 脚本注入面板 =====
let iMode = 'append';
wireSeg('i-mode-seg', d => { iMode = d.im; });
$('i-target').onchange = () => {
  $('i-target-file').style.display = $('i-target').value === 'custom' ? 'block' : 'none';
};
// ===== 注入模板库（还原自虾米 _load_templates/_save_template/_new_template/_delete_template） =====
function ijLoadList() {
  try { return JSON.parse(localStorage.getItem('yge-inject-templates') || '[]'); } catch (e) { return []; }
}
function ijSaveList(list) {
  try { localStorage.setItem('yge-inject-templates', JSON.stringify(list)); return true; } catch (e) { return false; }
}

function ijRefresh() {
  const list = ijLoadList();
  const sel = $('ij-tpl');
  sel.innerHTML = '<option value="">-- 无模板 --</option>' + list.map((t, i) => '<option value="' + i + '">' + esc(t.name) + '</option>').join('');
  $('ij-st').textContent = list.length ? '共 ' + list.length + ' 个模板' : '模板 = 名称/目标/模式/变量替换/内容';
}
function ijCurrentForm() {
  return {
    name: $('i-name').value.trim(),
    target: $('i-target').value === 'custom' ? $('i-target-file').value.trim() : $('i-target').value,
    mode: iMode,
    vars: !!$('i-vars').checked,
    content: $('i-content').value
  };
}
function ijApplyForm(t) {
  if (!t) return;
  $('i-name').value = t.name || '';
  if (t.target && ['QF', 'QM', 'custom'].includes(t.target)) {
    $('i-target').value = t.target;
    $('i-target-file').style.display = t.target === 'custom' ? 'block' : 'none';
    if (t.target === 'custom') $('i-target-file').value = t.customPath || '';
  }
  if (t.mode) {
    iMode = t.mode;
    document.querySelectorAll('#i-mode-seg button').forEach(b => b.classList.toggle('active', b.dataset.im === t.mode));
  }
  if (t.vars != null) $('i-vars').checked = t.vars;
  if (t.content != null) $('i-content').value = t.content;
}
$('ij-save').onclick = () => {
  const f = ijCurrentForm();
  if (!f.name) return appendLog('⚠ 请先填写注入名称再存为模板', 'err');
  const list = ijLoadList();
  const i = list.findIndex(t => t.name === f.name);
  if (i >= 0) list[i] = f; else list.push(f);
  if (ijSaveList(list)) { ijRefresh(); appendLog('💾 模板已保存：' + f.name + '（共 ' + list.length + ' 个）'); }
  else appendLog('❌ 模板保存失败', 'err');
};
$('ij-load').onclick = () => {
  const i = parseInt($('ij-tpl').value, 10);
  if (isNaN(i)) return appendLog('⚠ 请先选择模板', 'err');
  const list = ijLoadList();
  if (!list[i]) return appendLog('⚠ 模板不存在', 'err');
  ijApplyForm(list[i]);
  appendLog('📂 已载入模板：' + list[i].name);
};
$('ij-del').onclick = () => {
  const i = parseInt($('ij-tpl').value, 10);
  if (isNaN(i)) return appendLog('⚠ 请先选择模板', 'err');
  const list = ijLoadList();
  const name = list[i] ? list[i].name : '';
  list.splice(i, 1);
  if (ijSaveList(list)) { ijRefresh(); appendLog('🗑 已删除模板：' + name); }
};
ijRefresh();

$('i-run').onclick = async () => {
  const root = await ensureRoot();
  const name = $('i-name').value.trim();
  const target = $('i-target').value === 'custom' ? $('i-target-file').value.trim() : $('i-target').value;
  const content = $('i-content').value;
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  if (!name) return appendLog('请填写注入名称', 'err');
  if (!target) return appendLog('请选择注入目标', 'err');
  if (!content.trim()) return appendLog('注入内容为空', 'err');

  const r = await window.api.doInject({ root, name, target, content, mode: iMode, varReplace: $('i-vars').checked });
  appendLog(r.log ? (r.log||[]).join('\n') : (r.msg || ''), r.ok ? 'ok' : 'err');

};



// ===== 文件对比 =====
$('cm-ba').onclick = async () => { const d = await window.api.pickDir(); if (d) $('cm-a').value = d; };
$('cm-bb').onclick = async () => { const d = await window.api.pickDir(); if (d) $('cm-b').value = d; };
$('cm-run').onclick = async () => {
  const a = $('cm-a').value.trim(), b = $('cm-b').value.trim();
  if (!a || !b) return appendLog('请填写两个目录', 'err');
  appendLog('正在对比: ' + a + '  vs  ' + b);
  const r = await window.api.compareDirs(a, b);
  const lines = ['=== 目录对比 ===', 'A(' + r.aTotal + ') vs B(' + r.bTotal + ') | 仅A ' + r.summary.onlyA + ' / 仅B ' + r.summary.onlyB + ' / 相同 ' + r.summary.same + ' / 不同 ' + r.summary.diff];
  if (r.onlyA.length) { lines.push('仅A（前10）:'); r.onlyA.slice(0, 10).forEach(x => lines.push('  + ' + x)); }
  if (r.onlyB.length) { lines.push('仅B（前10）:'); r.onlyB.slice(0, 10).forEach(x => lines.push('  + ' + x)); }
  if (r.diff.length) {
    lines.push('差异文件（前10）:');
    for (const d of r.diff.slice(0, 10)) {
      lines.push('  ~ ' + d.rel + ' (' + d.aSize + '→' + d.bSize + 'B)');
      for (const l of d.lines.slice(0, 2)) lines.push('      L' + l.n + ' A: ' + l.a.slice(0, 50) + ' | B: ' + l.b.slice(0, 50));
    }
  }
  appendLog(lines.join('\n'));
};

// ===== 一键体检 =====
$('ht-run').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  appendLog('正在体检...');
  const r = await window.api.healthCheck(root);
  const lines = ['=== 一键服务端体检：' + r.score + '%（' + r.okCount + '/' + r.total + '）==='];
  for (const c of r.checks) lines.push((c.ok ? '✓' : '✗') + ' [' + c.cat + '] ' + c.name + ': ' + c.detail);
  if (r.issues.length) { lines.push('发现 ' + r.issues.length + ' 个问题:'); for (const i of r.issues) lines.push('  ❌ ' + i); }
  else lines.push('✅ 未发现问题');
  $('ht-result').textContent = lines.join('\n');
  appendLog(lines.join('\n'));
};

// ===== 开区网站 =====
let __lastSiteDir = '';
const siteOpts = () => ({ title: $('st-title').value.trim(), skin: $('st-skin').value, newZones: $('st-new').value.trim(), fastZones: $('st-fast').value.trim(), soloZones: $('st-solo').value.trim(),
  desc: $('st-desc').value.trim(), downloadUrl: $('st-dl').value.trim(), qqGroups: $('st-qq').value.trim(), versions: $('st-versions').value.trim(), announce: $('st-announce').value.trim(),
  maint: $('st-maint').checked, maintMsg: $('st-maintmsg').value.trim(), admin: $('st-admin').checked });
$('st-run').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const o = siteOpts();
  const r = await window.api.genSite(root, o);
  if (r.ok && r.dir) __lastSiteDir = r.dir;
  appendLog(r.ok ? '✅ ' + r.msg + '\n目录: ' + r.dir + '\n爆率: ' + r.monsterCount + ' 只怪 / ' + r.itemCount + ' 种物品\n点「👁 预览站点」在浏览器打开' : '❌ ' + r.msg, r.ok ? 'ok' : 'err');
};

// 发布：从后台导出的配置文件重新生成
const applyCfg = async () => {
  const root = $('root').value.trim();
  if (!root) return appendLog('未选择引擎根目录', 'err');
  const cfgPath = await window.api.openConfigFile();
  if (!cfgPath) return appendLog('已取消选择配置文件', 'warn');
  appendLog('[发布] 配置: ' + cfgPath);
  const res = await window.api.genSite(root, Object.assign({}, siteOpts(), { applyConfig: cfgPath }));
  if (res.ok && res.dir) __lastSiteDir = res.dir;
  appendLog(res.ok ? '✅ ' + res.msg : '❌ ' + res.msg, res.ok ? 'ok' : 'err');
};
$('st-apply').onclick = applyCfg;
$('st-preview').onclick = async () => {
  if (!__lastSiteDir) return appendLog('请先生成网站再预览', 'warn');
  const res = await window.api.previewSite(__lastSiteDir);
  appendLog(res.ok ? '✅ 预览: ' + res.url + '（浏览器已打开，关闭前请勿删除站点目录）' : '❌ ' + res.msg, res.ok ? 'ok' : 'err');
};
// ===== 远端同步（移植自虾米 1.3.6）=====
$('sr-listen').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const r = await window.api.remoteListen(root, { port: parseInt($('sr-local-port').value, 10) || 8000, token: $('sr-local-token').value.trim() });
  $('sr-status').textContent = r.ok ? '监听 ' + r.port + '（http://本机IP:' + r.port + '/api/sync）' : r.msg;
  appendLog(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg, r.ok ? 'ok' : 'err');
};
$('sr-stop').onclick = async () => {
  const r = await window.api.remoteStop();
  $('sr-status').textContent = '';
  appendLog(r.msg);
};
$('sr-push').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const url = $('sr-peer-url').value.trim();
  if (!url) return appendLog('请填远端地址（对方工具箱的本机接口）', 'err');
  appendLog('正在推送爆率查询到远端...');
  const r = await window.api.remotePush(root, { url, token: $('sr-peer-token').value.trim() });
  appendLog(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg, r.ok ? 'ok' : 'err');
};

// ===== M2 重载面板 =====
$('mr-list').onclick = async () => {
  const r = await window.api.m2Reload({ action: 'list' });
  if (r.ok) appendLog('已找到 M2 重载菜单: ' + r.msg, 'ok');
  else appendLog(r.msg, 'err');
};
$('mr-run').onclick = async () => {
  const item = $('mr-item').value;
  const filter = $('mr-filter').value.trim();
  const root = $('root').value.trim();
  appendLog('正在向 M2 发送重载命令: ' + item + (filter ? '（过滤: ' + filter + '）' : ''));
  const r = await window.api.m2Reload({ action: 'reload', item, filter, root });
  appendLog(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg, r.ok ? 'ok' : 'err');
};


// ===== 端口配置面板 =====
$('pc-list').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const r = await window.api.portConfig(root, 'list');
  const lines = ['=== 服务端端口配置（共 ' + r.count + ' 个）==='];
  for (const f of r.files) {
    lines.push('[' + f.label + '] ' + f.file);
    for (const e of f.entries) lines.push('  ' + e.key + ' = ' + e.port);
  }
  appendLog(lines.join('\n'));
};
$('pc-check').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  appendLog('正在检测端口占用...');
  const r = await window.api.checkPorts(root);
  const lines = ['=== 端口占用检测（占用 ' + r.inUseCount + '/' + r.total + '）==='];
  for (const x of r.results) {
    const labels = x.keys.map(k => k.label + '/' + k.key).join(', ');
    lines.push((x.inUse ? '■ 占用' : '□ 空闲') + '\t' + x.port + '\t' + labels);
  }
  appendLog(lines.join('\n'));
};
$('pc-write').onclick = async () => {
  const root = await ensureRoot();
  const file = $('pc-file').value.trim(), key = $('pc-key').value.trim(), port = $('pc-port').value.trim();
  if (!root || !file || !key || !port) return appendLog('请填完整（文件/键/端口）', 'err');
  if (!(await confirmDialog('⚠️ 端口写操作保护（事故教训 2026-08-08：误改活动组断服）\n\n将修改 ' + file + ' 的 ' + key + ' = ' + port + '\n\n带数字后缀的键（GatePort1/ServerPort1/...）由 Count=N 决定是否活动组，主/备组同值是模板常态，误改会导致客户端连不上服务器！\n\n确认要改吗？（改前会自动备份到 port-backup\\时间戳\\）'))) return appendLog('已取消（端口写保护）', 'err');
  const r = await window.api.portConfig(root, 'write', { file, key, port });
  appendLog(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg, r.ok ? 'ok' : 'err');
  if (r.ok) appendLog('⚠️ 改后需重启引擎生效，重启后建议用「端口占用检测」核对监听', 'warn');
};
$('pc-replace').onclick = async () => {
  const root = await ensureRoot();
  const from = $('pc-from').value.trim(), to = $('pc-to').value.trim();
  if (!root || !from || !to) return appendLog('请填新旧端口', 'err');
  const touching = [parseInt(from, 10), parseInt(to, 10)].filter(n => [7000, 7100, 7200].includes(n));
  if (!(await confirmDialog('⚠️ 端口写操作保护（事故教训 2026-08-08：误改活动组断服）\n\n本次将把端口 ' + from + ' 批量替换为 ' + to + '（全部配置文件）' + (touching.length ? '\n⚠️ 涉及关键网关端口: ' + touching.join(', ') + '（7000=LoginGate/7100=SelGate/7200=RunGate）' : '') + '\n\n带数字后缀的键由 Count=N 决定是否活动组，误改会导致客户端连不上服务器！\n\n确认继续？（改前会自动备份）'))) return appendLog('已取消（端口写保护）', 'err');
  const r = await window.api.portConfig(root, 'replace', { from, to });
  appendLog(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg, r.ok ? 'ok' : 'err');
  if (r.ok) appendLog('⚠️ 改后需重启引擎生效，重启后建议用「端口占用检测」核对监听', 'warn');
};

// ===== 物品管理面板 =====
let icMode = 'desc';
wireSeg('ic-mode-seg', d => { icMode = d.im; });
$('ic-list').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const r = await window.api.itemCfg(root, 'list', { mode: icMode });
  appendLog((r.log||[]).join('\n'));
};
$('ic-add').onclick = async () => {
  const root = await ensureRoot();
  const name = $('ic-name').value.trim(), color = $('ic-color').value.trim(), text = $('ic-text').value.trim();
  if (!root || !name) return appendLog('请填写名称', 'err');
  const r = await window.api.itemCfg(root, 'add', { mode: icMode, name, color, text });
  appendLog(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg, r.ok ? 'ok' : 'err');
};
$('ic-delbtn').onclick = async () => {
  const root = await ensureRoot();
  const name = $('ic-del').value.trim();
  if (!root || !name) return appendLog('请填写要删除的名称/ID', 'err');
  const r = await window.api.itemCfg(root, 'del', { mode: icMode, name });
  appendLog(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg, r.ok ? 'ok' : 'err');
};

// ===== 地图配置面板 =====
let mcMode = 'start';
wireSeg('mc-mode-seg', d => { mcMode = d.im; });
$('mc-list').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const r = await window.api.mapCfg(root, 'list', { mode: mcMode, filter: $('mc-del').value.trim() });
  appendLog((r.log||[]).join('\n'));
};
$('mc-add').onclick = async () => {
  const root = await ensureRoot();
  const a = $('mc-a').value.trim(), b = $('mc-b').value.trim(), c = $('mc-c').value.trim(), d = $('mc-d').value.trim(), e = $('mc-e').value.trim(), f = $('mc-f').value.trim();
  if (!root || !a || !b || !c) return appendLog('请填写地图/X/Y', 'err');
  const r = await window.api.mapCfg(root, 'add', { mode: mcMode, a, b, c, d, e, f });
  appendLog(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg, r.ok ? 'ok' : 'err');
};
$('mc-delbtn').onclick = async () => {
  const root = await ensureRoot();
  const name = $('mc-del').value.trim();
  if (!root || !name) return appendLog('请填写地图代码', 'err');
  const r = await window.api.mapCfg(root, 'del', { mode: mcMode, name });
  appendLog(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg, r.ok ? 'ok' : 'err');
};


// 存销区服名称自动探测填入（默认显示实际区名，如 翎风01；用户已填则不动）
async function autoFillZone(root) {
  try {
    const el = $('ss-zone');
    if (!el || el.value.trim()) return;
    const r = await window.api.serverZone(root);
    if (r && r.ok && r.zone) { el.value = r.zone; appendLog('已自动填入区服名称: ' + r.zone, 'ok'); }
  } catch (e) { /* 忽略 */ }
}

// ===== 端口一致性 + 预设（融合虾米/快捷助手） =====
$('pc-dup').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const r = await window.api.portConfig(root, 'dup');
  const lines = ['=== 端口一致性（' + r.total + ' 个端口，' + r.dups.length + ' 组重复）==='];
  for (const d of r.dups) lines.push('  ' + d.port + ' ← ' + d.keys.join(', '));
  if (!r.dups.length) lines.push('✅ 无重复端口');
  appendLog(lines.join('\n'));
};
$('pc-psave').onclick = async () => {
  const root = await ensureRoot();
  const name = $('pc-preset').value.trim();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  if (!name) return appendLog('请填写预设名称', 'err');
  const r = await window.api.portConfig(root, 'preset-save', { name });
  appendLog(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg, r.ok ? 'ok' : 'err');
};
$('pc-papply').onclick = async () => {
  const root = await ensureRoot();
  const name = $('pc-preset').value.trim();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  if (!name) return appendLog('请填写预设名称', 'err');
  const r = await window.api.portConfig(root, 'preset-apply', { name });
  appendLog(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg, r.ok ? 'ok' : 'err');
};
// ===== 物品扩展配置（融合快捷助手清单） =====
$('ic-filelist').onclick = async () => {
  const root = await ensureRoot();
  const file = $('ic-file').value;
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  if (!file) return appendLog('请选择配置文件', 'err');
  const r = await window.api.itemCfg(root, 'file', { mode: 'file', file });
  appendLog((r.log||[]).join('\n'));
};

// ===== 引擎健检面板 =====
$('ec-run').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  appendLog('正在检查引擎配置...');
  const r = await window.api.engineCheck(root);
  const lines = ['=== 引擎识别 + 服务端健检 ==='];
  for (const c of r.checks) lines.push((c.ok ? '✓' : '✗') + ' ' + c.name + ': ' + c.detail);
  if (r.issues.length) { lines.push('发现 ' + r.issues.length + ' 个问题:'); for (const i of r.issues) lines.push('  ❌ ' + i); }
  else lines.push('✅ 未发现问题');
  $('ec-result').textContent = lines.join('\n');
  appendLog(lines.join('\n'));
};
$('ec-fixdirs').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  appendLog('正在扫描目录键...');
  const s = await window.api.setupDirScan(root);
  const bad = (s.keys || []).filter(k => !k.exists);
  if (s.issues && s.issues.length) {
    $('ec-result').textContent = (s.log || []).join('\n');
    appendLog((s.log || []).join('\n'));
    if (!(await confirmDialog('发现 ' + bad.length + ' 个残留目录键（如 ChatDir/SortDir 指向旧路径），是否一键校正为当前引擎根？\n\n' + bad.map(k => '❌ ' + k.key + ' = ' + k.value + '\n   → ' + k.suggest).join('\n')))) return;
    const f = await window.api.setupDirFix(root);
    $('ec-result').textContent = (f.log || []).join('\n');
    appendLog((f.log || []).join('\n'));
  } else {
    $('ec-result').textContent = '✅ 全部目录键存在';
    appendLog('✅ 全部目录键存在');
  }
};

// ===== 机器人脚本面板 =====
let rbType = 'clear';
wireSeg('rb-type-seg', d => {
  rbType = d.rt;
  $('rb-row-clear').style.display = rbType === 'clear' ? 'flex' : 'none';
  $('rb-row-spawn').style.display = rbType === 'spawn' ? 'flex' : 'none';
});
$('rb-list').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const r = await window.api.robotList(root);

};
$('rb-add').onclick = async () => {
  const root = await ensureRoot();
  const name = $('rb-name').value.trim();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  if (!name) return appendLog('请填写机器人名称', 'err');
  const opts = {
    name, interval: parseInt($('rb-interval').value, 10) || 60,
    unit: $('rb-unit').value, type: rbType,
    maps: $('rb-maps').value.split(',').map(x => x.trim()).filter(Boolean),
    map: $('rb-map').value.trim(), mon: $('rb-mon').value.trim(),
    count: parseInt($('rb-count').value, 10) || 1
  };
  const r = await window.api.robotAdd(root, opts);

};
$('rb-del').onclick = async () => {
  const root = await ensureRoot();
  const name = $('rb-dname').value.trim();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  if (!name) return appendLog('请填写机器人名称', 'err');
  const r = await window.api.robotDel(root, name);
  appendLog(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg, r.ok ? 'ok' : 'err');
};

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
  out('sy-out', (r.log||[]).join('\n'));
};
$('sy-run').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const c = syCfg();
  if (!c.host) return appendLog('请填写 FTP 主机', 'err');
  if (!c.rules.length) return appendLog('请填写同步规则', 'err');

  const r = await window.api.syncRun(root, c);
  appendLog(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg, r.ok ? 'ok' : 'err');
};

// ===== 回收 NPC 面板 =====

// ===== 存销系统面板 =====
$('sl-browse').onclick = async () => {
  const d = await window.api.selectDir();
  if (d) $('sl-out').value = d;
};
$('sl-timers').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const r = await window.api.salesTimers(root);
  if (!r.ok) { appendLog((r.log || []).join('\n'), 'err'); return; }
  const st = $('sl-timer-st');
  st.textContent = '已用 ' + r.used.length + ' 个：' + r.used.join(',') + '；推荐未用定时器：' + r.next + '（对齐虾米 _choose_unused_store_timer_id）';
  appendLog('⏱ 定时器占用：已用 [' + r.used.join(',') + ']，推荐未用 ' + r.next);
};
// ===== 存销脚本生成（移植自虾米 1.3.6 咕咕鸡模板）=====
$('ss-timers').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const r = await window.api.storeTimer(root, { featureFolder: $('ss-folder').value.trim(), scriptName: $('ss-script').value.trim() });
  $('ss-timer-st').textContent = r.ok ? '空闲定时器: ' + r.timerId + '（全 Envir 扫描）' : r.msg;
  appendLog(r.ok ? '⏱ 空闲定时器: ' + r.timerId : r.msg, r.ok ? 'ok' : 'err');
};
$('ss-run').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const o = {
    featureFolder: $('ss-folder').value.trim(), scriptName: $('ss-script').value.trim(), methodName: $('ss-method').value.trim(),
    categoryFolder: $('ss-category').value.trim(), commonFolder: $('ss-common').value.trim(), zoneFolder: $('ss-zone').value.trim(),
    storeU: $('ss-uvar').value.trim(), interval: parseInt($('ss-interval').value, 10) || 60,
    btn: $('ss-btn').value.trim(), rid: parseInt($('ss-rid').value, 10) || 0, qrMethod: $('ss-qr').value.trim(),
    filterTip: $('ss-ftip').value.trim(), storeTip: $('ss-stip').value.trim(),
  };
  if (!o.featureFolder || !o.scriptName || !o.methodName) return appendLog('请填功能文件夹/脚本名/方法名', 'err');
  if (!(await confirmDialog('⚠️ 将生成存销脚本到 QuestDiary\\' + o.featureFolder + '\\ 并注入 QManage（[@Login] 段 + 定时器块）+ QFunction（掉落检测）\n\n确认生成？（自动备份 QManage/QF，可重复生成自动清理旧块）'))) return;
  const r = await window.api.storeGen(root, o);
  appendLog(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg, r.ok ? 'ok' : 'err');
  if (r.ok) $('ss-timer-st').textContent = '定时器: ' + r.timerId;
};
$('ss-clean').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const folder = $('ss-folder').value.trim();
  if (!folder) return appendLog('请填功能文件夹名', 'err');
  if (!(await confirmDialog('🧹 将剥离 QManage/QFunction-0.txt 里的存销标记块，并删除 QuestDiary\\' + folder + ' 目录\n\n确认清理？（自动备份）'))) return;
  const r = await window.api.storeClean(root, { featureFolder: folder });
  appendLog(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg, r.ok ? 'ok' : 'err');
};

$('sl-run').onclick = async () => {
  const root = await ensureRoot();
  const outDir = $('sl-out').value.trim();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  if (!outDir) return appendLog('请选择生成路径', 'err');

  const o = {
    root, outDir, name: $('sl-name').value.trim() || '数据包',
    format: $('sl-format').value, groupSize: parseInt($('sl-group').value, 10) || 100,
    userIdType: $('sl-uid').value
  };
  const r = await window.api.genSales(o);
  appendLog(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg, r.ok ? 'ok' : 'err');
};

// ===== 原刷怪调整 + 动态刷怪 =====
let mgType = 'all';
wireSeg('mg-type-seg', d => {
  mgType = d.mgt;
  $('mg-name').style.display = mgType === 'all' ? 'none' : 'block';
});
$('mg-adjust').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const o = {
    root, type: mgType, name: $('mg-name').value.trim(),
    monCount: $('mg-count').value, monDate: $('mg-time').value,
    expressionDate: $('mg-exd-op').value, excludeDateCount: $('mg-exd').value || null,
    expressionMon: $('mg-exm-op').value, excludeMonCount: $('mg-exm').value || null
  };
  const r = await window.api.mgAdjust(o);
  if (r.ok) appendLog('✅ 刷怪调整完成：数量改 ' + r.changedCount + ' 行、时间改 ' + r.changedDate + ' 行' + (r.skipped ? '（排除跳过 ' + r.skipped + ' 行）' : ''), 'ok');
  else appendLog('❌ ' + (r.msg || '调整失败'), 'err');
};
$('dy-run').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const o = {
    root, pro: $('dy-pro').value, count: $('dy-count').value, monCount: $('dy-moncount').value,
    intervaled: $('dy-intervaled').value, interval: $('dy-interval').value,
    excludeMaps: $('dy-exmap').value.split(',').map(x => x.trim()).filter(Boolean),
    excludeMons: $('dy-exmon').value.split(',').map(x => x.trim()).filter(Boolean),
    excludeTimeMin: $('dy-starttime').value || null, excludeCountMax: $('dy-endtime').value || null,
    engine: $('dy-engine').value, triggerCountPercent: $('dy-tcpct').value || null,
    injectQmanage: !!$('dy-qm') && $('dy-qm').checked
  };
  const r = await window.api.dynamicSpawn(o);
  appendLog(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg, r.ok ? 'ok' : 'err');
};
$('m-table').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const map = $('m-map').value.trim();
  const mon = $('m-mon').value.trim();
  const r = await window.api.spawnTable({ root, map, mon, limit: 500 });
  if (!r.ok) { appendLog(r.log ? (r.log||[]).join('\n') : '查询失败', 'err'); return; }
  const tb = $('m-tablebody');
  tb.innerHTML = r.rows.map(x =>
    '<tr><td style="padding:4px;border:1px solid #444;">' + esc(x.map) + '</td>' +
    '<td style="padding:4px;border:1px solid #444;">' + esc(x.mapName) + '</td>' +
    '<td style="padding:4px;border:1px solid #444;text-align:center;">' + x.x + '</td>' +
    '<td style="padding:4px;border:1px solid #444;text-align:center;">' + x.y + '</td>' +
    '<td style="padding:4px;border:1px solid #444;">' + esc(x.monster) + '</td>' +
    '<td style="padding:4px;border:1px solid #444;text-align:center;">' + x.count + '</td>' +
    '<td style="padding:4px;border:1px solid #444;text-align:center;">' + x.range + '</td>' +
    '<td style="padding:4px;border:1px solid #444;text-align:center;">' + x.time + '</td>' +
    '<td style="padding:4px;border:1px solid #444;">' + esc(x.extra) + '</td></tr>'
  ).join('');
  $('m-tablebox').style.display = 'block';
  appendLog('📊 刷怪表格: 共 ' + r.total + ' 行 / ' + r.maps + ' 张地图' + (r.total > 500 ? '（显示前 500 行，请用地图/怪物过滤）' : ''));
};
$('ps-run').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const o = {
    root, map: $('ps-map').value.trim(), monster: $('ps-mon').value.trim(),
    count: $('ps-count').value, range: $('ps-range').value,
    injectQmanage: !!$('ps-qm') && $('ps-qm').checked
  };
  const r = await window.api.pspawn(o);
  appendLog((r.log || []).join('\n'));
};
$('is-load').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const r = await window.api.detectDungeons(root);
  if (!r.ok) { appendLog((r.log || []).join('\n'), 'err'); return; }
  const sel = $('is-map');
  sel.innerHTML = '<option value="">' + r.count + ' 个副本地图</option>' + r.dungeons.map(d =>
    '<option value="' + esc(d.code) + '">' + esc(d.code + ' [' + d.name + ']' + (d.hasMap ? '' : d.mainHasMap ? ' (可复制)' : '')) + '</option>'
  ).join('');
  $('is-hint').textContent = '已加载 ' + r.count + ' 个副本地图（' + r.dungeons.filter(d => !d.hasMap && d.mainHasMap).length + ' 个缺少 .map，生成时自动复制）';
  appendLog('🏰 副本加载: ' + r.count + ' 个副本地图');
};
$('is-run').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const o = {
    root, map: $('is-map').value, monster: $('is-mon').value.trim(),
    count: $('is-count').value, range: $('is-range').value,
    injectQmanage: !!$('is-qm') && $('is-qm').checked
  };
  if (!o.map) return appendLog('请先加载并选择副本地图', 'err');
  const r = await window.api.ispawn(o);
  appendLog((r.log || []).join('\n'));
};

// ===== 一键提取全服货币 =====

// ===== 回收 NPC（原版风格） =====
function rcCatRow() {
  const div = document.createElement('div');
  div.className = 'rc-cat';
  div.style.cssText = 'border:1px solid #e3e8f0;border-radius:8px;padding:10px 12px;margin-bottom:10px;background:#fafbfd;';
  div.innerHTML = `
    <div class="row">
      <label>分类名</label><input class="c-name" type="text" placeholder="如：武器类" style="width:180px;min-width:180px;padding:8px 11px;border:1px solid #d8dee8;border-radius:6px;font-size:14px;background:#fafbfd;">
      <label style="min-width:auto;">颜色</label><input class="c-color" type="number" value="7" title="SCOLOR 颜色编号(7白 250绿 249黄)" style="width:80px;min-width:80px;max-width:80px;padding:8px 11px;border:1px solid #d8dee8;border-radius:6px;font-size:14px;background:#fafbfd;">
      <button class="c-del btn-danger" style="margin-left:auto;">删除</button>
    </div>
    <div class="row"><label>提示</label><input class="c-tip" type="text" placeholder="悬停提示信息（可空）" style="flex:1;min-width:200px;padding:8px 11px;border:1px solid #d8dee8;border-radius:6px;font-size:14px;background:#fafbfd;"></div>
    <div class="row" style="align-items:flex-start;"><label>物品</label><textarea class="c-names" rows="2" placeholder="回收物品名，每行一个或用 | 分隔，如：&#10;屠龙|裁决之杖|金创药" style="flex:1;min-width:200px;font-family:Consolas,monospace;font-size:13px;padding:8px 11px;border:1px solid #d8dee8;border-radius:6px;font-size:14px;background:#fafbfd;"></textarea></div>
    <div class="row">
      <label>给予</label>
      <span style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        金币 <input class="x-gold" type="number" placeholder="0" style="width:80px;min-width:80px;max-width:80px;padding:8px 11px;border:1px solid #d8dee8;border-radius:6px;font-size:14px;background:#fafbfd;">
        元宝 <input class="x-yb" type="number" placeholder="0" style="width:80px;min-width:80px;max-width:80px;padding:8px 11px;border:1px solid #d8dee8;border-radius:6px;font-size:14px;background:#fafbfd;">
        金刚石 <input class="x-diamond" type="number" placeholder="0" style="width:80px;min-width:80px;max-width:80px;padding:8px 11px;border:1px solid #d8dee8;border-radius:6px;font-size:14px;background:#fafbfd;">
        荣誉 <input class="x-fu" type="number" placeholder="0" style="width:80px;min-width:80px;max-width:80px;padding:8px 11px;border:1px solid #d8dee8;border-radius:6px;font-size:14px;background:#fafbfd;">
        自定义 <input class="x-diy-name" type="text" placeholder="货币名|变量" title="格式：货币名|变量，如：元歌币|U11" style="width:150px;min-width:150px;padding:8px 11px;border:1px solid #d8dee8;border-radius:6px;font-size:14px;background:#fafbfd;">
        <input class="x-diy-num" type="number" placeholder="数量" style="width:80px;min-width:80px;max-width:80px;padding:8px 11px;border:1px solid #d8dee8;border-radius:6px;font-size:14px;background:#fafbfd;">
      </span>
    </div>`;
  div.querySelector('.c-del').onclick = () => div.remove();
  return div;
}
// 回收配置收集/应用（对齐虾米 _load_settings/_save_settings + _restore_defaults）
let lastScript = '';
function rcCollectConfig() {
  const cats = [];
  document.querySelectorAll('#rc-cats .rc-cat').forEach(el => {
    const name = el.querySelector('.c-name').value.trim();
    const names = (el.querySelector('.c-names').value || '').split(/[|,，、;；\r\n]+/).map(x => x.trim()).filter(Boolean);
    const tip = el.querySelector('.c-tip').value.trim();
    const color = el.querySelector('.c-color').value || '7';
    const gold = el.querySelector('.x-gold').value || '0';
    const yb = el.querySelector('.x-yb').value || '0';
    const dia = el.querySelector('.x-diamond').value || '0';
    const fu = el.querySelector('.x-fu').value || '0';
    const diyName = el.querySelector('.x-diy-name').value.trim();
    const diyNum = el.querySelector('.x-diy-num').value || '0';
    cats.push({ name, names, tip, color, gold, yb, dia, fu, diyName, diyNum });
  });
  return {
    map: $('rc-map').value, x: $('rc-posx').value, y: $('rc-posy').value, npc: $('rc-npc').value,
    sc: $('rc-sc').value, wil: $('rc-wil').value, npcimg: $('rc-npcimg').value,
    checked: $('rc-checked').value, nochecked: $('rc-nochecked').value, col: $('rc-col').value,
    cats
  };
}
function rcApplyConfig(c) {
  if (!c) return;
  $('rc-map').value = c.map || ''; $('rc-posx').value = c.x || ''; $('rc-posy').value = c.y || ''; $('rc-npc').value = c.npc || '';
  $('rc-sc').value = c.sc || 'str'; $('rc-wil').value = c.wil || '0'; $('rc-npcimg').value = c.npcimg || '0';
  $('rc-checked').value = c.checked || '1'; $('rc-nochecked').value = c.nochecked || '2'; $('rc-col').value = c.col || '4';
  $('rc-cats').innerHTML = '';
  (c.cats || []).forEach(cat => {
    const row = rcCatRow();
    row.querySelector('.c-name').value = cat.name || '';
    row.querySelector('.c-names').value = (cat.names || []).join('|');
    row.querySelector('.c-tip').value = cat.tip || '';
    row.querySelector('.c-color').value = cat.color || '7';
    row.querySelector('.x-gold').value = cat.gold || '0';
    row.querySelector('.x-yb').value = cat.yb || '0';
    row.querySelector('.x-diamond').value = cat.dia || '0';
    row.querySelector('.x-fu').value = cat.fu || '0';
    row.querySelector('.x-diy-name').value = cat.diyName || '';
    row.querySelector('.x-diy-num').value = cat.diyNum || '0';
    $('rc-cats').appendChild(row);
  });
  if (!(c.cats || []).length) $('rc-addcat').click();
}
$('rc-save').onclick = () => {
  const c = rcCollectConfig();
  try { localStorage.setItem('yge-recycle-cfg', JSON.stringify(c)); appendLog('💾 回收配置已保存（共 ' + c.cats.length + ' 个分类）'); } catch (e) { appendLog('❌ 保存失败: ' + e.message, 'err'); }
};
$('rc-load').onclick = () => {
  try {
    const c = JSON.parse(localStorage.getItem('yge-recycle-cfg') || 'null');
    if (!c) { appendLog('⚠ 没有已保存的回收配置', 'err'); return; }
    rcApplyConfig(c);
    appendLog('📂 回收配置已加载（' + (c.cats || []).length + ' 个分类）');
  } catch (e) { appendLog('❌ 加载失败: ' + e.message, 'err'); }
};
$('rc-reset').onclick = () => {
  $('rc-cats').innerHTML = '';
  $('rc-addcat').click();
  appendLog('↺ 已恢复默认（1 个空分类）');
};
$('rc-copy').onclick = async () => {
  if (!lastScript) return appendLog('⚠ 请先生成回收 NPC', 'err');
  try {
    await navigator.clipboard.writeText(lastScript);
    appendLog('📋 脚本已复制到剪贴板（' + lastScript.split('\n').length + ' 行）');
  } catch (e) { appendLog('❌ 复制失败: ' + e.message, 'err'); }
};

$('rc-addcat').onclick = () => $('rc-cats').appendChild(rcCatRow());
$('rc-cats').appendChild(rcCatRow()); // 默认一行
$('rc-sc').onchange = () => { $('rc-mat').style.display = $('rc-sc').value === 'this' ? '' : 'none'; };
$('rc-run').onclick = async () => {
  const root = await ensureRoot();
  const map = $('rc-map').value.trim(), x = $('rc-posx').value, y = $('rc-posy').value, npc = $('rc-npc').value.trim();
  if (!root) return out('rc-out', '未选择引擎根目录', 'err');
  if (!map || !x || !y || !npc) return out('rc-out', '请填写完整 NPC 位置（地图/X/Y/NPC名）', 'err');
  const cats = [];
  document.querySelectorAll('#rc-cats .rc-cat').forEach(el => {
    const name = el.querySelector('.c-name').value.trim();
    const names = (el.querySelector('.c-names').value || '').split(/[|,，、;；\r\n]+/).map(s => s.trim()).filter(Boolean);
    if (!name || !names.length) return;
    const extracts = [];
    const gold = parseInt(el.querySelector('.x-gold').value);
    if (gold > 0) extracts.push({ key: 'gold', name: '金币', value: gold });
    const yb = parseInt(el.querySelector('.x-yb').value);
    if (yb > 0) extracts.push({ key: 'gamegold', name: '元宝', value: yb });
    const dia = parseInt(el.querySelector('.x-diamond').value);
    if (dia > 0) extracts.push({ key: 'gamediamond', name: '金刚石', value: dia });
    const fu = parseInt(el.querySelector('.x-fu').value);
    if (fu > 0) extracts.push({ key: 'gameglory', name: '荣誉', value: fu });
    const diyName = el.querySelector('.x-diy-name').value.trim();
    const diyNum = parseInt(el.querySelector('.x-diy-num').value);
    if (diyName && diyNum > 0) {
      const bar = diyName.indexOf('|');
      if (bar > 0) extracts.push({ key: 'diy', name: diyName, value: diyNum });
    }
    cats.push({ name, tip: el.querySelector('.c-tip').value.trim(), color: parseInt(el.querySelector('.c-color').value) || 7, names, extracts });
  });
  if (!cats.length) return out('rc-out', '请至少填写一个分类（分类名+物品）', 'err');
  out('rc-out', '正在生成回收 NPC ...');
  const o = {
    mapCode: map, x, y, npcName: npc, cats,
    sc: $('rc-sc').value, col: parseInt($('rc-col').value) || 4,
    wil: $('rc-wil').value, npc: $('rc-npcimg').value, checked: $('rc-checked').value, noChecked: $('rc-nochecked').value
  };
  const rr = await window.api.recycleGen(root, o);
  if (!rr.ok) return out('rc-out', rr.msg, 'err');
  lastScript = rr.script || '';
  $('rc-copy').disabled = !lastScript;
  const st = $('rc-st'); if (st) st.textContent = '✅ 生成成功：脚本 ' + (rr.scriptLines || 0) + ' 行，MerChant 已' + (rr.updated ? '更新' : '注册') + '（对齐虾米脚本行数徽章）';
  let t = '✅ 回收 NPC 生成完成（原版风格）\nNPC: ' + rr.npc + '（' + cats.length + ' 个分类）\n个人标识: [' + rr.checks.join(',') + ']\nMerChant.txt: ' + rr.merchant + (rr.updated ? '（已更新）' : '（已追加）') + '\n脚本: ' + rr.scriptFile + '（' + rr.scriptLines + ' 行）\n\n提示: 重启引擎或 @reloadnpc 生效';
  out('rc-out', t);
};


// ===== 货币兑换（原版风格：多兑换项 + 重复次数倍率） =====
const X_CURR = [
  { key: 'gold', name: '金币' }, { key: 'gamegold', name: '元宝' },
  { key: 'gamediamond', name: '金刚石' }, { key: 'gameglory', name: '荣誉' },
  { key: 'creditpoint', name: '声望' }, { key: 'gamepoint', name: '充值点' }, { key: 'gamegird', name: '灵符' }
];
function xRow() {
  const div = document.createElement('div');
  div.className = 'x-row';
  div.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;border:1px solid #e3e8f0;border-radius:8px;padding:10px;margin-bottom:10px;background:#fafbfd;';
  div.innerHTML = `
    <label>用</label><input class="x-a1" type="number" placeholder="数量" style="width:140px;min-width:140px;max-width:140px;">
    <select class="x-afrom" style="width:96px;min-width:96px;"><option value="gold">金币</option><option value="gamegold">元宝</option><option value="gamediamond">金刚石</option><option value="gameglory">荣誉</option><option value="creditpoint">声望</option><option value="gamepoint">充值点</option><option value="gamegird">灵符</option><option value="diy">自定义(变量)</option></select>
    <input class="x-fvar" placeholder="货币名|变量" title="选自定义时填写，如：元歌币|U11" style="width:150px;min-width:150px;display:none;">
    <label>兑换</label><input class="x-a2" type="number" placeholder="数量" style="width:140px;min-width:140px;max-width:140px;">
    <select class="x-ato" style="width:96px;min-width:96px;"><option value="gold">金币</option><option value="gamegold">元宝</option><option value="gamediamond">金刚石</option><option value="gameglory">荣誉</option><option value="creditpoint">声望</option><option value="gamepoint">充值点</option><option value="gamegird">灵符</option><option value="diy">自定义(变量)</option></select>
    <input class="x-tvar" placeholder="货币名|变量" title="选自定义时填写，如：元歌币|U11" style="width:150px;min-width:150px;display:none;">
    <button class="x-del btn-danger">删除</button>`;
  const f = div.querySelector('.x-afrom'), t = div.querySelector('.x-ato');
  const fvar = div.querySelector('.x-fvar'), tvar = div.querySelector('.x-tvar');
  f.onchange = () => { fvar.style.display = f.value === 'diy' ? '' : 'none'; };
  t.onchange = () => { tvar.style.display = t.value === 'diy' ? '' : 'none'; };
  div.querySelector('.x-del').onclick = () => div.remove();
  return div;
}
$('x-add').onclick = () => $('x-list').appendChild(xRow());
$('x-list').appendChild(xRow());
$('x-run').onclick = async () => {
  const root = await ensureRoot();
  const map = $('x-map').value.trim(), x = $('x-x').value, y = $('x-y').value, npc = $('x-npc').value.trim();
  const count = parseInt($('x-count').value) || 1;

  const items = [];
  document.querySelectorAll('#x-list .x-row').forEach(el => {
    const a1 = parseInt(el.querySelector('.x-a1').value);
    const a2 = parseInt(el.querySelector('.x-a2').value);
    const f = el.querySelector('.x-afrom').value, t = el.querySelector('.x-ato').value;
    if (!a1 || !a2) return;
    let fName = (el.querySelector('.x-afrom').selectedOptions[0] || {}).textContent || f;
    let tName = (el.querySelector('.x-ato').selectedOptions[0] || {}).textContent || t;
    if (f === 'diy') {
      const v = el.querySelector('.x-fvar').value.trim();

      fName = v;
    }
    if (t === 'diy') {
      const v = el.querySelector('.x-tvar').value.trim();

      tName = v;
    }
    items.push({ from: f, fromName: fName, fromAmount: a1, to: t, toName: tName, toAmount: a2 });
  });

  const genOnly = $('x-genonly').checked;
  const rr = await window.api.addExchange(root, { mapCode: map, x, y, npcName: npc, count, items, generateOnly: genOnly });

  if (genOnly) { appendLog('✅ 已生成兑换脚本内容（未写入文件，' + rr.scriptLines + ' 行，还原自虾米只生成模式）\n' + rr.script); return; }
  let t2 = '✅ 兑换 NPC 生成完成（原版风格：' + items.length + ' 项 × ' + count + ' 档倍率）\nMerChant.txt: ' + rr.merchant + (rr.updated ? '（已更新）' : '（已追加）') + '\n脚本: ' + rr.scriptFile + '（' + rr.scriptLines + ' 行）\n\n提示: 重启引擎或 @reloadnpc 生效';

};

// ===== 快捷操作（原版风格：快捷文件 + NPC列表 + 我的快捷） =====
const QK_QUICK = [
  ['Mir200 目录', 'Mir200'], ['Envir 目录', 'Mir200/Envir'],
  ['NPC 文件', 'Mir200/Envir/Npc_def'], ['NPC 目录', 'Mir200/Envir/Market_Def'],
  ['刷怪文件', 'Mir200/Envir/MonGen.txt'], ['爆率目录', 'Mir200/Envir/MonItems'],
  ['机器人脚本', 'Mir200/Envir/Robot_def/AutoRunRobot.txt'], ['机器人触发', 'Mir200/Envir/Robot_def/RobotManage.txt'],
  ['任务脚本', 'Mir200/Envir/QuestDiary'], ['地图事件', 'Mir200/Envir/MapQuest_def'],
  ['怪物说话', 'Mir200/Envir/MonSayMsg.txt'], ['地图配置', 'Mir200/Envir/MapInfo.txt'],
  ['管理员列表', 'Mir200/Envir/AdminList.txt'], ['NPC注册', 'Mir200/Envir/MerChant.txt'],
  ['刷新点', 'Mir200/Envir/StartPoint.txt'], ['行会目录', 'Mir200/GuildBase'],
  ['共享数据', 'Mir200/Share'], ['账号数据库', 'DBServer']
];
let qkAll = [];

function qkRenderPaths(root) {
  const box = $('qk-paths');
  box.innerHTML = '';
  QK_QUICK.forEach(([name, rel]) => {
    const b = document.createElement('div');
    b.style.cssText = 'padding:7px 10px;border-radius:6px;cursor:pointer;font-size:13px;color:#34405a;border:1px solid #e3e8f0;margin-bottom:4px;background:#fafbfd;';
    b.textContent = '📄 ' + name;
    b.onmouseover = () => { b.style.background = '#eef2f9'; };
    b.onmouseout = () => { b.style.background = '#fafbfd'; };
    b.onclick = async () => {
      const r = await window.api.quickOpen(root, rel);
      qkLog(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg);
    };
    box.appendChild(b);
  });
}
function qkRenderMine(root) {
  const box = $('qk-mine');
  box.innerHTML = '';
  const mine = JSON.parse(localStorage.getItem('qk-mine') || '[]');
  if (!mine.length) { box.innerHTML = '<div style="color:#999;padding:4px;font-size:12px;">暂无自定义，添加后显示</div>'; return; }
  mine.forEach((rel, idx) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:5px 8px;border:1px solid #e3e8f0;border-radius:6px;margin-bottom:4px;background:#fafbfd;';
    const lb = document.createElement('span');
    lb.textContent = '📄 ' + rel;
    lb.style.cssText = 'flex:1;font-size:12px;color:#34405a;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    lb.onclick = async () => { const r = await window.api.quickOpen(root, rel); qkLog(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg); };
    const del = document.createElement('button');
    del.textContent = '✕';
    del.style.cssText = 'border:none;background:none;color:#c0392b;cursor:pointer;font-size:12px;';
    del.onclick = () => {
      const arr = JSON.parse(localStorage.getItem('qk-mine') || '[]');
      arr.splice(idx, 1);
      localStorage.setItem('qk-mine', JSON.stringify(arr));
      qkRenderMine(root);
    };
    row.appendChild(lb); row.appendChild(del);
    box.appendChild(row);
  });
}
function qkRenderTable(root, npcs) {
  const box = $('qk-table');
  qkAll = npcs || [];
  $('qk-count').textContent = '共 ' + npcs.length + ' 个 NPC';
  if (!npcs.length) { box.innerHTML = '<div style="color:#999;padding:12px;">无 NPC（先选引擎根目录刷新）</div>'; return; }
  let html = '<table style="width:100%;border-collapse:collapse;font-size:13px;"><tr style="background:#f0f4fa;color:#34405a;">' +
    '<th style="padding:8px;text-align:left;border-bottom:1px solid #d8dee8;">地图名</th>' +
    '<th style="padding:8px;text-align:left;border-bottom:1px solid #d8dee8;">NPC名</th>' +
    '<th style="padding:8px;text-align:left;border-bottom:1px solid #d8dee8;">坐标</th>' +
    '<th style="padding:8px;text-align:left;border-bottom:1px solid #d8dee8;">操作</th></tr>';
  npcs.forEach((n, i) => {
    html += '<tr style="' + (i % 2 ? 'background:#fafbfd;' : '') + '">' +
      '<td style="padding:6px 8px;border-bottom:1px solid #eef1f6;">' + n.map + '</td>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #eef1f6;">' + n.name + '</td>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #eef1f6;">(' + n.x + ', ' + n.y + ')</td>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #eef1f6;"><button class="qk-open btn-default" data-i="' + i + '">打开</button></td></tr>';
  });
  html += '</table>';
  box.innerHTML = html;
  box.querySelectorAll('.qk-open').forEach(btn => {
    btn.onclick = async () => {
      const n = qkAll[parseInt(btn.dataset.i)];
      if (n.script) {
        const rr = await window.api.openPath(n.script);
        qkLog(rr && rr.ok ? '✅ 已打开 NPC 脚本: ' + n.path + '-' + n.map + '.txt' : '❌ ' + (rr ? rr.msg : '打开失败') + ' (' + n.path + '-' + n.map + '.txt)');
      }
      else { qkLog('⚠ 未找到脚本: Market_Def\\' + n.path + '-' + n.map + '.txt'); }
    };
  });
}
async function qkLoad(root) {
  const r = await window.api.merchantList(root);
  if (!r.ok) { qkLog(r.msg, 'err'); qkRenderTable(root, []); return; }
  qkAll = r.npcs;
  const mf = $('qk-mapfilter').value.trim().toLowerCase();
  const nf = $('qk-namefilter').value.trim().toLowerCase();
  const filtered = r.npcs.filter(n => (!mf || n.map.toLowerCase().includes(mf)) && (!nf || (n.name || '').toLowerCase().includes(nf)));
  qkRenderTable(root, filtered);
  qkLog('共 ' + r.total + ' 个 NPC，过滤后 ' + filtered.length + ' 个');
}
$('qk-refresh').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return qkLog('未选择引擎根目录', 'err');
  qkRenderPaths(root);
  qkRenderMine(root);
  await qkLoad(root);
};
$('qk-mapfilter').oninput = () => { const root = $('root').value.trim(); if (root) qkLoad(root); };
$('qk-namefilter').oninput = () => { const root = $('root').value.trim(); if (root) qkLoad(root); };
$('qk-add').onclick = () => {
  const v = $('qk-custom').value.trim();
  if (!v) return qkLog('请输入自定义路径', 'err');
  const arr = JSON.parse(localStorage.getItem('qk-mine') || '[]');
  if (!arr.includes(v)) arr.push(v);
  localStorage.setItem('qk-mine', JSON.stringify(arr));
  $('qk-custom').value = '';
  const root = $('root').value.trim();
  qkRenderMine(root);
  qkLog('已添加: ' + v);
};

// ===== 一键提取全服货币（原版 index-eae1c9c2：提取 → 填充下拉） =====
$('x-loadmap').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const r = await window.api.listMaps(root);
  if (!r.ok) { appendLog((r.log || []).join('\n'), 'err'); return; }
  const dl = $('x-maplist');
  dl.innerHTML = r.maps.map(m => '<option value="' + esc(m.code) + '">' + esc(m.name) + '</option>').join('');
  const sel = $('x-maplist-sel');
  sel.innerHTML = '<option value="">-- 选地图(可滚动) --</option>' + r.maps.map(m => '<option value="' + esc(m.code) + '">' + esc(m.code + ' ' + m.name) + '</option>').join('');
  sel.onchange = () => { if (sel.value) $('x-map').value = sel.value; };
  appendLog('🗺 已加载 ' + r.count + ' 张地图（下拉可选/可滚动，左侧可输入过滤，对齐虾米地图自动补全）');
};

$('x-extract').onclick = async () => {
  const root = await ensureRoot();
  if (!root) { out('x-out', '未选择引擎根目录', 'err'); return; }
  out('x-out', '正在提取全服货币 ...');
  const r = await window.api.extractCurrencies(root);
  if (!r.currencies) { out('x-out', (r.log || [r.msg || '提取失败']).join('\n'), 'err'); return; }
  const builtin = ['金币', '元宝', '金刚石', '灵符', '声望', '游戏点'];
  let added = 0;
  for (const sel of [document.querySelectorAll('.x-afrom'), document.querySelectorAll('.x-ato')]) {
    for (const s of sel) {
      // 去掉之前追加的提取项
      Array.from(s.options).forEach(o => { if (o.dataset.extracted) s.removeChild(o); });
      for (const c of r.currencies) {
        if (builtin.includes(c.name)) continue;
        const opt = document.createElement('option');
        opt.value = 'diy';
        opt.dataset.extracted = '1';
        opt.dataset.var = c.name;
        opt.textContent = '自定义:' + c.name;
        s.appendChild(opt);
        added++;
      }
      // 选中提取项时自动填变量框
      s.onchange = () => {
        const row = s.closest('.x-row');
        if (!row) return;
        const opt = s.selectedOptions[0];
        const fvar = row.querySelector('.x-fvar'), tvar = row.querySelector('.x-tvar');
        if (s.classList.contains('x-afrom') && fvar) {
          fvar.style.display = opt && (opt.value === 'diy' || opt.dataset.var) ? '' : 'none';
          if (opt && opt.dataset.var) fvar.value = opt.dataset.var + '|' + opt.dataset.var.split('|')[0];
        }
        if (s.classList.contains('x-ato') && tvar) {
          tvar.style.display = opt && (opt.value === 'diy' || opt.dataset.var) ? '' : 'none';
          if (opt && opt.dataset.var) tvar.value = opt.dataset.var + '|' + opt.dataset.var.split('|')[0];
        }
      };
    }
  }
  const log = (r.log || []).join('\n');
  out('x-out', log + '\n\n✅ 已把 ' + r.currencies.length + ' 种货币加入下拉（选「自定义:xxx」自动填变量）');
};

// 操作日志：手柄拖动 + 收起（光标只在手柄显示 move）
(function () {
  const wrap = document.getElementById('log-wrap');
  const handle = document.getElementById('log-handle');
  const el = document.getElementById('log');
  const minBtn = document.getElementById('log-min');
  if (!wrap || !handle || !el) return;
  let drag = false, sx = 0, sy = 0, ox = 0, oy = 0;
  handle.addEventListener('mousedown', (e) => {
    drag = true;
    sx = e.clientX; sy = e.clientY;
    const cs = getComputedStyle(wrap);
    ox = parseInt(cs.left) || (window.innerWidth - wrap.offsetWidth - 22);
    oy = parseInt(cs.top) || (window.innerHeight - wrap.offsetHeight - 10);
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!drag) return;
    let nx = ox + (e.clientX - sx), ny = oy + (e.clientY - sy);
    nx = Math.max(8, Math.min(window.innerWidth - 80, nx));
    ny = Math.max(8, Math.min(window.innerHeight - 30, ny));
    wrap.style.left = nx + 'px';
    wrap.style.top = ny + 'px';
    wrap.style.right = 'auto';
    wrap.style.bottom = 'auto';
  });
  document.addEventListener('mouseup', () => { drag = false; });
  let collapsed = false;
  minBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    collapsed = !collapsed;
    el.style.display = collapsed ? 'none' : '';
    wrap.style.maxHeight = collapsed ? '32px' : '';
    minBtn.textContent = collapsed ? '▾ 展开' : '— 收起';
  });
})();

// ===== 变量查询（还原自虾米 1.4.3 _VarQueryPage；类型上限对齐 _var_types）=====
let __vqData = null, __vqKey = null, __vqCur = null;
$('vq-run').onclick = async () => {
  const root = await ensureRoot();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  appendLog('正在扫描变量占用（对齐虾米 1.4.3）...');
  const r = await window.api.scanVariables(root);
  if (!r.ok) return appendLog((r.log || []).join('\n') || '扫描失败', 'err');
  __vqData = r;
  __vqKey = null; __vqCur = null;
  $('vq-open').disabled = true;
  const html = [];
  for (const g of ['常规类型', '计时与标识', '输入与交互', '触发与主体', '命名变量']) {
    const groupVars = r.groups[g] || {};
    const tkeys = Object.keys(groupVars);
    if (!tkeys.length) continue;
    html.push('<div class="vq-group" style="padding:6px 8px;background:#eef1f6;font-weight:600;font-size:12px;">' + esc(g) + '</div>');
    for (const t of tkeys) {
      const cnt = Object.keys(groupVars[t] || {}).length;
      const limit = r.limits && r.limits[t] != null ? ' <span style="opacity:.6">(0-' + r.limits[t] + ')</span>' : '';
      html.push('<div class="vq-type" data-g="' + esc(g) + '" data-t="' + esc(t) + '" style="padding:5px 10px;cursor:pointer;font-size:12.5px;border-bottom:1px solid #f0f2f6;">' + esc(t) + limit + ' <span style="float:right;opacity:.6">' + cnt + '</span></div>');
    }
  }
  $('vq-types').innerHTML = html.join('') || '<div class="empty">无变量</div>';
  $('vq-sum').textContent = '扫描完成：' + r.files + ' 文件 / ' + r.matches + ' 处匹配';
  $('vq-varcount').textContent = '共 ' + r.matches + ' 处引用（' + r.files + ' 文件）';
  $('vq-varlist').innerHTML = ''; $('vq-detail').innerHTML = '';
  appendLog('✅ 变量扫描完成：' + r.files + ' 文件 / ' + r.matches + ' 处匹配');
  document.querySelectorAll('#vq-types .vq-type').forEach(el => {
    el.onclick = () => {
      document.querySelectorAll('#vq-types .vq-type').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      const g = el.dataset.g, t = el.dataset.t;
      const vars = ((r.groups[g] || {})[t]) || {};
      const keys = Object.keys(vars);
      // 按数字序排列（U0,U1,U2...U100；无数字的放最后）——便于分辨已用/未用
      const numOf = (k) => { const m = String(k).match(/\d+/); return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER; };
      const strOf = (k) => String(k).replace(/\d+/g, '');
      keys.sort((x, y) => numOf(x) - numOf(y) || strOf(x).localeCompare(strOf(y)) || String(x).localeCompare(String(y)));
      $('vq-varlist').innerHTML = keys.map(k => '<div class="vq-var" data-key="' + esc(k) + '" style="padding:4px 10px;cursor:pointer;font-size:12.5px;border-bottom:1px solid #f0f2f6;">' + esc(k) + ' <span style="float:right;opacity:.6">' + vars[k].length + '</span></div>').join('') || '<div class="empty">无变量</div>';
      $('vq-varlist-st').textContent = t + ' 共 ' + keys.length + ' 个变量';
      $('vq-detail').innerHTML = ''; $('vq-open').disabled = true;
      document.querySelectorAll('#vq-varlist .vq-var').forEach(v => {
        v.onclick = () => {
          document.querySelectorAll('#vq-varlist .vq-var').forEach(x => x.classList.remove('active'));
          v.classList.add('active');
          __vqKey = { g, t, key: v.dataset.key, list: vars[v.dataset.key] };
          renderVqDetail();
        };
      });
    };
  });
};
function renderVqDetail() {
  if (!__vqKey) return;
  const rows = __vqKey.list || [];
  $('vq-detail').innerHTML = rows.map((x, i) => '<div class="vq-ref" data-i="' + i + '" style="padding:4px 8px;cursor:pointer;border-bottom:1px solid #eef1f6;">' + (i + 1) + '. ' + esc(x.file) + ':' + x.line + ' <span style="color:#667;">' + esc((x.text || '').slice(0, 60)) + '</span></div>').join('') || '<div class="empty">无引用</div>';
  $('vq-detail-st').textContent = __vqKey.t + ' [' + __vqKey.key + '] 共 ' + rows.length + ' 处引用';
  $('vq-open').disabled = !rows.length;
  document.querySelectorAll('#vq-detail .vq-ref').forEach(el => {
    el.onclick = () => {
      document.querySelectorAll('#vq-detail .vq-ref').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      __vqCur = { file: rows[+el.dataset.i].file, line: rows[+el.dataset.i].line };
    };
  });
}
$('vq-open').onclick = async () => {
  const root = await ensureRoot();
  if (!root || !__vqCur) return appendLog('请先扫描并选择引用', 'err');
  const r = await window.api.openFile(root, __vqCur.file);
  appendLog(r.ok ? ('已打开 ' + __vqCur.file + ':' + __vqCur.line) : (r.msg || '打开失败'), r.ok ? '' : 'err');
};

// ===== 登录器配置 =====
$('lg-browse').onclick = async () => { const d = await window.api.pickDir(); if (d) $('lg-dir').value = d; };
$('lg-run').onclick = async () => {
  const dir = $('lg-dir').value.trim();
  const clientDir = $('lg-client').value.trim();
  if (!dir) return appendLog('请先选择登录器目录', 'err');
  if (!clientDir) return appendLog('请填写传奇客户端目录（含盘符）', 'err');
  appendLog('正在替换登录器路径: ' + dir, '');
  const r = await window.api.loginCfg({ dir, clientDir, patchDir: $('lg-patch').value.trim() });
  if (r.ok) {
    appendLog('✅ ' + r.msg, 'ok');
    (r.stat || []).forEach(x => appendLog('  ' + x, ''));
  } else appendLog('❌ ' + (r.msg || '替换失败'), 'err');
};

