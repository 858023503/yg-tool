# 蜗牛物品管理 —— 逆向证据

> 来源：蜗牛实用工具 REVERSE-REPORT.md（渲染进程功能清单 §1 数据库/数据管理）

## 证据

蜗牛有 **物品库（数据库级）**：
- StdItems 全字段编辑：名称/大类/外观/重量/数量/来源/保留/特殊条件/需要等级/出售价格/库存量/持久/内观/颜色/是否叠加/光效
- 过滤/搜索/增删改
- 通过 Access 数据库：`Provider=Microsoft.ACE.OLEDB.12.0` / `Jet.OLEDB.4.0`（node-adodb），兼容 `DataTable_HeroDB.db`；另有 SQLite 支持
- 技能库（Magic）、怪物库（Monster）、NPC 工具

## 结论

蜗牛是**数据库级**物品编辑（StdItems 全字段），比文本配置更底层。元歌的物品管理聚焦 **Envir 文本配置**（备注/解包/商铺/套装——快捷助手路线），两者互补；元歌未做数据库级编辑（用户评估后跳过）。

证据文件：`证据-REVERSE-REPORT物品库段.txt`
