// 同步 GUI 便携版（rate-gui/元歌工具箱/resources/app/）
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, 'rate-gui', 'app');
const dst = path.join(__dirname, 'rate-gui', '元歌工具箱', 'resources', 'app');
const files = ['index.html', 'renderer.js', 'preload.js', 'main.js', 'lib.js'];
let ok = 0;
for (const f of files) {
  fs.copyFileSync(path.join(src, f), path.join(dst, f));
  ok++;
}
// 模板也同步
const tpl = 'site-template/droprate.html';
for (const d of [path.join(dst, 'site-template'), path.join(__dirname, 'rate-gui', '元歌工具箱', 'resources', 'site-template')]) {
  fs.mkdirSync(d, { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'rate-tool', tpl), path.join(d, 'droprate.html'));
}
// 校验一致性
let same = 0;
for (const f of files) {
  if (fs.readFileSync(path.join(src, f)).equals(fs.readFileSync(path.join(dst, f)))) same++;
}
console.log('便携版同步:', ok, '文件一致', same, '/', files.length);
