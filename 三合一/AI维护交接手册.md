# 元歌工具箱维护交接手册

> 这份文档给接手本项目的 AI 或开发者使用。先读完本文，再读同目录的《项目维护指南.md》和《三合一（最后完整版）.md》。
> 更新日期：2026-09-15

GitHub 私有仓库：<https://github.com/858023503/yuange-toolbox>

当前远端基线提交：以 `git rev-parse origin/main` 为准（每次推送后更新本行）。仓库包含 D 盘运行/发布目录、维护文档、样本、知识库，以及 `源码工作区/snail-reversing/` 下的真正源码工作区。大文件通过 Git LFS 保存。

## 1. 项目定位

元歌工具箱是传奇私服翎风、GOM 等 Mir200 服务端的维护工具，主要功能包括：

- 爆率读取和修改；
- MonGen 刷怪数据分析；
- 物品、货币和分类数据生成；
- 咕咕鸡存销系统生成；
- 怪物掉落、刷新地图、数量、刷新时间查询；
- 开区网站数据导出；
- QF/QM 和列表文件的脚本注入；
- 登录器配置路径替换；
- 引擎健检和辅助维护。

本项目曾参考虾米工具箱、蜗牛工具等逆向恢复结果，但现在维护对象是元歌工具箱本身，不要把虾米逆向项目、dump、代理、native core 等目录混入本项目。

## 2. 目录分工

### 2.1 真正的源码工作区

```text
D:\元歌工具箱\源码工作区\snail-reversing\
```

主要目录：

```text
rate-tool\                 CLI 核心、模板和打包脚本
rate-gui\app\              GUI 源码
rate-gui\元歌工具箱\        便携版 Electron 的 resources\app 副本
```

业务逻辑主要在：

```text
rate-tool\lib.js
rate-gui\app\lib.js
rate-gui\元歌工具箱\resources\app\lib.js
```

### 2.2 D 盘运行和发布目录

```text
D:\元歌工具箱\
```

重要内容：

```text
GUI\resources\app\          当前用户实际运行的 GUI 资源
元歌工具箱-CLI.exe            当前发布的 CLI
三合一\                       维护文档
样本Mir200\                   测试样本，只读参考；测试要复制到临时目录
```

