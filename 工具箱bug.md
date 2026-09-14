# 元歌工具箱 · 工具箱 Bug 修复清单

> 分类口径:**工具箱 bug = 程序本身的问题**——崩溃、死循环、无反馈、编码破坏、安全边界、输入校验、工程残留。修这类是通用工程问题,大多一行级。
> 配套:功能 bug 见 `功能bug.md`(生成内容/行为与原版不符)。编号沿用总清单(见 `元歌工具箱修复清单.md`)。
> 每项 =【位置】【现状】【改法】【验证】。改前备份;改完 `node --check` 对应文件。
> 修复顺序:一行级优先(标 ⚡ 的改 1-5 行即可),先清崩溃/死循环,再清数据破坏,最后清理残留。

---

## 一、🔴 崩溃与稳定性

### T-P2-27 ⚡ GPU 崩溃,软件打不开
- 【位置】`main.js` 顶部(createWindow 前)
- 【现状】无 `disableHardwareAcceleration`,applog.txt 显示 GPU 进程崩溃 9 次后 `FATAL ... GPU process isn't usable. Goodbye.`(远程桌面/虚拟机/旧驱动环境必现)。
- 【改法】`app.whenReady()` 前加 `app.disableHardwareAcceleration();`(或 `app.commandLine.appendSwitch('disable-gpu')`)。
- 【验证】无 GPU 环境启动不崩溃。

### T-R3-1 ⚡ qkLog 未定义,快捷操作面板点击即崩
- 【位置】`renderer.js:1200/1216/1254/1256/1262/1268/1272/1281/1288`(9 处调用)
- 【现状】全文无 `function qkLog` 定义,点"刷新 NPC 列表/过滤输入/打开快捷文件/我的快捷/NPC 打开/添加自定义路径"全部 ReferenceError,表格不渲染。
- 【改法】在 appendLog 定义后补 `const qkLog = (msg, cls) => appendLog(msg, cls);`。
- 【验证】快捷操作面板各按钮有反馈、表格正常渲染。

### T-P2-31 ⚡ 脚本搜索替换:空搜索词死循环挂死主进程
- 【位置】`lib.js:1058-1068`(replaceScripts 忽略大小写分支)、`1071`(区分大小写分支)
- 【现状】`from=''` 时 `idx += 0` 永不前进 → 无限循环;区分大小写分支 `split('')` 逐字符拆,整文件被插入垃圾。
- 【改法】函数入口 `if (!opts.search) return { ok:false, msg:'搜索内容为空' };`。
- 【验证】空搜索点击替换 → 提示错误,不卡死。

### T-P1-4a ⚡ 脚本注入变量替换:死循环
- 【位置】`lib.js:1442-1446`(replaceOccupyVars)
- 【现状】新名 `parseInt(m[2],10)+100` 是循环内常量,目标文件同时含 U11/U111 时 `while (used.has(newV))` 永不退出。
- 【改法】新名改为循环内递增:`let cand = m[2].match(/^\d+$/) ? (base + 100 + n) : (m[2] + '_' + n); n++;`。
- 【验证】含 U11/U111 的目标文件注入 → 正常返回不卡死。

### T-R3-8 quickBackup 无异常兜底 + symlink 无限递归 + 重复复制
- 【位置】`lib.js:2986-2998`(copyTree)
- 【现状】readdirSync/statSync/copyFileSync 无 try/catch,权限/占用直接中断整个备份;Envir 含指向祖先的符号链接会死循环;Envir 已含 MonItems 子目录又被单独复制一遍。
- 【改法】每项操作 try/catch 计入 skipped;copyTree 加 visited Set + 深度上限;复制 Envir 时跳过 MonItems 子目录。
- 【验证】含符号链接/只读文件的端备份不中断、不重复。

