# 蜗牛引擎识别 —— 逆向证据

> 来源：蜗牛实用工具 main 进程字节码（REVERSE-REPORT.md §6）

## 证据

- 引擎控制支持：**LF（翎风）/ GOM / NGOM / 996 / ssNGom**
- 每个引擎有独立 **M2Config* 配置对象**（分引擎适配菜单/端口/目录结构）
- 通过 user32.dll FindWindow 定位 M2Server.exe 窗口（Delphi 类名 TfrmMain/TApplication/TFrmFileList）

## 结论

蜗牛按引擎适配配置（多引擎支持）。元歌的 detectEngine 采用虾米的特征串识别 + 蜗牛的引擎清单（补充 ssNGom/996/BLUEM2）。
