# 蜗牛机器人脚本 —— 逆向证据 + 元歌实现

> 蜗牛实用工具「机器人脚本」（index-342fb122），及元歌工具箱的完整复刻。
> 完整证据见 `证据-REVERSE-REPORT.txt`。

## 一、原版逆向结论（9.12.1 功能还原）

**文案还原**：
```
「如输入60秒，代表机器人脚本每隔60秒执行满足条件的地图刷怪」
「每隔60秒执行清怪：无人+有怪的地图」
```

**格式（真实端实测 AutoRunRobot.txt）**：
```
#AutoRun NPC <SEC|MIN|HOUR|RUNONDAY|RUNONWEEK> <值> @<触发段>
```

**命令（翎风 CHM）**：
```
GMEXECUTE @MOB 怪物名 数量    # 刷怪（GM 命令）
CLEARMAPMON 地图             # 清怪（清除指定地图怪物，省资源）
```

## 二、元歌实现（已融合 ✅）

```js
// rate-tool/lib.js
readRobots(root)     // 解析 AutoRunRobot.txt（含 RUNONDAY/RUNONWEEK）
addRobot(root, o)    // 新增定时行
delRobot(root, o)    // 删除定时行
genDynamicSpawn()    // 动态刷怪集成（AutoRunRobot + RobotManage）
```

**实测**：真实端 23 条定时行全识别（含 RUNONDAY/RUNONWEEK）。

## 三、CLI / GUI

```
元歌工具箱-CLI.exe robot list|add|del <引擎根>
```
GUI：侧边栏「机器人脚本」面板
