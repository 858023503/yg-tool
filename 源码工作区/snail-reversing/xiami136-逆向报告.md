# 虾米工具箱 V1.3.6 逆向报告 — 网站管理 + 存销

> 逆向日期:2026-08-08
> 目标:`D:\传奇工具\虾米工具箱V1.3.6`(PyInstaller one-dir, 未加密, 可完整反编译)
> 重点:网站管理功能 + 存销功能(代码级还原)
> 结论:V1.3.6 完整可逆向,核心逻辑已还原为可读 Python 源码(见交付物清单)

---

## 一、技术概况

| 项 | 值 |
|---|---|
| 打包方式 | PyInstaller one-dir(Python 3.8.10 + PySide2 GUI) |
| 主程序 | `虾米工具箱.exe`(354KB bootloader) + `虾米工具箱.pkg`(3.2MB CArchive) |
| CArchive 结构 | 尾部 COOKIE(`MEI\f\v\n\v\016`),TOC **倒序未压缩**(首条目 PYZ-00.pyz),条目格式 `entry_len(4)+entry_off(4)+compr_len(4)+uncompr_len(4)+compr(1)+type(1)+name` |
| PYZ 结构 | 头 `PYZ\0`+版本+toc_offset(大端),模块数据 = **裸 marshal code 对象**(无 pyc header),toc = 未压缩 marshal(老格式,短 tuple=0x29/短串=0xda/REF=0x72) |
| 模块数 | 215(业务模块 8 个,其余标准库) |
| 业务模块 | `工具箱_qt.py`(2.2MB 主程序,3168 函数)、`dark_workbench_shell.py`、`embedded_droprate_template.py`(111KB 爆率页模板)、`embedded_store_template.py`(存销脚本模板)、`toolbox_update.py`、`tools/item_name_loader.py` |

**可复用解包方法**(本目录脚本):
- `unpack-136-v2.js` + `unpack-136-pyz2.js`:CArchive 倒序 TOC + PYZ 流式解压 → `xiami136-pkg/pyz_*.bin`
- `name-136.py`(Python 3.8:`tools/py38/py/python.exe`):marshal.loads 提取 co_name 命名全部模块
- `decompile-136-batch.js` + `decompile-one-136.py`:逐方法 decompyle3 反编译(25s 超时隔离)

---

## 二、网站管理功能还原

### 2.1 类结构

| 类 | 方法数 | 职责 |
|---|---|---|
| `_WebsiteManagerPage` | 209 | 网站管理页面(站点设置/内容/爆率查询/QQ群/远端同步/预览/发布) |
| `_WebsiteBuildWorker` | 62 | 后台构建 Worker(解析引擎数据 → 生成 site.json + HTML 页面) |
| `_MicroClientConfigPage` | 188 | 微端模板配置(载入模板/维护路径/资源/状态/发布配置/状态扫描) |

### 2.2 站点设置(已反编译 `_build_website_site_tab`)

- **站点名称** `name_edit` / **网站标题** `title_edit`
- **外网访问**:`site_enabled_ck`(打开外网) + `preview_port_sb`(端口,默认 8000) + `preview_url_edit`(访问地址,只读) + `btn_open_url`(打开链接)
- **网站目录** `output_edit`(只读,输出目录) + `btn_out_browse`(说明/浏览)

### 2.3 构建流程(已反编译 `_WebsiteBuildWorker.run` + dis 补充)

```
run():
  site = self._site or {}
  name = str(site.get('name','')).strip()  → 空则 finished(False,'站点名称为空')
  out_dir = str(site.get('output_dir','')).strip() → 空则 _writable_app_dir() 兜底
                                              → 还空则 finished(False,'未设置根目录或输出目录')
  data_dir = Path(out_dir)/'Website'/'data'  → makedirs(exist_ok=True)
  # 构建 site 数据 dict(写入 site.json):
  site = {
    'title':..., 'announcement':..., 'intro':...,
    'versions':[...],            # 版本展示(名称/简介/图片/下载地址)
    'qq_groups':[...],           # QQ 群 → url = 'tencent://groupwpa/?subcmd=all&param=7&uin='+群号
    'penguin':..., 'enabled':False, 'site_enabled':False,
    'hero_video':..., 'hero_video_autoplay':False, 'hero_video_loop':False,
    'drop_enabled':True, 'drop_reverse':False,
    'drop_types':[...], 'drop_queries':[...],   # 爆率查询数据
  }
  # 写 site.json + 渲染 index/download/droprate 三个 HTML 页面
```

### 2.4 网站数据来源(已反编译 `_parse_mongen`/`_parse_merchant_npcs`/`_parse_map_info`)

