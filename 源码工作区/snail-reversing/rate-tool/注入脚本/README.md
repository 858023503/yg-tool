# 元歌全套部署 · 注入模板（适配每个版本）

用 GUI「脚本注入」页：选目标 → 粘贴对应文件内容（或存为模板）→ 执行注入（追加模式）。

## 注入模板（GUI 目标 → 文件）

| 模板文件 | GUI 注入目标 | 作用 |
|---|---|---|
| qm添加.txt | QM | QManage：[@Login] 登录触发+4倍率、[@OnTimer89] 自动吃药+星芒、[@OnTimer90] 在线杀怪点 |
| qf添加.txt | QF | QFunction：13 段（ButtonClick43/Attack/MagicAttack/Struck/Killmon/UserCmd1 等） |
| effectimagelist-添加.txt | EffectImageList | 素材列表 +7：ygzs/ygjinengtx/ygjinengtx2/ygchaowuhedan/ygchaowushandian/1433/咕咕鸡素材 |
| groupitemlist-添加.txt | GroupItemList | 物品分组 +1666（元歌包月赞助玩家专属） |
| itemrulelist-添加.txt | ItemRuleList | 物品规则 +元歌·国服玩家[神器] |
| itemdesclist-添加.txt | ItemDescList | 物品描述 +2（元歌·国服玩家[神器]、元歌包月赞助玩家称号） |

## 列表类目标的行为（EffectImageList/GroupItemList/ItemRuleList/ItemDescList）

- **追加行 + 防重复**：已存在的行跳过，只加新行；全部已存在则提示"无需追加"
- **不解析段、不写注释标记**（避免引擎把注释行当素材/配置读取失败）
- 文件强制 GBK 写入（引擎按 GBK 读，UTF-8 会中文乱码）
- 模式固定为追加（列表无段结构，覆盖/取消不适用）

## 非注入步骤（每个版本手动）

1. **元歌脚本目录**：整个 `元歌脚本` 目录复制到 `Mir200\Envir\QuestDiary\`（文件操作，非注入）
2. 注入后重启 M2 生效（EffectImageList 素材需在 M2 查看列表信息确认）
