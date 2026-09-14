const fs = require('fs'), iconv = require('./rate-gui/元歌工具箱/resources/app/node_modules/iconv-lite');
// 1. 商店.txt 里 虾米飞走 调用上下文
const s = iconv.decode(fs.readFileSync('D:/cqzs/Mirserver怀念毕业端/Mir200/Envir/QuestDiary/商店功能/商店.txt'), 'gbk');
const calls = [...s.matchAll(/#CALL[^\r\n]*@虾米飞走[^\r\n]*/g)];
console.log('=== 商店.txt 调用 @虾米飞走 ===');
calls.forEach(c => console.log('  ' + c[0].trim()));
// 找段头（调用所在段）
const lines = s.split(/\r?\n/);
let cur = '';
for (const l of lines) {
  const m = l.match(/^\[@([^\]]+)\]/);
  if (m) cur = m[1];
  if (l.includes('虾米飞走') && !l.includes('[@')) console.log('  [' + cur + '] ' + l.trim());
}
