const fs = require('fs');
let s = fs.readFileSync('rate-tool/gen-bundle.js', 'utf8');
let n = 0;
// 1. iconv-lite/safer-buffer 来源改为便携版（extracted/ 已清理）
const old1 = "  ['iconv-lite', path.join(__dirname, '..', 'extracted', 'node_modules', 'iconv-lite')],\n  ['safer-buffer', path.join(__dirname, '..', 'extracted', 'node_modules', 'safer-buffer')],";
const new1 = "  ['iconv-lite', path.join(__dirname, '..', 'rate-gui', '元歌工具箱', 'resources', 'app', 'node_modules', 'iconv-lite')],\n  ['safer-buffer', path.join(__dirname, '..', 'rate-gui', '元歌工具箱', 'resources', 'app', 'node_modules', 'safer-buffer')],";
if (s.includes(old1)) { s = s.replace(old1, new1); n++; } else console.log('!! 锚点1');
// 2. m2-reload.ps1 改从 rate-tool 内读（顶层已清理）
const old2 = "global.__M2RELOAD_PS1 = ' + JSON.stringify(fs.readFileSync(path.join(__dirname, '..', 'm2-reload.ps1'), 'utf8')) + ';";
const new2 = "global.__M2RELOAD_PS1 = ' + JSON.stringify(fs.readFileSync(path.join(__dirname, 'm2-reload.ps1'), 'utf8')) + ';";
if (s.includes(old2)) { s = s.replace(old2, new2); n++; } else console.log('!! 锚点2');
fs.writeFileSync('rate-tool/gen-bundle.js', s);
console.log('完成 ' + n + ' 处');
