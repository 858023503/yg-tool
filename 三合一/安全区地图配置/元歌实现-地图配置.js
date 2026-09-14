function readStartPoint(engineRoot) {
  const f = path.join(engineRoot, 'Mir200', 'Envir', 'StartPoint.txt');
  if (!fs.existsSync(f)) return { file: f, exists: false, rows: [], count: 0 };
  const rows = [];
  for (const line of decodeBuf(fs.readFileSync(f)).split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith(';')) continue;
    const p = t.split(/\s+/);
    if (p.length >= 5) {
      rows.push({ map: p[0], x: parseInt(p[1], 10), y: parseInt(p[2], 10), range: parseInt(p[3], 10), type: parseInt(p[4], 10), extra: p.slice(5), raw: line });
    }
  }
  return { file: f, exists: true, rows, count: rows.length };
}
function writeStartPoint(engineRoot, rows) {
  const lines = rows.map(r => r.raw !== undefined ? r.raw : [r.map, r.x, r.y, r.range || 0, r.type || 0].concat(r.extra || []).join('  '));
  fs.writeFileSync(path.join(engineRoot, 'Mir200', 'Envir', 'StartPoint.txt'), encodeStr(lines.join('\r\n')));
  return { ok: true, count: rows.length };
}
function addStartPoint(engineRoot, map, x, y, range, type) {
  const r = readStartPoint(engineRoot);
  r.rows.push({ map, x, y, range: range || 0, type: type || 0, extra: [] });
  writeStartPoint(engineRoot, r.rows);
  return { ok: true, msg: '已添加安全区 ' + map + ' ' + x + ',' + y };
}
function delStartPoint(engineRoot, map, x, y) {
  const r = readStartPoint(engineRoot);
  const before = r.rows.length;
  r.rows = r.rows.filter(row => !(row.map === map && row.x === x && row.y === y));
  if (r.rows.length === before) return { ok: false, msg: '未找到 ' + map + ' ' + x + ',' + y };
  writeStartPoint(engineRoot, r.rows);
  return { ok: true, msg: '已删除 ' + map + ' ' + x + ',' + y };
}
// 地图配置 MapInfo.txt：[地图|标题 属性] + 传送门
function readMapInfo(engineRoot) {
  const f = path.join(engineRoot, 'Mir200', 'Envir', 'MapInfo.txt');
  if (!fs.existsSync(f)) return { file: f, exists: false, maps: [], links: [], count: 0 };
  const maps = [], links = [];
  for (const line of decodeBuf(fs.readFileSync(f)).split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith(';')) continue;
    const mm = t.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (mm) {
      const head = mm[1].trim();
      const props = mm[2].trim();
      const bar = head.indexOf('|');
      maps.push({ code: (bar >= 0 ? head.slice(0, bar) : head).trim(), title: (bar >= 0 ? head.slice(bar + 1) : '').trim(), props, raw: line });
    } else {
      const lm = t.match(/^(\S+)\s+([\d,]+)\s*->\s*(\S+)\s+([\d,]+)/);
      if (lm) links.push({ from: lm[1], fromXY: lm[2], to: lm[3], toXY: lm[4], raw: line });
    }
  }
  return { file: f, exists: true, maps, links, count: maps.length + links.length };
}
// 小地图 MiniMap.txt：地图 编号
function readMiniMap(engineRoot) {
  const f = path.join(engineRoot, 'Mir200', 'Envir', 'MiniMap.txt');
  if (!fs.existsSync(f)) return { file: f, exists: false, rows: [], count: 0 };
  const rows = [];
  for (const line of decodeBuf(fs.readFileSync(f)).split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith(';')) continue;
    const p = t.split(/\s+/);
    if (p.length >= 2) rows.push({ map: p[0], id: p[1], raw: line });
  }
  return { file: f, exists: true, rows, count: rows.length };
}
function writeMiniMap(engineRoot, rows) {
  const lines = rows.map(r => r.raw !== undefined ? r.raw : r.map + ' ' + r.id);
  fs.writeFileSync(path.join(engineRoot, 'Mir200', 'Envir', 'MiniMap.txt'), encodeStr(lines.join('\r\n')));
  return { ok: true, count: rows.length };
}

// ============ 引擎识别 + 参数检查（还原自虾米：M2Server.exe 特征串） ============
const ENGINE_SIGS = [
  ['GEEPAK3', 'GEE引擎(微端)'], ['GEEPAK2', 'GEE引擎'], ['GEEM2LP', 'GEE引擎(连服)'], ['GEEM2', 'GEE引擎'],
  ['GAMEOFMIR2', 'GOM引擎'], ['GAMEOFMIR', 'GOM引擎(老)'], ['D3DM2', 'D3D引擎'], ['MIRYQ', 'MirYQ引擎'],
  ['ssNGom', 'ssNGom引擎'], ['996M2', '996引擎'], ['BLUEM2', 'Blue引擎'],
];

