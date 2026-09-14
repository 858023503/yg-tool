// GUI 改名"元歌工具箱" + 货币兑换面板加"一键提取货币"
const fs = require('fs');
const path = require('path');
const appDir = __dirname;

// 1. index.html
let h = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
h = h.replace('⚙ 爆率修改工具', '⚙ 元歌工具箱');
h = h.replace('传奇引擎工具箱 · 还原自蜗牛实用工具', '传奇服务端工具箱');
h = h.replace('<title>爆率修改工具</title>', '<title>元歌工具箱</title>');
// 货币兑换面板加提取按钮（在"消耗"下拉前加一行）
h = h.replace(
  '      <div class="row">\n        <label>消耗</label>',
  '      <div class="row">\n        <button class="btn-default" id="x-extract">🔍 一键提取全服货币</button>\n        <span class="hint">扫描 Envir 脚本提取所有货币名（各版本货币命名不同）</span>\n      </div>\n      <div class="row">\n        <label>消耗</label>'
);
fs.writeFileSync(path.join(appDir, 'index.html'), h);
console.log('index.html 已改名 + 提取按钮');

// 2. renderer.js
let r = fs.readFileSync(path.join(appDir, 'renderer.js'), 'utf8');
// 提取货币：填充 x-from 下拉
r += `
// ===== 一键提取全服货币 =====
$('x-extract').onclick = async () => {
  const root = $('root').value.trim();
  if (!root) return appendLog('请先选择引擎根目录', 'err');
  const r = await window.api.extractCurrencies(root);
  out('x-out', r.log.join('\\n'));
  if (r.currencies && r.currencies.length) {
    const sel = $('x-from');
    // 保留前3个内置 + 追加提取的货币
    const builtin = ['金币', '元宝', '金刚石', '灵符', '声望', '荣誉'];
    for (const c of r.currencies) {
      if (!builtin.includes(c.name)) {
        const opt = document.createElement('option');
        opt.value = 'diy';
        opt.textContent = c.name + '（变量）';
        opt.dataset.var = c.name;
        sel.appendChild(opt);
      }
    }
    appendLog('已把提取的 ' + r.currencies.length + ' 种货币加入下拉（选择后填变量名）');
  }
};
`;
fs.writeFileSync(path.join(appDir, 'renderer.js'), r);
console.log('renderer.js 已加提取逻辑');

// 3. preload.js
let p = fs.readFileSync(path.join(appDir, 'preload.js'), 'utf8');
p = p.replace(
  '  dynamicSpawn: (o) => ipcRenderer.invoke(\'dynamic-spawn\', o),',
  `  dynamicSpawn: (o) => ipcRenderer.invoke('dynamic-spawn', o),
  extractCurrencies: (root) => ipcRenderer.invoke('extract-currencies', root),`
);
fs.writeFileSync(path.join(appDir, 'preload.js'), p);
console.log('preload.js 已加提取 API');

// 4. main.js（窗口标题 + IPC）
let m = fs.readFileSync(path.join(appDir, 'main.js'), 'utf8');
m = m.replace("title: '爆率修改工具'", "title: '元歌工具箱'");
m = m.replace("'爆率修改工具'", "'元歌工具箱'");
m = m.replace(
  "ipcMain.handle('mg-adjust'",
  `ipcMain.handle('extract-currencies', (e, root) => {
  if (!root) return { log: ['错误: 未选择引擎根目录'] };
  const r = lib.extractCurrencies(root);
  if (!r.ok) return { log: [r.msg] };
  const log = ['=== 一键提取全服货币（' + r.total + ' 种）==='];
  for (const c of r.currencies.slice(0, 40)) log.push('  ' + c.name + '（' + c.count + '次/' + c.fileCount + '文件）');
  if (r.currencies.length > 40) log.push('  ... 共 ' + r.currencies.length + ' 种');
  return { log, currencies: r.currencies };
});

ipcMain.handle('mg-adjust'`
);
fs.writeFileSync(path.join(appDir, 'main.js'), m);
console.log('main.js 已改名 + 提取 IPC');
