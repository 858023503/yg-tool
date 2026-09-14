#!/usr/bin/env node
// 元歌工具箱 — CLI 入口（完整版）
// 用法：
//   rate-tool list <引擎根目录> [怪物名]
//   rate-tool add <引擎根目录> <怪物名|*> <物品> <概率> [数量] [--child] [--delete]
//   rate-tool del <引擎根目录> <怪物名|*> <物品>
//   rate-tool adjust <引擎根目录> <怪物名|*> <倍率> [--min N] [--max N] [--limit N] [--child]
//   rate-tool random <引擎根目录> <怪物名|*> [--min N] [--max N]
//   rate-tool map <引擎根目录> <地图代码>        查看地图刷怪
//   rate-tool find <引擎根目录> <物品名>          查询物品被哪些怪掉落
//   rate-tool backup <引擎根目录>                备份 MonItems
// 怪物名为 * 时表示全服（所有怪物文件）
const fs = require('fs');
const path = require('path');
const lib = require('./lib.js');
// 加载 GBK 编码支持（node 直接跑时 rate-tool 无 node_modules，需显式指定）
try { lib.setIconv(require('iconv-lite')); } catch (e1) {
try { lib.setIconv(require('../rate-gui/元歌工具箱/resources/app/node_modules/iconv-lite')); }
catch (e2) { try { lib.setIconv(require('../extracted/node_modules/iconv-lite')); } catch (e3) { /* bundle/SEA 已用 global.__iconvLite */ } }
}

function usage() {
  console.log(`元歌工具箱
用法:
  rate-tool list <引擎根> [怪物名]                          查看爆率
  rate-tool add <引擎根> <怪物名|*> <物品> <概率> [数量] [--child] [--after 物品] [--range 开始 结束] [--delete]
  rate-tool del <引擎根> <怪物名|*> <物品>                   删除某物品爆率
  rate-tool adjust <引擎根> <怪物名|*> <倍率> [--min N] [--max N] [--limit N] [--child]   批量调整
  rate-tool random <引擎根> <怪物名|*> [--min N] [--max N]    随机爆率转换
  rate-tool map <引擎根> <地图代码>                          查看地图刷怪
  rate-tool find <引擎根> <物品名>                           查询物品被哪些怪掉落
  rate-tool backup <引擎根>                                 备份 MonItems 目录
  rate-tool mongen list <引擎根> [地图]                       查看刷怪配置
  rate-tool mongen add <引擎根> <地图> <X> <Y> <怪> [数量] [范围] [间隔] [时间] [触发]   追加刷怪行
  rate-tool mongen del <引擎根> <地图> <怪>                   删除刷怪行
  rate-tool currency <引擎根> [--top N] [--drop-qf] [--drop-qm] [--npc]   版本货币消耗分析
  rate-tool grep <根|目录> <搜索> [--replace 内容] [--type .txt] [--nocase] [--nochildren]   脚本搜索替换
  rate-tool exchange <根> <地图> <X> <Y> <NPC名> <消耗货币> <消耗数量> <获得货币> <获得数量> [--count N]   生成货币兑换NPC
  rate-tool ports <引擎根>                                   检测服务端端口占用
  rate-tool inject <根> <名称> <QF|QM|路径> <脚本文件> [--mode append|overwrite|cancel] [--vars]   注入脚本到 QFunction/QManage
  rate-tool robot list <根>                                查看机器人脚本
  rate-tool robot add <根> <名称> <间隔> [--unit SEC|MIN|HOUR] [--type clear|spawn] [--map 地图] [--mon 怪物] [--count N] [--maps 地图1,地图2]   新增定时刷怪/清怪
  rate-tool robot del <根> <名称>                          删除机器人
  rate-tool sync <根> --host x --user x --pass x [--port 21] [--rule 本地=远程]   同步目录到远程 FTP
  rate-tool recycle <根> <地图> <X> <Y> <NPC名> <货币:gold|gamegold|diy> [货币名] --items 物品=价格,物品=价格   生成回收NPC
  rate-tool sales <根> <生成路径> [--name 数据名] [--format new|old] [--group N] [--uid 数字|字母|数字+字母]   存销系统（服务端数据打包）
  rate-tool mg-adjust <根> [--map 地图|--mon 怪] --count 倍 --time 倍 [--exd >=|<= 分钟] [--exm >=|<= 只]   原刷怪调整
  rate-tool dynamic <根> --pro 50 --count 2 --moncount 50 --intervaled 30 --interval 120 [--exmap 地图,地图] [--exmon 怪,怪]   动态刷怪配置
  rate-tool m2reload --list                             列出 M2"控制-重新载入"菜单项（需打开 M2 主窗口）
  rate-tool m2reload --item 怪物爆率 [--filter 关键字]   向 M2 发送重载命令（菜单点击，需打开 M2 主窗口）
例子:
  rate-tool list D:\\MirServer 白野猪
  rate-tool add D:\\MirServer 白野猪 屠龙 100 1           (追加: 1/100 掉 1 屠龙)
  rate-tool add D:\\MirServer * 裁决之杖 500 1             (全服追加)
  rate-tool add D:\\MirServer 白野猪 屠龙 100 2 --child    (追加 #CHILD 1/100 随机爆率)
  rate-tool adjust D:\\MirServer * 0.5 --limit 200         (全服爆率减半，上限 200)
  rate-tool random D:\\MirServer * --min 100 --max 1000    (把 100~1000 的普通爆率转随机)
  rate-tool map D:\\MirServer shuai209                     (地图刷怪)
  rate-tool find D:\\MirServer 屠龙                        (查询屠龙掉落)
`);
}

function parseOpts(args) {
  const o = { positional: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--min') o.min = parseFloat(args[++i]);
    else if (a === '--max') o.max = parseFloat(args[++i]);
    else if (a === '--limit') o.limit = parseFloat(args[++i]);
    else if (a === '--child') o.child = true;
    else if (a === '--after') o.after = args[++i];
    else if (a === '--range') { o.rs = parseFloat(args[++i]); o.re = parseFloat(args[++i]); }
    else if (a === '--delete') o.delete = true;
    else o.positional.push(a);
  }
  return o;
}

function backupDir(engineRoot) {
  const src = lib.monItemsDir(engineRoot);
  if (!fs.existsSync(src)) { console.log('目录不存在: ' + src); return; }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dst = src + '.bak-' + stamp;
  fs.cpSync(src, dst, { recursive: true });
  console.log('已备份: ' + dst);
}

