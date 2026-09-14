const fs = require('fs');
let r = fs.readFileSync('rate-gui/app/renderer.js', 'utf8');
const old = "mapview: '按地图查看', itemfind: '物品产出查询',";
const neu = "mapview: '按地图查看',";
if (r.includes(old)) { r = r.replace(old, neu); fs.writeFileSync('rate-gui/app/renderer.js', r); console.log('✓ navLabels 删 itemfind'); }
else { const i = r.indexOf('itemfind:'); console.log('!! 未匹配，实际:', r.slice(i - 60, i + 40)); }
