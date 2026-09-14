// GUI 加脚本搜索面板
const fs = require('fs');
const path = require('path');
const appDir = __dirname;

// ---- index.html ----
let h = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
h = h.replace(
  '<button data-tab="currency" id="tab-currency">货币消耗</button>',
  '<button data-tab="currency" id="tab-currency">货币消耗</button>\n      <button data-tab="search" id="tab-search">脚本搜索</button>'
);
h = h.replace(
  '    </div>\n  </div>\n</body>',
  `    </div>
    <!-- ===== 脚本搜索替换 ===== -->
    <div class="panel" id="panel-search" style="display:none;">
      <h3>脚本搜索替换（Envir）</h3>
      <div class="row">
        <label>搜索目录</label>
        <input type="text" id="s-dir" placeholder="例如 D:\\Mirserver怀念毕业端\\Mir200\\Envir">
        <button id="s-browse">选择</button>
      </div>
      <div class="row">
        <label>搜索内容</label>
        <input type="text" id="s-search" placeholder="请输入或选择搜索内容">
        <label style="min-width:auto;"><input type="checkbox" id="s-case" checked> 区分大小写</label>
        <label style="min-width:auto;"><input type="checkbox" id="s-child" checked> 包含子目录</label>
      </div>
      <div class="row">
        <label>替换为</label>
        <input type="text" id="s-replace" placeholder="留空=删除匹配内容（替换模式）">
        <label style="min-width:auto;">文件类型</label>
        <input type="text" id="s-type" value=".txt" style="width:80px;">
      </div>
      <div class="row">
        <button class="btn-primary" id="s-run" style="margin-left:102px;">搜索</button>
        <button class="btn-danger" id="s-replace-btn" style="margin-left:8px;">替换</button>
        <span class="hint" style="margin-left:12px;">替换会写回文件，建议先备份</span>
      </div>
      <div class="box" id="s-out" style="white-space:pre;font-family:Consolas,monospace;font-size:12px;max-height:320px;overflow:auto;"></div>
    </div>
  </div>
</body>`
);
fs.writeFileSync(path.join(appDir, 'index.html'), h);
console.log('index.html 已加搜索面板');

// ---- renderer.js ----
let r = fs.readFileSync(path.join(appDir, 'renderer.js'), 'utf8');
r = r.replace(
  "['adjust', 'random', 'mongen', 'currency']",
  "['adjust', 'random', 'mongen', 'currency', 'search']"
);
r += `
// ===== 脚本搜索面板 =====
$('s-browse').onclick = async () => {
  const d = await window.api.pickDir();
  if (d) $('s-dir').value = d;
};
const sOpts = () => ({
  dir: $('s-dir').value.trim(),
  search: $('s-search').value,
  replace: $('s-replace').value,
  isCase: $('s-case').checked,
  isChildren: $('s-child').checked,
  types: [$('s-type').value.trim() || '.txt']
});
$('s-run').onclick = async () => {
  const o = sOpts();
  if (!o.dir || !o.search) return out('s-out', '请填写搜索目录和搜索内容');
  out('s-out', '搜索中...');
  const r = await window.api.scriptSearch(o);
  out('s-out', r.log.join('\\n'));
};
$('s-replace-btn').onclick = async () => {
  const o = sOpts();
  if (!o.dir || !o.search) return out('s-out', '请填写搜索目录和搜索内容');
  if (o.replace === '' && !confirm('替换内容为空，确定继续替换？（等于删除匹配内容）')) return;
  out('s-out', '替换中...');
  const r = await window.api.scriptReplace(o);
  out('s-out', r.log.join('\\n'));
};
`;
fs.writeFileSync(path.join(appDir, 'renderer.js'), r);
console.log('renderer.js 已加搜索逻辑');

// ---- preload.js ----
let p = fs.readFileSync(path.join(appDir, 'preload.js'), 'utf8');
p = p.replace(
  'currencyReport: (root, opts) => ipcRenderer.invoke(\'currency-report\', { root, opts }),',
  `currencyReport: (root, opts) => ipcRenderer.invoke('currency-report', { root, opts }),
    scriptSearch: (o) => ipcRenderer.invoke('script-search', o),
    scriptReplace: (o) => ipcRenderer.invoke('script-replace', o),`
);
fs.writeFileSync(path.join(appDir, 'preload.js'), p);
console.log('preload.js 已加搜索 API');

// ---- main.js ----
let m = fs.readFileSync(path.join(appDir, 'main.js'), 'utf8');
m = m.replace(
  "ipcMain.handle('currency-report'",
  `ipcMain.handle('script-search', (e, o) => {
  if (!o.dir) return { log: ['错误: 未填写搜索目录'] };
  const r = lib.searchScripts('', o);
  if (!r.ok) return { log: [r.msg] };
  const log = ['=== 搜索「' + o.search + '」===', '目录: ' + r.dir, '共 ' + r.total + ' 处匹配 / ' + r.results.length + ' 个文件:'];
  for (const x of r.results.slice(0, 40)) {
    log.push('  ' + x.rel + ' (' + x.count + ' 处): 行 ' + x.lines.slice(0, 12).join(','));
    if (x.lines.length > 12) log.push('     ...');
  }
  if (r.results.length > 40) log.push('  ... 共 ' + r.results.length + ' 个文件');
  return { log };
});

ipcMain.handle('script-replace', (e, o) => {
  if (!o.dir) return { log: ['错误: 未填写搜索目录'] };
  const r = lib.replaceScripts('', o);
  if (!r.ok) return { log: [r.msg] };
  const log = ['=== 替换完成 ===', '目录: ' + r.dir, '共替换 ' + r.total + ' 处 / ' + r.results.length + ' 个文件:'];
  for (const x of r.results.slice(0, 40)) log.push('  ' + x.rel + ': ' + x.replaced + ' 处');
  if (r.results.length > 40) log.push('  ... 共 ' + r.results.length + ' 个文件');
  return { log };
});

ipcMain.handle('currency-report'`
);
fs.writeFileSync(path.join(appDir, 'main.js'), m);
require('child_process').execSync('node --check main.js', { stdio: 'inherit' });
console.log('main.js 已加搜索 IPC，语法 OK');
