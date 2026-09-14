# 蜗牛爆率调整 —— 逆向证据 + 元歌实现

> 蜗牛实用工具（Electron 字节码）的爆率系统，及元歌工具箱的完整复刻实现。

## 一、原版逆向结论（REVERSE-REPORT.md §2 爆率系统 rate.*）

```
### 2. 爆率系统（rate.*）
- 爆率调整：全服/按地图/按怪物名，向符合条件怪追加/删除物品爆率，调整倍数，随机值
- 从 MonGen.txt 反查"地图刷哪些怪"；MonItems\ 目录爆率文件解析
- 爆率模拟器、爆率查看（Ctrl+左键跳转）、爆率生成头注释
```

**核心设计**：
1. **三维定位**：全服 / 按地图（MonGen 反查怪名）/ 按怪物名 → 确定目标 MonItems 文件
2. **四种操作**：追加 / 删除 / 调整倍数 / 随机值
3. **格式**：`#CHILD 概率分子/概率分母 [RANDOM] 物品名`（RANDOM = 随机爆率）

## 二、元歌实现（已融合 ✅）

```js
// rate-tool/lib.js —— 爆率系统完整实现
readMonFile(root, mon)      // MonItems 解析（kind: rate/blank/comment）
writeMonFile(root, mon)     // GBK 写回（保留注释/空行）
addRate(root, mon, item, num, rate, rand)   // 追加爆率
delRate(root, mon, item)                    // 删除爆率
globalOp(root, {type, name, mode, ...})     // 全服/按地图/按怪物 操作
randRate(root, mon, ...)                    // 随机爆率转换（#CHILD 1/1 RANDOM 保持原分子）
overallOptimize(root, {method, op, opValue, rangeOp, rangeValue})  // 整体优化（虾米借鉴）
```

**三维定位**：`monstersFromMonGen()`（MonGen 反查地图→怪）→ `mapMonsters()`（地图怪列表）→ 目标文件

**融合亮点**：
- 蜗牛 → 三维定位 + 四种操作 + 随机爆率
- 虾米 → 整体优化（方法筛选 + 范围匹配 + 加减乘除设值）、批量新增、#CALL 还原、多编码检测
- 快捷助手 → 无（见子目录）

## 三、CLI / GUI

```
元歌工具箱-CLI.exe list <引擎根> [怪物名]                       # 查看爆率
元歌工具箱-CLI.exe add <引擎根> <怪物> <物品> <分子> <分母> [random]
元歌工具箱-CLI.exe del <引擎根> <怪物> <物品>
元歌工具箱-CLI.exe adjust <引擎根> --type monster --name 白野猪 --op mul --val 2
元歌工具箱-CLI.exe random <引擎根> --type monster --name 白野猪
元歌工具箱-CLI.exe overall <引擎根> --monsters 白野猪 --op mul --op-val 2 [--dry]
元歌工具箱-CLI.exe backup <引擎根> [--list|--restore 名称]      # 备份/还原
```
GUI：侧边栏「爆率调整」面板（追加/删除/调整/随机/整体优化/批量新增/#CALL 还原/备份还原）
