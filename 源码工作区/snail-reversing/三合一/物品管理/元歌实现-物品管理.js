function itemDescFile(engineRoot, top) {
  return path.join(engineRoot, 'Mir200', 'Envir', top ? 'ItemDescTopList.txt' : 'ItemDescList.txt');
}
// 物品备注格式：物品名=\颜色码/文本\颜色码/文本（\243 灰 \249 黄 \251 绿 \253 蓝 等）
function parseItemDescSegs(desc) {
  const segs = [];
  const re = /\\(\d+)\/([^\\]*)/g;
  let m;
  while ((m = re.exec(desc))) segs.push({ color: m[1], text: m[2] });
  if (!segs.length && desc) segs.push({ color: '243', text: desc });
  return segs;
}
function readItemDesc(engineRoot, top) {
  const f = itemDescFile(engineRoot, top);
  if (!fs.existsSync(f)) return { file: f, exists: false, items: [], count: 0 };
  const content = decodeBuf(fs.readFileSync(f));
  const items = [];
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith(';')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const name = line.slice(0, eq).trim();
    const desc = line.slice(eq + 1);
    items.push({ name, raw: desc, segs: parseItemDescSegs(desc) });
  }
  return { file: f, exists: true, items, count: items.length };
}
function writeItemDesc(engineRoot, top, items) {
  const lines = items.map(it => it.name + '=' + (it.raw !== undefined ? it.raw : it.segs.map(sg => '\\' + sg.color + '/' + sg.text).join('')));
  fs.writeFileSync(itemDescFile(engineRoot, top), encodeStr(lines.join('\r\n')));
  return { ok: true, count: items.length };
}
function addItemDesc(engineRoot, top, name, color, text) {
  const r = readItemDesc(engineRoot, top);
  const exists = r.items.find(x => x.name === name);
  if (exists) return { ok: false, msg: '已存在备注: ' + name };
  r.items.push({ name, segs: [{ color: color || '243', text: text || '' }] });
  writeItemDesc(engineRoot, top, r.items);
  return { ok: true, msg: '已添加 ' + name + ' 的备注' };
}
function delItemDesc(engineRoot, top, name) {
  const r = readItemDesc(engineRoot, top);
  const before = r.items.length;
  r.items = r.items.filter(x => x.name !== name);
  if (r.items.length === before) return { ok: false, msg: '未找到: ' + name };
  writeItemDesc(engineRoot, top, r.items);
  return { ok: true, msg: '已删除 ' + name };
}
// 物品解包 UnbindList.txt：物品ID 物品名
function readUnbindList(engineRoot) {
  const f = path.join(engineRoot, 'Mir200', 'Envir', 'UnbindList.txt');
  if (!fs.existsSync(f)) return { file: f, exists: false, items: [], count: 0 };
  const items = [];
  for (const line of decodeBuf(fs.readFileSync(f)).split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith(';')) continue;
    const m = t.match(/^(\d+)\s+(.+)$/);
    if (m) items.push({ id: parseInt(m[1], 10), name: m[2].trim() });
  }
  return { file: f, exists: true, items, count: items.length };
}
function writeUnbindList(engineRoot, items) {
  const lines = items.map(x => x.id + '\t' + x.name);
  fs.writeFileSync(path.join(engineRoot, 'Mir200', 'Envir', 'UnbindList.txt'), encodeStr(lines.join('\r\n')));
  return { ok: true, count: items.length };
}
function addUnbindItem(engineRoot, id, name) {
  const r = readUnbindList(engineRoot);
  if (r.items.find(x => x.id === parseInt(id, 10))) return { ok: false, msg: '已存在 ID: ' + id };
  r.items.push({ id: parseInt(id, 10), name });
  writeUnbindList(engineRoot, r.items);
  return { ok: true, msg: '已添加解包 ' + id + ' ' + name };
}
function delUnbindItem(engineRoot, id) {
  const r = readUnbindList(engineRoot);
  const before = r.items.length;
  r.items = r.items.filter(x => x.id !== parseInt(id, 10));
  if (r.items.length === before) return { ok: false, msg: '未找到 ID: ' + id };
  writeUnbindList(engineRoot, r.items);
  return { ok: true, msg: '已删除解包 ' + id };
}
// 系统商铺 ShopItemList.txt：类型 物品名 价格 数量|... 说明
function readShopList(engineRoot) {
  const f = path.join(engineRoot, 'Mir200', 'Envir', 'ShopItemList.txt');
  if (!fs.existsSync(f)) return { file: f, exists: false, items: [], count: 0 };
  const items = [];
  for (const line of decodeBuf(fs.readFileSync(f)).split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith(';')) continue;
    const parts = t.split('\t');
    if (parts.length >= 2) items.push({ shopType: parts[0].trim(), name: parts[1].trim(), raw: line, parts });
  }
  return { file: f, exists: true, items, count: items.length };
}
// 物品套装 GroupItemList.txt（复杂格式，读+展示）

