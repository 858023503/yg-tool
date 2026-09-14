# 虾米货币兑换 —— 逆向证据 + 元歌对照（取长补短版）

> 虾米工具箱「货币兑换」（_CurrencyTab / _build_currency_exchange_*），及元歌工具箱的对照。
> 证据来源：`main-structure.txt`（工具箱_qt.py 函数树，66 个货币相关函数）。

## 一、原版逆向结论

### UI 结构（_build_currency_tab 系列）

```
_build_currency_tab                货币 tab
├── _build_currency_info_bar       顶部信息条
├── _build_currency_table_box      货币表格（_currency_table_rows 行数据）
│     ├── _currency_cell_display_text      单元格文本
│     └── _make_currency_header_label      表头
└── _build_currency_exchange_box   兑换规则区
      ├── _build_exchange_map_combo       ★ 兑换 NPC 地图下拉 + 自动补全
      │     "兑换 NPC 地图" / "选择或输入兑换 NPC 所在地图" / "请选择地图名称"
      ├── _build_currency_exchange_rows   多行兑换规则
      │     └── _configure_currency_exchange_side(amount, currency_type, custom, row_idx, side)
      │           "数量" "填写 1 到 1000000000 之间的整数"（左右两侧对称）
      │           currencyExchangeTypeCombo（货币类型下拉，compact 68-78px）
      │           ★ 选「自定义」→ 显示 currencyExchangeCustomEdit 输入框
      └── _count_active_currency_exchange_rules / _refresh_currency_exchange_summary
            ★ 活动规则统计（summary 胶囊：_exchange_rows/left_amount）
```

### 关键设计
1. **地图下拉 + 自动补全**（`_build_exchange_map_combo` + `_init_exchange_map_completer`）：选择或输入兑换 NPC 所在地图
2. **多行对称规则**（`_configure_currency_exchange_side`）：每行 = 左侧(数量+货币) ⇄ 右侧(数量+货币)
3. **自定义货币**（`_sync_currency_exchange_custom`）：下拉选「自定义」→ 动态显示自定义输入框
4. **规则统计**（`_count_active_currency_exchange_rules`）：summary 显示活动规则数
5. **异步加载**（`_start_currency_setup_read` / `_apply_currency_loader_result`）：货币列表后台线程扫描

## 二、元歌对照（取长补短后）

| 对比项 | 虾米 | 元歌（融合后） |
|---|---|---|
| 兑换 NPC 地图 | ★ 下拉+自动补全（MapInfo） | ✅ **已加**（🗺 地图按钮 → datalist 554 地图自动补全） |
| 多行规则 | 每行左右两侧对称 | ✅ 已有多行（x-list 动态增行，afrom⇄ato） |
| 自定义货币 | 下拉「自定义」→ 输入框 | ✅ 已有（diy 选项 → 变量框，货币名\|变量） |
| 规则统计 | summary 胶囊 | ✅ 生成后显示「N 项 × M 档倍率」 |
| 货币列表加载 | 异步线程扫描 | ✅ extractCurrencies 一键提取（更直接） |
| 兑换命令 | 未确认 | ✅ 金币单 IF / GameXxx 双 IF / DEC/INC 变量（对齐真实端） |
| 倍率档 | 无 | ✅ count 参数（×10/×100 多档，元歌独有） |
| 货币概况 | 无 | ✅ NPC 菜单首行显示当前货币概况（元歌独有） |
| 只生成不写入 | 无 | ✅ generateOnly 模式（元歌独有） |

## 三、本轮新增

**地图下拉 + 自动补全**（对齐虾米 `_build_exchange_map_combo`）：
```js
// rate-tool/lib.js
listMaps(root)   // 读 MapInfo.txt → [{code, name}]（含实例地图）
```
- CLI：无需（GUI 功能）
- GUI：兑换面板「🗺 地图」按钮 → 填充 datalist → 输入框可下拉选择地图代码（原生自动补全）
- 实测：554 张地图（0139 新人地图 / c1 八方城）

## 四、CLI / GUI

```
元歌工具箱-CLI.exe currency <引擎根>            # 一键提取全服货币
元歌工具箱-CLI.exe exchange <引擎根> --cfg 兑换.json [--count 1]
```
GUI：侧边栏「货币兑换」面板（🗺 地图下拉 + 提取货币 + 多行兑换项 + 倍率档 + 只生成）
