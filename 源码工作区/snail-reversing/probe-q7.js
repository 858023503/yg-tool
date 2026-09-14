const fs = require('fs'), iconv = require('./rate-gui/元歌工具箱/resources/app/node_modules/iconv-lite');
// 1. 主端 QF 无虾米飞走——搜其他文件（QF/QM/QuestDiary）
const root = 'D:/cqzs/Mirserver怀念毕业端/Mir200/Envir';
function grepDir(dir, kw, deep) {
  if (deep > 2) return [];
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    const p = dir + '/' + f;
    if (fs.statSync(p).isDirectory()) out.push(...grepDir(p, kw, deep + 1));
    else if (f.endsWith('.txt')) {
      try {
        const c = iconv.decode(fs.readFileSync(p), 'gbk');
        if (c.includes(kw)) out.push(p.replace(root, ''));
      } catch (e) {}
    }
  }
  return out;
}
console.log('含「虾米飞走」的文件:', grepDir(root, '虾米飞走', 0).slice(0, 10));
console.log('含「SCRIPTPARAM」的文件数:', grepDir(root, 'SCRIPTPARAM', 0).length, '| 样例:', grepDir(root, 'SCRIPTPARAM', 0).slice(0, 5));
