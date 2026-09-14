const fs = require('fs'), iconv = require('./rate-gui/元歌工具箱/resources/app/node_modules/iconv-lite');
// 1. 主端 QF 里 虾米飞走（上下文 + 谁调用）
const qf = iconv.decode(fs.readFileSync('D:/cqzs/Mirserver怀念毕业端/Mir200/Envir/Market_Def/QFunction-0.txt'), 'gbk');
const i = qf.indexOf('[@虾米飞走]');
console.log('=== QF [@虾米飞走] 段 ===');
console.log(i >= 0 ? qf.slice(i, i + 250) : 'QF 无');
// 调用方（#CALL ... @虾米飞走）
const calls = [...qf.matchAll(/#CALL[^\r\n]*@虾米飞走/g)];
console.log('\nQF 内调用 @虾米飞走 处数:', calls.length);
calls.slice(0, 3).forEach(c => console.log('  ' + c[0].trim()));
// 2. droprate.html 列标题
const dt = fs.readFileSync('rate-tool/site-template/droprate.html', 'utf8');
console.log('\n=== droprate.html 列标题 ===');
for (const m of dt.matchAll(/<span id="h\d"[^>]*>([^<]*)<\/span><small id="h\d s"[^>]*><\/small>/g)) console.log('  ' + m[1]);
for (const m of dt.matchAll(/colTitle"><span id="(h\d)"><\/span>/g)) console.log('  空标题 id=' + m[1]);
