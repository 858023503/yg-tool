# 蜗牛脚本搜索替换 —— 逆向证据 + 元歌实现

> 蜗牛实用工具「脚本搜索/替换」（index-0a99aa24），及元歌工具箱的完整复刻。
> 完整证据见 `证据-REVERSE-REPORT.txt`。

## 一、原版逆向结论（9.7.1 功能还原）

```js
// index-0a99aa24.js 表单结构
form = { path, type: ".txt", isCase: true, other: [], isChildren }
oldContent  // 搜索内容
newContent  // 替换内容（空 = 删除，确认提示「蜗牛检测到要替换的内容为空，确定继续替换？」）
// 结果含文件路径 + 匹配行号（arrays.map(e=>e.row+1)），可「查看脚本」「打开目录」
```

**关键设计**：搜索目录/文件类型/区分大小写/包含子目录 + 搜索/替换双模式 + 行号定位。

## 二、元歌实现（已融合 ✅）

```js
// rate-tool/lib.js
searchScripts(root, {text, matchMode, type, isCase, isChildren})
replaceScripts(root, {oldText, newText, ...})
// matchMode: exact(精确)/contain(包含)/regex(正则)/prefix(前缀)/suffix(后缀)
```

**增强**：matchMode 5 种匹配模式（原版只有包含匹配）。

## 三、CLI / GUI

```
元歌工具箱-CLI.exe grep <引擎根> <关键词> [--mode contain] [--type .txt]
元歌工具箱-CLI.exe search <引擎根> --old xxx --new yyy [--regex]
```
GUI：侧边栏「脚本搜索替换」面板