`D:\元歌工具箱\GUI\resources\app\` 是运行副本，不是源码主目录。修改业务逻辑时先改源码，再同步到这里。

### 2.3 不属于本项目的目录

以下类型的目录不要纳入元歌工具箱项目，也不要为了维护元歌工具箱去修改：

```text
C:\Users\Administrator\Documents\Codex\...\虾米工具箱...逆向
dump\
gee_re\
proxytool\
xiami_native_core.exe 或其兼容实现
```

`D:\cqzs\元歌脚本` 是元歌群服脚本资源库，不是工具箱源码；工具箱只是提供脚本注入功能。

`knowledge_base\`（翎风/Mir200 官方说明书）和 `.codex\skills\`（外部 AI 技能）同样不属于本工具箱，已从仓库移除并加入 `.gitignore`。需要查说明书时请使用目标端自带文档，不要把外部知识库重新提交进来。

## 3. 修改和同步规则

> 仓库已通过 `.gitignore` 排除 `knowledge_base`、`ai-server-data`、历史备份、`.pyc`、`Market_Saved` 和 `rate-tool/node_modules` 等生成物；本地保留不影响运行。GUI 便携版 `resources/app/node_modules` 是运行/打包依赖，保留在仓库中。

### 3.1 修改业务逻辑

先修改：

```text
D:\元歌工具箱\源码工作区\snail-reversing\rate-tool\lib.js
```

然后同步到以下四份：

```text
rate-gui\app\lib.js
rate-gui\元歌工具箱\resources\app\lib.js
D:\元歌工具箱\GUI\resources\app\lib.js
```

`rate-tool\lib.js` 本身是第 1 份，不能漏掉。同步后用 SHA-256 或文件内容确认四份一致。

### 3.2 修改 GUI

GUI 四件套是：

```text
index.html
main.js
renderer.js
preload.js
```

修改源码目录 `rate-gui\app\` 后，同步到：

```text
rate-gui\元歌工具箱\resources\app\
D:\元歌工具箱\GUI\resources\app\
```

不要只改 D 盘运行副本，否则下次发布会丢失修复。

### 3.3 修改模板

以下文件改动后同步对应副本：

```text
rate-tool\store-template.txt
rate-gui\app\store-template.txt
rate-gui\元歌工具箱\resources\app\store-template.txt
D:\元歌工具箱\GUI\resources\app\store-template.txt
```

网站模板 `droprate.html` 也要同步源码、便携版和 D 盘运行版对应副本。

### 3.4 CLI 打包

CLI 重打包流程在《项目维护指南.md》里有完整命令。核心顺序是：

```text
D:\元歌工具箱\源码工作区\snail-reversing\rate-tool\gen-bundle.js
cd D:\元歌工具箱\源码工作区\snail-reversing\rate-tool
# 重新打包不依赖 rate-tool/node_modules；直接运行 CLI 的 FTP 功能时再 npm install
node --experimental-sea-config sea-config.json
生成 SEA
复制到 D:\元歌工具箱\元歌工具箱-CLI.exe
postject 注入 blob
```

打包前必须确认 `lib.js` 和模板已经是最新版本。不要用旧的 `.bak`、`bundle.js` 或旧 exe 当源码继续改。

## 4. 重要功能位置

### 4.1 存销系统

核心函数在 `lib.js`：

```text
genStoreScript
genSalesData
genZoneData
genCategories
hookMonItemsDrops
unhookMonItemsDrops
resolveMonDropsAll
```

存销系统使用通区文件，数据通常在：

```text
通区文件\<实际区名>\地图数据\
通区文件\<实际区名>\物品数据\
通区文件\<实际区名>\分类\
```

区名必须读取服务端实际配置，例如 `!Setup.txt` 的 `ServerName`。不能把“舟游沉默古迹”简化成“沉默古迹”，否则脚本读取的是另一目录，界面会显示空白。

### 4.2 掉落和刷新地图

现在网站和咕咕鸡存储共用掉落解析口径：

- `#CALL` 支持递归解析；
- 支持组概率和 `#CHILD`；
- 只保留实际有刷新配置的怪物；
- 支持 `MonGen.txt`、`MONGENEX` 和部分脚本动态刷怪；
- 对掉落名和刷怪名做别名匹配；
- 网站 `exportSiteData` 和存储 `genZoneData` 必须继续共用 `resolveMonDropsAll`。

修改掉落解析时，必须同时用临时副本验证网站和存储结果，不能只看其中一个。

### 4.3 脚本注入

脚本注入是段级合并，不是简单文本追加：

- 段名大小写不敏感；
- 已有 `[@Login]`、`[@login]` 等段要合并，不得产生重复段；
- 没有目标段时才追加新段；
- 注入结束标记后必须有换行；
- QF/QM 和列表文件使用 GBK；
- 列表类文件逐行去重，不要添加可能被引擎当成素材名的注释；
- 注入后检查每个段是否仍有唯一段头。

操作说明见：

```text
D:\元歌工具箱\三合一\脚本注入使用指南.md
```

### 4.4 登录器配置

`replaceLoginCfg` 使用标准目录锚点识别客户端和补丁路径，兼容一层、两层和嵌套目录。处理范围包括：

```text
pak.txt
Map.txt
Wav.txt
Wil.txt
Wzl.txt
Data.txt
```

`Data.txt` 里的路径也必须替换，例如：

```text
D:\Legend of mir通用\XinchenmoFg\Data\MapDesc1.dat
```

应替换为：

```text
D:\cqkhd\XinchenmoFg\Data\MapDesc1.dat
```

不能只替换 `pak.txt`，也不能把嵌套补丁目录错误地截短一层。测试登录器配置时使用复制出来的临时目录，不要直接覆盖用户原登录器。

## 5. 编码和引擎文件规则

传奇引擎脚本、配置和数据文件默认按 GBK 处理：

- 读取 GBK 文件使用 `iconv-lite`；
- 写入含中文的引擎文件强制 GBK；
- 不要用 Node `TextDecoder('gbk')` 作为可靠解析器；
- 生成通区数据前确认 `iconv-lite` 可加载；
- 发现乱码、`锟斤拷`、字段错位时先检查编码，不要先改业务规则；
- 地图标题里的半角空格会被引擎拆成字段，生成数据时应转成全角空格；
- 地图数据标准格式为六列：`代码|地图名|数量|时间|X|Y`。