async function main(argv) {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === 'help' || cmd === '-h' || cmd === '--help') return usage();
  if (cmd === 'list') {
    const [root, mon] = rest;
    if (!root) return usage();
    if (mon) {
      const { file, exists, items } = lib.readMonFile(root, mon);
      if (!exists) { console.log('无爆率文件: ' + file); return; }
      console.log('== ' + mon + ' (' + file + ') ==');
      for (const it of items) console.log('  ' + lib.serializeLine(it));
      console.log('共 ' + items.filter(x => x.kind !== 'blank').length + ' 条');
    } else {
      const mons = lib.listMonFiles(root);
      console.log('怪物爆率文件共 ' + mons.length + ' 个:');
      console.log(mons.join('\n'));
    }
    return;
  }
  if (cmd === 'backup') {
    const [root, action] = rest;
    if (!root) return usage();
    if (rest.includes('--list')) {
      const b = lib.listBackups(root);
      console.log(b.list.length ? '备份列表:\n' + b.list.map((x, i) => (i + 1) + '. ' + x).join('\n') : '暂无备份');
      return;
    }
    const ri = rest.indexOf('--restore');
    if (ri >= 0) { const name = rest[ri + 1]; console.log(lib.restoreBackup(root, name).msg); return; }
    const tag = action && !action.startsWith('--') ? action : undefined;
    const r = lib.backupMonItems(root, tag);
    console.log(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg);
    return;
  }
  if (cmd === 'mg-adjust') {
    const [root] = rest;
    if (!root) return usage();
    const mi = rest.indexOf('--map');
    const moi = rest.indexOf('--mon');
    const ci = rest.indexOf('--count');
    const ti = rest.indexOf('--time');
    const edi = rest.indexOf('--exd');
    const emi = rest.indexOf('--exm');
    const opts = {
      type: mi >= 0 ? 'map' : (moi >= 0 ? 'mongen' : 'all'),
      name: mi >= 0 ? rest[mi + 1] : (moi >= 0 ? rest[moi + 1] : ''),
      monCount: ci >= 0 ? rest[ci + 1] : '1',
      monDate: ti >= 0 ? rest[ti + 1] : '1',
      expressionDate: edi >= 0 ? rest[edi + 1] : '>=',
      excludeDateCount: edi >= 0 ? rest[edi + 2] : null,
      expressionMon: emi >= 0 ? rest[emi + 1] : '>=',
      excludeMonCount: emi >= 0 ? rest[emi + 2] : null
    };
    const r = lib.adjustMonGen(root, opts);
    if (!r.ok) { console.log(r.msg); return; }
    console.log('=== 原刷怪调整完成 ===');
    console.log('刷新数量调整 ' + r.changedCount + ' 行 / 刷新时间调整 ' + r.changedDate + ' 行');
    console.log('文件: ' + r.file);
    return;
  }
  if (cmd === 'dynamic') {
    const [root] = rest;
    if (!root) return usage();
    const g = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
    const r = lib.genDynamicSpawn(root, {
      pro: g('--pro'), count: g('--count'), monCount: g('--moncount'),
      intervaled: g('--intervaled'), interval: g('--interval'),
      engine: g('--engine'), triggerCountPercent: g('--tcpct'),
      excludeTimeMin: g('--excl-time-min'), excludeCountMax: g('--excl-count-max'),
      excludeMaps: g('--exmap') ? g('--exmap').split(',').map(x => x.trim()) : [],
      excludeMons: g('--exmon') ? g('--exmon').split(',').map(x => x.trim()) : [],
      injectQmanage: rest.includes('--qm')
    });
    if (!r.ok) { console.log(r.msg); return; }
    console.log('=== 动态刷怪配置生成（' + r.engine + ' 引擎）===');
    console.log('地图 ' + r.maps + ' 个 / 记录 ' + r.records + ' 条（' + r.spawnCmd + ' 补怪）');
    console.log('RobotManage + AutoRunRobot 已写入（不改造原 MonGen）');
    if (r.qm) console.log(r.qm.msg);
    console.log('提示: 动态刷怪数据已经处理成功，请重启M2生效');
    return;
  }
  if (cmd === 'site-remote') {
    const [root, action] = rest;
    if (!root || !action) { console.log('用法: site-remote <引擎根> listen --port 8000 --token 密钥 | push --url http://ip:port --token 密钥 [--query 查询id]'); return; }
    const g = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
    if (action === 'listen') {
      const r = lib.remoteListen(root, { port: g('--port') ? parseInt(g('--port'), 10) : 8000, token: g('--token') });
      console.log(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg);
      if (r.ok) console.log('按 Ctrl+C 停止服务');
      // 保持进程
      setInterval(() => {}, 1 << 30);
      return;
    }
    if (action === 'push') {
      const url = g('--url');
      if (!url) { console.log('请填 --url 远端地址'); return; }
      (async () => {
        const r = await lib.remotePush(root, { url, token: g('--token'), queryId: g('--query') });
        console.log(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg);
      })();
      return;
    }
    console.log('未知操作: ' + action);
    return;
  }
  if (cmd === 'store-gen') {
    const [root] = rest;
    if (!root) return usage();
    const g = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
    const o = {
      featureFolder: g('--folder'), scriptName: g('--script'), methodName: g('--method'),
      categoryFolder: g('--category'), commonFolder: g('--common'), zoneFolder: g('--zone'),
      storeU: g('--u-var'), timerId: g('--timer') ? parseInt(g('--timer'), 10) : undefined,
      interval: g('--interval') ? parseInt(g('--interval'), 10) : undefined,
      teleportCondition: g('--teleport'),
      btn: g('--btn'), rid: g('--rid') ? parseInt(g('--rid'), 10) : undefined,
      qrMethod: g('--qr'), filterTip: g('--filter-tip'), storeTip: g('--store-tip'),
    };
    if (!o.featureFolder || !o.scriptName || !o.methodName) {
      console.log('用法: store-gen <引擎根> --folder 功能文件夹 --script 脚本名 --method 方法名 [--category 分类目录] [--common 通区目录] [--zone 区服文件夹] [--u-var U335] [--timer 定时器id] [--interval 秒] [--teleport 传送条件] [--btn QR触发序号] [--rid 资源编号] [--qr 掉落检测方法名] [--filter-tip 过滤提示] [--store-tip 存储提示]');
      return;
    }
    const r = await lib.genStoreScript(root, o);
    console.log(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg);
    if (r.ok) console.log('定时器: ' + r.timerId + ' | 文件: ' + r.files.join(', '));
    return;
  }
  if (cmd === 'store-clean') {
    const [root] = rest;
    if (!root) return usage();
    const g = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
    const r = await lib.storeCleanScripts(root, { featureFolder: g('--folder') });
    console.log(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg);
    return;
  }
  if (cmd === 'setup-dirs') {
    const [root] = rest;
    if (!root) return usage();
    const fix = rest.includes('--fix');
    const r = fix ? lib.fixSetupDirKeys(root, { dryRun: false }) : lib.scanSetupDirKeys(root);
    if (!fix) {
      console.log('=== 目录键扫描（' + root + '）===');
      for (const k of r.keys) console.log((k.exists ? '✅ ' : '❌ ') + k.key + ' = ' + (k.value || '(缺失)'));
      console.log(r.issues.length ? '\n' + r.issues.join('\n') : '\n全部目录键存在');
      console.log('\n用 --fix 一键校正为当前引擎根路径（自动备份 + 创建目录）');
      return;
    }
    if (!r.ok && !r.fixed) { console.log(r.msg); return; }
    console.log(r.msg);
    for (const c of r.changed || []) console.log('  ' + c.key + ': ' + c.from + ' → ' + c.to);
    return;
  }
  if (cmd === 'varquery') {
    const [root] = rest;
    if (!root) return usage();
    const g = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
    const r = lib.scanVariables(root);
    if (!r.ok) { console.log(r.msg); return; }
    console.log('=== 变量查询（' + r.files + ' 文件 / ' + r.matches + ' 处匹配）===');
    const type = g('--type');
    if (!type) { console.log('类型: ' + r.types.join(' / ')); console.log('用 --type N$ 查看某类型变量，--var 变量名 查看详情'); return; }
    const vars = r.byType[type] || {};
    const keys = Object.keys(vars).filter(k => !k.startsWith('_'));
    if (g('--var')) {
      const d = vars[g('--var')] || [];
      console.log(type + g('--var') + ' 占用 ' + d.length + ' 处:');
      for (const x of d.slice(0, 20)) console.log('  ' + x.file + ':' + x.line + '  ' + x.text);
      return;
    }
    console.log(type + ' 变量 ' + keys.length + ' 个（按使用次数排序）:');
    keys.sort((a, b) => (vars[b] || []).length - (vars[a] || []).length).slice(0, 30).forEach(k => {
      console.log('  ' + k + '（' + (vars[k] || []).length + ' 处）');
    });
    return;
  }
  if (cmd === 'spawntable') {
    const [root] = rest;
    if (!root) return usage();
    const g = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
    const r = lib.spawnTable(root, { map: g('--map'), mon: g('--mon'), limit: g('--limit') });
    if (!r.ok) { console.log(r.msg); return; }
    console.log('=== 刷怪表格（共 ' + r.total + ' 行 / ' + r.maps + ' 张地图）===');
    for (const row of r.rows.slice(0, 30)) {
      console.log(row.map + ' [' + (row.mapName || '') + '] ' + row.x + ',' + row.y + ' ' + row.monster + ' 数量' + row.count + ' 范围' + row.range + ' 间隔' + row.time + '分' + (row.extra ? ' ' + row.extra : ''));
    }
    if (r.rows.length > 30) console.log('... 其余 ' + (r.rows.length - 30) + ' 行（用 --limit 或 --map/--mon 过滤）');
    return;
  }
  if (cmd === 'dungeons') {
    const [root] = rest;
    if (!root) return usage();
    const r = lib.detectDungeonMaps(root);
    if (!r.ok) { console.log(r.msg); return; }
    console.log('=== 副本地图（' + r.count + ' 个实例）===');
    for (const d of r.dungeons.slice(0, 30)) {
      console.log(d.code + ' ← ' + d.main + ' ' + d.name + (d.hasMap ? ' [有地图文件]' : d.mainHasMap ? ' [可复制实例]' : ''));
    }
    if (r.count > 30) console.log('... 其余 ' + (r.count - 30) + ' 个');
    return;
  }
  if (cmd === 'pspawn' || cmd === 'ispawn') {
    const [root] = rest;
    if (!root) return usage();
    const g = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
    const cfg = { map: g('--map'), monster: g('--mon'), count: g('--count'), range: g('--range'), injectQmanage: !rest.includes('--noqm') };
    const r = cmd === 'pspawn' ? lib.genPersonalSpawn(root, cfg) : lib.genInstanceSpawn(root, cfg);
    console.log(r.ok ? r.msg : r.msg);
    return;
  }
  if (cmd === 'spawn') {
    const [sub, root, ...opt] = rest;
    if (sub === 'qm') {
      if (!root) return usage();
      const g = (k) => { const i = opt.indexOf(k); return i >= 0 ? opt[i + 1] : undefined; };
      const r = lib.injectQManageTimer(root, { label: g('--label'), timerId: g('--id') });
      console.log(r.msg);
      return;
    }
    return usage();
  }
  if (cmd === 'cmp') {
    const [dirA, dirB] = rest;
    if (!dirA || !dirB) return usage();
    const mi = rest.indexOf('--max');
    const r = lib.compareDirs(dirA, dirB, { maxLines: mi >= 0 ? parseInt(rest[mi + 1], 10) : 20 });
    console.log('=== 目录对比 ===');
    console.log('A(' + r.aTotal + ') vs B(' + r.bTotal + ') | 仅A ' + r.summary.onlyA + ' / 仅B ' + r.summary.onlyB + ' / 相同 ' + r.summary.same + ' / 不同 ' + r.summary.diff);
    if (r.onlyA.length) { console.log('仅A:'); r.onlyA.slice(0, 10).forEach(x => console.log('  + ' + x)); }
    if (r.onlyB.length) { console.log('仅B:'); r.onlyB.slice(0, 10).forEach(x => console.log('  + ' + x)); }
    if (r.diff.length) {
      console.log('差异文件（前 10）:');
      for (const d of r.diff.slice(0, 10)) {
        console.log('  ~ ' + d.rel + ' (' + d.aSize + '→' + d.bSize + 'B)');
        for (const l of d.lines.slice(0, 3)) console.log('      L' + l.n + ' A: ' + l.a.slice(0, 60) + '\n      L' + l.n + ' B: ' + l.b.slice(0, 60));
      }
    }
    return;
  }
  if (cmd === 'health') {
    const [root] = rest;
    if (!root) return usage();
    const r = lib.healthReport(root);
    console.log('=== 一键服务端体检：' + r.score + '%（' + r.okCount + '/' + r.total + '）===');
    for (const c of r.checks) console.log('  ' + (c.ok ? '✓' : '✗') + ' [' + c.cat + '] ' + c.name + ': ' + c.detail);
    if (r.issues.length) { console.log('发现 ' + r.issues.length + ' 个问题:'); for (const i of r.issues) console.log('  ❌ ' + i); }
    else console.log('✅ 未发现问题');
    return;
  }
  if (cmd === 'site') {
    const [root] = rest;
    if (!root) return usage();
    const g = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
    const o = { title: g('--title'), skin: g('--skin') || 'dark', newZones: g('--new'), fastZones: g('--fast'), soloZones: g('--solo'), output: g('--output'),
      desc: g('--desc'), downloadUrl: g('--dl'), qqGroups: g('--qq'), versions: g('--versions'), announce: g('--announce'), skipDroprate: rest.includes('--skip-drop'),
      maint: rest.includes('--maint'), maintMsg: g('--maint-msg'), admin: rest.includes('--admin'), applyConfig: g('--apply-config') };
    const r = lib.genOpenSite(root, o);
    if (!r.ok) { console.log('❌ ' + r.msg); return; }
    console.log('✅ ' + r.msg);
    console.log('目录: ' + r.dir);
    console.log('爆率: ' + r.monsterCount + ' 只怪 / ' + r.itemCount + ' 种物品');
    console.log('提示: 打开 index.html 预览，droprate.html 为爆率查询页（还原自虾米网站管理）');
    if (r.withAdmin) console.log('后台: admin.html 编辑→导出配置→site --apply-config 发布');
    if (r.maint) console.log('维护: maintenance.html + 首页维护横幅已生成');
    return;
  }
  if (cmd === 'delrates') {
    const [root] = rest;
    if (!root) return usage();
    const g = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
    const r = lib.delRates(root, { content: g('--content') || '', method: g('--method') || 'item', autoBackup: !rest.includes('--no-backup') });
    console.log(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg);
    return;
  }
  if (cmd === 'group') {
    const [root] = rest;
    if (!root) return usage();
    const g = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
    const r = lib.groupRates(root, { groupSize: +g('--size') || 5, autoBackup: !rest.includes('--no-backup') });
    console.log(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg);
    return;
  }
  if (cmd === 'opt') {
    const [root] = rest;
    if (!root) return usage();
    const r = lib.optimizeRates(root, { autoBackup: !rest.includes('--no-backup') });
    console.log(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg);
    return;
  }
  if (cmd === 'addrates') {
    const [root] = rest;
    if (!root) return usage();
    const g = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
    const o = { items: (g('--items') || '').split(/[,，]/).map(x => x.trim()).filter(Boolean),
      rate: +g('--rate') || 1, method: g('--method') || 'all',
      monsters: (g('--monsters') || '').split(/[,，]/).map(x => x.trim()).filter(Boolean),
      count: +g('--count') || 1, autoBackup: !rest.includes('--no-backup') };
    const r = lib.addRates(root, o);
    console.log(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg);
    return;
  }
  if (cmd === 'callrestore') {
    const [root] = rest;
    if (!root) return usage();
    const apply = rest.includes('--apply');
    const r = lib.restoreCall(root, { dryRun: !apply });
    console.log(r.ok ? (apply ? '✅ ' : '🔍 ') + r.msg : '❌ ' + r.msg);
    console.log('提示: --apply 执行展开（默认仅扫描，不修改文件）');
    return;
  }
  if (cmd === 'overall') {
    const [root] = rest;
    if (!root) return usage();
    const g = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
    const o = { method: g('--method') || 'all', autoBackup: !rest.includes('--no-backup'),
      monsters: (g('--monsters') || '').split(/[,，]/).map(x => x.trim()).filter(Boolean),
      maps: (g('--maps') || '').split(/[,，]/).map(x => x.trim()).filter(Boolean),
      items: (g('--items') || '').split(/[,，]/).map(x => x.trim()).filter(Boolean),
      rangeOp: g('--range-op'), rangeValue: g('--range-val') != null ? +g('--range-val') : null,
      op: g('--op') || 'mul', opValue: g('--op-val') != null ? +g('--op-val') : 1 };
    const r = lib.overallOptimize(root, o);
    console.log(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg);
    return;
  }
  if (cmd === 'rates') {
    const sub = rest[0];
    const root = rest[1];
    const mon = rest[2];
    if ((sub === 'dup' || sub === 'deldup') && root && mon) {
      const r = sub === 'dup' ? lib.findDupRates(root, mon) : lib.delDupRates(root, mon);
      if (!r.ok) { console.log(r.msg); return; }
      if (sub === 'dup') {
        console.log('=== ' + mon + ' 重复爆率（' + r.total + ' 条，' + r.dups.length + ' 组重复）===');
        for (const d of r.dups) console.log('  ' + d.item + ' @ ' + d.rate + ' ×' + d.count);
        console.log('提示: 用 rates deldup <根> <怪> 一键删除重复');
      } else console.log('✅ ' + r.msg);
      return;
    }
    return usage();
  }
  if (cmd === 'm2reload') {
    const li = rest.indexOf('--list');
    const ii = rest.indexOf('--item');
    const fi = rest.indexOf('--filter');
    if (li >= 0) {
      const r = lib.m2Reload({ action: 'list', filter: fi >= 0 ? rest[fi + 1] : '' });
      if (r.ok) {
        console.log('M2 重载菜单可用项:');
        console.log(r.msg);
      } else {
        console.log('提示: ' + r.msg);
        console.log('（M2 重载需要先打开 M2 主窗口，从托盘恢复后即可）');
      }
      return;
    }
    const item = ii >= 0 ? rest[ii + 1] : '';
    if (!item) return usage();
    const r = lib.m2Reload({ action: 'reload', item, filter: fi >= 0 ? rest[fi + 1] : '' });
    console.log(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg);
    return;
  }
  if (cmd === 'sales') {
    const [root, outDir] = rest;
    if (!root || !outDir) return usage();
    const ni = rest.indexOf('--name');
    const fi = rest.indexOf('--format');
    const gi = rest.indexOf('--group');
    const ui = rest.indexOf('--uid');
    const r = lib.genSalesData(root, {
      outDir, name: ni >= 0 ? rest[ni + 1] : '数据包',
      format: fi >= 0 ? rest[fi + 1] : 'new',
      groupSize: gi >= 0 ? parseInt(rest[gi + 1], 10) : 100,
      userIdType: ui >= 0 ? rest[ui + 1] : '数字'
    });
    console.log('=== 存销系统生成 ===');
    if (!r.ok) { console.log(r.msg); return; }
    for (const st of r.stages) console.log('  ' + st);
    console.log('输出: ' + r.outBase);
    return;
  }
  if (cmd === 'recycle') {
    // 用法: rate-tool recycle <根> <地图> <X> <Y> <NPC名> <分类JSON>
    // 分类JSON: [{"name":"武器类","tip":"","color":7,"names":["屠龙","裁决之杖"],"extracts":[{"key":"gold","name":"金币","value":100},{"key":"gamegold","name":"元宝","value":1}]}]
    const [root, map, x, y, npc, catsJson] = rest;
    if (!root || !map || !x || !y || !npc || !catsJson) return usage();
    let cats;
    try { cats = JSON.parse(catsJson); } catch (e) { console.log('分类JSON解析失败: ' + e.message); return; }
    if (!Array.isArray(cats) || !cats.length) { console.log('分类列表为空'); return; }
    const r = lib.addRecycleNpc(root, { mapCode: map, x, y, npcName: npc, cats });
    if (!r.ok) { console.log(r.msg); return; }
    console.log('=== 回收 NPC 生成完成（原版风格：勾选界面+总开关+全选反选）===');
    console.log('NPC: ' + r.npc + '（' + cats.length + ' 个分类）');
    console.log('个人标识: [' + r.checks.join(',') + ']');
    console.log('MerChant.txt: ' + r.merchant + (r.updated ? '（已更新）' : '（已追加）'));
    console.log('脚本: ' + r.scriptFile + '（' + r.scriptLines + ' 行）');
    console.log('提示: 重启引擎或 @reloadnpc 重新加载所有NPC生效');
    return;
  }
  if (cmd === 'sync') {
    const [root] = rest;
    if (!root) return usage();
    const hi = rest.indexOf('--host');
    const ui = rest.indexOf('--user');
    const pi = rest.indexOf('--pass');
    const poi = rest.indexOf('--port');
    const ri = rest.indexOf('--rule');
    const cfg = lib.loadSyncConfig();
    if (hi >= 0) cfg.host = rest[hi + 1];
    if (ui >= 0) cfg.user = rest[ui + 1];
    if (pi >= 0) cfg.pass = rest[pi + 1];
    if (poi >= 0) cfg.port = parseInt(rest[poi + 1], 10);
    if (ri >= 0) {
      const [l, r] = rest[ri + 1].split('=');
      if (l) cfg.rules = [{ local: l, remote: r || '/' + l.split('/').pop() }];
    }
    lib.saveSyncConfig(cfg);
    (async () => {
      console.log('=== 目录同步到 ' + cfg.host + ':' + cfg.port + ' ===');
      for (const rule of cfg.rules) console.log('规则: ' + rule.local + ' → ' + rule.remote);
      const r = await lib.ftpSync(root, cfg, m => console.log('  ' + m));
      if (!r.ok) { console.log(r.msg); return; }
      console.log('完成: 上传 ' + r.uploaded + ' / 跳过 ' + r.skipped + ' / 失败 ' + r.failed);
      for (const e of r.errors.slice(0, 5)) console.log('  ✗ ' + e);
    })();
    return;
  }
  if (cmd === 'robot') {
    const sub = rest[0];
    if (sub === 'list') {
      const [root] = rest.slice(1);
      if (!root) return usage();
      const r = lib.readRobots(root);
      if (!r.ok) { console.log(r.msg); return; }
      console.log('=== 机器人脚本（' + r.dir + '）===');
      console.log('AutoRunRobot.txt 定时行 ' + r.robots.length + ' 条：');
      for (const rb of r.robots) {
        console.log('  ' + (rb.enabled ? '✓' : '✗禁用') + ' #AutoRun NPC ' + rb.unit + ' ' + rb.value + ' @' + rb.section);
      }
      console.log('RobotManage.txt 段 ' + r.sections.length + ' 个：');
      for (const sec of r.sections) console.log('  [@' + sec + ']');
      return;
    }
    if (sub === 'add') {
      const [root, name, interval] = rest.slice(1);
      if (!root || !name || !interval) return usage();
      const ui = rest.indexOf('--unit');
      const ti = rest.indexOf('--type');
      const mi = rest.indexOf('--map');
      const moi = rest.indexOf('--mon');
      const ci = rest.indexOf('--count');
      const msi = rest.indexOf('--maps');
      const opts = {
        name, interval: parseInt(interval, 10),
        unit: ui >= 0 ? rest[ui + 1] : 'SEC',
        type: ti >= 0 ? rest[ti + 1] : 'spawn',
        map: mi >= 0 ? rest[mi + 1] : undefined,
        mon: moi >= 0 ? rest[moi + 1] : undefined,
        count: ci >= 0 ? parseInt(rest[ci + 1], 10) : 1,
        maps: msi >= 0 ? rest[msi + 1].split(',').map(x => x.trim()) : undefined
      };
      const a = lib.addRobot(root, opts);
      console.log(a.ok ? '已新增 ' + a.section + '（' + a.runLine + '）' : a.msg);
      return;
    }
    if (sub === 'del') {
      const [root, name] = rest.slice(1);
      if (!root || !name) return usage();
      const d = lib.delRobot(root, name);
      console.log(d.ok ? '已删除 ' + name + '（定时行已注释，段已移除）' : d.msg);
      return;
    }
    return usage();
  }
  if (cmd === 'inject') {
    const [root, name, target, scriptFile] = rest;
    if (!root || !name || !target || !scriptFile) return usage();
    if (!fs.existsSync(scriptFile)) { console.log('脚本文件不存在: ' + scriptFile); return; }
    const modeIdx = rest.indexOf('--mode');
    const content = fs.readFileSync(scriptFile, 'utf8');
    const r = lib.injectScript(root, {
      name, target, content,
      mode: modeIdx >= 0 ? rest[modeIdx + 1] : 'append',
      varReplace: rest.includes('--vars')
    });
    if (!r.ok) { console.log(r.msg); return; }
    console.log('=== 脚本注入完成 ===');
    console.log('名称: ' + r.name + (r.already ? '（检测到已注入，模式=' + r.mode + '）' : ''));
    console.log('文件: ' + r.file);
    return;
  }
  if (cmd === 'ports') {
    const [root] = rest;
    if (!root) return usage();
    (async () => {
      const c = await lib.checkPorts(root);
      console.log('=== 服务端端口占用检测（' + root + '）===');
      console.log('共 ' + c.total + ' 个端口，占用 ' + c.inUseCount + ' 个：');
      console.log('状态\t端口\t用途');
      for (const r of c.results) {
        const labels = r.keys.map(k => k.label + '/' + k.key).join(', ');
        console.log((r.inUse ? '■ 占用' : '□ 空闲') + '\t' + r.port + '\t' + labels);
      }
      if (c.inUseCount > 0) console.log('提示: 有端口被占用，启动服务端前请先释放或修改配置');
    })();
    return;
  }
  if (cmd === 'portcfg') {
    const [root] = rest;
    if (!root) return usage();
    const li = rest.indexOf('--list');
    const fi = rest.indexOf('--file');
    const ki = rest.indexOf('--key');
    const pi = rest.indexOf('--port');
    const ri = rest.indexOf('--replace');
    const ci = rest.indexOf('--check');
    // 端口写操作保护（事故教训 2026-08-08：GatePort1=7001 改坏活动组直接断服）
    // 任何写操作（--file/--key/--port 单键改、--replace 批量替换）都要求 --yes：
    // 主键与带数字后缀键（GatePort/GatePort1...）同值是模板常态，Count=N 决定活动组，键名危险性与端口值无关
    if ((pi >= 0 || ri >= 0) && !rest.includes('--yes')) {
      console.log('⚠️ 端口写操作保护：');
      if (ri >= 0) console.log('  本次将把端口 ' + rest[ri + 1] + ' 批量替换为 ' + rest[ri + 2] + '（全部配置文件）');
      if (pi >= 0) console.log('  本次将修改 ' + (rest[fi + 1] || '?') + ' 的 ' + (rest[ki + 1] || '?') + ' = ' + rest[pi + 1]);
      console.log('⚠️ 带数字后缀的键（GatePort1/ServerPort1/...）由 Count=N 决定是否活动组，主/备组同值是模板常态，误改会导致客户端连不上服务器！');
      console.log('⚠️ 确认要改，请加 --yes（改前会自动备份到 port-backup\\时间戳\\）');
      return;
    }
    if (ci >= 0) {
      (async () => {
        const c = await lib.checkPorts(root);
        console.log('=== 端口占用检测 ===');
        console.log('共 ' + c.total + ' 个端口，占用 ' + c.inUseCount + ' 个：');
        for (const r of c.results) {
          const labels = r.keys.map(k => k.label + '/' + k.key).join(', ');
          console.log((r.inUse ? '■ 占用' : '□ 空闲') + '\t' + r.port + '\t' + labels);
        }
      })();
      return;
    }
    const cdi = rest.indexOf('--check-dup');
    if (cdi >= 0) {
      const r = lib.checkPortConsistency(root);
      console.log('=== 端口一致性检查（' + r.total + ' 个端口，' + r.dups.length + ' 组重复）===');
      for (const d of r.dups) console.log('  ' + d.port + ' ← ' + d.keys.join(', '));
      if (!r.dups.length) console.log('✅ 无重复端口');
      return;
    }
    const psi = rest.indexOf('--preset-save');
    const pli = rest.indexOf('--preset-list');
    const pai = rest.indexOf('--preset-apply');
    if (psi >= 0) { console.log(lib.savePortPreset(root, rest[psi + 1]).msg); return; }
    if (pli >= 0) { const r = lib.listPortPresets(); console.log('已保存的端口预设: ' + (r.presets.join(', ') || '（无）')); return; }
    if (pai >= 0) { console.log(lib.applyPortPreset(root, rest[pai + 1]).msg); return; }
    if (ri >= 0) {
      const from = parseInt(rest[ri + 1], 10);
      const to = parseInt(rest[ri + 2], 10);
      const r = lib.replacePorts(root, from, to);
      console.log(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg);
      return;
    }
    if (fi >= 0 && ki >= 0 && pi >= 0) {
      const r = lib.writePortConfig(root, rest[fi + 1], rest[ki + 1], parseInt(rest[pi + 1], 10));
      console.log(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg);
      return;
    }
    // 默认：列出
    const r = lib.readPortConfig(root);
    console.log('=== 服务端端口配置（共 ' + r.count + ' 个）===');
    for (const f of r.files) {
      console.log('[' + f.label + '] ' + f.file);
      for (const e of f.entries) console.log('  ' + e.key + ' = ' + e.port);
    }
    return;
  }
  if (cmd === 'itemcfg') {
    const [root] = rest;
    if (!root) return usage();
    const top = rest.includes('--top');
    const ai = rest.indexOf('--add');
    const di = rest.indexOf('--del');
    const ci = rest.indexOf('--color');
    const ti = rest.indexOf('--text');
    const ui = rest.indexOf('--unbind');
    const uid = rest.indexOf('--uid');
    const shop = rest.includes('--shop');
    const group = rest.includes('--group');
    const fi = rest.indexOf('--file');
    if (fi >= 0) {
      const fileKey = rest[fi + 1];
      const r0 = lib.readSimpleFile(root, fileKey);
      if (!r0.ok) { console.log(r0.msg); return; }
      if (ai >= 0) {
        const cols = rest[ai + 1].split(/[|,\t]+/).map(x => x.trim()).filter(Boolean);
        r0.items.push({ cols, raw: undefined });
        lib.writeSimpleCfg(root, r0.file, r0.comments, r0.items);
        console.log('✅ 已添加: ' + cols.join(' '));
        return;
      }
      if (di >= 0) {
        const idx = parseInt(rest[di + 1], 10);
        if (idx >= 1 && idx <= r0.items.length) {
          const removed = r0.items.splice(idx - 1, 1)[0];
          lib.writeSimpleCfg(root, r0.file, r0.comments, r0.items);
          console.log('✅ 已删除第 ' + idx + ' 条: ' + removed.cols.join(' '));
        } else { console.log('行号无效（1~' + r0.items.length + '）'); }
        return;
      }
      console.log('=== ' + r0.label + '（' + r0.count + ' 条）===');
      r0.items.forEach((x, i) => console.log('  ' + (i + 1) + '. ' + x.cols.join('\t')));
      console.log('格式: ' + r0.desc);
      return;
    }
    if (ui >= 0) {
      if (ai >= 0) { console.log(lib.addUnbindItem(root, rest[ai + 1], rest.slice(ai + 2).join(' ')).msg); return; }
      if (di >= 0) { console.log(lib.delUnbindItem(root, rest[di + 1]).msg); return; }
      const r = lib.readUnbindList(root);
      console.log('=== 物品解包（' + r.count + ' 条）===');
      for (const x of r.items) console.log('  ' + x.id + '\t' + x.name);
      return;
    }
    if (shop) {
      const r = lib.readShopList(root);
      console.log('=== 系统商铺（' + r.count + ' 条）===');
      for (const x of r.items.slice(0, 30)) console.log('  [' + x.shopType + '] ' + x.name);
      if (r.count > 30) console.log('  ...共 ' + r.count + ' 条');
      return;
    }
    if (group) {
      const r = lib.readGroupItems(root);
      console.log('=== 物品套装（' + r.count + ' 组）===');
      for (const x of r.rows.slice(0, 20)) console.log('  ' + x.group + ' ' + x.trigger + ' → ' + x.members.join('+'));
      if (r.count > 20) console.log('  ...共 ' + r.count + ' 组');
      return;
    }
    if (ai >= 0) { console.log(lib.addItemDesc(root, top, rest[ai + 1], ci >= 0 ? rest[ci + 1] : '243', ti >= 0 ? rest.slice(ti + 1).join(' ') : '').msg); return; }
    if (di >= 0) { console.log(lib.delItemDesc(root, top, rest[di + 1]).msg); return; }
    const r = lib.readItemDesc(root, top);
    console.log('=== 物品备注' + (top ? '（上）' : '（下）') + '（' + r.count + ' 条）===');
    for (const x of r.items.slice(0, 30)) console.log('  ' + x.name + ' = ' + x.segs.map(s => '\\' + s.color + '/' + s.text).join(''));
    if (r.count > 30) console.log('  ...共 ' + r.count + ' 条');
    return;
  }
  if (cmd === 'mapcfg') {
    const [root] = rest;
    if (!root) return usage();
    const si = rest.indexOf('--start');
    const ai = rest.indexOf('--add');
    const di = rest.indexOf('--del');
    const mi = rest.indexOf('--mapinfo');
    const mmi = rest.indexOf('--minimap');
    const mei = rest.indexOf('--mapevent');
    if (mei >= 0) {
      const r = lib.readMapEvent(root);
      console.log('=== 地图事件（' + r.count + ' 条）===');
      for (const x of r.items) console.log('  ' + x.cols.join('\t'));
      return;
    }
    if (mi >= 0) {
      const r = lib.readMapInfo(root);
      console.log('=== 地图配置（' + r.maps.length + ' 地图 + ' + r.links.length + ' 传送门）===');
      const f = rest.indexOf('--filter');
      const kw = f >= 0 ? rest[f + 1] : '';
      const maps = kw ? r.maps.filter(m => m.code.includes(kw) || m.title.includes(kw)) : r.maps.slice(0, 25);
      for (const m of maps.slice(0, 25)) console.log('  [' + m.code + '] ' + m.title + (m.props ? ' ' + m.props.slice(0, 60) : ''));
      if (r.maps.length > 25 && !kw) console.log('  ...共 ' + r.maps.length + ' 地图（用 --filter 搜索）');
      return;
    }
    if (mmi >= 0) {
      const r = lib.readMiniMap(root);
      console.log('=== 小地图配置（' + r.count + ' 条）===');
      for (const x of r.rows.slice(0, 25)) console.log('  ' + x.map + '\t' + x.id);
      if (r.count > 25) console.log('  ...共 ' + r.count + ' 条');
      return;
    }
    if (si >= 0) {
      if (ai >= 0) {
        const [m, x, y, range, type] = rest.slice(ai + 1);
        console.log(lib.addStartPoint(root, m, parseInt(x, 10), parseInt(y, 10), parseInt(range || 0, 10), parseInt(type || 0, 10)).msg);
        return;
      }
      if (di >= 0) {
        const [m, x, y] = rest.slice(di + 1);
        console.log(lib.delStartPoint(root, m, parseInt(x, 10), parseInt(y, 10)).msg);
        return;
      }
      const r = lib.readStartPoint(root);
      console.log('=== 安全区（' + r.count + ' 个）===');
      for (const x of r.rows) console.log('  ' + x.map + '\t' + x.x + ',' + x.y + '\t范围' + x.range + '\t类型' + x.type);
      return;
    }
    return usage();
  }
  if (cmd === 'engineck') {
    const [root] = rest;
    if (!root) return usage();
    const r = lib.checkServerConfig(root);
    console.log('=== 引擎识别 + 服务端健检 ===');
    for (const c of r.checks) console.log('  ' + (c.ok ? '✓' : '✗') + ' ' + c.name + ': ' + c.detail);
    if (r.issues.length) {
      console.log('\n发现 ' + r.issues.length + ' 个问题:');
      for (const i of r.issues) console.log('  ❌ ' + i);
    } else {
      console.log('\n✅ 未发现问题');
    }
    return;
  }
  if (cmd === 'exchange') {
    const [root, map, x, y, npc, fromCur, fromAmt, toCur, toAmt] = rest;
    if (!root || !map || !x || !y || !npc || !fromCur || !fromAmt || !toCur || !toAmt) return usage();
    const cntIdx = rest.indexOf('--count');
    const genOnly = rest.includes('--generate-only');
    const r = lib.addExchangeNpc(root, {
      mapCode: map, x, y, npcName: npc,
      count: cntIdx >= 0 ? parseInt(rest[cntIdx + 1], 10) || 1 : 1,
      generateOnly: genOnly,
      items: [{ from: fromCur, fromName: fromCur, fromAmount: parseInt(fromAmt, 10), to: toCur, toName: toCur, toAmount: parseInt(toAmt, 10) }]
    });
    if (!r.ok) { console.log(r.msg); return; }
    if (genOnly) {
      console.log('=== 兑换脚本内容（未写入文件，还原自虾米"只生成模式"）===');
      console.log(r.script);
      return;
    }
    console.log('=== 货币兑换 NPC 生成完成 ===');
    console.log('NPC: ' + r.npc);
    console.log('MerChant.txt: ' + r.merchant + (r.updated ? '（已更新）' : '（已追加）'));
    console.log('脚本: ' + r.scriptFile + '（' + r.scriptLines + ' 行）');
    console.log('提示: 重启引擎或 @reloadnpc 重新加载所有NPC生效');
    return;
  }
  if (cmd === 'grep') {
    const root = rest[0];
    const search = rest[1];
    if (!root || !search) return usage();
    const opts = {
      isCase: !rest.includes('--nocase'),
      isChildren: !rest.includes('--nochildren'),
      matchMode: (rest[rest.indexOf('--mode') + 1]) || 'contains', // contains|exact|regex|prefix|suffix
      types: [rest[rest.indexOf('--type') + 1] || '.txt']
    };
    const dirIdx = rest.indexOf('--dir');
    opts.dir = dirIdx >= 0 ? rest[dirIdx + 1] : path.join(root, 'Mir200', 'Envir');
    const repIdx = rest.indexOf('--replace');
    if (repIdx >= 0) {
      const replace = rest[repIdx + 1];
      const r = lib.replaceScripts(root, Object.assign({}, opts, { search, replace: replace != null ? replace : '' }));
      if (!r.ok) { console.log(r.msg); return; }
      console.log('=== 替换完成 ===');
      console.log('目录: ' + r.dir);
      console.log('共替换 ' + r.total + ' 处 / ' + r.results.length + ' 个文件:');
      for (const x of r.results.slice(0, 30)) console.log('  ' + x.rel + ': ' + x.replaced + ' 处');
      if (r.results.length > 30) console.log('  ... 共 ' + r.results.length + ' 个文件');
      return;
    }
    const r = lib.searchScripts(root, Object.assign({}, opts, { search }));
    if (!r.ok) { console.log(r.msg); return; }
    console.log('=== 搜索「' + search + '」===');
    console.log('目录: ' + r.dir);
    console.log('共 ' + r.total + ' 处匹配 / ' + r.results.length + ' 个文件:');
    for (const x of r.results.slice(0, 30)) {
      console.log('  ' + x.rel + ' (' + x.count + ' 处): 行 ' + x.lines.slice(0, 10).join(','));
      if (x.lines.length > 10) console.log('     ...');
    }
    if (r.results.length > 30) console.log('  ... 共 ' + r.results.length + ' 个文件');
    return;
  }
  if (cmd === 'currency') {
    const [root] = rest;
    if (!root) return usage();
    const opts = { dropQFunction: rest.includes('--drop-qf'), dropQManage: rest.includes('--drop-qm') };
    const rep = lib.currencyReport(root, opts);
    if (!rep.ok) { console.log(rep.msg); return; }
    console.log('=== 版本货币消耗分析（' + rep.base + '）===');
    console.log('共匹配 ' + rep.total + ' 条货币命令：');
    console.log('');
    console.log('货币\t消耗\t收入\t检查\t次数\t文件数\tNPC数');
    for (const c of rep.currencies) {
      console.log(c.currency + '\t' + c.consume + '\t' + c.income + '\t' + c.check + '\t' + c.count + '\t' + c.fileCount + '\t' + c.npcCount);
    }
    if (rest.includes('--npc')) {
      console.log('');
      console.log('=== NPC 消耗排行（消耗最多前 20）===');
      for (const n of rep.npcs.slice(0, 20)) {
        console.log(n.currency + ' | ' + n.npc + ': 消耗 ' + n.consume + ' / 收入 ' + n.income + '（' + n.count + ' 次）');
      }
    }
    return;
  }
  if (cmd === 'mongen') {
    const sub = rest[0];
    if (sub === 'list') {
      const [root, mapCode] = rest.slice(1);
      if (!root) return usage();
      const l = lib.listMonGen(root, mapCode);
      if (!l.ok) { console.log(l.msg); return; }
      console.log((mapCode ? '地图 ' + mapCode + ' 的刷怪配置' : '全部刷怪配置') + '（共 ' + l.total + ' 行，显示 ' + l.rows.length + ' 条）:');
      console.log('  地图\tX\tY\t怪物名\t数量\t范围\t间隔\t时间\t触发');
      for (const r of l.rows.slice(0, 40)) {
        console.log('  ' + r.map + '\t' + r.x + '\t' + r.y + '\t' + r.mon + '\t' + r.count + '\t' + r.range + '\t' + r.interval + '\t' + r.time + '\t' + r.trigger);
      }
      if (l.rows.length > 40) console.log('  ... 共 ' + l.rows.length + ' 条');
      return;
    }
    if (sub === 'add') {
      const [root, map, x, y, mon, count, range, interval, time, trigger] = rest.slice(1);
      if (!root || !map || !x || !y || !mon) return usage();
      const a = lib.addMonGen(root, { map, x, y, mon, count, range, interval, time, trigger });
      console.log(a.ok ? '已追加: ' + a.line + ' → ' + a.file : a.msg);
      return;
    }
    if (sub === 'del') {
      const [root, map, mon] = rest.slice(1);
      if (!root || !map || !mon) return usage();
      const d = lib.delMonGen(root, map, mon);
      console.log(d.ok ? '已删除 ' + d.removed + ' 条刷怪行 → ' + d.file : d.msg);
      return;
    }
    return usage();
  }
  if (cmd === 'map') {
    const [root, mapCode] = rest;
    if (!root || !mapCode) return usage();
    const mm = lib.mapMonsters(root, mapCode);
    if (mm.length === 0) { console.log('MonGen.txt 中未找到地图 ' + mapCode + '（或该地图无刷怪记录）'); return; }
    console.log('地图 ' + mapCode + ' 共 ' + mm.length + ' 种怪:');
    for (const x of mm) console.log('  ' + x.mon + (x.exists ? '（爆率 ' + x.lines + ' 行）' : '（无爆率文件）'));
    return;
  }
  if (cmd === 'find') {
    const [root, item] = rest;
    if (!root || !item) return usage();
    const drops = lib.findItemDrops(root, item);
    if (drops.length === 0) { console.log('全服未找到「' + item + '」的掉落'); return; }
    console.log('物品「' + item + '」被 ' + drops.length + ' 个怪掉落:');
    for (const d of drops.slice(0, 30)) console.log('  ' + d.mon + ' → ' + d.line);
    if (drops.length > 30) console.log('  ... 共 ' + drops.length + ' 条');
    return;
  }
  if (cmd === 'add' || cmd === 'del') {
    const o = parseOpts(rest);
    const [root, mon, item, rate, count] = o.positional;
    const deleteMode = cmd === 'del' || o.delete;
    if (!root || !mon || !item) return usage();
    const isGlobal = mon === '*';
    const cnt = count ? parseInt(count, 10) : 1;
    if (isGlobal) {
      const r = lib.globalOp(root, deleteMode ? 'del' : 'add', item, rate ? parseInt(rate, 10) : 0, cnt, !deleteMode);
      console.log('全服操作完成: ' + r.total + ' 个怪物文件');
      let ok = 0, err = 0;
      for (const x of r.results) {
        if (x.error) { err++; console.log('  [错误] ' + x.mon + ': ' + x.error); }
        else ok++;
      }
      console.log('成功 ' + ok + ' / 失败 ' + err);
    } else if (o.after) {
      // 加在指定物品后（goods 类型）
      let n = rate ? parseInt(rate, 10) : 0;
      if (o.rs != null && o.re != null) n = lib.randRate(o.rs, o.re);
      const res = lib.addAfterItem(root, o.after, item, n, cnt, o.child || (o.rs != null));
      if (res.length === 0) { console.log('全服未找到物品「' + o.after + '」的掉落，无法追加'); return; }
      console.log('已在 ' + res.length + ' 处「' + o.after + '」后追加' + (o.child || (o.rs != null) ? ' #CHILD 1/' + n : ' ' + item + ' 1/' + n) + ':');
      for (const x of res.slice(0, 15)) console.log('  ✓ ' + x.mon + ' → ' + x.line);
      if (res.length > 15) console.log('  ... 共 ' + res.length + ' 处');
      return;
    } else if (deleteMode) {
      const r = lib.delRate(root, mon, item);
      console.log('删除完成: ' + (r.removed || 0) + ' 条（剩余 ' + r.total + ' 条）→ ' + r.file);
    } else {
      if (o.child || (o.rs != null && o.re != null)) {
        let n = rate ? parseInt(rate, 10) : 0;
        if (o.rs != null && o.re != null) n = lib.randRate(o.rs, o.re);
        const { file, items } = lib.readMonFile(root, mon);
        items.push({ kind: 'child', num: 1, rate: n, flag: 'RANDOM', cond: null, raw: '' });
        lib.writeMonFile(root, mon, items);
        console.log('追加 #CHILD 1/' + n + (cnt > 1 ? ' x' + cnt : '') + ' → ' + file);
      } else {
        const r = lib.addRate(root, mon, item, rate ? parseInt(rate, 10) : 0, cnt, true);
        console.log('追加完成: 共 ' + r.total + ' 条 → ' + r.file);
      }
    }
    return;
  }
  if (cmd === 'adjust' || cmd === 'random') {
    const o = parseOpts(rest);
    const [root, mon, rate] = o.positional;
    if (!root || !mon) return usage();
    const isGlobal = mon === '*';
    const opt = {
      rate: cmd === 'adjust' ? (rate ? parseFloat(rate) : 1) : undefined,
      minRate: o.min != null ? o.min : null,
      maxRate: o.max != null ? o.max : null,
      maxLimit: o.limit != null ? o.limit : null,
      type: o.child ? 'child' : 'normal',
    };
    const fn = cmd === 'adjust'
      ? (m) => lib.adjustRateFile(root, m, opt)
      : (m) => lib.convertRandomFile(root, m, { minRate: opt.minRate, maxRate: opt.maxRate });
    const mons = isGlobal ? lib.listMonFiles(root) : [mon];
    console.log((cmd === 'adjust' ? '批量调整' : '随机转换') + ' (' + mons.length + ' 个文件):');
    let ok = 0, err = 0;
    for (const m of mons) {
      try {
        const r = fn(m);
        ok++;
        console.log('  ✓ ' + m + ': ' + (cmd === 'adjust' ? '调整 ' + r.changed : '转换 ' + r.changed) + ' 条');
      } catch (e) {
        err++;
        console.log('  ✗ ' + m + ': ' + e.message);
      }
    }
    console.log('成功 ' + ok + ' / 失败 ' + err);
    return;
  }
  return usage();
}

main(process.argv.slice(2)).catch(e => { console.error('❌ ' + (e && e.message || e)); process.exit(1); });
