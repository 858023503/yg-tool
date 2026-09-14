const fs = require('fs'), iconv = require('./rate-gui/元歌工具箱/resources/app/node_modules/iconv-lite');
// 副本端登录器怀念
const copyL = 'D:/cqzs/Mirserver怀念毕业端 - 副本/登录器怀念';
console.log('=== 副本端登录器怀念 ===');
console.log('文件:', fs.existsSync(copyL) ? fs.readdirSync(copyL).join(', ') : '不存在');
for (const f of ['pak.txt', 'Map.txt', 'Wav.txt', 'Wil.txt', 'Wzl.txt']) {
  const p = copyL + '/' + f;
  if (fs.existsSync(p)) {
    const c = iconv.decode(fs.readFileSync(p), 'gbk');
    const lines = c.split(/\r?\n/).filter(l => l.trim());
    console.log('\n' + f + ' (' + lines.length + ' 行):');
    lines.slice(0, 5).forEach(l => console.log('  ' + l.trim().slice(0, 100)));
    if (lines.length > 5) console.log('  ...');
  }
}
// 主端 pak.txt（正确参考）
const mainL = 'D:/cqzs/Mirserver怀念毕业端/登录器怀念/pak.txt';
if (fs.existsSync(mainL)) {
  const c = iconv.decode(fs.readFileSync(mainL), 'gbk');
  const lines = c.split(/\r?\n/).filter(l => l.trim());
  console.log('\n=== 主端 pak.txt (' + lines.length + ' 行) ===');
  lines.slice(0, 8).forEach(l => console.log('  ' + l.trim().slice(0, 110)));
}
// 传奇本地版本（别的版本参考）
const lc = 'D:/传奇本地版本';
console.log('\n=== 传奇本地版本 ===');
if (fs.existsSync(lc)) console.log('目录:', fs.readdirSync(lc).slice(0, 15).join(', '));
