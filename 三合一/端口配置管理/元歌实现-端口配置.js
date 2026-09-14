function readPortConfig(engineRoot) {
  const files = [];
  const seen = new Set();
  for (const s of PORT_CFG_FILES) {
    const f = path.join(engineRoot, s.dir, s.file);
    if (!fs.existsSync(f)) continue;
    let content;
    try { content = decodeBuf(fs.readFileSync(f)); } catch (e) { continue; }
    const lines = content.split(/\r?\n/);
    const entries = [];
    lines.forEach((line, idx) => {
      // 严格匹配大写 Port 键，排除 Support 类误匹配（TZSupportRenameItem）
      const m = line.match(/^([A-Za-z0-9_]*Port[A-Za-z0-9_]*)\s*=\s*(\d+)/);
      if (m && !/support/i.test(m[1])) {
        const port = parseInt(m[2], 10);
        if (port > 0 && port < 65536) {
          entries.push({ key: m[1], port, line: idx });
        }
      }
    });
    if (entries.length) files.push({ file: s.dir ? s.dir + '/' + s.file : s.file, label: s.label, entries, content });
  }
  const all = [];
  for (const f of files) for (const e of f.entries) all.push({ file: f.file, label: f.label, key: e.key, port: e.port });
  return { files, all, count: all.length };
}
// 修改单个端口键：返回 { ok, msg }
function writePortConfig(engineRoot, relFile, key, newPort) {
  const f = path.join(engineRoot, relFile);
  if (!fs.existsSync(f)) return { ok: false, msg: '文件不存在: ' + relFile };
  let content;
  try { content = decodeBuf(fs.readFileSync(f)); } catch (e) { return { ok: false, msg: '读取失败: ' + e.message }; }
  const re = new RegExp('^(' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*=\\s*)\\d+', 'm');
  if (!re.test(content)) return { ok: false, msg: '未找到键: ' + key };
  const updated = content.replace(re, '$1' + newPort);
  try {
    fs.writeFileSync(f, encodeStr(updated));
    return { ok: true, msg: '已修改 ' + relFile + ' 的 ' + key + ' = ' + newPort };
  } catch (e) { return { ok: false, msg: '写入失败: ' + e.message }; }
}
// 一键替换：把所有配置文件里的旧端口替换为新端口（还原自蜗牛"冲突检测→一键替换"）
function replacePorts(engineRoot, fromPort, toPort) {
  if (!(fromPort > 0) || !(toPort > 0) || fromPort === toPort) return { ok: false, msg: '参数无效' };
  const files = [];
  for (const s of PORT_CFG_FILES) {
    const f = path.join(engineRoot, s.dir, s.file);
    if (!fs.existsSync(f)) continue;
    let content;
    try { content = decodeBuf(fs.readFileSync(f)); } catch (e) { continue; }
    const re = new RegExp('(=\\s*)' + fromPort + '(?![0-9])', 'g');
    if (re.test(content)) {
      const updated = content.replace(re, '$1' + toPort);
      try { fs.writeFileSync(f, encodeStr(updated)); files.push({ file: s.dir ? s.dir + '/' + s.file : s.file, count: (content.match(re) || []).length }); }
      catch (e) { /* 跳过写失败 */ }
    }
  }
  return { ok: files.length > 0, msg: files.length ? '已替换 ' + files.length + ' 个文件: ' + files.map(f => f.file + '×' + f.count).join(', ') : '未找到使用端口 ' + fromPort + ' 的配置' };
}

// 检测单个端口是否被占用

