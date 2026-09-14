# 蜗牛m2重载 —— 逆向证据

> 蜗牛实用工具（Electron 22 + V8 字节码混淆）的 M2 引擎控制机制。

## 机制（来自 main 进程字节码反汇编）

**引擎控制 = FFI + Win32 窗口消息模拟**：

1. **支持引擎**：LF（翎风）/ GOM / NGOM / 996 / ssNGom（各有 M2Config 配置对象）
2. **定位窗口**：通过 `user32.dll`（ffi-napi）`FindWindow` → 定位 `\Mir200\M2Server.exe` 窗口
   - Delphi 类名：`TfrmMain` / `TApplication` / `TFrmFileList` 等
3. **遍历菜单**：`GetMenu` / `GetMenuItemCount` / `GetMenuStringA` 枚举 M2 主窗体菜单
4. **模拟操作**：`SendMessage` / `PostMessage` 发送命令（菜单点击），`SetCursorPos` / `BringWindowToTop` 辅助
5. **端口管理**：读取/修改 M2 全服务端口（DBPort1-8、GatePort1-8、RunGate/SelGate/LoginGate、LogServerPort、MsgSrvPort、IOCPRunGate 等），冲突检测（netstat）→ 报红 → 一键替换
6. `!setup.txt` 目录键读写（BaseDir/BoxsDir/CastleDir/ChatDir/ConLogDir/LogDir/GuildDir/NoticeDir…）

## 关键字符串证据（index.jsc 常量池）

```
FindWindowA / FindWindowW
SendMessageA / SendMessageW
PostMessageA
GetMenu / GetMenuItemID / GetSubMenu / GetMenuStringA
SetCursorPos / BringWindowToTop
TfrmMain / TApplication / TFrmFileList
M2Server.exe / Mir200
```

## 结论

蜗牛的重载 = **菜单点击模拟**（FindWindow 找 M2 窗口 → GetMenu 枚举 → PostMessage WM_COMMAND）。
与"传奇服务端快捷助手"同机制，也是元歌工具箱 m2-reload.ps1 的实现依据。

---

### 附：原始报告摘录（REVERSE-REPORT.md §6）

> ### 6. 引擎控制（FFI + Win32）
> - 支持引擎：**LF / GOM / NGOM / 996 / ssNGom**（M2Config* 配置对象）
> - 通过 user32.dll（ffi-napi）FindWindow → 定位 `\Mir200\M2Server.exe` 窗口（Delphi 类名 TfrmMain/TApplication/TFrmFileList…）→ 遍历菜单（GetMenu/GetMenuItemCount/GetMenuStringA）→ SendMessage/PostMessage 模拟操作、SetCursorPos/BringWindowToTop
> - **端口管理**：读取/修改 M2 全服务端口（DBPort1-8、GatePort1-8、RunGate/SelGate/LoginGate、LogServerPort、MsgSrvPort、IOCPRunGate 等），冲突检测（netstat）→ 报红 → 一键替换
> - `!setup.txt` 目录键读写（BaseDir/BoxsDir/CastleDir/ChatDir/ConLogDir/LogDir/GuildDir/NoticeDir…）
