// 更新 renderer.js：三个 panel 支持 map 范围
const fs = require('fs');
let r = fs.readFileSync('renderer.js', 'utf8');

// ① 爆率调整 scope 选择器加 map 行切换
r = r.replace(
  "wireSeg('scope-seg', d => { scope = d.scope; $('row-mon').style.display = scope === 'mon' ? 'flex' : 'none'; });",
  "wireSeg('scope-seg', d => { scope = d.scope; $('row-mon').style.display = scope === 'mon' ? 'flex' : 'none'; $('row-map').style.display = scope === 'map' ? 'flex' : 'none'; });"
);
// ① 执行时传 map 代码
r = r.replace(
  "const r = await window.api.doOp({ root, scope, mon, op, item, rate, count, cat });",
  "const r = await window.api.doOp({ root, scope, mon, mapCode: $('map').value.trim(), op, item, rate, count, cat });"
);
// ② 批量调整
r = r.replace(
  "wireSeg('bulk-scope-seg', d => { bscope = d.bs; $('row-bmon').style.display = bscope === 'mon' ? 'flex' : 'none'; });",
  "wireSeg('bulk-scope-seg', d => { bscope = d.bs; $('row-bmon').style.display = bscope === 'mon' ? 'flex' : 'none'; $('row-bmap').style.display = bscope === 'map' ? 'flex' : 'none'; });"
);
r = r.replace(
  "const r = await window.api.doBulk({ root, scope: bscope, mon, opt });",
  "const r = await window.api.doBulk({ root, scope: bscope, mon, mapCode: $('bmap').value.trim(), opt });"
);
// ③ 随机转换
r = r.replace(
  "wireSeg('rnd-scope-seg', d => { rscope = d.rs; $('row-rmon').style.display = rscope === 'mon' ? 'flex' : 'none'; });",
  "wireSeg('rnd-scope-seg', d => { rscope = d.rs; $('row-rmon').style.display = rscope === 'mon' ? 'flex' : 'none'; $('row-rmap').style.display = rscope === 'map' ? 'flex' : 'none'; });"
);
r = r.replace(
  "const r = await window.api.doRandom({ root, scope: rscope, mon, opt });",
  "const r = await window.api.doRandom({ root, scope: rscope, mon, mapCode: $('rmap').value.trim(), opt });"
);
fs.writeFileSync('renderer.js', r);
console.log('renderer.js 更新完成');
