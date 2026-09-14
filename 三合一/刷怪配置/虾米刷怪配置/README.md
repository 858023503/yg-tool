# 虾米刷怪配置 —— 逆向证据 + 元歌实现

> 虾米工具箱（Python 3.8 + PySide2，PyInstaller）的刷怪设置功能，及元歌工具箱的复刻实现。

## 一、原版逆向结论

**技术栈**：Python 3.8 + PySide2，PyInstaller 打包。刷怪核心在反编译模块 `stream_6715.py`。

### 1. `load_spawn_document` —— 刷怪文档加载
```python
def load_spawn_document(path = None, session = None):
    pass  # (Decompyle 不完整，核心在记录解析)
```

### 2. `_render_existing_record` —— **行级局部更新（核心亮点）**
```python
def _render_existing_record(record = None):
    content = record.original_content     # 原行文本
    replacements = record.fields()        # 修改后的字段
    spans = record.token_spans            # 字段在行内的位置区间
    replace_count = min(len(replacements), len(spans), 8)
    for index in range(replace_count - 1, -1, -1):
        original = record.original_fields[index]
        unchanged = replacements[index] == original
        if index in (1, 2, 4, 5, 6):       # 坐标/数量/范围/间隔：数值比较
            unchanged = int(replacements[index]) == int(original)
        # 未变化的字段不重写，保留原文（对齐 = 保留格式）
```

**关键设计**：**只替换变化的字段，未变化的字段保留原始文本**——而不是整行重建。
坐标/数量等数值字段用 `int()` 比较（`1` 与 `1.0` 视为相同，避免无谓重写）。

### 3. `_split_preserving_endings` —— **保留行尾**
```python
def _split_preserving_endings(text = None):
    chunks = text.splitlines(True)        # splitlines(True) 保留 \r\n / \n
    ...
    lines = []
    endings = []                          # 每行各自的换行符单独记录
```

**关键设计**：换行符随行保留（LF/CRLF 混合文件也能无损往返）。

### 4. `serialize_spawn_document` —— 序列化回写
基于 `_render_existing_record` 的行级更新 + `_split_preserving_endings` 的行尾保留，保证**注释/分隔线/空行/换行类型全保留**。

## 二、元歌实现（已融合 ✅）

```js
// rate-tool/lib.js —— 对齐虾米"行级更新 + 保留行尾"
function serializeSpawn(s) { ... }                    // 重建一行（保留 extra 尾列）
readMonGen 返回 newline（\r\n / \r / \n 自动检测）     // 对齐 _split_preserving_endings
preserveMonGenWrite(file, rawLines, newline)          // join(nl) + 尾换行保留
adjustMonGen：只更新 spawn 行（rawLines[lineIdx]）    // 对齐 _render_existing_record 行级更新
```

实测验证：
- LF 文件写回仍 LF（无 `\r\n` 混入）✓
- CRLF 文件写回仍 CRLF ✓
- 注释 `;...` / 分隔线 `----------` / header 全保留 ✓
- 未修改的行保持原文（不重写）✓

## 三、CLI / GUI

```
元歌工具箱-CLI.exe mg-adjust <引擎根> --count 2 --time 0.5   # 原刷怪调整（自动备份+格式保留）
元歌工具箱-CLI.exe dynamic <引擎根> --pro 50 [--qm]          # 动态刷怪（可选 QManage 注入）
```
GUI：侧边栏「刷怪配置」面板
