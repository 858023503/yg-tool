# 快捷助手m2重载 —— 逆向证据 + 元歌实现

> 传奇服务端快捷助手 V2025-10-01（VB6 + UPX 加壳）的重载机制，及元歌工具箱的完整复刻实现。

## 一、原版逆向结论

**技术栈**：VB6（msvbvm60.dll）+ **UPX 加壳**（UPX 4.2.4 脱壳成功）

**导入的 Win32 API**（脱壳后导入表）：
```
FindWindow / FindWindowEx / EnumWindows / GetWindowThreadProcessId
GetMenu / GetSubMenu / GetMenuItemID / GetMenuString
PostMessage / SendMessage
ShellExecute / WinExec
```

**重载命令表 16 项**（脱壳后字符串提取）：
| 显示名 | 命令值 |
|---|---|
| 怪物爆率 | ReloadMonItems |
| 怪物数据库 | ReloadMonsterDB |
| 物品数据库 | ReloadItemDB |
| 小地图配置 | ReLoadMinMap |
| NPC脚本 | ReloadNpc |
| 机器人脚本 | ReloadRobot |
| 机器人配置 | ReloadRobotManage |
| 管理员列表 | ReloadAdmin |
| 开关拿沙 | ForcedWallconquestWar |
| 改变城主 | ChangeSabukLord |
| 删除行会 | DelGuild |
| 建立行会 | AddGuild |
| 查询地图怪物 | MobCount |
| 复活人物 | ReAlive |
| 踢掉人物 | Kick |
| 杀死人物 | Kill |

**UI 元素**（字符串提取）：
- 引擎下拉（"引擎："）
- "重新加载"按钮（内部名 a_load）
- "显示M2窗口标题"（默认显示游戏名称）
- "含有该关键字的M2才执行（留空代表所有M2）"
- "跨桌面重载"（提示"需要每个桌面启动一个本程序"）
- 机器人列表（MSComctlLib.ListView）

**机制**：找 M2 主窗口 → `GetMenu` 枚举"控制-重新载入"菜单 → 按菜单项文本匹配 → `PostMessage WM_COMMAND(菜单ID)` 模拟点击。命令值（ReloadMonItems 等）是逻辑标识，实际发送是菜单点击。

## 二、元歌工具箱实现（m2-reload.ps1）

完整实现见同目录 `m2-reload.ps1`（PowerShell 调 Win32，CLI/GUI 共用，SEA 单文件内联）。

核心流程：
1. 找 `GameCenter`/`M2Server` 进程（M2 嵌入引擎控制台）；
2. `EnumWindows` + `EnumChildWindows`（子窗口按 PID 过滤，避免误中 DBServer）；
3. 找带菜单的 `TfrmMain`（M2 主窗体）；
4. 枚举"控制(&C)" → "重新加载(&R)" 子菜单；
5. 匹配：去 `&`/空格/括号精确 → 包含 → 关键词映射（`NPC脚本`→`所有NPC`、`机器人脚本`→`Robot 机器人脚本`、`QManage`→`QManage 登录脚本`）；
6. `PostMessage(M2窗口, 0x111, 菜单ID, 0)`。

**翎风 M2 实测**：怪物爆率(id=25)、所有NPC(id=20)、物品数据库(4)、怪物数据库(6)、Robot 机器人脚本(19)、QManage(15)、QFunction(16) 全部 PostMessage=True。

## 三、文件清单

- `m2-reload.ps1` —— 元歌工具箱的重载实现（核心交付）
- `README.md` —— 本文件
