# FTP同步 —— 三家实现专题

> FTP 同步：把服务端目录批量同步到远程 FTP 服务器，还原自蜗牛/快捷助手/虾米。

## 一、功能

1. 配置：host/port/user/pass + 同步规则（本地目录=远程目录）
2. 同步：增量上传（大小对比跳过未变化）
3. 配置持久化：%APPDATA%\元歌工具箱

## 二、三家实现对比（详见各子目录 README）

| 实现 | 机制 | 状态 |
|---|---|---|
| **蜗牛** | index-c1dce787 远程脚本服务器：host/port/user/pass + 本地=远程规则 | 元歌按其复刻 ✅ |
| **快捷助手** | **无 FTP 同步**（无证据） | 无借鉴 ❌ |
| **虾米** | 「同步」= CDK/授权同步（非 FTP 文件同步） | 无借鉴 ❌ |

## 三、元歌工具箱实现

**函数**（rate-tool/lib.js）：`ftpSync / loadSyncConfig / saveSyncConfig`（basic-ftp 内联进 SEA）

```
元歌工具箱-CLI.exe sync <引擎根> --host 127.0.0.1 --port 21 --user test --pass 123
```
GUI：侧边栏「目录同步 FTP」面板

**实测**：13 文件上传 0 失败；二次同步 6 跳过（大小对比）。
