# 元歌工具箱 · 功能 Bug 修复清单

> 分类口径:**功能 bug = 做出来的东西(脚本/数据/报告/网站内容)错误**——生成内容不对、行为与原版不符、功能存在但永不生效。修这类需要懂传奇业务或对齐原版素材。
> 配套:工具箱 bug 见 `工具箱bug.md`(程序崩溃/死循环/编码/校验等工程问题)。
> 编号沿用总清单(见 `元歌工具箱修复清单.md`),跨文件引用不改编号。每项 =【位置】【现状】【原版依据】【改法】【验证】。
> 修复顺序:① P0 核心 → ② P1 常见路径 → ③ P2 边界。改前备份 `lib.js`;改完 `node --check lib.js`。

---

## 一、🔴 P0 核心(数据/金钱/核心功能)

### F-P0-1 货币兑换/回收:灵符/荣誉/积分映射自相矛盾
- 【位置】`lib.js:1103`(CURRENCY_CMDS.gameglory)、`lib.js:1106`(CURRENCY_CMDS.gamegird)
- 【现状】`gameglory: { name:'灵符', check:'CHECKGameGlory' }`、`gamegird: { name:'积分', check:'CHECKGameGird' }`。选"灵符"实际操作荣誉货币,选"积分"实际操作灵符;与 `lib.js:872` 自身 matchCurrencyCmd 映射(GAMEGIRD:'灵符')相反。
- 【原版依据】`REVERSE-REPORT.md:148`:`GAMEGIRD=灵符、GAMEGLORY=荣誉`。
- 【改法】`gameglory.name` 改 '荣誉'、`gamegird.name` 改 '灵符';renderer 兑换/回收下拉 option 文案同步改。
- 【验证】选"灵符"生成脚本应出现 `CHECKGameGird`/`GameGird`。

### F-P0-2 普通爆率分组:组头固定 `#CHILD 1/1 RANDOM`,爆率放大近百倍 + 嵌套 #CHILD
- 【位置】`lib.js:230`(groupRates flush)、`lib.js:238-241`(收集循环)
- 【现状】组头写死 rate=1 → `#CHILD 1/1 RANDOM`(组概率 100%、子项必掉);对已含 #CHILD 的文件不跳过块内子项,产出嵌套 `#CHILD 1/10 ( #CHILD 1/1 (…) )` 破坏可解析性。
- 【原版依据】虾米 `工具箱_qt_recovered.py:10644-10657`(按相同分母归组,组头保留原分母)、`10634-10639`(in_child 跳过块内)。
- 【改法】① 组头 rate 取该批第一条普通行的分母;② 遍历维护括号深度,depth>0 的行直接透传不参与 pending;③ 子项行保持原 num/rate。
- 【验证】5 条 `1/100` 分组 → `#CHILD 1/100 RANDOM ( 1/100 … )`;已有随机组的文件再分组不出现嵌套。

### F-P0-3 开区网站:爆率 den 换算方向颠倒 + 分子被丢
- 【位置】`lib.js:3626-3631`(exportSiteData)
- 【现状】`den = it.rate >= 100 ? 1 : Math.round(100/it.rate)`,而 `it.rate` 是 `1/N` 的分母 N → `1/1` 变 1/100、`1/22` 变 1/5;`it.num`(分子)被忽略,`5/10` 显示成 1/10。
- 【原版依据】虾米 `工具箱_qt_recovered.py:10619/10809/10821`(分母即 den,写回 `1/%d`);模板 `site-template/droprate.html:644,656` 渲染 `'1/'+d.den`。
- 【改法】`const den = it.num > 1 ? Math.max(1, Math.round(it.rate / it.num)) : (it.rate >= 1 ? it.rate : 0);`;child 行 `den = it.rate`。
- 【验证】`1/1`→1、`1/22`→22、`5/10`→2;生成 site 后与爆率文件一致。

