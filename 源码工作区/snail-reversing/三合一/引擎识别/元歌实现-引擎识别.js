const ENGINE_SIGS = [
  ['GEEPAK3', 'GEE引擎(微端)'], ['GEEPAK2', 'GEE引擎'], ['GEEM2LP', 'GEE引擎(连服)'], ['GEEM2', 'GEE引擎'],
  ['GAMEOFMIR2', 'GOM引擎'], ['GAMEOFMIR', 'GOM引擎(老)'], ['D3DM2', 'D3D引擎'], ['MIRYQ', 'MirYQ引擎'],
  ['ssNGom', 'ssNGom引擎'], ['996M2', '996引擎'], ['BLUEM2', 'Blue引擎'],
];
function detectEngine(engineRoot) {
  const f = path.join(engineRoot, 'Mir200', 'M2Server.exe');
  if (!fs.existsSync(f)) return { ok: false, engine: '未知', msg: '未找到 Mir200/M2Server.exe' };
  let ascii;
  try { ascii = fs.readFileSync(f).toString('latin1'); }
  catch (e) { return { ok: false, engine: '未知', msg: '读取失败: ' + e.message }; }
  for (const [sig, name] of ENGINE_SIGS) {
    if (ascii.includes(sig)) return { ok: true, engine: name, sig, file: f };
  }
  // 兜底：读版本信息辅助判断（翎风等新引擎无特征串）
  let ver = '';
  try { ver = require('child_process').execSync('powershell -NoProfile -Command "(Get-Item \'' + f.replace(/'/g, "''") + '\').VersionInfo.FileVersion"', { encoding: 'utf8', timeout: 5000 }).trim(); } catch (e) { /* 忽略 */ }
  return { ok: true, engine: '未知引擎（可能为翎风/LF 系）', sig: null, file: f, fileVersion: ver || null };
}
// 服务端配置健检：目录键存在性 + 端口一致性
const SETUP_DIR_KEYS = ['BaseDir', 'BoxsDir', 'CastleDir', 'ChatDir', 'ConLogDir', 'LogDir', 'GuildDir', 'NoticeDir'];
function checkServerConfig(engineRoot) {
  const issues = [];
  const checks = [];
  const eng = detectEngine(engineRoot);
  checks.push({ name: '引擎识别', ok: eng.ok, detail: eng.engine + (eng.sig ? '（特征 ' + eng.sig + '）' : '') });
  const setup = path.join(engineRoot, 'Mir200', '!setup.txt');
  if (fs.existsSync(setup)) {
    const content = decodeBuf(fs.readFileSync(setup));
    for (const key of SETUP_DIR_KEYS) {
      const m = content.match(new RegExp('^' + key + '\\s*=\\s*(.+)$', 'm'));
      if (m) {
        const val = m[1].trim();
        const ok = fs.existsSync(val) || fs.existsSync(path.join(engineRoot, val.replace(/^\\/, ''))) || fs.existsSync(path.join(engineRoot, 'Mir200', val.replace(/^\\/, '')));
        checks.push({ name: '目录键 ' + key, ok, detail: val });
        if (!ok) issues.push('目录键 ' + key + ' 不存在: ' + val);
      }
    }
    const getP = (key) => { const m = content.match(new RegExp('^' + key + '\\s*=\\s*(\\d+)', 'm')); return m ? parseInt(m[1], 10) : null; };
    const dbPort = getP('DBPort');
    const dbs = path.join(engineRoot, 'DBServer', 'dbsrc.ini');
    if (dbPort && fs.existsSync(dbs)) {
      const dc = decodeBuf(fs.readFileSync(dbs));
      const dm = dc.match(/^ServerPort\\s*=\\s*(\\d+)/m);
      if (dm && parseInt(dm[1], 10) !== dbPort) {
        issues.push('!setup.txt DBPort=' + dbPort + ' 与 DBServer ServerPort=' + dm[1] + ' 不一致');
        checks.push({ name: 'DB 端口一致性', ok: false, detail: '!setup=' + dbPort + ' / DBServer=' + dm[1] });
      } else {
        checks.push({ name: 'DB 端口一致性', ok: true, detail: 'DBPort=' + dbPort });
      }
    }
  } else {
    issues.push('未找到 Mir200/!setup.txt');
    checks.push({ name: '目录键', ok: false, detail: '未找到 !setup.txt' });
  }
  return { ok: issues.length === 0, checks, issues, engine: eng };
}
