// GUI main.js 加 MonGen IPC handler
const fs = require('fs');
let m = fs.readFileSync('main.js', 'utf8');

// 在 do-bulk handler 前加 mongen handlers
m = m.replace(
  "ipcMain.handle('do-bulk'",
  `ipcMain.handle('mongen-list', (e, { root, map }) => {
  if (!root) return { log: ['错误: 未选择引擎根目录'] };
  const l = lib.listMonGen(root, map);
  if (!l.ok) return { log: [l.msg] };
  const log = [(map ? '地图 ' + map + ' 的刷怪配置' : '全部刷怪配置') + '（共 ' + l.total + ' 行，显示 ' + l.rows.length + ' 条）',
    '地图\\tX\\tY\\t怪物名\\t数量\\t范围\\t间隔\\t时间\\t触发'];
  for (const s of l.rows.slice(0, 50)) {
    log.push(s.map + '\\t' + s.x + '\\t' + s.y + '\\t' + s.mon + '\\t' + s.count + '\\t' + s.range + '\\t' + s.interval + '\\t' + s.time + '\\t' + s.trigger);
  }
  if (l.rows.length > 50) log.push('... 共 ' + l.rows.length + ' 条');
  return { log };
});

ipcMain.handle('mongen-add', (e, p) => {
  if (!p.root || !p.map || !p.x || !p.y || !p.mon) return { log: ['错误: 缺少必填字段'] };
  const a = lib.addMonGen(p.root, p);
  return { log: [a.ok ? '已追加: ' + a.line + ' → ' + a.file : a.msg] };
});

ipcMain.handle('mongen-del', (e, { root, map, mon }) => {
  if (!root || !map || !mon) return { log: ['错误: 缺少必填字段'] };
  const d = lib.delMonGen(root, map, mon);
  return { log: [d.ok ? '已删除 ' + d.removed + ' 条刷怪行 → ' + d.file : d.msg] };
});

ipcMain.handle('do-bulk'`
);
fs.writeFileSync('main.js', m);
require('child_process').execSync('node --check main.js', { stdio: 'inherit' });
console.log('main.js 已加 MonGen IPC，语法 OK');