- `_parse_mongen`:解析 `Mir200/Envir/MonGen.txt` + `Robot_def/RobotManage.txt`,**同时支持 MonGenEx(动态刷怪,`_consume_mongenex`)和旧格式(`_consume_legacy`)**
  - 子函数:`_strip_inline_semicolon_comment`(去行内 `;` 注释)、`_is_num`、`_add_spawn(map_code,x,y,monster,count,time_val,time_text)`、`_consume_line(ln, force_dynamic)`
- `_parse_merchant_npcs`:解析 MerChant.txt(NPC 注册)
- `_parse_map_info`:解析地图信息
- `_export_droprate_json`:从 MonItems 爆率文件生成爆率查询 JSON(怪物 → 掉落表)

### 2.5 爆率查询页模板(完整提取 `embedded_droprate_template.py`)

- 111KB 完整 HTML+JS 模板(`xiami136-html-embedded_droprate_template.html`),含:
  - 首页(index.html):站点名/公告/QQ群/版本展示(轮播)/hero_video(视频支持 iframe+mp4)/爆率查询入口
  - 下载中心(download.html):版本下载 + 扩展资源
  - 爆率查询(droprate.html):按怪物/物品搜索,4 列掉落卡片
- 数据格式:`site.json`(versions/drop_queries/qq_groups/announcement 等),模板 JS `fetch('site.json')` 渲染

### 2.6 远端同步(已反编译 `_build_website_drop_remote_box`)— V1.3.6 特色

- **本机接收接口**(HTTP 端点,开外网访问)+ **本机密钥**(token,Password 输入框)
- **远端地址**(如 `http://192.168.1.6:8000`)+ **远端密钥**(对方工具箱的本机密钥)
- 按钮:`同步当前查询到远端` / `新建并同步到远端` — **工具箱之间通过 HTTP API 同步爆率查询数据**
- 数据模型:`drop_queries`(id/name + 怪物掉落数据)

### 2.7 微端模板(`_MicroClientConfigPage`)

- 载入微端模板 → 维护路径/资源/状态 → 状态扫描(`_schedule_status_scan` + `_on_status_scan_finished`)→ 保存模板或发布配置
- 支持进程状态检测 + `_run_pending_force_kill`(强杀)

---

## 三、存销功能还原

### 3.1 类结构

| 类 | 方法数 | 职责 |
|---|---|---|
| `_StoreGeneratorLite` | 114 | 存销生成器(核心:脚本生成/注入/定时器/变量/删除) |
| `_StoreSettingsPage` | 50 | 存销配置页面(区服文件夹/通区目录/脚本参数/预览/生成) |

### 3.2 生成流程(已反编译 `_ensure_feature_scripts` + `_build_qmanage_snippet` 等)

**输入参数**:区服文件夹名、功能文件夹名、分类目录名、脚本名、方法名、按钮编号、通区目录名、区服变量(U 变量)、传送条件、定时器 id

