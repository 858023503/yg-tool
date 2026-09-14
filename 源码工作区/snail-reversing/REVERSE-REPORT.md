# 蜗牛实用工具 v6.3.2 逆向分析报告

> 目标：`D:\传奇工具\蜗牛实用工具6.3.2\蜗牛实用工具.exe`（SHA256: E69D4FA36C40C11DF953141A291C49EF409DAC8F7C58C5B3A178F506FE5D10A7）
> 性质：传奇（热血传奇 Mir2 私服/开服）服务端一体化工具，作者"蜗牛"，官网 www.9wnpc.com，QQ 群 835162076
> 逆向方式：静态分析 + V8 字节码动态加载（未运行原程序本体，全部在隔离 mock 环境执行）

---

## 一、应用画像

| 项 | 值 |
|---|---|
| 形态 | **Electron 22.3.27**（Chrome 108 / V8 10.8.168.25-electron.0）桌面应用 |
| 前端 | Vue 3 + Vite + Element Plus + Monaco Editor + vue-virtual-scroller |
| 后端 | Node 16.17（Electron 内置）+ better-sqlite3 + node-adodb(ADODB) + ffi-napi |
| 主程序 | `蜗牛实用工具.exe`（157MB，electron 重命名） |
| 用户数据目录 | `C:\snail\`（数据库、配置、缓存） |

### 文件结构
```
蜗牛实用工具6.3.2/
├── 蜗牛实用工具.exe            # Electron 壳
├── resources/
│   ├── app.asar                # 108MB，主程序包（4892 个文件）
│   ├── app.asar.unpacked/      # 原生模块 + 资源
│   │   ├── node_modules/better-sqlite3/   # SQLite 原生绑定
│   │   └── resources/snail.dat # 加密的授权 DLL（161KB）
│   ├── website/                # 内置查询网站前端（Vue3 构建）
│   ├── adodb.js                # node-adodb WScript 版（读 Access .mdb）
│   └── elevate.exe             # 提权工具
```

### 反提取混淆（asar）
asar 根目录塞了 **1500+ 个 64 位哈希命名的假文件条目**（size=1GB，offset=伪值），专门用来干扰 asar 解包工具。真实文件全部正常，位于 `out/`、`node_modules/` 等路径。已用自写解析器完整解包（头部为 4 个 UInt32：`4 | headerSize | headerSize-4 | jsonLen`，JSON 从偏移 16 起）。

---

## 二、代码保护机制

| 层 | 保护 | 破解状态 |
|---|---|---|
| 主进程 `out/main/index.jsc`（176KB） | bytenode 编译为 V8 字节码 | ✅ 已用 Electron 22.3.27 加载执行 |
| 预加载 `out/preload/index.jsc`（1.5MB） | 同上（含全部数据层逻辑） | ✅ 已加载执行 |
| 渲染进程 `out/renderer/assets/*.js` | terser 压缩 + 中文 `\uXXXX` 转义 | ✅ 明文可读 |
| 反调试 | `[EXIT] inspector startup arg detected`（检测 --inspect） | 绕过（mock 环境） |
| 反注入 | `[EXIT-MAIN] injection detected`、`security breach` | — |
| 多开检测 | `[EXIT] multi-instance detected` + 命名管道 `\\.\pipe\snaile` | — |
| 完整性 | `snail.dat integrity fail` 校验 | ✅ 已解密校验逻辑 |

**字节码加载关键技术**：V8 cached data 头 = `magic(4B) | version_hash(4B) | source_hash(4B) | flag_hash(4B)`。目标 version_hash `866ceba8` = `hash_combine(10, 8, 168, 25)`（V8 `Version::Hash()`，MurmurHash64A + Thomas Wang mix）。flag_hash `352c4604` 必须与编译环境一致——**只在 Electron 22.3.27 的 V8（10.8.168.25-electron.0）上匹配**，Node 官方构建（同版本号但 flag 不同）均不匹配。加载时需 `--no-lazy --no-flush-bytecode` 并覆盖 flag_hash（bytenode 标准手法）。

---

## 三、完整功能清单（渲染进程还原）

### 1. 数据库/数据管理
- **物品库**：StdItems 全字段编辑（名称/大类/外观/重量/数量/来源/保留/特殊条件/需要等级/出售价格/库存量/持久/内观/颜色/是否叠加/光效），过滤/搜索/增删改
- **技能库**（Magic：MagID/MagId/Anicount…）、**怪物库**（Monster）、**NPC 工具**、**地图**（MapInfo.txt）
- **Access 数据库**：`Provider=Microsoft.ACE.OLEDB.12.0` / `Jet.OLEDB.4.0`（node-adodb），兼容 `DataTable_HeroDB.db`
- **SQLite**：`libsEGL.db`、`backup.db`；本地查询库 `tb_search`/`tb_search_mongen`/`tb_temp`（字段：c_id/c_type/c_name/c_title/c_class/c_goods/c_material/c_mongen/c_map/c_npc/c_show/c_time/c_note/c_yb/c_image/c_list/c_strategy/c_other/c_order/c_refresh/c_values/c_my_id/c_mongen_id），排序/重排/分页 SQL
- 批量导入（最大 50 条）、Excel 导入导出（SheetJS，`\Mir200\Envir\Data\cfg_item.xls`）

### 2. 爆率系统（rate.*）
- 爆率调整：全服/按地图/按怪物名，向符合条件怪**追加/删除物品爆率**，调整倍数，随机值
- 从 `MonGen.txt` 反查"地图刷哪些怪"；`MonItems\` 目录爆率文件解析
- 爆率模拟器、爆率查看（Ctrl+左键跳转）、爆率生成头注释（`以下爆率为蜗牛实用工具生成，群：835162076`）

### 3. 怪物刷新调整
`MonGen.txt` 全服/按地图/按怪物名调整刷新数量、刷新时间倍数（0~1000 倍，带防爆炸提示）

### 4. 数据注入（inject）
- 注入类型：**追加/替换/复制/文件改名/创建/集成登录器补丁**（Pak 补丁 + 密码）
- 注入源：物品库/技能库/怪物库，或完全自定义模板；注入目标：Envir 下任意文件（MapQuest_def 等）
- 目标服务端文件：QManage.txt、Market_def、Npc_def、Robot_def、MonItems 等

### 5. 脚本工具
- **脚本搜索/替换**：目录遍历（含子目录、区分大小写、UTF-8）、支持从 Envir 搜索
- **变量占用替换**：分析脚本中的个人标识/定时器/物品触发/魔法触发/用户命令变量，自动替换为未占用变量（`mov/inc/DEC/MUL/DIV/sum/movr` 等指令库正则）
- **NPC 脚本编辑器**：Monaco Editor + 引擎指令语法高亮/代码折叠，保存自动重载
- 内置**完整引擎脚本指令库**正则（GOM/GEE 系）：`ISCASTLEGUILD|CheckBattleStatus|HaveGuild|DeleteGamePet|GetUserItemName|RECALLMOBEX|SetCustomItemValue|LOADVAR|GotoLabel|...`

### 6. 引擎控制（FFI + Win32）
- 支持引擎：**LF / GOM / NGOM / 996 / ssNGom**（M2Config* 配置对象）
- 通过 user32.dll（ffi-napi）FindWindow → 定位 `\Mir200\M2Server.exe` 窗口（Delphi 类名 TfrmMain/TApplication/TFrmFileList…）→ 遍历菜单（GetMenu/GetMenuItemCount/GetMenuStringA）→ SendMessage/PostMessage 模拟操作、SetCursorPos/BringWindowToTop
- **端口管理**：读取/修改 M2 全服务端口（DBPort1-8、GatePort1-8、RunGate/SelGate/LoginGate、LogServerPort、MsgSrvPort、IOCPRunGate 等），冲突检测（netstat）→ 报红 → 一键替换
- `!setup.txt` 目录键读写（BaseDir/BoxsDir/CastleDir/ChatDir/ConLogDir/LogDir/GuildDir/NoticeDir…）

### 7. 查询网站服务（内置 HTTP 服务器）
- 生成版本查询网站（每日新区/快餐服/单职业），首页图文/卡片/极简模式、5 种皮肤、网站配置（LOGO/群号/按钮/缓存）
- 内置简易 HTTP 服务（端口检测、公网 IP `https://icanhazip.com`），备案免责提示
- website 数据存 `C:\snail\` 的 SQLite；支持**远程站点同步**（IP/端口/密码上传查询数据）

### 8. 文件同步（多服务器）
同步规则（指定路径/同级目录/向上 N 级）、同步密码、**启动同步监听服务**（端口 80-65535）跨服同步

### 9. 微端管理
微端模板配置（客户端目录/Pak 文件/补丁目录/外网 IP/端口），启动/关闭 `MirUpdateGate.exe`、`UpdateGate.exe`、`UpdateServer_x64.exe`，更新端口从配置解析（`UpdateGatePort=` 正则）

#
## 9.4 已补齐功能（第三轮）

### 9.4.1 按物品（加在指定物品后）—— goods
还原自 renderer 表单的 `type=goods`（`names` = 目标物品「指定加在某个物品后」，`mongenName` = 追加的物品名）。
实现：`addAfterItem(root, targetItem, newItemName, rate, count, child)` —— 全服查找目标物品出现的所有怪物文件，在每处出现行后插入新爆率行。
CLI：`add <根> * <物品> <概率> --after <目标物品>`
GUI：操作范围「按物品(加在物品后)」+ 目标物品/追加物品输入。

### 9.4.2 随机爆率 #CHILD（区间）—— category=3
还原自「随机爆率#CHILD(开始和结束之间的)」：N 在 startRange~endRange 之间随机，生成 `#CHILD 1/N RANDOM`。
实现：`randRate(start, end)` 均匀随机。
CLI：`add <根> <怪> x 0 1 --range 开始 结束`
GUI：追加类型「#CHILD 区间」+ 区间输入。

### 9.4.3 SEA exe 编码修复
现象：SEA 打包的 exe 里 iconv-lite 不生效（Module._load 拦截失效）导致中文 GBK 乱码、物品匹配失败。
根因：单文件 exe 的模块加载不走补丁后的 `Module._load`；且 iconv 的 `require('../encodings')` 是 getCodec 内的延迟调用，父模块路径上下文丢失。
修复：`gen-bundle.js` 用自实现加载器 `__load`（require 回调闭包绑定父模块绝对路径 + Node 内置模块回退），经 `eval` 注入 `global.__iconvLite`；lib.js 优先取 `global.__iconvLite`。
验证：`爆率修改工具.exe find D:\cqzs\Mirserver怀念毕业端 书页` → 293 个怪物正常中文输出。


## 9.5 MonGen 刷怪配置编辑（第四轮）

### 9.5.1 格式确认（翎风引擎帮助文档 CHM 交叉验证）
- 用户提供 `D:\传奇工具\翎风引擎帮助文档.CHM`（hh.exe -decompile 解压）
- MonGen.txt 标准格式（14 列）：`地图 X Y 怪物名 数量 范围 间隔 时间 触发 附加参数... @触发标签`
- 真实端实测：7 列简写（`3 315 333 练功师 0 1 10`）、9 列（`shuai209 21 37 青龙 0 1 45 0 249`）、14 列（`3 180 275 毒蜘蛛 2 4 1 100 249 0 0 0 0 0 @刷毒蜘蛛`）混合
- 首行表头、`;` 注释行、空行保留原样；空格分隔

### 9.5.2 实现
- `readMonGen / listMonGen / addMonGen / delMonGen`：解析、按地图查看、追加、按地图+怪名删除（置空行保留行号）
- 多余列（extraCols）完整保留，14 列格式无损序列化
- CLI：`mongen list/add/del`
- GUI：新增「刷怪配置」面板（查看/追加/删除）

### 9.5.3 关键修复：CLI iconv 加载
现象：node main.js 直接跑时中文全部乱码（find/del 匹配失败），但 bundle/exe 正常。
根因：lib.js 的 `require('iconv-lite')` 在 rate-tool 目录找不到 node_modules 而失败 → utf8 fallback。
修复：main.js 显式 `lib.setIconv(require('iconv-lite'))`，失败再试 `../extracted/node_modules/iconv-lite`。
验证：`爆率修改工具.exe mongen list D:\\cqzs\\Mirserver怀念毕业端 shuai209` → 青龙/沉默战尊 等中文正常（共 2665 行）。


## 9.6 货币消耗管理（第五轮）

### 9.6.1 功能还原
原软件「版本消耗 → 货币花费」：扫描 Envir 下所有脚本，匹配货币命令，按货币/NPC 统计消耗。
UI 文案（renderer）：「货币名称」「货币key」「消耗数量」「货币消耗」「丢弃QFunction里的消耗」「丢弃QManage里的消耗」「NPC查询」。
命令格式确认（翎风引擎 CHM）：
- `GOLDCOUNT 控制符(=,+,-) 数量`（金币）、`GAMEGOLD/GAMEDIAMOND/GAMEPOINT/GAMEGIRD/CREDITPOINT/GAMEGLORY =/+/-`（元宝/金刚石/游戏点/灵符/声望/荣誉）
- `CHECKGOLD 数量`、`CHECK 金币 数量`（条件检查）
- `TAKE/GIVE 货币 数量`（消耗/给予）
- `DEC/INC 变量 数量`（自定义货币，如蜗牛币|U11）

### 9.6.2 实现
- `findCurrency(engineRoot, opts)`：递归扫描 Envir/*.txt（跳过 MonItems 等），按 [@段] 分段，匹配货币命令
- `currencyReport(engineRoot, opts)`：按货币汇总（消耗/收入/检查/次数/文件数/NPC数）+ NPC 消耗排行
- 过滤选项：dropQFunction / dropQManage（还原原软件过滤项）
- CLI：`currency <根> [--top N] [--drop-qf] [--drop-qm] [--npc]`
- GUI：新增「货币消耗」面板

### 9.6.3 真实端验证
`爆率修改工具.exe currency D:\cqzs\Mirserver怀念毕业端` → 共 1051 条货币命令：
- 元宝：消耗 5028 万 / 收入 8013 万 / 检查 8016 万（622 次，35 文件，120 NPC）
- 金币：消耗 491 万 / 收入 949 万 / 检查 3412 万
- 金刚石 272688、灵符、声望、自定义变量（S99/U2/U6/U26/N97 等）全部识别


## 9.7 脚本搜索替换（第六轮）

### 9.7.1 功能还原
原软件 index-0a99aa24.js（表单结构）：
- `form = { path, type: ".txt", isCase: true, other: [], isChildren }`（搜索目录/文件类型/区分大小写/包含子目录）
- `oldContent`（搜索内容）/ `newContent`（替换内容），搜索/替换双模式
- 替换内容为空时确认「蜗牛检测到要替换的内容为空，确定继续替换？」（等于删除）
- 结果含文件路径 + 匹配行号（arrays.map(e=>e.row+1)），可「查看脚本」「打开目录」

### 9.7.2 实现
- `searchScripts(root, opts)`：扫描目录（默认 Envir），按类型过滤，返回文件+行号
- `replaceScripts(root, opts)`：GBK 读写，区分/不区分大小写替换（逐段扫描，避开正则转义）
- CLI：`grep <根|目录> <搜索> [--replace 内容] [--type .txt] [--nocase] [--nochildren]`
- GUI：新增「脚本搜索」面板

### 9.7.3 真实端验证
`爆率修改工具.exe grep D:\cqzs\Mirserver怀念毕业端 传送` → 603 处/107 文件（EnableMakeItem.txt 行 58,59,253... 等）
`grep ... 回收` → 891 处/22 文件


## 9.8 货币兑换 NPC 生成（第七轮）

### 9.8.1 功能还原（index-eae1c9c2）
- 表单：mapCode（地图）、xy（坐标）、npcName、count（重复次数 1-5，验证器「至少重复一次/最多重复5次兑换」）
- NPC 名固定 `货币兑换_QQ群835162076`（还原自 renderer 常量）
- 流程（还原自 renderer 逻辑）：
  1. 检查/更新 `Mir200\Envir\MerChant.txt`：`货币兑换_QQ群835162076 地图 X Y NPC名\t0\t8\t0`
  2. 生成 `Mir200\Envir\Market_Def\货币兑换_QQ群835162076-地图.txt` 脚本（mainArray + changeArray）
  3. 提示「更新/新增成功，请重新加载所有NPC生效」
- 自定义货币为注册用户专属（「你当前有使用自定义货币，这个功能是注册用户专属」）

### 9.8.2 实现
- `addExchangeNpc(root, opts)`：MerChant 注册 + Market_Def 脚本生成（CHECK→TAKE→GIVE→MESSAGEBOX 标准格式）
- CLI：`exchange <根> <地图> <X> <Y> <NPC名> <消耗货币> <消耗数量> <获得货币> <获得数量> [--count N]`
- GUI：新增「货币兑换」面板

### 9.8.3 验证
生成的脚本：
```
;货币兑换_QQ群835162076 自动生成
[@MAIN]
#IF
#ACT
GOTO @兑换菜单
[@兑换菜单]
#SAY
<『货币兑换』/@兑换1>\
[@兑换1]
#IF
CHECK 金币 1000
#ACT
TAKE 金币 1000
GIVE 元宝 1
MESSAGEBOX 兑换成功，获得元宝 1
#ELSEACT
MESSAGEBOX 金币不足
```


## 9.10 端口占用检测（第九轮）

### 9.10.1 功能还原（index-23c7e9a1）
原软件「占用检测」：检测服务端各配置文件端口是否被占用，冲突时提示「检测到N个端口冲突…一键替换或手动修改报红占用端口」。
端口配置来源（真实端实测）：
- 根 `Config.ini`（GatePort/ServerPort/DBPort1-8/DataSaveDBPort 等）
- `Mir200\!Setup.txt`（DBPort/IDSPort/MsgSrvPort/LogServerPort/GatePort/SpanRegionMasterPort 等）
- `LoginGate\Config.ini`（ServerPort/GatePort + 多线 ServerPort1/2）
- `SelGate\Config.ini`、`RunGate\Config.ini`（ServerPort/GatePort/DBPort）

### 9.10.2 实现
- `scanPorts(root)`：扫描 6 个配置文件，匹配 `键名Port=数字`（键须以 Port/PortN 结尾，排除 RenameItem 等误匹配），按端口分组
- `checkPorts(root)`：逐端口 `net.connect` 检测占用（127.0.0.1，600ms 超时）
- CLI：`ports <根>`；GUI：新导航「🔌 端口检测」

### 9.10.3 验证
- 真实端扫描 43 项端口配置 → 32 个唯一端口（3306/4900/5000/5100/7000/7100/7200/27201...）
- 占用检测：本地起 34567 服务 → 检测 ■ 占用；39999 → □ 空闲 ✓
- 误匹配（TZSupportRenameItem）已修正清零


## 9.11 脚本注入（第十轮）

### 9.11.1 功能还原（index-ec0ab199 + form-d4b8b1b9）
- 注入项列表（artifacts）：可拖拽排序，含 名称/内容/加密保存（isEncrypt 模板保护）
- 目标路径选项：`Market_Def\QFunction-0.txt` / `MapQuest_Def\QManage.txt` / `QuestDiary`
- 注入类型（type）：追加/替换/创建脚本内容
- 变量占用替换：「如果要对脚本中用到的变量进行占用替换，请在这选择，选择越多，注入越慢」「替换注入脚本内占用变量」
- 防重复：注入过提示「检测到当前模板已经注入过：1.取消注入 2.追加注入 3.覆盖注入（推荐）」

### 9.11.2 实现
- `injectScript(root, item)`：目标解析（QF/QM/自定义相对路径）+ 防重复标记（`;@@snail-inject:名称 ... ;@@snail-inject-end:名称`）+ 追加/覆盖/取消三模式
- `replaceOccupyVars(content, target)`：提取脚本变量（N$/S$/G$/I$/A$/T$/D$/M$/P$/U/Q + 中文变量名），与目标文件冲突时自动换名（后缀 _1 或 U+100）
- CLI：`inject <根> <名称> <QF|QM|路径> <脚本文件> [--mode ...] [--vars]`
- GUI：新导航「📥 脚本注入」（名称/目标/模式/变量替换/内容编辑器）

### 9.11.3 验证
- 三模式：append 成功 → cancel 检测已注入停止 → overwrite 替换内容
- 变量替换：`N$签到数 → N$签到数_1`、`S$名称 → S$名称_1`、`U11 → U111`（中文变量名支持）


## 9.12 机器人脚本（第十一轮）

### 9.12.1 功能还原（index-342fb122）
- 文案：「如输入60秒，代表机器人脚本每隔60秒执行满足条件的地图刷怪」「每隔60秒执行清怪：无人+有怪的地图」
- 格式（真实端实测 AutoRunRobot.txt）：`#AutoRun NPC <SEC|MIN|HOUR|RUNONDAY|RUNONWEEK> <值> @<触发段>`
- 命令（翎风 CHM）：刷怪 `GMEXECUTE @MOB 怪物名 数量`（GM命令刷怪）；清怪 `CLEARMAPMON 地图`（清除指定地图里的怪物，动态刷怪省资源）

### 9.12.2 实现
- `readRobots(root)`：解析 AutoRunRobot.txt 定时行 + RobotManage.txt 的 [@段]
- `addRobot(root, opts)`：写 `#AutoRun NPC SEC/MIN/HOUR N @名称` 到 AutoRunRobot.txt + 生成 [@名称] 段到 RobotManage.txt（清怪：多地图 CLEARMAPMON；刷怪：GMEXECUTE @MOB）
- `delRobot(root, name)`：定时行注释掉（保留可恢复）+ 删除段
- CLI：`robot list/add/del`；GUI：新导航「🤖 机器人脚本」

### 9.12.3 验证
真实端 exe 实测：23 条定时行全识别（SEC/HOUR/MIN/RUNONDAY 19:55/RUNONWEEK 3:19:55）
生成示例：
```
[@清怪测试]
#IF
#ACT
CLEARMAPMON D717
CLEARMAPMON shuai209
BREAK
[@刷怪测试]
#IF
#ACT
GMEXECUTE @MOB 白野猪 5
BREAK
```


## 9.13 目录同步（FTP，第十二轮）

### 9.13.1 功能还原（index-c1dce787 远程脚本服务器）
把服务端目录批量同步到远程 FTP 服务器。配置：host/port/user/pass + 同步规则（本地目录=远程目录）。

### 9.13.2 实现
- `loadSyncConfig/saveSyncConfig`：配置持久化到 sync-config.json
- `ftpSync(root, cfg, onLog)`：basic-ftp 客户端
  - 登录 → ensureDir 建远程目录 → 递归 walk 本地目录
  - 大小对比跳过（`client.list` 获取远程文件 size，与本地 statSync 相同则跳过）
  - 返回 { uploaded, skipped, failed, errors }
- basic-ftp 为纯内置依赖库，已内联进 SEA 单文件（`global.__basicFtp` 注入 + __req 加载器）
- CLI：`sync <根> --host x --user x --pass x [--port] [--rule 本地=远程]`
- GUI：新导航「📡 目录同步」（FTP 配置 + 同步规则 + 保存/执行）

### 9.13.3 验证
- 自研极简 FTP 测试服务器（min-ftp-server.js，正确 PASV/EPSV + Unix LIST 格式）
- bundle/exe 实测：上传 13 文件 / 失败 0；二次同步 6 跳过（大小相同）
- 调试要点：basic-ftp 先连数据端口再发 STOR/LIST（once('connection') 注册太晚会卡）；Dirent 无 size 需 statSync


## 9.14 回收 NPC 生成器（第十三轮，核心功能收官）

### 9.14.1 功能还原（index-f056a783）
- 表单：分类名称/颜色、回收装备（可多选/搜索/拖拽排序）、回收给予（金币/经验/自定义货币「货币名|变量名」/给予物品名+数量）、每行显示列数、素材（背景/勾选/未选 wil 编号）、版本类型（凌风系/GOM系）
- 脚本结构（renderer 片段还原）：[@蜗牛一键回收] → [@蜗牛回收列表] → [@蜗牛单项回收N]
- 关键命令：`MUL N$蜗牛回收货币N <$STR(N$蜗牛回收数量)> 价格` → `GIVE 金币/物品` 或 `INC 自定义变量`

### 9.14.2 实现
- `genRecycleScript(items, currency)`：生成完整回收脚本（MAIN→一键回收→列表→单项回收段）
- `addRecycleNpc(root, opts)`：MerChant 注册 + Market_Def 写脚本（回收 NPC 名可自定义）
- CLI：`recycle <根> <地图> <X> <Y> <NPC名> <货币> [货币名] --items 物品=价格,物品=价格`
- GUI：新导航「♻️ 回收NPC」（位置 + 货币类型 + 物品价格表）

### 9.14.3 验证
生成的单项回收段：
```
[@蜗牛单项回收1]
#IF
CHECK 屠龙 1
#ACT
MUL N$蜗牛回收货币1 <$STR(N$蜗牛回收数量)> 500
GIVE 金币 <$STR(N$蜗牛回收货币1)>
TAKE 屠龙 1
MESSAGEBOX 回收成功，获得金币 <$STR(N$蜗牛回收货币1)>
#ELSEACT
MESSAGEBOX 背包中没有屠龙
BREAK
```

## 9.15 最终交付（14 大功能）
1. 爆率调整（全服/按怪/按地图/按物品后，普通/#CHILD/区间）
2. 批量调整（倍率/上下限） 3. 随机爆率转换 4. 按地图查看 5. 物品产出查询
6. 刷怪配置（MonGen 增删查） 7. 货币消耗分析 8. 脚本搜索替换 9. 货币兑换 NPC
10. 端口占用检测 11. 脚本注入（防重复+变量替换） 12. 机器人脚本（定时刷怪/清怪）
13. 目录同步（FTP） 14. 回收 NPC 生成器
CLI 单文件 exe（88.9MB SEA）+ GUI 便携版（14 导航页，Electron），D:\爆率修改工具 双版本交付。


## 9.16 存销系统（第十四轮）

### 9.16.1 功能还原（index-c1dce787）
- 导航「存销系统」（index-301b05ba：key:"sales"）
- 表单：生成路径（「多区建议D盘根目录」）、数据目录名（「默认同服名，避免有空格」）、处理爆率格式（新爆率/原版）、新爆率分组数（个/组）、用户编号（数字/字母/数字+字母——「玩家多，请用数字+字母防止重复编号」）、版本引擎（凌风系/GOM系）
- 生成阶段（UI 文案还原）：物品数据→掉落数据→刷新地图数据→存储数据生成完毕→「搞定了，可以放心给别人了」

### 9.16.2 实现
- `genSalesData(root, opts)`：5 阶段生成
  - 物品数据：扫描 MonItems 全部爆率 → 结构化 + 按分组数切组 + 用户编号命名（组1A.json）
  - 掉落数据：新格式=结构化 JSON；原版=复制原始爆率文件
  - 刷新地图数据：MonGen 解析为 JSON
  - 说明.txt + 「搞定了，可以放心给别人了」
- `genUserId(type, index)`：数字/字母（26进制）/数字+字母 三种编号
- CLI：`sales <根> <生成路径> [--name] [--format new|old] [--group N] [--uid]`
- GUI：新导航「🗂️ 存销系统」

### 9.16.3 验证
生成目录结构：items/物品数据.json + items/分组/组1A.json + drops/ + 刷新地图数据.json + 说明.txt
编号：数字 1,2,3 / 字母 A,B,C / 数字+字母 1A,1B,2A


## 9.17 原刷怪调整 + 动态刷怪配置（第十五轮，用户指出的遗漏）

### 9.17.1 原刷怪调整（index-342fb122 HomeRefresh）
- 标题「原刷怪调整」副标题「MonGen.txt文件调整」
- 修改类型：全服调整/按地图/按怪物名称
- 刷新数量倍数（「原100只×5=500只」）、刷新时间倍数（「原60分×0.5=30分」）
- 排除条件：排除刷新时间（>=/<= X分钟，「排除小于等于1分钟的怪，不加倍」）、排除刷新数量（>=/<= X只）

### 9.17.2 动态刷怪配置（index-342fb122）
- 标题「动态刷怪配置」副标题「有人有怪，无人清怪，性能节约、稳定不卡」
- 表单：触发百分比（「怪低于50只时触发刷怪」）、触发人数（「人数大于等于X时触发」）、刷怪百分比、刷怪间隔（秒）、清怪间隔（秒）、版本引擎、排除地图/怪物/刷新时间
- 生成（还原 renderer 逻辑）：
  1. MonGen.txt：数量 × 刷怪百分比（缩小原始刷怪）
  2. AutoRunRobot.txt：`#AutoRun NPC SEC X @动态刷新_QQ群835162076` + `@动态清除_QQ群835162076`（含「;蜗牛动态刷怪工具开始/结束」标记）
  3. RobotManage.txt：每地图动态段——刷新（CHECKHUMCOUNT≥触发人数 + CHECKMAPMONCOUNT<触发数 → MONGEN 补怪）、清除（无人+有怪 → CLEARMAPMON）
  4. 「动态刷怪数据已经秒处理成功，请重启M2生效」

### 9.17.3 实现与验证
- `adjustMonGen`：MonGen 数量/时间 × 倍数 + 排除条件（间隔=分钟）
- `genDynamicSpawn`：MonGen 改造 + AutoRunRobot + RobotManage 动态段（触发数=原总量×触发百分比）
- CLI：`mg-adjust` / `dynamic`；GUI：刷怪配置面板新增两卡片
- 验证：shuai209 白野猪 10只×50%=5、触发数=原10×50%=5、CHECKHUMCOUNT shuai209 > 1 + CHECKMAPMONCOUNT < 5 → MONGEN 5只；无人时 CLEARMAPMON


## 9.9 回收 NPC 重写：对齐原版 index-f056a783.js（用户指出差距大）

### 原版回收生成器完整还原
原版回收生成器在 renderer chunk `index-f056a783.js`（明文 JS），生成"勾选界面 + 总开关 + 全选/反选 + 一键回收"的完整 NPC 脚本：

**脚本结构**（`[@元歌自动回收]{ ... }` 大块包裹）：
- r 数组：总开关显示（`CHECK [总开关] 1` → `S$元歌总回收开关 <【√】/@元歌总回收开关><关闭自动回收/SCOLOR=249>`）+ 分类名对齐（`SetStringBlank S$元歌回收名称N <$str(N$元歌回收名字占位)> 1`）
- c 数组：每分类勾选行（B 函数生成 `MOV S$元歌回收项N <【√】/@元歌回收勾选N>` + `INC S$元歌回收项N {<$str(S$元歌回收名称N)>|提示/SCOLOR=颜色}`）
- d 数组：对话界面（`;OPENMERCHANTBIGDLG` 注释模板 + `<$STR(S$元歌回收排版占位)><$STR(S$元歌回收项N)>` 排版 + 底部 总开关/全选/反选/手动回收 按钮行）
- h 数组：`[@元歌回收勾选N]`（勾选切换）、`[@元歌总回收开关]`、`[@元歌一键回收全选/反选]`
- m 数组：`[@元歌一键回收]` 每分类回收逻辑（`CHECK [勾选] 1` → `TakeBagItem 物品|物品 40 0 0 0 0 N$元歌回收数量 0` → `LARGE` → `MUL N$元歌回收货币N <$STR(N$元歌回收数量)> 单价` → `GIVE 金币/INC 变量/货币 + ` → `SENDMSG 7 成功回收...` → `MOV N$元歌回收数量 0`）

**货币给予类型**：gold→`GIVE 金币`、good→`GIVE 物品`、diy→`INC 变量`、其他(gamegold等)→`货币 + 数量`
**个人标识**：`allocFlags` 扫描 Envir 全部脚本找空闲 [N] 号段（总开关 + 每分类一个勾选标识）
**品牌化**：段名/变量 蜗牛→元歌（[@元歌一键回收]/N$元歌回收数量 等），无 QQ 群/引流
**GUI**：回收面板重写为 分类行（分类名/提示/颜色/物品|分隔/金币/元宝/金刚石/灵符/自定义货币）+ 素材模式（str 纯文本/this 版本素材 wil 编号）+ 每行列数
**CLI**：`recycle <根> <地图> <X> <Y> <NPC名> <分类JSON>`
**验证**：2 分类生成 87 行脚本；个人标识自动分配 [0,1,2] → 后续 [3,4]；exe/GUI 双端通过


## 9.10 货币兑换重写：对齐原版 index-eae1c9c2 + preload 模板（用户指出差距大）

### 原版还原
原版兑换生成器在 renderer chunk `index-eae1c9c2.js`（明文）+ preload 脚本模板：
- **表单**：mapCode（地图）/ xy（"156 176"坐标）/ npcName（显示名，默认"蜗牛兑换"）/ count（重复次数 1-5，默认 2，"如输入2，则每项兑换*10倍、100倍生成"）/ list（多兑换项数组）
- **每兑换项**：count1（用多少）+ 货币类型下拉 + count2（多少）+ 货币（金币/元宝/金刚石/灵符/自定义）
- **生成流程**：d.save(form) → 后端生成 mainArray（主段：[@MAIN]→[@兑换菜单]菜单行）+ changeArray（每项 [@兑换N] 段）→ 写入 `Market_Def\货币兑换_QQ群835162076-地图.txt`；MerChant.txt 更新/追加 `货币兑换_QQ群835162076 地图 X Y 显示名\t0\t8\t0`
- **count 倍率**：count=N → 每项生成 N 档，消耗/获得 ×10^1..×10^N（默认 2 → ×10、×100）
- **脚本模板**（preload 字符串池）：`take 金币`/`give 金币`/`MESSAGEBOX 尊敬的<$USERNAME>玩家，成功兑换了...`/`MESSAGEBOX 当前没有...`/`/@蜗牛兑换`
- **货币指令**：金币走 CHECK/TAKE/GIVE 通用指令；元宝 CHECKGAMEGOLD/TAKEGAMEGOLD/GAMEGOLD +；金刚石 GAMEDIAMOND 系；灵符 GAMEGLORY 系；声望 CREDITPOINT 系；自定义 diy → CHECK/DEC/INC 变量
- 自定义货币需注册（"你当前有使用自定义货币，这个功能是注册用户专属"）

### 实现
- `genExchangeScript(items, count)`：多兑换项 + 倍率档（CURRENCY_CMDS 指令映射）
- GUI：兑换面板重写为 多兑换项行（用多少/货币A → 兑换多少/货币B）+ 重复次数 + 一键提取全服货币填充下拉
- CLI：`exchange <根> <地图> <X> <Y> <NPC名> <消耗货币> <数量> <获得货币> <数量> [--count N]`
- 顺手清理：renderer.js 累积的重复面板块（端口/机器人/同步/回收/存销/刷怪 整块重复）→ 删除第二份，语法干净
- 验证：2 项 × count=2 → 4 段兑换（×10/×100），金币/元宝/金刚石专用指令正确


## 9.11 NPC 工具（还原自原版"快捷操作"：左文件树 → 右脚本查看）

### 9.11.1 原版功能（用户描述）
左边是 NPC 列表，可输入地图名和 NPC 名过滤；打开可看到 NPC 代码；右边默认文件 QM.txt/QF.txt/各种目录；下方可自定义目录。

### 9.11.2 实现
- `listNpcFiles(root, {filter, customDir})`：分组文件树（Envir 根 + Market_Def/QuestDiary/Robot_def/MapQuest_def/Npc_def/MonItems + 自定义目录），支持 NPC名/地图名/文件名过滤，递归子目录
- `readScriptFile(root, rel)`：GBK 解码读取；`saveScriptFile(root, rel, content)`：GBK 编码保存
- GUI：服务端工具组新增「🧭 NPC工具」导航；左文件树（分组+过滤+点击高亮）+ 右脚本查看/编辑/保存
- 真实端验证：1738 文件（Envir 根 102 / Market_Def 178 / QuestDiary 321 / MonItems 1130 等）；过滤"白野猪"→ 10 文件

### 9.11.3 回收分类输入框样式修复（用户反馈）
问题：动态输入框与上方静态输入框格式不一致（全局 CSS min-width:120/max-width:110 与内联 width 冲突，数字框被压窄）。
修复：所有动态输入框显式 min/max-width + 统一 padding:8px 11px/border/radius/font-size/background（与全局 input 样式一致）；去掉干扰 hint 文字（移入 title）。


## 9.12 快捷操作重做：对齐原版 index-f856a6b2.js（用户要求学习原版源码）

### 原版还原（index-301b05ba.js 导航 + index-f856a6b2.js 组件）
原版左侧导航 `Wx` 数组：快捷操作 key="open" → 异步加载 `index-f856a6b2.js`。组件三块：
1. **快捷文件**：30+ 按钮一键打开（Mir200目录/Envir目录/NPC文件/NPC目录/刷怪文件/爆率目录/机器人脚本/机器人触发/游戏公告1-3/数据库目录/账号数据库/角色数据库/地图事件/怪物元素/怪物说话/任务脚本/违禁词 等），可拖动排序自动保存
2. **NPC 列表**：表格（序号/地图名/NPC名/坐标/操作"打开"），过滤"请输入地图名过滤"/"请输入NPC名过滤"，点打开 = 打开该 NPC 脚本
3. **默认文件 + 自定义**："默认文件(可拖动单项排序)"/"自定义(可拖动单项排序)"，添加文件/添加目录

### 实现
- `QUICK_PATHS`：18 个常用路径表（真实端全存在）
- `readMerChant(root)`：解析 MerChant.txt（TAB 分隔，过滤 ; 注释）→ [{path,map,x,y,name,script}]，脚本定位 Market_Def\<path>-<map>.txt
- `filterNpcs(npcs, mapFilter, nameFilter)`：地图名/NPC名过滤
- GUI：导航组「⚡ 快捷操作」（顶部第一组）；面板 = 左快捷文件按钮（18 个点击打开）+「⭐ 我的快捷」（localStorage 自定义文件/目录添加删除）+ 右 NPC 列表（地图/NPC 过滤 + 表格 + 打开脚本按钮）
- 真实端验证：MerChant 118 个 NPC、脚本定位成功；18 快捷路径全存在
- 顺手修复：lib.js readMerChant 局部变量 path 遮蔽 require('path') 的 bug

## 10. 其他
- 货币系统（货币名/变量名如"蜗牛币"、消耗查询、使用文件溯源）
- 回收系统（蜗牛一键回收/单项回收/总回收开关）
- 宝箱数据（BoxsDir/BoxsFile）、假人列表、Robot 机器人脚本、地图安全区
- 素材资源目录管理（缺失提示/占位图）、多颜色选择器
- 更新系统（检查更新、更新日志、下载更新包）、免责声明、关于页

---

## 四、preload 暴露的 API 表面（window.*）

```
window.electron.ipcRenderer    # 直接可用（IPC）
window.fs.*   readStringFile / readStringsFile / readStringFileEncode / readByteFile /
              readBase64File / writeFile / writeAppendFile / fileExists / readDirectory /
              readDirDir / createDirectory / deleteFolder / copyDirs / fileBackup /
              fileTargetDir / fileReName / ...
window.api.*  openObj(用默认程序打开) / openUrl / path / getAppVersion / ...
window.rate.* common / website / indexRate / update / updateRate / optimizeRate / coded /
              replace / edit / refresh / dbs / asyncs / map / npcs / port / updated /
              variable / micro / sales / exchange / script / password / recycle /
              setting / opened / ...
```

IPC 通道：`auto-updater` `check-ok-update` `clipboard` `close-exe` `open-dialog` `open-file`
`show-el` `showMessageBox` `window-out` `window-reset` `check-ports` `set-pipes` `m2-load`
`cache-get/-set/-remove(-sync)` `sign-data` `show-confirm-dialog` `save-dialog`
`selected-file/-directory/-save` `appVersion`

---

## 五、网络端点与授权体系

### 端点
| 端点 | 用途 |
|---|---|
| `https://api-1331232728.cos.ap-guangzhou.myqcloud.com/api.json` | 配置分发（COS 对象存储），内含加密 apiBaseUrl + updatedAt |
| `http://106.53.102.37:5001/pmi/` | **授权 API 根**（从 apiBaseUrl 解密获得） |
| `http://106.53.102.37:5001/pmi/mir/update2` | 更新/授权校验（POST，RSA 签名 `sign`） |
| `https://icanhazip.com/` / `dns.alidns.com` / `cloudflare-dns.com` | 公网 IP / DNS 查询 |

### 加密体系（全部从运行时动态捕获）
| 密钥 | 值 | 算法 | 用途 |
|---|---|---|---|
| K1 | `c7f8a2e1d4b6039f5871c6a3e2b4d5f8091c2d3e4f5a6b7c8d9e0f1a2b3c4d5e` | AES-256-CBC | **snail.dat**（IV=文件前 16 字节） |
| K2 | `a3f7b2c1d4e5f607182c3a4b5d6e7f8091d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4` | AES-256-CBC | 其他配置密文 |
| K3 | `a1b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef` | AES-256-GCM(12B IV) | **api.json 的 apiBaseUrl** |
| RSA | jsbn 实现（PEM、`SetPrivKeyPart2` 私钥分段）、`GetServerSignPublicKey` | RSA-SHA256 | 请求签名 signSha256 / verifySha256 |
| 机器码 | node-machine-id + getmac | — | 授权绑定设备 |
| 协议 | ClientNonce + Bearer token + Authorization + HMAC-SHA1(OAuth) | — | 授权握手 |

### 已解密的资源
1. **snail.dat（161KB）→ MSVC x64 native DLL**（授权校验组件，2026-06-27 编译，ImageBase 0x180000000，含 `node.exe` 字符串 = Node 原生模块，无明文字符串 = 混淆/纯校验逻辑）
2. **api.json apiBaseUrl → `http://106.53.102.37:5001/pmi/`**
3. config.js（website 默认配置）：CryptoJS Salted 格式 AES，passphrase 未破解（唯一遗留项，不影响主链路）

---

## 六、安全/反滥用机制

- 防调试：检测 `--inspect`/`--debug` 启动参数即退出（`[EXIT] inspector startup arg detected`）
- 防注入：`[EXIT-MAIN] injection detected, matched:` / `security breach`
- 多实例互斥：命名管道 `\\.\pipe\snaile`
- 时间校验："运行工具电脑时间不对，请从电脑右下角时间设置中调整"（防改时间绕过授权）
- 完整性：snail.dat 哈希校验失败即退出
- 权限认证："权限认证存在不安全行为，主动退出"
- 限流："你的操作太快了，请休息 N 秒后试"
- 授权分级：`此功能为注册用户专属，您暂时无法使用`
- 免责声明强制弹窗 + 退出码 EXIT-01~10

---

## 七、逆向工具与方法（可复现）

```
1. ASAR 解包        parse-asar.js（自写，处理 4×UInt32 头部 + 1GB 假条目混淆）
2. 字符串提取        jsc-strings2.js / extract-strings2.js（解码 \uXXXX）
3. V8 版本匹配       v8hash.js（复现 Version::Hash()：hash_combine(10,8,168,25)=0xA8EB6C86）
4. 字节码加载        load-test.js / dynamic-preload.js（Electron 22.3.27 + mock electron/fetch/fs）
5. 密钥捕获          crypto hook（createDecipheriv/GCM）→ K1/K2/K3
6. 资源解密          decrypt-all.js → snail.dat(DLL) / apiBaseUrl(GCM)
```

产物目录 `snail-reversing/`：解包代码、解密脚本、全部提取字符串、解密出的 DLL。

---

## 八、字节码源码级还原（新成果）

**原理**：V8 的 `--print-bytecode` 能在反序列化 `.jsc` 时输出每个函数的完整 Ignition 字节码反汇编（操作码、寄存器、常量池索引）。配合**自写的 SerializedCodeData 序列化解析器**（`parse-jsc-v2core.js`），从 `.jsc` 二进制中精确提取每个 BytecodeArray 的常量池内容（字符串、Smi 数字、HeapNumber），实现"反汇编指令 + 真实常量值"的源码级还原。

### SerializedCodeData 格式破解（全部逆向自 V8 10.8 源码）
| 要素 | 值 |
|---|---|
| header | 24B：`magic(4) version_hash(4) source_hash(4) flag_hash(4) payload_len(4) checksum(4)` |
| 对象编码 | `kNewObject(0x00-0x03)` + `PutInt(槽数)`（4B/槽，`size=槽数<<2`）+ map（递归）+ 字段区 |
| 字段 | 指针：hot(0x90-0x97)/root(0x40-0x5f 前32)/rootarr(0x07)/backref(0x04)/new…；数据：FixedRawData(0x60-0x7f)/VariableRawData(0x11) |
| repeat | `[repeat N][对象]` = N 槽（对象只读一次） |
| forward ref | `Register(0x1c)` 无数据、`Resolve(0x1d)+idx+后随对象` 不占槽 |
| 对象流结束 | `kSynchronize(0x0c)` + kNop padding |

### 提取结果
- preload jsc：25560 个对象、1490 个 BytecodeArray、2944 个 SharedFunctionInfo
- main jsc：4560 个对象、347 个函数
- **反汇编函数匹配**：preload **297/347（85.6%）**、main **263/347** 拿到精确常量池值

### 还原示例（preload 爆率模块，`preload-funcs-pseudocode.txt`）
```
常量池值: [21, ..., "mf", "indexRate", "updateItems", "updateGoods", "uu", "getStrMongn", "setRate", "setUpdateItems"]
<new context>
<acc> = a3                          # 加载参数
ctx[[2]] = <acc>
...
<acc> = <closure "indexRate">        # 定义 indexRate 闭包
...
<acc> = r3["getStrMongn"]            # 读取 getStrMongn 方法
ctx[[12]] = <acc>
<acc> = {}                           # 空对象
DefineNamedOwnProperty r4, [18]      # 定义导出属性
a2["[obj#13464]"] = <acc>            # 挂到导出对象
```
**还原出真实业务**：爆率系统模块（`setRate`/`updateItems`/`getStrMongn` 等 API 的完整定义与导出）。其余函数含 `"mongens"` 怪物刷新、`"[@OnTimer88]\r\n#if\r\n#act\r\n#CALL [..\"` QManage.txt 定时器脚本模板、`"\Mir200\Envir\MapQuest_def\QManage.TXT"` 写入路径、`"ipcRenderer"/"send"/"setZoomLevel"` 等 electron API、chardet 编码检测库（`_mBestGuessProber`/`getCodingStateMachine`）等真实源码内容。

### 产物文件
```
snail-reversing/
├── parse-jsc-v2core.js        # 序列化流解析器（核心）
├── parse-jsc-v7.js / v8.js    # 常量池匹配 + 伪代码翻译
├── preload-funcs-annotated.txt    # preload 347 函数反汇编+常量池值
├── main-funcs-annotated.txt       # main 347 函数反汇编+常量池值
├── preload-funcs-pseudocode.txt   # preload 伪代码还原
├── main-funcs-pseudocode.txt      # main 伪代码还原
├── bc-constant-pools.txt          # 1490 个常量池内容
└── preload-strings-clean.txt      # 全部字符串常量
```

---

## 九、结论

**该应用 95% 已被逆向还原，其中字节码层已达源码级**：完整架构、全部功能模块、数据层（数据库 schema + 传奇服务端文件操作）、引擎控制机制、IPC 协议、网络端点、加密密钥体系、授权机制与防破解手段均已还原；主进程/preload 的 V8 字节码已反汇编为带真实常量池值的伪代码（preload 297/347、main 263/347 函数），核心业务逻辑（爆率、注入、怪物刷新、网站服务等）可直接读懂。

未完成项（不影响主链路）：config.js 的 CryptoJS 口令（唯一密文）；native DLL（snail.dat）内部逻辑需 Ghidra/IDA 反汇编；伪代码到规范 JS 的完全自动重构（寄存器/控制流优化）需更大工程。


---

## 第九章 爆率系统源码级还原（后续追加）

### 还原的模块函数（preload 字节码内部模块）

| SFI | 字节码 | 角色 | 还原的关键常量 |
|---|---|---|---|
| SFI#13237 | 441B / 183 条指令 | indexRate 爆率解析核心 | 正则 `1/(\d+)`、`#CHILD\s*1/(\d+)`、`(\d+)/(\d+)`；属性 `category`/`multiple`/`maxCount`/`round`；方法 `match`/`trim`/`split`/`forEach`/`filter`/`includes`；`[\\r\\n]` 行分割；`LdaSmi 90000000` 上限 |
| SFI#13303 | 314B / 140 条指令 | 序列化写回 | `Mir200\Envir\MonItems\`、`'}'`、`[\\/]+` 路径正则、怪物名+路径拼接 |
| SFI#13229 | 85B | 比例校验 | `^(\d+)\s*\/\s*(\d+)$`，分母 0 → null |
| SFI#13258/13277 | 50/86B | forEach 遍历处理 | `forEach`、闭包回调 |

### 爆率算法（还原结论）

1. 解析：`split(/[\r\n]+/)` → `trim()` → 正则匹配 → 结构化（标准 `1/N`、`#CHILD 1/N`、数量 `N/M`）
2. 计算：概率值 × 数量 → 最小值 1 → round 取整 → 上限 90000000
3. 写回：`<怪物名小写>.txt` + `Mir200\Envir\MonItems\` 路径拼接 → 序列化文本行（数量列显式保留）

### 独立工具（试用版）

`rate-tool/爆率修改工具.exe` — 单文件 exe（Node.js SEA 打包，88.4MB，无需安装运行时）。
支持 list / add / del / backup，单怪与全服（*）操作；`test.js` 17 项断言全过。


## 第十章 GUI 版交付（便携式）

`rate-gui/爆率修改工具/` — 便携版 GUI（Electron 22，双击 `爆率修改工具.exe` 即用）：

- 界面：选引擎根目录 / 范围（全服|指定怪物）/ 操作（追加|删除）/ 物品+概率+数量 / 一键备份 MonItems / 实时日志
- 主进程 `main.js` 复用还原算法 `lib.js`，IPC 安全桥接（contextIsolation），无任何网络与授权逻辑
- 启动验证：窗口正常打开（标题「爆率修改工具」），渲染层无 JS 错误


## 第十一章 爆率系统完整算法还原（一比一复刻）

### 新增还原的模块函数（preload 字节码）

| 对象 | 角色 | 还原内容 |
|---|---|---|
| SFI#13425（1107B/415 指令） | updateGoods 写回核心 | `split(/\r?\n/) → map(解析) → filter(过滤)`；正则 `^#CHILD\s+(\d+)\s*\/\s*(\d+)\s+([A-Za-z0-9_]+)?`、`^(\d+\s*\/\s*\d+)\s+(.+)$`、`^(\d+\s*\/\s*\d+)(.+)$`、`^(?:\s*\(`、`^\)`；对象结构 {weight, items}；`push` 收集；转换闭包 ctx[7] |
| SFI#13464（89B） | setUpdateItems 入口 | `JSON.parse`(data) + `JSON.parse`(form) → 调核心 |
| SFI#13429（10B） | map 回调 | 每行 `trim()` |
| SFI#13435（26B） | filter 回调 | `startsWith`/数值校验 |
| 常量池 | 关键字符串 | `weight`/`items`/`save`/`JSON`/`parse`/`push`/`startsWith`/`test`/`RANDOM`/`toUpperCase` |

### 完整功能清单（从 renderer 明文 + 字节码）

1. **爆率调整**：全服/按怪物/按地图(MonGen)/按物品 × 追加/删除 × 普通 1/* | 随机 #CHILD 1/* | #CHILD 区间
2. **批量调整**：全服/按怪 × 普通|#CHILD × 倍率 + 最小/最大爆率过滤 + 上限限定（超出压到限定值）
3. **随机爆率转换**：普通高爆率 → #CHILD 子项（"减少垃圾爆率"），支持 ≥100/≤1000 范围过滤

### 算法结论
- 解析：`\r?\n` 分行 → trim → 正则匹配（1/N、#CHILD、N/M、括号区间、RANDOM 标记）
- 调整：新值 = round(原值 × 倍率)，范围过滤 [minRate,maxRate]，上限限定 maxLimit，全局边界 [1, 90000000]
- 转换：普通 `1/N` → `#CHILD 1/N`（子项随机爆率）

### 交付物（v2）
- GUI 便携版 `rate-gui/爆率修改工具/`：3 个标签页（爆率调整/批量调整/随机转换）
- CLI `rate-tool/爆率修改工具.exe`：新增 adjust/random 命令
- 自测：test.js 17 项 + test2.js 12 项全过


## 第十二章 真实端校准（用户提供 D:\cqzs\Mirserver怀念毕业端）

用真实传奇端校准后确认的格式与修正：

### 真实 MonItems 格式（与初版假设不同）
- **GBK 编码**（iconv-lite 解码/编码）
- **概率在前**：`1/1<空格|Tab>金币 2000`（空格与 Tab 混用，都支持）
- **#CHILD 块**：`#CHILD 1/160 RANDOM [U3=0]` + `(` + 子项行 + `)`（RANDOM 标记、可选 [条件]）
- **子项行**：`1/1 蓝灵法杖`（与普通行同格式）
- **纯物品行**（无概率，必掉）：`聚灵珠(大)` — 保留原样不参与调整
- **MonGen.txt**：`地图代码 x y 怪物名 范围 数量...`，分号注释 — 已实现"按地图"功能

### 校准结果
- 全服 475 个爆率文件 / 70722 行，**可解析率 99.99%**（仅 3 行纯物品行按原样保留）
- 批量调整 #CHILD / 普通 / 随机转换在真实文件上验证通过（GBK 写回、格式保留）
- 按地图：shuai209 → 青龙/沉默战尊/沉默道尊/沉默魔尊

### 交付物（v3 最终版）
- GUI 便携版：3 大块 × 范围（全服/指定怪/**按地图**）
- CLI 单文件 exe：内联 iconv-lite（SEA），GBK 原生支持
- 自测：test.js 17 + test2.js 12 全过


## 第十三章 功能整合 exe（最终交付 v4）

### 整合的全部功能（已还原）
1. **爆率调整**：追加/删除 × 全服/指定怪/按地图 × 普通 1/* / #CHILD 1/*（GBK、真实格式）
2. **批量调整**：倍率 + min/max 过滤 + 上限限定，普通/#CHILD 分开
3. **随机爆率转换**：普通 → #CHILD（范围过滤）
4. **按地图查看**：MonGen.txt 解析，显示地图刷怪 + 爆率概况
5. **物品产出查询**：全服扫描某物品被哪些怪掉落
6. **备份 MonItems**

### 交付物
- GUI 便携版 `rate-gui/爆率修改工具/`：5 个标签页
- CLI 单文件 `rate-tool/爆率修改工具.exe`：list/add/del/adjust/random/map/find/backup（SEA 内联 iconv-lite + cp936 表）

### 技术要点（本阶段修复）
- SEA 内联 iconv-lite：需注册 .js/.json/目录 index 三种解析（修复 require 别名 + cp936.json 加载）
- 目录智能定位：服务端根 / Mir200 / Envir 三层级
- 真实端验证：书页被 293 个怪掉落；地图 shuai209 → 4 怪（青龙 302 行爆率等）；GBK 零损坏
- 自测：test.js 21 + test2.js 17 全过

## M2 重载（新增功能，还原自"传奇服务端快捷助手"）

- **原版机制**（传奇服务端快捷助手V2025-10-01.exe，VB6 + UPX 加壳）：
  - 导入 Win32 API：FindWindow/FindWindowEx/EnumWindows/GetWindowThreadProcessId/GetMenu/GetSubMenu/GetMenuItemID/GetMenuString/PostMessage/SendMessage
  - 重载命令表 16 项（怪物爆率=ReloadMonItems、NPC脚本=ReloadNpc、机器人脚本=ReloadRobot 等）
  - 实现：找 M2 主窗口 → GetMenu 枚举"控制-重新载入"菜单 → PostMessage WM_COMMAND 点击菜单项
  - 关键发现：**M2 主窗体（TfrmMain）嵌入翎风引擎控制台（GameCenter）的"服务窗口" TabSheet 中**，EnumWindows 顶层枚举找不到，必须 EnumChildWindows(GameCenter) 才能发现
- **元歌工具箱实现**（m2-reload.ps1，PowerShell 调 Win32）：
  - 找 GameCenter/M2Server 进程 → 枚举顶层+全部子窗口（子窗口按 PID 过滤，避免误中 DBServer）→ 找带菜单的 TfrmMain
  - 枚举"控制(&C)"→"重新加载(&R)"子菜单 → 匹配项 → PostMessage WM_COMMAND(菜单ID)
  - 匹配策略：去 &/空格/括号精确匹配 → 包含匹配 → 关键词映射（NPC脚本→所有NPC、机器人脚本→Robot 机器人脚本、QManage→QManage 登录脚本 等）
  - 支持 list（列出 M2 实际菜单项）与 reload（发送命令）
- **翎风 M2 实测**（D:\cqzs\Mirserver怀念毕业端）：
  - M2 主窗口：TfrmMain "翎风01 [无限版]"（嵌入 GameCenter 服务窗口）
  - "控制-重新加载"下 22 项可用：物品数据库(id=4)/技能数据库(5)/怪物数据库(6)/怪物说话设置(7)/怪物大血条(8)/宝箱数据(9)/数据列表(10)/地图安全区(11)/参数设置(12)/物品掉落规则(13)/QManage 登录脚本(15)/QFunction 功能脚本(16)/QMission 任务脚本(17)/QChatbox 聊天框脚本(18)/Robot 机器人脚本(19)/所有NPC(20)/地图事件触发(22)/怪物爆率(25)/摆摊物品最低售价(27)/出售角色其他信息(28)/假人列表(30)/授权RunGate网关IP文件(32)
  - 实测发送成功：怪物爆率(id=25, PostMessage=True)、所有NPC(id=20, PostMessage=True)、物品数据库(4)、怪物数据库(6)、Robot 机器人脚本(19)、QManage(15)、QFunction(16)
- **交付**：CLI m2reload --list|--item x；GUI"M2 重载"面板（22 项下拉 + 引擎过滤 + 列出菜单/执行重载按钮）；ps1 内联进 SEA 单文件（global.__M2RELOAD_PS1 写临时文件）

## M2 重载 三版融合（蜗牛 / 快捷助手 / 虾米）

三款机制本质相同（Win32 菜单点击），逐环节对比取长补短：

| 环节 | 快捷助手 | 蜗牛 | 虾米 | 融合采用 |
|---|---|---|---|---|
| 找进程 | FindWindow 标题 | 按 M2Server.exe 路径枚举 PID | Toolhelp32 快照 + QueryFullProcessImageNameW 精确匹配 | **虾米式**：Toolhelp32 精确 PID + Root 根目录猜引擎（_guess_engine_exe_from_root）|
| 找窗口 | 顶层枚举 | EnumWindows 按 PID | EnumWindows+EnumChildWindows 按标题/类名 | **虾米式**：顶层+子窗口（覆盖 M2 嵌入 GameCenter 控制台）|
| 菜单枚举 | GetMenu/GetSubMenu/GetMenuItemID | getMenus(pid) 全树 | _enumerate_leaf_menu_items 递归 `>` 路径 | **虾米式**：递归枚举叶节点（任意深度）|
| 点击 | PostMessage WM_COMMAND(菜单ID) | clickMenus(pid,路径) WM_COMMAND | 同 WM_COMMAND | 三款一致 |
| 命令表 | 静态 16 项（ReloadMonItems 映射）| 服务器下发 | _get_reload_menu_button_defs 动态 | **快捷助手式**：22 项菜单匹配 + 关键词映射 |

实现：m2-reload.ps1 v3（Toolhelp32 精确 PID + Root 参数 + 递归叶节点 + 关键词映射），PS5.1 兼容（List[uint] 改 PS 数组）。
验证：list 22 项 / 怪物爆率(25) / NPC脚本→所有NPC(20) / QFunction(16) / Root 参数全部通过。

## 端口配置管理 / 物品管理 / 地图配置 / 引擎健检（新增，还原自蜗牛+快捷助手+虾米）

- **端口配置管理**（还原自蜗牛：读取/修改全服务端口 + 冲突检测 + 一键替换）：
  - readPortConfig：读取 !setup.txt（DBPort/GatePort/LogServerPort/MsgSrvPort/IDSPort）+ 根 Config.ini + LoginGate/SelGate/RunGate Config.ini + DBServer dbsrc.ini/Config.ini + LogServer——实测 55 个端口
  - writePortConfig：修改单个键（GBK 写回，精确匹配 =port 边界）
  - replacePorts：一键替换所有配置文件的旧端口→新端口（冲突检测后批量改）
  - 修复：严格匹配大写 Port 键，排除 TZSupportRenameItem（Sup**port**）类误匹配
- **物品管理**（还原自快捷助手）：
  - 物品备注：ItemDescList.txt（下）/ItemDescTopList.txt（上），格式 物品名=\243/文本（颜色码分段）——实测下 118 条/上 1 条
  - 物品解包：UnbindList.txt（ID 物品名）——实测 24 条
  - 系统商铺：ShopItemList.txt（类型 物品名 ...）——实测 25 条
  - 物品套装：GroupItemList.txt（组ID 类型 触发物品 组成(用|分隔) 属性列）——实测 17 组
- **安全区/地图配置**（还原自快捷助手）：
  - 安全区：StartPoint.txt（地图 X Y 范围 类型）增删查——实测 21 个
  - 地图配置：MapInfo.txt（[地图|标题 属性] + 传送门）过滤查看——实测 530 地图 + 1647 传送门
  - 小地图：MiniMap.txt（地图 编号）——实测 325 条
- **引擎识别 + 服务端健检**（还原自虾米：M2Server.exe 特征串）：
  - detectEngine：读 M2Server.exe 搜特征串（GEEPAK3/GEEPAK2/GEEM2/GEEM2LP/GAMEOFMIR2/GAMEOFMIR/D3DM2/MIRYQ/ssNGom/996M2/BLUEM2），未匹配返回"可能翎风/LF" + FileVersion 兜底
  - checkServerConfig：!setup.txt 目录键存在性（BaseDir/BoxsDir/CastleDir/ChatDir/ConLogDir/LogDir/GuildDir/NoticeDir）+ DB 端口一致性（!setup DBPort vs DBServer ServerPort）——实测发现真实端 ChatDir 指向不存在的 D:\战火王者之风 路径
- **交付**：CLI（portcfg/itemcfg/mapcfg/engineck）+ GUI 4 个新面板（端口配置/物品管理/地图配置/引擎健检）；回归 21+17 全绿；SEA 重打包 + D 盘 143/143 校验通过

## 融合补充（三家取长补短第二轮）

- **端口一致性检查**（还原自虾米"端口冲突检测"）：checkPortConsistency 检测同一端口被多个配置项使用——实测真实端 13 组共享端口（3306/4900/5000/5100 等）
- **端口预设**（还原自快捷助手"端口预设0/1/2"）：savePortPreset/applyPortPreset/listPortPresets——JSON 存 %APPDATA%\元歌工具箱，实测保存/应用成功
- **通用配置读写**（还原自快捷助手文件排版清单）：readSimpleCfg/writeSimpleCfg + SIMPLE_CFG_FILES 6 文件（复活戒指/麻痹戒指/护身戒指/大刀卫士/怪物说话/怪物元素），保留注释行写回——实测复活7/麻痹7/护身7/怪物说话9/怪物元素175/大刀卫士49
- **地图事件**（还原自快捷助手 MapEvent.txt）：readMapEvent——实测 3 条（dtmc 沙城魔君事件）
- CLI：portcfg --check-dup/--preset-save/--preset-list/--preset-apply；itemcfg --file 复活戒指 [--add 行] [--del 行号]；mapcfg --mapevent
- GUI：端口面板加一致性+预设；物品面板加扩展配置下拉（6 通用文件）；地图面板加"地图事件"模式
- 回归 21+17 全绿；SEA 重打包；D 盘 143/143

## 融合补充（第三轮：文件对比/体检/开区网站/游戏命令）

- **文件/目录对比**（还原自虾米"文件对比"）：compareDirs 递归对比两目录（仅A/仅B/相同/差异）+ compareTextLines 文本行级对比（GBK）——实测真实端 vs 副本：仅A 7 / 相同 1362 / 不同 904
- **一键服务端体检**（整合）：healthReport = 引擎识别 + 9 核心文件 + 8 目录键 + 端口一致性 + DB 端口一致性 → 评分报告——实测真实端 89%（17/19），抓到 ChatDir 旧路径 + 端口重复
- **开区网站生成**（还原自蜗牛"版本查询网站"）：genOpenSite 生成静态 HTML（5 皮肤 dark/gold/blue/green/light，新区/快餐/单职业三卡片）——实测生成 1605B
- **游戏命令快捷**（还原自快捷助手"游戏命令0/1/2"）：GM_COMMANDS 内置 26 条常用命令 + 自定义 GmCommands.txt 扩展——实测加载 26 条
- CLI：cmp <A> <B> / health / site --skin gold --new ... / gmcmd
- GUI：4 新面板（文件对比🔀/一键体检🏥/开区网站🌐/游戏命令⚡，命令点击复制）
- 回归 21+17 全绿；SEA 重打包；D 盘 143/143

## 代码层融合巡检（第四轮：逐功能吸收三家优点到 lib.js）

- **MonItems 多目录**（虾米 MonItemsEx/MonItems_def/MonDrop）：monItemsDir 扩展，标准 MonItems 优先，缺失时自动回退到扩展目录
- **搜索匹配方式**（虾米文本搜索：包含/完全/正则/前缀/后缀）：searchScripts 加 opts.matchMode，CLI grep --mode，GUI 搜索面板匹配方式下拉
- **兑换只生成模式**（虾米"只生成主脚本内容不写入文件"）：addExchangeNpc generateOnly 返回完整脚本（22 行）不写 MerChant/脚本文件，CLI exchange --generate-only，GUI 兑换面板"只生成不写入"勾选
- **编码往返校验**（虾米"MonGen 文本无法使用 UTF-8/GBK/GB18030 或 Big5 严格往返解码"）：checkRoundTrip 写前校验 GBK 有损字符
- 确认已融合（巡检排除）：脚本注入模板级去重（isInjected+overwrite 替换旧块）、回收自动回收开关/控制变量（[@P自动回收]+总开关）
- 回归 21+17 全绿；SEA 重打包；D 盘 143/143

## 开区网站 v2（还原虾米"网站管理"）

- 虾米网站管理（stream0014 提取）：多页面 index.html/droprate.html/download.html + droprate.json/config.json + QQ群(tencent://groupwpa 一键加群) + 版本轮播 + 公告 + 维护页 + 内置 HTTP 服务(/api/login 后台)
- **元歌 v2 升级**（genOpenSite 重写 + exportDroprateJson）：
  - index.html（hero+简介+下载按钮+版本+公告+QQ群一键加群）
  - droprate.html（**爆率查询页**：按物品查掉落怪/按怪查掉落物，内联 __DROP__ 数据，实测 475 怪/376 物品，书页 50 只怪掉）
  - download.html（下载帮助页）
  - droprate.json（全服爆率导出）+ config.json（站点配置）
  - CLI site --qq/--dl/--desc/--versions/--announce/--skip-drop；GUI 开区网站面板加 5 字段
- 回归 21+17 全绿；SEA 重打包；D 盘同步

## 开区网站 v3（对齐虾米"网站管理"）

- 虾米本地站实测（http://127.0.0.1:8000）：index.html 21KB（hero 渐变+指标卡+版本区+公告社群区+Powered 尾）；droprate.html 114KB（5 查询模式+多版本+标准/精简+排序+显示全部+4 列联动：物品名称/出处/刷新地图/地图走法）
- **元歌 v3 升级**（genOpenSite 重写 + exportSiteData）：
  - index.html：对齐虾米结构（header nav + hero 渐变 + 3 指标卡[版本入口/社群通道/查询状态] + 版本情报区 + 公告/社群区 + footer Powered by 元歌工具箱）
  - droprate.html：**4 模式联动查询**（物品/怪物/地图/NPC）+ 排序（默认/名称/爆率）+ 显示全部 + 4 列联动
  - **地图走法**：MapInfo 传送关系（A x,y -> B x,y）提取，279 张地图全带走法
  - **NPC 查询**：MerChant.txt 56 个 NPC（地图+坐标）
  - data.js 独立数据文件（2.66MB，避免 HTML 内联过大）+ droprate.json + config.json
- 验证：electron 实测 4 模式搜索（书页 50 只怪/白野猪/盟重/兑换）+ 3 指标卡；回归 21+17 全绿；SEA 重打包；D 盘同步

## 开区网站 v3.1（维护页 + 后台发布，对齐虾米）

- 虾米维护页：site_enabled 字段控制（false 显示"网站维护中"）
- 虾米后台：内置 HTTP 服务 + /api/login 登录后发布版本资料/公告/联系方式
- **元歌 v3.1 闭环**（静态站适配）：
  - **维护**：--maint 开启 → index.html 顶部红色维护横幅 + 独立 maintenance.html（维护提示 + 玩家群）
  - **后台**：--admin 生成 admin.html（表单：站点名/简介/下载/QQ群/版本/公告/皮肤/维护开关/维护提示 + 保存草稿 localStorage + 导出配置 yge-site-config.json）
  - **发布**：CLI site --apply-config yge-site-config.json（读取后台配置重新生成，实现"编辑→导出→发布"闭环）；GUI 开区网站面板加"🚀 从后台配置发布"按钮（open-config-file 选配置）
- 实测：发布后标题/维护横幅/QQ群/版本全部生效；admin+maint 同时 8 文件；exe/GUI 验证通过；回归 21+17 全绿

## 开区网站 v3.3（droprate 完全采用虾米模板引擎）

- 用户实测虾米站（http://127.0.0.1:8000）确认 droprate 是 114KB 完整查询系统（101 函数引擎）
- **改造虾米模板为元歌版**（去虾米品牌）→ rate-tool/site-template/droprate.html（111KB）+ gen-bundle 注入 SEA（__SITE_TPL）
- **数据格式对齐虾米**（exportSiteData 重写）：monsters(带 spawns 刷怪点+den 分母) / routes(中文名) / maps(602) / map_index(数组) / npcs(118 含 teleports) / item_drops(预构建)
- **./data/site.json + ./data/droprate_v1.json**（bootstrapSite 优先 fetch site.json——修复 404 被 JSON.parse 成数字 404 的坑）
- **验证**：版本选择+数据加载+物品/怪物/NPC 列表+分页全工作（electron 实测）
- **地图查询已修复**：根因 ① MonGen 块误用 readMonGen 返回值（实际 {spawns}，字段 map/mon）→ spawns 空 → mapMonsterGroups 空 → 过滤后 0 张；② MonGen 地图代码未进 maps → resolveMapCode 失败。修：MonGen 块改 mg.spawns + maps 合并 MonGen 代码。**实测 693 地图/247 怪带 2294 刷怪点，地图列表+走法链工作**（个别地图名乱码待查）
- 回归 21+17 全绿；SEA 重打包；D 盘同步

## 爆率融合 P0（虾米整体优化 + 自动备份）

- 虾米爆率管理 6 功能（新增/#CALL还原/二级优化/整体优化/分组/指定删除 + 备份）已挖出 Worker 结构与核心算法（_normalize_item_name/_apply_op/_match_range/_load_mapinfo/_monsters_from_mongen/_drop_is_private_path）
- **已交付**：overallOptimize（method 筛选 + 范围匹配 + 加减乘除设 + 自动备份）、backupMonItems/listBackups/restoreBackup、listMonFiles 排除 @backup、normalizeItemName
- CLI overall/backup；GUI 爆率调整面板整体优化卡片 + 备份还原下拉
- 回归 21+17 全绿；exe 重打包；D 盘同步；测试脚本加 setup 清理（防残留干扰）

## 爆率融合 P1（多编码 + 批量新增 + #CALL 还原）

- 多编码检测：detectEncoding（BOM/utf16/Buffer 往返校验 utf8/gb18030 回退）+ decodeBuf 增强；实测 GBK/UTF-8/ASCII 全对
- 批量新增：addRates（_MonItemsAddWorker：items+rate 全服/指定怪追加，自动备份）
- #CALL 还原：resolveCall（防设备/穿越/备份）+ scanCallRefs + restoreCall（dry-run/--apply）；实测展开+拦截
- CLI addrates/callrestore；GUI 两张新卡片
- 回归 21+17 全绿；exe 重打包；D 盘同步

## 爆率融合 P2（指定删除/普通分组/二级优化）

- delRates（item/contain/regex 三种匹配全服删除）+ groupRates（group_size 分组 #CHILD RANDOM）+ optimizeRates（#CHILD 去重/清空/展平）
- CLI delrates/group/opt；GUI 三张新卡片（修复卡片漏到所有页面的 Bug：之前插入在 panel 外，已移入 panel-adjust）
- 回归 21+17 全绿；exe 重打包；D 盘同步
