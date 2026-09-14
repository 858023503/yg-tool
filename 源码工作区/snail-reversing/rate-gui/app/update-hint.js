// 更新 GUI 目录提示文案
const fs = require('fs');
let h = fs.readFileSync('index.html', 'utf8');
h = h.replace(
  'placeholder="例如 D:\\MirServer（含 Mir200\\Envir\\MonItems）"',
  'placeholder="服务端根/Mir200/Envir 任一层都行，如 D:\\MirServer"'
);
h = h.replace(
  '<div class="sub">传奇引擎 MonItems 爆率管理 · 功能与算法还原自蜗牛实用工具 6.3.2</div>',
  '<div class="sub">传奇引擎 MonItems 爆率管理 · 选目录：服务端根 / Mir200 / Envir 任一层都行</div>'
);
fs.writeFileSync('index.html', h);
console.log('提示已更新');
