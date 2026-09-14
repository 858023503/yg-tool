# 虾米回收生成 —— 逆向证据 + 元歌对照（取长补短版）

> 虾米工具箱「回收生成」（_RecycleGeneratePage），及元歌工具箱的对照。
> 证据来源：`main-structure.txt`（工具箱_qt.py 函数树，20+ 回收相关函数）。

## 一、原版逆向结论

### UI 结构（_build_recycle_* 系列）

```
_build                                   回收页
├── _build_recycle_panel_header          面板头（标题 + 徽章）
├── _build_recycle_config_bar            ★ 配置条：图码（IMGEX 图像代码 imageCode1/2）
├── _build_recycle_table_panel           回收条目表格
│     ├── _build_recycle_table           "回收条目 / 0 条规则" + 类别/货币 徽章
│     ├── _configure_recycle_table       行内编辑器（createEditor：物品下拉选择）
│     └── _build_recycle_table_actions   增行/删行（_add_row / _delete_selected_rows）
├── _build_recycle_script_panel          ★ 脚本预览面板
│     ├── _refresh_recycle_script_summary  ★ 脚本行数徽章 + 状态徽章
│     └── _build_recycle_script_actions   ★ 生成脚本按钮（primary）
└── 设置持久化
      ├── _load_settings / _save_settings   JSON 存取（_get_store_path）
      └── _restore_defaults               ★ 恢复默认（图码/前缀/变量/提示 + 全部条目）
```

### 关键设计
1. **物品分隔符**（`_split_items`）：`[|,，、;；\r\n]+`（竖线/逗号/中文逗号/顿号/分号/换行）
2. **货币类型下拉**（`_get_recycle_currency_type_options` + `_resolve_recycle_currency_code`）：金币/元宝/钻石/灵符/荣誉/积分 + 自定义
3. **物品多选器**（`_RecycleItemPickerDialog`）：`_normalize_items_sorted` 排序 + `_append_selected` 追加
4. **脚本生成**：`_build_script(cfg)` → `_generate_script`（ready/错误）+ 行数徽章 + `_copy_script`（复制剪贴板）
5. **脚本优化**（后台 worker）：`_optimize_content_in_section`（按段优化）
6. **编码检测**：`_detect_file_encoding`
7. **货币显示名映射**：`_read_recycle_currency_display_map`（金币/元宝/钻石/灵符/荣誉/积分）

## 二、元歌对照（取长补短后）

| 对比项 | 虾米 | 元歌（融合后） |
|---|---|---|
| 界面形态 | 表格式（行内编辑） | ✅ 勾选式（蜗牛 index-f056a783 原版风格） |
| 物品分隔符 | `[|,，、;；\r\n]+` 六种 | 🔧 **已补**：renderer 分隔改为 `[|,，、;；\r\n]+` |
| 货币类型 | 金币/元宝/钻石/灵符/荣誉/积分 + 自定义 | ✅ 金币/元宝/金刚石/灵符/自定义（版本命名差异，保留） |
| 图码配置 | IMGEX 图像代码 | ✅ 素材模式（wil/背景/勾选/未选图）——蜗牛原版 |
| 脚本行数徽章 | ★ 生成后显示行数 | 🔧 **已补**：rc-st 状态栏显示「脚本 N 行」 |
| 复制脚本 | ★ _copy_script 剪贴板 | 🔧 **已补**：📋 复制脚本按钮（navigator.clipboard） |
| 保存/加载配置 | ★ _load_settings/_save_settings | 🔧 **已补**：💾 保存配置 / 📂 加载配置（localStorage） |
| 恢复默认 | ★ _restore_defaults | 🔧 **已补**：↺ 恢复默认（空分类） |
| 物品多选器 | 独立对话框 | ⏳ 元歌为文本输入（分类行），多选器可后续加 |
| 脚本优化 worker | 按段优化 | ⏳ 未做（元歌脚本为模板生成，无旧脚本可优化） |
| 个人标识 | 无 | ✅ 自动分配空闲标识（allocFlags，元歌独有） |
| 去私货 | — | ✅ 品牌「元歌」，无 QQ 引流 |

## 三、本轮新增（对齐虾米）

1. **物品分隔符扩展**：`屠龙|裁决、金创药，药粉` 等混合分隔都能解析
2. **复制脚本到剪贴板**（虾米 `_copy_script`）：生成后点 📋 复制
3. **脚本行数徽章**（虾米 `_refresh_recycle_script_summary`）：生成后状态栏显示「脚本 N 行」
4. **配置持久化**（虾米 `_load_settings/_save_settings`）：💾 保存 / 📂 加载 分类配置
5. **恢复默认**（虾米 `_restore_defaults`）：↺ 一键清空恢复空分类

## 四、CLI / GUI

```
元歌工具箱-CLI.exe recycle <引擎根> --cfg 分类.json
```
GUI：侧边栏「回收生成」面板（NPC 位置 + 界面设置 + 分类列表 + 复制/保存/加载/恢复）
