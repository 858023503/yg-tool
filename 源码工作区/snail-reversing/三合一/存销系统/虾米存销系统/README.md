# 虾米存销设置 —— 逆向证据 + 元歌对照（取长补短版）

> 虾米工具箱「存销设置」（_SalesStore 系，74 个函数），及元歌工具箱的对照。
> 证据来源：`main-structure.txt`。

## 一、原版逆向结论

### 配置字段（_render_local_store_feature / _render_local_store_bundle）

```
feature_folder   功能文件夹
category_folder  分类文件夹
script_name      脚本名
method_name      方法名
common_folder    公共文件夹
zone_name        区名
timer_id         定时器 id
qr_trigger       QR 触发
```

**形态**：**脚本注入式存销**——生成存销目录结构 + 注入存销脚本 + 定时器驱动（与蜗牛"数据打包式"不同）。

### 关键机制

1. **存销标记块**（`_store_owned_block`）：
   ```
   ;存销写入记录,请勿删除,虾米工具箱QQ群:1072296527
   ... 内容 ...
   ;存销写入记录结束,请勿删除,虾米工具箱QQ群:1072296527
   ```
   ⚠️ 虾米标记含 **QQ 群引流**——元歌融合时**去私货**（用 `;元歌存销数据 - 请勿删除本文件`）

2. **定时器冲突检查**（`_choose_unused_store_timer_id`）：读 QManage.txt 已用定时器 → 找未用 id

3. **卸载清理**（`_remove_store_marked_blocks_from_file` / `_delete_or_strip_store_script` / `_remove_store_qr_hooks_from_text`）：移除存销标记块、剥离脚本、清理 QR 钩子

4. **2PC 提交**（`_commit_store_2pc`）：两阶段提交，中断自动恢复（"存销提交中断且自动恢复失败"）

5. **本地模板**（`_read_local_store_template`）：resources 的"咕咕鸡过滤.txt"存销模板

## 二、元歌对照（取长补短后）

| 对比项 | 虾米 | 元歌（蜗牛形态 + 融合） |
|---|---|---|
| 存销形态 | 脚本注入式（目录+脚本+定时器） | ✅ 数据打包式（5 阶段：物品/掉落/刷怪/存储/完成） |
| 配置 | 功能/分类/脚本/方法/公共/区名/定时器 | ✅ 路径/数据目录/爆率格式/分组/编号/引擎 |
| **定时器冲突检查** | _choose_unused_store_timer_id | 🔧 **已补**：salesTimers（⏱ 检查定时器占用按钮，读 QManage 已用 13 个 + 推荐未用 2） |
| **存销说明标记** | 存销写入记录（含 QQ 群） | 🔧 **已补**：说明.txt（元歌标记，**去私货无 QQ 群**，含生成时间/配置项） |
| 卸载清理 | 移除标记块/脚本 | ⏳ 元歌数据打包不写服务端（无卸载对象）；若加"注入服务端"模式可补 |
| 2PC 提交 | 中断自动恢复 | ⏳ 元歌为直接写输出目录；写前备份可补 |
| 本地模板 | 咕咕鸡过滤.txt | ⏳ 元歌模板内置在 genSalesData |
| 编号格式 | 未确认 | ✅ 三格式（1A/A/1，蜗牛独有） |
| 引擎适配 | 未确认 | ✅ 凌风系/GOM系（蜗牛独有） |

## 三、本轮新增（对齐虾米）

1. **⏱ 检查定时器占用**（对齐 `_choose_unused_store_timer_id`）：
   ```js
   // rate-tool/lib.js
   salesTimers(root)   // 读 QManage → { used: [已用定时器], next: 推荐未用 }
   ```
   GUI：存销面板「⏱ 检查定时器占用」按钮 → 显示"已用 13 个：0,1,4,5,9,10,15,89,90,91,127,222,223；推荐未用：2"

2. **说明.txt 标记文件**（对齐 `_store_owned_block`，去私货）：
   - genSalesData 输出目录生成 `说明.txt`（生成时间/数据目录/爆率格式/分组/编号/引擎）
   - 无 QQ 群/引流

## 四、CLI / GUI

```
元歌工具箱-CLI.exe sales <引擎根> --out D:\存销数据 [--group 3] [--uid alnum] [--engine lf|gom]
```
GUI：侧边栏「存销系统」面板（生成路径 + 数据目录 + 配置 + ⏱ 定时器检查 + 生成）