存销生成必须通过 GUI worker 或正确加载 iconv 的环境执行。worker 里不能删除显式的 `iconv-lite` 加载和设置。

## 6. 安全测试规范

用户原版服务端、`D:\cqzs` 下正在使用的端、`D:\元歌工具箱\样本Mir200` 原始样本都不要直接改。

测试流程：

1. 复制目标端到 `C:\Users\Administrator\AppData\Local\Temp\` 下的独立目录；
2. 在副本上执行注入、存销生成、网站导出或登录器配置；
3. 对比注入前后的文件、段数量、编码和关键数据；
4. 记录测试副本路径和测试结果；
5. 用户确认后，再指导用户对正式端操作。

不要启动或重启用户的 M2Server，也不要用真实运行端验证会改变数据库或脚本状态的操作。

## 7. 已知历史问题和检查重点

- `[@Login]` 大小写导致重复段：已经修复，但旧端可能仍有重复段，需要先检查再清理。
- `StdMode` / `Stdmode` 列名差异：读取 SQLite 时两种都要兼容。
- 动态刷怪不在 `MonGen.txt`：要检查 `MONGENEX`、Robot_def、Market_def 和脚本来源。
- 被注释的 MonGen 行不应该出现在玩家可见的刷新地图中。
- 物品有爆率但没有实际刷怪配置时，网站和存储都应过滤，避免玩家误解。
- 不能把怪物地图编号当地图名显示；编号可保留在传送数据内部，玩家界面显示清理后的地图名。
- `MapInfo` 传送、NPC `MAPMOVE`、坐标触发传送是不同来源，网站走法不能凭空反向生成。
- `D:\通区文件` 空目录通常是选错引擎根后遗留的机制性副产物；新逻辑应在无效引擎根时直接报错且不创建目录。
- 咕咕鸡素材 `.Pak` 不由工具自动处理，按用户要求手动加入。
- `cq-dp-test\ai-server` 自动化回归测试已废弃，不要恢复，也不要同步 `vendor\lib.js`。

## 8. 当前文档

优先阅读：

```text
D:\元歌工具箱\三合一\项目维护指南.md
D:\元歌工具箱\三合一\三合一（最后完整版）.md
D:\元歌工具箱\三合一\脚本注入使用指南.md
```

## 9. 接手后的第一轮检查

接手后先做以下只读检查：

1. 确认源码工作区和 D 盘运行目录都存在；
2. 比较四份 `lib.js` 的哈希；
3. 确认没有把逆向项目、测试端和真实运行端混入源码；
4. 阅读三份维护文档；
5. 查看用户当前指定的版本路径和问题，不要擅自执行生成或覆盖；
6. 如果需要改动，先复制目标端到临时目录并记录路径；
7. 改完后同步、做静态检查，再说明实际测试了哪些文件。

## 10. 关于 PID、窗口和无关任务

不要根据历史聊天里的 PID 判断元歌工具箱项目。PID 会随进程启动变化，而且之前曾有一个 PID 2952 对应“造梦八荒”客户端的独立排查任务，与元歌工具箱无关。

判断当前任务应以用户给出的路径、工具箱源码和本交接文档为准。找不到源码时先检查：

```text
D:\元歌工具箱\源码工作区\snail-reversing\
D:\元歌工具箱\
```

不要因为发现一个同名或相似的 exe 就修改它。

## 11. 换电脑后的恢复方法

在新电脑安装 Git 和 Git LFS 后，先登录有权限访问该私有仓库的 GitHub 账号，然后执行：

```text
git clone https://github.com/858023503/yuange-toolbox.git
cd yuange-toolbox
git lfs pull
```

真正开发时进入：

```text
源码工作区\snail-reversing\rate-tool\
源码工作区\snail-reversing\rate-gui\app\
```

D 盘根目录下的 `GUI\` 是当前运行副本。修改后按第 3 节同步规则更新运行副本，再提交并推送。不要只在 GitHub 网页上编辑运行副本而漏改源码。
