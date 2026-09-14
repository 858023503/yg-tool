# 快捷助手刷怪配置 —— 逆向证据

> 传奇服务端快捷助手 V2025-10-01（VB6 + UPX 加壳）的刷怪功能核查。

## 一、逆向结论：快捷助手**无**刷怪配置功能

**证据**：对脱壳后的 exe（725,504 字节）做字符串扫描：

- **ASCII 字符串扫描**：`MonGen / 刷怪 / Spawn / monster / Robot` → **0 命中**
- **UTF-16LE 字符串扫描**（VB6 默认 Unicode 存储）：`MonGen / 刷怪 / Spawn / Robot / 怪物` → **0 命中**
- exe 内仅有版本资源（`CompanyName=Microsoft / FileVersion=2025.10.0001 / 3122.cn`）

```
输出示例：
--- 全部(前30) ---
CUSTOM / VS_VERSION_INFO / VarFileInfo / Translation / StringFileInfo
080404B0 / CompanyName / Microsoft / FileDescription / LegalCopyright
3122.cn / ProductName / FileVersion / 2025.10.0001 / ProductVersion
2025.10.0001 / InternalName / OriginalFilename
```

**结论**：快捷助手聚焦于 M2 重载/端口/物品/引擎识别等，刷怪（MonGen）不在其功能范围内。

## 二、对元歌的借鉴

无（功能缺失，无需借鉴）。

## 三、元歌对照

元歌工具箱刷怪配置（原刷怪调整 + 动态刷怪）为**蜗牛 + 虾米**两家的融合成果，快捷助手不参与此专题。
