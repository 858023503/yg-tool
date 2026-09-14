# 蜗牛刷怪配置 —— 逆向证据 + 元歌实现

> 蜗牛实用工具（Electron 字节码）的刷怪配置功能，及元歌工具箱的复刻实现。

## 一、原版逆向结论

**技术栈**：Electron 22 + V8 字节码（index.jsc，V8 9.6 反编译）

**刷怪相关函数**（`preload-funcs-annotated.txt` 反编译证据）：

```js
// 函数常量池（@515332 附近）：
["setLogo", "getData", "imageSave", "load", "https", "Of",
 "analysisNpcs", "db", "cu", "getIp", "gu", "exportToTxt",
 "mu", "importToTxt", "Bf", "getMonGen", ...]
```

- `getMonGen` —— MonGen.txt 读取（解析刷怪行）
- `analysisNpcs` —— NPC 分析（地图-坐标关联）
- `exportToTxt` / `importToTxt` —— MonGen 导出/导入
- 界面文案（renderer 反混淆）：**动态刷怪配置（还原自 index-342fb122）**"有人有怪，无人清怪，性能节约、稳定不卡"

## 二、原版功能清单

| 功能 | 说明 |
|---|---|
| 刷怪查看 | MonGen.txt 列表（地图/X/Y/怪物/数量/范围/间隔） |
| 原刷怪调整 | 数量×倍数 / 时间×倍数 / 排除条件 |
| 动态刷怪 | 触发百分比 pro / 人数 count / 刷怪百分比 / 间隔 → MonGen 缩小 + AutoRunRobot + RobotManage |

## 三、元歌实现（已融合 ✅）

```js
// rate-tool/lib.js
readMonGen(root)      // MonGen 解析（spawns + rawLines + newline）
listMonGen(root)      // CLI 查看（-f 地图/怪物过滤）
adjustMonGen(root, {monCount, monDate, type, name, 排除条件})  // 原刷怪调整
genDynamicSpawn(root, {pro, count, monCount, intervaled, interval, injectQmanage})
```

- 原刷怪调整：数量×倍数 / 时间×倍数 / 排除条件（≥/≤），**skipped 计数**反馈
- 动态刷怪：MonGen 数量×刷怪% + AutoRunRobot（#AutoRun NPC SEC）+ RobotManage（CHECKHUMCOUNT/CHECKMAPMONCOUNT/MONGEN/CLEARMAPMON）
- 写前自动备份到 `Envir/@backup/`，原子写入（临时文件+rename），保留注释/分隔线/换行类型

## 四、CLI / GUI

```
元歌工具箱-CLI.exe mongen list <引擎根> [-f 地图|怪物]
元歌工具箱-CLI.exe mg-adjust <引擎根> --count 2 --time 0.5 [--type map --name 3]
元歌工具箱-CLI.exe dynamic <引擎根> --pro 50 --moncount 50 [--qm]
```
GUI：侧边栏「刷怪配置」面板（原刷怪调整 + 动态刷怪 + QManage 注入复选框）
