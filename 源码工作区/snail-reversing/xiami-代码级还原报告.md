# 虾米工具箱 代码级还原报告

> 还原方法：PyInstaller CArchive 解包（20001 流）→ 识别纯 marshal pyc → 补标准 py3.8 头 → pycdc/pycdas/uncompyle6 反编译 + 自研结构提取器
> 工具：embeddable Python 3.8.10 + uncompyle6 + decompyle3 + pycdc/pycdas（decompyle-builds 预编译版，走 clash 代理 7897 下载）

## 一、还原成果清单

### 1. 业务模块完整源码（pycdc 反编译成功，可直接读）✅
| 模块 | 大小 | 说明 |
|---|---|---|
| stream_6503 → `npc_visual_v2_page.py` | 223KB→源码 | NPC 可视化页面（QGraphicsScene 拖拽、PAK 素材、SQLite 存储）|
| stream_6715 → `visual_spawn_page.py` | 51KB→源码 | 刷怪可视化页面（MonGen 表格编辑）|
| stream_6699 → `toolbox_native_core.py` | 47KB→源码 | 原生核心（ctypes/引擎交互）|
| stream_6696 → `toolbox_core_rpc.py` | 26KB→源码 | 核心 RPC（工具箱内部通信）|
| stream_6695 → `toolbox_capabilities.py` | 30KB→源码 | 能力探测 |
| stream_6702 → `toolbox_update.py` | 57KB→源码 | 工具箱更新 |
| stream_6494 → `asset_providers.py` | 66KB→源码 | 素材提供（PAK 处理）|
| stream_6465 → `embedded_droprate_template.py` | 111KB→源码 | **爆率查询页 HTML 模板**（完整 CSS/JS 发布站页面）|

### 2. 主程序 `工具箱_qt.py`（2.5MB，297 顶层函数）✅ 结构级
- `main-structure.txt`（518KB）：**完整函数/类树 + 签名 + docstring + 字符串常量**
- `main_0014_disasm.txt`（38MB）：**pycdas 完整指令级反汇编**
- 关键函数已识别：
  - 兑换：`_refresh_exchange_npc_map_options` / `_on_exchange_npc_map_*`（兑换 NPC 地图下拉）
  - CDK：`_CdkManagerPage` / `_build_cdk_*`（面板/生成/记录/备份/核销）
  - PAK：`_MicroPakRpc*` / `_convert_micro_pak_password_line` / `_run_micro_pak_rpc`（PAK 密码加密 RPC）
  - 端口/货币/回收/存销/注入/变量/微端/网站 等均有对应函数群

### 3. 依赖库 639 模块反编译 ✅
- PIL/Image、PySide2 相关、标准库（datetime/socket/ftplib 等）全部可读

## 二、还原程度说明（诚实版）

| 层级 | 状态 |
|---|---|
| 业务模块源码 | ✅ 完整（pycdc 直接反编译）|
| 主程序结构（函数/类/字符串）| ✅ 完整（自研提取器）|
| 主程序指令级反汇编 | ✅ 完整（pycdas）|
| 主程序 Python 源码 | ⚠️ 反编译工具限制：pycdc 对 2.5MB 超大模块静默失败，uncompyle6/decompyle3 语法解析失败（SETUP_ANNOTATIONS）——但结构+字符串+字节码完整，可还原所有功能逻辑 |

## 三、为何此前 pycdc 404
- `zrax/pycdc` 官方仓库**从不发 release**（404 原因）
- 用户提供 `extremecoders-re/decompyle-builds` 预编译版（走 clash 7897 代理下载成功）

## 四、与蜗牛/快捷助手的对比基础
三版均为"服务端工具箱"：
- **蜗牛**：Electron + V8 字节码（已完整反编译 JS/字节码）
- **快捷助手**：VB6 + UPX（已脱壳分析 Win32 API）
- **虾米**：Python + PySide2（本次代码级还原）
- **融合方向**：虾米独有的 变量查询/爆率查询页发布/数据库管理/PAK 加密/MonGen 表格编辑/编码转换/文件对比 等可按需吸收
