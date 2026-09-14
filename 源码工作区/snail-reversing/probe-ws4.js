const fs = require('fs'), iconv = require('./rate-gui/元歌工具箱/resources/app/node_modules/iconv-lite');
const lib = require('./rate-tool/lib.js');
lib.setIconv(iconv);
const root = 'D:/cqzs/Mirserver怀念毕业端';
const d = lib.exportSiteData(root);
console.log('=== 主端生成数据 ===');
console.log('怪物数:', d.monsters.length, '| 物品数(all_items):', d.all_items.length, '| item_drops 物品数:', Object.keys(d.item_drops).length);
// 万年树妖
console.log('万年树妖 item_drops:', d.item_drops['万年树妖'] ? JSON.stringify(d.item_drops['万年树妖']) : '无');
console.log('万年树妖 all_items:', d.all_items.includes('万年树妖'));
// 书页（baseline 293 出处）
const sy = d.item_drops['书页'];
console.log('书页 出处数:', sy ? sy.length : 0, '(baseline 基线=293)');
// 白野猪 掉落物品数 + 万年树妖
const byz = d.monsters.find(m => m.monster === '白野猪');
if (byz) {
  console.log('白野猪 物品数:', byz.items.length, '| 掉万年树妖:', byz.items.some(i => i.name === '万年树妖'));
  console.log('白野猪 前5物品:', byz.items.slice(0, 5).map(i => i.name + '(den=' + i.den + (i.group_den > 1 ? ',组' + i.group_den : '') + ')').join(' | '));
}
// 出处条目总数（item_drops 所有 [mon,den]）
let totalSrc = 0;
for (const arr of Object.values(d.item_drops)) totalSrc += arr.length;
console.log('出处条目总数:', totalSrc);
