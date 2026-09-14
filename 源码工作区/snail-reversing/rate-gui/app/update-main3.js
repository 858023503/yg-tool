// 更新 main.js：do-op 支持 goods（加在物品后）和 #CHILD 区间
const fs = require('fs');
let m = fs.readFileSync('main.js', 'utf8');

// do-op handler 替换
const oldHandler = m.slice(
  m.indexOf("ipcMain.handle('do-op'"),
  m.indexOf("ipcMain.handle('do-bulk'")
);
const newHandler = `ipcMain.handle('do-op', (e, args) => {
  const { root, scope, mon, mapCode, gitem, gnew, rs, re, op, item, rate, count, cat } = args;
  if (!root) return { ok: false, log: ['错误: 未选择引擎根目录'] };
  // goods：加在指定物品后
  if (scope === 'goods') {
    if (!gitem) return { ok: false, log: ['错误: 未填写目标物品（加在哪个物品后）'] };
    if (!gnew) return { ok: false, log: ['错误: 未填写追加物品'] };
    let n = rate || 0;
    if (cat === 'range') n = lib.randRate(rs || 10, re || 100);
    const res = lib.addAfterItem(root, gitem, gnew, n, count || 1, cat === 'child' || cat === 'range');
    if (res.length === 0) return { ok: false, log: ['全服未找到物品「' + gitem + '」的掉落，无法追加'] };
    const log = ['—— 已在 ' + res.length + ' 处「' + gitem + '」后追加 ——'];
    for (const x of res.slice(0, 20)) log.push('  ✓ ' + x.mon + ' → ' + x.line);
    if (res.length > 20) log.push('  ... 共 ' + res.length + ' 处');
    return { ok: true, log };
  }
  if (!item) return { ok: false, log: ['错误: 未填写物品名'] };
  const monList = resolveMons(root, scope, mon, mapCode);
  if (scope === 'all' && monList.length === 0) return { ok: false, log: ['未找到爆率文件（期望 Mir200\\\\Envir\\\\MonItems\\\\*.txt）'] };
  if (scope === 'map' && monList.length === 0) return { ok: false, log: ['MonGen.txt 中未找到地图 ' + mapCode + ' 的怪物'] };
  if (scope === 'mon' && !mon) return { ok: false, log: ['错误: 未填写怪物名'] };
  return runOnMons(root, monList, m => {
    if (op === 'del') {
      const rr = lib.delRate(root, m, item);
      return { msg: (rr.removed > 0 ? '✓ ' : '· ') + m + ': 删除 ' + item + ' ' + (rr.removed || 0) + ' 条（剩 ' + rr.total + '）' };
    }
    let n = rate || 0;
    if (cat === 'range') n = lib.randRate(rs || 10, re || 100);
    if (cat === 'child' || cat === 'range') {
      const { file, items } = lib.readMonFile(root, m);
      items.push({ kind: 'child', num: 1, rate: n, flag: 'RANDOM', cond: null, raw: '' });
      lib.writeMonFile(root, m, items);
      return { msg: '✓ ' + m + ': 追加 #CHILD 1/' + n + (count > 1 ? ' x' + count : '') + '（共 ' + items.filter(x => x.kind !== 'blank').length + ' 条）' };
    }
    const rr = lib.addRate(root, m, item, n, count || 1, true);
    return { msg: '✓ ' + m + ': 追加 ' + item + ' 1/' + n + (count > 1 ? ' x' + count : '') + '（共 ' + rr.total + ' 条）' };
  });
});

`;
m = m.replace(oldHandler, newHandler);
fs.writeFileSync('main.js', m);
console.log('main.js 已更新 do-op');
// 语法检查
require('child_process').execSync('node --check main.js', { stdio: 'inherit' });
console.log('语法 OK');