**生成 4 个脚本文件**(写入 `QuestDiary\{feature_folder_name}\`):
```
创建文件.txt
界面配置读取.txt
存销变量初始化.txt
{script_name}.txt        ← 主脚本(咕咕鸡过滤模板替换而来)
```

**模板替换**(embedded_store_template = 咕咕鸡过滤通区存储脚本, `_load_filter_template` 加载):
```python
content.replace("\\游戏功能\\", f"\\{feature_folder_name}\\")
content.replace("..\\..\\..\\..\\通区文件\\", f"..\\..\\..\\..\\{common_folder2}\\")
content.replace("<$SERVERNAME>", zone_folder2)
content.replace("<$USERID>_<$USERNAME>", f"<$STR({store_u_var})>")
content.replace("咕咕鸡过滤.txt", f"{script_name}.txt")
content.replace("@咕咕鸡过滤", f"@{method_name}")
content.replace("[@咕咕鸡过滤]", f"[@{method_name}]")
content.replace("咕咕鸡过滤", script_name)
if teleport_condition: content.replace("LARGE U599 499", teleport_condition)   # 传送条件
if store_timer_id:     content = _replace_timer_number_in_store_text(content, 51, store_timer_id)
```

**生成脚本骨架**(无内置模板时):
```
[@方法名]
#IF
#ACT
#CALL [\{feature_folder_name}\{script_name}.txt] @{method_name}
```

### 3.3 定时器选择(已反编译 `_choose_unused_store_timer_id`)

```python
start_tag = ";存销定时器写入记录,请勿删除,虾米工具箱QQ群:1072296527"
end_tag   = ";存销定时器写入记录结束,请勿删除,虾米工具箱QQ群:1072296527"
# 1. 读 QManage.txt,从标记块提取之前的 timer id(优先复用)
# 2. 扫描 Envir 全部 .txt 的 SETONTIMER 占用(排除目标脚本 + QManage 已注入块)
# 3. 优先返回之前 id(空闲时)或 51;否则 52..255 找第一个空闲;再 1..50
```

### 3.4 注入 QManage/QFunction(已反编译 `_build_qmanage_snippet`/`_build_qfunction_snippet` 命名 + 字符串)

- QManage:`SETONTIMER {timer_id} 时间间隔` + `[@OnTimer {timer_id}]` 段 → `#CALL [\功能文件夹\脚本.txt] @方法名`
- QFunction:按钮点击触发 → 调用存销脚本方法
- 注入带标记块(`;存销写入记录` / `;存销定时器写入记录`),支持幂等(重复生成先清理旧块)

### 3.5 标记块处理(已反编译 `_process_injected_text`)

```python
def process_by_tags(t, st, et):   # 按起止标记切块,对块内内容做 processor(替换)
# 旧标记 ;TOOL_INJECTED_START/END → 新标记 ;存销写入记录...
```

### 3.6 一键删除(已反编译 `delete_generated` + `_remove_store_marked_blocks_from_file`)

- 按标记块清理已注入的 QManage/QFunction 内容 + 删除生成的脚本目录
- 支持清理旧版 `U变量初始化.txt`(检测到标记块则删除)

### 3.7 存销配置 UI(`_StoreSettingsPage`,已反编译)

- 区服文件夹名/通区目录(`_browse_common_dir`)/脚本参数(`_build_store_script_params_box`)
- 预览面板(`_build_store_preview_panel`,实时预览生成脚本)
- 生成按钮(`_build_store_generate_bar`)/配置保存(`_cfg_dict`/`_cfg_path`/`_cfg_needs_migration`)
- 自动从版本目录填充(`_auto_fill_from_version`)

---

## 四、与 1.4.x(已有逆向)对比

| 维度 | V1.3.6 | 1.4.x |
|---|---|---|
| 打包 | PyInstaller one-dir(旧 CArchive,未加密) | PyInstaller(stream 结构) |
| 主程序 | 单文件 `工具箱_qt.py`(2.2MB,3168 函数) | 多 stream 模块 |
| 网站管理 | **有**(_WebsiteManagerPage + Worker + droprate 模板) | 有(1.4.x 同源,模板略有差异) |
| **远端同步** | **有**(工具箱间 HTTP 同步爆率查询,含密钥) | 未见于 1.4.x 还原(可能新/旧差异) |
| 存销 | `_StoreGeneratorLite`(咕咕鸡过滤模板 + 字符串替换) | 存销生成逻辑相似(变量初始化/定时器/标记块) |
| 微端 | `_MicroClientConfigPage`(模板/状态扫描/强杀) | 有 |

**V1.3.6 与 1.4.x 核心逻辑同源**(变量初始化、定时器选择、标记块注入、网站 site.json+droprate 模板),差异在 UI 组织(单文件 vs 多模块)与 V1.3.6 特有的远端同步。

---

## 五、可复用到本工具箱的点(建议)

1. **网站管理**:
   - droprate.html 模板(111KB 完整,含版本展示/下载中心/爆率查询三页)可直接作为开区网站模板升级
   - `_parse_mongen` 的 **MonGenEx 动态刷怪解析**(`_consume_mongenex`)——本工具箱 spawnTable 可补 MonGenEx 支持
   - **远端同步**(工具箱间 HTTP 同步爆率查询数据 + token 鉴权)——本工具箱暂无此功能
2. **存销**:
   - `_choose_unused_store_timer_id`(全 Envir 扫描 SETONTIMER + 复用标记块 id)——与 injectQManageTimer 一致,可对齐
   - 咕咕鸡过滤模板替换(通区存储)——本工具箱 genSalesData 可参考其区服变量/传送条件参数化

---

## 六、交付物清单

```
xiami136-pkg/                        215 个模块 pyc(裸 marshal)
xiami136-names.txt                   模块名清单(名字+大小)
xiami136-strings-toolbox_qt.txt      主程序全部字符串常量
xiami136-html-embedded_droprate_template.html  爆率查询网站模板(111KB 完整)
xiami136-website-store/              ~101 个方法反编译源码(网站管理+存销核心类)
  _WebsiteManagerPage__*.py          网站管理页(82 方法)
  _WebsiteBuildWorker__*.py          网站构建 Worker(run/export_droprate_json/parse_mongen...)
  _StoreGeneratorLite__*.py          存销生成器(定时器/模板替换/标记块/删除)
  _StoreSettingsPage__*.py           存销配置页
脚本:
  unpack-136-v2.js / unpack-136-pyz2.js   解包(CArchive 倒序 TOC + PYZ 流)
  name-136.py / structure-136.py          模块命名 + 函数结构
  decompile-136-batch.js / decompile-one-136.py  逐方法 decompyle3 反编译
```

> 说明:个别方法(如 `_build_site`/`_export_droprate_json_standalone`)decompyle3 因 try/finally(SETUP_FINALLY)失败,已用 `dis` 反汇编补充(见报告 2.3/2.4);需要完整反编译可改用 pycdas 或人工整理。
