# 蜗牛端口管理 —— 逆向证据

> 来源：蜗牛实用工具 main 进程字节码（REVERSE-REPORT.md §6 引擎控制）

## 机制

- 支持引擎：**LF / GOM / NGOM / 996 / ssNGom**（M2Config* 配置对象，分引擎适配端口文件）
- **端口管理**：读取/修改 M2 全服务端口（DBPort1-8、GatePort1-8、RunGate/SelGate/LoginGate、LogServerPort、MsgSrvPort、IOCPRunGate 等）
- **冲突检测**：netstat → 端口占用**报红** → **一键替换**
- **!setup.txt 目录键读写**：BaseDir/BoxsDir/CastleDir/ChatDir/ConLogDir/LogDir/GuildDir/NoticeDir

## 结论

蜗牛是三家中最完善的端口管理（检测+报红+一键替换），元歌工具箱已按其复刻（readPortConfig/writePortConfig/replacePorts）。