### T-R3-6 ⚡ 负数/非法输入穿透(多处)
- 【位置】`lib.js:2676/2681/2733`(genPersonalSpawn/genInstanceSpawn 的 count/range、spawnTable 的 limit)、`main.js:89-97`(do-op 概率)
- 【现状】`parseInt(x)||1` 对负数穿透(`-5 || 1 = -5`),生成 `MONGEN 怪 -5 3` 废脚本;`limit:'-5'` 时 `slice(0,-5)` 语义相反。
- 【改法】统一 `Math.max(1, parseInt(v,10)||1)`(limit 用 `Math.max(0,...)`);do-op 概率钳到 ≥1。
- 【验证】输入 -5/0 生成合法参数或提示。

---

## 二、🟠 数据破坏与安全

### T-P0-5 写回编码恒 GBK,UTF-8 端被写坏(全工具共性)
- 【位置】`lib.js:122-125`(encodeStr)+ 写路径:`writeMonFile:136`、`replaceScripts:1076`、`injectScript`、`writePortConfig/replacePorts`、`writeItemDesc/writeUnbindList`、`addMonGen/delMonGen:820/838`、`injectQManageTimer:2775`
- 【现状】encodeStr 恒 `iconv.encode(str,'gbk')`,读进 UTF-8、写出 GBK → 整文件乱码。
- 【改法】新增统一写助手并按原编码写回:
  ```js
  function encodeStr(str, enc) { if (iconv) return iconv.encode(str, enc || 'gbk'); return Buffer.from(str,'utf8'); }
  function writeTextFile(f, str) {
    let enc = 'gbk';
    try { if (fs.existsSync(f)) enc = detectEncoding(fs.readFileSync(f)); } catch (e) {}
    fs.writeFileSync(f, encodeStr(str, enc));
  }
  ```
  各写路径 `fs.writeFileSync(f, encodeStr(x))` → `writeTextFile(f, x)`。
- 【验证】UTF-8 BOM 的 MonItems 增删后仍 UTF-8 不乱码。

### T-P1-10 ⚡ 端口一键替换误伤非端口字段
- 【位置】`lib.js:1363-1368`(replacePorts)
- 【现状】对整文件所有 `=数字` 全局替换,`IdNum=5000`/连接串/注释数值被误改。
- 【改法】先用 readPortConfig 拿端口键清单,只替换端口键行;或按 `^(DBPort|GatePort|LogServerPort|MsgSrvPort|RunGate|SelGate|LoginGate|IDSPort)\d*\s*=` 过滤。
- 【验证】含 IdNum=5000 的配置替换 5000→7000,IdNum 不变。

### T-R3-9 ⚡ readScriptFile/saveScriptFile 路径穿越
- 【位置】`lib.js:3061/3075`
- 【现状】`rel` 未校验,含 `..` 可越出 Envir 读/写任意文件。
- 【改法】`path.resolve` 后校验前缀在 Envir 内,否则拒绝。
- 【验证】传 `Mir200\Envir\..\..\Config.ini` 被拒。

### T-P2-13 物品备注/解包写回丢注释 + GBK
- 【位置】`lib.js:3118-3133`(readItemDesc/writeItemDesc)、`3155-3167`(unbind)
- 【现状】读时跳过注释/表头,写时全量重写 → 注释永久丢失;GBK 固定写回。
- 【改法】按原行号替换(保留注释/空行/顺序);写回用 writeTextFile。
- 【验证】含注释的 ItemDescList 增删后注释保留。

### T-P2-7 ⚡ addMonGen/delMonGen 硬编码 CRLF 破坏 LF 文件
- 【位置】`lib.js:820-821/838`、`834`(delMonGen 留空行)
- 【现状】`rawLines.join('\r\n')` 把 LF 文件整体转 CRLF;删除后留空行堆积。
- 【改法】改用 preserveMonGenWrite(2493);删除改为从 rawLines 移除整行。
- 【验证】LF 文件增删后仍 LF、无残留空行。

---

## 三、🟡 静默失效(功能看起来成功实际没生效)

