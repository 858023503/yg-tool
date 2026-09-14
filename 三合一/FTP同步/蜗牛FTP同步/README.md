# 蜗牛FTP同步 —— 逆向证据 + 元歌实现

> 蜗牛实用工具「文件同步（多服务器）/ 远程脚本服务器」，及元歌工具箱的完整复刻。
> 完整证据见 `证据-REVERSE-REPORT.txt`。

## 一、原版逆向结论（9.13.1 功能还原）

**远程脚本服务器（index-c1dce787）**：
```
把服务端目录批量同步到远程 FTP 服务器。
配置：host/port/user/pass + 同步规则（本地目录=远程目录）
```

**§8 文件同步（多服务器）**：
```
同步规则（指定路径/同级目录/向上 N 级）、同步密码、启动同步监听服务（端口 80-65535）跨服同步
```

## 二、元歌实现（已融合 ✅）

```js
// rate-tool/lib.js
loadSyncConfig / saveSyncConfig   // 同步配置持久化（%APPDATA%\元歌工具箱）
ftpSync(root, {host, port, user, pass, rules})  // FTP 同步（basic-ftp 内联）
// 规则：{ local, remote, filters } —— 本地目录=远程目录
```

**实测**：本地极简 FTP 服务器验证 13 文件上传 0 失败；二次同步 6 跳过（大小对比）。

## 三、CLI / GUI

```
元歌工具箱-CLI.exe sync <引擎根> --host 127.0.0.1 --port 21 --user test --pass 123
```
GUI：侧边栏「目录同步 FTP」面板
