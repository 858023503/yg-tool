// main.js 追加：map-view / item-find 两个 IPC handler
const fs = require('fs');
let m = fs.readFileSync('main.js', 'utf8');
const extra = `
// ④ 按地图查看
ipcMain.handle('map-view', (e, args) => {
  const { root, mapCode } = args;
  if (!root) return { ok: false, log: ['错误: 未选择引擎根目录'] };
  if (!mapCode) return { ok: false, log: ['错误: 未填写地图代码'] };
  const mm = lib.mapMonsters(root, mapCode);
  if (mm.length === 0) return { ok: false, log: ['MonGen.txt 中未找到地图 ' + mapCode + '，或该地图没有刷怪记录'] };
  const log = ['—— 地图 ' + mapCode + ' 共 ' + mm.length + ' 种怪 ——'];
  for (const x of mm) {
    log.push((x.exists ? '✓ ' : '· ') + x.mon + (x.exists ? '（爆率 ' + x.lines + ' 行）' : '（无爆率文件）'));
    for (const it of x.items) log.push('     ' + it);
    if (x.items.length >= 10) log.push('     ... 共 ' + x.lines + ' 行');
  }
  return { ok: true, log };
});

// ⑤ 物品产出查询
ipcMain.handle('item-find', (e, args) => {
  const { root, item } = args;
  if (!root) return { ok: false, log: ['错误: 未选择引擎根目录'] };
  if (!item) return { ok: false, log: ['错误: 未填写物品名'] };
  const drops = lib.findItemDrops(root, item);
  if (drops.length === 0) return { ok: false, log: ['全服 ' + lib.listMonFiles(root).length + ' 个爆率文件中没有找到「' + item + '」'] };
  const log = ['—— 物品「' + item + '」被 ' + drops.length + ' 个怪掉落 ——'];
  for (const d of drops.slice(0, 40)) log.push('  ' + d.mon + ' → ' + d.line);
  if (drops.length > 40) log.push('  ... 共 ' + drops.length + ' 条');
  return { ok: true, log };
});
`;
// 插到 app.whenReady 之前
m = m.replace('\napp.whenReady().then(createWindow);', extra + '\napp.whenReady().then(createWindow);');
fs.writeFileSync('main.js', m);
console.log('main.js 已追加 map-view/item-find');