### F-P0-4 个人/动态刷怪 QManage 模式失效:跳转段不存在 + SETONTIMER 缺间隔参数
- 【位置】`lib.js:2766`(SETONTIMER)、`lib.js:2773`(OnTimer 段)、`lib.js:2675-2731`(genPersonalSpawn/genInstanceSpawn)
- 【现状】`SETONTIMER {id}` 单参数(引擎语法为"编号 间隔秒");OnTimer 段内直接 `@元歌个人刷怪-<地图>` 跳转,但该段在 QuestDiary 子文件、不在 QManage 内。
- 【原版依据】蜗牛 `jsc-preload-strings.txt:11120/11159`:`#CALL [..\QuestDiary\…\刷怪脚本.txt] @WN个人刷怪` + `SETONTIMER 88 5`。
- 【改法】① `'SETONTIMER ' + id + ' 60\r\n'`;② OnTimer 段改为 `#CALL [..\QuestDiary\元歌个人刷怪\<地图>.txt] @元歌个人刷怪-<地图>`(给 injectQManageTimer 传脚本路径);动态刷怪同理 `#CALL [..\QuestDiary\元歌动态刷怪.txt] @元歌动态刷新`。
- 【验证】QManage 段内是 #CALL 且路径存在;SETONTIMER 两参。

### F-P0-6 动态刷怪:不删原 MonGen 静态行 → 怪量叠加;MONGENEX 尾列错位
- 【位置】`lib.js:2787-2888`(genDynamicSpawn)、`lib.js:2836-2843`(MONGENEX 构造)
- 【现状】只写 RobotManage/AutoRunRobot,原 MonGen 不动 → 静态+动态互相打架、怪量翻倍;MONGENEX 把原行 interval/time/trigger 尾列原样拼接,参数语义错位。
- 【原版依据】蜗牛 `index-342fb122.js:943-964`(静态行删除写回);`bc-constant-pools.txt:1215`(MONGENEX 单独构造 `… range 0 <nameColor> 255 0`)。
- 【改法】① genDynamicSpawn 增 `removeStatic`(默认 true),按行号删被覆盖的静态行,preserveMonGenWrite 写回;② MONGENEX 行丢弃尾列,按 `map x y mon range 0 255 0` 构造。
- 【验证】生成后 MonGen 中该图/怪静态行已删;MONGENEX 无多余尾列。

---

## 二、🟠 P1 常见路径功能错误

### F-P1-2 物品名规范化不完整:删/查/指定追加匹配失败
- 【位置】`lib.js:152-159`(normalizeItemName,缺 `;`/`#` 截断)、`508/524`(addRate/delRate)、`673`(findItemDrops)、`689`(addAfterItem)
- 【现状】原始字符串精确比较,`1/100 书页 RANDOM`/`//注释`/全角空格时删不掉、查不到、插错位。
- 【原版依据】虾米 `工具箱_qt_recovered.py:10690-10698`(截 `//`、`;`、`#`、`\s+random.*`、全角空格)。
- 【改法】normalizeItemName 补 `v.split(/[;#]/)[0].trim()`;匹配处统一 `normalizeItemName(it.item) !== normalizeItemName(itemName)`。
- 【验证】输入"书页"能删掉 `1/100 书页 RANDOM`、查询能命中。

### F-P1-3 M2 重载菜单列表与真实菜单错位
- 【位置】`lib.js:4179`(M2_RELOAD_ITEMS 16 项)、`m2-reload.ps1`
- 【现状】列表含"开关拿沙/改变城主/删除行会/复活人物/踢掉人物"等不在"控制-重新加载"菜单的项;真实项(QFunction/QManage/QMission/物品掉落规则/参数设置/地图事件等)全缺 → 下拉大半选项点击必失败。
- 【原版依据】虾米 `工具箱_qt_recovered.py:14083-14084`(23 项 defs);翎风实测 22 项(`三合一/m2重载/m2重载.md:60`)。
- 【改法】M2_RELOAD_ITEMS 替换为实测 22 项:QFunction、QManage、所有NPC、怪物爆率、Robot、物品、技能、怪物数据库、怪物说话、大血条、宝箱、数据列表、安全区、参数设置、掉落规则、QMission、QChatbox、地图事件、摆摊、出售、假人、授权RunGate;ps1 与清单一一对应。
- 【验证】真实 M2Server 上逐项点击无 NOT_FOUND。

