const fs = require('fs'), iconv = require('./rate-gui/元歌工具箱/resources/app/node_modules/iconv-lite');
const lib = require('./rate-tool/lib.js');
lib.setIconv(iconv);
const root = 'D:/cqzs/Mirserver怀念毕业端';
// 1. readMonFile 万年树妖.txt 解析
const rf = lib.readMonFile(root, '万年树妖');
console.log('=== readMonFile(万年树妖) ===');
console.log('items:', JSON.stringify(rf.items).slice(0, 300));
// 2. exportSiteData 里 monsters 万年树妖
const d = lib.exportSiteData(root);
const mon = d.monsters.find(m => m.monster === '万年树妖');
console.log('\nmonsters 含万年树妖:', !!mon);
if (mon) console.log('万年树妖 items:', mon.items.map(i => i.name + '(den=' + i.den + ',组' + i.group_den + ')').join(' | '));
// 3. 书页出处（万年树妖 在？）
const sy = d.item_drops['书页'];
console.log('\n书页出处数:', sy ? sy.length : 0);
if (sy) {
  console.log('书页出处含 万年树妖:', sy.some(([m]) => m === '万年树妖'));
  console.log('书页出处样例(前10):', sy.slice(0, 10).map(([m, den]) => m + '(1/' + den + ')').join(', '));
}
