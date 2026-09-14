# 蜗牛脚本注入 —— 逆向证据 + 元歌实现

> 蜗牛实用工具「脚本注入」（index-ec0ab199 + form-d4b8b1b9），及元歌工具箱的完整复刻。
> 完整证据见 `证据-REVERSE-REPORT.txt`。

## 一、原版逆向结论（9.11.1 功能还原）

**注入项列表（artifacts）**：可拖拽排序，含 名称/内容/加密保存（isEncrypt 模板保护）

**目标路径选项**：`Market_Def\QFunction-0.txt` / `MapQuest_Def\QManage.txt` / `QuestDiary`

**注入类型（type）**：追加/替换/创建脚本内容

**变量占用替换**：「如果要对脚本中用到的变量进行占用替换，请在这选择，选择越多，注入越慢」「替换注入脚本内占用变量」

**防重复**：注入过提示「检测到当前模板已经注入过：1.取消注入 2.追加注入 3.覆盖注入（推荐）」

## 二、元歌实现（已融合 ✅）

```js
// rate-tool/lib.js
injectScript(root, item)      // 注入（mode: cancel/append/overwrite）
isInjected(root, name)        // 防重复检测
extractVars(text)             // 变量提取（N$/S$/G$/I$/A$/T$/D$/M$/P$/U/Q 全系）
replaceOccupyVars(text, used) // 变量占用替换（支持中文变量名 N$签到数）
INJECT_MARK = ';@@yge-inject:'  // 标记（原版 ;@@snail-inject: 已去私货）
```

**实测**：三模式全验证；变量替换 `N$签到数 → N$签到数_1` ✓；中文变量名支持。

## 三、CLI / GUI

```
元歌工具箱-CLI.exe inject <引擎根> --name 签到 --target QF --mode append
```
GUI：侧边栏「脚本注入」面板（名称/目标/模式/变量替换复选框）