### F-P1-4b 脚本注入:变量类型提取不全
- 【位置】`lib.js:1410-1422`(VAR_PATTERNS)
- 【现状】缺 `J$`/`Z$`、个人标识 `[1]`、U 仅 `U\d{1,2}`(U100-499 不被视为占用)、Q 无边界(`QQ123` 误匹配)。
- 【原版依据】蜗牛 `index-ec0ab199.js:111-129`(变量组含 A/D/G/I/J/M/N/P/S/T/U/Z,U max=499,T max=499,含个人标识/定时器/AddButton/输入)。
- 【改法】补 `J$`/`Z$`、`\[(\d+)(?:-\d+)?\]`、`U\d{1,3}`、`T\d{1,3}`;Q 加边界。
- 【验证】注入内容含 U120 时视为占用并避让;`QQ123` 不误匹配 Q12。

### F-P1-5 开区网站:新区/快餐/单职业三卡片参数被静默丢弃
- 【位置】`lib.js:3768`(读取区)、`lib.js:3871`(versions 渲染区)
- 【现状】renderer 传 `newZones/fastZones/soloZones`,lib 全文无这三个键 → GUI 输入框和 CLI `--new/--fast/--solo` 纯摆设。
- 【原版依据】蜗牛 REVERSE-REPORT.md §7"生成版本查询网站(每日新区/快餐服/单职业)";功能清单.md:53。
- 【改法】3768 后读取三键;3871 后追加三块 `.panel` 卡片。
- 【验证】GUI 填新区内容 → index.html 出现对应卡片。

### F-P1-6 MapInfo 解析:空格/Tab 地图标题被拼进 code
- 【位置】`lib.js:3379-3384`(readMapInfo)
- 【现状】只按 `|` 切分,`[3 比奇城]` → code=`"3 比奇城"`;与 exportSiteData:3573 的解析不一致。
- 【原版依据】虾米 `工具箱_qt_recovered.py:8246-8254`(先 `[\t ]` maxsplit=1 拆 id 再处理 `|`)。
- 【改法】head 先 `split(/[\t ]+/, 2)` 拆 id/title,再处理 `|`;抽公共函数与 exportSiteData 共用。
- 【验证】`[3 比奇城]` → code=`3`、title=`比奇城`;两面板一致。

### F-P1-7 兑换/回收 NPC 更新 MerChant 只按 NPC 名匹配,覆盖旧地图行
- 【位置】`lib.js:1204-1210`(addExchangeNpc)、`lib.js:1870`(addRecycleNpc)
- 【现状】`t.startsWith(NPC名)` 命中即整行改写,同 NPC 换地图二次生成覆盖旧地图行,旧脚本残留。
- 【原版依据】蜗牛 `index-eae1c9c2.js:170`(NPC名+地图码双条件)。
- 【改法】拆列后 `cols[0]===NPC名 && cols[1]===opts.mapCode` 才更新,否则追加。
- 【验证】换地图二次生成 → 旧地图行保留、新行追加。

### F-P1-8 存销说明.txt 二次覆盖 + 键名用错
- 【位置】`lib.js:2387`(第一次写)、`lib.js:2406`(try 内二次覆盖)
- 【现状】说明.txt 被第二次写入整体覆盖,只剩注释头;note 用 `opts.rateType/group/uidType`,实际参数是 `format/groupSize/userIdType`,字段恒 `-`。
- 【改法】删第二次写入(或改名);键名统一为 format/groupSize/userIdType。
- 【验证】说明.txt 含名称/时间/引擎/格式/编号/条数/组数真实值。

### F-P1-9 货币分析/提取:英文货币名漏映射 + 中文 N$ 变量漏识别
- 【位置】`lib.js:888`(TAKE/GIVE 白名单)、`lib.js:894`(自定义变量正则)
- 【现状】白名单缺 GAMEDIAMOND/GAMEPOINT/GAMEGIRD/CREDITPOINT/GAMEGLORY;正则 `[A-Z$0-9_.<>]+` 不含中文,`DEC N$元宝券 10` 漏计。
- 【原版依据】REVERSE-REPORT.md:147-151(TAKE/GIVE 货币 数量;验证金刚石/灵符/声望全部识别)。
- 【改法】补白名单;字符类加 `\u4e00-\u9fa5`。
- 【验证】`TAKE GAMEDIAMOND 100` 记为金刚石;`DEC N$元宝券 10` 被统计。