| 编号 | 位置 | 问题 | 改法 |
|---|---|---|---|
| T-R3-3 ⚡ | `lib.js:4147`(checkServerConfig) | DB 端口正则字面量 `\\s` 笔误,`dbsrc.ini` 永远匹配不上 → 引擎健检误报"DB 端口一致性 OK"(与 healthReport 3533/3537/4098 同根因,共 5 处) | `\\s`→`\s`、`\\d`→`\d`(healthReport 3 处 + checkServerConfig 2 处) |
| T-P2-18 ⚡ | `lib.js:3728-3729`(remoteListen) | `server.on('error')` 吞掉 EADDRINUSE,端口占用仍返回"已启动,监听 N",GUI 显示成功实际没起来 | error 回调记录失败;handler 返回前检查 `server.listening` |
| T-R3-21 ⚡ | `m2-reload.ps1:218-228` | `-Item` 为空时 `Contains('')` 恒真,误点击第一个叶子菜单触发任意重载 | 执行前 `if([string]::IsNullOrWhiteSpace($Item)){输出 RESULT:NO_ITEM;exit}` |
| T-R3-10 ⚡ | `lib.js:1694/1669/3721`(ftpSync/remotePush) | `require('basic-ftp')` 缺失同步抛;`fetch` 在 Node<18/SEA 无全局 fetch 抛 ReferenceError;连接失败不 close | require/fetch 包 try/catch 返回 `{ok:false,msg}`;提前 return 前 close |
| T-R3-19 ⚡ | `main.js:337-342` + `renderer.js:890` | mg-adjust handler 丢 skipped 字段,排除统计永不显示 | handler 返回 `{ log, skipped: r.skipped }` |
| T-R3-20 ⚡ | `main.js:350` + `lib.js:2932` | dynamic-spawn handler 读 `r.qm`,lib 从不返回该字段,QManage 注入反馈恒丢失 | 改读 `r.timerId`,或 lib 返回 `qm` |
| T-R3-26 | `lib.js:1406-1416`(checkPortInUse) | 仅 TCP 探测,UDP 网关端口误报空闲 | 结果标注"TCP 探测"或加 UDP 探测 |
| T-R3-16 | `lib.js:2154` + `store-template.txt:1377` | genStoreScript 的 interval 赋值后未使用(功能项,顺手修) | applyRepl 替换间隔数字 |

---

## 四、🔵 输入校验与边界(静默出错)

| 编号 | 位置 | 问题 | 改法 |
|---|---|---|---|
| T-P1-1 ⚡ | `lib.js:511/513`(addRate)、`main.js:89-97` | 概率 0/空 → 写入非法 `1/0`、`#CHILD 1/0` | 写入前 `n = Math.max(1, Math.round(+rate||0))`,否则报错 |
| T-R3-18 ⚡ | `lib.js:840`(addMonGen) | `!s.x || !s.y` 拒绝坐标 0,地图边缘 (0,0) 无法刷怪 | 改 `s.x == null || s.y == null` |
| T-R3-17 | `lib.js:1505`(removeInjectedBlock)、`1605`(delRobot) | name 未转义直接拼正则,含 `(`/`*` 时 overwrite 删不掉旧块、堆叠 | `name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')` |
| T-R3-13 | `lib.js:3068/3079` | readScriptFile/saveScriptFile 返回 size 单位不一致(字节 vs 码元),前端"已保存"误判 | 统一 `Buffer.byteLength(content,'utf8')` |
| T-R3-25 | `lib.js:1421-1426`(checkPorts) | 逐端口串行 TCP 探测,最坏 n×600ms | 并发限制(如 8) |
| T-R3-27 | `lib.js:644`(adjustRateFile) | 倍率 1 且无变化仍整体写文件,更新 mtime | `if (changed)` 才写 |
| T-R3-36 | `lib.js:3040`(listNpcFiles) | stat 无 try/catch,文件被并发删除时列表中断 | stat 包 try/catch continue |

