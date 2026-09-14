# 蜗牛货币兑换 —— 逆向证据 + 元歌实现

> 蜗牛实用工具「版本消耗 → 货币花费 / 货币兑换」，及元歌工具箱的完整复刻。
> 完整证据见 `证据-REVERSE-REPORT.txt`。

## 一、原版逆向结论（9.6.1 功能还原）

**货币花费统计**：扫描 Envir 下所有脚本，匹配货币命令，按货币/NPC 统计消耗。
UI 文案：「货币名称」「货币key」「消耗数量」「货币消耗」「丢弃QFunction里的消耗」「丢弃QManage里的消耗」「NPC查询」。

**命令格式（翎风引擎 CHM 确认）**：
```
GOLDCOUNT 控制符(=,+,-) 数量      # 金币
GAMEGOLD/GAMEDIAMOND/GAMEPOINT/GAMEGIRD/CREDITPOINT/GAMEGLORY =/+/-   # 元宝/金刚石/游戏点/灵符/声望/荣誉
CHECKGOLD 数量 / CHECK 金币 数量   # 条件检查
TAKE/GIVE 货币 数量               # 消耗/给予
DEC/INC 变量 数量                 # 变量增减
```

## 二、元歌实现（已融合 ✅）

```js
// rate-tool/lib.js
extractCurrencies(root)        // 一键提取全服货币（扫 Envir 脚本）
genExchangeScript(root, items) // 兑换 NPC 生成（菜单显示兑换内容）
addExchangeNpc(root, o)        // NPC 文件写入
curCmd(name)                   // 货币→命令映射（GOLDCOUNT/CHECKGOLD/TAKE/GIVE）
```

**兑换脚本结构**（金币单 IF + GameXxx 双 IF，对齐真实端）：
```
[@兑换1]
#IF
CHECKGOLD 1000          # 金币无操作符
#ACT
TAKE 金币 1000
GAMEGOLD + 10
#ELSEACT
MESSAGEBOX 尊敬的【<$USERNAME>】玩家：您当前的金币不足1000，无法兑换！
```

**实测**：提取货币 39 种；1000 金币→10 元宝 生成正确（count 倍率修复）。

## 三、CLI / GUI

```
元歌工具箱-CLI.exe currency <引擎根>            # 提取全服货币
元歌工具箱-CLI.exe exchange <引擎根> --cfg 兑换.json [--count 1]
```
GUI：侧边栏「货币兑换」面板（提取 → 填充下拉 → 生成 NPC）