### F-P1-11 原刷怪调整整行重建:8 列变 9 列、对齐丢失
- 【位置】`lib.js:2444-2461`(adjustMonGen)、`lib.js:783-796`(serializeSpawn)
- 【现状】serializeSpawn 固定单空格+强制补 trigger 列 → 8 列原行变 9 列,多空格对齐全丢。
- 【原版依据】虾米 `_render_existing_record`(只替换变化的字段,保留原文)。
- 【改法】行级局部更新:解析 tokens 后只改目标字段 token,其余原文拼接保留;serializeSpawn 不再补 `0` 列。
- 【验证】8 列行调整后仍 8 列、对齐保留。

### F-P1-12 文件对比:行号对齐误报 + 固定 20 行 + 忽略脚本目录
- 【位置】`lib.js:3471-3486`(compareTextLines)、`main.js:245`(maxLines:20)、`lib.js:3429`(IGNORE_DIRS)
- 【现状】逐行 `la[i] vs lb[i]`,插入/删除后后续全报差异;忽略 Market_Def/QuestDiary,改版最关心的脚本差异被忽略。
- 【原版依据】虾米 difflib + 左右互拷保存(QSS compareActionRole 区段)。
- 【改法】换 LCS diff(自实现,单文件不加依赖);maxLines 提至 200 或 GUI 传参;IGNORE_DIRS 默认不再忽略脚本目录。
- 【验证】A 插一行,B 后续相同 → 只报 1 处差异。

---

## 三、🟡 P2 边界/兼容(择要)

| 编号 | 位置 | 问题 | 改法 |
|---|---|---|---|
| F-P2-1 | `lib.js:75-87` monItemsDir | 固定标准 MonItems,MonItemsEx/MonDrop 时读写落空 | 依次探测 MonItems/MonItemsEx/MonDrop 取存在的第一个 |
| F-P2-2 | `lib.js:496/431` monsByMap/monstersFromMonGen | 多 token 怪名只取第 4 列,与 readMonGen 754-759 不一致 | 复用多 token 收集逻辑 |
| F-P2-3 | `lib.js:269-275` optimizeRates | 组内按物品名去重,误删同物品不同概率 | key 改 `normalizeItemName(item)+'@'+rate`,与 findDupRates 口径统一 |
| F-P2-4 | `lib.js:331-334` restoreCall | 同文件重复 #CALL 只展开第一处 | 行级遍历替换,处理所有命中 |
| F-P2-5 | `lib.js:360` addRates | 追加尾部,虾米原版插头部 | 改 items.unshift |
| F-P2-6 | `lib.js:586-596` adjustRateFile type=child | 组外普通行被改写成单元素 #CHILD,结构破坏 | 仅对 kind==='child' 头行乘倍率,普通行不动 |
| F-P2-8 | `lib.js:2038` salesTimers vs `2053` storeTimerId | 双算法不一致,自身标记块被计占用,定时器越推越高 | salesTimers 复用 storeTimerId 的标记块剥离逻辑 |
| F-P2-9 | `lib.js:2091-2153` | 定时器占满时静默生成无定时器脚本 | storeTimerId 返回 0 时报错提示 |
| F-P2-10 | `lib.js:2240-2285` genStoreScript | QF 注入无重名冲突检查,`[@掉落前检测]`/`[@ButtonClick200]` 重名时静默失效 | 注入前扫描 QF 已用段名/按钮号并提示 |
| F-P2-11 | `lib.js:2363` | "新爆率格式"输出与物品数据逐字节相同 | 按 `#CHILD 1/N RANDOM` 分组结构单独生成(与 F-P0-3 同源,一起改) |
| F-P2-12 | `lib.js:1895-1906` allocFlags | 普通 `[数字]` 文本误计占用;溢出回退可能重复 | 限定脚本指令上下文;溢出返回错误 |
| F-P2-14 | `lib.js:3101-3103` itemDescFile | 缺 DZItemDescList.txt(快捷助手清单的"备注-上"第二文件) | 探测 DZItemDescList.txt 作为 top 候选 |
| F-P2-15 | `lib.js:3363-3367` delStartPoint | 同坐标不同类型安全区被一并删除 | 匹配条件加 type |
| F-P2-16 | `lib.js:3516-3525` healthReport | 缺失目录键静默漏检,体检全绿而健检报缺失 | 缺失键 push `{ok:false}` issue,与 scanSetupDirKeys 一致 |
| F-P2-17 | `lib.js:4053-4058` fixSetupDirKeys | 完全缺失的键不修(value 为空被跳过) | value 为空时按 SETUP_DIR_MAP 建议值补写行 |
| F-P2-19 | `lib.js:1461-1471/1494-1496` injectTargetFile | QuestDiary 注入目标报"无效" | 支持 QuestDiary 目标 |
| F-P2-20 | `lib.js:1046-1082` replaceScripts | 正则模式搜索后替换按字面量执行 | matchMode==='regex' 时用 new RegExp 替换 |
| F-P2-21 | `lib.js:1252-1253` scanPorts vs `1290-1310` readPortConfig | 端口集合不一致(DBPort_MulThread 漏检) | 键匹配同口径(含 Port 且 =数字) |
| F-P2-22 | `lib.js:1677-1680` ftpSync | 大小相同跳过不可靠 | 对父目录 list 后按 name 匹配 |
| F-P2-23 | `lib.js:1582` addRobot | 刷怪用 GMEXECUTE @MOB(机器人上下文无 GM 权限),清怪无 CHECKMAPMONCOUNT 前置 | 改 MONGEN/CHECKMAPMONCOUNT 指令 |