---

## 五、🔵 反馈缺失与契约错位

| 编号 | 位置 | 问题 | 改法 |
|---|---|---|---|
| T-P2-28 ⚡ | `renderer.js:450-462/755-783/806/870/889/905/1168-1173` | 8 个按钮执行后零反馈(i-run/rb-list/rb-add/rb-del/sy-run/sl-run/mg-adjust/dy-run);x-run root 未判空 | 每处补 `appendLog(r.ok ? '✅ '+r.msg : '❌ '+r.msg)`;x-run 加 `if(!root) return` |
| T-P2-29 ⚡ | `renderer.js:298/336/366/374/638/662/713/797` | `r.log.join('\n')` 未判空,错误路径必崩 | 统一 `(r.log||[]).join('\n')` |
| T-R3-24 | `renderer.js:24` + `index.html` | `out()` 的 5 个目标 id(m-out/c-out/s-out/x-out/rc-out)在 HTML 不存在,面板输出区从未存在 | 补 5 个输出区,或 out() 改无参删各处 id |
| T-R3-22 | `m2-reload.ps1:141-149` | 不可见 Main/Form 窗口先枚举到会锁死选中;多开无 PID 筛选 | 可见性作强条件;按 -Root/PID 唯一化 |
| T-R3-32 | `lib.js:3752`(remoteListen) | body 超 64MB destroy 后 res 永久挂起 | destroy 前 `res.end(413)` |
| T-R3-35 | `main.js:276`(preview-site) | close 旧 server 后不置 null(卫生问题) | 顺手置 null |

---

## 六、🧹 工程残留与清理

| 编号 | 位置 | 问题 | 改法 |
|---|---|---|---|
| T-P2-24 | `lib.js:4213-4219` | module.exports 重复导出(allocFlags/listAllFiles x3 等) | 清理重复项 |
| T-P2-25 | `lib.js:1887-1996` | allocFlags/listAllFiles 各重复定义 3 份 | 保留第一份删后两份 |
| T-P2-26 ⚡ | `preload.js:5/65` | pickDir 重复定义(第 5 行被 65 覆盖) | 删第 5 行 |
| T-P2-30 ⚡ | `renderer.js:5/9/10/1142` | 残留 `[调试]` 日志刷屏 | 删除 |
| T-R3-30 | `lib.js:576`(adjustItem) | 死代码,导出从未调用,与 adjustRateFile 并存易分叉 | 删除或统一 |
| T-R3-31 | `main.js:323-325/111` | npc-list/npc-read/npc-save/quick-backup 四个死 handler(preload 暴露但 renderer 无调用) | 删除或补 UI 入口 |
| T-R3-29 | `lib.js:1560`(readRobots) | manageContent 存的是 AutoRunRobot 内容而非 RobotManage | 存 mc |

---

## 七、工具箱类修复顺序建议(按性价比)

1. **一行级崩溃**:T-P2-27(GPU)→ T-R3-1(qkLog)→ T-P2-31(空搜索)→ T-P1-4a(注入死循环)
2. **一行级静默失效**:T-R3-3(`\\s` 笔误 5 处)→ T-R3-21(ps1 Item 空)→ T-R3-19/T-R3-20(字段错位)→ T-P1-1(1/0)→ T-R3-18(坐标 0)
3. **数据破坏**:T-P0-5(编码)→ T-P1-10(一键替换)→ T-R3-9(路径穿越)→ T-P2-13(物品写回)→ T-P2-7(CRLF)
4. **反馈与契约**:T-P2-28/T-P2-29(8 处无反馈 + 未判空)→ T-R3-24
5. **清理**:T-P2-24/25/26/30 + T-R3-30/31/29

> ⚡ = 改 1-5 行即可完成;建议前 4 步(约 10 项一行级修复)一次批改完,每批跑 `node --check` 验证。
