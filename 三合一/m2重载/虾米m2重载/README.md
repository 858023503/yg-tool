# 虾米m2重载 —— 逆向分析（修正版）

> 虾米工具箱（Python 3.8 + PySide2，PyInstaller 打包）的 M2 重载功能分析。
> **2025-08 实测确认：重载功能真实生效**（主程序 stream_0014.pyc 含完整 Win32 实现）。

## 结论：虾米重载 = Win32 菜单点击（含懒加载预热，比蜗牛/快捷助手更完善）

虾米主程序 `stream_0014.pyc`（2.58MB，模块名 `工具箱_qt.py`/`工具箱.py`）内含完整实现：

### 调用链
```
点击"重载"按钮 (reloadItemButton / reloadRole=direct)
  → _run_reload_menu_leaf → _run_reload_menu_leaf_async（QThread 异步）
  → _ReloadMenuLeafWorker.run（worker 线程，menu_leaf_text = 菜单项文本）
  → _run_engine_reload_menu_leaf
  → _win_send_menu_path（按路径逐级遍历菜单）
  → GetMenu / GetMenuItemCount / GetSubMenu / GetMenuStringW / GetMenuItemID（HMENU/UINT）
  → _try_warm_up_menu_path：先发 WM_INITMENU / WM_INITMENUPOPUP 让 Delphi 懒加载菜单初始化
  → _try_send_wm_command：SendMessageW / SendMessageTimeoutW（带超时防卡死）
  → WM_COMMAND（cmd_id = low16 菜单ID）
```

### 菜单项定义（reload_menu_defs）
```
QManager / QFunction / 所有NPC / 怪物爆率 / Robot 机器人脚本 /
物品数据库 / 技能数据库 / 怪物数据库 / 怪物说话设置 / 怪物大血条 /
宝箱数据 / 数据列表 ...
```
菜单路径字符串：`控制>重新加载`（`_split_menu_path` 按 `>` 拆分，`_normalize_menu_text` 归一化）。

### 错误处理提示（字符串证据）
```
ctypes不可用 / 窗口句柄无效 / 窗口无菜单 / 菜单路径为空 / 菜单项为空 /
未找到菜单: 可选项: / 菜单无子项 / 菜单项不可触发 / 发送失败 / 执行失败
```

### 辅助能力（微端客户端页 MicroClientConfigPage）
- `_post_close_windows`：PostMessageW + WM_CLOSE 关窗
- `_taskkill_pids_blocking`：`taskkill /PID /T /F` 强杀进程
- `_start_exe`：subprocess.Popen 启动（M2Server.exe / GameCenter.exe）
- `_win_message_box`：ctypes windll user32 MessageBoxW 弹窗

## 与蜗牛/快捷助手对比

| 特性 | 虾米 | 蜗牛 | 快捷助手 | 元歌 |
|---|---|---|---|---|
| 菜单遍历（GetMenu 系列） | ✅ | ✅ | ✅ | ✅ |
| **WM_INITMENUPOPUP 懒加载预热** | ✅ | ❌ | ❌ | ❌（待补） |
| **SendMessageTimeoutW 超时** | ✅ | ❌ | ❌ | ❌ |
| 路径式定义（控制>重新加载>项） | ✅ | 逐级硬编码 | 命令表+文本匹配 | 关键词映射 |
| 多引擎菜单项配置 | ✅ | ✅（LF/GOM/NGOM/996） | 通用表 | 关键词+别名 |

## 之前误判说明

初版分析只扫了 `mod_*.pyc`（642 个 zlib 流，<2MB 过滤），漏掉了 **stream_0014.pyc（2.58MB 主程序，超过 2MB 扫描上限）**，因此误判"占位未实现"。用户实测生效后，全量扫描（1326 个 pyc）定位到主程序，确认真实实现。

## 文件清单

- `README.md` —— 本文件
- `xiami-m2evidence.txt` —— 关键字符串证据摘录
- `M2Server模块.pyc` —— NPC 可视化模块（早期提取，与重载无关，保留作参考）
- `stream_0014.pyc` —— 虾米主程序（2.58MB，重载实现所在，可反编译验证）
