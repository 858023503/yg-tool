# 蜗牛快捷操作 —— 逆向证据 + 元歌实现

> 蜗牛实用工具「快捷操作」（index-f856a6b2），及元歌工具箱的完整复刻。
> 完整证据见 `证据-REVERSE-REPORT.txt`。

## 一、原版逆向结论

**导航**：左侧导航 `Wx` 数组 key:"open" → 异步加载 `index-f856a6b2.js`，组件三块：

1. **快捷文件**：30+ 按钮一键打开（Mir200目录/Envir目录/NPC文件/NPC目录/刷怪文件/爆率目录/机器人脚本/机器人触发/游戏公告1-3/数据库目录/账号数据库/角色数据库/地图事件/怪物元素/怪物说话/任务脚本/违禁词 等），可拖动排序自动保存
2. **NPC 列表**：表格（序号/地图名/NPC名/坐标/操作"打开"），过滤「请输入地图名过滤」「请输入NPC名过滤」，点打开 → 编辑器
3. **我的快捷**：自定义快捷项（localStorage 持久化）

## 二、元歌实现（已融合 ✅）

```js
// rate-tool/lib.js
QUICK_PATHS           // 18 个快捷文件路径模板
readMerChant(root)    // MerChant.txt 解析（118 NPC）
filterNpcs(npcs, {map, name})  // NPC 过滤
quickOpen(root, path) // 打开文件/目录（存在性检查）
```

GUI：侧边栏「快捷操作」面板（快捷文件按钮 + NPC 列表过滤 + 我的快捷 localStorage）

## 三、CLI / GUI

```
元歌工具箱-CLI.exe quick-open <引擎根> --path 快捷项名
元歌工具箱-CLI.exe merchants <引擎根> [-map 地图] [-name NPC]
```
GUI：侧边栏「快捷操作」面板