---

## 四、🔴 R3 轮新增(功能类)

### F-R3-2 存销:模板硬编码 `..\QuestDiary\ggjfl\`,categoryFolder 参数整体失效
- 【位置】`store-template.txt:6/334/357/372/969/1122/1123` + `lib.js:2149/2181`
- 【现状】applyRepl 替换目标是 `QuestDiary\咕咕鸡物品分类`,但模板里根本没有该串 → categoryFolder 不生效;生成脚本读 `ggjfl\武器分类.txt` 等不存在路径,分类列表全空白,LineCounts/SearchCache 目录静默写失败,**存销主功能部署即不可用**。
- 【改法】applyRepl 目标改为模板真实串 `..\QuestDiary\ggjfl\`(替换为 `..\QuestDiary\<categoryFolder>\`),或 categoryFolder 默认值统一为 ggjfl,并与 QManage 登录块/界面配置读取保持一致。
- 【验证】按 UI 默认目录部署分类文件后,主脚本读取路径存在、分类列表非空。

### F-R3-4 applyOp('set', 0) 语义反转:"清零"变"必爆"
- 【位置】`lib.js:188-197`(applyOp)
- 【现状】opValue=0 → res=0 → 钳到 1 → 1/1 必爆。
- 【改法】set 且 opValue<=0 时返回 MAX_RATE(90000000,不爆)或明确报错,不要钳成 1。
- 【验证】set 0 后爆率文件行为"不爆"。

### F-R3-5 注入变量 U 数字前缀污染
- 【位置】`lib.js:1483`(replaceOccupyVars)、`1450`(extractVars)
- 【现状】`split('U1')` 把 `U10` 改成 `U1010`;`/U\d{1,2}/` 对 U100 只提取前两位。
- 【改法】按长度降序替换;`new RegExp(v + '(?!\\d)','g')` 边界替换;U 改 `U\d{1,3}`。
- 【验证】注入内容同时含 U1/U10/U100 且都冲突 → 全部正确避让、无污染。

### F-R3-7 个人刷怪同地图多怪重复段头,新怪永不刷
- 【位置】`lib.js:2708-2723`(genPersonalSpawn)
- 【现状】按"MONGEN 怪名"判断已存在,但整段(含段头)整体追加 → 多个同 label 段,引擎只取首段。
- 【改法】检测已有段,只把 MONGEN 行追加进现有段内。
- 【验证】同地图生成两种怪 → 单段多行,两种都刷。

### F-R3-12 scanVariables:U/Q 双计、Q 变量查询缺失
- 【位置】`lib.js:2550-2653`(scanVariables)
- 【现状】U 既在 VAR_PATTERNS 计数又在单字母表 push+计数(双计);Q 只计数不 push(查询结果缺失);byType 未用。
- 【改法】VAR_PATTERNS 移除 U/Q 交给单字母表;单字母表补 Q;删 byType。
- 【验证】脚本含 U12/Q5 → 各计一次,变量占用面板能查到 Q5。

### F-R3-14 readMerChant 只按 Tab 分隔,空格分隔版 NPC 全丢
- 【位置】`lib.js:3117`(readMerChant)
- 【现状】`split(/\t+/)`,空格分隔的 MerChant 所有行被 `parts.length<5` 丢弃 → 快捷操作 NPC 列表为空。
- 【改法】改 `split(/\s+/)`。
- 【验证】空格分隔 MerChant 能列出 NPC。

### F-R3-15 存销"创建文件.txt"路径用错变量
- 【位置】`lib.js:2196`
- 【现状】用 `<$USERID>_<$USERNAME>` 字面名,与全程 storeU 编号路径不一致,新玩家首登创建垃圾 ini 且覆盖编号路径。
- 【改法】改为 `<$STR(storeU)>.ini` 拼接。
- 【验证】新玩家首登不产生 `账号_角色.ini`,数据落在编号文件。

### F-R3-16 存销定时器 interval 参数无效
- 【位置】`lib.js:2154` + `store-template.txt:1377`
- 【现状】interval 赋值后从未使用,模板硬编码 `SetOnTimer 51 2`。
- 【改法】applyRepl 一并替换间隔数字,或删参数同步 UI。
- 【验证】UI 设 10 秒 → 模板生成 `SetOnTimer 51 10`。

### F-R3-23 开区网站 NPC 明细恒空
- 【位置】`lib.js:3662`(exportSiteData)+ `droprate.html:1374-1420/2113-2125`
- 【现状】npcs[].scripts/give/take/teleports 一律 `[]`,网站 NPC 传送走法/交易明细区域恒空白。
- 【改法】导出时解析 NPC 脚本填充;暂不实现则前端隐藏空区域。
- 【验证】网站 NPC 明细页有内容或不显示空区块。

### F-R3-28 addAfterItem 同文件多条目标只插第一条
- 【位置】`lib.js:716`
- 【现状】findIndex 只取第一条,与 findItemDrops 报告命中数不一致。
- 【改法】逐行插入所有命中处。
- 【验证】全服多处命中 → 每处后都插入。

### F-R3-33 genSalesData 说明文本键名错
- 【位置】`lib.js:2431-2433`
- 【现状】`opts.rateType/group/uidType` 与同函数实际 `format/groupSize/userIdType` 不一致,说明内容显示默认值(与 F-P1-8 同根,一起改)。
- 【改法】统一键名。
- 【验证】说明.txt 显示真实格式/分组/编号。

### F-R3-34 detectDungeonMaps 第三地图代码被忽略
- 【位置】`lib.js:2694-2701`
- 【现状】`[A|B|C 名称]` 只取前两个代码。
- 【改法】循环处理所有副代码。
- 【验证】三代码地图全部识别。

---

## 五、功能类修复顺序建议

1. F-P0-1 → F-P0-2 → F-P0-3(货币/分组/网站概率,一行级/局部,立即消除错误数据)
2. F-R3-2(存销部署不可用)→ F-P0-4 → F-P0-6(刷怪核心)
3. F-P1 组(建议顺序:F-P1-4b → F-P1-2 → F-P1-3 → F-P1-5 → 其余)
4. F-P2 组按表顺序;F-P0-3 与 F-P2-11 同源(den 语义)一起改。
