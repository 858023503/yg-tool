# 虾米爆率管理 —— 逆向证据 + 元歌实现

> 虾米工具箱（Python 3.8 + PySide2，PyInstaller）的爆率管理，及元歌工具箱的复刻实现。

## 一、原版逆向结论

虾米爆率管理分两块：

### 1. 爆率批量操作（主程序）
- `_MonItemsAddWorker` —— **批量新增爆率**：物品列表 × 概率 → 批量追加到目标怪（全服/指定怪）
- `_drop_resolve_call` —— **#CALL 还原**：解析 `#CALL [路径]` 引用（路径校验、防设备/扩展路径、防指向备份目录）
- `_drop_check_call_target` —— #CALL 目标必须是 TXT（防误读）

### 2. 爆率查询（网站侧，已融合进"开区网站"）
- `droprate.json` 导出：怪物/物品/掉落/地图走法/NPC
- 前端查询：版本选择 + 物品/怪物/NPC/地图 4 模式（indexedDB 缓存）

## 二、元歌实现（已融合 ✅）

```js
// rate-tool/lib.js
addRates(root, {items, rate, target})      // 批量新增（还原 _MonItemsAddWorker）
resolveCall(root, mon, callPath)           // #CALL 解析（还原 _drop_resolve_call）
scanCallRefs(root)                          // 扫描全服 #CALL 引用
restoreCall(root, mon)                      // #CALL 还原（展开 + 防穿越 + 防备份目录）
detectEncoding(buf)                         // 多编码检测（gb18030/utf-8-sig/utf8）
```

**实测验证**（副本）：
- 批量新增：屠龙+裁决 1/100 → 2 文件 4 条 ✓
- #CALL 扫描：1 处引用 → 展开 OK ✓
- `../../` 穿越 → 拒绝 ✓；`@backup/` → 拒绝 ✓
- 多编码：gbk→gb18030、utf8→utf8、ascii→utf8 全对 ✓

## 三、CLI / GUI

```
元歌工具箱-CLI.exe addrates <引擎根> --items 屠龙,裁决 --rate 100 [--monster 白野猪]
元歌工具箱-CLI.exe callrestore <引擎根> [--monster 白野猪]
```
GUI：爆率面板「📥 批量新增爆率」「🔗 #CALL 还原」卡片
