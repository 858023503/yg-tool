# 虾米引擎识别 —— 逆向证据

> 来源：虾米工具箱 mod_241_2296197.pyc（引擎识别模块）

## 证据（特征串 if-elif 链）

```
GEEPAK3 → GEE引擎(微端)
GEEPAK2 → GEE引擎
GEEM2LP → GEE引擎(连服)
GEEM2 → GEE引擎
GAMEOFMIR2 → GOM引擎
GAMEOFMIR → GOM引擎(老)
D3DM2 → D3D引擎
MIRYQ → MirYQ引擎
```

## 结论

虾米读 M2Server.exe 字节流，按 if-elif 链搜特征串判断引擎。元歌已吸收该方法（ENGINE_SIGS 11 特征），并补充翎风无特征串时的 FileVersion 兜底。
