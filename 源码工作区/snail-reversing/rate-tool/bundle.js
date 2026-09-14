// 单文件版（SEA 打包用，内联 iconv-lite）
const __path = require("path");
global.__M2RELOAD_PS1 = "﻿param(\n  [string]$Item = '',\n  [string]$Filter = '',\n  [string]$Action = 'list',\n  [string]$Root = ''\n)\n# 元歌工具箱 - M2 重载（三版融合：快捷助手命令表 + 蜗牛按PID枚举 + 虾米进程路径精确匹配/递归菜单）\n# 机制：定位 M2Server 进程(Toolhelp32 快照按 exe 路径精确匹配) →\n#       枚举 GameCenter/M2Server 的顶层+子窗口找 TfrmMain →\n#       递归枚举\"控制>重新加载\"菜单叶节点 → PostMessage WM_COMMAND(菜单ID)\n$src = @'\nusing System;\nusing System.Text;\nusing System.Runtime.InteropServices;\npublic class M2Reload {\n  // 窗口\n  [DllImport(\"user32.dll\")] public static extern bool EnumWindows(EnumProc cb, IntPtr lp);\n  [DllImport(\"user32.dll\")] public static extern bool EnumChildWindows(IntPtr parent, EnumProc cb, IntPtr lp);\n  [DllImport(\"user32.dll\")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);\n  [DllImport(\"user32.dll\", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder sb, int max);\n  [DllImport(\"user32.dll\", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder sb, int max);\n  [DllImport(\"user32.dll\")] public static extern IntPtr GetMenu(IntPtr h);\n  [DllImport(\"user32.dll\")] public static extern int GetMenuItemCount(IntPtr m);\n  [DllImport(\"user32.dll\")] public static extern IntPtr GetSubMenu(IntPtr m, int pos);\n  [DllImport(\"user32.dll\", CharSet=CharSet.Unicode)] public static extern int GetMenuString(IntPtr m, uint item, StringBuilder sb, int max, uint flag);\n  [DllImport(\"user32.dll\")] public static extern uint GetMenuItemID(IntPtr m, int pos);\n  [DllImport(\"user32.dll\")] public static extern bool PostMessage(IntPtr h, uint msg, IntPtr wp, IntPtr lp);\n  [DllImport(\"user32.dll\")] public static extern bool IsWindowVisible(IntPtr h);\n  // 进程快照（虾米 Toolhelp32 思路）\n  [DllImport(\"kernel32.dll\")] public static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint pid);\n  [DllImport(\"kernel32.dll\")] public static extern bool Process32FirstW(IntPtr snap, ref PROCESSENTRY32W entry);\n  [DllImport(\"kernel32.dll\")] public static extern bool Process32NextW(IntPtr snap, ref PROCESSENTRY32W entry);\n  [DllImport(\"kernel32.dll\")] public static extern bool QueryFullProcessImageNameW(IntPtr hProc, uint flags, StringBuilder sb, ref uint size);\n  [DllImport(\"kernel32.dll\")] public static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);\n  [DllImport(\"kernel32.dll\")] public static extern bool CloseHandle(IntPtr h);\n  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]\n  public struct PROCESSENTRY32W {\n    public uint dwSize; public uint cntUsage; public uint th32ProcessID; public IntPtr th32DefaultHeapID;\n    public uint th32ModuleID; public uint cntThreads; public uint th32ParentProcessID; public int pcPriClassBase;\n    public uint dwFlags; [MarshalAs(UnmanagedType.ByValTStr, SizeConst=260)] public string szExeFile;\n  }\n  public delegate bool EnumProc(IntPtr h, IntPtr lp);\n  public static string C(IntPtr h) { var sb = new StringBuilder(256); GetClassName(h, sb, 256); return sb.ToString(); }\n  public static string T(IntPtr h) { var sb = new StringBuilder(256); GetWindowText(h, sb, 256); return sb.ToString(); }\n  // 按 exe 路径精确找 PID（QueryFullProcessImageNameW 匹配）\n  public static System.Collections.Generic.List<uint> FindPidsByExePath(string exePath) {\n    var result = new System.Collections.Generic.List<uint>();\n    string want = exePath.Replace(\"/\", \"\\\\\").ToLowerInvariant();\n    if (!want.Contains(\"\\\\\")) want = \"\\\\\" + want;\n    var snap = CreateToolhelp32Snapshot(0x2, 0);\n    if (snap == IntPtr.Zero) return result;\n    var entry = new PROCESSENTRY32W();\n    entry.dwSize = (uint)Marshal.SizeOf(typeof(PROCESSENTRY32W));\n    bool ok = Process32FirstW(snap, ref entry);\n    while (ok) {\n      IntPtr hProc = OpenProcess(0x1000, false, entry.th32ProcessID); // PROCESS_QUERY_LIMITED_INFORMATION\n      if (hProc != IntPtr.Zero) {\n        var sb = new StringBuilder(1024);\n        uint sz = 1024;\n        if (QueryFullProcessImageNameW(hProc, 0, sb, ref sz)) {\n          string full = sb.ToString().Replace(\"/\", \"\\\\\").ToLowerInvariant();\n          if (full.EndsWith(want)) result.Add(entry.th32ProcessID);\n        }\n        CloseHandle(hProc);\n      }\n      ok = Process32NextW(snap, ref entry);\n    }\n    CloseHandle(snap);\n    return result;\n  }\n}\n'@\nAdd-Type -TypeDefinition $src -Language CSharp\n$WM_COMMAND = 0x111\n$MF_BYPOSITION = 0x400\n\n# 1. 找 M2Server 进程（三路：Root 路径精确匹配 → 进程名 → Toolhelp32 exe 路径）\n$pids = @()\n# 1a. Root 指定：从根目录定位 M2Server.exe（虾米 _guess_engine_exe_from_root）\n$rootExe = ''\nif ($Root -ne '') {\n  $cands = @(\n    (Join-Path $Root 'Mir200\\M2Server.exe'),\n    (Join-Path $Root 'M2Server.exe'),\n    (Join-Path $Root 'Mir200\\M2Server\\M2Server.exe')\n  )\n  foreach ($c in $cands) { if (Test-Path $c) { $rootExe = $c; break } }\n}\nif ($rootExe -ne '') {\n  $found = [M2Reload]::FindPidsByExePath($rootExe)\n  foreach ($f in $found) { if ($pids -notcontains $f) { $pids += $f } }\n  if ($pids.Count -eq 0) {\n    $found2 = [M2Reload]::FindPidsByExePath('m2server.exe')\n    foreach ($f in $found2) { if ($pids -notcontains $f) { $pids += $f } }\n  }\n}\nif ($pids.Count -eq 0) {\n  # 1b. 进程名（M2Server + GameCenter——M2 窗口可能嵌入 GameCenter 控制台）\n  $procs = @(Get-Process -Name 'M2Server', 'GameCenter' -ErrorAction SilentlyContinue)\n  foreach ($p in $procs) { if ($pids -notcontains $p.Id) { $pids += [uint32]$p.Id } }\n}\nif ($pids.Count -eq 0) {\n  # 1c. Toolhelp32 按 exe 名（虾米 _iter_pids_by_exe_path）\n  $found3 = [M2Reload]::FindPidsByExePath('m2server.exe')\n  foreach ($f in $found3) { if ($pids -notcontains $f) { $pids += $f } }\n}\nif ($pids.Count -eq 0) { Write-Output 'RESULT:NO_PROCESS|未找到 M2Server/GameCenter 进程（引擎未启动）'; exit }\n$pidsArr = @($pids)\n\n# 2. 枚举这些进程的顶层窗口 + 所有子窗口（含 M2 嵌入 GameCenter 控制台场景）\n$windows = @()\n$cbTop = {\n  param($h, $lp)\n  $p = 0\n  [M2Reload]::GetWindowThreadProcessId($h, [ref]$p) | Out-Null\n  if ($pidsArr -contains $p) {\n    $script:windows += $h\n    $cbChild = {\n      param($ch, $clp)\n      $cp = 0\n      [M2Reload]::GetWindowThreadProcessId($ch, [ref]$cp) | Out-Null\n      if ($pidsArr -contains $cp) { $script:windows += $ch }\n      return $true\n    }\n    [M2Reload]::EnumChildWindows($h, $cbChild, [IntPtr]::Zero) | Out-Null\n  }\n  return $true\n}\n[M2Reload]::EnumWindows($cbTop, [IntPtr]::Zero) | Out-Null\nif ($windows.Count -eq 0) { Write-Output 'RESULT:NO_WINDOW|未找到引擎窗口'; exit }\n\n# 3. 找带菜单的主窗口（TfrmMain 优先，要求菜单项数>0 排除伪菜单）\n$mainHwnd = [IntPtr]::Zero\nforeach ($h in $windows) {\n  $menu = [M2Reload]::GetMenu($h)\n  if ($menu -eq [IntPtr]::Zero) { continue }\n  $cnt = [M2Reload]::GetMenuItemCount($menu)\n  if ($cnt -le 0) { continue }\n  $cls = [M2Reload]::C($h)\n  $vis = [M2Reload]::IsWindowVisible($h)\n  if ($cls -match 'Main|Form') { if ($vis -or $mainHwnd -eq [IntPtr]::Zero) { $mainHwnd = $h } }\n  elseif ($mainHwnd -eq [IntPtr]::Zero -and $vis) { $mainHwnd = $h }\n}\nif ($mainHwnd -eq [IntPtr]::Zero) {\n  foreach ($h in $windows) {\n    $m2 = [M2Reload]::GetMenu($h)\n    if ($m2 -ne [IntPtr]::Zero -and [M2Reload]::GetMenuItemCount($m2) -gt 0) { $mainHwnd = $h; break }\n  }\n}\nif ($mainHwnd -eq [IntPtr]::Zero) { Write-Output 'RESULT:NO_MENU|未找到 M2 菜单（请确认引擎控制台中 M2 已启动）'; exit }\n$hMenu = [M2Reload]::GetMenu($mainHwnd)\n$topN = [M2Reload]::GetMenuItemCount($hMenu)\n\n# 4. 找\"控制\"→\"重新加载\"子菜单（虾米基准路径 '控制>重新加载'）\n# 预热：Delphi 菜单懒加载，先发 WM_INITMENU 让菜单初始化（还原自虾米 _try_warm_up_menu_path）\n$WM_INITMENU = 0x116\n$WM_INITMENUPOPUP = 0x117\n[M2Reload]::PostMessage($mainHwnd, $WM_INITMENU, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null\nStart-Sleep -Milliseconds 80\n$hMenu = [M2Reload]::GetMenu($mainHwnd)\n$topN = [M2Reload]::GetMenuItemCount($hMenu)\n\nfunction Get-SubMenuByText($menu, $text) {\n  $n = [M2Reload]::GetMenuItemCount($menu)\n  for ($i = 0; $i -lt $n; $i++) {\n    $sb = New-Object System.Text.StringBuilder 256\n    [M2Reload]::GetMenuString($menu, $i, $sb, 256, $MF_BYPOSITION) | Out-Null\n    $t = $sb.ToString().Trim()\n    if ($t.Contains($text)) {\n      $sub = [M2Reload]::GetSubMenu($menu, $i)\n      if ($sub -eq [IntPtr]::Zero -or [M2Reload]::GetMenuItemCount($sub) -le 0) {\n        # 懒加载预热：子菜单未初始化时发 WM_INITMENUPOPUP 后重试\n        [M2Reload]::PostMessage($mainHwnd, $WM_INITMENUPOPUP, $sub, [IntPtr]$i) | Out-Null\n        Start-Sleep -Milliseconds 80\n        $sub = [M2Reload]::GetSubMenu($menu, $i)\n      }\n      if ($sub -ne [IntPtr]::Zero -and [M2Reload]::GetMenuItemCount($sub) -gt 0) { return $sub }\n    }\n  }\n  return [IntPtr]::Zero\n}\n$ctrlMenu = Get-SubMenuByText $hMenu '控制'\nif ($ctrlMenu -eq [IntPtr]::Zero) { Write-Output 'RESULT:NO_RELOAD_MENU|未找到\"控制\"菜单'; exit }\n$reloadMenu = Get-SubMenuByText $ctrlMenu '重新加载'\nif ($reloadMenu -eq [IntPtr]::Zero) { Write-Output 'RESULT:NO_RELOAD_MENU|未找到\"控制-重新加载\"菜单'; exit }\n\n# 5. 递归枚举叶节点（虾米 _enumerate_leaf_menu_items，路径用 > 拼接，任意深度）\n$leaves = @()  # 每项: @{ Path; Id }\nfunction Enumerate-Leaves($menu, $basePath) {\n  $n = [M2Reload]::GetMenuItemCount($menu)\n  for ($k = 0; $k -lt $n; $k++) {\n    $sb = New-Object System.Text.StringBuilder 256\n    [M2Reload]::GetMenuString($menu, $k, $sb, 256, $MF_BYPOSITION) | Out-Null\n    $t = $sb.ToString().Trim()\n    if ($t -eq '') { continue }\n    $sub = [M2Reload]::GetSubMenu($menu, $k)\n    if ($sub -ne [IntPtr]::Zero -and [M2Reload]::GetMenuItemCount($sub) -gt 0) {\n      Enumerate-Leaves $sub ($basePath + '>' + $t)\n    } else {\n      $id = [M2Reload]::GetMenuItemID($menu, $k)\n      $script:leaves += @{ Path = ($basePath + '>' + $t).TrimStart('>'); Id = $id; Text = $t }\n    }\n  }\n}\nEnumerate-Leaves $reloadMenu '重新加载'\n\n# 6. 列出或执行\nfunction Norm([string]$s) {\n  return $s.Replace('&', '').Replace('（', '').Replace('）', '').Replace('(', '').Replace(')', '').Replace(' ', '').Replace('　', '')\n}\nif ($Action -eq 'list') {\n  $items = @($leaves | ForEach-Object { $_.Text })\n  Write-Output (\"RESULT:LIST|找到 M2 窗口: \" + [M2Reload]::T($mainHwnd) + \" | 重载项: \" + ($items -join ' / '))\n  exit\n}\n\n# 执行：匹配（去 & 空格括号精确/包含 → 关键词）\nif ([string]::IsNullOrWhiteSpace($Item)) { Write-Output 'RESULT:NO_ITEM|未指定重载项'; exit }   # 空 Item 时 Contains('') 恒真会误点第一个叶子菜单\n$norm = (Norm $Item)\n$found = $false\nforeach ($leaf in $leaves) {\n  $tNorm = (Norm $leaf.Text)\n  if ($tNorm -eq $norm -or $tNorm.Contains($norm) -or $norm.Contains($tNorm)) {\n    $ok = [M2Reload]::PostMessage($mainHwnd, $WM_COMMAND, [IntPtr]$leaf.Id, [IntPtr]::Zero)\n    Write-Output (\"RESULT:OK|已发送重载命令: \" + $leaf.Text + \" (菜单ID=\" + $leaf.Id + \", PostMessage=\" + $ok + \")\")\n    $found = $true\n    break\n  }\n}\nif (-not $found) {\n  $kw = @('怪物爆率', '物品数据库', '怪物数据库', '技能数据库', 'NPC', '机器人', 'QManage', 'QFunction', 'QMission', 'QChatbox', '怪物说话', '宝箱', '安全区', '参数设置', '物品掉落', '数据列表', '地图事件', '摆摊', '出售', '假人', 'RunGate', '授权')\n  foreach ($k in $kw) {\n    if ($norm.Contains($k)) {\n      foreach ($leaf in $leaves) {\n        if ($leaf.Text.Contains($k)) {\n          $ok = [M2Reload]::PostMessage($mainHwnd, $WM_COMMAND, [IntPtr]$leaf.Id, [IntPtr]::Zero)\n          Write-Output (\"RESULT:OK|已发送重载命令(关键词): \" + $leaf.Text + \" (菜单ID=\" + $leaf.Id + \", PostMessage=\" + $ok + \")\")\n          $found = $true\n          break\n        }\n      }\n    }\n    if ($found) { break }\n  }\n}\nif (-not $found) { Write-Output (\"RESULT:NOT_FOUND|未找到匹配菜单项: \" + $Item) }\n";
global.__SITE_TPL = "<!doctype html>\n<html lang=\"zh-CN\"><head>\n<meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/>\n<link rel=\"icon\" href=\"./222.ico\" type=\"image/x-icon\"/><link rel=\"shortcut icon\" href=\"./222.ico\" type=\"image/x-icon\"/>\n<title>默认站点 - 爆率查询</title>\n<style>\n\n        :root{--bg:#120706;--panel:#1f0f0d;--panel-soft:#2a1713;--text:#f8ecd2;--muted:#cbb58d;--line:rgba(255,220,165,.12);--line-strong:rgba(224,174,73,.42);--acc:#d7a23f;--acc-hover:#f7d694;--bad:#ff6b6b;--shadow:0 18px 48px rgba(0,0,0,.38);--shadow-soft:0 12px 28px rgba(0,0,0,.26);--focus:0 0 0 3px rgba(224,174,73,.24);}\n        *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;min-height:100vh;background:radial-gradient(circle at 50% 0,rgba(215,162,63,.16),transparent 24%),radial-gradient(circle at 18% 12%,rgba(121,34,23,.26),transparent 30%),linear-gradient(180deg,#1a0a08 0,#090403 54%,#040202 100%);color:var(--text);font-family:\"Segoe UI\",\"Microsoft YaHei\",\"PingFang SC\",sans-serif;line-height:1.6;text-rendering:optimizeLegibility}\n\n        a{color:var(--acc);text-decoration:none;transition:color .2s ease,transform .2s ease,border-color .2s ease,background .2s ease,box-shadow .2s ease}a:hover{color:var(--acc-hover)}\n        a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible{outline:none;box-shadow:var(--focus)}\n        .wrap{width:min(1200px,calc(100% - 32px));margin:0 auto}\n\n        \n        /* Header */\n        .header{position:sticky;top:0;z-index:20;background:rgba(18,7,6,.88);border-bottom:1px solid var(--line-strong);box-shadow:0 10px 30px rgba(0,0,0,.28);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}\n\n        .header .inner{display:flex;align-items:center;justify-content:space-between;gap:18px;width:min(1200px,calc(100% - 32px));margin:0 auto;padding:16px 0}\n        .brand h1{margin:0;font-size:clamp(24px,3vw,30px);color:var(--acc);text-shadow:0 2px 8px rgba(0,0,0,.45);font-weight:800}\n        .brand .sub{color:var(--muted);font-size:14px;margin-top:4px}\n        .nav{display:flex;gap:18px;flex-wrap:wrap}\n        .nav a{display:inline-flex;align-items:center;min-height:40px;font-size:15px;font-weight:700;padding:6px 0;position:relative}\n        .nav a.active{color:var(--acc-hover)}\n        .nav a::after{content:'';position:absolute;bottom:0;left:0;width:0;height:2px;border-radius:999px;background:var(--acc);transition:width .22s ease}\n        .nav a:hover::after,.nav a.active::after{width:100%}\n\n\n        /* Hero */\n        .hero{background:linear-gradient(rgba(0,0,0,0.7),rgba(0,0,0,0.7)), url('./assets/bg.jpg');background-size:cover;padding:80px 0;text-align:center;border-bottom:1px solid var(--line)}\n        .hero h2{font-size:48px;margin:0 0 20px;color:#fff;text-shadow:0 4px 10px #000}\n        .hero p{font-size:18px;color:#ccc;max-width:800px;margin:0 auto 40px}\n        .hero-media{margin:40px auto 0;max-width:980px}\n        .hero-media iframe{width:100%;aspect-ratio:16/9;border:0;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.6)}\n        .hero-media video{width:100%;aspect-ratio:16/9;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.6);background:#000}\n        .btn-dl{display:inline-block;padding:16px 48px;background:var(--acc);color:#000;font-size:20px;font-weight:bold;border-radius:4px;box-shadow:0 0 20px rgba(212,175,55,0.4);transition:all .3s}\n        .btn-dl:hover{transform:scale(1.05);background:var(--acc-hover);box-shadow:0 0 30px rgba(212,175,55,0.6);text-decoration:none;color:#000}\n\n        /* Section */\n        .section{padding:60px 0}\n        .sec-title{text-align:center;margin-bottom:50px;position:relative}\n        .sec-title h3{font-size:32px;color:var(--acc);margin:0;display:inline-block;padding:0 20px;background:var(--bg);position:relative;z-index:1}\n        .sec-title::after{content:'';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:200px;height:1px;background:var(--line);z-index:0}\n\n        /* Versions */\n        .v-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(350px,1fr));gap:30px}\n        .v-card{background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden;transition:transform .3s,box-shadow .3s}\n        .v-card:hover{transform:translateY(-5px);box-shadow:0 10px 30px rgba(0,0,0,.5);border-color:var(--acc)}\n        .v-img{aspect-ratio:16/9;min-height:220px;background:radial-gradient(circle at 20% 20%,rgba(212,175,55,.16),transparent 55%),#050509;overflow:hidden;position:relative}\n        .v-book{position:absolute;inset:0;perspective:1200px;transform-style:preserve-3d}\n        .v-page{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;user-select:none;-webkit-user-select:none;pointer-events:none;backface-visibility:hidden;transform-style:preserve-3d}\n        .v-page.v-back{visibility:hidden}\n        .v-img.animating .v-page.v-back{visibility:visible}\n        .v-img.flip-next .v-page.v-front{transform-origin:center center;animation:vFlipFrontNext .78s cubic-bezier(.2,.6,.2,1) both}\n        .v-img.flip-next .v-page.v-back{transform-origin:center center;animation:vFlipBackNext .78s cubic-bezier(.2,.6,.2,1) both}\n        .v-img.flip-prev .v-page.v-front{transform-origin:center center;animation:vFlipFrontPrev .78s cubic-bezier(.2,.6,.2,1) both}\n        .v-img.flip-prev .v-page.v-back{transform-origin:center center;animation:vFlipBackPrev .78s cubic-bezier(.2,.6,.2,1) both}\n        @keyframes vFlipFrontNext{from{transform:rotateY(0deg)}to{transform:rotateY(-180deg)}}\n        @keyframes vFlipBackNext{from{transform:rotateY(180deg)}to{transform:rotateY(0deg)}}\n        @keyframes vFlipFrontPrev{from{transform:rotateY(0deg)}to{transform:rotateY(180deg)}}\n        @keyframes vFlipBackPrev{from{transform:rotateY(-180deg)}to{transform:rotateY(0deg)}}\n        @media (prefers-reduced-motion:reduce){.v-img.flip-next .v-page,.v-img.flip-prev .v-page{animation:none}}\n        .v-track{position:absolute;inset:0;display:flex;transform:translateX(0);transition:transform .55s ease;will-change:transform}\n        .v-track img{width:100%;height:100%;flex:0 0 100%;object-fit:contain;background:#000;user-select:none;-webkit-user-select:none;pointer-events:none}\n        .v-controls{position:absolute;inset:0;z-index:2}\n        .v-arrow{pointer-events:auto;position:absolute;top:50%;transform:translateY(-50%);width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.16);color:#fff;font-size:22px;line-height:1;cursor:pointer;opacity:.9;transition:opacity .15s ease,transform .15s ease,border-color .15s ease}\n        .v-arrow:hover{opacity:1;border-color:rgba(212,175,55,.75);transform:translateY(-50%) scale(1.04)}\n        .v-arrow.prev{left:10px}\n        .v-arrow.next{right:10px}\n        .v-dots{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);display:flex;gap:6px;z-index:3}\n        .v-dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.22);transition:background .2s}\n        .v-dot.active{background:var(--acc)}\n        @media (prefers-reduced-motion:reduce){.v-track{transition:none}}\n        .v-img .ph{position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#333;font-size:48px}\n        .v-card:hover .v-img img{filter:brightness(1.03)}\n        .v-body{padding:24px}\n        .v-title{font-size:20px;color:var(--acc);margin:0 0 12px;font-weight:bold}\n        .v-desc{color:#ccc;font-size:14px;line-height:1.6;white-space:pre-wrap}\n\n        /* Penguin */\n        .penguin-fab{position:fixed;right:18px;bottom:18px;width:58px;height:58px;border-radius:50%;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55);border:1px solid rgba(212,175,55,.75);box-shadow:0 10px 25px rgba(0,0,0,.5);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:9999;transition:transform .15s ease,background .15s ease,border-color .15s ease}\n        .penguin-fab:hover{transform:translateY(-2px);background:rgba(0,0,0,.72);border-color:var(--acc-hover)}\n        .penguin-fab svg{width:34px;height:34px}\n        .penguin-inline{position:absolute;left:16px;top:16px;display:none;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.14);color:var(--acc);font-size:12px;line-height:1;box-shadow:0 8px 18px rgba(0,0,0,.35)}\n        .penguin-inline:hover{border-color:rgba(212,175,55,.75);color:var(--acc-hover)}\n        .penguin-inline svg{width:14px;height:14px}\n\n        /* Notice & Info */\n        .info-grid{display:grid;grid-template-columns:2fr 1fr;gap:30px}\n        .panel{background:var(--panel);border:1px solid var(--line);padding:24px;border-radius:8px}\n        .panel-h{font-size:18px;color:var(--acc);margin:0 0 20px;padding-bottom:12px;border-bottom:1px solid var(--line)}\n        .notice-list{list-style:none;padding:0;margin:0}\n        .notice-list li{padding:10px 0;border-bottom:1px dashed var(--line);color:#ccc}\n        .notice-list li:last-child{border:0}\n        .qq-box{text-align:center;padding:20px;position:relative}\n        .qq-num{font-size:24px;color:var(--acc);font-weight:bold;margin:10px 0;font-family:monospace}\n\n        /* Footer */\n        .footer{background:#000;padding:40px 0;text-align:center;color:#666;font-size:14px;margin-top:60px;border-top:1px solid var(--line)}\n        \n        /* Utils */\n        .mono{font-family:Consolas,monospace}\n        .muted{color:var(--muted)}\n        \n:root{--drop-radius:14px;}\n.app{max-width:1200px;margin:20px auto 44px;background:linear-gradient(180deg,rgba(42,22,18,.96),rgba(18,8,8,.98));border-radius:18px;box-shadow:var(--shadow);overflow:hidden;border:1px solid var(--line)}\n\n.topbar{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 16px;background:rgba(30,12,10,.92);border-bottom:1px solid var(--line-strong);color:var(--text)}\n\n.brand2{display:flex;align-items:center;gap:10px;font-weight:800;min-width:0}\n.logoDot{width:34px;height:34px;border-radius:10px;background:rgba(109,31,22,.4);border:1px solid rgba(212,175,55,.45);display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--acc-hover);flex:0 0 auto}\n\n.nav2{display:flex;gap:8px;flex-wrap:wrap}\n.navBtn{border:1px solid transparent;background:transparent;color:var(--text);padding:9px 12px;border-radius:10px;font-weight:800;cursor:pointer;transition:all .15s;min-height:40px;display:inline-flex;align-items:center;justify-content:center}\n.navBtn:hover{background:rgba(212,175,55,.10);border-color:rgba(212,175,55,.25)}\n.navBtn.active{background:linear-gradient(180deg,rgba(109,31,22,.92),rgba(57,18,14,.92));border-color:rgba(212,175,55,.55);color:var(--acc-hover)}\n.navBtn.disabled{opacity:.5;cursor:not-allowed;pointer-events:none}\n.rightBox{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end}\n.sel{border:1px solid var(--line);background:rgba(8,11,16,.58);color:var(--text);padding:10px 12px;border-radius:10px;outline:none;min-height:42px}\n.sel option{color:#111}\n.pill{padding:8px 12px;border-radius:999px;background:rgba(109,31,22,.36);border:1px solid rgba(212,175,55,.35);font-weight:800;color:var(--acc-hover);min-height:40px;display:inline-flex;align-items:center}\n\n.toolbar{padding:12px 16px;background:rgba(24,10,8,.78);border-bottom:1px solid var(--line);display:flex;gap:10px;align-items:center;flex-wrap:wrap;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}\n\n.search{flex:1;min-width:280px;display:flex;gap:10px;align-items:center}\n.search input{flex:1;border:1px solid var(--line);background:#0b0f17;color:#fff;border-radius:10px;padding:10px 12px;outline:none;min-height:42px}\n.search input::placeholder{color:#667085}\n.search .mini{min-width:180px}\n.modeWrap{display:flex;gap:8px;align-items:center;flex-wrap:wrap}\n.modeBtn{border:1px solid var(--line);background:#0b0f17;color:#fff;padding:9px 12px;border-radius:10px;font-weight:900;cursor:pointer;min-height:42px}\n.modeBtn:hover{border-color:rgba(212,175,55,.55);color:var(--acc-hover)}\n.modeBtn.active{background:var(--acc);border-color:var(--acc);color:#000}\n.toolRight{display:flex;gap:10px;align-items:center;flex-wrap:wrap}\n.check{display:flex;align-items:center;gap:6px;color:#d7dae1;font-size:13px;min-height:40px}\n.check input{transform:translateY(1px)}\n.btn{border:1px solid var(--line);background:#150706;border-radius:10px;padding:9px 12px;cursor:pointer;font-weight:800;text-decoration:none;color:#fff;display:inline-flex;align-items:center;justify-content:center;min-height:42px;transition:all .15s}\n\n.btn:hover{border-color:rgba(212,175,55,.55)}\n.btn.primary{background:var(--acc);color:#000;border-color:var(--acc)}\n.btn.primary:hover{background:var(--acc-hover);border-color:var(--acc-hover);color:#000}\n.btn.ghost{background:transparent;color:var(--acc);border-color:rgba(212,175,55,.55)}\n.content{padding:16px 16px 20px}\n\n:root{--drop-col-height:clamp(420px,calc(100vh - 280px),760px);--drop-col-height-mobile:min(62vh,560px)}\n.grid4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;align-items:stretch;grid-auto-rows:var(--drop-col-height)}\n@media (max-width:1280px){.grid4{grid-template-columns:repeat(2,minmax(0,1fr))}}\n\n\n@media (max-width:760px){\n  .app{margin:0 auto 24px;border-radius:0;max-width:none}\n  .grid4{grid-template-columns:1fr;gap:12px;grid-auto-rows:var(--drop-col-height-mobile)}\n\n  .topbar{flex-direction:column;align-items:stretch}\n  .nav2{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px}\n  .navBtn{white-space:nowrap;flex:0 0 auto}\n  .rightBox{width:100%;justify-content:space-between}\n  .rightBox > *{flex:1 1 auto}\n  .search{min-width:0;flex-wrap:wrap}\n  .search .mini{min-width:140px;flex:1}\n  .modeWrap,.toolRight{width:100%;justify-content:space-between}\n  .toolRight .btn,.toolRight .check{flex:1 1 auto}\n  .content{padding:12px 12px 18px}\n  .card{width:100%}\n}\n.col{position:relative;background:linear-gradient(180deg,rgba(42,22,18,.92),rgba(20,9,8,.98));border:1px solid var(--line);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;min-height:0;min-width:0;height:100%;max-height:var(--drop-col-height);box-shadow:var(--shadow-soft);contain:layout paint}\n@media (max-width:760px){.col{max-height:var(--drop-col-height-mobile)}}\n\n\n\n.colH{position:sticky;top:0;z-index:3;padding:12px;background:linear-gradient(180deg,rgba(27,12,10,.98),rgba(17,8,7,.95));backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);color:var(--acc);display:flex;flex-direction:column;align-items:stretch;gap:10px;font-weight:900;border-bottom:1px solid var(--line);box-shadow:0 8px 18px rgba(0,0,0,.18)}\n\n.colTitle{display:flex;align-items:center;justify-content:space-between;gap:10px}\n.colSearch{position:relative}\n.colSearch input{width:100%;border:1px solid var(--line);background:#0b0f17;color:#fff;border-radius:10px;padding:10px 12px;outline:none;min-height:42px}\n.colSearch input::placeholder{color:#667085}\n.colH small{opacity:.82;font-weight:800;color:#cbd5e1;white-space:nowrap}\n.listWrap{position:relative;display:flex;flex-direction:column;min-height:0;flex:1;overflow:hidden;background:linear-gradient(180deg,rgba(23,10,9,.18),rgba(8,4,4,.08))}\n.listWrap::before,.listWrap::after{content:'';position:absolute;left:0;right:0;height:18px;pointer-events:none;z-index:2}\n.listWrap::before{top:0;background:linear-gradient(180deg,rgba(20,9,8,.95),rgba(20,9,8,0))}\n.listWrap::after{bottom:0;background:linear-gradient(0deg,rgba(20,9,8,.96),rgba(20,9,8,0))}\n.list{height:100%;max-height:none;overflow:auto;position:relative;flex:1;min-height:0;overscroll-behavior:contain;overscroll-behavior-y:contain;scroll-behavior:smooth;scroll-snap-type:y proximity;scroll-padding:8px 0 18px;-webkit-overflow-scrolling:touch;touch-action:pan-y;scrollbar-gutter:stable;scrollbar-width:thin;scrollbar-color:rgba(212,175,55,.22) transparent}\n.list:hover{scrollbar-color:rgba(212,175,55,.34) transparent}\n\n.list::-webkit-scrollbar{width:6px;height:6px}\n\n.list::-webkit-scrollbar-thumb{background:rgba(212,175,55,.18);border-radius:999px;border:1px solid transparent;background-clip:padding-box}\n.list:hover::-webkit-scrollbar-thumb{background:rgba(212,175,55,.30)}\n.list::-webkit-scrollbar-track{background:transparent}\n\n.vpad{height:0;pointer-events:none}\n.pager{display:none}\n.pager.hidden{display:none}\n\n\n\n.row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border-bottom:1px dashed rgba(255,255,255,.08);cursor:pointer;height:56px;transition:background .15s ease,border-color .15s ease;scroll-snap-align:start}\n.row:hover{background:rgba(212,175,55,.06)}\n.row.active{background:rgba(212,175,55,.12)}\n.left{display:flex;align-items:center;gap:10px;min-width:0}\n.badge{width:22px;height:22px;border-radius:999px;background:rgba(212,175,55,.18);color:var(--acc);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;flex:0 0 auto;border:1px solid rgba(212,175,55,.35)}\n.title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.sub{font-size:12px;color:#aab2bf;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.right{font-family:Consolas,monospace;color:#c2c8d2;font-size:12px;opacity:.9;flex:0 0 auto}\n.empty{padding:26px 14px;color:#7b8695;text-align:center;scroll-snap-align:start}\n.route-card{padding:12px 12px 10px;border-bottom:1px dashed rgba(255,255,255,.10);scroll-snap-align:start}\n.route-card-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}\n.route-card-title{font-weight:900;color:var(--acc)}\n.route-card-meta{font-size:12px;color:#a48a63}\n.route-steps{display:grid;gap:6px}\n.route-step{line-height:1.7;color:#ddd}\n.route-step-index{display:inline-block;min-width:22px;color:var(--acc);font-weight:900}\n\n\n.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px;align-items:stretch}\n.card{background:linear-gradient(180deg,rgba(42,22,18,.96),rgba(20,9,8,.98));border:1px solid var(--line);border-radius:14px;overflow:hidden;box-shadow:var(--shadow-soft);min-height:100%}\n\n.cardImg{height:164px;background:radial-gradient(circle at 20% 20%,rgba(212,175,55,.20),transparent 60%),#130605;display:flex;align-items:center;justify-content:center;color:var(--acc-hover);font-weight:900}\n\n.cardImg img{width:100%;height:100%;object-fit:cover}\n.cardB{padding:14px}\n.cardT{font-weight:900;margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff}\n.cardD{color:#aab2bf;font-size:12px;min-height:38px;white-space:pre-wrap;line-height:1.7}\n.cardA{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}\n.cardA .btn{flex:1 1 120px;text-align:center}\n.homeLiteBar{padding:2px 0 12px}\n.homeLiteBar input{width:100%;border:1px solid var(--line);background:#0b0f17;color:#fff;border-radius:10px;padding:10px 12px;outline:none;min-height:42px}\n.homeLiteBar input::placeholder{color:#667085}\n.homeTags{display:flex;flex-wrap:wrap;gap:10px;align-items:center}\n.tagBtn{border:1px solid rgba(212,175,55,.3);background:linear-gradient(180deg,#8b2a1e,#5f1b13);color:#fff;padding:9px 13px;border-radius:10px;font-weight:900;cursor:pointer;min-height:40px;box-shadow:0 10px 20px rgba(95,27,19,.22)}\n\n.tagBtn:hover{filter:brightness(1.06)}\n.foot{padding:12px 16px;color:#a48a63;text-align:center;font-size:12px;background:rgba(12,5,4,.88);border-top:1px solid var(--line)}\n\n\n</style>\n<script>window.__SITE_INLINE__ = {\"name\": \"默认站点\", \"title\": \"默认站点\", \"site_enabled\": false, \"announcement\": \"\", \"intro\": \"\", \"hero_video\": \"\", \"hero_video_autoplay\": false, \"hero_video_loop\": false, \"versions\": [], \"qq_groups\": [], \"drop_enabled\": true, \"drop_reverse\": false, \"drop_types\": [\"沉默服\", \"复古版\", \"微变\", \"中变\", \"超变\", \"合击\", \"单职业\", \"沉默\", \"暗黑\", \"专属\", \"三职业\"], \"drop_queries\": [], \"penguin\": {\"enabled\": false, \"title\": \"\", \"url\": \"\"}};</script></head><body>\n\n<div class=\"header\">\n  <div class=\"inner\">\n    <div class=\"brand\">\n      <h1 id=\"hdrName\">元歌网络</h1>\n      <div class=\"sub\" id=\"hdrSub\">Legend of Mir 2 Private Server</div>\n    </div>\n    <div class=\"nav\">\n      <a href=\"./index.html\" id=\"hdrNavHome\">官网首页</a>\n      <a href=\"./droprate.html\" id=\"hdrNavDrop\" class=\"active\">爆率查询</a>\n    </div>\n\n\n  </div>\n</div>\n\n<div class=\"app\">\n  <div class=\"topbar\">\n    <div class=\"brand2\">\n      <div class=\"logoDot\">战</div>\n      <div id=\"siteTitle\">玛法情报中心</div>\n    </div>\n    <div class=\"nav2\">\n      <a href=\"./index.html\" class=\"navBtn\" style=\"text-decoration:none;display:inline-flex;align-items:center;justify-content:center\">官网首页</a>\n      <button class=\"navBtn active\" data-tab=\"home\">全部版本</button>\n\n\n      <button class=\"navBtn\" data-tab=\"item\">物品查询</button>\n      <button class=\"navBtn\" data-tab=\"monster\">怪物查询</button>\n      <button class=\"navBtn\" data-tab=\"map\">地图查询</button>\n      <button class=\"navBtn\" data-tab=\"npc\">NPC查询</button>\n      <a href=\"#\" class=\"navBtn disabled\" id=\"guideBtn\" target=\"_blank\" rel=\"noopener\" style=\"text-decoration:none;display:inline-flex;align-items:center;justify-content:center\">攻略查询</a>\n    </div>\n    <div class=\"rightBox\">\n      <select class=\"sel\" id=\"verSel\"></select>\n      <div class=\"pill\" id=\"verInfo\">选择查询版本</div>\n    </div>\n  </div>\n\n  <div class=\"toolbar\">\n    <div class=\"search\">\n      <div class=\"modeWrap\">\n        <button class=\"modeBtn active\" id=\"modeStd\" type=\"button\">标准模式</button>\n        <button class=\"modeBtn\" id=\"modeLite\" type=\"button\">精简模式</button>\n      </div>\n      <select id=\"sortSel\" class=\"btn mini\">\n        <option value=\"default\">排序：默认</option>\n        <option value=\"name\">排序：名称</option>\n        <option value=\"rate\">排序：爆率(从高到低)</option>\n      </select>\n    </div>\n    <div class=\"toolRight\">\n      <button class=\"btn\" id=\"helpBtn\" type=\"button\">使用说明</button>\n      <label class=\"check\"><input type=\"checkbox\" id=\"showAll\" /> 显示全部（包含无掉落/无联动项）</label>\n    </div>\n  </div>\n\n  <div class=\"content\">\n    <div id=\"viewHome\" style=\"display:none\">\n      <div id=\"homeLite\" style=\"display:none\">\n        <div class=\"homeLiteBar\"><input id=\"homeKw\" placeholder=\"搜索名称，版本内容标签...\" /></div>\n        <div class=\"homeTags\" id=\"homeTags\"></div>\n      </div>\n      <div class=\"cards\" id=\"cards\"></div>\n      <div class=\"empty\" id=\"homeEmpty\" style=\"display:none\">未配置任何版本，请先在工具箱里添加爆率查询版本</div>\n    </div>\n\n    <div id=\"viewMain\" style=\"display:none\">\n      <div class=\"grid4\">\n        <div class=\"col\"><div class=\"colH\"><div class=\"colTitle\"><span id=\"h1\">物品名称</span><small id=\"h1s\"></small></div><div class=\"colSearch\"><input id=\"ckw1\" placeholder=\"请输入关键词过滤\" /></div></div><div class=\"listWrap\"><div class=\"list\" id=\"l1\"></div><div class=\"pager hidden\" id=\"p1\"></div></div></div>\n        <div class=\"col\"><div class=\"colH\"><div class=\"colTitle\"><span id=\"h2\">物品出处</span><small id=\"h2s\"></small></div><div class=\"colSearch\"><input id=\"ckw2\" placeholder=\"请输入关键词过滤\" /></div></div><div class=\"listWrap\"><div class=\"list\" id=\"l2\"></div><div class=\"pager hidden\" id=\"p2\"></div></div></div>\n        <div class=\"col\"><div class=\"colH\"><div class=\"colTitle\"><span id=\"h3\">刷新地图</span><small id=\"h3s\"></small></div><div class=\"colSearch\"><input id=\"ckw3\" placeholder=\"地图关键词过滤\" /></div></div><div class=\"listWrap\"><div class=\"list\" id=\"l3\"></div><div class=\"pager hidden\" id=\"p3\"></div></div></div>\n        <div class=\"col\"><div class=\"colH\"><div class=\"colTitle\"><span id=\"h4\">地图走法</span><small id=\"h4s\"></small></div><div class=\"colSearch\"><input id=\"ckw4\" placeholder=\"请输入关键词过滤\" /></div></div><div class=\"listWrap\"><div class=\"list\" id=\"l4\"></div><div class=\"pager hidden\" id=\"p4\"></div></div></div>\n      </div>\n\n    </div>\n  </div>\n\n  <div class=\"foot\" id=\"footTxt\">游戏查询系统 - 元歌工具箱生成</div>\n</div>\n\n<script>\nfunction esc(s){return String(s||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}\nfunction el(id){return document.getElementById(id);}\nfunction qsp(){return Object.fromEntries(new URLSearchParams(location.search));}\nconst _CACHE_DB_NAME='xm_drop_cache_v1';\nconst _CACHE_STORE_NAME='files';\nlet _CACHE_DB_PROM=null;\nfunction _openCacheDb(){\n  if(_CACHE_DB_PROM) return _CACHE_DB_PROM;\n  _CACHE_DB_PROM = new Promise(resolve=>{\n    try{\n      if(!('indexedDB' in window)){ resolve(null); return; }\n      const req = indexedDB.open(_CACHE_DB_NAME, 1);\n      req.onupgradeneeded = function(){\n        try{\n          const db = req.result;\n          if(db && !db.objectStoreNames.contains(_CACHE_STORE_NAME)){\n            db.createObjectStore(_CACHE_STORE_NAME);\n          }\n        }catch(e){}\n      };\n      req.onsuccess = function(){ resolve(req.result || null); };\n      req.onerror = function(){ resolve(null); };\n    }catch(e){ resolve(null); }\n  });\n  return _CACHE_DB_PROM;\n}\nasync function _cacheGet(key){\n  const db = await _openCacheDb();\n  if(!db) return null;\n  return await new Promise(resolve=>{\n    try{\n      const tx = db.transaction(_CACHE_STORE_NAME, 'readonly');\n      const st = tx.objectStore(_CACHE_STORE_NAME);\n      const rq = st.get(key);\n      rq.onsuccess = function(){ resolve(rq.result || null); };\n      rq.onerror = function(){ resolve(null); };\n    }catch(e){ resolve(null); }\n  });\n}\nasync function _cacheSet(key, val){\n  const db = await _openCacheDb();\n  if(!db) return false;\n  return await new Promise(resolve=>{\n    try{\n      const tx = db.transaction(_CACHE_STORE_NAME, 'readwrite');\n      const st = tx.objectStore(_CACHE_STORE_NAME);\n      st.put(val, key);\n      tx.oncomplete = function(){ resolve(true); };\n      tx.onerror = function(){ resolve(false); };\n      tx.onabort = function(){ resolve(false); };\n    }catch(e){ resolve(false); }\n  });\n}\nfunction _cacheKeyForUrl(url){\n  try{ return new URL(String(url||''), location.href).toString(); }catch(e){ return String(url||''); }\n}\n\n/* 兼容旧缓存文本与 UTF-8 BOM，统一将 JSON 内容安全解析为对象。 */\nfunction parseJsonPayload(raw){\n  const txt = String(raw || '').replace(/^\\uFEFF/, '').trim();\n  if(!txt) return null;\n  return JSON.parse(txt);\n}\n\n/* 兼容旧缓存结构与新对象缓存，尽量避免重复 JSON 字符串驻留。 */\nfunction readCachedJsonValue(cached){\n  if(!cached || typeof cached !== 'object') return null;\n  if(cached.data && typeof cached.data === 'object') return cached.data;\n  if(cached.text) return parseJsonPayload(cached.text);\n  return null;\n}\n\n/* 远程 JSON 优先使用原生对象解析，失败时回退到文本模式确保兼容。 */\nasync function readRemoteJson(resp){\n  try{\n    const data = await resp.clone().json();\n    return {data:data, cacheValue:{t:Date.now(), data:data}};\n  }catch(e){}\n  const txt = await resp.text();\n  await new Promise(r=>setTimeout(r,0));\n  return {data:parseJsonPayload(txt), cacheValue:{t:Date.now(), text:txt}};\n}\n\nfunction setTabActive(tab){\n\n  document.querySelectorAll('.navBtn').forEach(b=>b.classList.remove('active'));\n  document.querySelectorAll('.navBtn').forEach(b=>{ if(b.getAttribute('data-tab')===tab) b.classList.add('active'); });\n}\nfunction setView(tab){\n  if(tab==='home'){ el('viewHome').style.display='block'; el('viewMain').style.display='none'; clearAllPagers(); return; }\n  el('viewHome').style.display='none'; el('viewMain').style.display='block';\n}\n\nlet SITE=null;\nlet CURRENT=null;\nlet DATA=null;\nlet STATE={tab:'home', mode:'std', sort:'default', homeKw:'', kw1:'', kw2:'', kw3:'', kw4:'', showAll:false, showRate:true, sel1:'', sel2:'', sel3:'', sel4:''};\nlet IDX={items:[], itemsAll:[], itemsDb:[], itemsDrop:[], itemsDropDisplay:[], itemDrops:{}, itemMinDen:{}, itemRows:{all:{default:[],name:[],rate:[]},drop:{default:[],name:[],rate:[]}}, monsters:[], monstersAll:[], monstersDrop:[], monsterRows:{all:{default:[],name:[]},drop:{default:[],name:[]}}, monByName:{}, monByNorm:{}, maps:[], mapRows:{default:[],name:[]}, mapByKey:{}, routesByFrom:{}, routesByTo:{}, npcs:[], npcRows:{default:[],name:[]}, npcByName:{}, npcRoutesByTo:{}}; \nlet ROUTE_CACHE={chains:new Map(), direct:new Map(), order:[]};\nlet VIEW_CACHE={itemDrops:{}, monsterItems:{}, monsterMaps:{}, mapMonsters:{}, mapRouteRows:{}, npcLocs:{}};\nlet _RENDER_TIMER=null;\nlet _LIST_CLICK_BOUND=false;\nlet _AUTO_PAGE_SCROLL_BOUND=false;\nconst PAGE_SIZE_DEFAULT=100000;\nconst PAGE_SIZE_ROUTE=100000;\nconst VLIST_ROW_HEIGHT=56;\nconst VLIST_BUFFER=8;\nconst AUTO_PAGE_TRIGGER_GAP=120;\n\nlet PAGE_STATE={l1:1,l2:1,l3:1,l4:1};\n\n\n\nfunction scheduleRender(){\n  try{ if(_RENDER_TIMER) clearTimeout(_RENDER_TIMER); }catch(e){}\n  _RENDER_TIMER = setTimeout(function(){\n    _RENDER_TIMER = null;\n    try{ if(STATE.tab!=='home') render(); }catch(e){}\n  }, 160);\n}\n\nfunction resetViewCache(){\n  VIEW_CACHE={itemDrops:{}, monsterItems:{}, monsterMaps:{}, mapMonsters:{}, mapRouteRows:{}, npcLocs:{}};\n}\n\n/* 使用 requestAnimationFrame 合并滚动中的虚拟列表刷新，降低连续重排频率。 */\nfunction scheduleVirtualViewport(node){\n  if(!node || !node._vmeta || node._vraf) return;\n  const raf = (window && window.requestAnimationFrame) ? window.requestAnimationFrame.bind(window) : function(fn){ return setTimeout(fn, 16); };\n  node._vraf = raf(function(){\n    node._vraf = 0;\n    renderVirtualViewport(node);\n  });\n}\n\nfunction itemOverallDen(it){\n\n  const den = Number(it && it.den || 0);\n  const gd = Number(it && it.group_den || 0);\n  if(!den) return 0;\n  if(gd > 0) return den * gd;\n  return den;\n}\n\nfunction hasRealDropEntry(it){\n  const obj = it || {};\n  const nm = String(obj.name || obj.item || obj.title || '').trim();\n  if(!nm) return false;\n  return itemOverallDen(obj) > 0;\n}\n\nfunction getRealMonsterDrops(mon){\n  const arr = (mon && Array.isArray(mon.items)) ? mon.items : [];\n  return dedupeMonItems(arr).filter(hasRealDropEntry);\n}\n\nfunction hasStrictRealDropEntry(it){\n  const obj = it || {};\n  const nm = String(obj.name || obj.item || obj.title || '').trim();\n  if(!nm) return false;\n  if(/^=+\\s*.*?\\s*=+$/.test(nm)) return false;\n  if(/[<$][A-Z$]/i.test(nm) || /\\$STR\\s*\\(/i.test(nm)) return false;\n  return itemOverallDen(obj) > 0;\n}\n\nfunction getStrictRealMonsterDrops(mon){\n  const arr = (mon && Array.isArray(mon.items)) ? mon.items : [];\n  return dedupeMonItems(arr).filter(hasStrictRealDropEntry);\n}\n\nfunction hasRealMonsterDrops(mon){\n  return getStrictRealMonsterDrops(mon).length > 0;\n}\n\nfunction hasRenderableMonsterDropsByName(name){\n  const mon = getMonsterByName(name);\n  return hasRealMonsterDrops(mon);\n}\n\nfunction getMonsterNamesWithRealDrops(){\n  const src = (DATA && Array.isArray(DATA.monsters)) ? DATA.monsters : [];\n  const out = [];\n  for(let i=0;i<src.length;i++){\n    const mon = src[i] || {};\n    const name = String((mon && (mon.monster || mon.name)) || '').trim();\n    if(!name) continue;\n    if(hasRealMonsterDrops(mon)) out.push(name);\n  }\n  return dedupeList(out);\n}\n\nfunction dedupeMonItems(items){\n  const by = {};\n  const order = [];\n  const arr = Array.isArray(items) ? items : [];\n  for(let i=0;i<arr.length;i++){\n    const it = arr[i] || {};\n    const nm = String(it.name||'').trim();\n    if(!nm) continue;\n    const den = itemOverallDen(it);\n    if(!den) continue;\n    const prev = by[nm];\n    if(!prev){\n      by[nm] = it;\n      order.push(nm);\n      continue;\n    }\n    if(itemOverallDen(prev) > den) by[nm] = it;\n  }\n  return order.map(n=>by[n]);\n}\n\nfunction buildNameRows(list){\n  const src = Array.isArray(list) ? list : [];\n  const rows = [];\n  for(let i=0;i<src.length;i++){\n    const name = String(src[i]||'').trim();\n    if(!name) continue;\n    rows.push({key:name, badge:rows.length+1, title:name, _search:name.toLowerCase()});\n  }\n  return rows;\n}\n\nfunction dedupeDisplayRows(rows){\n  const src = Array.isArray(rows) ? rows : [];\n  const out = [];\n  const seen = {};\n  for(let i=0;i<src.length;i++){\n    const r = src[i] || {};\n    const sig = [String(r.title||''), String(r.sub||''), String(r.right||'')].join('|');\n    if(!sig || seen[sig]) continue;\n    seen[sig] = 1;\n    out.push(Object.assign({}, r, {badge: out.length + 1}));\n  }\n  return out;\n}\n\nfunction dedupeList(list){\n  const src = Array.isArray(list) ? list : [];\n  const out = [];\n  const seen = {};\n  for(let i=0;i<src.length;i++){\n    const v = String(src[i] || '').trim();\n    if(!v || seen[v]) continue;\n    seen[v] = 1;\n    out.push(v);\n  }\n  return out;\n}\n\nfunction filterNameRowsByKw(rows, kwRaw){\n  const kw = String(kwRaw||'').trim().toLowerCase();\n  const src = Array.isArray(rows) ? rows : [];\n  if(!kw) return src.slice();\n  const tokens = kw.split(/\\s+/).filter(Boolean);\n  if(!tokens.length) return src.slice();\n  return src.filter(r=>{\n    const t = String((r && r._search) || (r && r.title) || '').toLowerCase();\n    for(let i=0;i<tokens.length;i++){\n      if(t.indexOf(tokens[i]) < 0) return false;\n    }\n    return true;\n  });\n}\n\nfunction itemSortValue(name){\n  return Number((IDX.itemMinDen && IDX.itemMinDen[name]) || 1e18);\n}\n\nfunction rebuildPrimaryRows(){\n  const itemAll = Array.isArray(IDX.itemsAll) ? IDX.itemsAll.slice() : [];\n  const itemDrop = Array.isArray(IDX.itemsDropDisplay) ? IDX.itemsDropDisplay.slice() : [];\n  const monAll = Array.isArray(IDX.monstersAll) ? IDX.monstersAll.slice() : [];\n  const monDrop = Array.isArray(IDX.monstersDrop) ? IDX.monstersDrop.slice() : [];\n  const mapNames = Array.isArray(IDX.maps) ? IDX.maps.map(x=>String(x && x.name || '').trim()).filter(Boolean) : [];\n  const npcNames = Array.isArray(IDX.npcs) ? IDX.npcs.slice() : [];\n\n  IDX.itemRows.all.default = buildNameRows(itemAll);\n  IDX.itemRows.all.name = buildNameRows(itemAll.slice().sort(_sortName));\n  IDX.itemRows.all.rate = buildNameRows(itemAll.slice().sort((a,b)=>itemSortValue(a)-itemSortValue(b)));\n  IDX.itemRows.drop.default = buildNameRows(itemDrop);\n  IDX.itemRows.drop.name = buildNameRows(itemDrop.slice().sort(_sortName));\n  IDX.itemRows.drop.rate = buildNameRows(itemDrop.slice().sort((a,b)=>itemSortValue(a)-itemSortValue(b)));\n\n  IDX.monsterRows.all.default = buildNameRows(monAll);\n  IDX.monsterRows.all.name = buildNameRows(monAll.slice().sort(_sortName));\n  IDX.monsterRows.drop.default = buildNameRows(monDrop);\n  IDX.monsterRows.drop.name = buildNameRows(monDrop.slice().sort(_sortName));\n\n  IDX.mapRows.default = buildNameRows(mapNames);\n  IDX.mapRows.name = buildNameRows(mapNames.slice().sort(_sortName));\n\n  IDX.npcRows.default = buildNameRows(npcNames);\n  IDX.npcRows.name = buildNameRows(npcNames.slice().sort(_sortName));\n}\n\nfunction baseItemRows(){\n  const scope = STATE.showAll ? 'all' : 'drop';\n  if(STATE.sort === 'name') return IDX.itemRows[scope].name || [];\n  if(STATE.sort === 'rate') return IDX.itemRows[scope].rate || [];\n  return IDX.itemRows[scope].default || [];\n}\n\nfunction baseMonsterRows(){\n  const scope = STATE.showAll ? 'all' : 'drop';\n  if(STATE.sort === 'name') return IDX.monsterRows[scope].name || [];\n  return IDX.monsterRows[scope].default || [];\n}\n\nfunction baseMapRows(){\n  if(STATE.sort === 'name') return IDX.mapRows.name || [];\n  return IDX.mapRows.default || [];\n}\n\nfunction baseNpcRows(){\n  if(STATE.sort === 'name') return IDX.npcRows.name || [];\n  return IDX.npcRows.default || [];\n}\n\nfunction getItemDropRows(itemName){\n  const key = String(itemName||'').trim();\n  if(!key) return [];\n  if(VIEW_CACHE.itemDrops[key]) return VIEW_CACHE.itemDrops[key];\n  const drops = (IDX.itemDrops[key] || []).slice();\n  drops.sort((a,b)=>Number(a.den||0)-Number(b.den||0));\n  const rows = drops.map((d,i)=>({key:d.monster, badge:i+1, title:d.monster, right:(STATE.showRate ? ('1/'+d.den) : '')}));\n  VIEW_CACHE.itemDrops[key] = rows;\n  return rows;\n}\n\nfunction getMonsterItemRows(monName){\n  const key = String(monName||'').trim();\n  if(!key) return [];\n  if(VIEW_CACHE.monsterItems[key]) return VIEW_CACHE.monsterItems[key];\n  const mon = IDX.monByName[key] || null;\n  const its = mon && Array.isArray(mon.items) ? dedupeMonItems(mon.items) : [];\n  its.sort((a,b)=>itemOverallDen(a)-itemOverallDen(b));\n  const rows = its.map((it,i)=>({key:it.name, badge:i+1, title:it.name, right:(STATE.showRate ? ('1/'+itemOverallDen(it)) : '')}));\n  VIEW_CACHE.monsterItems[key] = rows;\n  return rows;\n}\n\nfunction getMonsterMapRows(monName){\n  const key = String(monName||'').trim();\n  if(!key) return [];\n  if(VIEW_CACHE.monsterMaps[key]) return VIEW_CACHE.monsterMaps[key];\n  const mon = IDX.monByName[key] || null;\n  const sp = mon && Array.isArray(mon.spawns) ? mon.spawns.slice() : [];\n  const grouped = {};\n  const order = [];\n  for(let i=0;i<sp.length;i++){\n    const s = sp[i] || {};\n    const raw = String((s && (s.map||s.map_code)) || '').trim() || String((s && (s.map_name||s.map)) || '').trim();\n    const code = resolveMapCode(raw);\n    if(!code) continue;\n    if(!grouped[code]){\n      const nm = String((s && s.map_name) || '').trim();\n      grouped[code] = {code:code, title:(mapLabel(code) || nm || raw || code), points:0, total:0, minTime:null, minTimeText:null, sample:[]};\n      order.push(code);\n    }\n    const g = grouped[code];\n    g.points += 1;\n    const cx = Number(s.x||0), cy = Number(s.y||0);\n    if(g.sample.length < 3) g.sample.push(String(cx)+','+String(cy));\n    g.total += Number(s.count||0);\n    const ttext = String((s && (s.time_text||s.timeText)) || '').trim();\n    if(ttext){\n      if(!g.minTimeText) g.minTimeText = ttext;\n    }else if(!g.minTimeText){\n      const tv = Number(s.time||0);\n      if(g.minTime == null) g.minTime = tv;\n      else if(tv > 0 && (g.minTime === 0 || tv < g.minTime)) g.minTime = tv;\n    }\n  }\n  const rows = order.map((code,i)=>{\n    const g = grouped[code] || {};\n    let sub = '点数 ' + Number(g.points||0);\n    if(g.sample && g.sample.length){\n      sub += ' | 坐标 ' + g.sample.join(' ') + (Number(g.points||0) > g.sample.length ? ' ...' : '');\n    }\n    if(g.code && g.title && g.title !== g.code) sub += ' | ' + g.code;\n    const right = g.minTimeText ? (String(g.minTimeText) + '/' + Number(g.total||0) + '只') : ((Number(g.minTime||0))+'分/'+Number(g.total||0)+'只');\n    return {key:g.code, badge:i+1, title:g.title||g.code, sub:sub, right:right};\n  });\n  VIEW_CACHE.monsterMaps[key] = rows;\n  return rows;\n}\n\nfunction getMapMonsterRows(mapName){\n  const key = resolveMapCode(mapName);\n  if(!key) return [];\n  if(VIEW_CACHE.mapMonsters[key]) return VIEW_CACHE.mapMonsters[key];\n  const rows = mapMonsterGroups(key);\n  VIEW_CACHE.mapMonsters[key] = rows;\n  return rows;\n}\n\nfunction getDirectRouteRows(codeOrName){\n  const code = resolveMapCode(codeOrName);\n  if(!code) return [];\n  if(VIEW_CACHE.mapRouteRows[code]) return VIEW_CACHE.mapRouteRows[code];\n  const rts = mergeRouteEdges(directRoutesToMapCached(code), directNpcRoutesToMap(code));\n  const rows = rts.map((r,i)=>{\n    const from = String(r && r.from || '').trim();\n    const to = String(r && r.to || '').trim();\n    const fromName = String(r && (r.from_name || '') || '').trim() || mapLabel(from) || from;\n    const toName = String(r && (r.to_name || '') || '').trim() || mapLabel(to) || to;\n    const sub = routeStepText(r);\n    return {key:'in#'+from+'#'+i, badge:i+1, title:fromName||toName, sub:sub, right:resolveMapCode(from)};\n  });\n  VIEW_CACHE.mapRouteRows[code] = rows;\n  return rows;\n}\n\nfunction getNpcLocationPack(npcName){\n  const key = String(npcName||'').trim();\n  if(!key) return {rows:[], byKey:{}};\n  if(VIEW_CACHE.npcLocs[key]) return VIEW_CACHE.npcLocs[key];\n  const locs = (IDX.npcByName[key] || []).slice();\n  const pack = {rows:locs, byKey:{}};\n  VIEW_CACHE.npcLocs[key] = pack;\n  return pack;\n}\n\nfunction mapLabel(codeOrName){\n  const k = String(codeOrName||'').trim();\n  if(!k) return '';\n  const mp = IDX.mapByKey[k] || IDX.mapByKey[k.toLowerCase()] || IDX.mapByKey[k.toUpperCase()] || null;\n  if(mp){\n    const nm = String(mp.name||'').trim();\n    if(nm) return nm;\n    const cd = String(mp.code||'').trim();\n    if(cd) return cd;\n  }\n  return k;\n}\n\nfunction resolveMapCode(codeOrName){\n  const k = String(codeOrName||'').trim();\n  if(!k) return '';\n  const mp = IDX.mapByKey[k] || IDX.mapByKey[k.toLowerCase()] || IDX.mapByKey[k.toUpperCase()] || null;\n  const cd = mp ? String(mp.code||'').trim() : '';\n  return cd || k;\n}\n\nfunction routesForMap(codeOrName){\n  const code = resolveMapCode(codeOrName);\n  if(!code) return [];\n  const ls = (IDX.routesByFrom && (IDX.routesByFrom[code] || IDX.routesByFrom[code.toLowerCase()] || IDX.routesByFrom[code.toUpperCase()])) || [];\n  return Array.isArray(ls) ? ls : [];\n}\n\nfunction reverseEdgeNonNpc(e){\n  const fromKey = String(e && (e._fromKey || e.from) || '').trim();\n  const toKey = String(e && (e._toKey || e.to) || '').trim();\n  if(!fromKey || !toKey) return null;\n  const via = String(e && (e.via||'') || '').trim();\n  if(via === 'npc') return null;\n  const r2 = {\n    from: toKey,\n    to: fromKey,\n    from_x: (e && e.to_x != null) ? e.to_x : '',\n    from_y: (e && e.to_y != null) ? e.to_y : '',\n    to_x: (e && e.from_x != null) ? e.from_x : '',\n    to_y: (e && e.from_y != null) ? e.from_y : ''\n  };\n  try{ r2._fromKey = toKey; r2._toKey = fromKey; }catch(ex){}\n  try{ r2.from_name = mapLabel(toKey) || String(e && e.to_name || '').trim() || toKey; }catch(ex2){}\n  try{ r2.to_name = mapLabel(fromKey) || String(e && e.from_name || '').trim() || fromKey; }catch(ex3){}\n  return r2;\n}\n\nfunction predEdgesToKey(curKey){\n  const byTo = IDX.routesByTo || {};\n  const byFrom = IDX.routesByFrom || {};\n  const a = [];\n  let inc = byTo[curKey] || byTo[String(curKey||'').toLowerCase()] || byTo[String(curKey||'').toUpperCase()] || [];\n  if(inc && inc.length){\n    if(inc.length > 250) inc = inc.slice(0, 250);\n    a.push.apply(a, inc);\n  }\n  const outs = byFrom[curKey] || byFrom[String(curKey||'').toLowerCase()] || byFrom[String(curKey||'').toUpperCase()] || [];\n  for(let i=0;i<Math.min(200, outs.length);i++){\n    const r2 = reverseEdgeNonNpc(outs[i]);\n    if(r2) a.push(r2);\n  }\n  return a;\n}\n\nfunction directRoutesToMap(codeOrName){\n  const target = resolveMapCode(codeOrName);\n  if(!target) return [];\n  const preds = predEdgesToKey(target);\n  return Array.isArray(preds) ? preds : [];\n}\n\nfunction directRoutesToMapCached(codeOrName){\n  const target = resolveMapCode(codeOrName);\n  if(!target) return [];\n  try{\n    const hit = ROUTE_CACHE.direct.get(target);\n    if(hit) return hit;\n  }catch(e){}\n  const v = directRoutesToMap(target);\n  try{\n    ROUTE_CACHE.direct.set(target, v);\n    ROUTE_CACHE.order.push(target);\n    if(ROUTE_CACHE.order.length > 220){\n      const drop = ROUTE_CACHE.order.shift();\n      try{ ROUTE_CACHE.direct.delete(drop); }catch(e2){}\n      try{ ROUTE_CACHE.chains.delete(drop); }catch(e3){}\n    }\n  }catch(e4){}\n  return v;\n}\n\nfunction routeChainsToMap(codeOrName){\n  const target = resolveMapCode(codeOrName);\n  if(!target) return [];\n  const maxDepth = 14;\n  const maxPaths = 80;\n  const out = [];\n  const seenKeys = new Set();\n\n  const roots = (IDX && Array.isArray(IDX._routeRoots)) ? IDX._routeRoots : [];\n  const rootSet = new Set(roots || []);\n\n  function _sig(path){\n    try{\n      return path.map(e=>{\n        const f = String(e && (e._fromKey||e.from||'')||'').trim();\n        const t = String(e && (e._toKey||e.to||'')||'').trim();\n        const fx = (e && e.from_x != null) ? e.from_x : '';\n        const fy = (e && e.from_y != null) ? e.from_y : '';\n        const tx = (e && e.to_x != null) ? e.to_x : '';\n        const ty = (e && e.to_y != null) ? e.to_y : '';\n        const via = String(e && (e.via||'') || '').trim();\n        const npc = String(e && (e.npc||'') || '').trim();\n        const rr = (e && e.r != null && e.r !== '') ? e.r : '';\n        return f+':'+fx+','+fy+'>'+t+':'+tx+','+ty+':'+via+':'+npc+':'+rr;\n      }).join('|');\n    }catch(e){\n      return '';\n    }\n  }\n\n  let expansions = 0;\n  const maxExpansions = 6500;\n  const q = [{key: target, depth: 0, nodes: [target], rev: []}];\n  while(q.length && out.length < maxPaths && expansions < maxExpansions){\n    const cur = q.shift();\n    if(!cur) break;\n    const curKey = cur.key;\n    if(cur.rev.length && rootSet.size && rootSet.has(curKey)){\n      const path = cur.rev.slice().reverse();\n      const k = _sig(path);\n      if(k && !seenKeys.has(k)){\n        seenKeys.add(k);\n        out.push(path);\n      }\n      continue;\n    }\n    if(cur.depth >= maxDepth) continue;\n    const preds = predEdgesToKey(curKey);\n    if(!preds || !preds.length) continue;\n    const limit = Math.min(120, preds.length);\n    for(let i=0;i<limit && out.length < maxPaths && expansions < maxExpansions;i++){\n      const e = preds[i];\n      const pk = String(e && (e._fromKey || e.from) || '').trim();\n      if(!pk) continue;\n      if(cur.nodes.indexOf(pk) >= 0) continue;\n      expansions += 1;\n      const nodes2 = cur.nodes.slice();\n      nodes2.push(pk);\n      const rev2 = cur.rev.slice();\n      rev2.push(e);\n      q.push({key: pk, depth: cur.depth + 1, nodes: nodes2, rev: rev2});\n    }\n  }\n  if(out.length){\n    out.sort((a,b)=>a.length-b.length);\n    return out;\n  }\n\n  const direct = predEdgesToKey(target);\n  if(direct && direct.length){\n    const chains = [];\n    for(let i=0;i<Math.min(60, direct.length);i++){\n      const e = direct[i];\n      const path = [e];\n      const k = _sig(path);\n      if(k && !seenKeys.has(k)){\n        seenKeys.add(k);\n        chains.push(path);\n      }\n    }\n    chains.sort((a,b)=>a.length-b.length);\n    return chains;\n  }\n  return [];\n}\n\nfunction routeChainsToMapCached(codeOrName){\n  const target = resolveMapCode(codeOrName);\n  if(!target) return [];\n  try{\n    const hit = ROUTE_CACHE.chains.get(target);\n    if(hit) return hit;\n  }catch(e){}\n  const v = routeChainsToMap(target);\n  try{\n    ROUTE_CACHE.chains.set(target, v);\n    ROUTE_CACHE.order.push(target);\n    if(ROUTE_CACHE.order.length > 220){\n      const drop = ROUTE_CACHE.order.shift();\n      try{ ROUTE_CACHE.direct.delete(drop); }catch(e2){}\n      try{ ROUTE_CACHE.chains.delete(drop); }catch(e3){}\n    }\n  }catch(e4){}\n  return v;\n}\n\nfunction directNpcRoutesToMap(codeOrName){\n  const target = resolveMapCode(codeOrName);\n  if(!target) return [];\n  const by = IDX.npcRoutesByTo || {};\n  const arr = by[target] || by[String(target).toLowerCase()] || by[String(target).toUpperCase()] || [];\n  return Array.isArray(arr) ? arr : [];\n}\n\nfunction mergeRouteEdges(base, extra){\n  const out = [];\n  const seen = {};\n  function _sig(e){\n    const f = String(e && (e._fromKey || e.from) || '').trim().toLowerCase();\n    const t = String(e && (e._toKey || e.to) || '').trim().toLowerCase();\n    const fx = (e && e.from_x != null) ? String(e.from_x) : '';\n    const fy = (e && e.from_y != null) ? String(e.from_y) : '';\n    const tx = (e && e.to_x != null) ? String(e.to_x) : '';\n    const ty = (e && e.to_y != null) ? String(e.to_y) : '';\n    const via = String(e && (e.via || '') || '').trim().toLowerCase();\n    const npc = String(e && (e.npc || '') || '').trim().toLowerCase();\n    const rr = (e && e.r != null && e.r !== '') ? String(e.r) : '';\n    return f+'>'+t+'|'+fx+','+fy+'>'+tx+','+ty+'|'+via+'|'+npc+'|'+rr;\n  }\n  const merged = []\n    .concat(Array.isArray(base) ? base : [])\n    .concat(Array.isArray(extra) ? extra : []);\n  for(let i=0;i<merged.length;i++){\n    const r = merged[i];\n    const k = _sig(r);\n    if(!k || seen[k]) continue;\n    seen[k] = 1;\n    out.push(r);\n  }\n  return out;\n}\n\nfunction mergeRouteChains(base, extra){\n  const out = [];\n  const seen = {};\n  function _edgeSig(e){\n    const f = String(e && (e._fromKey || e.from) || '').trim().toLowerCase();\n    const t = String(e && (e._toKey || e.to) || '').trim().toLowerCase();\n    const fx = (e && e.from_x != null) ? String(e.from_x) : '';\n    const fy = (e && e.from_y != null) ? String(e.from_y) : '';\n    const tx = (e && e.to_x != null) ? String(e.to_x) : '';\n    const ty = (e && e.to_y != null) ? String(e.to_y) : '';\n    const via = String(e && (e.via || '') || '').trim().toLowerCase();\n    const npc = String(e && (e.npc || '') || '').trim().toLowerCase();\n    const rr = (e && e.r != null && e.r !== '') ? String(e.r) : '';\n    const randomTo = !!(e && (e.random_to || e.randomTo));\n    return f+'>'+t+'|'+fx+','+fy+'>'+tx+','+ty+'|'+via+'|'+npc+'|'+rr+'|'+String(randomTo);\n  }\n  function _pathSig(path){\n    const arr = Array.isArray(path) ? path : [];\n    if(!arr.length) return '';\n    return arr.map(_edgeSig).join('||');\n  }\n  const merged = []\n    .concat(Array.isArray(base) ? base : [])\n    .concat(Array.isArray(extra) ? extra : []);\n  for(let i=0;i<merged.length;i++){\n    const p = merged[i];\n    const k = _pathSig(p);\n    if(!k || seen[k]) continue;\n    seen[k] = 1;\n    out.push(p);\n  }\n  return out;\n}\n\nfunction formatRouteChain(path){\n  if(!path || !path.length) return '';\n  const names = [];\n  for(let i=0;i<path.length;i++){\n    const r = path[i] || {};\n    const fromKey = String(r._fromKey || r.from || '').trim();\n    const toKey = String(r._toKey || r.to || '').trim();\n    const fromName = String(r.from_name || '').trim() || mapLabel(fromKey) || fromKey;\n    const toName = String(r.to_name || '').trim() || mapLabel(toKey) || toKey;\n    if(i === 0) names.push(String(fromName||'').trim());\n    names.push(String(toName||'').trim());\n  }\n  return names.filter(Boolean).join('→');\n}\n\nfunction normalizeMonsterName(name){\n  return String(name||'')\n    .trim()\n    .toLowerCase()\n    .replace(/[·•‧・·﹒.]/g, '')\n    .replace(/[-—–_\\\\s]+/g, '');\n}\n\nfunction getMonsterByName(name){\n  const raw = String(name||'').trim();\n  if(!raw) return null;\n  const direct = IDX.monByName[raw] || null;\n  const norm = IDX.monByNorm[normalizeMonsterName(raw)] || null;\n  if(direct && hasRealMonsterDrops(direct)) return direct;\n  if(norm && hasRealMonsterDrops(norm)) return norm;\n  return direct || norm || null;\n}\n\nfunction formatMoveSub(fromName, fx, fy, toName, tx, ty, randomTo){\n  let left = String(fromName||'').trim();\n  let right = String(toName||'').trim();\n  const hasF = (fx!=='' && fy!=='');\n  const hasT = (tx!=='' && ty!=='');\n  if(hasF) left += (left ? ' ' : '') + String(fx) + ',' + String(fy);\n  if(hasT) right += (right ? ' ' : '') + String(tx) + ',' + String(ty);\n  else if(randomTo) right += (right ? ' ' : '') + '随机坐标';\n  if(left && right) return left + ' -> ' + right;\n  return left || right || '';\n}\n\nfunction routeStepText(r){\n  const fromKey = String(r && (r._fromKey || r.from) || '').trim();\n  const toKey = String(r && (r._toKey || r.to) || '').trim();\n  const fromName = String(r && r.from_name || '').trim() || mapLabel(fromKey) || fromKey;\n  const toName = String(r && r.to_name || '').trim() || mapLabel(toKey) || toKey;\n  const fx = (r && r.from_x != null) ? r.from_x : '';\n  const fy = (r && r.from_y != null) ? r.from_y : '';\n  const tx = (r && r.to_x != null) ? r.to_x : '';\n  const ty = (r && r.to_y != null) ? r.to_y : '';\n  const randomTo = !!(r && (r.random_to || r.randomTo));\n  let a = String(fromName||'').trim();\n  let b = String(toName||'').trim();\n  const hasF = (fx!=='' && fy!=='');\n  const hasT = (tx!=='' && ty!=='');\n  if(hasF) a += (a ? ' ' : '') + String(fx) + ',' + String(fy);\n  if(hasT) b += (b ? ' ' : '') + String(tx) + ',' + String(ty);\n  else if(randomTo) b += (b ? ' ' : '') + '随机坐标';\n  const base = (a && b) ? (a + '→' + b) : (a || b || '');\n  const via = String(r && (r.via || '') || '').trim().toLowerCase();\n  if(via === 'npc'){\n    const npc = String(r && (r.npc || '') || '').trim();\n    const rr = (r && r.r != null && r.r !== '') ? r.r : '';\n    let extra = ' | NPC传送';\n    if(npc) extra += ' [' + npc + ']';\n    if(rr!=='') extra += ' 范围' + rr;\n    return (base || (toName || fromName || '')) + extra;\n  }\n  return base;\n}\n\n/* 地图走法改为滑动到底自动续载，避免出现手动翻页按钮。 */\nfunction renderRouteMethods(node, chains){\n  const listId = String(node && node.id || '').trim();\n  if(!chains || !chains.length){\n    node.innerHTML = '<div class=\"empty\">暂无地图走法数据</div>';\n    node._pageMeta = null;\n    setListHeaderStat(listId, 0, 0);\n    clearPager(listId);\n    return;\n  }\n  const page = syncPage(listId, chains.length, PAGE_SIZE_ROUTE);\n  const prevPage = Number(node.getAttribute('data-page') || 0) || 0;\n  const keepScroll = !!node._keepScrollOnAppend;\n  node._keepScrollOnAppend = false;\n  node.setAttribute('data-page', String(page));\n  const view = chains.slice(0, page * PAGE_SIZE_ROUTE);\n  node._pageMeta = {listId:listId, total:chains.length, pageSize:PAGE_SIZE_ROUTE, loaded:view.length};\n  setListHeaderStat(listId, chains.length, view.length);\n\n  let html = '';\n  for(let i=0;i<view.length;i++){\n    const p = view[i] || [];\n    if(!p.length) continue;\n    html += '<div class=\"route-card\">';\n    html += '<div class=\"route-card-head\">';\n    html += '<div class=\"route-card-title\">' + esc('走法' + (i+1)) + '</div>';\n    html += '<div class=\"route-card-meta\">' + esc('共' + p.length + '步') + '</div>';\n    html += '</div>';\n    html += '<div class=\"route-steps\">';\n    for(let j=0;j<p.length;j++){\n      const step = routeStepText(p[j]);\n      html += '<div class=\"route-step\">'\n        + '<span class=\"route-step-index\">' + esc(String(j+1) + '.') + '</span>'\n        + '<span>' + esc(step) + '</span>'\n        + '</div>';\n    }\n    html += '</div></div>';\n  }\n\n  node.innerHTML = html || '<div class=\"empty\">暂无地图走法数据</div>';\n  if(prevPage !== page && !keepScroll){\n    try{ node.scrollTop = 0; }catch(e){}\n  }\n  renderPager(listId, chains.length, PAGE_SIZE_ROUTE, page);\n}\n\n\n\nfunction buildIndex(){\n  IDX={items:[], itemsAll:[], itemsDb:[], itemsDrop:[], itemsDropDisplay:[], itemDrops:{}, itemMinDen:{}, itemRows:{all:{default:[],name:[],rate:[]},drop:{default:[],name:[],rate:[]}}, monsters:[], monstersAll:[], monstersDrop:[], monsterRows:{all:{default:[],name:[]},drop:{default:[],name:[]}}, monByName:{}, monByNorm:{}, maps:[], mapRows:{default:[],name:[]}, mapByKey:{}, routesByFrom:{}, routesByTo:{}, npcs:[], npcRows:{default:[],name:[]}, npcByName:{}, npcRoutesByTo:{}}; \n  try{ ROUTE_CACHE={chains:new Map(), direct:new Map(), order:[]}; }catch(e){}\n  resetViewCache();\n  if(!DATA) return;\n  const hasPreDrops = (DATA && DATA.item_drops && typeof DATA.item_drops === 'object') ? true : false;\n  const preDrops = hasPreDrops ? DATA.item_drops : null;\n  const itemDropsMap = hasPreDrops ? null : {};\n  const monsters = Array.isArray(DATA.monsters)?DATA.monsters:[];\n  monsters.forEach(m=>{\n    const name = String(m.monster||'').trim();\n    if(!name) return;\n    const prev = IDX.monByName[name];\n    if(!prev || (hasRealMonsterDrops(m) && !hasRealMonsterDrops(prev))){\n      IDX.monByName[name]=m;\n    }\n    const nk = normalizeMonsterName(name);\n    if(nk){\n      const prevNorm = IDX.monByNorm[nk];\n      if(!prevNorm || (hasRealMonsterDrops(m) && !hasRealMonsterDrops(prevNorm))){\n        IDX.monByNorm[nk] = m;\n      }\n    }\n    IDX.monsters.push(name);\n    if(!hasPreDrops){\n      const items = Array.isArray(m.items)?m.items:[];\n      items.forEach(it=>{\n        const iname = String(it.name||'').trim();\n        const den0 = Number(it.den||0);\n        const den = den0 * (Number(it.group_den||0) > 0 ? Number(it.group_den||0) : 1);\n        if(!iname || !den) return;\n        if(!itemDropsMap[iname]) itemDropsMap[iname] = {};\n        const prev = itemDropsMap[iname][name];\n        if(prev == null || den < Number(prev||0)) itemDropsMap[iname][name] = den;\n      });\n    }\n  });\n  if(hasPreDrops && preDrops){\n    try{\n      const monsterItemMap = {};\n      Object.keys(preDrops).forEach(iname=>{\n        const raw = preDrops[iname];\n        const arr = [];\n        const a0 = Array.isArray(raw) ? raw : [];\n        for(let i=0;i<a0.length;i++){\n          const r = a0[i];\n          if(Array.isArray(r)){\n            const mon = String(r[0]||'').trim();\n            const den = Number(r[1]||0);\n            if(mon && den){\n              arr.push({monster:mon, den:den});\n              if(!monsterItemMap[mon]) monsterItemMap[mon] = [];\n              monsterItemMap[mon].push({name:String(iname||'').trim(), den:den, group_den:1});\n            }\n          }else{\n            const mon = String(r && r.monster || '').trim();\n            const den = Number(r && r.den || 0);\n            if(mon && den){\n              arr.push({monster:mon, den:den});\n              if(!monsterItemMap[mon]) monsterItemMap[mon] = [];\n              monsterItemMap[mon].push({name:String(iname||'').trim(), den:den, group_den:1});\n            }\n          }\n        }\n        if(arr.length){\n          IDX.itemDrops[iname] = arr;\n          let minDen = 1e18;\n          for(let j=0;j<arr.length;j++){\n            const den = Number(arr[j] && arr[j].den || 0);\n            if(den > 0 && den < minDen) minDen = den;\n          }\n          IDX.itemMinDen[iname] = minDen < 1e18 ? minDen : 1e18;\n        }\n      });\n      Object.keys(monsterItemMap).forEach(monName=>{\n        const nk = normalizeMonsterName(monName);\n        const mon = IDX.monByName[monName] || (nk ? IDX.monByNorm[nk] : null) || null;\n        if(!mon) return;\n        mon.items = dedupeMonItems(monsterItemMap[monName]);\n      });\n    }catch(e){}\n  }else{\n    Object.keys(itemDropsMap).forEach(iname=>{\n      const mm = itemDropsMap[iname] || {};\n      const arr = [];\n      Object.keys(mm).forEach(mon=>{\n        const den = Number(mm[mon]||0);\n        if(mon && den) arr.push({monster:mon, den:den});\n      });\n      IDX.itemDrops[iname] = arr;\n      let minDen = 1e18;\n      for(let i=0;i<arr.length;i++){\n        const den = Number(arr[i] && arr[i].den || 0);\n        if(den > 0 && den < minDen) minDen = den;\n      }\n      IDX.itemMinDen[iname] = minDen < 1e18 ? minDen : 1e18;\n    });\n  }\n  IDX.itemsDrop = Object.keys(IDX.itemDrops);\n  IDX.itemsDb = Array.isArray(DATA.all_items_db) ? DATA.all_items_db.map(x=>String(x||'').trim()).filter(Boolean) : [];\n  IDX.itemsAll = Array.isArray(DATA.all_items) ? DATA.all_items.map(x=>String(x||'').trim()).filter(Boolean) : IDX.itemsDrop.slice();\n  if(IDX.itemsDb && IDX.itemsDb.length){\n    const dbSet = new Set(IDX.itemsDb.map(x=>String(x||'').trim().toLowerCase()).filter(Boolean));\n    IDX.itemsDropDisplay = IDX.itemsDrop.filter(x=>dbSet.has(String(x||'').trim().toLowerCase()));\n    const ratio = IDX.itemsDrop.length ? (IDX.itemsDropDisplay.length / IDX.itemsDrop.length) : 0;\n    if((!IDX.itemsDropDisplay.length) || ratio < 0.2){\n      IDX.itemsDropDisplay = IDX.itemsDrop.slice();\n    }\n  }else{\n    IDX.itemsDropDisplay = IDX.itemsDrop.slice();\n  }\n  IDX.items = IDX.itemsAll.slice();\n  IDX.monstersDrop = getMonsterNamesWithRealDrops();\n  IDX.monstersAll = Array.isArray(DATA.all_monsters) ? DATA.all_monsters.map(x=>String(x||'').trim()).filter(Boolean) : IDX.monstersDrop.slice();\n  IDX.monsters = IDX.monstersAll.slice();\n  const maps = Array.isArray(DATA.maps)?DATA.maps:[];\n  const seenMapCodes = {};\n  function registerMapAlias(keyLike, canonicalCode, nameLike){\n    const key0 = String(keyLike||'').trim();\n    const code0 = String(canonicalCode||'').trim() || key0;\n    const name0 = String(nameLike||'').trim();\n    if(!key0 && !code0 && !name0) return null;\n    let base =\n      IDX.mapByKey[code0] || IDX.mapByKey[String(code0).toLowerCase()] || IDX.mapByKey[String(code0).toUpperCase()] ||\n      IDX.mapByKey[key0] || IDX.mapByKey[String(key0).toLowerCase()] || IDX.mapByKey[String(key0).toUpperCase()] ||\n      (name0 ? (IDX.mapByKey[name0] || IDX.mapByKey[String(name0).toLowerCase()] || IDX.mapByKey[String(name0).toUpperCase()]) : null) ||\n      null;\n    if(base && typeof base === 'object'){\n      try{ if(code0 && !String(base.code||'').trim()) base.code = code0; }catch(e){}\n      try{\n        const oldName = String(base.name||'').trim();\n        if(name0 && (!oldName || oldName === String(base.code||'').trim() || oldName.toLowerCase() === key0.toLowerCase())){\n          base.name = name0;\n        }\n      }catch(e2){}\n    }else{\n      base = {code: code0 || key0 || name0, name: name0 || code0 || key0};\n    }\n    const aliases = [];\n    [key0, code0, name0].forEach(v=>{\n      const s = String(v||'').trim();\n      if(!s) return;\n      aliases.push(s);\n      aliases.push(String(s).toLowerCase());\n      aliases.push(String(s).toUpperCase());\n    });\n    aliases.forEach(a=>{\n      if(a) IDX.mapByKey[a] = base;\n    });\n    const ckey = String(base.code||code0||key0||'').trim().toLowerCase();\n    if(ckey) seenMapCodes[ckey] = true;\n    return base;\n  }\n  function rebuildMapRowsFromAliases(){\n    IDX.maps = [];\n    const outSeenNames = {};\n    Object.keys(seenMapCodes).forEach(ck=>{\n      const mp = IDX.mapByKey[ck] || IDX.mapByKey[String(ck).toLowerCase()] || IDX.mapByKey[String(ck).toUpperCase()] || null;\n      if(!mp) return;\n      const code = String(mp.code||ck).trim() || ck;\n      const name = String(mp.name||'').trim() || code;\n      const nk = String(name||'').trim().toLowerCase();\n      if(!nk || outSeenNames[nk]) return;\n      outSeenNames[nk] = true;\n      if(IDX.maps.length < 5000) IDX.maps.push({code:code, name:name});\n    });\n  }\n  maps.forEach(mp=>{\n    const code = String(mp.code||'').trim();\n    const name = String(mp.name||'').trim() || code;\n    const ck = String(code||'').trim().toLowerCase();\n    if(ck) seenMapCodes[ck] = true;\n    if(code){\n      IDX.mapByKey[code]=mp;\n      IDX.mapByKey[String(code).toLowerCase()] = mp;\n      IDX.mapByKey[String(code).toUpperCase()] = mp;\n    }\n    if(name){\n      IDX.mapByKey[name]=mp;\n      IDX.mapByKey[String(name).toLowerCase()] = mp;\n    }\n  });\n  const mapIndex = Array.isArray(DATA.map_index)?DATA.map_index:[];\n  mapIndex.forEach(mi=>{\n    const key0 = String(mi && (mi.key || mi.k) || '').trim();\n    const code0 = String(mi && mi.code || '').trim();\n    const name0 = String(mi && mi.name || '').trim();\n    const code = code0 || key0 || name0;\n    const name = name0 || code0 || code;\n    if(!code) return;\n    let base = IDX.mapByKey[code] || IDX.mapByKey[String(code).toLowerCase()] || IDX.mapByKey[String(code).toUpperCase()] || null;\n    if(base && typeof base === 'object'){\n      try{ if(!base.code) base.code = code; }catch(e){}\n      if(name){ try{ base.name = name; }catch(e2){} }\n    }else{\n      base = {code:code, name:name||code};\n    }\n    IDX.mapByKey[code] = base;\n    IDX.mapByKey[String(code).toLowerCase()] = base;\n    IDX.mapByKey[String(code).toUpperCase()] = base;\n    if(name){\n      IDX.mapByKey[name] = base;\n      IDX.mapByKey[String(name).toLowerCase()] = base;\n    }\n    if(key0){\n      IDX.mapByKey[key0] = base;\n      IDX.mapByKey[String(key0).toLowerCase()] = base;\n      IDX.mapByKey[String(key0).toUpperCase()] = base;\n    }\n    seenMapCodes[String(code).toLowerCase()] = true;\n  });\n  const routes = Array.isArray(DATA.routes)?DATA.routes:[];\n  routes.forEach(r=>{\n    const f = String(r && r.from || '').trim();\n    const t = String(r && r.to || '').trim();\n    if(!f || !t) return;\n    const fkey = resolveMapCode(f);\n    const tkey = resolveMapCode(t);\n    if(!fkey || !tkey) return;\n    try{ r._fromKey = fkey; r._toKey = tkey; }catch(e){}\n    registerMapAlias(f, fkey, String(r && (r.from_name || '') || '').trim());\n    registerMapAlias(t, tkey, String(r && (r.to_name || '') || '').trim());\n    if(!IDX.routesByFrom[fkey]) IDX.routesByFrom[fkey] = [];\n    IDX.routesByFrom[fkey].push(r);\n    IDX.routesByFrom[fkey.toLowerCase()] = IDX.routesByFrom[fkey];\n    if(!IDX.routesByTo[tkey]) IDX.routesByTo[tkey] = [];\n    IDX.routesByTo[tkey].push(r);\n    IDX.routesByTo[tkey.toLowerCase()] = IDX.routesByTo[tkey];\n  });\n\n  const npcs = Array.isArray(DATA.npcs)?DATA.npcs:[];\n  const npcEdgeSeen = {};\n  npcs.forEach(loc=>{\n    const npcName = String((loc && (loc.npc || loc.name)) || '').trim();\n    const fromRaw = String((loc && (loc.map || loc.map_name)) || '').trim();\n    const fromKey = resolveMapCode(fromRaw);\n    if(!fromKey) return;\n    registerMapAlias(fromRaw, fromKey, String((loc && loc.map_name) || '').trim());\n    const fx = (loc && loc.x != null) ? loc.x : '';\n    const fy = (loc && loc.y != null) ? loc.y : '';\n    const tele = (loc && Array.isArray(loc.teleports)) ? loc.teleports : [];\n    for(let i=0;i<tele.length;i++){\n\n      const t = tele[i] || {};\n      const toRaw = String(t.map||t.map_name||'').trim();\n      const toKey = resolveMapCode(toRaw);\n      if(!toKey) continue;\n      registerMapAlias(toRaw, toKey, String(t.map_name||'').trim());\n      const tx = (t.x != null) ? t.x : '';\n      const ty = (t.y != null) ? t.y : '';\n      const rr = (t.r != null && t.r !== '') ? t.r : '';\n      const randomTo = !!(t && (t.random_to || t.randomTo));\n      const sig = String(fromKey).toLowerCase()+'>'+String(toKey).toLowerCase()+'|'+String(fx)+'|'+String(fy)+'|'+String(tx)+'|'+String(ty)+'|'+npcName+'|'+String(rr);\n      if(npcEdgeSeen[sig]) continue;\n      npcEdgeSeen[sig] = 1;\n      const r = {\n        from: fromKey,\n        to: toKey,\n        from_x: fx,\n        from_y: fy,\n        to_x: tx,\n        to_y: ty,\n        via: 'npc',\n        npc: npcName,\n        r: rr,\n        random_to: randomTo\n      };\n      try{ r._fromKey = fromKey; r._toKey = toKey; }catch(e){}\n      try{ r.from_name = mapLabel(fromKey) || fromRaw || fromKey; }catch(e2){}\n      try{ r.to_name = mapLabel(toKey) || String(t.map_name||'').trim() || toRaw || toKey; }catch(e3){}\n      if(!IDX.routesByFrom[fromKey]) IDX.routesByFrom[fromKey] = [];\n      IDX.routesByFrom[fromKey].push(r);\n      IDX.routesByFrom[fromKey.toLowerCase()] = IDX.routesByFrom[fromKey];\n      if(!IDX.routesByTo[toKey]) IDX.routesByTo[toKey] = [];\n      IDX.routesByTo[toKey].push(r);\n      IDX.routesByTo[toKey.toLowerCase()] = IDX.routesByTo[toKey];\n      if(!IDX.npcRoutesByTo[toKey]) IDX.npcRoutesByTo[toKey] = [];\n      IDX.npcRoutesByTo[toKey].push(r);\n      IDX.npcRoutesByTo[toKey.toLowerCase()] = IDX.npcRoutesByTo[toKey];\n      if(toRaw){\n        const tk = String(toRaw).trim();\n        if(tk){\n          IDX.npcRoutesByTo[tk] = IDX.npcRoutesByTo[toKey];\n          IDX.npcRoutesByTo[tk.toLowerCase()] = IDX.npcRoutesByTo[toKey];\n        }\n      }\n    }\n  });\n  npcs.forEach(n=>{\n    const nm = String((n && (n.npc || n.name)) || '').trim();\n    if(!nm) return;\n    if(!IDX.npcByName[nm]){ IDX.npcByName[nm] = []; IDX.npcs.push(nm); }\n    IDX.npcByName[nm].push(n);\n  });\n  rebuildMapRowsFromAliases();\n  try{\n    const rootNames = [\n      '盟重土城','盟重省','盟重','比奇城','比奇省','比奇',\n      '苍月岛','白日门','封魔谷','沙巴克','土城'\n    ];\n    const roots = [];\n    for(let i=0;i<rootNames.length;i++){\n      const k = resolveMapCode(rootNames[i]);\n      if(!k) continue;\n      if(roots.indexOf(k) >= 0) continue;\n      const hasEdges = (IDX.routesByFrom[k] && IDX.routesByFrom[k].length) || (IDX.routesByTo[k] && IDX.routesByTo[k].length) || (IDX.routesByFrom[String(k).toLowerCase()] && IDX.routesByFrom[String(k).toLowerCase()].length) || (IDX.routesByTo[String(k).toLowerCase()] && IDX.routesByTo[String(k).toLowerCase()].length);\n      if(hasEdges) roots.push(k);\n    }\n    IDX._routeRoots = roots;\n  }catch(e2){}\n  rebuildPrimaryRows();\n}\n\nfunction mapMonsterGroups(selMap){\n  const code = resolveMapCode(selMap);\n  if(!code) return [];\n  if(VIEW_CACHE.mapMonsters[code]) return VIEW_CACHE.mapMonsters[code];\n  const grouped = {};\n  const order = [];\n  const allMons = Array.isArray(IDX.monstersAll) && IDX.monstersAll.length ? IDX.monstersAll : Object.keys(IDX.monByName || {});\n  for(let i=0;i<allMons.length;i++){\n    const monName = String(allMons[i] || '').trim();\n    if(!monName) continue;\n    const mon = IDX.monByName[monName];\n    const sp = mon && Array.isArray(mon.spawns) ? mon.spawns.slice() : [];\n    for(let j=0;j<sp.length;j++){\n      const s = sp[j] || {};\n      const raw = String((s && (s.map||s.map_code)) || '').trim() || String((s && (s.map_name||s.map)) || '').trim();\n      const scode = resolveMapCode(raw);\n      if(!scode || scode !== code) continue;\n      if(!grouped[monName]){\n        grouped[monName] = {name:monName, total:0, minTime:null, minTimeText:null, sample:[]};\n        order.push(monName);\n      }\n      const g = grouped[monName];\n      g.total += Number(s.count||0);\n      const ttext = String((s && (s.time_text||s.timeText)) || '').trim();\n      if(ttext){\n        if(!g.minTimeText) g.minTimeText = ttext;\n      }else if(!g.minTimeText){\n        const tv = Number(s.time||0);\n        if(g.minTime == null) g.minTime = tv;\n        else if(tv > 0 && (g.minTime === 0 || tv < g.minTime)) g.minTime = tv;\n      }\n      const cx = (s.x != null) ? s.x : '';\n      const cy = (s.y != null) ? s.y : '';\n      if(g.sample.length < 3 && cx !== '' && cy !== '') g.sample.push(String(cx)+','+String(cy));\n    }\n  }\n  const rows = order.map((nm,i)=>{\n    const g = grouped[nm] || {};\n    let sub = '';\n    if(g.sample && g.sample.length){\n      sub = '坐标 ' + g.sample.join(' ') + (g.sample.length >= 3 ? ' ...' : '');\n    }\n    const right = g.minTimeText ? (String(g.minTimeText) + '/' + Number(g.total||0) + '只') : ((Number(g.minTime||0))+'分/'+Number(g.total||0)+'只');\n    return {key:nm, badge:i+1, title:nm, sub:sub, right:right};\n  });\n  VIEW_CACHE.mapMonsters[code] = rows;\n  return rows;\n}\n\nfunction setHeaders(){\n  if(STATE.tab==='item'){\n    el('h1').textContent='物品名称';\n    el('h2').textContent='物品出处';\n    el('h3').textContent='刷新地图';\n    el('h4').textContent='地图走法';\n  }else if(STATE.tab==='monster'){\n    el('h1').textContent='怪物名称';\n    el('h2').textContent='掉落物品';\n    el('h3').textContent='刷新地图';\n    el('h4').textContent='地图走法';\n  }else if(STATE.tab==='map'){\n    el('h1').textContent='地图名称';\n    el('h2').textContent='地图走法';\n    el('h3').textContent='刷新怪物';\n    el('h4').textContent='掉落物品';\n  }else if(STATE.tab==='npc'){\n    el('h1').textContent='NPC名称';\n    el('h2').textContent='所在位置';\n    el('h3').textContent='地图走法';\n    el('h4').textContent='相关物品';\n  }\n}\n\n/* 重置分页并回到顶部，确保筛选或切换后从第一页开始浏览。 */\nfunction resetPages(ids){\n  const arr = (Array.isArray(ids) && ids.length) ? ids : ['l1','l2','l3','l4'];\n  for(let i=0;i<arr.length;i++){\n    const id = String(arr[i] || '').trim();\n    if(!id) continue;\n    PAGE_STATE[id] = 1;\n    try{ const node = el(id); if(node) node.scrollTop = 0; }catch(e){}\n  }\n}\n\n/* 根据列表编号定位对应分页栏。 */\nfunction pagerIdByList(listId){\n  const m = String(listId || '').match(/^l([1-4])$/);\n  return m ? ('p' + m[1]) : '';\n}\n\n/* 根据列表编号定位列头统计文本节点。 */\nfunction headerStatIdByList(listId){\n  const m = String(listId || '').match(/^l([1-4])$/);\n  return m ? ('h' + m[1] + 's') : '';\n}\n\nfunction listUnitByContext(listId){\n  const id = String(listId || '').trim();\n  const tab = String((STATE && STATE.tab) || '').trim();\n  if(id === 'l1'){\n    if(tab === 'item') return '项';\n    if(tab === 'monster') return '只';\n    if(tab === 'map') return '张';\n    if(tab === 'npc') return '个';\n  }\n  if(id === 'l2'){\n    if(tab === 'item') return '处';\n    if(tab === 'monster') return '项';\n    if(tab === 'map') return '条';\n    if(tab === 'npc') return '处';\n  }\n  if(id === 'l3'){\n    if(tab === 'item') return '张';\n    if(tab === 'monster') return '张';\n    if(tab === 'map') return '只';\n    if(tab === 'npc') return '条';\n  }\n  if(id === 'l4'){\n    if(tab === 'item') return '条';\n    if(tab === 'monster') return '条';\n    if(tab === 'map') return '项';\n    if(tab === 'npc') return '项';\n  }\n  return '项';\n}\n\n/* 列头只显示当前勾选状态下的真实总数。 */\nfunction setListHeaderStat(listId, total){\n  const sid = headerStatIdByList(listId);\n  const node = sid ? el(sid) : null;\n  if(!node) return;\n  const totalNum = Math.max(0, Number(total || 0) || 0);\n  if(totalNum <= 0){\n    node.textContent = '';\n    return;\n  }\n  node.textContent = '总数 ' + totalNum + ' ' + listUnitByContext(listId);\n}\n\n/* 清空单个列表的分页栏。 */\nfunction clearPager(listId){\n\n  const pid = pagerIdByList(listId);\n  const node = pid ? el(pid) : null;\n  if(!node) return;\n  node.innerHTML = '';\n  node.classList.add('hidden');\n}\n\n/* 切换到首页或加载中状态时清空全部分页栏。 */\nfunction clearAllPagers(){\n  clearPager('l1');\n  clearPager('l2');\n  clearPager('l3');\n  clearPager('l4');\n}\n\n/* 约束当前页码，避免筛选后页码越界。 */\nfunction syncPage(listId, total, pageSize){\n  const size = Math.max(1, Number(pageSize || 1) || 1);\n  const maxPage = Math.max(1, Math.ceil(Number(total || 0) / size));\n  let page = Number(PAGE_STATE[listId] || 1) || 1;\n  if(page < 1) page = 1;\n  if(page > maxPage) page = maxPage;\n  PAGE_STATE[listId] = page;\n  return page;\n}\n\n/* 生成单行 HTML，供普通渲染和虚拟滚动复用。 */\nfunction renderRowHtml(r, activeKey){\n  const row = r || {};\n  const k = String(row.key || '');\n  const leftBadge = (row.badge!=null)?('<div class=\"badge\">'+esc(row.badge)+'</div>'):'';\n  const right = (row.right!=null)?('<div class=\"right\">'+esc(row.right)+'</div>'):'';\n  const sub = row.sub?('<div class=\"sub\">'+esc(row.sub)+'</div>'):'';\n  const cls = (k && k===activeKey)?'row active':'row';\n  return '<div class=\"'+cls+'\" data-key=\"'+esc(k)+'\">'\n    + '<div class=\"left\">'+leftBadge+'<div style=\"min-width:0\"><div class=\"title\">'+esc(row.title)+'</div>'+sub+'</div></div>'\n    + right\n    + '</div>';\n}\n\n/* 根据当前滚动位置，仅渲染可视区附近的行，降低大列表 DOM 数量。 */\nfunction renderVirtualViewport(node){\n  const meta = node && node._vmeta ? node._vmeta : null;\n  if(!meta){\n    if(node) node.innerHTML = '<div class=\"empty\">暂无数据</div>';\n    return;\n  }\n  const rows = Array.isArray(meta.rows) ? meta.rows : [];\n  if(!rows.length){\n    node.innerHTML = '<div class=\"empty\">暂无数据</div>';\n    return;\n  }\n  const viewport = Math.max(node.clientHeight || 520, VLIST_ROW_HEIGHT);\n  const scrollTop = Math.max(0, node.scrollTop || 0);\n  const visible = Math.ceil(viewport / VLIST_ROW_HEIGHT) + VLIST_BUFFER * 2;\n  const start = Math.max(0, Math.floor(scrollTop / VLIST_ROW_HEIGHT) - VLIST_BUFFER);\n  const end = Math.min(rows.length, start + visible);\n  if(meta.start === start && meta.end === end && meta.activeKey === meta._activeRendered){\n    return;\n  }\n  meta.start = start;\n  meta.end = end;\n  meta._activeRendered = meta.activeKey;\n  const topPad = start * VLIST_ROW_HEIGHT;\n  const bottomPad = Math.max(0, (rows.length - end) * VLIST_ROW_HEIGHT);\n  let html = '';\n  if(topPad > 0) html += '<div class=\"vpad\" style=\"height:' + topPad + 'px\"></div>';\n  for(let i=start;i<end;i++){\n    html += renderRowHtml(rows[i], meta.activeKey);\n  }\n  if(bottomPad > 0) html += '<div class=\"vpad\" style=\"height:' + bottomPad + 'px\"></div>';\n  node.innerHTML = html;\n}\n\n/* 自动续载模式下不显示底部状态栏或翻页控件。 */\nfunction renderPager(listId, total, pageSize, page){\n  clearPager(listId);\n}\n\n\n/* 滑动接近底部时自动追加下一页，替代手动点击翻页。 */\nfunction tryAutoLoadNextPage(node){\n  const meta = node && node._pageMeta ? node._pageMeta : null;\n  if(!node || !meta) return;\n  const listId = String(meta.listId || '').trim();\n  if(!listId || node._autoPagingBusy) return;\n  const total = Math.max(0, Number(meta.total || 0) || 0);\n  const size = Math.max(1, Number(meta.pageSize || PAGE_SIZE_DEFAULT) || PAGE_SIZE_DEFAULT);\n  const maxPage = Math.max(1, Math.ceil(total / size));\n  const page = Number(PAGE_STATE[listId] || 1) || 1;\n  if(page >= maxPage) return;\n  const remain = Number(node.scrollHeight || 0) - Number(node.clientHeight || 0) - Number(node.scrollTop || 0);\n  if(remain > AUTO_PAGE_TRIGGER_GAP) return;\n  node._autoPagingBusy = true;\n  PAGE_STATE[listId] = page + 1;\n  node._keepScrollOnAppend = true;\n  const top = Number(node.scrollTop || 0) || 0;\n  try{ render(); }finally{\n    try{ node.scrollTop = top; }catch(e){}\n    setTimeout(function(){ try{ node._autoPagingBusy = false; }catch(e2){} }, 0);\n  }\n}\n\n/* 普通列表改为“滑动自动续载 + 当前已加载范围虚拟滚动”。 */\nfunction renderList(node, rows, activeKey, pageSize){\n  const listId = String(node && node.id || '').trim();\n  const size = Math.max(1, Number(pageSize || PAGE_SIZE_DEFAULT) || PAGE_SIZE_DEFAULT);\n  if(!rows || !rows.length){\n    node.innerHTML = '<div class=\"empty\">暂无数据</div>';\n    node._vmeta = null;\n    node._pageMeta = null;\n    setListHeaderStat(listId, 0);\n    clearPager(listId);\n    return;\n  }\n  const page = syncPage(listId, rows.length, size);\n  const loadedRows = rows.slice(0, page * size);\n  const prevPage = Number(node.getAttribute('data-page') || 0) || 0;\n  const keepScroll = !!node._keepScrollOnAppend;\n  node._keepScrollOnAppend = false;\n  node.setAttribute('data-page', String(page));\n  node._pageMeta = {listId:listId, total:rows.length, pageSize:size, loaded:loadedRows.length};\n  node._vmeta = {rows:loadedRows, activeKey:activeKey || '', start:-1, end:-1, _activeRendered:null};\n  setListHeaderStat(listId, rows.length);\n\n  if(prevPage !== page && !keepScroll){\n    try{ node.scrollTop = 0; }catch(e){}\n  }\n  renderVirtualViewport(node);\n  renderPager(listId, rows.length, size, page);\n}\n\n\nfunction bindClicks(){\n  if(_LIST_CLICK_BOUND) return;\n  _LIST_CLICK_BOUND = true;\n  const ids = ['l1','l2','l3','l4'];\n  ids.forEach((id, idx)=>{\n    const node = el(id);\n    if(!node) return;\n    node.onclick = function(ev){\n      let t = ev && ev.target ? ev.target : null;\n      while(t && t !== node && !(t.classList && t.classList.contains('row'))){\n        t = t.parentNode;\n      }\n      if(!t || t === node) return;\n      const k = t.getAttribute('data-key') || '';\n      if(idx===0){ STATE.sel1=k; STATE.sel2=''; STATE.sel3=''; STATE.sel4=''; resetPages(['l2','l3','l4']); }\n      if(idx===1){ STATE.sel2=k; STATE.sel3=''; STATE.sel4=''; resetPages(['l3','l4']); }\n      if(idx===2){ STATE.sel3=k; STATE.sel4=''; resetPages(['l4']); }\n      if(idx===3){ STATE.sel4=k; }\n      render();\n    };\n  });\n}\n\nfunction bindAutoPageScroll(){\n  if(_AUTO_PAGE_SCROLL_BOUND) return;\n  _AUTO_PAGE_SCROLL_BOUND = true;\n  const ids = ['l1','l2','l3','l4'];\n  ids.forEach(id=>{\n    const node = el(id);\n    if(!node) return;\n    node.addEventListener('scroll', function(){\n      if(node._vmeta) scheduleVirtualViewport(node);\n      tryAutoLoadNextPage(node);\n    }, {passive:true});\n  });\n}\n\n\n\n\nfunction filterByKw(list, kwRaw){\n  const kw=String(kwRaw||'').trim().toLowerCase();\n  if(!kw) return list.slice();\n  const tokens = kw.split(/\\s+/).filter(Boolean);\n  if(!tokens.length) return list.slice();\n  return list.filter(x=>{\n    const t = String(x||'').toLowerCase();\n    for(let i=0;i<tokens.length;i++){\n      const ok = t.indexOf(tokens[i]) >= 0;\n      if(!ok) return false;\n    }\n    return true;\n  });\n}\n\nfunction filterRowsByKw(rows, kwRaw){\n  const kw = String(kwRaw||'').trim().toLowerCase();\n  if(!kw) return rows.slice();\n  return rows.filter(r=>{\n    const t = (String((r && r.title) || '') + ' ' + String((r && r.sub) || '') + ' ' + String((r && r.right) || '')).toLowerCase();\n    return t.indexOf(kw) >= 0;\n  });\n}\n\nfunction _sortName(a, b){\n  return String(a||'').localeCompare(String(b||''), 'zh');\n}\n\nfunction applySortItems(list){\n  const out = list.slice();\n  if(STATE.sort === 'name'){\n    out.sort(_sortName);\n    return out;\n  }\n  if(STATE.sort === 'rate'){\n    out.sort((a,b)=>{\n      const da = Number((IDX.itemMinDen && IDX.itemMinDen[a]) || 1e18);\n      const db = Number((IDX.itemMinDen && IDX.itemMinDen[b]) || 1e18);\n      return da - db;\n    });\n    return out;\n  }\n  return out;\n}\n\nfunction applySortNames(list){\n  const out = list.slice();\n  if(STATE.sort === 'name'){\n    out.sort(_sortName);\n  }\n  return out;\n}\n\nfunction render(){\n  setHeaders();\n\n  el('h1s').textContent=''; el('h2s').textContent=''; el('h3s').textContent=''; el('h4s').textContent='';\n  if(STATE.tab==='home'){ setView('home'); renderHome(); return; }\n  setView('main');\n  if(!DATA){ el('l1').innerHTML='<div class=\"empty\">数据未加载</div>'; el('l2').innerHTML=''; el('l3').innerHTML=''; el('l4').innerHTML=''; return; }\n\n  if(STATE.tab==='item'){\n    const baseItems = STATE.showAll ? (IDX.itemsAll || IDX.items || []) : (IDX.itemsDropDisplay || IDX.itemsDrop || IDX.items || []);\n    let items = filterByKw(baseItems, STATE.kw1);\n    items = applySortItems(items);\n    el('h1s').textContent = '总数 ' + items.length + ' 项';\n    renderList(el('l1'), items.map((n,i)=>({key:n, badge:i+1, title:n})), STATE.sel1);\n\n    const drops = (STATE.sel1 && IDX.itemDrops[STATE.sel1]) ? IDX.itemDrops[STATE.sel1].slice() : [];\n    drops.sort((a,b)=>Number(a.den||0)-Number(b.den||0));\n    const d2 = filterRowsByKw(drops.map((d,i)=>({key:d.monster, badge:i+1, title:d.monster, right:(STATE.showRate ? ('1/'+d.den) : '')})), STATE.kw2);\n    el('h2s').textContent = STATE.sel1 ? ('总数 ' + d2.length+' 个') : '';\n    renderList(el('l2'), d2, STATE.sel2);\n\n    // h3 刷新地图\n    const mon = STATE.sel2 ? IDX.monByName[STATE.sel2] : null;\n    const sp = mon && Array.isArray(mon.spawns) ? mon.spawns.slice() : [];\n    const grouped = {};\n    const order = [];\n    for(let i=0;i<sp.length;i++){\n      const s = sp[i] || {};\n      const raw = String((s && (s.map||s.map_code)) || '').trim() || String((s && (s.map_name||s.map)) || '').trim();\n      const code = resolveMapCode(raw);\n      if(!code) continue;\n      if(!grouped[code]){\n        const nm = String((s && s.map_name) || '').trim();\n        grouped[code] = {code:code, title:(mapLabel(code) || nm || raw || code), points:0, total:0, minTime:null, minTimeText:null, sample:[]};\n        order.push(code);\n      }\n      const g = grouped[code];\n      g.points += 1;\n      const cx = Number(s.x||0), cy = Number(s.y||0);\n      if(g.sample.length < 3) g.sample.push(String(cx)+','+String(cy));\n      g.total += Number(s.count||0);\n      const ttext = String((s && (s.time_text||s.timeText)) || '').trim();\n      if(ttext){\n        if(!g.minTimeText) g.minTimeText = ttext;\n      }else if(!g.minTimeText){\n        const tv = Number(s.time||0);\n        if(g.minTime == null) g.minTime = tv;\n        else if(tv > 0 && (g.minTime === 0 || tv < g.minTime)) g.minTime = tv;\n      }\n    }\n    const s3 = filterRowsByKw(order.map((code,i)=>{\n      const g = grouped[code] || {};\n      let sub = '点数 ' + Number(g.points||0);\n      if(g.sample && g.sample.length){\n        sub += ' | 坐标 ' + g.sample.join(' ') + (Number(g.points||0) > g.sample.length ? ' ...' : '');\n      }\n      if(g.code && g.title && g.title !== g.code) sub += ' | ' + g.code;\n      const right = g.minTimeText ? (String(g.minTimeText) + '/' + Number(g.total||0) + '只') : ((Number(g.minTime||0))+'分/'+Number(g.total||0)+'只');\n      return {key:g.code, badge:i+1, title:g.title||g.code, sub:sub, right:right};\n    }), STATE.kw3);\n    el('h3s').textContent = STATE.sel2 ? ('总数 ' + s3.length+' 张') : '';\n    renderList(el('l3'), s3, STATE.sel3);\n\n\n\n    if(!STATE.sel3){ el('l4').innerHTML='<div class=\"empty\">选择刷新地图后显示走法</div>'; }\n    else{\n      const chains = routeChainsToMapCached(STATE.sel3);\n      const npcDirect = directNpcRoutesToMap(STATE.sel3).map(r=>[r]);\n      if(chains && chains.length){\n        const chainsAll = mergeRouteChains(chains, npcDirect);\n        el('h4s').textContent = '总数 ' + chainsAll.length + ' 条';\n        renderRouteMethods(el('l4'), chainsAll);\n      }else{\n        const rts = mergeRouteEdges(directRoutesToMapCached(STATE.sel3), directNpcRoutesToMap(STATE.sel3));\n        el('h4s').textContent = rts.length ? (rts.length + ' 条') : '';\n        if(!rts.length){ el('l4').innerHTML='<div class=\"empty\">暂无地图走法数据</div>'; }\n        else{\n          const rows = rts.map((r,i)=>{\n            const from = String(r && r.from || '').trim();\n            const to = String(r && r.to || '').trim();\n            const fromName = String(r && (r.from_name || '') || '').trim() || mapLabel(from) || from;\n            const toName = String(r && (r.to_name || '') || '').trim() || mapLabel(to) || to;\n            const sub = routeStepText(r);\n            return {key:'in#'+from+'#'+i, badge:i+1, title:fromName||toName, sub:sub, right:resolveMapCode(from)};\n          });\n          renderList(el('l4'), rows, STATE.sel4);\n        }\n      }\n    }\n  } else if(STATE.tab==='monster'){\n    let baseMons = (IDX.monstersAll && IDX.monstersAll.length ? IDX.monstersAll : IDX.monsters);\n    if(!STATE.showAll){\n      baseMons = getMonsterNamesWithRealDrops();\n    }\n    let mons = applySortNames(filterByKw(baseMons, STATE.kw1));\n    if(STATE.sel1 && mons.indexOf(STATE.sel1) < 0){\n      STATE.sel1=''; STATE.sel2=''; STATE.sel3=''; STATE.sel4='';\n    }\n    el('h1s').textContent = '总数 ' + mons.length + ' 只';\n    renderList(el('l1'), mons.map((n,i)=>({key:n, badge:i+1, title:n})), STATE.sel1);\n    const mon = STATE.sel1 ? IDX.monByName[STATE.sel1] : null;\n    const its = getStrictRealMonsterDrops(mon).slice();\n    its.sort((a,b)=>itemOverallDen(a)-itemOverallDen(b));\n    const l2 = filterRowsByKw(its.map((it,i)=>({key:it.name, badge:i+1, title:it.name, right:(STATE.showRate ? ('1/'+itemOverallDen(it)) : '')})), STATE.kw2);\n    el('h2s').textContent = STATE.sel1 ? ('总数 ' + l2.length+' 件') : '';\n    renderList(el('l2'), l2, STATE.sel2);\n    const sp = mon && Array.isArray(mon.spawns) ? mon.spawns.slice() : [];\n    const grouped = {};\n    const order = [];\n    for(let i=0;i<sp.length;i++){\n      const s = sp[i] || {};\n      const raw = String((s && (s.map||s.map_code)) || '').trim() || String((s && (s.map_name||s.map)) || '').trim();\n      const code = resolveMapCode(raw);\n      if(!code) continue;\n      if(!grouped[code]){\n        const nm = String((s && s.map_name) || '').trim();\n        grouped[code] = {code:code, title:(mapLabel(code) || nm || raw || code), points:0, total:0, minTime:null, minTimeText:null, sample:[]};\n        order.push(code);\n      }\n      const g = grouped[code];\n      g.points += 1;\n      const cx = Number(s.x||0), cy = Number(s.y||0);\n      if(g.sample.length < 3) g.sample.push(String(cx)+','+String(cy));\n      g.total += Number(s.count||0);\n      const ttext = String((s && (s.time_text||s.timeText)) || '').trim();\n      if(ttext){\n        if(!g.minTimeText) g.minTimeText = ttext;\n      }else if(!g.minTimeText){\n        const tv = Number(s.time||0);\n        if(g.minTime == null) g.minTime = tv;\n        else if(tv > 0 && (g.minTime === 0 || tv < g.minTime)) g.minTime = tv;\n      }\n    }\n    const s3 = filterRowsByKw(order.map((code,i)=>{\n      const g = grouped[code] || {};\n      let sub = '点数 ' + Number(g.points||0);\n      if(g.sample && g.sample.length){\n        sub += ' | 坐标 ' + g.sample.join(' ') + (Number(g.points||0) > g.sample.length ? ' ...' : '');\n      }\n      if(g.code && g.title && g.title !== g.code) sub += ' | ' + g.code;\n      const right = g.minTimeText ? (String(g.minTimeText) + '/' + Number(g.total||0) + '只') : ((Number(g.minTime||0))+'分/'+Number(g.total||0)+'只');\n      return {key:g.code, badge:i+1, title:g.title||g.code, sub:sub, right:right};\n    }), STATE.kw3);\n    el('h3s').textContent = STATE.sel1 ? ('总数 ' + s3.length+' 张') : '';\n    renderList(el('l3'), s3, STATE.sel3);\n    if(!STATE.sel3){ el('l4').innerHTML='<div class=\"empty\">选择刷新地图后显示走法</div>'; }\n    else{\n      const chains = routeChainsToMapCached(STATE.sel3);\n      const npcDirect = directNpcRoutesToMap(STATE.sel3).map(r=>[r]);\n      if(chains && chains.length){\n        const chainsAll = mergeRouteChains(chains, npcDirect);\n        el('h4s').textContent = '总数 ' + chainsAll.length + ' 条';\n        renderRouteMethods(el('l4'), chainsAll);\n      }else{\n        const rts = mergeRouteEdges(directRoutesToMapCached(STATE.sel3), directNpcRoutesToMap(STATE.sel3));\n        el('h4s').textContent = rts.length ? (rts.length + ' 条') : '';\n        if(!rts.length){ el('l4').innerHTML='<div class=\"empty\">暂无地图走法数据</div>'; }\n        else{\n          const rows = rts.map((r,i)=>{\n            const from = String(r && r.from || '').trim();\n            const to = String(r && r.to || '').trim();\n            const fromName = String(r && (r.from_name || '') || '').trim() || mapLabel(from) || from;\n            const toName = String(r && (r.to_name || '') || '').trim() || mapLabel(to) || to;\n            const sub = routeStepText(r);\n            return {key:'in#'+from+'#'+i, badge:i+1, title:fromName||toName, sub:sub, right:resolveMapCode(from)};\n          });\n          renderList(el('l4'), rows, STATE.sel4);\n        }\n      }\n    }\n  } else if(STATE.tab==='map'){\n    let mapNames = IDX.maps.map(x=>x.name);\n    if(!STATE.showAll){\n      mapNames = mapNames.filter(n=>{\n        try{ return mapMonsterGroups(n).length > 0; }catch(e){ return false; }\n      });\n    }\n    let maps = applySortNames(filterByKw(mapNames, STATE.kw1));\n    el('h1s').textContent = '总数 ' + maps.length + ' 张';\n    renderList(el('l1'), maps.map((n,i)=>({key:n, badge:i+1, title:n})), STATE.sel1);\n    if(!STATE.sel1){ el('l2').innerHTML='<div class=\"empty\">选择地图后显示走法/相关信息</div>'; }\n    else{\n      const chains = routeChainsToMapCached(STATE.sel1);\n      const npcDirect = directNpcRoutesToMap(STATE.sel1).map(r=>[r]);\n      if(chains && chains.length){\n        const chainsAll = mergeRouteChains(chains, npcDirect);\n        el('h2s').textContent = '总数 ' + chainsAll.length + ' 条';\n        renderRouteMethods(el('l2'), chainsAll);\n      }else{\n        const rts = mergeRouteEdges(directRoutesToMapCached(STATE.sel1), directNpcRoutesToMap(STATE.sel1));\n        el('h2s').textContent = rts.length ? (rts.length + ' 条') : '';\n        if(!rts.length){ el('l2').innerHTML='<div class=\"empty\">暂无地图走法数据</div>'; }\n        else{\n          const rows = filterRowsByKw(rts.map((r,i)=>{\n            const from = String(r && r.from || '').trim();\n            const to = String(r && r.to || '').trim();\n            const fromName = String(r && (r.from_name || '') || '').trim() || mapLabel(from) || from;\n            const toName = String(r && (r.to_name || '') || '').trim() || mapLabel(to) || to;\n            const sub = routeStepText(r);\n            return {key:'in#'+from+'#'+i, badge:i+1, title:fromName||toName, sub:sub, right:resolveMapCode(from)};\n          }), STATE.kw2);\n          renderList(el('l2'), rows, STATE.sel2);\n        }\n      }\n    }\n    const baseMapMonsters = STATE.sel1 ? mapMonsterGroups(STATE.sel1) : [];\n    let rows3 = baseMapMonsters.slice();\n    if(!STATE.showAll){\n      const realMonSet = new Set(getMonsterNamesWithRealDrops());\n      rows3 = rows3.filter(r=>realMonSet.has(String(r && r.key || '').trim()));\n    }\n    if(STATE.sel3 && rows3.findIndex(r=>String(r && r.key || '').trim()===String(STATE.sel3||'').trim()) < 0){\n      STATE.sel3=''; STATE.sel4='';\n    }\n    const l3 = filterRowsByKw(rows3, STATE.kw3);\n    el('h3s').textContent = STATE.sel1 ? ('总数 ' + l3.length+' 只') : '';\n    renderList(el('l3'), l3, STATE.sel3);\n    if(!STATE.sel3){\n      el('h4s').textContent = '';\n      el('l4').innerHTML = '<div class=\"empty\">?????????????</div>';\n    }else{\n      const mon = getMonsterByName(STATE.sel3);\n      const its = getStrictRealMonsterDrops(mon).slice();\n      its.sort((a,b)=>itemOverallDen(a)-itemOverallDen(b));\n      const l4 = filterRowsByKw(its.map((it,i)=>({key:it.name, badge:i+1, title:it.name, right:(STATE.showRate ? ('1/'+itemOverallDen(it)) : '')})), STATE.kw4);\n      el('h4s').textContent = l4.length ? ('?? ' + l4.length+' ?') : '';\n      if(!l4.length){\n        el('l4').innerHTML = '<div class=\"empty\">?????????</div>';\n      }else{\n        renderList(el('l4'), l4, STATE.sel4);\n      }\n    }\n\n  } else if(STATE.tab==='npc'){\n    let npcs = applySortNames(filterByKw(IDX.npcs, STATE.kw1));\n    el('h1s').textContent = npcs.length ? ('总数 ' + npcs.length + ' 个') : '';\n    renderList(el('l1'), npcs.map((n,i)=>({key:n, badge:i+1, title:n})), STATE.sel1);\n\n    const locs = STATE.sel1 ? (IDX.npcByName[STATE.sel1]||[]).slice() : [];\n    const locByKey = {};\n    const s2 = filterRowsByKw(locs.map((n,i)=>{\n      const map = String((n && n.map) || '').trim() || String((n && n.map_name) || '').trim();\n      const code = resolveMapCode(map);\n      const title = mapLabel(code) || String((n && n.map_name) || '').trim() || code;\n      const x = (n && n.x != null) ? n.x : '';\n      const y = (n && n.y != null) ? n.y : '';\n      const key = code + '|' + x + '|' + y + '|' + i;\n      locByKey[key] = n;\n      let sub = (x!=='' && y!=='') ? ('坐标 ' + x + ',' + y) : '';\n      if(code && title && title !== code) sub += (sub ? ' | ' : '') + code;\n      return {key:key, badge:i+1, title:title||code, sub:sub, right:''};\n    }), STATE.kw2);\n    el('h2s').textContent = STATE.sel1 ? ('总数 ' + s2.length + ' 处') : '';\n    renderList(el('l2'), s2, STATE.sel2);\n\n    const selLoc = (STATE.sel2 && locByKey[STATE.sel2]) ? locByKey[STATE.sel2] : null;\n    const selMap = selLoc ? (String(selLoc.map||'').trim() || String(selLoc.map_name||'').trim()) : '';\n    if(!selMap){\n      el('l3').innerHTML='<div class=\"empty\">选择所在位置后显示走法</div>';\n      el('l4').innerHTML='<div class=\"empty\">选择所在位置后显示相关物品</div>';\n    }else{\n      const chains = routeChainsToMapCached(selMap);\n      const tele = selLoc && Array.isArray(selLoc.teleports) ? selLoc.teleports.slice() : [];\n      const rows = [];\n      if(chains && chains.length){\n        for(let i=0;i<chains.length;i++){\n          const p = chains[i] || [];\n          const first = (p && p.length) ? (p[0]||{}) : {};\n          const startKey = String(first._fromKey || first.from || '').trim();\n          const startName = String(first.from_name||'').trim() || mapLabel(startKey) || startKey || ('路线'+(i+1));\n          const sub = formatRouteChain(p);\n          rows.push({key:'mi#p#'+startKey+'#'+i, badge:rows.length+1, title:startName, sub:sub, right:String(p.length||0)+'段'});\n        }\n      }\n      if(tele && tele.length){\n        const fm = resolveMapCode(selMap);\n        const fmName = mapLabel(fm) || selMap;\n        const fmx = (selLoc && selLoc.x != null) ? selLoc.x : '';\n        const fmy = (selLoc && selLoc.y != null) ? selLoc.y : '';\n        const npcName = (selLoc && selLoc.npc) ? selLoc.npc : '';\n        for(let i=0;i<tele.length;i++){\n          const t = tele[i] || {};\n          const mp = String(t.map||'').trim();\n          const code = resolveMapCode(mp);\n          const title = mapLabel(code) || String(t.map_name||'').trim() || mp || code;\n          const x = (t.x != null) ? t.x : '';\n          const y = (t.y != null) ? t.y : '';\n          const rr = (t.r != null && t.r !== '') ? t.r : '';\n          const randomTo = !!(t && (t.random_to || t.randomTo));\n          let sub = formatMoveSub(fmName, fmx, fmy, title, x, y, randomTo);\n          sub += ' | NPC传送';\n          if(npcName) sub += ' [' + npcName + ']';\n          if(rr!=='') sub += ' 范围' + rr;\n          rows.push({key:'tp#'+code+'#'+i, badge:rows.length+1, title:title||code, sub:sub, right:code||mp});\n        }\n      }\n      const rows2 = filterRowsByKw(dedupeDisplayRows(rows), STATE.kw3);\n      el('h3s').textContent = rows2.length ? ('总数 ' + rows2.length + ' 条') : '';\n      if(!rows.length){ el('l3').innerHTML='<div class=\"empty\">暂无地图走法数据</div>'; }\n      else{ renderList(el('l3'), rows2, STATE.sel3); }\n\n      const take = selLoc && Array.isArray(selLoc.take) ? selLoc.take.slice() : [];\n      const give = selLoc && Array.isArray(selLoc.give) ? selLoc.give.slice() : [];\n      const items = [];\n      for(let i=0;i<take.length;i++){\n        const it = take[i] || {};\n        const nm = String(it.name||'').trim(); if(!nm) continue;\n        const cnt = Number(it.count||1) || 1;\n        items.push({key:'take#'+nm+'#'+i, badge:items.length+1, title:nm, sub:'消耗', right:'x'+cnt});\n      }\n      for(let i=0;i<give.length;i++){\n        const it = give[i] || {};\n        const nm = String(it.name||'').trim(); if(!nm) continue;\n        const cnt = Number(it.count||1) || 1;\n        items.push({key:'give#'+nm+'#'+i, badge:items.length+1, title:nm, sub:'给予', right:'x'+cnt});\n      }\n      const items2 = filterRowsByKw(items, STATE.kw4);\n      el('h4s').textContent = items2.length ? ('总数 ' + items2.length + ' 项') : '';\n      if(!items2.length){\n        el('l4').innerHTML='<div class=\"empty\">暂无相关物品</div>';\n      }else{\n        renderList(el('l4'), items2, STATE.sel4);\n      }\n    }\n  }\n  bindClicks();\n  bindAutoPageScroll();\n}\n\nfunction setVersion(q){\n  CURRENT=q||null;\n  DATA=null;\n  resetViewCache();\n  resetPages();\n  STATE.sel1=''; STATE.sel2=''; STATE.sel3=''; STATE.sel4='';\n\n  STATE.showRate = (q && q.show_rate === false) ? false : true;\n  if(!q){ el('verInfo').textContent='选择查询版本'; el('guideBtn').classList.add('disabled'); el('guideBtn').href='#'; return; }\n  el('verInfo').textContent = String(q.name||'').trim() || '已选择版本';\n  const g = String(q.guide||'').trim();\n  if(g){ el('guideBtn').href=g; el('guideBtn').classList.remove('disabled'); } else { el('guideBtn').classList.add('disabled'); el('guideBtn').href='#'; }\n}\n\nasync function loadDataFor(q, force){\n  if(!q){ DATA=null; resetViewCache(); _DETAIL_LOADED=false; _DETAIL_LOADING=null; render(); return; }\n  const file = String(q.data_file||'droprate.json').trim();\n  DATA=null;\n  resetViewCache();\n  _DETAIL_LOADED=false;\n  _DETAIL_LOADING=null;\n\n  resetPages();\n  clearAllPagers();\n  el('l1').innerHTML='<div class=\"empty\">正在加载数据...</div>'; el('l2').innerHTML=''; el('l3').innerHTML=''; el('l4').innerHTML='';\n\n  const baseUrl = './data/'+file;\n  const cacheKey = _cacheKeyForUrl(baseUrl);\n  const ts = String((q && q.data_ts) || '').trim();\n  let usedCache = false;\n  if(!force){\n    const cached = await _cacheGet(cacheKey);\n    const d0 = readCachedJsonValue(cached);\n    if(d0){\n      try{\n        DATA=d0;\n        buildIndex();\n        render();\n        usedCache = true;\n      }catch(e){}\n    }\n  }\n  const url = baseUrl + ((force || ts) ? ('?_=' + encodeURIComponent(ts || Date.now())) : '');\n  try{\n    const resp = await fetch(url, (force || ts) ? {cache:'no-store'} : {});\n    const loaded = await readRemoteJson(resp);\n    const d = loaded && loaded.data ? loaded.data : null;\n    DATA=d;\n    buildIndex();\n    render();\n    if(!force && loaded && loaded.cacheValue){\n      try{ await _cacheSet(cacheKey, loaded.cacheValue); }catch(e){}\n    }\n  }catch(e){\n\n    if(!usedCache){\n      DATA=null;\n      el('l1').innerHTML='<div class=\"empty\">未找到数据文件：'+esc(file)+'</div>';\n    }\n  }\n}\n\nlet _DETAIL_LOADED=false;\nlet _DETAIL_LOADING=null;\nasync function _ensureDetailLoaded(force){\n  if(_DETAIL_LOADED) return true;\n  if(_DETAIL_LOADING) return await _DETAIL_LOADING;\n  const file0 = (CURRENT && CURRENT.data_file) ? String(CURRENT.data_file||'').trim() : '';\n  const df = (DATA && DATA.detail_file) ? String(DATA.detail_file||'').trim() : '';\n  const detailFile = df || (file0 && file0.toLowerCase().endsWith('.json') ? (file0.slice(0,-5) + '_detail.json') : (file0 ? (file0 + '_detail.json') : ''));\n  if(!detailFile) return false;\n  const baseUrl = './data/' + detailFile;\n  const cacheKey = _cacheKeyForUrl(baseUrl);\n  const ts = String((CURRENT && CURRENT.data_ts) || '').trim();\n  let usedCache = false;\n  if(!force){\n    const cached = await _cacheGet(cacheKey);\n    const d0 = readCachedJsonValue(cached);\n    if(d0 && d0.monster_items && typeof d0.monster_items === 'object'){\n      try{\n        Object.keys(d0.monster_items).forEach(k=>{\n          const mon = IDX.monByName[k];\n          if(mon && !Array.isArray(mon.items)){\n            mon.items = d0.monster_items[k];\n          }\n        });\n        _DETAIL_LOADED = true;\n        usedCache = true;\n      }catch(e){}\n    }\n  }\n  _DETAIL_LOADING = (async function(){\n    try{\n      const url = baseUrl + (ts ? ('?_=' + encodeURIComponent(ts)) : ('?_=' + Date.now()));\n      const resp = await fetch(url, {cache:'no-store'});\n      const loaded = await readRemoteJson(resp);\n      const d = loaded && loaded.data ? loaded.data : null;\n      if(d && d.monster_items && typeof d.monster_items === 'object'){\n        Object.keys(d.monster_items).forEach(k=>{\n          const mon = IDX.monByName[k];\n          if(mon){\n            mon.items = d.monster_items[k];\n          }\n        });\n        _DETAIL_LOADED = true;\n        if(loaded && loaded.cacheValue){\n          try{ await _cacheSet(cacheKey, loaded.cacheValue); }catch(e){}\n        }\n        return true;\n      }\n    }catch(e){\n\n      if(usedCache) return true;\n    }finally{\n      _DETAIL_LOADING = null;\n    }\n    return false;\n  })();\n  return await _DETAIL_LOADING;\n}\n\nfunction renderHome(){\n  const wrap=el('cards');\n  const qs = (SITE && Array.isArray(SITE.drop_queries)) ? SITE.drop_queries.filter(x=>x && x.id) : [];\n  if(SITE && SITE.drop_enabled === false){ el('homeEmpty').style.display='block'; el('homeEmpty').textContent='当前站点暂未开启爆率查询，请先查看官网公告或联系玩家社群。'; wrap.innerHTML=''; return; }\n\n  if(!qs.length){ el('homeEmpty').style.display='block'; el('homeEmpty').textContent='未配置任何版本，请先在工具箱里添加爆率查询版本'; wrap.innerHTML=''; return; }\n  el('homeEmpty').style.display='none';\n\n  const versionDownloadByName = {};\n  try{\n    if(SITE && Array.isArray(SITE.versions)){\n      SITE.versions.forEach(v=>{\n        const nm = String(v && v.name || '').trim();\n        let dl = String(v && v.download_url || '').trim();\n        if(!nm || !dl || versionDownloadByName[nm]) return;\n        try{\n          if(/^\\/\\//.test(dl)) dl = 'http:' + dl;\n          if(!/^https?:\\/\\//i.test(dl) && !/^[./#]/.test(dl) && !/^[a-zA-Z]:[\\\\/]/.test(dl)){\n            if(/^localhost(?::\\d+)?(\\/.*)?$/i.test(dl) || /^[\\w.-]+\\.[a-zA-Z]{2,}(?::\\d+)?(\\/.*)?$/.test(dl)){\n              dl = 'http://' + dl;\n            }\n          }\n        }catch(e0){}\n        versionDownloadByName[nm] = dl;\n      });\n    }\n  }catch(e1){}\n\n  const selectById = function(id){\n\n    id = String(id || '').trim();\n    if(!id) return;\n    const qsList = (SITE && Array.isArray(SITE.drop_queries)) ? SITE.drop_queries.filter(x=>x && x.id) : [];\n    const q = qsList.find(x=>String(x.id||'')===id) || null;\n    if(!q) return;\n    try{ el('verSel').value = id; }catch(e){}\n    try{\n      if(history && history.replaceState){\n        history.replaceState(null, '', './droprate.html?v=' + encodeURIComponent(id));\n      }\n    }catch(e2){}\n    setVersion(q);\n    STATE.tab='item';\n    setTabActive('item');\n    setView('main');\n    loadDataFor(q);\n  };\n\n  if(STATE.mode === 'lite'){\n    try{ el('homeLite').style.display='block'; }catch(e){}\n    try{ wrap.style.display='none'; }catch(e2){}\n    const kw = String(STATE.homeKw || '').trim().toLowerCase();\n    let out = qs.slice();\n    if(kw){\n      out = out.filter(q=>{\n        const nm = String(q && q.name || '').trim().toLowerCase();\n        const tp = String(q && q.type || '').trim().toLowerCase();\n        const intro = String(q && q.intro || '').trim().toLowerCase();\n        return nm.indexOf(kw) >= 0 || tp.indexOf(kw) >= 0 || intro.indexOf(kw) >= 0;\n      });\n    }\n    if(STATE.sort === 'name'){\n      out = out.slice().sort((a,b)=>String(a && a.name || '').localeCompare(String(b && b.name || ''), 'zh'));\n    }\n    let html = '';\n    out.forEach(q=>{\n      const vid = String(q && q.id || '');\n      const nm = String(q && q.name || '').trim() || vid;\n      html += '<button class=\"tagBtn\" type=\"button\" data-id=\"'+esc(vid)+'\">'+esc(nm)+'</button>';\n    });\n    el('homeTags').innerHTML = html || '<div class=\"empty\">暂无匹配版本</div>';\n    try{\n      el('homeTags').querySelectorAll('[data-id]').forEach(btn=>{\n        btn.onclick = function(){ selectById(this.getAttribute('data-id')); };\n      });\n    }catch(e3){}\n    return;\n  }\n\n  try{ el('homeLite').style.display='none'; }catch(e4){}\n  try{ wrap.style.display='grid'; }catch(e5){}\n  let out = qs.slice();\n  if(STATE.sort === 'name'){\n    out = out.slice().sort((a,b)=>String(a && a.name || '').localeCompare(String(b && b.name || ''), 'zh'));\n  }\n  let html='';\n  out.forEach(q=>{\n    const img = String(q.image||'').trim();\n    const intro = String(q.intro||'').trim();\n    const vid = String(q.id||'');\n    const go = '?v='+encodeURIComponent(vid);\n    const downloadUrl = String(versionDownloadByName[String(q.name||'').trim()] || '').trim();\n    html += '<div class=\"card\">';\n    if(img){ html += '<div class=\"cardImg\"><img src=\"'+esc(img)+'\" alt=\"\"/></div>'; }\n    else{ html += '<div class=\"cardImg\">'+esc(String(q.type||'版本'))+'</div>'; }\n    html += '<div class=\"cardB\">';\n    html += '<div class=\"cardT\">'+esc(String(q.name||'未命名'))+'</div>';\n    html += '<div class=\"cardD\">'+esc(intro || ' ')+'</div>';\n    html += '<div class=\"cardA\">';\n    if(downloadUrl){ html += '<a class=\"btn ghost\" href=\"'+esc(downloadUrl)+'\" target=\"_blank\" rel=\"noopener\">版本下载</a>'; }\n    html += '<a class=\"btn primary\" href=\"'+esc(go)+'\">进入查询</a>';\n    html += '</div></div></div>';\n  });\n\n  wrap.innerHTML=html;\n\n  try{\n    wrap.querySelectorAll('[data-act=\"select\"]').forEach(btn=>{\n      btn.onclick = function(){ selectById(this.getAttribute('data-id')); };\n    });\n  }catch(e6){}\n}\n\nfunction initNav(){\n  document.querySelectorAll('.navBtn').forEach(b=>{\n    b.onclick=function(){\n      const tab=this.getAttribute('data-tab');\n      if(tab==='home'){\n        STATE.tab='home';\n        resetPages();\n        setTabActive('home');\n        setView('home');\n\n        try{\n          if(history && history.replaceState){\n            history.replaceState(null, '', './droprate.html');\n          }\n        }catch(e){}\n        renderHome();\n        return;\n      }\n      if(!CURRENT){\n        STATE.tab='home';\n        resetPages();\n        setTabActive('home');\n        setView('home');\n\n        renderHome();\n        return;\n      }\n      STATE.tab=tab;\n      resetPages();\n      setTabActive(tab);\n      setView('main');\n\n      if((tab==='monster' || tab==='map') && !_DETAIL_LOADED){\n        clearAllPagers();\n        el('l2').innerHTML='<div class=\"empty\">正在加载怪物掉落明细...</div>';\n        el('l3').innerHTML=''; el('l4').innerHTML='';\n\n        _ensureDetailLoaded(false).then(()=>{ try{ render(); }catch(e){} });\n        return;\n      }\n      render();\n    };\n  });\n}\n\nfunction initTool(){\n  function _applyModeButtons(){\n    try{\n      el('modeStd').classList.toggle('active', STATE.mode === 'std');\n      el('modeLite').classList.toggle('active', STATE.mode === 'lite');\n    }catch(e){}\n    try{ el('verSel').style.display = ''; }catch(e2){}\n  }\n\n  function _refreshVersionLabels(){\n    try{\n      const qs = (SITE && Array.isArray(SITE.drop_queries)) ? SITE.drop_queries.filter(x=>x && x.id) : [];\n      const byId = {};\n      qs.forEach(q=>{ byId[String(q && q.id || '')] = q; });\n      const cur = String(el('verSel').value || '').trim();\n      el('verSel').querySelectorAll('option').forEach(o=>{\n        const id = String(o.value || '').trim();\n        if(!id) return;\n        const q = byId[id] || null;\n        if(!q) return;\n        if(STATE.mode === 'lite'){\n          o.textContent = String(q.name||'').trim() || id;\n        }else{\n          o.textContent = String(q.name||'') + (q.type ? (' - '+String(q.type||'')) : '');\n        }\n      });\n      try{ el('verSel').value = cur; }catch(e2){}\n    }catch(e){}\n  }\n\n  try{\n    el('modeStd').onclick=function(ev){\n      try{ if(ev){ ev.preventDefault(); ev.stopPropagation(); } }catch(e){}\n      STATE.mode='std';\n      _applyModeButtons();\n      _refreshVersionLabels();\n      STATE.tab = 'home';\n      try{ el('verSel').value = ''; }catch(e2){}\n      resetPages();\n      setTabActive('home');\n      setView('home');\n      try{\n        if(history && history.replaceState){\n          history.replaceState(null, '', './droprate.html');\n        }\n      }catch(e3){}\n      renderHome();\n    };\n\n    el('modeLite').onclick=function(ev){\n      try{ if(ev){ ev.preventDefault(); ev.stopPropagation(); } }catch(e){}\n      STATE.mode='lite';\n      _applyModeButtons();\n      _refreshVersionLabels();\n      STATE.tab = 'home';\n      try{ el('verSel').value = ''; }catch(e2){}\n      resetPages();\n      setTabActive('home');\n      setView('home');\n      try{\n        if(history && history.replaceState){\n          history.replaceState(null, '', './droprate.html');\n        }\n      }catch(e3){}\n      renderHome();\n    };\n\n  }catch(e){}\n  _applyModeButtons();\n\n  function _bindKw(id, key){\n    try{\n      const node = el(id);\n      if(!node) return;\n      const listId = 'l' + String(id || '').replace('ckw', '');\n      node.oninput=function(){ STATE[key]=this.value||''; PAGE_STATE[listId]=1; if(STATE.tab!=='home') scheduleRender(); };\n    }catch(e){}\n  }\n\n  _bindKw('ckw1','kw1');\n  _bindKw('ckw2','kw2');\n  _bindKw('ckw3','kw3');\n  _bindKw('ckw4','kw4');\n\n  el('showAll').onchange=function(){ STATE.showAll=!!this.checked; resetPages(); render(); };\n  try{\n    el('sortSel').onchange=function(){ STATE.sort=String(this.value||'default'); resetPages(); if(STATE.tab==='home') renderHome(); else render(); };\n\n  }catch(e){}\n  try{\n    el('homeKw').oninput=function(){ STATE.homeKw = this.value || ''; if(STATE.tab==='home') renderHome(); };\n  }catch(e3){}\n  try{\n    el('helpBtn').onclick=function(){\n      alert('使用说明\\n\\n1) 先选择查询版本进入查询\\n2) 精简模式：版本选择以名称按钮形式显示\\n3) 排序可按名称/爆率排序（物品列表支持爆率排序）\\n4) 四列顶部输入框可过滤列表');\n    };\n  }catch(e){}\n}\n\nfunction initVersionSelector(){\n  const sel=el('verSel');\n  sel.innerHTML='';\n  const qs = (SITE && Array.isArray(SITE.drop_queries)) ? SITE.drop_queries.filter(x=>x && x.id) : [];\n  const opt0=document.createElement('option');\n  opt0.value='';\n  opt0.textContent='选择查询版本';\n  sel.appendChild(opt0);\n  qs.forEach(q=>{\n    const o=document.createElement('option');\n    o.value=String(q.id||'');\n    o.textContent = (STATE.mode === 'lite') ? (String(q.name||'').trim() || String(q.id||'')) : (String(q.name||'') + (q.type ? (' - '+String(q.type||'')) : ''));\n    sel.appendChild(o);\n  });\n  sel.onchange=function(){\n    const id=String(sel.value||'').trim();\n    if(!id){\n      CURRENT = null;\n      STATE.tab='home';\n      resetPages();\n      setTabActive('home');\n      setView('home');\n\n      try{\n        if(history && history.replaceState){\n          history.replaceState(null, '', './droprate.html');\n        }\n      }catch(e){}\n      renderHome();\n      return;\n    }\n    const q = qs.find(x=>String(x && x.id || '') === id) || null;\n    if(!q) return;\n    try{\n      if(history && history.replaceState){\n        history.replaceState(null, '', './droprate.html?v=' + encodeURIComponent(id));\n      }\n    }catch(e2){}\n    setVersion(q);\n    STATE.tab='item';\n    setTabActive('item');\n    setView('main');\n    loadDataFor(q);\n  };\n}\n\n/* 将站点标题、页脚与头部品牌同步为当前站点信息。 */\nfunction applySiteIdentity(site){\n  const tt = String((site && (site.title || site.name)) || '').trim();\n  if(!tt) return;\n  document.title = tt + ' - 爆率查询';\n  el('siteTitle').textContent = tt + ' · 爆率情报';\n  el('footTxt').textContent = '玛法情报中心 - ' + tt;\n  try{ el('hdrName').textContent = tt; }catch(e){}\n}\n\n/* 根据后台开关同步爆率查询页状态，避免显示可见但不可用的入口。 */\nfunction syncDropUiState(){\n  const disabled = !!(SITE && SITE.drop_enabled === false);\n  ['item','monster','map','npc'].forEach(tab=>{\n    try{\n      const btn = document.querySelector('.navBtn[data-tab=\"' + tab + '\"]');\n      if(btn) btn.classList.toggle('disabled', disabled);\n    }catch(e){}\n  });\n  try{ el('verSel').disabled = disabled; }catch(e){}\n  try{\n    if(disabled){\n      el('verInfo').textContent = '爆率查询暂未开放';\n      el('guideBtn').classList.add('disabled');\n      el('guideBtn').href = '#';\n    }\n  }catch(e){}\n}\n\n/* 优先使用构建阶段内联的站点数据，失败时再回退到远程读取，提高首屏速度与稳定性。 */\nasync function bootstrapSite(){\n  let s = null;\n  try{\n    if(window.__SITE_INLINE__ && typeof window.__SITE_INLINE__ === 'object') s = window.__SITE_INLINE__;\n  }catch(e){}\n  try{\n    const resp = await fetch('./data/site.json?_=' + Date.now(), {cache:'no-store'});\n    s = await resp.json();\n  }catch(e){\n    if(!s || typeof s !== 'object' || !Object.keys(s).length){\n      throw e;\n    }\n  }\n  SITE = s || {};\n  applySiteIdentity(SITE);\n  initNav();\n  initTool();\n  if(SITE && SITE.drop_reverse){\n    STATE.sort = 'rate';\n    try{ el('sortSel').value = 'rate'; }catch(e){}\n  }\n  syncDropUiState();\n  initVersionSelector();\n\n  if(SITE && SITE.drop_enabled === false){\n    STATE.tab='home';\n    setTabActive('home');\n    setView('home');\n    renderHome();\n    return;\n  }\n\n  const params=qsp();\n  const qsList = (SITE && Array.isArray(SITE.drop_queries)) ? SITE.drop_queries.filter(x=>x && x.id) : [];\n  const vid = String(params.v||'').trim();\n  if(!vid){\n    STATE.tab='home';\n    setTabActive('home');\n    setView('home');\n    renderHome();\n    return;\n  }\n  const q = qsList.find(x=>String(x.id||'')===vid) || qsList[0] || null;\n  if(q){\n    el('verSel').value = String(q.id||'');\n    setVersion(q);\n    STATE.tab='item';\n    setTabActive('item');\n    setView('main');\n    loadDataFor(q);\n  }else{\n    STATE.tab='home';\n    setTabActive('home');\n    setView('home');\n    renderHome();\n  }\n}\n\nbootstrapSite().catch(()=>{\n  el('viewHome').style.display='block';\n  el('cards').innerHTML='<div class=\"empty\">未找到 site.json</div>';\n});\n\n</script>\n</body></html>";
global.__STORE_TEMPLATE = "[@咕咕鸡过滤]\r\n{\r\n#IF\r\n#ACT\r\nMOV S$用户数据存储地址 ..\\..\\..\\..\\通区文件\\<$SERVERNAME>\\<$USERID>_<$USERNAME>.ini\r\nMOV S$本地物品数据存储地址 ..\\QuestDiary\\ggjfl\\\r\nMOV S$仓库索引文件 ..\\..\\..\\..\\通区文件\\<$SERVERNAME>\\仓库索引_<$USERID>_<$USERNAME>.txt\r\nMOV S$仓库数量文件 ..\\..\\..\\..\\通区文件\\<$SERVERNAME>\\仓库数量_<$USERID>_<$USERNAME>.txt\r\nMOV S$物品数据存储地址 ..\\..\\..\\..\\通区文件\\<$SERVERNAME>\\物品数据\\\r\nMOV S$地图数据存储地址 ..\\..\\..\\..\\通区文件\\<$SERVERNAME>\\地图数据\\\r\nMOV N$背包存储_定时开关 0\r\nReadConfigFileItem S$用户数据存储地址 咕咕鸡过滤 背包存储定时 N$背包存储_定时开关\r\n#IF\r\nEQUAL N$背包存储_定时开关 0\r\n#ACT\r\nMOV S$背包存储_定时状态 关\r\nMOV S$背包存储_定时勾选 [X]\r\n#IF\r\nEQUAL N$背包存储_定时开关 1\r\n#ACT\r\nMOV S$背包存储_定时状态 开\r\nMOV S$背包存储_定时勾选 [√]\r\n\r\n#IF\r\nEQUAL S$上次列表缓存Key \"\"\r\n#ACT\r\nMOV L$列表缓存 []\r\nMOV N$列表缓存数量 0\r\n\r\n\r\n#IF\r\nEQUAL S$当前操作模式 \"\"\r\n#ACT\r\nMOV S$当前操作模式 过滤设置\r\n\r\n#IF\r\nEQUAL S$当前浏览分类 \"\"\r\n#ACT\r\nMOV S$当前浏览分类 武器\r\n\r\n#IF\r\nEQUAL N$当前页码 0\r\n#ACT\r\nMOV N$当前页码 1\r\n\r\n#IF\r\n#ACT\r\nGOTO @开始构建列表界面\r\nBREAK\r\n\r\n[@开始构建列表界面]\r\n#IF\r\n#ACT\r\n#IF\r\nNOT EQUAL S$当前浏览分类 所有物品\r\n#ACT\r\nMOV S$搜索关键字 \"\"\r\nMOV S$UI搜索关键字 \"\"\r\n\r\n#IF\r\n#ACT\r\nMOV N$默认武器类型 18\r\nMOV N$默认衣服类型 21\r\nMOV N$默认头盔类型 24\r\nMOV N$默认手镯类型 27\r\nMOV N$默认戒指类型 30\r\nMOV N$默认项链类型 33\r\nMOV N$默认勋章类型 36\r\nMOV N$默认腰带类型 39\r\nMOV N$默认靴子类型 42\r\nMOV N$默认斗笠类型 45\r\nMOV N$默认盾牌类型 48\r\nMOV N$默认宝石类型 51\r\nMOV N$默认时装类型 54\r\nMOV N$默认毒符类型 57\r\nMOV N$默认军鼓类型 60\r\nMOV N$默认马牌类型 63\r\nMOV N$默认生肖类型 66\r\nMOV N$默认灵玉类型 75\r\nMOV N$默认特殊类型 69\r\nMOV N$默认其它类型 72\r\n\r\nMOV N$默认过滤类型 78\r\nMOV N$默认存储类型 81\r\nMOV N$默认仓库类型 84\r\n\r\nGOTO @设置分类状态\r\n\r\n[@设置分类状态]\r\n#IF\r\nEQUAL S$当前浏览分类 武器\r\n#ACT\r\nMOV N$默认武器类型 20\r\nGOTO @虾米设置模式状态\r\n\r\n#IF\r\nEQUAL S$当前浏览分类 衣服\r\n#ACT\r\nMOV N$默认衣服类型 23\r\nGOTO @虾米设置模式状态\r\n\r\n#IF\r\nEQUAL S$当前浏览分类 头盔\r\n#ACT\r\nMOV N$默认头盔类型 26\r\nGOTO @虾米设置模式状态\r\n\r\n#IF\r\nEQUAL S$当前浏览分类 手镯\r\n#ACT\r\nMOV N$默认手镯类型 29\r\nGOTO @虾米设置模式状态\r\n\r\n#IF\r\nEQUAL S$当前浏览分类 戒指\r\n#ACT\r\nMOV N$默认戒指类型 32\r\nGOTO @虾米设置模式状态\r\n\r\n#IF\r\nEQUAL S$当前浏览分类 项链\r\n#ACT\r\nMOV N$默认项链类型 35\r\nGOTO @虾米设置模式状态\r\n\r\n#IF\r\nEQUAL S$当前浏览分类 勋章\r\n#ACT\r\nMOV N$默认勋章类型 38\r\nGOTO @虾米设置模式状态\r\n\r\n#IF\r\nEQUAL S$当前浏览分类 腰带\r\n#ACT\r\nMOV N$默认腰带类型 41\r\nGOTO @虾米设置模式状态\r\n\r\n#IF\r\nEQUAL S$当前浏览分类 靴子\r\n#ACT\r\nMOV N$默认靴子类型 44\r\nGOTO @虾米设置模式状态\r\n\r\n#IF\r\nEQUAL S$当前浏览分类 斗笠\r\n#ACT\r\nMOV N$默认斗笠类型 47\r\nGOTO @虾米设置模式状态\r\n\r\n#IF\r\nEQUAL S$当前浏览分类 盾牌\r\n#ACT\r\nMOV N$默认盾牌类型 50\r\nGOTO @虾米设置模式状态\r\n\r\n#IF\r\nEQUAL S$当前浏览分类 宝石\r\n#ACT\r\nMOV N$默认宝石类型 53\r\nGOTO @虾米设置模式状态\r\n\r\n#IF\r\nEQUAL S$当前浏览分类 时装\r\n#ACT\r\nMOV N$默认时装类型 56\r\nGOTO @虾米设置模式状态\r\n\r\n#IF\r\nEQUAL S$当前浏览分类 毒符\r\n#ACT\r\nMOV N$默认毒符类型 59\r\nGOTO @虾米设置模式状态\r\n\r\n#IF\r\nEQUAL S$当前浏览分类 军鼓\r\n#ACT\r\nMOV N$默认军鼓类型 62\r\nGOTO @虾米设置模式状态\r\n\r\n#IF\r\nEQUAL S$当前浏览分类 马牌\r\n#ACT\r\nMOV N$默认马牌类型 65\r\nGOTO @虾米设置模式状态\r\n\r\n#IF\r\nEQUAL S$当前浏览分类 生肖\r\n#ACT\r\nMOV N$默认生肖类型 68\r\nGOTO @虾米设置模式状态\r\n\r\n#IF\r\nEQUAL S$当前浏览分类 灵玉\r\n#ACT\r\nMOV N$默认灵玉类型 77\r\nGOTO @虾米设置模式状态\r\n\r\n#IF\r\nEQUAL S$当前浏览分类 特殊\r\n#ACT\r\nMOV N$默认特殊类型 71\r\nGOTO @虾米设置模式状态\r\n\r\n#IF\r\nEQUAL S$当前浏览分类 其它\r\n#ACT\r\nMOV N$默认其它类型 74\r\nGOTO @虾米设置模式状态\r\n\r\n#IF\r\n#ACT\r\nGOTO @虾米设置模式状态\r\n\r\n[@虾米设置模式状态]\r\n#IF\r\nEQUAL S$当前操作模式 过滤设置\r\n#ACT\r\nMOV N$默认过滤类型 80\r\nGOTO @准备构建列表\r\n\r\n#IF\r\nEQUAL S$当前操作模式 存储设置\r\n#ACT\r\nMOV N$默认存储类型 83\r\nGOTO @准备构建列表\r\n\r\n#IF\r\nEQUAL S$当前操作模式 仓库取物\r\n#ACT\r\nMOV N$默认仓库类型 86\r\nGOTO @准备构建列表\r\n\r\n#IF\r\n#ACT\r\nGOTO @准备构建列表\r\n\r\n[@准备构建列表]\r\n#IF\r\n#ACT\r\nMOV N$防止死循环计数 0\r\nMOV S$列表显示内容 \"\"\r\nMOV S$当前页已显示列表 \"\"\r\nMOV N$每页条数 18\r\nMOV N$开始行 <$STR(N$当前页码)>\r\nDEC N$开始行 1\r\nMUL N$开始行 <$STR(N$每页条数)>\r\nMOV N$当前循环行 <$STR(N$开始行)>\r\nMOV S$读取文件路径 <$str(S$本地物品数据存储地址)><$STR(S$当前浏览分类)>分类.txt\r\n\r\n#IF\r\nEQUAL S$当前操作模式 仓库取物\r\n#ACT\r\nMOV S$当前浏览分类 所有物品\r\nMOV S$读取文件路径 <$str(S$仓库索引文件)>\r\nMOV N$当前循环行 0\r\nMOV N$需要跳过数量 <$STR(N$开始行)>\r\nMOV N$已跳过数量 0\r\nMOV S$分类菜单显示 \"\"\r\n\r\n#IF\r\nNOT EQUAL S$搜索关键字 \"\"\r\n#ACT\r\nMOV N$当前循环行 0\r\nMOV N$需要跳过数量 <$STR(N$开始行)>\r\nMOV N$已跳过数量 0\r\n\r\n#IF\r\nNOT EQUAL S$当前操作模式 仓库取物\r\n#ACT\r\nMOV S$分类菜单显示 <&ImgEx:#B2~#L3:\r\nINC S$分类菜单显示 <$STR(N$虾米资源编号)>:<$str(N$默认武器类型)>:19:20:0:0/@虾米加载类型(武器)>\r\nINC S$分类菜单显示 <&ImgEx:#B2~#L4:\r\nINC S$分类菜单显示 <$STR(N$虾米资源编号)>:<$str(N$默认衣服类型)>:22:23:90:0/@虾米加载类型(衣服)>\r\nINC S$分类菜单显示 <&ImgEx:#B2~#L6:\r\nINC S$分类菜单显示 <$STR(N$虾米资源编号)>:<$str(N$默认头盔类型)>:25:26:90:40/@虾米加载类型(头盔)>\r\nINC S$分类菜单显示 <&ImgEx:#B2~#L7:\r\nINC S$分类菜单显示 <$STR(N$虾米资源编号)>:<$str(N$默认手镯类型)>:28:29:0:40/@虾米加载类型(手镯)>\r\nINC S$分类菜单显示 <&ImgEx:#B2~#L8:\r\nINC S$分类菜单显示 <$STR(N$虾米资源编号)>:<$str(N$默认戒指类型)>:31:32:90:80/@虾米加载类型(戒指)>\r\nINC S$分类菜单显示 <&ImgEx:#B2~#L9:\r\nINC S$分类菜单显示 <$STR(N$虾米资源编号)>:<$str(N$默认项链类型)>:34:35:0:80/@虾米加载类型(项链)>\r\nINC S$分类菜单显示 <&ImgEx:#B2~#L10:\r\nINC S$分类菜单显示 <$STR(N$虾米资源编号)>:<$str(N$默认勋章类型)>:37:38:90:120/@虾米加载类型(勋章)>\r\nINC S$分类菜单显示 <&ImgEx:#B2~#L11:\r\nINC S$分类菜单显示 <$STR(N$虾米资源编号)>:<$str(N$默认腰带类型)>:40:41:0:120/@虾米加载类型(腰带)>\r\nINC S$分类菜单显示 <&ImgEx:#B2~#L12:\r\nINC S$分类菜单显示 <$STR(N$虾米资源编号)>:<$str(N$默认靴子类型)>:43:44:90:160/@虾米加载类型(靴子)>\r\nINC S$分类菜单显示 <&ImgEx:#B2~#L13:\r\nINC S$分类菜单显示 <$STR(N$虾米资源编号)>:<$str(N$默认斗笠类型)>:46:47:0:160/@虾米加载类型(斗笠)>\r\nINC S$分类菜单显示 <&ImgEx:#B2~#L14:\r\nINC S$分类菜单显示 <$STR(N$虾米资源编号)>:<$str(N$默认盾牌类型)>:49:50:90:200/@虾米加载类型(盾牌)>\r\nINC S$分类菜单显示 <&ImgEx:#B2~#L15:\r\nINC S$分类菜单显示 <$STR(N$虾米资源编号)>:<$str(N$默认宝石类型)>:52:53:0:200/@虾米加载类型(宝石)>\r\nINC S$分类菜单显示 <&ImgEx:#B2~#L19:\r\nINC S$分类菜单显示 <$STR(N$虾米资源编号)>:<$str(N$默认时装类型)>:55:56:90:240/@虾米加载类型(时装)>\r\nINC S$分类菜单显示 <&ImgEx:#B2~#L17:\r\nINC S$分类菜单显示 <$STR(N$虾米资源编号)>:<$str(N$默认毒符类型)>:58:59:0:240/@虾米加载类型(毒符)>\r\nINC S$分类菜单显示 <&ImgEx:#B2~#L18:\r\nINC S$分类菜单显示 <$STR(N$虾米资源编号)>:<$str(N$默认军鼓类型)>:61:62:90:280/@虾米加载类型(军鼓)>\r\nINC S$分类菜单显示 <&ImgEx:#B2~#L16:\r\nINC S$分类菜单显示 <$STR(N$虾米资源编号)>:<$str(N$默认马牌类型)>:64:65:0:280/@虾米加载类型(马牌)>\r\nINC S$分类菜单显示 <&ImgEx:#B2~#L20:\r\nINC S$分类菜单显示 <$STR(N$虾米资源编号)>:<$str(N$默认生肖类型)>:67:68:90:320/@虾米加载类型(生肖)>\r\nINC S$分类菜单显示 <&ImgEx:#B2~#L21:\r\nINC S$分类菜单显示 <$STR(N$虾米资源编号)>:<$str(N$默认灵玉类型)>:76:77:0:320/@虾米加载类型(灵玉)>\r\nINC S$分类菜单显示 <&ImgEx:#B2~#L22:\r\nINC S$分类菜单显示 <$STR(N$虾米资源编号)>:<$str(N$默认特殊类型)>:70:71:90:360/@虾米加载类型(特殊)>\r\nINC S$分类菜单显示 <&ImgEx:#B2~#L22:\r\nINC S$分类菜单显示 <$STR(N$虾米资源编号)>:<$str(N$默认其它类型)>:73:74:0:360/@虾米加载类型(其它)>\r\n\r\n#IF\r\n#ACT\r\nINC S$列表显示内容 <Layout:#L1~#L1_Content:0:5:582:310>\r\nMOV N$行数 0\r\nMOV N$列数 1\r\nMOV N$物品坐标X 5\r\nMOV N$TEXT坐标X 60\r\nMOV N$Img坐标X 60\r\nMOV N$物品坐标Y 5\r\nMOV N$TEXT坐标Y 32\r\nMOV N$Img坐标Y 32\r\nMOV N$TEXT2坐标X 66\r\nMOV N$TEXT2坐标Y 32\r\n\r\n#IF\r\nEQUAL S$当前浏览分类 所有物品\r\n#ACT\r\nMOV S$读取文件路径 <$str(S$本地物品数据存储地址)>所有物品.txt\r\n\r\n#IF\r\nEQUAL S$当前浏览分类 所有物品\r\nNOT EQUAL S$UI搜索关键字 \"\"\r\n#ACT\r\nMOV S$读取文件路径 ..\\QuestDiary\\ggjfl\\SearchCache_<$USERID>.txt\r\n\r\n#IF\r\nEQUAL S$当前操作模式 仓库取物\r\n#ACT\r\nMOV S$读取文件路径 <$str(S$仓库索引文件)>\r\n\r\n#IF\r\nEQUAL S$当前操作模式 仓库取物\r\n#ACT\r\nMOV N$仓库文件行数 0\r\nGetTextLineCount <$STR(S$读取文件路径)> N$仓库文件行数\r\n\r\n#IF\r\nEQUAL S$当前操作模式 仓库取物\r\n#ACT\r\nMOV N$总物品数量 <$STR(N$仓库文件行数)>\r\n\r\n#IF\r\nNOT EQUAL S$当前操作模式 仓库取物\r\nEQUAL S$UI搜索关键字 \"\"\r\n#ACT\r\nMOV N$总物品数量 0\r\nReadConfigFileItem ..\\QuestDiary\\ggjfl\\LineCounts.ini Counts <$STR(S$当前浏览分类)> S$临时行数\r\nMOV N$总物品数量 <$STR(S$临时行数)>\r\n\r\n#IF\r\nNOT EQUAL S$当前操作模式 仓库取物\r\nNOT EQUAL S$UI搜索关键字 \"\"\r\n#ACT\r\nGetTextLineCount <$STR(S$读取文件路径)> N$总物品数量\r\n\r\n#IF\r\nNOT EQUAL S$当前操作模式 仓库取物\r\nEQUAL S$UI搜索关键字 \"\"\r\nEQUAL N$总物品数量 0\r\n#ACT\r\nGetTextLineCount <$STR(S$读取文件路径)> N$总物品数量\r\nWriteConfigFileItem ..\\QuestDiary\\ggjfl\\LineCounts.ini Counts <$STR(S$当前浏览分类)> <$STR(N$总物品数量)>\r\n\r\n#IF\r\n#ACT\r\nMOV N$启用列表缓存 0\r\n\r\n#IF\r\nNOT EQUAL S$搜索关键字 \"\"\r\n#ACT\r\nMOV N$启用列表缓存 1\r\n\r\n#IF\r\nEQUAL S$当前操作模式 仓库取物\r\n#ACT\r\nMOV N$启用列表缓存 0\r\n\r\n#IF\r\nEQUAL N$启用列表缓存 1\r\n#ACT\r\nGOTO @检查并构建列表缓存\r\nBREAK\r\n\r\n#IF\r\n#ACT\r\nMOV S$显示数量 (共<$STR(N$总物品数量)>件)\r\nMOV N$循环计数器 0\r\nGOTO @虾米循环读取行\r\n\r\n[@检查并构建列表缓存]\r\n#IF\r\n#ACT\r\n#IF\r\nEQUAL S$当前操作模式 仓库取物\r\n#ACT\r\nMOV S$列表缓存Key <$STR(S$当前操作模式)>|<$STR(S$当前浏览分类)>|<$STR(S$搜索关键字)>|<$STR(S$读取文件路径)>|<$STR(N$总物品数量)>\r\n\r\n#IF\r\nNOT EQUAL S$当前操作模式 仓库取物\r\n#ACT\r\nMOV S$列表缓存Key <$STR(S$当前操作模式)>|<$STR(S$当前浏览分类)>|<$STR(S$搜索关键字)>|<$STR(S$读取文件路径)>\r\n\r\n#IF\r\nEQUAL <$STR(S$列表缓存Key)> <$STR(S$上次列表缓存Key)>\r\n#ACT\r\nGOTO @列表缓存构建完成\r\nBREAK\r\n\r\n#IF\r\n#ACT\r\nMOV S$上次列表缓存Key <$STR(S$列表缓存Key)>\r\nMOV L$列表缓存 []\r\nMOV N$列表缓存数量 0\r\nMOV S$列表缓存去重 \"\"\r\nMOV N$列表缓存源行 0\r\nMOV N$列表缓存命中数 0\r\nMOV N$防止死循环计数 0\r\nGOTO @列表缓存构建循环\r\nBREAK\r\n\r\n[@列表缓存构建循环]\r\n#IF\r\n#ACT\r\nMOV N$列表缓存构建结束 0\r\nMOV N$防止死循环计数 0\r\nLoopgoto @列表缓存构建循环_单步 201\r\n\r\n#IF\r\nEQUAL N$列表缓存构建结束 1\r\n#ACT\r\nMOV N$列表缓存数量 <$STR(N$列表缓存命中数)>\r\nGOTO @列表缓存构建完成\r\nBREAK\r\n\r\n#IF\r\n#ACT\r\nDELAYGOTO 1 @列表缓存构建循环\r\nBREAK\r\n\r\n[@列表缓存构建循环_单步]\r\n#IF\r\nNOT SMALL N$列表缓存源行 <$STR(N$总物品数量)>\r\n#ACT\r\nMOV N$列表缓存构建结束 1\r\nendloop\r\nbreak\r\n\r\n#IF\r\n#ACT\r\nINC N$防止死循环计数 1\r\nMOV S$物品ID \"\"\r\nMOV S$物品名称 \"\"\r\nMOV S$临时行内容 \"\"\r\n\r\n#IF\r\nEQUAL S$当前操作模式 仓库取物\r\n#ACT\r\nMOV S$物品名称 \"\"\r\n\r\n#IF\r\nEQUAL S$当前操作模式 仓库取物\r\nSMALL N$列表缓存源行 <$STR(N$仓库文件行数)>\r\n#ACT\r\nGetListString <$STR(S$读取文件路径)> <$STR(N$列表缓存源行)> S$物品名称\r\n\r\n#IF\r\nEQUAL S$当前操作模式 仓库取物\r\nNOT SMALL N$列表缓存源行 <$STR(N$仓库文件行数)>\r\n#ACT\r\nMOV N$仓库内存读取索引 <$STR(N$列表缓存源行)>\r\nDEC N$仓库内存读取索引 <$STR(N$仓库文件行数)>\r\nMOV S$物品名称 <$str(L$仓库列表快照[<$STR(N$仓库内存读取索引)>])>\r\n\r\n#IF\r\nEQUAL S$当前操作模式 仓库取物\r\n#ACT\r\nTextReplace <$STR(S$物品名称)> \" \" \"\" S$物品名称 0 0\r\nTextReplace <$STR(S$物品名称)> \"　\" \"\" S$物品名称 0 0\r\nTextReplace <$STR(S$物品名称)> \"\t\" \"\" S$物品名称 0 0\r\n\r\n#IF\r\nEQUAL S$当前操作模式 仓库取物\r\nEQUAL S$物品名称 \"\"\r\n#ACT\r\nINC N$列表缓存源行 1\r\nbreak\r\n\r\n#IF\r\nEQUAL S$当前操作模式 仓库取物\r\nEQUAL S$物品名称 \" \"\r\n#ACT\r\nINC N$列表缓存源行 1\r\nbreak\r\n\r\n#IF\r\nEQUAL S$当前操作模式 仓库取物\r\nEQUAL S$物品名称 \"  \"\r\n#ACT\r\nINC N$列表缓存源行 1\r\nbreak\r\n\r\n#IF\r\nNOT EQUAL S$当前操作模式 仓库取物\r\n#ACT\r\nGetListString <$STR(S$读取文件路径)> <$STR(N$列表缓存源行)> S$临时行内容\r\n\r\n#IF\r\nNOT EQUAL S$当前操作模式 仓库取物\r\nEQUAL S$临时行内容 \"\"\r\n#ACT\r\nINC N$列表缓存源行 1\r\nbreak\r\n\r\n#IF\r\nNOT EQUAL S$当前操作模式 仓库取物\r\n#ACT\r\nTextReplace <$STR(S$临时行内容)> \":\" \"|\" S$临时行内容 0 0\r\nExtractStringEx \"|\" <$STR(S$临时行内容)> S$分解内容\r\nMOV S$物品ID <$STR(S$分解内容1)>\r\nMOV S$物品名称 <$STR(S$分解内容2)>\r\n\r\n#IF\r\nEQUAL S$物品名称 \"\"\r\n#ACT\r\nINC N$列表缓存源行 1\r\nbreak\r\n\r\n#IF\r\nEQUAL S$物品名称 \" \"\r\n#ACT\r\nINC N$列表缓存源行 1\r\nbreak\r\n\r\n#IF\r\nEQUAL S$物品名称 \"  \"\r\n#ACT\r\nINC N$列表缓存源行 1\r\nbreak\r\n\r\n#IF\r\nNOT EQUAL S$搜索关键字 \"\"\r\nNOT CheckContainsText <$STR(S$物品名称)> <$STR(S$搜索关键字)>\r\n#ACT\r\nINC N$列表缓存源行 1\r\nbreak\r\n\r\n#IF\r\nEQUAL S$当前操作模式 仓库取物\r\nCheckContainsText <$STR(S$列表缓存去重)> |<$STR(S$物品名称)>|\r\n#ACT\r\nINC N$列表缓存源行 1\r\nbreak\r\n\r\n#IF\r\nEQUAL S$当前操作模式 仓库取物\r\n#ACT\r\nINC S$列表缓存去重 |<$STR(S$物品名称)>|\r\nINC L$列表缓存 <$STR(S$物品名称)>\r\nINC N$列表缓存命中数 1\r\nINC N$列表缓存源行 1\r\nbreak\r\n\r\n#IF\r\nNOT EQUAL S$当前操作模式 仓库取物\r\n#ACT\r\nMOV S$临时行内容 <$STR(S$物品ID)>:<$STR(S$物品名称)>\r\nINC L$列表缓存 <$STR(S$临时行内容)>\r\nINC N$列表缓存命中数 1\r\nINC N$列表缓存源行 1\r\nbreak\r\n\r\n[@列表缓存构建完成]\r\n#IF\r\n#ACT\r\nMOV N$总物品数量 <$STR(N$列表缓存数量)>\r\nMOV S$显示数量 (共<$STR(N$总物品数量)>件)\r\nMOV N$循环计数器 0\r\nMOV N$需要跳过数量 0\r\nMOV N$已跳过数量 0\r\nMOV S$当前页已显示列表 \"\"\r\nMOV N$当前循环行 <$STR(N$当前页码)>\r\nDEC N$当前循环行 1\r\nMUL N$当前循环行 <$STR(N$每页条数)>\r\nGOTO @虾米循环读取行\r\n\r\n[@虾米循环读取行]\r\n#IF\r\n#ACT\r\nMOV N$虾米读取结束 0\r\nMOV N$防止死循环计数 0\r\nLoopgoto @虾米循环读取行_单步 121\r\n\r\n#IF\r\nEQUAL N$虾米读取结束 1\r\n#ACT\r\nGOTO @显示最终界面\r\nBREAK\r\n\r\n#IF\r\n#ACT\r\nDELAYGOTO 1 @虾米循环读取行\r\nBREAK\r\n\r\n[@虾米循环读取行_单步]\r\n#IF\r\nNOT SMALL N$当前循环行 <$STR(N$总物品数量)>\r\n#ACT\r\nMOV N$虾米读取结束 1\r\nendloop\r\nbreak\r\n\r\n#IF\r\nLARGE N$循环计数器 17\r\n#ACT\r\nMOV N$虾米读取结束 1\r\nendloop\r\nbreak\r\n\r\n#IF\r\n#ACT\r\nINC N$防止死循环计数 1\r\nMOV S$物品ID \"\"\r\nMOV S$物品名称 \"\"\r\nMOV S$临时行内容 \"\"\r\nMOV N$读取行 <$STR(N$当前循环行)>\r\n\r\n#IF\r\nEQUAL N$启用列表缓存 1\r\nEQUAL S$当前操作模式 仓库取物\r\n#ACT\r\nMOV S$物品名称 <$str(L$列表缓存[<$str(N$读取行)>])>\r\n\r\n#IF\r\nEQUAL N$启用列表缓存 0\r\nEQUAL S$当前操作模式 仓库取物\r\n#ACT\r\nGetListString <$STR(S$读取文件路径)> <$STR(N$读取行)> S$物品名称\r\n\r\n#IF\r\nNOT EQUAL S$当前操作模式 仓库取物\r\n#ACT\r\nMOV S$临时行内容 <$str(L$列表缓存[<$str(N$读取行)>])>\r\n\r\n#IF\r\nEQUAL N$启用列表缓存 0\r\nNOT EQUAL S$当前操作模式 仓库取物\r\n#ACT\r\nGetListString <$STR(S$读取文件路径)> <$STR(N$读取行)> S$临时行内容\r\n\r\n#IF\r\nNOT EQUAL S$当前操作模式 仓库取物\r\nNOT EQUAL S$临时行内容 \"\"\r\n#ACT\r\nTextReplace <$STR(S$临时行内容)> \":\" \"|\" S$临时行内容 0 0\r\nExtractStringEx \"|\" <$STR(S$临时行内容)> S$分解内容\r\nMOV S$物品ID <$STR(S$分解内容1)>\r\nMOV S$物品名称 <$STR(S$分解内容2)>\r\nMOV N$物品ID <$STR(S$物品ID)>\r\n\r\n#IF\r\nEQUAL S$物品名称 \"\"\r\n#ACT\r\nINC N$当前循环行 1\r\nbreak\r\n\r\n#IF\r\nEQUAL S$当前操作模式 仓库取物\r\nCheckContainsText <$STR(S$当前页已显示列表)> |<$STR(S$物品名称)>|\r\n#ACT\r\nINC N$当前循环行 1\r\nbreak\r\n\r\n#IF\r\nEQUAL S$当前操作模式 仓库取物\r\n#ACT\r\nINC S$当前页已显示列表 |<$STR(S$物品名称)>|\r\n\r\n#IF\r\nEQUAL S$当前操作模式 仓库取物\r\n#ACT\r\nGetDBItemFieldValue <$STR(S$物品名称)> idx S$物品ID\r\nMOV N$物品ID <$STR(S$物品ID)>\r\n\r\n#IF\r\nEQUAL S$物品ID \"\"\r\n#ACT\r\nINC N$当前循环行 1\r\nbreak\r\n\r\n#IF\r\nEQUAL S$物品名称 \" \"\r\n#ACT\r\nINC N$当前循环行 1\r\nbreak\r\n\r\n#IF\r\nEQUAL S$物品名称 \"  \"\r\n#ACT\r\nINC N$当前循环行 1\r\nbreak\r\n\r\n#IF\r\nNOT EQUAL S$搜索关键字 \"\"\r\nNOT CheckContainsText <$STR(S$物品名称)> <$STR(S$搜索关键字)>\r\n#ACT\r\nINC N$当前循环行 1\r\nbreak\r\n\r\n#IF\r\n#ACT\r\nMOV N$过滤状态 0\r\nMOV N$存储状态 0\r\nMOV N$仓库数量 0\r\n\r\nMOV S$显示名称 <$STR(S$物品名称)>\r\n#IF\r\nCheckContainsText <$STR(S$物品名称)> <\r\n#ACT\r\nMOV S$显示名称 特殊符号\r\n#IF\r\nCheckContainsText <$STR(S$物品名称)> >\r\n#ACT\r\nMOV S$显示名称 特殊符号\r\n\r\n\r\n#IF\r\nNOT EQUAL S$当前操作模式 仓库取物\r\nNOT EQUAL S$搜索关键字 \"\"\r\nSMALL N$已跳过数量 <$STR(N$需要跳过数量)>\r\n#ACT\r\nINC N$已跳过数量 1\r\nINC N$当前循环行 1\r\nbreak\r\n\r\n#IF\r\nEQUAL S$当前操作模式 过滤设置\r\n#ACT\r\n#IF\r\nEQUAL S$用户数据存储地址 \"\"\r\n#ACT\r\nMOV S$用户数据存储地址 ..\\..\\..\\..\\通区文件\\<$SERVERNAME>\\<$USERID>_<$USERNAME>.ini\r\n#IF\r\n#ACT\r\nReadConfigFileItem S$用户数据存储地址 过滤物品 <$STR(S$物品名称)> <$STR(N$过滤状态)>\r\n\r\n#IF\r\nEQUAL S$当前操作模式 存储设置\r\n#ACT\r\n#IF\r\nEQUAL S$用户数据存储地址 \"\"\r\n#ACT\r\nMOV S$用户数据存储地址 ..\\..\\..\\..\\通区文件\\<$SERVERNAME>\\<$USERID>_<$USERNAME>.ini\r\n#IF\r\n#ACT\r\nReadConfigFileItem S$用户数据存储地址 存储物品 <$STR(S$物品名称)> <$STR(N$存储状态)>\r\n\r\n#IF\r\nEQUAL S$当前操作模式 仓库取物\r\n#ACT\r\n#IF\r\nEQUAL S$用户数据存储地址 \"\"\r\n#ACT\r\nMOV S$用户数据存储地址 ..\\..\\..\\..\\通区文件\\<$SERVERNAME>\\<$USERID>_<$USERNAME>.ini\r\n#IF\r\n#ACT\r\nReadConfigFileItem S$仓库数量文件 仓库数量 <$STR(S$物品名称)> <$STR(N$仓库数量)>\r\n\r\n#IF\r\nEQUAL S$当前操作模式 仓库取物\r\nSMALL N$仓库数量 1\r\n#ACT\r\nINC N$当前循环行 1\r\nbreak\r\n\r\n#IF\r\nEQUAL S$当前操作模式 仓库取物\r\nSMALL N$已跳过数量 <$STR(N$需要跳过数量)>\r\n#ACT\r\nINC N$已跳过数量 1\r\nINC N$当前循环行 1\r\nbreak\r\n\r\n#IF\r\nNOT EQUAL S$搜索关键字 \"\"\r\nSMALL N$已跳过数量 <$STR(N$需要跳过数量)>\r\n#ACT\r\nINC N$已跳过数量 1\r\nINC N$当前循环行 1\r\nbreak\r\n\r\n#IF\r\nEQUAL S$当前操作模式 过滤设置\r\nEQUAL N$过滤状态 0\r\n#ACT\r\nMOV N$过滤状态 87\r\n\r\n#IF\r\nEQUAL S$当前操作模式 存储设置\r\nEQUAL N$存储状态 0\r\n#ACT\r\nMOV N$存储状态 87\r\n\r\n#IF\r\nEQUAL S$物品名称 \"\"\r\n#ACT\r\nINC N$当前循环行 1\r\nbreak\r\n\r\n#IF\r\nEQUAL N$列数 1\r\n#ACT\r\nMUL N$物品坐标Y N$行数 50\r\nMUL N$TEXT坐标Y N$行数 50\r\nMUL N$Img坐标Y N$行数 50\r\nMUL N$TEXT2坐标Y N$行数 50\r\nINC N$物品坐标Y 5\r\nINC N$TEXT坐标Y 5\r\nINC N$Img坐标Y 25\r\nINC N$TEXT2坐标Y 28\r\n\r\n#IF\r\nEQUAL N$列数 2\r\n#ACT\r\nINC N$物品坐标X 200\r\nINC N$TEXT坐标X 200\r\nINC N$Img坐标X 200\r\nINC N$TEXT2坐标X 200\r\n\r\n#IF\r\nEQUAL N$列数 3\r\n#ACT\r\nINC N$物品坐标X 400\r\nINC N$TEXT坐标X 400\r\nINC N$Img坐标X 400\r\nINC N$TEXT2坐标X 400\r\n\r\n#IF\r\nEQUAL S$当前操作模式 过滤设置\r\n#ACT\r\nINC S$列表显示内容 <&Img:#L1_Content~:<$STR(N$过滤状态)>:<$STR(N$虾米资源编号)>:<$STR(N$Img坐标X)>:<$STR(N$Img坐标Y)>|161#点击过滤[<$STR(S$显示名称)>]/@执行操作(<$STR(S$物品名称)>)>\r\n\r\n#IF\r\nEQUAL S$当前操作模式 存储设置\r\n#ACT\r\nINC S$列表显示内容 <&Img:#L1_Content~:<$STR(N$存储状态)>:<$STR(N$虾米资源编号)>:<$STR(N$Img坐标X)>:<$STR(N$Img坐标Y)>|161#点击存储[<$STR(S$显示名称)>]/@执行操作(<$STR(S$物品名称)>)>\r\n\r\n#IF\r\nEQUAL S$当前操作模式 仓库取物\r\n#ACT\r\nMOV N$临时名字Y <$STR(N$物品坐标Y)>\r\nMOV N$临时数量X <$STR(N$Img坐标X)>\r\nINC N$临时数量X 45\r\nINC S$列表显示内容 <&ImgEx:#L1_Content~:<$STR(N$虾米资源编号)>:98:97:99:<$STR(N$Img坐标X)>:<$STR(N$Img坐标Y)>|161#点击取出物品[<$STR(S$显示名称)>]/@取出物品(<$STR(S$物品名称)>,<$STR(N$物品ID)>,<$STR(N$仓库数量)>,0)>\r\nINC S$列表显示内容 <&Text:#L1_Content~:取出:<$STR(N$TEXT2坐标X)>:<$STR(N$TEXT2坐标Y)>{FCOLOR=251;FSIZE=10;FNAME=宋体}>\r\nINC S$列表显示内容 <&itemshow:#L1_Content~:<$STR(N$物品ID)>:0:<$STR(N$物品坐标X)>:<$STR(N$物品坐标Y)>:1:0:0:0/@加载怪物集合(<$STR(S$物品名称)>,0)>\r\nINC S$列表显示内容 <&Text:#L1_Content~:<$STR(S$显示名称)>:<$STR(N$TEXT坐标X)>:<$STR(N$临时名字Y)>{FCOLOR=159;FSIZE=12;FNAME=黑体}>\r\nINC S$列表显示内容 <&Text:#L1_Content~:<$STR(N$仓库数量)>件:<$STR(N$临时数量X)>:<$STR(N$TEXT2坐标Y)>{FCOLOR=250;FSIZE=12;FNAME=宋体}>\r\n\r\n#IF\r\nNOT EQUAL S$当前操作模式 仓库取物\r\n#ACT\r\nINC S$列表显示内容 <&itemshow:#L1_Content~:<$STR(N$物品ID)>:0:<$STR(N$物品坐标X)>:<$STR(N$物品坐标Y)>:1:0:0:0/@加载怪物集合(<$STR(S$物品名称)>,0)>\r\nINC S$列表显示内容 <&Text:#L1_Content~:<$STR(S$显示名称)>:<$STR(N$TEXT坐标X)>:<$STR(N$TEXT坐标Y)>{FCOLOR=159;FSIZE=12;FNAME=黑体}>\r\n\r\n#IF\r\nEQUAL N$列数 2\r\n#ACT\r\nDEC N$物品坐标X 200\r\nDEC N$TEXT坐标X 200\r\nDEC N$Img坐标X 200\r\nDEC N$TEXT2坐标X 200\r\n\r\n#IF\r\nEQUAL N$列数 3\r\n#ACT\r\nDEC N$物品坐标X 400\r\nDEC N$TEXT坐标X 400\r\nDEC N$Img坐标X 400\r\nDEC N$TEXT2坐标X 400\r\nINC N$行数 1\r\nMOV N$列数 0\r\n\r\n#IF\r\n#ACT\r\nINC N$列数 1\r\nINC N$循环计数器 1\r\nINC N$当前循环行 1\r\nbreak\r\n\r\n\r\n\r\n[@显示最终界面]\r\n#IF\r\n#ACT\r\nOPENMERCHANTBIGDLG <$str(N$虾米资源编号)> 9 1 4 0 -60 1 930 110\r\n#SAY\r\n<MONSTER:<$STR(N$怪物RaceImg)>:<$STR(N$怪物APPR)>:11:4:590:625>\r\n<&INPUTTEXT:1:240:132:250:20:-1:-1:246:0:40:无搜索关键字:输入名称进行搜索(支持模糊搜索):160>\r\n<&ImgEx:<$STR(N$虾米资源编号)>:104:105:106:498:129:1/@查询过滤存储物品>\r\n<&Layout:~#B2:130:180:180:510>\r\n<$STR(S$分类菜单显示)>\r\n<&ImgEx:#B2~#L23:<$STR(N$虾米资源编号)>:<$str(N$默认过滤类型)>:79:80:0:440/@虾米切换模式(过滤设置)>\r\n<&ImgEx:#B2~#L24:<$STR(N$虾米资源编号)>:<$str(N$默认存储类型)>:82:83:90:440/@虾米切换模式(存储设置)>\r\n<&ImgEx:#B2~#L25:<$STR(N$虾米资源编号)>:<$str(N$默认仓库类型)>:85:86:45:480/@虾米切换模式(仓库取物)>\r\n\r\n<&Layout:~#B3:335:170:590:380:9>\r\n<&Text:#B3~#T1:分类：<$STR(S$当前浏览分类)>   模式：<$STR(S$当前操作模式)>:140:10{FCOLOR=250;FSIZE=18;FNAME=黑体}>\r\n<&Text:#B3~#T1:物品数量：<$str(S$显示数量)>:10:40{FCOLOR=250;FSIZE=12;FNAME=黑体}>\r\n<&ListView:#B3~#L1:0:60:582:310:0:0:0:0:0:0>\r\n\r\n<&Text:[上一页]:550:555/@虾米上一页>   <&Text:第 <$STR(N$当前页码)> 页:610:555{FCOLOR=251}>   <&Text:[下一页]:670:555/@虾米下一页>\r\n<&Text:[一键背包存储]|一键储存背包里已勾选物品:350:555/@开启背包存储>   <&Text:[本页全选]:480:555/@全选本页>   <&Text:[本页否选]:730:555/@全不选本页>   <&Text:<$STR(S$背包存储_定时勾选)>自动存储|开启自动存储背包里已勾选物品:830:555/@背包存储定时器开关>\r\n\r\n<$STR(S$列表显示内容)>\r\n\r\n<&Layout:~#B4:335:570:234:114:9>\r\n<Text:#B4~#T1:以下怪物掉落:0:2{FCOLOR=230;FSIZE=11;FNAME=黑体}>\r\n<Text:#B4~#T1:[<$str(S$掉落物品名称)>]:0:2{FCOLOR=224;FSIZE=11;FNAME=黑体}>\r\n<&ListView:#B4~#L2:0:14:230:100:0:<$STR(N$跳到第几个怪物容器)>:0:0:0:0:<$STR(N$虾米资源编号)>:17:2:3:4:16:8:8:5:6:7>\r\n<$str(S$怪物集合内容)>\r\n\r\n<&Layout:~#B6:700:570:227:114:9>\r\n<Text:#B6~#T1:怪物:0:2{FCOLOR=230;FSIZE=11;FNAME=黑体}>\r\n<Text:#B6~#T1:[<$str(S$刷新怪物名称)>]:0:2{FCOLOR=224;FSIZE=11;FNAME=黑体}>\r\n<Text:#B6~#T1:刷新地图:0:2{FCOLOR=230;FSIZE=11;FNAME=黑体}>\r\n<&ListView:#B6~#L3:0:14:222:100:0:0:0:0:0:0:<$STR(N$虾米资源编号)>:17:2:3:4:16:8:8:5:6:7>\r\n<$str(S$地图集合内容)>\r\n\r\n[@查询过滤存储物品]\r\n#IF\r\nequal <$NPCINPUT(1)> \"\"\r\n#ACT\r\nMESSAGEBOX 请先输入要搜索的物品名称。\r\nBREAK\r\n\r\n\r\n#IF\r\nEQUAL S$当前操作模式 仓库取物\r\n#ACT\r\nMOV S$读取文件路径 <$str(S$仓库索引文件)>\r\nMOV S$搜索关键字 <$NPCINPUT(1)>\r\nMOV N$当前页码 1\r\nGOTO @开始构建列表界面\r\nBREAK\r\n\r\n#IF\r\n#ACT\r\nMOV S$当前浏览分类 所有物品\r\nMOV S$UI搜索关键字 <$NPCINPUT(1)>\r\nMOV S$搜索关键字 <$NPCINPUT(1)>\r\nMOV S$读取文件路径 <$str(S$本地物品数据存储地址)>所有物品.txt\r\nMOV N$当前页码 1\r\nGOTO @开始搜索构建\r\nBREAK\r\n\r\n[@开始搜索构建]\r\n#IF\r\n#ACT\r\nMOV S$搜索缓存文件 ..\\QuestDiary\\ggjfl\\SearchCache_<$USERID>.txt\r\nClearNameList <$STR(S$搜索缓存文件)>\r\nMOV N$搜索命中数 0\r\nMOV N$搜索最大结果 180\r\nMOV N$搜索当前分类序号 1\r\nMOV N$防止死循环计数 0\r\nGOTO @搜索切换分类\r\n\r\n[@搜索切换分类]\r\n#IF\r\nLARGE N$搜索当前分类序号 18\r\n#ACT\r\nMOV S$读取文件路径 <$STR(S$搜索缓存文件)>\r\nMOV S$搜索关键字 \"\"\r\nGOTO @开始构建列表界面\r\nBREAK\r\n\r\n#IF\r\nEQUAL N$搜索当前分类序号 1\r\n#ACT\r\nMOV S$搜索分类名 武器\r\nGOTO @搜索设置文件\r\nBREAK\r\n\r\n#IF\r\nEQUAL N$搜索当前分类序号 2\r\n#ACT\r\nMOV S$搜索分类名 衣服\r\nGOTO @搜索设置文件\r\nBREAK\r\n\r\n#IF\r\nEQUAL N$搜索当前分类序号 3\r\n#ACT\r\nMOV S$搜索分类名 头盔\r\nGOTO @搜索设置文件\r\nBREAK\r\n\r\n#IF\r\nEQUAL N$搜索当前分类序号 4\r\n#ACT\r\nMOV S$搜索分类名 斗笠\r\nGOTO @搜索设置文件\r\nBREAK\r\n\r\n#IF\r\nEQUAL N$搜索当前分类序号 5\r\n#ACT\r\nMOV S$搜索分类名 项链\r\nGOTO @搜索设置文件\r\nBREAK\r\n\r\n#IF\r\nEQUAL N$搜索当前分类序号 6\r\n#ACT\r\nMOV S$搜索分类名 勋章\r\nGOTO @搜索设置文件\r\nBREAK\r\n\r\n#IF\r\nEQUAL N$搜索当前分类序号 7\r\n#ACT\r\nMOV S$搜索分类名 手镯\r\nGOTO @搜索设置文件\r\nBREAK\r\n\r\n#IF\r\nEQUAL N$搜索当前分类序号 8\r\n#ACT\r\nMOV S$搜索分类名 戒指\r\nGOTO @搜索设置文件\r\nBREAK\r\n\r\n#IF\r\nEQUAL N$搜索当前分类序号 9\r\n#ACT\r\nMOV S$搜索分类名 毒符\r\nGOTO @搜索设置文件\r\nBREAK\r\n\r\n#IF\r\nEQUAL N$搜索当前分类序号 10\r\n#ACT\r\nMOV S$搜索分类名 盾牌\r\nGOTO @搜索设置文件\r\nBREAK\r\n\r\n#IF\r\nEQUAL N$搜索当前分类序号 11\r\n#ACT\r\nMOV S$搜索分类名 靴子\r\nGOTO @搜索设置文件\r\nBREAK\r\n\r\n#IF\r\nEQUAL N$搜索当前分类序号 12\r\n#ACT\r\nMOV S$搜索分类名 腰带\r\nGOTO @搜索设置文件\r\nBREAK\r\n\r\n#IF\r\nEQUAL N$搜索当前分类序号 13\r\n#ACT\r\nMOV S$搜索分类名 宝石\r\nGOTO @搜索设置文件\r\nBREAK\r\n\r\n#IF\r\nEQUAL N$搜索当前分类序号 14\r\n#ACT\r\nMOV S$搜索分类名 灵玉\r\nGOTO @搜索设置文件\r\nBREAK\r\n\r\n#IF\r\nEQUAL N$搜索当前分类序号 15\r\n#ACT\r\nMOV S$搜索分类名 时装\r\nGOTO @搜索设置文件\r\nBREAK\r\n\r\n#IF\r\nEQUAL N$搜索当前分类序号 16\r\n#ACT\r\nMOV S$搜索分类名 生肖\r\nGOTO @搜索设置文件\r\nBREAK\r\n\r\n#IF\r\nEQUAL N$搜索当前分类序号 17\r\n#ACT\r\nMOV S$搜索分类名 特殊\r\nGOTO @搜索设置文件\r\nBREAK\r\n\r\n#IF\r\nEQUAL N$搜索当前分类序号 18\r\n#ACT\r\nMOV S$搜索分类名 其它\r\nGOTO @搜索设置文件\r\nBREAK\r\n\r\n#IF\r\n#ACT\r\nMOV S$读取文件路径 <$STR(S$搜索缓存文件)>\r\nMOV S$搜索关键字 \"\"\r\nGOTO @开始构建列表界面\r\nBREAK\r\n\r\n[@搜索设置文件]\r\n#IF\r\n#ACT\r\nMOV S$搜索名称文件 ..\\QuestDiary\\ggjfl\\<$STR(S$搜索分类名)>名称.txt\r\nMOV S$搜索显示文件 ..\\QuestDiary\\ggjfl\\<$STR(S$搜索分类名)>显示.txt\r\nGOTO @搜索准备单文件\r\nBREAK\r\n\r\n[@搜索准备单文件]\r\n#IF\r\n#ACT\r\nGetTextLineCount <$STR(S$搜索名称文件)> N$搜索总行数\r\nMOV N$搜索当前行 0\r\nGOTO @搜索构建循环\r\n\r\n[@搜索构建循环]\r\n#IF\r\n#ACT\r\nMOV N$搜索构建结束类型 0\r\nMOV N$防止死循环计数 0\r\nLoopgoto @搜索构建循环_单步 121\r\n\r\n#IF\r\nEQUAL N$搜索构建结束类型 1\r\n#ACT\r\nINC N$搜索当前分类序号 1\r\nGOTO @搜索切换分类\r\nBREAK\r\n\r\n#IF\r\nEQUAL N$搜索构建结束类型 2\r\n#ACT\r\nMOV S$读取文件路径 <$STR(S$搜索缓存文件)>\r\nMOV S$搜索关键字 \"\"\r\nGOTO @开始构建列表界面\r\nBREAK\r\n\r\n#IF\r\n#ACT\r\nDELAYGOTO 1 @搜索构建循环\r\nBREAK\r\n\r\n[@搜索构建循环_单步]\r\n#IF\r\nLARGE N$搜索当前行 <$STR(N$搜索总行数)>\r\n#ACT\r\nMOV N$搜索构建结束类型 1\r\nendloop\r\nbreak\r\n\r\n#IF\r\nLARGE N$搜索命中数 <$STR(N$搜索最大结果)>\r\n#ACT\r\nMOV N$搜索构建结束类型 2\r\nendloop\r\nbreak\r\n\r\n#IF\r\n#ACT\r\nINC N$防止死循环计数 1\r\nMOV N$当前搜索索引 <$STR(N$搜索当前行)>\r\nGetListString <$STR(S$搜索名称文件)> <$STR(N$当前搜索索引)> S$物品名称\r\nINC N$搜索当前行 1\r\n\r\n#IF\r\nEQUAL S$物品名称 \"\"\r\n#ACT\r\nbreak\r\n\r\n#IF\r\nNOT CheckContainsText <$STR(S$物品名称)> <$STR(S$UI搜索关键字)>\r\n#ACT\r\nbreak\r\n\r\n#IF\r\n#ACT\r\nGetListString <$STR(S$搜索显示文件)> <$STR(N$当前搜索索引)> N$物品ID S$物品名称\r\nMOV S$临时行内容 <$STR(N$物品ID)>:<$STR(S$物品名称)>\r\nAddTextList <$STR(S$搜索缓存文件)> <$STR(S$临时行内容)>\r\n\r\n#IF\r\n#ACT\r\nINC N$搜索命中数 1\r\n\r\n\r\n[@虾米切换模式]\r\n#IF\r\nEQUAL S$当前操作模式 <$SCRIPTPARAM1>\r\n#ACT\r\nBREAK\r\n\r\n#IF\r\n#ACT\r\nMOV S$当前操作模式 <$SCRIPTPARAM1>\r\nMOV N$当前页码 1\r\n\r\n#IF\r\nEQUAL S$当前操作模式 仓库取物\r\n#ACT\r\nMOV S$搜索关键字 \"\"\r\nMOV S$UI搜索关键字 \"\"\r\n\r\n#IF\r\nNOT EQUAL S$当前操作模式 仓库取物\r\nEQUAL S$当前浏览分类 所有物品\r\n#ACT\r\nMOV S$当前浏览分类 武器\r\n\r\n#IF\r\n#ACT\r\nGOTO @咕咕鸡过滤\r\nBREAK\r\n\r\n[@虾米加载类型]\r\n#IF\r\n#ACT\r\nMOV S$当前浏览分类 <$SCRIPTPARAM1>\r\nMOV N$当前页码 1\r\nGOTO @咕咕鸡过滤\r\nBREAK\r\n\r\n[@虾米上一页]\r\n#IF\r\nLARGE N$当前页码 1\r\n#ACT\r\nDEC N$当前页码 1\r\nGOTO @咕咕鸡过滤\r\n#ELSEACT\r\nMESSAGEBOX 已经是第一页了\r\nBREAK\r\n\r\n[@虾米下一页]\r\n#IF\r\nEQUAL N$启用列表缓存 1\r\n#ACT\r\nMOV N$下一页检查 <$STR(N$当前页码)>\r\nMUL N$下一页检查 <$STR(N$每页条数)>\r\n\r\n#IF\r\nEQUAL N$启用列表缓存 1\r\nNOT LARGE N$总物品数量 <$STR(N$下一页检查)>\r\n#ACT\r\nMESSAGEBOX 已经是最后一页了\r\nBREAK\r\n\r\n#IF\r\nEQUAL N$启用列表缓存 1\r\n#ACT\r\nINC N$当前页码 1\r\nGOTO @咕咕鸡过滤\r\nBREAK\r\n\r\n#IF\r\nNOT EQUAL S$搜索关键字 \"\"\r\nSMALL N$循环计数器 18\r\n#ACT\r\nMESSAGEBOX 已经是最后一页了\r\nBREAK\r\n\r\n#IF\r\nEQUAL S$搜索关键字 \"\"\r\n#ACT\r\nMOV N$下一页检查 <$STR(N$当前页码)>\r\nMUL N$下一页检查 18\r\n\r\n#IF\r\nEQUAL S$搜索关键字 \"\"\r\nNOT LARGE N$总物品数量 <$STR(N$下一页检查)>\r\n#ACT\r\nMESSAGEBOX 已经是最后一页了\r\nBREAK\r\n\r\n#IF\r\n#ACT\r\nINC N$当前页码 1\r\nGOTO @咕咕鸡过滤\r\nBREAK\r\n\r\n[@执行操作]\r\n#IF\r\n#ACT\r\nMOV S$操作物品名 <$SCRIPTPARAM1>\r\n\r\n#IF\r\nEQUAL S$当前操作模式 过滤设置\r\n#ACT\r\nGOTO @获取过滤状态_单次\r\nGOTO @处理过滤操作\r\nBREAK\r\n\r\n#IF\r\nEQUAL S$当前操作模式 存储设置\r\n#ACT\r\nGOTO @获取存储状态_单次\r\nGOTO @处理存储操作\r\nBREAK\r\n\r\n#IF\r\nEQUAL S$当前操作模式 仓库取物\r\n#ACT\r\nGOTO @获取仓库数量_单次\r\nBREAK\r\n\r\n[@处理过滤操作]\r\n#IF\r\nEQUAL N$当前状态 88\r\n#ACT\r\nGOTO @设置过滤状态_关闭\r\n#ELSEACT\r\nGOTO @设置过滤状态_开启\r\n#IF\r\n#ACT\r\nGOTO @咕咕鸡过滤\r\nBREAK\r\n\r\n[@处理存储操作]\r\n#IF\r\nEQUAL N$当前状态 88\r\n#ACT\r\nGOTO @设置存储状态_关闭\r\n#ELSEACT\r\nGOTO @设置存储状态_开启\r\n#IF\r\n\r\n#ACT\r\nGOTO @咕咕鸡过滤\r\nBREAK\r\n\r\n[@全选本页]\r\n#ACT\r\nMOV N$批量操作目标状态 88\r\nMOV N$防止死循环计数 0\r\nGOTO @执行批量操作\r\n\r\n[@全不选本页]\r\n#ACT\r\nMOV N$批量操作目标状态 87\r\nMOV N$防止死循环计数 0\r\nGOTO @执行批量操作\r\n\r\n[@背包存储定时器开关]\r\n#IF\r\n#ACT\r\nMOV N$背包存储_定时开关 0\r\nReadConfigFileItem S$用户数据存储地址 咕咕鸡过滤 背包存储定时 N$背包存储_定时开关\r\n\r\n#IF\r\nEQUAL N$背包存储_定时开关 1\r\n#ACT\r\nWriteConfigFileItem S$用户数据存储地址 咕咕鸡过滤 背包存储定时 0\r\nSetOffTimer 51\r\nSendMsg 6 自动背包存储：已关闭\r\nGOTO @咕咕鸡过滤\r\nBREAK\r\n\r\n#IF\r\n#ACT\r\nWriteConfigFileItem S$用户数据存储地址 咕咕鸡过滤 背包存储定时 1\r\nSetOnTimer 51 2\r\nSendMsg 6 自动背包存储：已开启,2秒执行一次\r\nGOTO @咕咕鸡过滤\r\nBREAK\r\n\r\n[@开启背包存储]\r\n#IF\r\n#ACT\r\nMOV N$背包存储_总存入 0\r\nMOV N$背包存储_背包数量 0\r\nMOV N$背包存储_当前索引 0\r\nMOV N$背包存储_是否存储 0\r\nMOV N$背包存储_本次存入 0\r\nMOV N$背包存储_背包数量_前 0\r\nMOV N$背包存储_背包数量_后 0\r\nMOV N$背包存储_仓库原数量 0\r\nMOV N$背包存储_仓库新数量 0\r\nMOV N$背包存储_仓库索引 0\r\nMOV S$背包存储_物品名称 \"\"\r\nMOV S$背包存储_物品显示名 \"\"\r\nMOV S$背包存储_提示明细 \"\"\r\nMOV S$背包存储_单项提示 \"\"\r\nMOV S$背包存储_已处理Key \"|\"\r\nMOV S$背包存储_检查Key \"\"\r\n\r\n#IF\r\nEQUAL S$用户数据存储地址 \"\"\r\n#ACT\r\nMOV S$用户数据存储地址 ..\\..\\..\\..\\通区文件\\<$SERVERNAME>\\<$USERID>_<$USERNAME>.ini\r\n\r\n#IF\r\n#ACT\r\nMOV S$仓库索引文件 ..\\..\\..\\..\\通区文件\\<$SERVERNAME>\\仓库索引_<$USERID>_<$USERNAME>.txt\r\nMOV S$仓库数量文件 ..\\..\\..\\..\\通区文件\\<$SERVERNAME>\\仓库数量_<$USERID>_<$USERNAME>.txt\r\n\r\n#IF\r\n#ACT\r\nGetBagInfo ItemCount N$背包存储_背包数量\r\n\r\n#IF\r\nSMALL N$背包存储_背包数量 1\r\n#ACT\r\nSendMsg 6 背包存储：背包内没有可处理物品。\r\nGOTO @咕咕鸡过滤\r\nBREAK\r\n\r\n#IF\r\n#ACT\r\nLoopgoto @开启背包存储_单步 <$STR(N$背包存储_背包数量)>\r\n\r\n#IF\r\nLARGE N$背包存储_总存入 0\r\n#ACT\r\nSendMsg 6 背包存储：已存入<$STR(S$背包存储_提示明细)>件。\r\nMOV S$上次列表缓存Key \"\"\r\nGOTO @咕咕鸡过滤\r\nBREAK\r\n\r\n[@开启背包存储_单步]\r\n#IF\r\n#ACT\r\nMOV S$背包存储_物品名称 \"\"\r\n MOV S$背包存储_物品显示名 \"\"\r\nMOV N$背包存储_本次索引 <$STR(N$背包存储_当前索引)>\r\nGetBagItemFieldValue 0 <$STR(N$背包存储_本次索引)> name S$背包存储_物品名称\r\n GetBagItemFieldValue 0 <$STR(N$背包存储_本次索引)> name_g S$背包存储_物品显示名\r\nINC N$背包存储_当前索引 1\r\nMOV S$背包存储_检查Key |<$STR(S$背包存储_物品名称)>|\r\n\r\n#IF\r\nEQUAL S$背包存储_物品名称 \"\"\r\n#ACT\r\nbreak\r\n\r\n#IF\r\nEQUAL S$背包存储_物品显示名 \"\"\r\n#ACT\r\nMOV S$背包存储_物品显示名 <$STR(S$背包存储_物品名称)>\r\n\r\n#IF\r\nCheckContainsText <$STR(S$背包存储_已处理Key)> <$STR(S$背包存储_检查Key)>\r\n#ACT\r\nbreak\r\n\r\n#IF\r\n#ACT\r\nINC S$背包存储_已处理Key <$STR(S$背包存储_检查Key)>\r\n\r\n#IF\r\n#ACT\r\nMOV N$背包存储_是否存储 0\r\nReadConfigFileItem S$用户数据存储地址 存储物品 <$STR(S$背包存储_物品名称)> <$STR(N$背包存储_是否存储)>\r\n\r\n#IF\r\nNOT EQUAL N$背包存储_是否存储 88\r\n#ACT\r\nbreak\r\n\r\n#IF\r\n#ACT\r\nMOV N$背包存储_本次存入 0\r\nMOV N$背包存储_背包数量_前 0\r\nMOV N$背包存储_背包数量_后 0\r\nGetBagItemCount <$STR(S$背包存储_物品名称)> N$背包存储_背包数量_前\r\n\r\n#IF\r\nSMALL N$背包存储_背包数量_前 1\r\n#ACT\r\nbreak\r\n\r\n#IF\r\nCheckContainsText <$STR(S$背包存储_物品显示名)> 绑定\r\n#ACT\r\nbreak\r\n\r\n#IF\r\nCheckContainsText <$STR(S$背包存储_物品显示名)> 已绑定\r\n#ACT\r\nbreak\r\n\r\n#IF\r\nCheckContainsText <$STR(S$背包存储_物品显示名)> (绑\r\n#ACT\r\nbreak\r\n\r\n#IF\r\nCheckContainsText <$STR(S$背包存储_物品显示名)> （绑\r\n#ACT\r\nbreak\r\n\r\n#IF\r\nCheckContainsText <$STR(S$背包存储_物品显示名)> [绑\r\n#ACT\r\nbreak\r\n\r\n#IF\r\n#ACT\r\nMOV N$背包存储_物品MakeIndex 0\r\nGetBagItemFieldValue 0 <$STR(N$背包存储_本次索引)> makeindex N$背包存储_物品MakeIndex\r\nGiveBoxItemEx 31 <$STR(N$背包存储_物品MakeIndex)>\r\n\r\n#IF\r\nEQUAL <$BOXITEM[31].MAKEINDEX> <$STR(N$背包存储_物品MakeIndex)>\r\nCheckItemState boxitem31 0\r\n#ACT\r\nReturnBoxItem 31\r\nbreak\r\n\r\n#IF\r\nEQUAL <$BOXITEM[31].MAKEINDEX> <$STR(N$背包存储_物品MakeIndex)>\r\nCheckItemState boxitem31 4\r\n#ACT\r\nReturnBoxItem 31\r\nbreak\r\n\r\n#IF\r\nEQUAL <$BOXITEM[31].MAKEINDEX> <$STR(N$背包存储_物品MakeIndex)>\r\nCheckItemState boxitem31 5\r\n#ACT\r\nReturnBoxItem 31\r\nbreak\r\n\r\n#IF\r\n#ACT\r\nReturnBoxItem 31\r\n\r\n#IF\r\n#ACT\r\ntake <$STR(S$背包存储_物品名称)> <$STR(N$背包存储_背包数量_前)> 0 0 1 0\r\nGetBagItemCount <$STR(S$背包存储_物品名称)> N$背包存储_背包数量_后\r\nFORMULATION <$STR(N$背包存储_背包数量_前)>-<$STR(N$背包存储_背包数量_后)> N$背包存储_本次存入\r\n\r\n#IF\r\nSMALL N$背包存储_本次存入 1\r\n#ACT\r\nbreak\r\n\r\n#IF\r\n#ACT\r\nINC N$背包存储_总存入 <$STR(N$背包存储_本次存入)>\r\nMOV S$背包存储_单项提示 <$STR(S$背包存储_物品名称)>x<$STR(N$背包存储_本次存入)>\r\n\r\n#IF\r\nNOT EQUAL S$背包存储_提示明细 \"\"\r\n#ACT\r\nINC S$背包存储_提示明细 ，\r\n\r\n#IF\r\n#ACT\r\nINC S$背包存储_提示明细 <$STR(S$背包存储_单项提示)>\r\n\r\nMOV N$背包存储_仓库原数量 0\r\nReadConfigFileItem S$仓库数量文件 仓库数量 <$STR(S$背包存储_物品名称)> <$STR(N$背包存储_仓库原数量)>\r\nMOV N$背包存储_仓库新数量 <$STR(N$背包存储_仓库原数量)>\r\nINC N$背包存储_仓库新数量 <$STR(N$背包存储_本次存入)>\r\nWriteConfigFileItem S$仓库数量文件 仓库数量 <$STR(S$背包存储_物品名称)> <$STR(N$背包存储_仓库新数量)>\r\n\r\n#IF\r\nNOT CheckTextList <$STR(S$仓库索引文件)> <$STR(S$背包存储_物品名称)>\r\n#ACT\r\nAddTextListEx <$STR(S$仓库索引文件)> <$STR(S$背包存储_物品名称)> 0\r\n\r\n[@执行批量操作]\r\n#IF\r\nEQUAL S$当前操作模式 仓库取物\r\n#ACT\r\nMESSAGEBOX 仓库取物模式下无法使用此功能。\r\nBREAK\r\n\r\n#IF\r\n#ACT\r\nMOV N$批量计数器 0\r\nMOV N$批量循环行 0\r\nMOV S$批量操作目标状态 <$STR(N$批量操作目标状态)>\r\nMOV N$连续空行数 0\r\n\r\n#IF\r\nEQUAL S$搜索关键字 \"\"\r\n#ACT\r\nMOV N$批量开始行 <$STR(N$当前页码)>\r\nDEC N$批量开始行 1\r\nMUL N$批量开始行 <$STR(N$每页条数)>\r\nMOV N$批量循环行 <$STR(N$批量开始行)>\r\nGOTO @虾米批量循环\r\nBREAK\r\n\r\n#IF\r\nNOT EQUAL S$搜索关键字 \"\"\r\n#ACT\r\nMOV N$批量开始行 <$STR(N$当前页码)>\r\nDEC N$批量开始行 1\r\nMUL N$批量开始行 <$STR(N$每页条数)>\r\nMOV N$批量当前扫描行 <$STR(N$批量开始行)>\r\nMOV N$批量当前页已处理数 0\r\n\r\n#IF\r\nNOT EQUAL S$搜索关键字 \"\"\r\nEQUAL N$启用列表缓存 1\r\n#ACT\r\nGOTO @批量列表缓存循环\r\nBREAK\r\n\r\nMOV N$批量当前扫描行 0\r\nMOV N$批量已跳过数量 0\r\nMOV N$批量需要跳过数量 <$STR(N$当前页码)>\r\nDEC N$批量需要跳过数量 1\r\nMUL N$批量需要跳过数量 <$STR(N$每页条数)>\r\nMOV N$批量当前页已处理数 0\r\nGOTO @批量搜索循环\r\nBREAK\r\n\r\n[@批量列表缓存循环]\r\n#IF\r\n#ACT\r\nMOV N$批量列表缓存结束 0\r\nMOV N$防止死循环计数 0\r\nLoopgoto @批量列表缓存循环_单步 81\r\n\r\n#IF\r\nEQUAL N$批量列表缓存结束 1\r\n#ACT\r\nGOTO @咕咕鸡过滤\r\nBREAK\r\n\r\n#IF\r\n#ACT\r\nDELAYGOTO 5 @批量列表缓存循环\r\nBREAK\r\n\r\n[@批量列表缓存循环_单步]\r\n#IF\r\nLARGE N$批量当前页已处理数 17\r\n#ACT\r\nMOV N$批量列表缓存结束 1\r\nendloop\r\nbreak\r\n\r\n#IF\r\nNOT SMALL N$批量当前扫描行 <$STR(N$列表缓存数量)>\r\n#ACT\r\nMOV N$批量列表缓存结束 1\r\nendloop\r\nbreak\r\n\r\n#IF\r\n#ACT\r\nINC N$防止死循环计数 1\r\nMOV S$物品名称 \"\"\r\nMOV S$临时行内容 <$str(L$列表缓存[<$str(N$批量当前扫描行)>])>\r\n\r\n#IF\r\nEQUAL S$临时行内容 \"\"\r\n#ACT\r\nINC N$批量当前扫描行 1\r\nbreak\r\n\r\n#IF\r\n#ACT\r\nTextReplace <$STR(S$临时行内容)> \":\" \"|\" S$临时行内容 0 0\r\nExtractStringEx \"|\" <$STR(S$临时行内容)> S$分解内容\r\nMOV S$物品名称 <$STR(S$分解内容2)>\r\n\r\n#IF\r\nEQUAL S$物品名称 \"\"\r\n#ACT\r\nINC N$批量当前扫描行 1\r\nbreak\r\n\r\n#IF\r\nEQUAL S$当前操作模式 过滤设置\r\n#ACT\r\nMOV S$操作物品名 <$STR(S$物品名称)>\r\nMOV N$当前状态 <$STR(S$批量操作目标状态)>\r\nGOTO @设置过滤状态_批量\r\n\r\n#IF\r\nEQUAL S$当前操作模式 存储设置\r\n#ACT\r\nMOV S$操作物品名 <$STR(S$物品名称)>\r\nMOV N$当前状态 <$STR(S$批量操作目标状态)>\r\nGOTO @设置存储状态_批量\r\n\r\n#IF\r\n#ACT\r\nINC N$批量当前页已处理数 1\r\nINC N$批量当前扫描行 1\r\nbreak\r\n\r\n[@批量搜索循环]\r\n#IF\r\n#ACT\r\nMOV N$批量搜索结束 0\r\nMOV N$防止死循环计数 0\r\nLoopgoto @批量搜索循环_单步 81\r\n\r\n#IF\r\nEQUAL N$批量搜索结束 1\r\n#ACT\r\nGOTO @咕咕鸡过滤\r\nBREAK\r\n\r\n#IF\r\n#ACT\r\nDELAYGOTO 5 @批量搜索循环\r\nBREAK\r\n\r\n[@批量搜索循环_单步]\r\n#IF\r\nLARGE N$批量当前页已处理数 17\r\n#ACT\r\nMOV N$批量搜索结束 1\r\nendloop\r\nbreak\r\n\r\n#IF\r\n#ACT\r\nINC N$防止死循环计数 1\r\nGetListString <$STR(S$读取文件路径)> <$STR(N$批量当前扫描行)> S$物品ID S$物品名称\r\n\r\n#IF\r\nEQUAL S$物品名称 \"\"\r\n#ACT\r\nINC N$批量当前扫描行 1\r\nINC N$连续空行数 1\r\n\r\n#IF\r\nEQUAL S$物品名称 \"\"\r\nLARGE N$连续空行数 10\r\n#ACT\r\nMOV N$批量搜索结束 1\r\nendloop\r\nbreak\r\n\r\n#IF\r\nEQUAL S$物品名称 \"\"\r\n#ACT\r\nbreak\r\n\r\n#IF\r\n#ACT\r\nMOV N$连续空行数 0\r\n\r\n#IF\r\nNOT CheckContainsText <$STR(S$物品名称)> <$STR(S$搜索关键字)>\r\n#ACT\r\nINC N$批量当前扫描行 1\r\nbreak\r\n\r\n#IF\r\nSMALL N$批量已跳过数量 <$STR(N$批量需要跳过数量)>\r\n#ACT\r\nINC N$批量已跳过数量 1\r\nINC N$批量当前扫描行 1\r\nbreak\r\n\r\n#IF\r\nEQUAL S$当前操作模式 过滤设置\r\n#ACT\r\nMOV S$操作物品名 <$STR(S$物品名称)>\r\nMOV N$当前状态 <$STR(S$批量操作目标状态)>\r\nGOTO @设置过滤状态_批量\r\n\r\n#IF\r\nEQUAL S$当前操作模式 存储设置\r\n#ACT\r\nMOV S$操作物品名 <$STR(S$物品名称)>\r\nMOV N$当前状态 <$STR(S$批量操作目标状态)>\r\nGOTO @设置存储状态_批量\r\n\r\n#IF\r\n#ACT\r\nINC N$批量当前页已处理数 1\r\nINC N$批量当前扫描行 1\r\nbreak\r\n\r\n[@虾米批量循环]\r\n#IF\r\n#ACT\r\nMOV N$虾米批量结束 0\r\nMOV N$防止死循环计数 0\r\nLoopgoto @虾米批量循环_单步 81\r\n\r\n#IF\r\nEQUAL N$虾米批量结束 1\r\n#ACT\r\nGOTO @咕咕鸡过滤\r\nBREAK\r\n\r\n#IF\r\n#ACT\r\nDELAYGOTO 5 @虾米批量循环\r\nBREAK\r\n\r\n[@虾米批量循环_单步]\r\n#IF\r\nLARGE N$批量计数器 17\r\n#ACT\r\nMOV N$虾米批量结束 1\r\nendloop\r\nbreak\r\n\r\n#IF\r\n#ACT\r\nINC N$防止死循环计数 1\r\nGetListString <$STR(S$读取文件路径)> <$STR(N$批量循环行)> S$物品ID S$物品名称\r\n\r\n#IF\r\nEQUAL S$物品名称 \"\"\r\n#ACT\r\nINC N$批量循环行 1\r\nINC N$连续空行数 1\r\n\r\n#IF\r\nEQUAL S$物品名称 \"\"\r\nLARGE N$连续空行数 10\r\n#ACT\r\nMOV N$虾米批量结束 1\r\nendloop\r\nbreak\r\n\r\n#IF\r\nEQUAL S$物品名称 \"\"\r\n#ACT\r\nbreak\r\n\r\n#IF\r\n#ACT\r\nMOV N$连续空行数 0\r\n\r\n#IF\r\nEQUAL S$物品名称 \" \"\r\n#ACT\r\nINC N$批量循环行 1\r\nbreak\r\n\r\n#IF\r\nEQUAL S$物品名称 \"  \"\r\n#ACT\r\nINC N$批量循环行 1\r\nbreak\r\n\r\n#IF\r\nEQUAL S$当前操作模式 过滤设置\r\n#ACT\r\nMOV S$操作物品名 <$STR(S$物品名称)>\r\nMOV N$当前状态 <$STR(N$批量操作目标状态)>\r\nGOTO @设置过滤状态_批量\r\n\r\n#IF\r\nEQUAL S$当前操作模式 存储设置\r\n#ACT\r\nMOV S$操作物品名 <$STR(S$物品名称)>\r\nMOV N$当前状态 <$STR(N$批量操作目标状态)>\r\nGOTO @设置存储状态_批量\r\n\r\n#IF\r\n#ACT\r\nINC N$批量循环行 1\r\nINC N$批量计数器 1\r\nbreak\r\n\r\n[@取出物品]\r\n#IF\r\n#ACT\r\nMOV S$物品名称 <$SCRIPTPARAM1>\r\nMOV N$真实数量 <$SCRIPTPARAM3>\r\n\r\n#IF\r\nEQUAL N$真实数量 0\r\n#ACT\r\nMESSAGEBOX 你的仓库里没有【<$SCRIPTPARAM1>】。\r\nBREAK\r\n\r\n#IF\r\n#ACT\r\nmov N$容器索引 <$SCRIPTPARAM4>\r\ndec N$容器索引 1\r\nOPENMERCHANTBIGDLG <$STR(N$虾米资源编号)> 92 1 4 0 0 0\r\nmov N$输入限制 <$STR(N$真实数量)>\r\nMOV N$叠加状态 0\r\nGetDBItemFieldValue <$STR(S$物品名称)> overlap N$叠加状态\r\n\r\n#IF\r\nEQUAL N$叠加状态 0\r\nLARGE N$输入限制 50\r\n#ACT\r\nMOV N$输入限制 50\r\n\r\n\r\n#IF\r\n#SAY\r\n<&Text:<$SCRIPTPARAM1>:115:90{FCOLOR=9;FSIZE=10;FNAME=宋体}>\r\n<&Text:数量:115:113{FCOLOR=9;FSIZE=10;FNAME=宋体}>\r\n<&ItemShow:<$SCRIPTPARAM2>:<$SCRIPTPARAM3>:63:90:1:0:0:0>\r\n<&INPUTNUM:1:145:112:90:16:0:249:253:1:<$str(N$输入限制)>:数量必须输入1-<$str(N$输入限制)>之间的数字:能取出1-<$str(N$输入限制)>件:160> \\\r\n<&ImgEx:<$STR(N$虾米资源编号)>:93:93:94:60:165:1/@虾米提交(<$SCRIPTPARAM1>,<$str(N$输入限制)>,<$str(N$容器索引)>,<$str(N$真实数量)>)>\r\n<&ImgEx:<$STR(N$虾米资源编号)>:95:95:96:160:165/@虾米取消(<$str(N$容器索引)>)>\r\n\r\n[@虾米提交]\r\n#ACT\r\nMOV N$输入数量 <$NPCINPUT(1)>\r\n\r\n#IF\r\nSMALL N$输入数量 1\r\n#ACT\r\nMESSAGEBOX 数量必须输入1-<$SCRIPTPARAM2>之间的数字。\r\nBREAK\r\n\r\n#IF\r\nLARGE N$输入数量 <$SCRIPTPARAM2>\r\n#ACT\r\nMESSAGEBOX 数量必须输入1-<$SCRIPTPARAM2>之间的数字。\r\nBREAK\r\n\r\n#IF\r\n#ACT\r\nMOV N$叠加状态 0\r\nMOV N$需要空格 1\r\nGetDBItemFieldValue <$SCRIPTPARAM1> overlap N$叠加状态\r\n\r\n#IF\r\nEQUAL N$叠加状态 0\r\n#ACT\r\nMOV N$需要空格 <$STR(N$输入数量)>\r\n\r\n#IF\r\nNOT CheckBagSize <$STR(N$需要空格)>\r\n#ACT\r\nMESSAGEBOX 背包空格不足，需要<$str(N$需要空格)>个空格！\r\nBREAK\r\n\r\n#IF\r\n#ACT\r\nFORMULATION <$SCRIPTPARAM4>-<$str(N$输入数量)> N$数量\r\nGive <$SCRIPTPARAM1> <$str(N$输入数量)>\r\n\r\n#IF\r\nSMALL N$数量 1\r\n#ACT\r\nMOV N$数量 0\r\nDelTextList <$STR(S$仓库索引文件)> <$SCRIPTPARAM1>\r\n\r\n#IF\r\n#ACT\r\nWriteConfigFileItem S$仓库数量文件 仓库数量 <$STR(S$物品名称)> <$str(N$数量)>\r\nMOV N$跳到第几个容器2 <$SCRIPTPARAM3>\r\nGOTO @咕咕鸡过滤\r\nBREAK\r\n\r\n[@虾米取消]\r\n#ACT\r\nMOV N$跳到第几个容器2 <$SCRIPTPARAM1>\r\nGOTO @咕咕鸡过滤\r\nBREAK\r\n\r\n[@获取过滤状态_单次]\r\n#IF\r\n#ACT\r\nMOV S$物品名称 <$STR(S$操作物品名)>\r\nMOV N$过滤状态 0\r\n#IF\r\nEQUAL S$用户数据存储地址 \"\"\r\n#ACT\r\nMOV S$用户数据存储地址 ..\\..\\..\\..\\通区文件\\<$SERVERNAME>\\<$USERID>_<$USERNAME>.ini\r\n#IF\r\n#ACT\r\nReadConfigFileItem S$用户数据存储地址 过滤物品 <$STR(S$物品名称)> <$STR(N$过滤状态)>\r\nMOV N$当前状态 <$STR(N$过滤状态)>\r\n\r\n[@获取存储状态_单次]\r\n#IF\r\n#ACT\r\nMOV S$物品名称 <$STR(S$操作物品名)>\r\nMOV N$存储状态 0\r\n#IF\r\nEQUAL S$用户数据存储地址 \"\"\r\n#ACT\r\nMOV S$用户数据存储地址 ..\\..\\..\\..\\通区文件\\<$SERVERNAME>\\<$USERID>_<$USERNAME>.ini\r\n#IF\r\n#ACT\r\nReadConfigFileItem S$用户数据存储地址 存储物品 <$STR(S$物品名称)> <$STR(N$存储状态)>\r\nMOV N$当前状态 <$STR(N$存储状态)>\r\n\r\n[@获取仓库数量_单次]\r\n#IF\r\n#ACT\r\nMOV S$物品名称 <$STR(S$操作物品名)>\r\nMOV N$仓库数量 0\r\n#IF\r\nEQUAL S$用户数据存储地址 \"\"\r\n#ACT\r\nMOV S$用户数据存储地址 ..\\..\\..\\..\\通区文件\\<$SERVERNAME>\\<$USERID>_<$USERNAME>.ini\r\n#IF\r\n#ACT\r\nReadConfigFileItem S$仓库数量文件 仓库数量 <$STR(S$物品名称)> <$STR(N$仓库数量)>\r\nMOV N$库存数量 <$STR(N$仓库数量)>\r\n\r\n[@设置过滤状态_关闭]\r\n#IF\r\n#ACT\r\nWriteConfigFileItem S$用户数据存储地址 过滤物品 <$STR(S$操作物品名)> 87\r\n\r\n[@设置过滤状态_开启]\r\n#IF\r\n#ACT\r\nWriteConfigFileItem S$用户数据存储地址 过滤物品 <$STR(S$操作物品名)> 88\r\n\r\n[@设置过滤状态_批量]\r\n#IF\r\n#ACT\r\nWriteConfigFileItem S$用户数据存储地址 过滤物品 <$STR(S$操作物品名)> <$STR(N$当前状态)>\r\n\r\n[@设置存储状态_关闭]\r\n#IF\r\n#ACT\r\nWriteConfigFileItem S$用户数据存储地址 存储物品 <$STR(S$操作物品名)> 87\r\n\r\n[@设置存储状态_开启]\r\n#IF\r\n#ACT\r\nWriteConfigFileItem S$用户数据存储地址 存储物品 <$STR(S$操作物品名)> 88\r\n\r\n[@设置存储状态_批量]\r\n#IF\r\n#ACT\r\nWriteConfigFileItem S$用户数据存储地址 存储物品 <$STR(S$操作物品名)> <$STR(N$当前状态)>\r\n\r\n[@加载怪物集合]\r\n#if\r\n#act\r\nMOV N$跳到第几个容器 <$SCRIPTPARAM2>\r\ndec N$跳到第几个容器 1\r\nmov S$怪物集合内容\r\nmov S$掉落物品名称 <$SCRIPTPARAM1>\r\nGetTextLineCount <$str(S$物品数据存储地址)><$SCRIPTPARAM1>.txt N$怪物集合总行数\r\nmov N$怪物集合开始行数 0\r\nWhile N$怪物集合开始行数 < N$怪物集合总行数\r\nGetListString <$str(S$物品数据存储地址)><$SCRIPTPARAM1>.txt <$str(N$怪物集合开始行数)> S$怪物名称\r\nINC S$怪物集合内容 <Layout:#L2~#L1<$STR(N$怪物集合开始行数)>:0:3:234:20>\r\nINC S$怪物集合内容 <&Text:#L1<$STR(n$怪物集合开始行数)>~:<$STR(S$怪物名称)>:0:0{FCOLOR=243;FSIZE=12;FNAME=黑体}/@选择怪物(<$STR(S$怪物名称)>,<$STR(n$怪物集合开始行数)>)>\r\ninc N$怪物集合开始行数 1\r\nEndWhile\r\nGOTO @显示最终界面\r\n\r\n[@选择怪物]\r\n#if\r\n#act\r\nGetDBMonsterFieldValue <$SCRIPTPARAM1> appr <$STR(N$怪物APPR)>\r\nGetDBMonsterFieldValue <$SCRIPTPARAM1> raceImg <$STR(N$怪物RaceImg)>\r\nmov <$str(N$跳到第几个怪物容器)> <$SCRIPTPARAM2>\r\nGOTO @加载地图集合(<$SCRIPTPARAM1>)\r\nGOTO @显示最终界面\r\n\r\n[@加载地图集合]\r\n#if\r\nLARGE U599 499\r\n#act\r\nmov S$刷新怪物名称 <$SCRIPTPARAM1>\r\nmov S$地图集合内容\r\nGetTextLineCount <$str(S$地图数据存储地址)><$SCRIPTPARAM1>.txt N$地图集合总行数\r\nmov N$地图集合开始行数 0\r\nWhile N$地图集合开始行数 < N$地图集合总行数\r\nGetListString <$str(S$地图数据存储地址)><$SCRIPTPARAM1>.txt <$str(N$地图集合开始行数)> S$地图名称\r\nExtractStringEx \"|\" <$str(S$地图名称)> S$地图名称数据\r\nINC S$地图集合内容 <Layout:#L3~#L1<$STR(N$地图集合开始行数)>:0:3:234:20>\r\nINC S$地图集合内容 <Text:#L1<$STR(n$地图集合开始行数)>~:<$str(S$地图名称数据2)>:0:0{FCOLOR=215;FSIZE=12;FNAME=黑体}/@虾米飞走(<$str(S$地图名称数据1)>,<$str(S$地图名称数据5)>,<$str(S$地图名称数据6)>)>\r\nINC S$地图集合内容 <Text:#L1<$STR(n$地图集合开始行数)>~:数量<$str(S$地图名称数据3)>:10:0{FCOLOR=243;FSIZE=12;FNAME=黑体}>\r\nINC S$地图集合内容 <Text:#L1<$STR(n$地图集合开始行数)>~:时间<$str(S$地图名称数据4)>:20:0{FCOLOR=243;FSIZE=12;FNAME=黑体}>\r\ninc N$地图集合开始行数 1\r\nEndWhile\r\n#elseact\r\nmov S$刷新怪物名称 <$SCRIPTPARAM1>\r\nmov S$地图集合内容\r\nGetTextLineCount <$str(S$地图数据存储地址)><$SCRIPTPARAM1>.txt N$地图集合总行数\r\nmov N$地图集合开始行数 0\r\nWhile N$地图集合开始行数 < N$地图集合总行数\r\nGetListString <$str(S$地图数据存储地址)><$SCRIPTPARAM1>.txt <$str(N$地图集合开始行数)> S$地图名称\r\nExtractStringEx \"|\" <$str(S$地图名称)> S$地图名称数据\r\nINC S$地图集合内容 <Layout:#L3~#L1<$STR(N$地图集合开始行数)>:0:3:234:20>\r\nINC S$地图集合内容 <Text:#L1<$STR(n$地图集合开始行数)>~:<$str(S$地图名称数据2)>:0:0{FCOLOR=243;FSIZE=12;FNAME=黑体}/@虾米飞走(<$str(S$地图名称数据1)>,<$str(S$地图名称数据5)>,<$str(S$地图名称数据6)>)>\r\nINC S$地图集合内容 <Text:#L1<$STR(n$地图集合开始行数)>~:数量<$str(S$地图名称数据3)>:10:0{FCOLOR=243;FSIZE=12;FNAME=黑体}>\r\nINC S$地图集合内容 <Text:#L1<$STR(n$地图集合开始行数)>~:时间<$str(S$地图名称数据4)>:20:0{FCOLOR=243;FSIZE=12;FNAME=黑体}>\r\ninc N$地图集合开始行数 1\r\nEndWhile\r\n[@虾米飞走]\r\n#IF\r\n#ACT\r\nMOV S$目标地图 <$SCRIPTPARAM1>\r\nMOV N$目标坐标X <$SCRIPTPARAM2>\r\nMOV N$目标坐标Y <$SCRIPTPARAM3>\r\nMAPMOVE <$STR(S$目标地图)> <$STR(N$目标坐标X)> <$STR(N$目标坐标Y)>\r\n}";
const __memMods = new Map();
__memMods.set("iconv-lite/encodings/dbcs-codec.js", "\"use strict\";\nvar Buffer = require(\"safer-buffer\").Buffer;\n\n// Multibyte codec. In this scheme, a character is represented by 1 or more bytes.\n// Our codec supports UTF-16 surrogates, extensions for GB18030 and unicode sequences.\n// To save memory and loading time, we read table files only when requested.\n\nexports._dbcs = DBCSCodec;\n\nvar UNASSIGNED = -1,\n    GB18030_CODE = -2,\n    SEQ_START  = -10,\n    NODE_START = -1000,\n    UNASSIGNED_NODE = new Array(0x100),\n    DEF_CHAR = -1;\n\nfor (var i = 0; i < 0x100; i++)\n    UNASSIGNED_NODE[i] = UNASSIGNED;\n\n\n// Class DBCSCodec reads and initializes mapping tables.\nfunction DBCSCodec(codecOptions, iconv) {\n    this.encodingName = codecOptions.encodingName;\n    if (!codecOptions)\n        throw new Error(\"DBCS codec is called without the data.\")\n    if (!codecOptions.table)\n        throw new Error(\"Encoding '\" + this.encodingName + \"' has no data.\");\n\n    // Load tables.\n    var mappingTable = codecOptions.table();\n\n\n    // Decode tables: MBCS -> Unicode.\n\n    // decodeTables is a trie, encoded as an array of arrays of integers. Internal arrays are trie nodes and all have len = 256.\n    // Trie root is decodeTables[0].\n    // Values: >=  0 -> unicode character code. can be > 0xFFFF\n    //         == UNASSIGNED -> unknown/unassigned sequence.\n    //         == GB18030_CODE -> this is the end of a GB18030 4-byte sequence.\n    //         <= NODE_START -> index of the next node in our trie to process next byte.\n    //         <= SEQ_START  -> index of the start of a character code sequence, in decodeTableSeq.\n    this.decodeTables = [];\n    this.decodeTables[0] = UNASSIGNED_NODE.slice(0); // Create root node.\n\n    // Sometimes a MBCS char corresponds to a sequence of unicode chars. We store them as arrays of integers here. \n    this.decodeTableSeq = [];\n\n    // Actual mapping tables consist of chunks. Use them to fill up decode tables.\n    for (var i = 0; i < mappingTable.length; i++)\n        this._addDecodeChunk(mappingTable[i]);\n\n    // Load & create GB18030 tables when needed.\n    if (typeof codecOptions.gb18030 === 'function') {\n        this.gb18030 = codecOptions.gb18030(); // Load GB18030 ranges.\n\n        // Add GB18030 common decode nodes.\n        var commonThirdByteNodeIdx = this.decodeTables.length;\n        this.decodeTables.push(UNASSIGNED_NODE.slice(0));\n\n        var commonFourthByteNodeIdx = this.decodeTables.length;\n        this.decodeTables.push(UNASSIGNED_NODE.slice(0));\n\n        // Fill out the tree\n        var firstByteNode = this.decodeTables[0];\n        for (var i = 0x81; i <= 0xFE; i++) {\n            var secondByteNode = this.decodeTables[NODE_START - firstByteNode[i]];\n            for (var j = 0x30; j <= 0x39; j++) {\n                if (secondByteNode[j] === UNASSIGNED) {\n                    secondByteNode[j] = NODE_START - commonThirdByteNodeIdx;\n                } else if (secondByteNode[j] > NODE_START) {\n                    throw new Error(\"gb18030 decode tables conflict at byte 2\");\n                }\n\n                var thirdByteNode = this.decodeTables[NODE_START - secondByteNode[j]];\n                for (var k = 0x81; k <= 0xFE; k++) {\n                    if (thirdByteNode[k] === UNASSIGNED) {\n                        thirdByteNode[k] = NODE_START - commonFourthByteNodeIdx;\n                    } else if (thirdByteNode[k] === NODE_START - commonFourthByteNodeIdx) {\n                        continue;\n                    } else if (thirdByteNode[k] > NODE_START) {\n                        throw new Error(\"gb18030 decode tables conflict at byte 3\");\n                    }\n\n                    var fourthByteNode = this.decodeTables[NODE_START - thirdByteNode[k]];\n                    for (var l = 0x30; l <= 0x39; l++) {\n                        if (fourthByteNode[l] === UNASSIGNED)\n                            fourthByteNode[l] = GB18030_CODE;\n                    }\n                }\n            }\n        }\n    }\n\n    this.defaultCharUnicode = iconv.defaultCharUnicode;\n\n    \n    // Encode tables: Unicode -> DBCS.\n\n    // `encodeTable` is array mapping from unicode char to encoded char. All its values are integers for performance.\n    // Because it can be sparse, it is represented as array of buckets by 256 chars each. Bucket can be null.\n    // Values: >=  0 -> it is a normal char. Write the value (if <=256 then 1 byte, if <=65536 then 2 bytes, etc.).\n    //         == UNASSIGNED -> no conversion found. Output a default char.\n    //         <= SEQ_START  -> it's an index in encodeTableSeq, see below. The character starts a sequence.\n    this.encodeTable = [];\n    \n    // `encodeTableSeq` is used when a sequence of unicode characters is encoded as a single code. We use a tree of\n    // objects where keys correspond to characters in sequence and leafs are the encoded dbcs values. A special DEF_CHAR key\n    // means end of sequence (needed when one sequence is a strict subsequence of another).\n    // Objects are kept separately from encodeTable to increase performance.\n    this.encodeTableSeq = [];\n\n    // Some chars can be decoded, but need not be encoded.\n    var skipEncodeChars = {};\n    if (codecOptions.encodeSkipVals)\n        for (var i = 0; i < codecOptions.encodeSkipVals.length; i++) {\n            var val = codecOptions.encodeSkipVals[i];\n            if (typeof val === 'number')\n                skipEncodeChars[val] = true;\n            else\n                for (var j = val.from; j <= val.to; j++)\n                    skipEncodeChars[j] = true;\n        }\n        \n    // Use decode trie to recursively fill out encode tables.\n    this._fillEncodeTable(0, 0, skipEncodeChars);\n\n    // Add more encoding pairs when needed.\n    if (codecOptions.encodeAdd) {\n        for (var uChar in codecOptions.encodeAdd)\n            if (Object.prototype.hasOwnProperty.call(codecOptions.encodeAdd, uChar))\n                this._setEncodeChar(uChar.charCodeAt(0), codecOptions.encodeAdd[uChar]);\n    }\n\n    this.defCharSB  = this.encodeTable[0][iconv.defaultCharSingleByte.charCodeAt(0)];\n    if (this.defCharSB === UNASSIGNED) this.defCharSB = this.encodeTable[0]['?'];\n    if (this.defCharSB === UNASSIGNED) this.defCharSB = \"?\".charCodeAt(0);\n}\n\nDBCSCodec.prototype.encoder = DBCSEncoder;\nDBCSCodec.prototype.decoder = DBCSDecoder;\n\n// Decoder helpers\nDBCSCodec.prototype._getDecodeTrieNode = function(addr) {\n    var bytes = [];\n    for (; addr > 0; addr >>>= 8)\n        bytes.push(addr & 0xFF);\n    if (bytes.length == 0)\n        bytes.push(0);\n\n    var node = this.decodeTables[0];\n    for (var i = bytes.length-1; i > 0; i--) { // Traverse nodes deeper into the trie.\n        var val = node[bytes[i]];\n\n        if (val == UNASSIGNED) { // Create new node.\n            node[bytes[i]] = NODE_START - this.decodeTables.length;\n            this.decodeTables.push(node = UNASSIGNED_NODE.slice(0));\n        }\n        else if (val <= NODE_START) { // Existing node.\n            node = this.decodeTables[NODE_START - val];\n        }\n        else\n            throw new Error(\"Overwrite byte in \" + this.encodingName + \", addr: \" + addr.toString(16));\n    }\n    return node;\n}\n\n\nDBCSCodec.prototype._addDecodeChunk = function(chunk) {\n    // First element of chunk is the hex mbcs code where we start.\n    var curAddr = parseInt(chunk[0], 16);\n\n    // Choose the decoding node where we'll write our chars.\n    var writeTable = this._getDecodeTrieNode(curAddr);\n    curAddr = curAddr & 0xFF;\n\n    // Write all other elements of the chunk to the table.\n    for (var k = 1; k < chunk.length; k++) {\n        var part = chunk[k];\n        if (typeof part === \"string\") { // String, write as-is.\n            for (var l = 0; l < part.length;) {\n                var code = part.charCodeAt(l++);\n                if (0xD800 <= code && code < 0xDC00) { // Decode surrogate\n                    var codeTrail = part.charCodeAt(l++);\n                    if (0xDC00 <= codeTrail && codeTrail < 0xE000)\n                        writeTable[curAddr++] = 0x10000 + (code - 0xD800) * 0x400 + (codeTrail - 0xDC00);\n                    else\n                        throw new Error(\"Incorrect surrogate pair in \"  + this.encodingName + \" at chunk \" + chunk[0]);\n                }\n                else if (0x0FF0 < code && code <= 0x0FFF) { // Character sequence (our own encoding used)\n                    var len = 0xFFF - code + 2;\n                    var seq = [];\n                    for (var m = 0; m < len; m++)\n                        seq.push(part.charCodeAt(l++)); // Simple variation: don't support surrogates or subsequences in seq.\n\n                    writeTable[curAddr++] = SEQ_START - this.decodeTableSeq.length;\n                    this.decodeTableSeq.push(seq);\n                }\n                else\n                    writeTable[curAddr++] = code; // Basic char\n            }\n        } \n        else if (typeof part === \"number\") { // Integer, meaning increasing sequence starting with prev character.\n            var charCode = writeTable[curAddr - 1] + 1;\n            for (var l = 0; l < part; l++)\n                writeTable[curAddr++] = charCode++;\n        }\n        else\n            throw new Error(\"Incorrect type '\" + typeof part + \"' given in \"  + this.encodingName + \" at chunk \" + chunk[0]);\n    }\n    if (curAddr > 0xFF)\n        throw new Error(\"Incorrect chunk in \"  + this.encodingName + \" at addr \" + chunk[0] + \": too long\" + curAddr);\n}\n\n// Encoder helpers\nDBCSCodec.prototype._getEncodeBucket = function(uCode) {\n    var high = uCode >> 8; // This could be > 0xFF because of astral characters.\n    if (this.encodeTable[high] === undefined)\n        this.encodeTable[high] = UNASSIGNED_NODE.slice(0); // Create bucket on demand.\n    return this.encodeTable[high];\n}\n\nDBCSCodec.prototype._setEncodeChar = function(uCode, dbcsCode) {\n    var bucket = this._getEncodeBucket(uCode);\n    var low = uCode & 0xFF;\n    if (bucket[low] <= SEQ_START)\n        this.encodeTableSeq[SEQ_START-bucket[low]][DEF_CHAR] = dbcsCode; // There's already a sequence, set a single-char subsequence of it.\n    else if (bucket[low] == UNASSIGNED)\n        bucket[low] = dbcsCode;\n}\n\nDBCSCodec.prototype._setEncodeSequence = function(seq, dbcsCode) {\n    \n    // Get the root of character tree according to first character of the sequence.\n    var uCode = seq[0];\n    var bucket = this._getEncodeBucket(uCode);\n    var low = uCode & 0xFF;\n\n    var node;\n    if (bucket[low] <= SEQ_START) {\n        // There's already a sequence with  - use it.\n        node = this.encodeTableSeq[SEQ_START-bucket[low]];\n    }\n    else {\n        // There was no sequence object - allocate a new one.\n        node = {};\n        if (bucket[low] !== UNASSIGNED) node[DEF_CHAR] = bucket[low]; // If a char was set before - make it a single-char subsequence.\n        bucket[low] = SEQ_START - this.encodeTableSeq.length;\n        this.encodeTableSeq.push(node);\n    }\n\n    // Traverse the character tree, allocating new nodes as needed.\n    for (var j = 1; j < seq.length-1; j++) {\n        var oldVal = node[uCode];\n        if (typeof oldVal === 'object')\n            node = oldVal;\n        else {\n            node = node[uCode] = {}\n            if (oldVal !== undefined)\n                node[DEF_CHAR] = oldVal\n        }\n    }\n\n    // Set the leaf to given dbcsCode.\n    uCode = seq[seq.length-1];\n    node[uCode] = dbcsCode;\n}\n\nDBCSCodec.prototype._fillEncodeTable = function(nodeIdx, prefix, skipEncodeChars) {\n    var node = this.decodeTables[nodeIdx];\n    var hasValues = false;\n    var subNodeEmpty = {};\n    for (var i = 0; i < 0x100; i++) {\n        var uCode = node[i];\n        var mbCode = prefix + i;\n        if (skipEncodeChars[mbCode])\n            continue;\n\n        if (uCode >= 0) {\n            this._setEncodeChar(uCode, mbCode);\n            hasValues = true;\n        } else if (uCode <= NODE_START) {\n            var subNodeIdx = NODE_START - uCode;\n            if (!subNodeEmpty[subNodeIdx]) {  // Skip empty subtrees (they are too large in gb18030).\n                var newPrefix = (mbCode << 8) >>> 0;  // NOTE: '>>> 0' keeps 32-bit num positive.\n                if (this._fillEncodeTable(subNodeIdx, newPrefix, skipEncodeChars))\n                    hasValues = true;\n                else\n                    subNodeEmpty[subNodeIdx] = true;\n            }\n        } else if (uCode <= SEQ_START) {\n            this._setEncodeSequence(this.decodeTableSeq[SEQ_START - uCode], mbCode);\n            hasValues = true;\n        }\n    }\n    return hasValues;\n}\n\n\n\n// == Encoder ==================================================================\n\nfunction DBCSEncoder(options, codec) {\n    // Encoder state\n    this.leadSurrogate = -1;\n    this.seqObj = undefined;\n    \n    // Static data\n    this.encodeTable = codec.encodeTable;\n    this.encodeTableSeq = codec.encodeTableSeq;\n    this.defaultCharSingleByte = codec.defCharSB;\n    this.gb18030 = codec.gb18030;\n}\n\nDBCSEncoder.prototype.write = function(str) {\n    var newBuf = Buffer.alloc(str.length * (this.gb18030 ? 4 : 3)),\n        leadSurrogate = this.leadSurrogate,\n        seqObj = this.seqObj, nextChar = -1,\n        i = 0, j = 0;\n\n    while (true) {\n        // 0. Get next character.\n        if (nextChar === -1) {\n            if (i == str.length) break;\n            var uCode = str.charCodeAt(i++);\n        }\n        else {\n            var uCode = nextChar;\n            nextChar = -1;    \n        }\n\n        // 1. Handle surrogates.\n        if (0xD800 <= uCode && uCode < 0xE000) { // Char is one of surrogates.\n            if (uCode < 0xDC00) { // We've got lead surrogate.\n                if (leadSurrogate === -1) {\n                    leadSurrogate = uCode;\n                    continue;\n                } else {\n                    leadSurrogate = uCode;\n                    // Double lead surrogate found.\n                    uCode = UNASSIGNED;\n                }\n            } else { // We've got trail surrogate.\n                if (leadSurrogate !== -1) {\n                    uCode = 0x10000 + (leadSurrogate - 0xD800) * 0x400 + (uCode - 0xDC00);\n                    leadSurrogate = -1;\n                } else {\n                    // Incomplete surrogate pair - only trail surrogate found.\n                    uCode = UNASSIGNED;\n                }\n                \n            }\n        }\n        else if (leadSurrogate !== -1) {\n            // Incomplete surrogate pair - only lead surrogate found.\n            nextChar = uCode; uCode = UNASSIGNED; // Write an error, then current char.\n            leadSurrogate = -1;\n        }\n\n        // 2. Convert uCode character.\n        var dbcsCode = UNASSIGNED;\n        if (seqObj !== undefined && uCode != UNASSIGNED) { // We are in the middle of the sequence\n            var resCode = seqObj[uCode];\n            if (typeof resCode === 'object') { // Sequence continues.\n                seqObj = resCode;\n                continue;\n\n            } else if (typeof resCode == 'number') { // Sequence finished. Write it.\n                dbcsCode = resCode;\n\n            } else if (resCode == undefined) { // Current character is not part of the sequence.\n\n                // Try default character for this sequence\n                resCode = seqObj[DEF_CHAR];\n                if (resCode !== undefined) {\n                    dbcsCode = resCode; // Found. Write it.\n                    nextChar = uCode; // Current character will be written too in the next iteration.\n\n                } else {\n                    // TODO: What if we have no default? (resCode == undefined)\n                    // Then, we should write first char of the sequence as-is and try the rest recursively.\n                    // Didn't do it for now because no encoding has this situation yet.\n                    // Currently, just skip the sequence and write current char.\n                }\n            }\n            seqObj = undefined;\n        }\n        else if (uCode >= 0) {  // Regular character\n            var subtable = this.encodeTable[uCode >> 8];\n            if (subtable !== undefined)\n                dbcsCode = subtable[uCode & 0xFF];\n            \n            if (dbcsCode <= SEQ_START) { // Sequence start\n                seqObj = this.encodeTableSeq[SEQ_START-dbcsCode];\n                continue;\n            }\n\n            if (dbcsCode == UNASSIGNED && this.gb18030) {\n                // Use GB18030 algorithm to find character(s) to write.\n                var idx = findIdx(this.gb18030.uChars, uCode);\n                if (idx != -1) {\n                    var dbcsCode = this.gb18030.gbChars[idx] + (uCode - this.gb18030.uChars[idx]);\n                    newBuf[j++] = 0x81 + Math.floor(dbcsCode / 12600); dbcsCode = dbcsCode % 12600;\n                    newBuf[j++] = 0x30 + Math.floor(dbcsCode / 1260); dbcsCode = dbcsCode % 1260;\n                    newBuf[j++] = 0x81 + Math.floor(dbcsCode / 10); dbcsCode = dbcsCode % 10;\n                    newBuf[j++] = 0x30 + dbcsCode;\n                    continue;\n                }\n            }\n        }\n\n        // 3. Write dbcsCode character.\n        if (dbcsCode === UNASSIGNED)\n            dbcsCode = this.defaultCharSingleByte;\n        \n        if (dbcsCode < 0x100) {\n            newBuf[j++] = dbcsCode;\n        }\n        else if (dbcsCode < 0x10000) {\n            newBuf[j++] = dbcsCode >> 8;   // high byte\n            newBuf[j++] = dbcsCode & 0xFF; // low byte\n        }\n        else if (dbcsCode < 0x1000000) {\n            newBuf[j++] = dbcsCode >> 16;\n            newBuf[j++] = (dbcsCode >> 8) & 0xFF;\n            newBuf[j++] = dbcsCode & 0xFF;\n        } else {\n            newBuf[j++] = dbcsCode >>> 24;\n            newBuf[j++] = (dbcsCode >>> 16) & 0xFF;\n            newBuf[j++] = (dbcsCode >>> 8) & 0xFF;\n            newBuf[j++] = dbcsCode & 0xFF;\n        }\n    }\n\n    this.seqObj = seqObj;\n    this.leadSurrogate = leadSurrogate;\n    return newBuf.slice(0, j);\n}\n\nDBCSEncoder.prototype.end = function() {\n    if (this.leadSurrogate === -1 && this.seqObj === undefined)\n        return; // All clean. Most often case.\n\n    var newBuf = Buffer.alloc(10), j = 0;\n\n    if (this.seqObj) { // We're in the sequence.\n        var dbcsCode = this.seqObj[DEF_CHAR];\n        if (dbcsCode !== undefined) { // Write beginning of the sequence.\n            if (dbcsCode < 0x100) {\n                newBuf[j++] = dbcsCode;\n            }\n            else {\n                newBuf[j++] = dbcsCode >> 8;   // high byte\n                newBuf[j++] = dbcsCode & 0xFF; // low byte\n            }\n        } else {\n            // See todo above.\n        }\n        this.seqObj = undefined;\n    }\n\n    if (this.leadSurrogate !== -1) {\n        // Incomplete surrogate pair - only lead surrogate found.\n        newBuf[j++] = this.defaultCharSingleByte;\n        this.leadSurrogate = -1;\n    }\n    \n    return newBuf.slice(0, j);\n}\n\n// Export for testing\nDBCSEncoder.prototype.findIdx = findIdx;\n\n\n// == Decoder ==================================================================\n\nfunction DBCSDecoder(options, codec) {\n    // Decoder state\n    this.nodeIdx = 0;\n    this.prevBytes = [];\n\n    // Static data\n    this.decodeTables = codec.decodeTables;\n    this.decodeTableSeq = codec.decodeTableSeq;\n    this.defaultCharUnicode = codec.defaultCharUnicode;\n    this.gb18030 = codec.gb18030;\n}\n\nDBCSDecoder.prototype.write = function(buf) {\n    var newBuf = Buffer.alloc(buf.length*2),\n        nodeIdx = this.nodeIdx, \n        prevBytes = this.prevBytes, prevOffset = this.prevBytes.length,\n        seqStart = -this.prevBytes.length, // idx of the start of current parsed sequence.\n        uCode;\n\n    for (var i = 0, j = 0; i < buf.length; i++) {\n        var curByte = (i >= 0) ? buf[i] : prevBytes[i + prevOffset];\n\n        // Lookup in current trie node.\n        var uCode = this.decodeTables[nodeIdx][curByte];\n\n        if (uCode >= 0) { \n            // Normal character, just use it.\n        }\n        else if (uCode === UNASSIGNED) { // Unknown char.\n            // TODO: Callback with seq.\n            uCode = this.defaultCharUnicode.charCodeAt(0);\n            i = seqStart; // Skip one byte ('i' will be incremented by the for loop) and try to parse again.\n        }\n        else if (uCode === GB18030_CODE) {\n            if (i >= 3) {\n                var ptr = (buf[i-3]-0x81)*12600 + (buf[i-2]-0x30)*1260 + (buf[i-1]-0x81)*10 + (curByte-0x30);\n            } else {\n                var ptr = (prevBytes[i-3+prevOffset]-0x81)*12600 + \n                          (((i-2 >= 0) ? buf[i-2] : prevBytes[i-2+prevOffset])-0x30)*1260 + \n                          (((i-1 >= 0) ? buf[i-1] : prevBytes[i-1+prevOffset])-0x81)*10 + \n                          (curByte-0x30);\n            }\n            var idx = findIdx(this.gb18030.gbChars, ptr);\n            uCode = this.gb18030.uChars[idx] + ptr - this.gb18030.gbChars[idx];\n        }\n        else if (uCode <= NODE_START) { // Go to next trie node.\n            nodeIdx = NODE_START - uCode;\n            continue;\n        }\n        else if (uCode <= SEQ_START) { // Output a sequence of chars.\n            var seq = this.decodeTableSeq[SEQ_START - uCode];\n            for (var k = 0; k < seq.length - 1; k++) {\n                uCode = seq[k];\n                newBuf[j++] = uCode & 0xFF;\n                newBuf[j++] = uCode >> 8;\n            }\n            uCode = seq[seq.length-1];\n        }\n        else\n            throw new Error(\"iconv-lite internal error: invalid decoding table value \" + uCode + \" at \" + nodeIdx + \"/\" + curByte);\n\n        // Write the character to buffer, handling higher planes using surrogate pair.\n        if (uCode >= 0x10000) { \n            uCode -= 0x10000;\n            var uCodeLead = 0xD800 | (uCode >> 10);\n            newBuf[j++] = uCodeLead & 0xFF;\n            newBuf[j++] = uCodeLead >> 8;\n\n            uCode = 0xDC00 | (uCode & 0x3FF);\n        }\n        newBuf[j++] = uCode & 0xFF;\n        newBuf[j++] = uCode >> 8;\n\n        // Reset trie node.\n        nodeIdx = 0; seqStart = i+1;\n    }\n\n    this.nodeIdx = nodeIdx;\n    this.prevBytes = (seqStart >= 0)\n        ? Array.prototype.slice.call(buf, seqStart)\n        : prevBytes.slice(seqStart + prevOffset).concat(Array.prototype.slice.call(buf));\n\n    return newBuf.slice(0, j).toString('ucs2');\n}\n\nDBCSDecoder.prototype.end = function() {\n    var ret = '';\n\n    // Try to parse all remaining chars.\n    while (this.prevBytes.length > 0) {\n        // Skip 1 character in the buffer.\n        ret += this.defaultCharUnicode;\n        var bytesArr = this.prevBytes.slice(1);\n\n        // Parse remaining as usual.\n        this.prevBytes = [];\n        this.nodeIdx = 0;\n        if (bytesArr.length > 0)\n            ret += this.write(bytesArr);\n    }\n\n    this.prevBytes = [];\n    this.nodeIdx = 0;\n    return ret;\n}\n\n// Binary search for GB18030. Returns largest i such that table[i] <= val.\nfunction findIdx(table, val) {\n    if (table[0] > val)\n        return -1;\n\n    var l = 0, r = table.length;\n    while (l < r-1) { // always table[l] <= val < table[r]\n        var mid = l + ((r-l+1) >> 1);\n        if (table[mid] <= val)\n            l = mid;\n        else\n            r = mid;\n    }\n    return l;\n}\n\n");
__memMods.set("iconv-lite/encodings/dbcs-data.js", "\"use strict\";\n\n// Description of supported double byte encodings and aliases.\n// Tables are not require()-d until they are needed to speed up library load.\n// require()-s are direct to support Browserify.\n\nmodule.exports = {\n    \n    // == Japanese/ShiftJIS ====================================================\n    // All japanese encodings are based on JIS X set of standards:\n    // JIS X 0201 - Single-byte encoding of ASCII + ¥ + Kana chars at 0xA1-0xDF.\n    // JIS X 0208 - Main set of 6879 characters, placed in 94x94 plane, to be encoded by 2 bytes. \n    //              Has several variations in 1978, 1983, 1990 and 1997.\n    // JIS X 0212 - Supplementary plane of 6067 chars in 94x94 plane. 1990. Effectively dead.\n    // JIS X 0213 - Extension and modern replacement of 0208 and 0212. Total chars: 11233.\n    //              2 planes, first is superset of 0208, second - revised 0212.\n    //              Introduced in 2000, revised 2004. Some characters are in Unicode Plane 2 (0x2xxxx)\n\n    // Byte encodings are:\n    //  * Shift_JIS: Compatible with 0201, uses not defined chars in top half as lead bytes for double-byte\n    //               encoding of 0208. Lead byte ranges: 0x81-0x9F, 0xE0-0xEF; Trail byte ranges: 0x40-0x7E, 0x80-0x9E, 0x9F-0xFC.\n    //               Windows CP932 is a superset of Shift_JIS. Some companies added more chars, notably KDDI.\n    //  * EUC-JP:    Up to 3 bytes per character. Used mostly on *nixes.\n    //               0x00-0x7F       - lower part of 0201\n    //               0x8E, 0xA1-0xDF - upper part of 0201\n    //               (0xA1-0xFE)x2   - 0208 plane (94x94).\n    //               0x8F, (0xA1-0xFE)x2 - 0212 plane (94x94).\n    //  * JIS X 208: 7-bit, direct encoding of 0208. Byte ranges: 0x21-0x7E (94 values). Uncommon.\n    //               Used as-is in ISO2022 family.\n    //  * ISO2022-JP: Stateful encoding, with escape sequences to switch between ASCII, \n    //                0201-1976 Roman, 0208-1978, 0208-1983.\n    //  * ISO2022-JP-1: Adds esc seq for 0212-1990.\n    //  * ISO2022-JP-2: Adds esc seq for GB2313-1980, KSX1001-1992, ISO8859-1, ISO8859-7.\n    //  * ISO2022-JP-3: Adds esc seq for 0201-1976 Kana set, 0213-2000 Planes 1, 2.\n    //  * ISO2022-JP-2004: Adds 0213-2004 Plane 1.\n    //\n    // After JIS X 0213 appeared, Shift_JIS-2004, EUC-JISX0213 and ISO2022-JP-2004 followed, with just changing the planes.\n    //\n    // Overall, it seems that it's a mess :( http://www8.plala.or.jp/tkubota1/unicode-symbols-map2.html\n\n    'shiftjis': {\n        type: '_dbcs',\n        table: function() { return require('./tables/shiftjis.json') },\n        encodeAdd: {'\\u00a5': 0x5C, '\\u203E': 0x7E},\n        encodeSkipVals: [{from: 0xED40, to: 0xF940}],\n    },\n    'csshiftjis': 'shiftjis',\n    'mskanji': 'shiftjis',\n    'sjis': 'shiftjis',\n    'windows31j': 'shiftjis',\n    'ms31j': 'shiftjis',\n    'xsjis': 'shiftjis',\n    'windows932': 'shiftjis',\n    'ms932': 'shiftjis',\n    '932': 'shiftjis',\n    'cp932': 'shiftjis',\n\n    'eucjp': {\n        type: '_dbcs',\n        table: function() { return require('./tables/eucjp.json') },\n        encodeAdd: {'\\u00a5': 0x5C, '\\u203E': 0x7E},\n    },\n\n    // TODO: KDDI extension to Shift_JIS\n    // TODO: IBM CCSID 942 = CP932, but F0-F9 custom chars and other char changes.\n    // TODO: IBM CCSID 943 = Shift_JIS = CP932 with original Shift_JIS lower 128 chars.\n\n\n    // == Chinese/GBK ==========================================================\n    // http://en.wikipedia.org/wiki/GBK\n    // We mostly implement W3C recommendation: https://www.w3.org/TR/encoding/#gbk-encoder\n\n    // Oldest GB2312 (1981, ~7600 chars) is a subset of CP936\n    'gb2312': 'cp936',\n    'gb231280': 'cp936',\n    'gb23121980': 'cp936',\n    'csgb2312': 'cp936',\n    'csiso58gb231280': 'cp936',\n    'euccn': 'cp936',\n\n    // Microsoft's CP936 is a subset and approximation of GBK.\n    'windows936': 'cp936',\n    'ms936': 'cp936',\n    '936': 'cp936',\n    'cp936': {\n        type: '_dbcs',\n        table: function() { return require('./tables/cp936.json') },\n    },\n\n    // GBK (~22000 chars) is an extension of CP936 that added user-mapped chars and some other.\n    'gbk': {\n        type: '_dbcs',\n        table: function() { return require('./tables/cp936.json').concat(require('./tables/gbk-added.json')) },\n    },\n    'xgbk': 'gbk',\n    'isoir58': 'gbk',\n\n    // GB18030 is an algorithmic extension of GBK.\n    // Main source: https://www.w3.org/TR/encoding/#gbk-encoder\n    // http://icu-project.org/docs/papers/gb18030.html\n    // http://source.icu-project.org/repos/icu/data/trunk/charset/data/xml/gb-18030-2000.xml\n    // http://www.khngai.com/chinese/charmap/tblgbk.php?page=0\n    'gb18030': {\n        type: '_dbcs',\n        table: function() { return require('./tables/cp936.json').concat(require('./tables/gbk-added.json')) },\n        gb18030: function() { return require('./tables/gb18030-ranges.json') },\n        encodeSkipVals: [0x80],\n        encodeAdd: {'€': 0xA2E3},\n    },\n\n    'chinese': 'gb18030',\n\n\n    // == Korean ===============================================================\n    // EUC-KR, KS_C_5601 and KS X 1001 are exactly the same.\n    'windows949': 'cp949',\n    'ms949': 'cp949',\n    '949': 'cp949',\n    'cp949': {\n        type: '_dbcs',\n        table: function() { return require('./tables/cp949.json') },\n    },\n\n    'cseuckr': 'cp949',\n    'csksc56011987': 'cp949',\n    'euckr': 'cp949',\n    'isoir149': 'cp949',\n    'korean': 'cp949',\n    'ksc56011987': 'cp949',\n    'ksc56011989': 'cp949',\n    'ksc5601': 'cp949',\n\n\n    // == Big5/Taiwan/Hong Kong ================================================\n    // There are lots of tables for Big5 and cp950. Please see the following links for history:\n    // http://moztw.org/docs/big5/  http://www.haible.de/bruno/charsets/conversion-tables/Big5.html\n    // Variations, in roughly number of defined chars:\n    //  * Windows CP 950: Microsoft variant of Big5. Canonical: http://www.unicode.org/Public/MAPPINGS/VENDORS/MICSFT/WINDOWS/CP950.TXT\n    //  * Windows CP 951: Microsoft variant of Big5-HKSCS-2001. Seems to be never public. http://me.abelcheung.org/articles/research/what-is-cp951/\n    //  * Big5-2003 (Taiwan standard) almost superset of cp950.\n    //  * Unicode-at-on (UAO) / Mozilla 1.8. Falling out of use on the Web. Not supported by other browsers.\n    //  * Big5-HKSCS (-2001, -2004, -2008). Hong Kong standard. \n    //    many unicode code points moved from PUA to Supplementary plane (U+2XXXX) over the years.\n    //    Plus, it has 4 combining sequences.\n    //    Seems that Mozilla refused to support it for 10 yrs. https://bugzilla.mozilla.org/show_bug.cgi?id=162431 https://bugzilla.mozilla.org/show_bug.cgi?id=310299\n    //    because big5-hkscs is the only encoding to include astral characters in non-algorithmic way.\n    //    Implementations are not consistent within browsers; sometimes labeled as just big5.\n    //    MS Internet Explorer switches from big5 to big5-hkscs when a patch applied.\n    //    Great discussion & recap of what's going on https://bugzilla.mozilla.org/show_bug.cgi?id=912470#c31\n    //    In the encoder, it might make sense to support encoding old PUA mappings to Big5 bytes seq-s.\n    //    Official spec: http://www.ogcio.gov.hk/en/business/tech_promotion/ccli/terms/doc/2003cmp_2008.txt\n    //                   http://www.ogcio.gov.hk/tc/business/tech_promotion/ccli/terms/doc/hkscs-2008-big5-iso.txt\n    // \n    // Current understanding of how to deal with Big5(-HKSCS) is in the Encoding Standard, http://encoding.spec.whatwg.org/#big5-encoder\n    // Unicode mapping (http://www.unicode.org/Public/MAPPINGS/OBSOLETE/EASTASIA/OTHER/BIG5.TXT) is said to be wrong.\n\n    'windows950': 'cp950',\n    'ms950': 'cp950',\n    '950': 'cp950',\n    'cp950': {\n        type: '_dbcs',\n        table: function() { return require('./tables/cp950.json') },\n    },\n\n    // Big5 has many variations and is an extension of cp950. We use Encoding Standard's as a consensus.\n    'big5': 'big5hkscs',\n    'big5hkscs': {\n        type: '_dbcs',\n        table: function() { return require('./tables/cp950.json').concat(require('./tables/big5-added.json')) },\n        encodeSkipVals: [\n            // Although Encoding Standard says we should avoid encoding to HKSCS area (See Step 1 of\n            // https://encoding.spec.whatwg.org/#index-big5-pointer), we still do it to increase compatibility with ICU.\n            // But if a single unicode point can be encoded both as HKSCS and regular Big5, we prefer the latter.\n            0x8e69, 0x8e6f, 0x8e7e, 0x8eab, 0x8eb4, 0x8ecd, 0x8ed0, 0x8f57, 0x8f69, 0x8f6e, 0x8fcb, 0x8ffe,\n            0x906d, 0x907a, 0x90c4, 0x90dc, 0x90f1, 0x91bf, 0x92af, 0x92b0, 0x92b1, 0x92b2, 0x92d1, 0x9447, 0x94ca,\n            0x95d9, 0x96fc, 0x9975, 0x9b76, 0x9b78, 0x9b7b, 0x9bc6, 0x9bde, 0x9bec, 0x9bf6, 0x9c42, 0x9c53, 0x9c62,\n            0x9c68, 0x9c6b, 0x9c77, 0x9cbc, 0x9cbd, 0x9cd0, 0x9d57, 0x9d5a, 0x9dc4, 0x9def, 0x9dfb, 0x9ea9, 0x9eef,\n            0x9efd, 0x9f60, 0x9fcb, 0xa077, 0xa0dc, 0xa0df, 0x8fcc, 0x92c8, 0x9644, 0x96ed,\n\n            // Step 2 of https://encoding.spec.whatwg.org/#index-big5-pointer: Use last pointer for U+2550, U+255E, U+2561, U+256A, U+5341, or U+5345\n            0xa2a4, 0xa2a5, 0xa2a7, 0xa2a6, 0xa2cc, 0xa2ce,\n        ],\n    },\n\n    'cnbig5': 'big5hkscs',\n    'csbig5': 'big5hkscs',\n    'xxbig5': 'big5hkscs',\n};\n");
__memMods.set("iconv-lite/encodings/index.js", "\"use strict\";\n\n// Update this array if you add/rename/remove files in this directory.\n// We support Browserify by skipping automatic module discovery and requiring modules directly.\nvar modules = [\n    require(\"./internal\"),\n    require(\"./utf32\"),\n    require(\"./utf16\"),\n    require(\"./utf7\"),\n    require(\"./sbcs-codec\"),\n    require(\"./sbcs-data\"),\n    require(\"./sbcs-data-generated\"),\n    require(\"./dbcs-codec\"),\n    require(\"./dbcs-data\"),\n];\n\n// Put all encoding/alias/codec definitions to single object and export it.\nfor (var i = 0; i < modules.length; i++) {\n    var module = modules[i];\n    for (var enc in module)\n        if (Object.prototype.hasOwnProperty.call(module, enc))\n            exports[enc] = module[enc];\n}\n");
__memMods.set("iconv-lite/encodings/internal.js", "\"use strict\";\nvar Buffer = require(\"safer-buffer\").Buffer;\n\n// Export Node.js internal encodings.\n\nmodule.exports = {\n    // Encodings\n    utf8:   { type: \"_internal\", bomAware: true},\n    cesu8:  { type: \"_internal\", bomAware: true},\n    unicode11utf8: \"utf8\",\n\n    ucs2:   { type: \"_internal\", bomAware: true},\n    utf16le: \"ucs2\",\n\n    binary: { type: \"_internal\" },\n    base64: { type: \"_internal\" },\n    hex:    { type: \"_internal\" },\n\n    // Codec.\n    _internal: InternalCodec,\n};\n\n//------------------------------------------------------------------------------\n\nfunction InternalCodec(codecOptions, iconv) {\n    this.enc = codecOptions.encodingName;\n    this.bomAware = codecOptions.bomAware;\n\n    if (this.enc === \"base64\")\n        this.encoder = InternalEncoderBase64;\n    else if (this.enc === \"cesu8\") {\n        this.enc = \"utf8\"; // Use utf8 for decoding.\n        this.encoder = InternalEncoderCesu8;\n\n        // Add decoder for versions of Node not supporting CESU-8\n        if (Buffer.from('eda0bdedb2a9', 'hex').toString() !== '💩') {\n            this.decoder = InternalDecoderCesu8;\n            this.defaultCharUnicode = iconv.defaultCharUnicode;\n        }\n    }\n}\n\nInternalCodec.prototype.encoder = InternalEncoder;\nInternalCodec.prototype.decoder = InternalDecoder;\n\n//------------------------------------------------------------------------------\n\n// We use node.js internal decoder. Its signature is the same as ours.\nvar StringDecoder = require('string_decoder').StringDecoder;\n\nif (!StringDecoder.prototype.end) // Node v0.8 doesn't have this method.\n    StringDecoder.prototype.end = function() {};\n\n\nfunction InternalDecoder(options, codec) {\n    this.decoder = new StringDecoder(codec.enc);\n}\n\nInternalDecoder.prototype.write = function(buf) {\n    if (!Buffer.isBuffer(buf)) {\n        buf = Buffer.from(buf);\n    }\n\n    return this.decoder.write(buf);\n}\n\nInternalDecoder.prototype.end = function() {\n    return this.decoder.end();\n}\n\n\n//------------------------------------------------------------------------------\n// Encoder is mostly trivial\n\nfunction InternalEncoder(options, codec) {\n    this.enc = codec.enc;\n}\n\nInternalEncoder.prototype.write = function(str) {\n    return Buffer.from(str, this.enc);\n}\n\nInternalEncoder.prototype.end = function() {\n}\n\n\n//------------------------------------------------------------------------------\n// Except base64 encoder, which must keep its state.\n\nfunction InternalEncoderBase64(options, codec) {\n    this.prevStr = '';\n}\n\nInternalEncoderBase64.prototype.write = function(str) {\n    str = this.prevStr + str;\n    var completeQuads = str.length - (str.length % 4);\n    this.prevStr = str.slice(completeQuads);\n    str = str.slice(0, completeQuads);\n\n    return Buffer.from(str, \"base64\");\n}\n\nInternalEncoderBase64.prototype.end = function() {\n    return Buffer.from(this.prevStr, \"base64\");\n}\n\n\n//------------------------------------------------------------------------------\n// CESU-8 encoder is also special.\n\nfunction InternalEncoderCesu8(options, codec) {\n}\n\nInternalEncoderCesu8.prototype.write = function(str) {\n    var buf = Buffer.alloc(str.length * 3), bufIdx = 0;\n    for (var i = 0; i < str.length; i++) {\n        var charCode = str.charCodeAt(i);\n        // Naive implementation, but it works because CESU-8 is especially easy\n        // to convert from UTF-16 (which all JS strings are encoded in).\n        if (charCode < 0x80)\n            buf[bufIdx++] = charCode;\n        else if (charCode < 0x800) {\n            buf[bufIdx++] = 0xC0 + (charCode >>> 6);\n            buf[bufIdx++] = 0x80 + (charCode & 0x3f);\n        }\n        else { // charCode will always be < 0x10000 in javascript.\n            buf[bufIdx++] = 0xE0 + (charCode >>> 12);\n            buf[bufIdx++] = 0x80 + ((charCode >>> 6) & 0x3f);\n            buf[bufIdx++] = 0x80 + (charCode & 0x3f);\n        }\n    }\n    return buf.slice(0, bufIdx);\n}\n\nInternalEncoderCesu8.prototype.end = function() {\n}\n\n//------------------------------------------------------------------------------\n// CESU-8 decoder is not implemented in Node v4.0+\n\nfunction InternalDecoderCesu8(options, codec) {\n    this.acc = 0;\n    this.contBytes = 0;\n    this.accBytes = 0;\n    this.defaultCharUnicode = codec.defaultCharUnicode;\n}\n\nInternalDecoderCesu8.prototype.write = function(buf) {\n    var acc = this.acc, contBytes = this.contBytes, accBytes = this.accBytes, \n        res = '';\n    for (var i = 0; i < buf.length; i++) {\n        var curByte = buf[i];\n        if ((curByte & 0xC0) !== 0x80) { // Leading byte\n            if (contBytes > 0) { // Previous code is invalid\n                res += this.defaultCharUnicode;\n                contBytes = 0;\n            }\n\n            if (curByte < 0x80) { // Single-byte code\n                res += String.fromCharCode(curByte);\n            } else if (curByte < 0xE0) { // Two-byte code\n                acc = curByte & 0x1F;\n                contBytes = 1; accBytes = 1;\n            } else if (curByte < 0xF0) { // Three-byte code\n                acc = curByte & 0x0F;\n                contBytes = 2; accBytes = 1;\n            } else { // Four or more are not supported for CESU-8.\n                res += this.defaultCharUnicode;\n            }\n        } else { // Continuation byte\n            if (contBytes > 0) { // We're waiting for it.\n                acc = (acc << 6) | (curByte & 0x3f);\n                contBytes--; accBytes++;\n                if (contBytes === 0) {\n                    // Check for overlong encoding, but support Modified UTF-8 (encoding NULL as C0 80)\n                    if (accBytes === 2 && acc < 0x80 && acc > 0)\n                        res += this.defaultCharUnicode;\n                    else if (accBytes === 3 && acc < 0x800)\n                        res += this.defaultCharUnicode;\n                    else\n                        // Actually add character.\n                        res += String.fromCharCode(acc);\n                }\n            } else { // Unexpected continuation byte\n                res += this.defaultCharUnicode;\n            }\n        }\n    }\n    this.acc = acc; this.contBytes = contBytes; this.accBytes = accBytes;\n    return res;\n}\n\nInternalDecoderCesu8.prototype.end = function() {\n    var res = 0;\n    if (this.contBytes > 0)\n        res += this.defaultCharUnicode;\n    return res;\n}\n");
__memMods.set("iconv-lite/encodings/sbcs-codec.js", "\"use strict\";\nvar Buffer = require(\"safer-buffer\").Buffer;\n\n// Single-byte codec. Needs a 'chars' string parameter that contains 256 or 128 chars that\n// correspond to encoded bytes (if 128 - then lower half is ASCII). \n\nexports._sbcs = SBCSCodec;\nfunction SBCSCodec(codecOptions, iconv) {\n    if (!codecOptions)\n        throw new Error(\"SBCS codec is called without the data.\")\n    \n    // Prepare char buffer for decoding.\n    if (!codecOptions.chars || (codecOptions.chars.length !== 128 && codecOptions.chars.length !== 256))\n        throw new Error(\"Encoding '\"+codecOptions.type+\"' has incorrect 'chars' (must be of len 128 or 256)\");\n    \n    if (codecOptions.chars.length === 128) {\n        var asciiString = \"\";\n        for (var i = 0; i < 128; i++)\n            asciiString += String.fromCharCode(i);\n        codecOptions.chars = asciiString + codecOptions.chars;\n    }\n\n    this.decodeBuf = Buffer.from(codecOptions.chars, 'ucs2');\n    \n    // Encoding buffer.\n    var encodeBuf = Buffer.alloc(65536, iconv.defaultCharSingleByte.charCodeAt(0));\n\n    for (var i = 0; i < codecOptions.chars.length; i++)\n        encodeBuf[codecOptions.chars.charCodeAt(i)] = i;\n\n    this.encodeBuf = encodeBuf;\n}\n\nSBCSCodec.prototype.encoder = SBCSEncoder;\nSBCSCodec.prototype.decoder = SBCSDecoder;\n\n\nfunction SBCSEncoder(options, codec) {\n    this.encodeBuf = codec.encodeBuf;\n}\n\nSBCSEncoder.prototype.write = function(str) {\n    var buf = Buffer.alloc(str.length);\n    for (var i = 0; i < str.length; i++)\n        buf[i] = this.encodeBuf[str.charCodeAt(i)];\n    \n    return buf;\n}\n\nSBCSEncoder.prototype.end = function() {\n}\n\n\nfunction SBCSDecoder(options, codec) {\n    this.decodeBuf = codec.decodeBuf;\n}\n\nSBCSDecoder.prototype.write = function(buf) {\n    // Strings are immutable in JS -> we use ucs2 buffer to speed up computations.\n    var decodeBuf = this.decodeBuf;\n    var newBuf = Buffer.alloc(buf.length*2);\n    var idx1 = 0, idx2 = 0;\n    for (var i = 0; i < buf.length; i++) {\n        idx1 = buf[i]*2; idx2 = i*2;\n        newBuf[idx2] = decodeBuf[idx1];\n        newBuf[idx2+1] = decodeBuf[idx1+1];\n    }\n    return newBuf.toString('ucs2');\n}\n\nSBCSDecoder.prototype.end = function() {\n}\n");
__memMods.set("iconv-lite/encodings/sbcs-data-generated.js", "\"use strict\";\n\n// Generated data for sbcs codec. Don't edit manually. Regenerate using generation/gen-sbcs.js script.\nmodule.exports = {\n  \"437\": \"cp437\",\n  \"737\": \"cp737\",\n  \"775\": \"cp775\",\n  \"850\": \"cp850\",\n  \"852\": \"cp852\",\n  \"855\": \"cp855\",\n  \"856\": \"cp856\",\n  \"857\": \"cp857\",\n  \"858\": \"cp858\",\n  \"860\": \"cp860\",\n  \"861\": \"cp861\",\n  \"862\": \"cp862\",\n  \"863\": \"cp863\",\n  \"864\": \"cp864\",\n  \"865\": \"cp865\",\n  \"866\": \"cp866\",\n  \"869\": \"cp869\",\n  \"874\": \"windows874\",\n  \"922\": \"cp922\",\n  \"1046\": \"cp1046\",\n  \"1124\": \"cp1124\",\n  \"1125\": \"cp1125\",\n  \"1129\": \"cp1129\",\n  \"1133\": \"cp1133\",\n  \"1161\": \"cp1161\",\n  \"1162\": \"cp1162\",\n  \"1163\": \"cp1163\",\n  \"1250\": \"windows1250\",\n  \"1251\": \"windows1251\",\n  \"1252\": \"windows1252\",\n  \"1253\": \"windows1253\",\n  \"1254\": \"windows1254\",\n  \"1255\": \"windows1255\",\n  \"1256\": \"windows1256\",\n  \"1257\": \"windows1257\",\n  \"1258\": \"windows1258\",\n  \"28591\": \"iso88591\",\n  \"28592\": \"iso88592\",\n  \"28593\": \"iso88593\",\n  \"28594\": \"iso88594\",\n  \"28595\": \"iso88595\",\n  \"28596\": \"iso88596\",\n  \"28597\": \"iso88597\",\n  \"28598\": \"iso88598\",\n  \"28599\": \"iso88599\",\n  \"28600\": \"iso885910\",\n  \"28601\": \"iso885911\",\n  \"28603\": \"iso885913\",\n  \"28604\": \"iso885914\",\n  \"28605\": \"iso885915\",\n  \"28606\": \"iso885916\",\n  \"windows874\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"€����…�����������‘’“”•–—�������� กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู����฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛����\"\n  },\n  \"win874\": \"windows874\",\n  \"cp874\": \"windows874\",\n  \"windows1250\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"€�‚�„…†‡�‰Š‹ŚŤŽŹ�‘’“”•–—�™š›śťžź ˇ˘Ł¤Ą¦§¨©Ş«¬­®Ż°±˛ł´µ¶·¸ąş»Ľ˝ľżŔÁÂĂÄĹĆÇČÉĘËĚÍÎĎĐŃŇÓÔŐÖ×ŘŮÚŰÜÝŢßŕáâăäĺćçčéęëěíîďđńňóôőö÷řůúűüýţ˙\"\n  },\n  \"win1250\": \"windows1250\",\n  \"cp1250\": \"windows1250\",\n  \"windows1251\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"ЂЃ‚ѓ„…†‡€‰Љ‹ЊЌЋЏђ‘’“”•–—�™љ›њќћџ ЎўЈ¤Ґ¦§Ё©Є«¬­®Ї°±Ііґµ¶·ё№є»јЅѕїАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя\"\n  },\n  \"win1251\": \"windows1251\",\n  \"cp1251\": \"windows1251\",\n  \"windows1252\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"€�‚ƒ„…†‡ˆ‰Š‹Œ�Ž��‘’“”•–—˜™š›œ�žŸ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ\"\n  },\n  \"win1252\": \"windows1252\",\n  \"cp1252\": \"windows1252\",\n  \"windows1253\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"€�‚ƒ„…†‡�‰�‹�����‘’“”•–—�™�›���� ΅Ά£¤¥¦§¨©�«¬­®―°±²³΄µ¶·ΈΉΊ»Ό½ΎΏΐΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡ�ΣΤΥΦΧΨΩΪΫάέήίΰαβγδεζηθικλμνξοπρςστυφχψωϊϋόύώ�\"\n  },\n  \"win1253\": \"windows1253\",\n  \"cp1253\": \"windows1253\",\n  \"windows1254\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"€�‚ƒ„…†‡ˆ‰Š‹Œ����‘’“”•–—˜™š›œ��Ÿ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏĞÑÒÓÔÕÖ×ØÙÚÛÜİŞßàáâãäåæçèéêëìíîïğñòóôõö÷øùúûüışÿ\"\n  },\n  \"win1254\": \"windows1254\",\n  \"cp1254\": \"windows1254\",\n  \"windows1255\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"€�‚ƒ„…†‡ˆ‰�‹�����‘’“”•–—˜™�›���� ¡¢£₪¥¦§¨©×«¬­®¯°±²³´µ¶·¸¹÷»¼½¾¿ְֱֲֳִֵֶַָֹֺֻּֽ־ֿ׀ׁׂ׃װױײ׳״�������אבגדהוזחטיךכלםמןנסעףפץצקרשת��‎‏�\"\n  },\n  \"win1255\": \"windows1255\",\n  \"cp1255\": \"windows1255\",\n  \"windows1256\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"€پ‚ƒ„…†‡ˆ‰ٹ‹Œچژڈگ‘’“”•–—ک™ڑ›œ‌‍ں ،¢£¤¥¦§¨©ھ«¬­®¯°±²³´µ¶·¸¹؛»¼½¾؟ہءآأؤإئابةتثجحخدذرزسشصض×طظعغـفقكàلâمنهوçèéêëىيîïًٌٍَôُِ÷ّùْûü‎‏ے\"\n  },\n  \"win1256\": \"windows1256\",\n  \"cp1256\": \"windows1256\",\n  \"windows1257\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"€�‚�„…†‡�‰�‹�¨ˇ¸�‘’“”•–—�™�›�¯˛� �¢£¤�¦§Ø©Ŗ«¬­®Æ°±²³´µ¶·ø¹ŗ»¼½¾æĄĮĀĆÄÅĘĒČÉŹĖĢĶĪĻŠŃŅÓŌÕÖ×ŲŁŚŪÜŻŽßąįāćäåęēčéźėģķīļšńņóōõö÷ųłśūüżž˙\"\n  },\n  \"win1257\": \"windows1257\",\n  \"cp1257\": \"windows1257\",\n  \"windows1258\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"€�‚ƒ„…†‡ˆ‰�‹Œ����‘’“”•–—˜™�›œ��Ÿ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂĂÄÅÆÇÈÉÊË̀ÍÎÏĐÑ̉ÓÔƠÖ×ØÙÚÛÜỮßàáâăäåæçèéêë́íîïđṇ̃óôơö÷øùúûüư₫ÿ\"\n  },\n  \"win1258\": \"windows1258\",\n  \"cp1258\": \"windows1258\",\n  \"iso88591\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \" ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ\"\n  },\n  \"cp28591\": \"iso88591\",\n  \"iso88592\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \" Ą˘Ł¤ĽŚ§¨ŠŞŤŹ­ŽŻ°ą˛ł´ľśˇ¸šşťź˝žżŔÁÂĂÄĹĆÇČÉĘËĚÍÎĎĐŃŇÓÔŐÖ×ŘŮÚŰÜÝŢßŕáâăäĺćçčéęëěíîďđńňóôőö÷řůúűüýţ˙\"\n  },\n  \"cp28592\": \"iso88592\",\n  \"iso88593\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \" Ħ˘£¤�Ĥ§¨İŞĞĴ­�Ż°ħ²³´µĥ·¸ışğĵ½�żÀÁÂ�ÄĊĈÇÈÉÊËÌÍÎÏ�ÑÒÓÔĠÖ×ĜÙÚÛÜŬŜßàáâ�äċĉçèéêëìíîï�ñòóôġö÷ĝùúûüŭŝ˙\"\n  },\n  \"cp28593\": \"iso88593\",\n  \"iso88594\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \" ĄĸŖ¤ĨĻ§¨ŠĒĢŦ­Ž¯°ą˛ŗ´ĩļˇ¸šēģŧŊžŋĀÁÂÃÄÅÆĮČÉĘËĖÍÎĪĐŅŌĶÔÕÖ×ØŲÚÛÜŨŪßāáâãäåæįčéęëėíîīđņōķôõö÷øųúûüũū˙\"\n  },\n  \"cp28594\": \"iso88594\",\n  \"iso88595\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \" ЁЂЃЄЅІЇЈЉЊЋЌ­ЎЏАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя№ёђѓєѕіїјљњћќ§ўџ\"\n  },\n  \"cp28595\": \"iso88595\",\n  \"iso88596\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \" ���¤�������،­�������������؛���؟�ءآأؤإئابةتثجحخدذرزسشصضطظعغ�����ـفقكلمنهوىيًٌٍَُِّْ�������������\"\n  },\n  \"cp28596\": \"iso88596\",\n  \"iso88597\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \" ‘’£€₯¦§¨©ͺ«¬­�―°±²³΄΅Ά·ΈΉΊ»Ό½ΎΏΐΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡ�ΣΤΥΦΧΨΩΪΫάέήίΰαβγδεζηθικλμνξοπρςστυφχψωϊϋόύώ�\"\n  },\n  \"cp28597\": \"iso88597\",\n  \"iso88598\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \" �¢£¤¥¦§¨©×«¬­®¯°±²³´µ¶·¸¹÷»¼½¾��������������������������������‗אבגדהוזחטיךכלםמןנסעףפץצקרשת��‎‏�\"\n  },\n  \"cp28598\": \"iso88598\",\n  \"iso88599\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \" ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏĞÑÒÓÔÕÖ×ØÙÚÛÜİŞßàáâãäåæçèéêëìíîïğñòóôõö÷øùúûüışÿ\"\n  },\n  \"cp28599\": \"iso88599\",\n  \"iso885910\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \" ĄĒĢĪĨĶ§ĻĐŠŦŽ­ŪŊ°ąēģīĩķ·ļđšŧž―ūŋĀÁÂÃÄÅÆĮČÉĘËĖÍÎÏÐŅŌÓÔÕÖŨØŲÚÛÜÝÞßāáâãäåæįčéęëėíîïðņōóôõöũøųúûüýþĸ\"\n  },\n  \"cp28600\": \"iso885910\",\n  \"iso885911\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \" กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู����฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛����\"\n  },\n  \"cp28601\": \"iso885911\",\n  \"iso885913\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \" ”¢£¤„¦§Ø©Ŗ«¬­®Æ°±²³“µ¶·ø¹ŗ»¼½¾æĄĮĀĆÄÅĘĒČÉŹĖĢĶĪĻŠŃŅÓŌÕÖ×ŲŁŚŪÜŻŽßąįāćäåęēčéźėģķīļšńņóōõö÷ųłśūüżž’\"\n  },\n  \"cp28603\": \"iso885913\",\n  \"iso885914\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \" Ḃḃ£ĊċḊ§Ẁ©ẂḋỲ­®ŸḞḟĠġṀṁ¶ṖẁṗẃṠỳẄẅṡÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏŴÑÒÓÔÕÖṪØÙÚÛÜÝŶßàáâãäåæçèéêëìíîïŵñòóôõöṫøùúûüýŷÿ\"\n  },\n  \"cp28604\": \"iso885914\",\n  \"iso885915\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \" ¡¢£€¥Š§š©ª«¬­®¯°±²³Žµ¶·ž¹º»ŒœŸ¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ\"\n  },\n  \"cp28605\": \"iso885915\",\n  \"iso885916\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \" ĄąŁ€„Š§š©Ș«Ź­źŻ°±ČłŽ”¶·žčș»ŒœŸżÀÁÂĂÄĆÆÇÈÉÊËÌÍÎÏĐŃÒÓÔŐÖŚŰÙÚÛÜĘȚßàáâăäćæçèéêëìíîïđńòóôőöśűùúûüęțÿ\"\n  },\n  \"cp28606\": \"iso885916\",\n  \"cp437\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ \"\n  },\n  \"ibm437\": \"cp437\",\n  \"csibm437\": \"cp437\",\n  \"cp737\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρσςτυφχψ░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀ωάέήϊίόύϋώΆΈΉΊΌΎΏ±≥≤ΪΫ÷≈°∙·√ⁿ²■ \"\n  },\n  \"ibm737\": \"cp737\",\n  \"csibm737\": \"cp737\",\n  \"cp775\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"ĆüéāäģåćłēŖŗīŹÄÅÉæÆōöĢ¢ŚśÖÜø£Ø×¤ĀĪóŻżź”¦©®¬½¼Ł«»░▒▓│┤ĄČĘĖ╣║╗╝ĮŠ┐└┴┬├─┼ŲŪ╚╔╩╦╠═╬Žąčęėįšųūž┘┌█▄▌▐▀ÓßŌŃõÕµńĶķĻļņĒŅ’­±“¾¶§÷„°∙·¹³²■ \"\n  },\n  \"ibm775\": \"cp775\",\n  \"csibm775\": \"cp775\",\n  \"cp850\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ \"\n  },\n  \"ibm850\": \"cp850\",\n  \"csibm850\": \"cp850\",\n  \"cp852\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"ÇüéâäůćçłëŐőîŹÄĆÉĹĺôöĽľŚśÖÜŤťŁ×čáíóúĄąŽžĘę¬źČş«»░▒▓│┤ÁÂĚŞ╣║╗╝Żż┐└┴┬├─┼Ăă╚╔╩╦╠═╬¤đĐĎËďŇÍÎě┘┌█▄ŢŮ▀ÓßÔŃńňŠšŔÚŕŰýÝţ´­˝˛ˇ˘§÷¸°¨˙űŘř■ \"\n  },\n  \"ibm852\": \"cp852\",\n  \"csibm852\": \"cp852\",\n  \"cp855\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"ђЂѓЃёЁєЄѕЅіІїЇјЈљЉњЊћЋќЌўЎџЏюЮъЪаАбБцЦдДеЕфФгГ«»░▒▓│┤хХиИ╣║╗╝йЙ┐└┴┬├─┼кК╚╔╩╦╠═╬¤лЛмМнНоОп┘┌█▄Пя▀ЯрРсСтТуУжЖвВьЬ№­ыЫзЗшШэЭщЩчЧ§■ \"\n  },\n  \"ibm855\": \"cp855\",\n  \"csibm855\": \"cp855\",\n  \"cp856\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"אבגדהוזחטיךכלםמןנסעףפץצקרשת�£�×����������®¬½¼�«»░▒▓│┤���©╣║╗╝¢¥┐└┴┬├─┼��╚╔╩╦╠═╬¤���������┘┌█▄¦�▀������µ�������¯´­±‗¾¶§÷¸°¨·¹³²■ \"\n  },\n  \"ibm856\": \"cp856\",\n  \"csibm856\": \"cp856\",\n  \"cp857\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"ÇüéâäàåçêëèïîıÄÅÉæÆôöòûùİÖÜø£ØŞşáíóúñÑĞğ¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ºªÊËÈ�ÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµ�×ÚÛÙìÿ¯´­±�¾¶§÷¸°¨·¹³²■ \"\n  },\n  \"ibm857\": \"cp857\",\n  \"csibm857\": \"cp857\",\n  \"cp858\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈ€ÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ \"\n  },\n  \"ibm858\": \"cp858\",\n  \"csibm858\": \"cp858\",\n  \"cp860\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"ÇüéâãàÁçêÊèÍÔìÃÂÉÀÈôõòÚùÌÕÜ¢£Ù₧ÓáíóúñÑªº¿Ò¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ \"\n  },\n  \"ibm860\": \"cp860\",\n  \"csibm860\": \"cp860\",\n  \"cp861\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"ÇüéâäàåçêëèÐðÞÄÅÉæÆôöþûÝýÖÜø£Ø₧ƒáíóúÁÍÓÚ¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ \"\n  },\n  \"ibm861\": \"cp861\",\n  \"csibm861\": \"cp861\",\n  \"cp862\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"אבגדהוזחטיךכלםמןנסעףפץצקרשת¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ \"\n  },\n  \"ibm862\": \"cp862\",\n  \"csibm862\": \"cp862\",\n  \"cp863\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"ÇüéâÂà¶çêëèïî‗À§ÉÈÊôËÏûù¤ÔÜ¢£ÙÛƒ¦´óú¨¸³¯Î⌐¬½¼¾«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ \"\n  },\n  \"ibm863\": \"cp863\",\n  \"csibm863\": \"cp863\",\n  \"cp864\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"\\u0000\\u0001\\u0002\\u0003\\u0004\\u0005\\u0006\\u0007\\b\\t\\n\\u000b\\f\\r\\u000e\\u000f\\u0010\\u0011\\u0012\\u0013\\u0014\\u0015\\u0016\\u0017\\u0018\\u0019\\u001a\\u001b\\u001c\\u001d\\u001e\\u001f !\\\"#$٪&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\\\]^_`abcdefghijklmnopqrstuvwxyz{|}~°·∙√▒─│┼┤┬├┴┐┌└┘β∞φ±½¼≈«»ﻷﻸ��ﻻﻼ� ­ﺂ£¤ﺄ��ﺎﺏﺕﺙ،ﺝﺡﺥ٠١٢٣٤٥٦٧٨٩ﻑ؛ﺱﺵﺹ؟¢ﺀﺁﺃﺅﻊﺋﺍﺑﺓﺗﺛﺟﺣﺧﺩﺫﺭﺯﺳﺷﺻﺿﻁﻅﻋﻏ¦¬÷×ﻉـﻓﻗﻛﻟﻣﻧﻫﻭﻯﻳﺽﻌﻎﻍﻡﹽّﻥﻩﻬﻰﻲﻐﻕﻵﻶﻝﻙﻱ■�\"\n  },\n  \"ibm864\": \"cp864\",\n  \"csibm864\": \"cp864\",\n  \"cp865\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø₧ƒáíóúñÑªº¿⌐¬½¼¡«¤░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ \"\n  },\n  \"ibm865\": \"cp865\",\n  \"csibm865\": \"cp865\",\n  \"cp866\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмноп░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀рстуфхцчшщъыьэюяЁёЄєЇїЎў°∙·√№¤■ \"\n  },\n  \"ibm866\": \"cp866\",\n  \"csibm866\": \"cp866\",\n  \"cp869\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"������Ά�·¬¦‘’Έ―ΉΊΪΌ��ΎΫ©Ώ²³ά£έήίϊΐόύΑΒΓΔΕΖΗ½ΘΙ«»░▒▓│┤ΚΛΜΝ╣║╗╝ΞΟ┐└┴┬├─┼ΠΡ╚╔╩╦╠═╬ΣΤΥΦΧΨΩαβγ┘┌█▄δε▀ζηθικλμνξοπρσςτ΄­±υφχ§ψ΅°¨ωϋΰώ■ \"\n  },\n  \"ibm869\": \"cp869\",\n  \"csibm869\": \"cp869\",\n  \"cp922\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \" ¡¢£¤¥¦§¨©ª«¬­®‾°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏŠÑÒÓÔÕÖ×ØÙÚÛÜÝŽßàáâãäåæçèéêëìíîïšñòóôõö÷øùúûüýžÿ\"\n  },\n  \"ibm922\": \"cp922\",\n  \"csibm922\": \"cp922\",\n  \"cp1046\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"ﺈ×÷ﹱ■│─┐┌└┘ﹹﹻﹽﹿﹷﺊﻰﻳﻲﻎﻏﻐﻶﻸﻺﻼ ¤ﺋﺑﺗﺛﺟﺣ،­ﺧﺳ٠١٢٣٤٥٦٧٨٩ﺷ؛ﺻﺿﻊ؟ﻋءآأؤإئابةتثجحخدذرزسشصضطﻇعغﻌﺂﺄﺎﻓـفقكلمنهوىيًٌٍَُِّْﻗﻛﻟﻵﻷﻹﻻﻣﻧﻬﻩ�\"\n  },\n  \"ibm1046\": \"cp1046\",\n  \"csibm1046\": \"cp1046\",\n  \"cp1124\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \" ЁЂҐЄЅІЇЈЉЊЋЌ­ЎЏАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя№ёђґєѕіїјљњћќ§ўџ\"\n  },\n  \"ibm1124\": \"cp1124\",\n  \"csibm1124\": \"cp1124\",\n  \"cp1125\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмноп░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀рстуфхцчшщъыьэюяЁёҐґЄєІіЇї·√№¤■ \"\n  },\n  \"ibm1125\": \"cp1125\",\n  \"csibm1125\": \"cp1125\",\n  \"cp1129\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \" ¡¢£¤¥¦§œ©ª«¬­®¯°±²³Ÿµ¶·Œ¹º»¼½¾¿ÀÁÂĂÄÅÆÇÈÉÊË̀ÍÎÏĐÑ̉ÓÔƠÖ×ØÙÚÛÜỮßàáâăäåæçèéêë́íîïđṇ̃óôơö÷øùúûüư₫ÿ\"\n  },\n  \"ibm1129\": \"cp1129\",\n  \"csibm1129\": \"cp1129\",\n  \"cp1133\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \" ກຂຄງຈສຊຍດຕຖທນບປຜຝພຟມຢຣລວຫອຮ���ຯະາຳິີຶືຸູຼັົຽ���ເແໂໃໄ່້໊໋໌ໍໆ�ໜໝ₭����������������໐໑໒໓໔໕໖໗໘໙��¢¬¦�\"\n  },\n  \"ibm1133\": \"cp1133\",\n  \"csibm1133\": \"cp1133\",\n  \"cp1161\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"��������������������������������่กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู้๊๋€฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛¢¬¦ \"\n  },\n  \"ibm1161\": \"cp1161\",\n  \"csibm1161\": \"cp1161\",\n  \"cp1162\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"€…‘’“”•–— กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู����฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛����\"\n  },\n  \"ibm1162\": \"cp1162\",\n  \"csibm1162\": \"cp1162\",\n  \"cp1163\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \" ¡¢£€¥¦§œ©ª«¬­®¯°±²³Ÿµ¶·Œ¹º»¼½¾¿ÀÁÂĂÄÅÆÇÈÉÊË̀ÍÎÏĐÑ̉ÓÔƠÖ×ØÙÚÛÜỮßàáâăäåæçèéêë́íîïđṇ̃óôơö÷øùúûüư₫ÿ\"\n  },\n  \"ibm1163\": \"cp1163\",\n  \"csibm1163\": \"cp1163\",\n  \"maccroatian\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®Š™´¨≠ŽØ∞±≤≥∆µ∂∑∏š∫ªºΩžø¿¡¬√ƒ≈Ć«Č… ÀÃÕŒœĐ—“”‘’÷◊�©⁄¤‹›Æ»–·‚„‰ÂćÁčÈÍÎÏÌÓÔđÒÚÛÙıˆ˜¯πË˚¸Êæˇ\"\n  },\n  \"maccyrillic\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ†°¢£§•¶І®©™Ђђ≠Ѓѓ∞±≤≥іµ∂ЈЄєЇїЉљЊњјЅ¬√ƒ≈∆«»… ЋћЌќѕ–—“”‘’÷„ЎўЏџ№Ёёяабвгдежзийклмнопрстуфхцчшщъыьэю¤\"\n  },\n  \"macgreek\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"Ä¹²É³ÖÜ΅àâä΄¨çéèêë£™îï•½‰ôö¦­ùûü†ΓΔΘΛΞΠß®©ΣΪ§≠°·Α±≤≥¥ΒΕΖΗΙΚΜΦΫΨΩάΝ¬ΟΡ≈Τ«»… ΥΧΆΈœ–―“”‘’÷ΉΊΌΎέήίόΏύαβψδεφγηιξκλμνοπώρστθωςχυζϊϋΐΰ�\"\n  },\n  \"maciceland\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûüÝ°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄¤ÐðÞþý·‚„‰ÂÊÁËÈÍÎÏÌÓÔ�ÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ\"\n  },\n  \"macroman\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄¤‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ�ÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ\"\n  },\n  \"macromania\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ĂŞ∞±≤≥¥µ∂∑∏π∫ªºΩăş¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄¤‹›Ţţ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ�ÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ\"\n  },\n  \"macthai\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"«»…“”�•‘’� กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู﻿​–—฿เแโใไๅๆ็่้๊๋์ํ™๏๐๑๒๓๔๕๖๗๘๙®©����\"\n  },\n  \"macturkish\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸĞğİıŞş‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ�ÒÚÛÙ�ˆ˜¯˘˙˚¸˝˛ˇ\"\n  },\n  \"macukraine\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ†°Ґ£§•¶І®©™Ђђ≠Ѓѓ∞±≤≥іµґЈЄєЇїЉљЊњјЅ¬√ƒ≈∆«»… ЋћЌќѕ–—“”‘’÷„ЎўЏџ№Ёёяабвгдежзийклмнопрстуфхцчшщъыьэю¤\"\n  },\n  \"koi8r\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"─│┌┐└┘├┤┬┴┼▀▄█▌▐░▒▓⌠■∙√≈≤≥ ⌡°²·÷═║╒ё╓╔╕╖╗╘╙╚╛╜╝╞╟╠╡Ё╢╣╤╥╦╧╨╩╪╫╬©юабцдефгхийклмнопярстужвьызшэщчъЮАБЦДЕФГХИЙКЛМНОПЯРСТУЖВЬЫЗШЭЩЧЪ\"\n  },\n  \"koi8u\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"─│┌┐└┘├┤┬┴┼▀▄█▌▐░▒▓⌠■∙√≈≤≥ ⌡°²·÷═║╒ёє╔ії╗╘╙╚╛ґ╝╞╟╠╡ЁЄ╣ІЇ╦╧╨╩╪Ґ╬©юабцдефгхийклмнопярстужвьызшэщчъЮАБЦДЕФГХИЙКЛМНОПЯРСТУЖВЬЫЗШЭЩЧЪ\"\n  },\n  \"koi8ru\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"─│┌┐└┘├┤┬┴┼▀▄█▌▐░▒▓⌠■∙√≈≤≥ ⌡°²·÷═║╒ёє╔ії╗╘╙╚╛ґў╞╟╠╡ЁЄ╣ІЇ╦╧╨╩╪ҐЎ©юабцдефгхийклмнопярстужвьызшэщчъЮАБЦДЕФГХИЙКЛМНОПЯРСТУЖВЬЫЗШЭЩЧЪ\"\n  },\n  \"koi8t\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"қғ‚Ғ„…†‡�‰ҳ‹ҲҷҶ�Қ‘’“”•–—�™�›�����ӯӮё¤ӣ¦§���«¬­®�°±²Ё�Ӣ¶·�№�»���©юабцдефгхийклмнопярстужвьызшэщчъЮАБЦДЕФГХИЙКЛМНОПЯРСТУЖВЬЫЗШЭЩЧЪ\"\n  },\n  \"armscii8\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \" �և։)(»«—.՝,-֊…՜՛՞ԱաԲբԳգԴդԵեԶզԷէԸըԹթԺժԻիԼլԽխԾծԿկՀհՁձՂղՃճՄմՅյՆնՇշՈոՉչՊպՋջՌռՍսՎվՏտՐրՑցՒւՓփՔքՕօՖֆ՚�\"\n  },\n  \"rk1048\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"ЂЃ‚ѓ„…†‡€‰Љ‹ЊҚҺЏђ‘’“”•–—�™љ›њқһџ ҰұӘ¤Ө¦§Ё©Ғ«¬­®Ү°±Ііөµ¶·ё№ғ»әҢңүАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя\"\n  },\n  \"tcvn\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"\\u0000ÚỤ\\u0003ỪỬỮ\\u0007\\b\\t\\n\\u000b\\f\\r\\u000e\\u000f\\u0010ỨỰỲỶỸÝỴ\\u0018\\u0019\\u001a\\u001b\\u001c\\u001d\\u001e\\u001f !\\\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ÀẢÃÁẠẶẬÈẺẼÉẸỆÌỈĨÍỊÒỎÕÓỌỘỜỞỠỚỢÙỦŨ ĂÂÊÔƠƯĐăâêôơưđẶ̀̀̉̃́àảãáạẲằẳẵắẴẮẦẨẪẤỀặầẩẫấậèỂẻẽéẹềểễếệìỉỄẾỒĩíịòỔỏõóọồổỗốộờởỡớợùỖủũúụừửữứựỳỷỹýỵỐ\"\n  },\n  \"georgianacademy\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"‚ƒ„…†‡ˆ‰Š‹Œ‘’“”•–—˜™š›œŸ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰჱჲჳჴჵჶçèéêëìíîïðñòóôõö÷øùúûüýþÿ\"\n  },\n  \"georgianps\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"‚ƒ„…†‡ˆ‰Š‹Œ‘’“”•–—˜™š›œŸ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿აბგდევზჱთიკლმნჲოპჟრსტჳუფქღყშჩცძწჭხჴჯჰჵæçèéêëìíîïðñòóôõö÷øùúûüýþÿ\"\n  },\n  \"pt154\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"ҖҒӮғ„…ҶҮҲүҠӢҢҚҺҸҗ‘’“”•–—ҳҷҡӣңқһҹ ЎўЈӨҘҰ§Ё©Ә«¬ӯ®Ҝ°ұІіҙө¶·ё№ә»јҪҫҝАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя\"\n  },\n  \"viscii\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"\\u0000\\u0001Ẳ\\u0003\\u0004ẴẪ\\u0007\\b\\t\\n\\u000b\\f\\r\\u000e\\u000f\\u0010\\u0011\\u0012\\u0013Ỷ\\u0015\\u0016\\u0017\\u0018Ỹ\\u001a\\u001b\\u001c\\u001dỴ\\u001f !\\\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ẠẮẰẶẤẦẨẬẼẸẾỀỂỄỆỐỒỔỖỘỢỚỜỞỊỎỌỈỦŨỤỲÕắằặấầẩậẽẹếềểễệốồổỗỠƠộờởịỰỨỪỬơớƯÀÁÂÃẢĂẳẵÈÉÊẺÌÍĨỳĐứÒÓÔạỷừửÙÚỹỵÝỡưàáâãảăữẫèéêẻìíĩỉđựòóôõỏọụùúũủýợỮ\"\n  },\n  \"iso646cn\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"\\u0000\\u0001\\u0002\\u0003\\u0004\\u0005\\u0006\\u0007\\b\\t\\n\\u000b\\f\\r\\u000e\\u000f\\u0010\\u0011\\u0012\\u0013\\u0014\\u0015\\u0016\\u0017\\u0018\\u0019\\u001a\\u001b\\u001c\\u001d\\u001e\\u001f !\\\"#¥%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\\\]^_`abcdefghijklmnopqrstuvwxyz{|}‾��������������������������������������������������������������������������������������������������������������������������������\"\n  },\n  \"iso646jp\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"\\u0000\\u0001\\u0002\\u0003\\u0004\\u0005\\u0006\\u0007\\b\\t\\n\\u000b\\f\\r\\u000e\\u000f\\u0010\\u0011\\u0012\\u0013\\u0014\\u0015\\u0016\\u0017\\u0018\\u0019\\u001a\\u001b\\u001c\\u001d\\u001e\\u001f !\\\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[¥]^_`abcdefghijklmnopqrstuvwxyz{|}‾��������������������������������������������������������������������������������������������������������������������������������\"\n  },\n  \"hproman8\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \" ÀÂÈÊËÎÏ´ˋˆ¨˜ÙÛ₤¯Ýý°ÇçÑñ¡¿¤£¥§ƒ¢âêôûáéóúàèòùäëöüÅîØÆåíøæÄìÖÜÉïßÔÁÃãÐðÍÌÓÒÕõŠšÚŸÿÞþ·µ¶¾—¼½ªº«■»±�\"\n  },\n  \"macintosh\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄¤‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ�ÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ\"\n  },\n  \"ascii\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"��������������������������������������������������������������������������������������������������������������������������������\"\n  },\n  \"tis620\": {\n    \"type\": \"_sbcs\",\n    \"chars\": \"���������������������������������กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู����฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛����\"\n  }\n}");
__memMods.set("iconv-lite/encodings/sbcs-data.js", "\"use strict\";\n\n// Manually added data to be used by sbcs codec in addition to generated one.\n\nmodule.exports = {\n    // Not supported by iconv, not sure why.\n    \"10029\": \"maccenteuro\",\n    \"maccenteuro\": {\n        \"type\": \"_sbcs\",\n        \"chars\": \"ÄĀāÉĄÖÜáąČäčĆćéŹźĎíďĒēĖóėôöõúĚěü†°Ę£§•¶ß®©™ę¨≠ģĮįĪ≤≥īĶ∂∑łĻļĽľĹĺŅņŃ¬√ńŇ∆«»… ňŐÕőŌ–—“”‘’÷◊ōŔŕŘ‹›řŖŗŠ‚„šŚśÁŤťÍŽžŪÓÔūŮÚůŰűŲųÝýķŻŁżĢˇ\"\n    },\n\n    \"808\": \"cp808\",\n    \"ibm808\": \"cp808\",\n    \"cp808\": {\n        \"type\": \"_sbcs\",\n        \"chars\": \"АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмноп░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀рстуфхцчшщъыьэюяЁёЄєЇїЎў°∙·√№€■ \"\n    },\n\n    \"mik\": {\n        \"type\": \"_sbcs\",\n        \"chars\": \"АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя└┴┬├─┼╣║╚╔╩╦╠═╬┐░▒▓│┤№§╗╝┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ \"\n    },\n\n    \"cp720\": {\n        \"type\": \"_sbcs\",\n        \"chars\": \"\\x80\\x81éâ\\x84à\\x86çêëèïî\\x8d\\x8e\\x8f\\x90\\u0651\\u0652ô¤ـûùءآأؤ£إئابةتثجحخدذرزسشص«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀ضطظعغفµقكلمنهوىي≡\\u064b\\u064c\\u064d\\u064e\\u064f\\u0650≈°∙·√ⁿ²■\\u00a0\"\n    },\n\n    // Aliases of generated encodings.\n    \"ascii8bit\": \"ascii\",\n    \"usascii\": \"ascii\",\n    \"ansix34\": \"ascii\",\n    \"ansix341968\": \"ascii\",\n    \"ansix341986\": \"ascii\",\n    \"csascii\": \"ascii\",\n    \"cp367\": \"ascii\",\n    \"ibm367\": \"ascii\",\n    \"isoir6\": \"ascii\",\n    \"iso646us\": \"ascii\",\n    \"iso646irv\": \"ascii\",\n    \"us\": \"ascii\",\n\n    \"latin1\": \"iso88591\",\n    \"latin2\": \"iso88592\",\n    \"latin3\": \"iso88593\",\n    \"latin4\": \"iso88594\",\n    \"latin5\": \"iso88599\",\n    \"latin6\": \"iso885910\",\n    \"latin7\": \"iso885913\",\n    \"latin8\": \"iso885914\",\n    \"latin9\": \"iso885915\",\n    \"latin10\": \"iso885916\",\n\n    \"csisolatin1\": \"iso88591\",\n    \"csisolatin2\": \"iso88592\",\n    \"csisolatin3\": \"iso88593\",\n    \"csisolatin4\": \"iso88594\",\n    \"csisolatincyrillic\": \"iso88595\",\n    \"csisolatinarabic\": \"iso88596\",\n    \"csisolatingreek\" : \"iso88597\",\n    \"csisolatinhebrew\": \"iso88598\",\n    \"csisolatin5\": \"iso88599\",\n    \"csisolatin6\": \"iso885910\",\n\n    \"l1\": \"iso88591\",\n    \"l2\": \"iso88592\",\n    \"l3\": \"iso88593\",\n    \"l4\": \"iso88594\",\n    \"l5\": \"iso88599\",\n    \"l6\": \"iso885910\",\n    \"l7\": \"iso885913\",\n    \"l8\": \"iso885914\",\n    \"l9\": \"iso885915\",\n    \"l10\": \"iso885916\",\n\n    \"isoir14\": \"iso646jp\",\n    \"isoir57\": \"iso646cn\",\n    \"isoir100\": \"iso88591\",\n    \"isoir101\": \"iso88592\",\n    \"isoir109\": \"iso88593\",\n    \"isoir110\": \"iso88594\",\n    \"isoir144\": \"iso88595\",\n    \"isoir127\": \"iso88596\",\n    \"isoir126\": \"iso88597\",\n    \"isoir138\": \"iso88598\",\n    \"isoir148\": \"iso88599\",\n    \"isoir157\": \"iso885910\",\n    \"isoir166\": \"tis620\",\n    \"isoir179\": \"iso885913\",\n    \"isoir199\": \"iso885914\",\n    \"isoir203\": \"iso885915\",\n    \"isoir226\": \"iso885916\",\n\n    \"cp819\": \"iso88591\",\n    \"ibm819\": \"iso88591\",\n\n    \"cyrillic\": \"iso88595\",\n\n    \"arabic\": \"iso88596\",\n    \"arabic8\": \"iso88596\",\n    \"ecma114\": \"iso88596\",\n    \"asmo708\": \"iso88596\",\n\n    \"greek\" : \"iso88597\",\n    \"greek8\" : \"iso88597\",\n    \"ecma118\" : \"iso88597\",\n    \"elot928\" : \"iso88597\",\n\n    \"hebrew\": \"iso88598\",\n    \"hebrew8\": \"iso88598\",\n\n    \"turkish\": \"iso88599\",\n    \"turkish8\": \"iso88599\",\n\n    \"thai\": \"iso885911\",\n    \"thai8\": \"iso885911\",\n\n    \"celtic\": \"iso885914\",\n    \"celtic8\": \"iso885914\",\n    \"isoceltic\": \"iso885914\",\n\n    \"tis6200\": \"tis620\",\n    \"tis62025291\": \"tis620\",\n    \"tis62025330\": \"tis620\",\n\n    \"10000\": \"macroman\",\n    \"10006\": \"macgreek\",\n    \"10007\": \"maccyrillic\",\n    \"10079\": \"maciceland\",\n    \"10081\": \"macturkish\",\n\n    \"cspc8codepage437\": \"cp437\",\n    \"cspc775baltic\": \"cp775\",\n    \"cspc850multilingual\": \"cp850\",\n    \"cspcp852\": \"cp852\",\n    \"cspc862latinhebrew\": \"cp862\",\n    \"cpgr\": \"cp869\",\n\n    \"msee\": \"cp1250\",\n    \"mscyrl\": \"cp1251\",\n    \"msansi\": \"cp1252\",\n    \"msgreek\": \"cp1253\",\n    \"msturk\": \"cp1254\",\n    \"mshebr\": \"cp1255\",\n    \"msarab\": \"cp1256\",\n    \"winbaltrim\": \"cp1257\",\n\n    \"cp20866\": \"koi8r\",\n    \"20866\": \"koi8r\",\n    \"ibm878\": \"koi8r\",\n    \"cskoi8r\": \"koi8r\",\n\n    \"cp21866\": \"koi8u\",\n    \"21866\": \"koi8u\",\n    \"ibm1168\": \"koi8u\",\n\n    \"strk10482002\": \"rk1048\",\n\n    \"tcvn5712\": \"tcvn\",\n    \"tcvn57121\": \"tcvn\",\n\n    \"gb198880\": \"iso646cn\",\n    \"cn\": \"iso646cn\",\n\n    \"csiso14jisc6220ro\": \"iso646jp\",\n    \"jisc62201969ro\": \"iso646jp\",\n    \"jp\": \"iso646jp\",\n\n    \"cshproman8\": \"hproman8\",\n    \"r8\": \"hproman8\",\n    \"roman8\": \"hproman8\",\n    \"xroman8\": \"hproman8\",\n    \"ibm1051\": \"hproman8\",\n\n    \"mac\": \"macintosh\",\n    \"csmacintosh\": \"macintosh\",\n};\n\n");
__memMods.set("iconv-lite/encodings/tables/big5-added.json", "[\n[\"8740\",\"䏰䰲䘃䖦䕸𧉧䵷䖳𧲱䳢𧳅㮕䜶䝄䱇䱀𤊿𣘗𧍒𦺋𧃒䱗𪍑䝏䗚䲅𧱬䴇䪤䚡𦬣爥𥩔𡩣𣸆𣽡晍囻\"],\n[\"8767\",\"綕夝𨮹㷴霴𧯯寛𡵞媤㘥𩺰嫑宷峼杮薓𩥅瑡璝㡵𡵓𣚞𦀡㻬\"],\n[\"87a1\",\"𥣞㫵竼龗𤅡𨤍𣇪𠪊𣉞䌊蒄龖鐯䤰蘓墖靊鈘秐稲晠権袝瑌篅枂稬剏遆㓦珄𥶹瓆鿇垳䤯呌䄱𣚎堘穲𧭥讏䚮𦺈䆁𥶙箮𢒼鿈𢓁𢓉𢓌鿉蔄𣖻䂴鿊䓡𪷿拁灮鿋\"],\n[\"8840\",\"㇀\",4,\"𠄌㇅𠃑𠃍㇆㇇𠃋𡿨㇈𠃊㇉㇊㇋㇌𠄎㇍㇎ĀÁǍÀĒÉĚÈŌÓǑÒ࿿Ê̄Ế࿿Ê̌ỀÊāáǎàɑēéěèīíǐìōóǒòūúǔùǖǘǚ\"],\n[\"88a1\",\"ǜü࿿ê̄ế࿿ê̌ềêɡ⏚⏛\"],\n[\"8940\",\"𪎩𡅅\"],\n[\"8943\",\"攊\"],\n[\"8946\",\"丽滝鵎釟\"],\n[\"894c\",\"𧜵撑会伨侨兖兴农凤务动医华发变团声处备夲头学实実岚庆总斉柾栄桥济炼电纤纬纺织经统缆缷艺苏药视设询车轧轮\"],\n[\"89a1\",\"琑糼緍楆竉刧\"],\n[\"89ab\",\"醌碸酞肼\"],\n[\"89b0\",\"贋胶𠧧\"],\n[\"89b5\",\"肟黇䳍鷉鸌䰾𩷶𧀎鸊𪄳㗁\"],\n[\"89c1\",\"溚舾甙\"],\n[\"89c5\",\"䤑马骏龙禇𨑬𡷊𠗐𢫦两亁亀亇亿仫伷㑌侽㹈倃傈㑽㒓㒥円夅凛凼刅争剹劐匧㗇厩㕑厰㕓参吣㕭㕲㚁咓咣咴咹哐哯唘唣唨㖘唿㖥㖿嗗㗅\"],\n[\"8a40\",\"𧶄唥\"],\n[\"8a43\",\"𠱂𠴕𥄫喐𢳆㧬𠍁蹆𤶸𩓥䁓𨂾睺𢰸㨴䟕𨅝𦧲𤷪擝𠵼𠾴𠳕𡃴撍蹾𠺖𠰋𠽤𢲩𨉖𤓓\"],\n[\"8a64\",\"𠵆𩩍𨃩䟴𤺧𢳂骲㩧𩗴㿭㔆𥋇𩟔𧣈𢵄鵮頕\"],\n[\"8a76\",\"䏙𦂥撴哣𢵌𢯊𡁷㧻𡁯\"],\n[\"8aa1\",\"𦛚𦜖𧦠擪𥁒𠱃蹨𢆡𨭌𠜱\"],\n[\"8aac\",\"䠋𠆩㿺塳𢶍\"],\n[\"8ab2\",\"𤗈𠓼𦂗𠽌𠶖啹䂻䎺\"],\n[\"8abb\",\"䪴𢩦𡂝膪飵𠶜捹㧾𢝵跀嚡摼㹃\"],\n[\"8ac9\",\"𪘁𠸉𢫏𢳉\"],\n[\"8ace\",\"𡃈𣧂㦒㨆𨊛㕸𥹉𢃇噒𠼱𢲲𩜠㒼氽𤸻\"],\n[\"8adf\",\"𧕴𢺋𢈈𪙛𨳍𠹺𠰴𦠜羓𡃏𢠃𢤹㗻𥇣𠺌𠾍𠺪㾓𠼰𠵇𡅏𠹌\"],\n[\"8af6\",\"𠺫𠮩𠵈𡃀𡄽㿹𢚖搲𠾭\"],\n[\"8b40\",\"𣏴𧘹𢯎𠵾𠵿𢱑𢱕㨘𠺘𡃇𠼮𪘲𦭐𨳒𨶙𨳊閪哌苄喹\"],\n[\"8b55\",\"𩻃鰦骶𧝞𢷮煀腭胬尜𦕲脴㞗卟𨂽醶𠻺𠸏𠹷𠻻㗝𤷫㘉𠳖嚯𢞵𡃉𠸐𠹸𡁸𡅈𨈇𡑕𠹹𤹐𢶤婔𡀝𡀞𡃵𡃶垜𠸑\"],\n[\"8ba1\",\"𧚔𨋍𠾵𠹻𥅾㜃𠾶𡆀𥋘𪊽𤧚𡠺𤅷𨉼墙剨㘚𥜽箲孨䠀䬬鼧䧧鰟鮍𥭴𣄽嗻㗲嚉丨夂𡯁屮靑𠂆乛亻㔾尣彑忄㣺扌攵歺氵氺灬爫丬犭𤣩罒礻糹罓𦉪㓁\"],\n[\"8bde\",\"𦍋耂肀𦘒𦥑卝衤见𧢲讠贝钅镸长门𨸏韦页风飞饣𩠐鱼鸟黄歯龜丷𠂇阝户钢\"],\n[\"8c40\",\"倻淾𩱳龦㷉袏𤅎灷峵䬠𥇍㕙𥴰愢𨨲辧釶熑朙玺𣊁𪄇㲋𡦀䬐磤琂冮𨜏䀉橣𪊺䈣蘏𠩯稪𩥇𨫪靕灍匤𢁾鏴盙𨧣龧矝亣俰傼丯众龨吴綋墒壐𡶶庒庙忂𢜒斋\"],\n[\"8ca1\",\"𣏹椙橃𣱣泿\"],\n[\"8ca7\",\"爀𤔅玌㻛𤨓嬕璹讃𥲤𥚕窓篬糃繬苸薗龩袐龪躹龫迏蕟駠鈡龬𨶹𡐿䁱䊢娚\"],\n[\"8cc9\",\"顨杫䉶圽\"],\n[\"8cce\",\"藖𤥻芿𧄍䲁𦵴嵻𦬕𦾾龭龮宖龯曧繛湗秊㶈䓃𣉖𢞖䎚䔶\"],\n[\"8ce6\",\"峕𣬚諹屸㴒𣕑嵸龲煗䕘𤃬𡸣䱷㥸㑊𠆤𦱁諌侴𠈹妿腬顖𩣺弻\"],\n[\"8d40\",\"𠮟\"],\n[\"8d42\",\"𢇁𨥭䄂䚻𩁹㼇龳𪆵䃸㟖䛷𦱆䅼𨚲𧏿䕭㣔𥒚䕡䔛䶉䱻䵶䗪㿈𤬏㙡䓞䒽䇭崾嵈嵖㷼㠏嶤嶹㠠㠸幂庽弥徃㤈㤔㤿㥍惗愽峥㦉憷憹懏㦸戬抐拥挘㧸嚱\"],\n[\"8da1\",\"㨃揢揻搇摚㩋擀崕嘡龟㪗斆㪽旿晓㫲暒㬢朖㭂枤栀㭘桊梄㭲㭱㭻椉楃牜楤榟榅㮼槖㯝橥橴橱檂㯬檙㯲檫檵櫔櫶殁毁毪汵沪㳋洂洆洦涁㳯涤涱渕渘温溆𨧀溻滢滚齿滨滩漤漴㵆𣽁澁澾㵪㵵熷岙㶊瀬㶑灐灔灯灿炉𠌥䏁㗱𠻘\"],\n[\"8e40\",\"𣻗垾𦻓焾𥟠㙎榢𨯩孴穉𥣡𩓙穥穽𥦬窻窰竂竃燑𦒍䇊竚竝竪䇯咲𥰁笋筕笩𥌎𥳾箢筯莜𥮴𦱿篐萡箒箸𥴠㶭𥱥蒒篺簆簵𥳁籄粃𤢂粦晽𤕸糉糇糦籴糳糵糎\"],\n[\"8ea1\",\"繧䔝𦹄絝𦻖璍綉綫焵綳緒𤁗𦀩緤㴓緵𡟹緥𨍭縝𦄡𦅚繮纒䌫鑬縧罀罁罇礶𦋐駡羗𦍑羣𡙡𠁨䕜𣝦䔃𨌺翺𦒉者耈耝耨耯𪂇𦳃耻耼聡𢜔䦉𦘦𣷣𦛨朥肧𨩈脇脚墰𢛶汿𦒘𤾸擧𡒊舘𡡞橓𤩥𤪕䑺舩𠬍𦩒𣵾俹𡓽蓢荢𦬊𤦧𣔰𡝳𣷸芪椛芳䇛\"],\n[\"8f40\",\"蕋苐茚𠸖𡞴㛁𣅽𣕚艻苢茘𣺋𦶣𦬅𦮗𣗎㶿茝嗬莅䔋𦶥莬菁菓㑾𦻔橗蕚㒖𦹂𢻯葘𥯤葱㷓䓤檧葊𣲵祘蒨𦮖𦹷𦹃蓞萏莑䒠蒓蓤𥲑䉀𥳀䕃蔴嫲𦺙䔧蕳䔖枿蘖\"],\n[\"8fa1\",\"𨘥𨘻藁𧂈蘂𡖂𧃍䕫䕪蘨㙈𡢢号𧎚虾蝱𪃸蟮𢰧螱蟚蠏噡虬桖䘏衅衆𧗠𣶹𧗤衞袜䙛袴袵揁装睷𧜏覇覊覦覩覧覼𨨥觧𧤤𧪽誜瞓釾誐𧩙竩𧬺𣾏䜓𧬸煼謌謟𥐰𥕥謿譌譍誩𤩺讐讛誯𡛟䘕衏貛𧵔𧶏貫㜥𧵓賖𧶘𧶽贒贃𡤐賛灜贑𤳉㻐起\"],\n[\"9040\",\"趩𨀂𡀔𤦊㭼𨆼𧄌竧躭躶軃鋔輙輭𨍥𨐒辥錃𪊟𠩐辳䤪𨧞𨔽𣶻廸𣉢迹𪀔𨚼𨔁𢌥㦀𦻗逷𨔼𧪾遡𨕬𨘋邨𨜓郄𨛦邮都酧㫰醩釄粬𨤳𡺉鈎沟鉁鉢𥖹銹𨫆𣲛𨬌𥗛\"],\n[\"90a1\",\"𠴱錬鍫𨫡𨯫炏嫃𨫢𨫥䥥鉄𨯬𨰹𨯿鍳鑛躼閅閦鐦閠濶䊹𢙺𨛘𡉼𣸮䧟氜陻隖䅬隣𦻕懚隶磵𨫠隽双䦡𦲸𠉴𦐐𩂯𩃥𤫑𡤕𣌊霱虂霶䨏䔽䖅𤫩灵孁霛靜𩇕靗孊𩇫靟鐥僐𣂷𣂼鞉鞟鞱鞾韀韒韠𥑬韮琜𩐳響韵𩐝𧥺䫑頴頳顋顦㬎𧅵㵑𠘰𤅜\"],\n[\"9140\",\"𥜆飊颷飈飇䫿𦴧𡛓喰飡飦飬鍸餹𤨩䭲𩡗𩤅駵騌騻騐驘𥜥㛄𩂱𩯕髠髢𩬅髴䰎鬔鬭𨘀倴鬴𦦨㣃𣁽魐魀𩴾婅𡡣鮎𤉋鰂鯿鰌𩹨鷔𩾷𪆒𪆫𪃡𪄣𪇟鵾鶃𪄴鸎梈\"],\n[\"91a1\",\"鷄𢅛𪆓𪈠𡤻𪈳鴹𪂹𪊴麐麕麞麢䴴麪麯𤍤黁㭠㧥㴝伲㞾𨰫鼂鼈䮖鐤𦶢鼗鼖鼹嚟嚊齅馸𩂋韲葿齢齩竜龎爖䮾𤥵𤦻煷𤧸𤍈𤩑玞𨯚𡣺禟𨥾𨸶鍩鏳𨩄鋬鎁鏋𨥬𤒹爗㻫睲穃烐𤑳𤏸煾𡟯炣𡢾𣖙㻇𡢅𥐯𡟸㜢𡛻𡠹㛡𡝴𡣑𥽋㜣𡛀坛𤨥𡏾𡊨\"],\n[\"9240\",\"𡏆𡒶蔃𣚦蔃葕𤦔𧅥𣸱𥕜𣻻𧁒䓴𣛮𩦝𦼦柹㜳㰕㷧塬𡤢栐䁗𣜿𤃡𤂋𤄏𦰡哋嚞𦚱嚒𠿟𠮨𠸍鏆𨬓鎜仸儫㠙𤐶亼𠑥𠍿佋侊𥙑婨𠆫𠏋㦙𠌊𠐔㐵伩𠋀𨺳𠉵諚𠈌亘\"],\n[\"92a1\",\"働儍侢伃𤨎𣺊佂倮偬傁俌俥偘僼兙兛兝兞湶𣖕𣸹𣺿浲𡢄𣺉冨凃𠗠䓝𠒣𠒒𠒑赺𨪜𠜎剙劤𠡳勡鍮䙺熌𤎌𠰠𤦬𡃤槑𠸝瑹㻞璙琔瑖玘䮎𤪼𤂍叐㖄爏𤃉喴𠍅响𠯆圝鉝雴鍦埝垍坿㘾壋媙𨩆𡛺𡝯𡜐娬妸銏婾嫏娒𥥆𡧳𡡡𤊕㛵洅瑃娡𥺃\"],\n[\"9340\",\"媁𨯗𠐓鏠璌𡌃焅䥲鐈𨧻鎽㞠尞岞幞幈𡦖𡥼𣫮廍孏𡤃𡤄㜁𡢠㛝𡛾㛓脪𨩇𡶺𣑲𨦨弌弎𡤧𡞫婫𡜻孄蘔𧗽衠恾𢡠𢘫忛㺸𢖯𢖾𩂈𦽳懀𠀾𠁆𢘛憙憘恵𢲛𢴇𤛔𩅍\"],\n[\"93a1\",\"摱𤙥𢭪㨩𢬢𣑐𩣪𢹸挷𪑛撶挱揑𤧣𢵧护𢲡搻敫楲㯴𣂎𣊭𤦉𣊫唍𣋠𡣙𩐿曎𣊉𣆳㫠䆐𥖄𨬢𥖏𡛼𥕛𥐥磮𣄃𡠪𣈴㑤𣈏𣆂𤋉暎𦴤晫䮓昰𧡰𡷫晣𣋒𣋡昞𥡲㣑𣠺𣞼㮙𣞢𣏾瓐㮖枏𤘪梶栞㯄檾㡣𣟕𤒇樳橒櫉欅𡤒攑梘橌㯗橺歗𣿀𣲚鎠鋲𨯪𨫋\"],\n[\"9440\",\"銉𨀞𨧜鑧涥漋𤧬浧𣽿㶏渄𤀼娽渊塇洤硂焻𤌚𤉶烱牐犇犔𤞏𤜥兹𤪤𠗫瑺𣻸𣙟𤩊𤤗𥿡㼆㺱𤫟𨰣𣼵悧㻳瓌琼鎇琷䒟𦷪䕑疃㽣𤳙𤴆㽘畕癳𪗆㬙瑨𨫌𤦫𤦎㫻\"],\n[\"94a1\",\"㷍𤩎㻿𤧅𤣳釺圲鍂𨫣𡡤僟𥈡𥇧睸𣈲眎眏睻𤚗𣞁㩞𤣰琸璛㺿𤪺𤫇䃈𤪖𦆮錇𥖁砞碍碈磒珐祙𧝁𥛣䄎禛蒖禥樭𣻺稺秴䅮𡛦䄲鈵秱𠵌𤦌𠊙𣶺𡝮㖗啫㕰㚪𠇔𠰍竢婙𢛵𥪯𥪜娍𠉛磰娪𥯆竾䇹籝籭䈑𥮳𥺼𥺦糍𤧹𡞰粎籼粮檲緜縇緓罎𦉡\"],\n[\"9540\",\"𦅜𧭈綗𥺂䉪𦭵𠤖柖𠁎𣗏埄𦐒𦏸𤥢翝笧𠠬𥫩𥵃笌𥸎駦虅驣樜𣐿㧢𤧷𦖭騟𦖠蒀𧄧𦳑䓪脷䐂胆脉腂𦞴飃𦩂艢艥𦩑葓𦶧蘐𧈛媆䅿𡡀嬫𡢡嫤𡣘蚠蜨𣶏蠭𧐢娂\"],\n[\"95a1\",\"衮佅袇袿裦襥襍𥚃襔𧞅𧞄𨯵𨯙𨮜𨧹㺭蒣䛵䛏㟲訽訜𩑈彍鈫𤊄旔焩烄𡡅鵭貟賩𧷜妚矃姰䍮㛔踪躧𤰉輰轊䋴汘澻𢌡䢛潹溋𡟚鯩㚵𤤯邻邗啱䤆醻鐄𨩋䁢𨫼鐧𨰝𨰻蓥訫閙閧閗閖𨴴瑅㻂𤣿𤩂𤏪㻧𣈥随𨻧𨹦𨹥㻌𤧭𤩸𣿮琒瑫㻼靁𩂰\"],\n[\"9640\",\"桇䨝𩂓𥟟靝鍨𨦉𨰦𨬯𦎾銺嬑譩䤼珹𤈛鞛靱餸𠼦巁𨯅𤪲頟𩓚鋶𩗗釥䓀𨭐𤩧𨭤飜𨩅㼀鈪䤥萔餻饍𧬆㷽馛䭯馪驜𨭥𥣈檏騡嫾騯𩣱䮐𩥈馼䮽䮗鍽塲𡌂堢𤦸\"],\n[\"96a1\",\"𡓨硄𢜟𣶸棅㵽鑘㤧慐𢞁𢥫愇鱏鱓鱻鰵鰐魿鯏𩸭鮟𪇵𪃾鴡䲮𤄄鸘䲰鴌𪆴𪃭𪃳𩤯鶥蒽𦸒𦿟𦮂藼䔳𦶤𦺄𦷰萠藮𦸀𣟗𦁤秢𣖜𣙀䤭𤧞㵢鏛銾鍈𠊿碹鉷鑍俤㑀遤𥕝砽硔碶硋𡝗𣇉𤥁㚚佲濚濙瀞瀞吔𤆵垻壳垊鴖埗焴㒯𤆬燫𦱀𤾗嬨𡞵𨩉\"],\n[\"9740\",\"愌嫎娋䊼𤒈㜬䭻𨧼鎻鎸𡣖𠼝葲𦳀𡐓𤋺𢰦𤏁妔𣶷𦝁綨𦅛𦂤𤦹𤦋𨧺鋥珢㻩璴𨭣𡢟㻡𤪳櫘珳珻㻖𤨾𤪔𡟙𤩦𠎧𡐤𤧥瑈𤤖炥𤥶銄珦鍟𠓾錱𨫎𨨖鎆𨯧𥗕䤵𨪂煫\"],\n[\"97a1\",\"𤥃𠳿嚤𠘚𠯫𠲸唂秄𡟺緾𡛂𤩐𡡒䔮鐁㜊𨫀𤦭妰𡢿𡢃𧒄媡㛢𣵛㚰鉟婹𨪁𡡢鍴㳍𠪴䪖㦊僴㵩㵌𡎜煵䋻𨈘渏𩃤䓫浗𧹏灧沯㳖𣿭𣸭渂漌㵯𠏵畑㚼㓈䚀㻚䡱姄鉮䤾轁𨰜𦯀堒埈㛖𡑒烾𤍢𤩱𢿣𡊰𢎽梹楧𡎘𣓥𧯴𣛟𨪃𣟖𣏺𤲟樚𣚭𦲷萾䓟䓎\"],\n[\"9840\",\"𦴦𦵑𦲂𦿞漗𧄉茽𡜺菭𦲀𧁓𡟛妉媂𡞳婡婱𡤅𤇼㜭姯𡜼㛇熎鎐暚𤊥婮娫𤊓樫𣻹𧜶𤑛𤋊焝𤉙𨧡侰𦴨峂𤓎𧹍𤎽樌𤉖𡌄炦焳𤏩㶥泟勇𤩏繥姫崯㷳彜𤩝𡟟綤萦\"],\n[\"98a1\",\"咅𣫺𣌀𠈔坾𠣕𠘙㿥𡾞𪊶瀃𩅛嵰玏糓𨩙𩐠俈翧狍猐𧫴猸猹𥛶獁獈㺩𧬘遬燵𤣲珡臶㻊県㻑沢国琙琞琟㻢㻰㻴㻺瓓㼎㽓畂畭畲疍㽼痈痜㿀癍㿗癴㿜発𤽜熈嘣覀塩䀝睃䀹条䁅㗛瞘䁪䁯属瞾矋売砘点砜䂨砹硇硑硦葈𥔵礳栃礲䄃\"],\n[\"9940\",\"䄉禑禙辻稆込䅧窑䆲窼艹䇄竏竛䇏両筢筬筻簒簛䉠䉺类粜䊌粸䊔糭输烀𠳏総緔緐緽羮羴犟䎗耠耥笹耮耱联㷌垴炠肷胩䏭脌猪脎脒畠脔䐁㬹腖腙腚\"],\n[\"99a1\",\"䐓堺腼膄䐥膓䐭膥埯臁臤艔䒏芦艶苊苘苿䒰荗险榊萅烵葤惣蒈䔄蒾蓡蓸蔐蔸蕒䔻蕯蕰藠䕷虲蚒蚲蛯际螋䘆䘗袮裿褤襇覑𧥧訩訸誔誴豑賔賲贜䞘塟跃䟭仮踺嗘坔蹱嗵躰䠷軎転軤軭軲辷迁迊迌逳駄䢭飠鈓䤞鈨鉘鉫銱銮銿\"],\n[\"9a40\",\"鋣鋫鋳鋴鋽鍃鎄鎭䥅䥑麿鐗匁鐝鐭鐾䥪鑔鑹锭関䦧间阳䧥枠䨤靀䨵鞲韂噔䫤惨颹䬙飱塄餎餙冴餜餷饂饝饢䭰駅䮝騼鬏窃魩鮁鯝鯱鯴䱭鰠㝯𡯂鵉鰺\"],\n[\"9aa1\",\"黾噐鶓鶽鷀鷼银辶鹻麬麱麽黆铜黢黱黸竈齄𠂔𠊷𠎠椚铃妬𠓗塀铁㞹𠗕𠘕𠙶𡚺块煳𠫂𠫍𠮿呪吆𠯋咞𠯻𠰻𠱓𠱥𠱼惧𠲍噺𠲵𠳝𠳭𠵯𠶲𠷈楕鰯螥𠸄𠸎𠻗𠾐𠼭𠹳尠𠾼帋𡁜𡁏𡁶朞𡁻𡂈𡂖㙇𡂿𡃓𡄯𡄻卤蒭𡋣𡍵𡌶讁𡕷𡘙𡟃𡟇乸炻𡠭𡥪\"],\n[\"9b40\",\"𡨭𡩅𡰪𡱰𡲬𡻈拃𡻕𡼕熘桕𢁅槩㛈𢉼𢏗𢏺𢜪𢡱𢥏苽𢥧𢦓𢫕覥𢫨辠𢬎鞸𢬿顇骽𢱌\"],\n[\"9b62\",\"𢲈𢲷𥯨𢴈𢴒𢶷𢶕𢹂𢽴𢿌𣀳𣁦𣌟𣏞徱晈暿𧩹𣕧𣗳爁𤦺矗𣘚𣜖纇𠍆墵朎\"],\n[\"9ba1\",\"椘𣪧𧙗𥿢𣸑𣺹𧗾𢂚䣐䪸𤄙𨪚𤋮𤌍𤀻𤌴𤎖𤩅𠗊凒𠘑妟𡺨㮾𣳿𤐄𤓖垈𤙴㦛𤜯𨗨𩧉㝢𢇃譞𨭎駖𤠒𤣻𤨕爉𤫀𠱸奥𤺥𤾆𠝹軚𥀬劏圿煱𥊙𥐙𣽊𤪧喼𥑆𥑮𦭒釔㑳𥔿𧘲𥕞䜘𥕢𥕦𥟇𤤿𥡝偦㓻𣏌惞𥤃䝼𨥈𥪮𥮉𥰆𡶐垡煑澶𦄂𧰒遖𦆲𤾚譢𦐂𦑊\"],\n[\"9c40\",\"嵛𦯷輶𦒄𡤜諪𤧶𦒈𣿯𦔒䯀𦖿𦚵𢜛鑥𥟡憕娧晉侻嚹𤔡𦛼乪𤤴陖涏𦲽㘘襷𦞙𦡮𦐑𦡞營𦣇筂𩃀𠨑𦤦鄄𦤹穅鷰𦧺騦𦨭㙟𦑩𠀡禃𦨴𦭛崬𣔙菏𦮝䛐𦲤画补𦶮墶\"],\n[\"9ca1\",\"㜜𢖍𧁋𧇍㱔𧊀𧊅銁𢅺𧊋錰𧋦𤧐氹钟𧑐𠻸蠧裵𢤦𨑳𡞱溸𤨪𡠠㦤㚹尐秣䔿暶𩲭𩢤襃𧟌𧡘囖䃟𡘊㦡𣜯𨃨𡏅熭荦𧧝𩆨婧䲷𧂯𨦫𧧽𧨊𧬋𧵦𤅺筃祾𨀉澵𪋟樃𨌘厢𦸇鎿栶靝𨅯𨀣𦦵𡏭𣈯𨁈嶅𨰰𨂃圕頣𨥉嶫𤦈斾槕叒𤪥𣾁㰑朶𨂐𨃴𨄮𡾡𨅏\"],\n[\"9d40\",\"𨆉𨆯𨈚𨌆𨌯𨎊㗊𨑨𨚪䣺揦𨥖砈鉕𨦸䏲𨧧䏟𨧨𨭆𨯔姸𨰉輋𨿅𩃬筑𩄐𩄼㷷𩅞𤫊运犏嚋𩓧𩗩𩖰𩖸𩜲𩣑𩥉𩥪𩧃𩨨𩬎𩵚𩶛纟𩻸𩼣䲤镇𪊓熢𪋿䶑递𪗋䶜𠲜达嗁\"],\n[\"9da1\",\"辺𢒰边𤪓䔉繿潖檱仪㓤𨬬𧢝㜺躀𡟵𨀤𨭬𨮙𧨾𦚯㷫𧙕𣲷𥘵𥥖亚𥺁𦉘嚿𠹭踎孭𣺈𤲞揞拐𡟶𡡻攰嘭𥱊吚𥌑㷆𩶘䱽嘢嘞罉𥻘奵𣵀蝰东𠿪𠵉𣚺脗鵞贘瘻鱅癎瞹鍅吲腈苷嘥脲萘肽嗪祢噃吖𠺝㗎嘅嗱曱𨋢㘭甴嗰喺咗啲𠱁𠲖廐𥅈𠹶𢱢\"],\n[\"9e40\",\"𠺢麫絚嗞𡁵抝靭咔賍燶酶揼掹揾啩𢭃鱲𢺳冚㓟𠶧冧呍唞唓癦踭𦢊疱肶蠄螆裇膶萜𡃁䓬猄𤜆宐茋𦢓噻𢛴𧴯𤆣𧵳𦻐𧊶酰𡇙鈈𣳼𪚩𠺬𠻹牦𡲢䝎𤿂𧿹𠿫䃺\"],\n[\"9ea1\",\"鱝攟𢶠䣳𤟠𩵼𠿬𠸊恢𧖣𠿭\"],\n[\"9ead\",\"𦁈𡆇熣纎鵐业丄㕷嬍沲卧㚬㧜卽㚥𤘘墚𤭮舭呋垪𥪕𠥹\"],\n[\"9ec5\",\"㩒𢑥獴𩺬䴉鯭𣳾𩼰䱛𤾩𩖞𩿞葜𣶶𧊲𦞳𣜠挮紥𣻷𣸬㨪逈勌㹴㙺䗩𠒎癀嫰𠺶硺𧼮墧䂿噼鮋嵴癔𪐴麅䳡痹㟻愙𣃚𤏲\"],\n[\"9ef5\",\"噝𡊩垧𤥣𩸆刴𧂮㖭汊鵼\"],\n[\"9f40\",\"籖鬹埞𡝬屓擓𩓐𦌵𧅤蚭𠴨𦴢𤫢𠵱\"],\n[\"9f4f\",\"凾𡼏嶎霃𡷑麁遌笟鬂峑箣扨挵髿篏鬪籾鬮籂粆鰕篼鬉鼗鰛𤤾齚啳寃俽麘俲剠㸆勑坧偖妷帒韈鶫轜呩鞴饀鞺匬愰\"],\n[\"9fa1\",\"椬叚鰊鴂䰻陁榀傦畆𡝭駚剳\"],\n[\"9fae\",\"酙隁酜\"],\n[\"9fb2\",\"酑𨺗捿𦴣櫊嘑醎畺抅𠏼獏籰𥰡𣳽\"],\n[\"9fc1\",\"𤤙盖鮝个𠳔莾衂\"],\n[\"9fc9\",\"届槀僭坺刟巵从氱𠇲伹咜哚劚趂㗾弌㗳\"],\n[\"9fdb\",\"歒酼龥鮗頮颴骺麨麄煺笔\"],\n[\"9fe7\",\"毺蠘罸\"],\n[\"9feb\",\"嘠𪙊蹷齓\"],\n[\"9ff0\",\"跔蹏鸜踁抂𨍽踨蹵竓𤩷稾磘泪詧瘇\"],\n[\"a040\",\"𨩚鼦泎蟖痃𪊲硓咢贌狢獱謭猂瓱賫𤪻蘯徺袠䒷\"],\n[\"a055\",\"𡠻𦸅\"],\n[\"a058\",\"詾𢔛\"],\n[\"a05b\",\"惽癧髗鵄鍮鮏蟵\"],\n[\"a063\",\"蠏賷猬霡鮰㗖犲䰇籑饊𦅙慙䰄麖慽\"],\n[\"a073\",\"坟慯抦戹拎㩜懢厪𣏵捤栂㗒\"],\n[\"a0a1\",\"嵗𨯂迚𨸹\"],\n[\"a0a6\",\"僙𡵆礆匲阸𠼻䁥\"],\n[\"a0ae\",\"矾\"],\n[\"a0b0\",\"糂𥼚糚稭聦聣絍甅瓲覔舚朌聢𧒆聛瓰脃眤覉𦟌畓𦻑螩蟎臈螌詉貭譃眫瓸蓚㘵榲趦\"],\n[\"a0d4\",\"覩瑨涹蟁𤀑瓧㷛煶悤憜㳑煢恷\"],\n[\"a0e2\",\"罱𨬭牐惩䭾删㰘𣳇𥻗𧙖𥔱𡥄𡋾𩤃𦷜𧂭峁𦆭𨨏𣙷𠃮𦡆𤼎䕢嬟𦍌齐麦𦉫\"],\n[\"a3c0\",\"␀\",31,\"␡\"],\n[\"c6a1\",\"①\",9,\"⑴\",9,\"ⅰ\",9,\"丶丿亅亠冂冖冫勹匸卩厶夊宀巛⼳广廴彐彡攴无疒癶辵隶¨ˆヽヾゝゞ〃仝々〆〇ー［］✽ぁ\",23],\n[\"c740\",\"す\",58,\"ァアィイ\"],\n[\"c7a1\",\"ゥ\",81,\"А\",5,\"ЁЖ\",4],\n[\"c840\",\"Л\",26,\"ёж\",25,\"⇧↸↹㇏𠃌乚𠂊刂䒑\"],\n[\"c8a1\",\"龰冈龱𧘇\"],\n[\"c8cd\",\"￢￤＇＂㈱№℡゛゜⺀⺄⺆⺇⺈⺊⺌⺍⺕⺜⺝⺥⺧⺪⺬⺮⺶⺼⺾⻆⻊⻌⻍⻏⻖⻗⻞⻣\"],\n[\"c8f5\",\"ʃɐɛɔɵœøŋʊɪ\"],\n[\"f9fe\",\"￭\"],\n[\"fa40\",\"𠕇鋛𠗟𣿅蕌䊵珯况㙉𤥂𨧤鍄𡧛苮𣳈砼杄拟𤤳𨦪𠊠𦮳𡌅侫𢓭倈𦴩𧪄𣘀𤪱𢔓倩𠍾徤𠎀𠍇滛𠐟偽儁㑺儎顬㝃萖𤦤𠒇兠𣎴兪𠯿𢃼𠋥𢔰𠖎𣈳𡦃宂蝽𠖳𣲙冲冸\"],\n[\"faa1\",\"鴴凉减凑㳜凓𤪦决凢卂凭菍椾𣜭彻刋刦刼劵剗劔効勅簕蕂勠蘍𦬓包𨫞啉滙𣾀𠥔𣿬匳卄𠯢泋𡜦栛珕恊㺪㣌𡛨燝䒢卭却𨚫卾卿𡖖𡘓矦厓𨪛厠厫厮玧𥝲㽙玜叁叅汉义埾叙㪫𠮏叠𣿫𢶣叶𠱷吓灹唫晗浛呭𦭓𠵴啝咏咤䞦𡜍𠻝㶴𠵍\"],\n[\"fb40\",\"𨦼𢚘啇䳭启琗喆喩嘅𡣗𤀺䕒𤐵暳𡂴嘷曍𣊊暤暭噍噏磱囱鞇叾圀囯园𨭦㘣𡉏坆𤆥汮炋坂㚱𦱾埦𡐖堃𡑔𤍣堦𤯵塜墪㕡壠壜𡈼壻寿坃𪅐𤉸鏓㖡够梦㛃湙\"],\n[\"fba1\",\"𡘾娤啓𡚒蔅姉𠵎𦲁𦴪𡟜姙𡟻𡞲𦶦浱𡠨𡛕姹𦹅媫婣㛦𤦩婷㜈媖瑥嫓𦾡𢕔㶅𡤑㜲𡚸広勐孶斈孼𧨎䀄䡝𠈄寕慠𡨴𥧌𠖥寳宝䴐尅𡭄尓珎尔𡲥𦬨屉䣝岅峩峯嶋𡷹𡸷崐崘嵆𡺤岺巗苼㠭𤤁𢁉𢅳芇㠶㯂帮檊幵幺𤒼𠳓厦亷廐厨𡝱帉廴𨒂\"],\n[\"fc40\",\"廹廻㢠廼栾鐛弍𠇁弢㫞䢮𡌺强𦢈𢏐彘𢑱彣鞽𦹮彲鍀𨨶徧嶶㵟𥉐𡽪𧃸𢙨釖𠊞𨨩怱暅𡡷㥣㷇㘹垐𢞴祱㹀悞悤悳𤦂𤦏𧩓璤僡媠慤萤慂慈𦻒憁凴𠙖憇宪𣾷\"],\n[\"fca1\",\"𢡟懓𨮝𩥝懐㤲𢦀𢣁怣慜攞掋𠄘担𡝰拕𢸍捬𤧟㨗搸揸𡎎𡟼撐澊𢸶頔𤂌𥜝擡擥鑻㩦携㩗敍漖𤨨𤨣斅敭敟𣁾斵𤥀䬷旑䃘𡠩无旣忟𣐀昘𣇷𣇸晄𣆤𣆥晋𠹵晧𥇦晳晴𡸽𣈱𨗴𣇈𥌓矅𢣷馤朂𤎜𤨡㬫槺𣟂杞杧杢𤇍𩃭柗䓩栢湐鈼栁𣏦𦶠桝\"],\n[\"fd40\",\"𣑯槡樋𨫟楳棃𣗍椁椀㴲㨁𣘼㮀枬楡𨩊䋼椶榘㮡𠏉荣傐槹𣙙𢄪橅𣜃檝㯳枱櫈𩆜㰍欝𠤣惞欵歴𢟍溵𣫛𠎵𡥘㝀吡𣭚毡𣻼毜氷𢒋𤣱𦭑汚舦汹𣶼䓅𣶽𤆤𤤌𤤀\"],\n[\"fda1\",\"𣳉㛥㳫𠴲鮃𣇹𢒑羏样𦴥𦶡𦷫涖浜湼漄𤥿𤂅𦹲蔳𦽴凇沜渝萮𨬡港𣸯瑓𣾂秌湏媑𣁋濸㜍澝𣸰滺𡒗𤀽䕕鏰潄潜㵎潴𩅰㴻澟𤅄濓𤂑𤅕𤀹𣿰𣾴𤄿凟𤅖𤅗𤅀𦇝灋灾炧炁烌烕烖烟䄄㷨熴熖𤉷焫煅媈煊煮岜𤍥煏鍢𤋁焬𤑚𤨧𤨢熺𨯨炽爎\"],\n[\"fe40\",\"鑂爕夑鑃爤鍁𥘅爮牀𤥴梽牕牗㹕𣁄栍漽犂猪猫𤠣𨠫䣭𨠄猨献珏玪𠰺𦨮珉瑉𤇢𡛧𤨤昣㛅𤦷𤦍𤧻珷琕椃𤨦琹𠗃㻗瑜𢢭瑠𨺲瑇珤瑶莹瑬㜰瑴鏱樬璂䥓𤪌\"],\n[\"fea1\",\"𤅟𤩹𨮏孆𨰃𡢞瓈𡦈甎瓩甞𨻙𡩋寗𨺬鎅畍畊畧畮𤾂㼄𤴓疎瑝疞疴瘂瘬癑癏癯癶𦏵皐臯㟸𦤑𦤎皡皥皷盌𦾟葢𥂝𥅽𡸜眞眦着撯𥈠睘𣊬瞯𨥤𨥨𡛁矴砉𡍶𤨒棊碯磇磓隥礮𥗠磗礴碱𧘌辸袄𨬫𦂃𢘜禆褀椂禀𥡗禝𧬹礼禩渪𧄦㺨秆𩄍秔\"]\n]\n");
__memMods.set("iconv-lite/encodings/tables/cp936.json", "[\n[\"0\",\"\\u0000\",127,\"€\"],\n[\"8140\",\"丂丄丅丆丏丒丗丟丠両丣並丩丮丯丱丳丵丷丼乀乁乂乄乆乊乑乕乗乚乛乢乣乤乥乧乨乪\",5,\"乲乴\",9,\"乿\",6,\"亇亊\"],\n[\"8180\",\"亐亖亗亙亜亝亞亣亪亯亰亱亴亶亷亸亹亼亽亾仈仌仏仐仒仚仛仜仠仢仦仧仩仭仮仯仱仴仸仹仺仼仾伀伂\",6,\"伋伌伒\",4,\"伜伝伡伣伨伩伬伭伮伱伳伵伷伹伻伾\",4,\"佄佅佇\",5,\"佒佔佖佡佢佦佨佪佫佭佮佱佲併佷佸佹佺佽侀侁侂侅來侇侊侌侎侐侒侓侕侖侘侙侚侜侞侟価侢\"],\n[\"8240\",\"侤侫侭侰\",4,\"侶\",8,\"俀俁係俆俇俈俉俋俌俍俒\",4,\"俙俛俠俢俤俥俧俫俬俰俲俴俵俶俷俹俻俼俽俿\",11],\n[\"8280\",\"個倎倐們倓倕倖倗倛倝倞倠倢倣値倧倫倯\",10,\"倻倽倿偀偁偂偄偅偆偉偊偋偍偐\",4,\"偖偗偘偙偛偝\",7,\"偦\",5,\"偭\",8,\"偸偹偺偼偽傁傂傃傄傆傇傉傊傋傌傎\",20,\"傤傦傪傫傭\",4,\"傳\",6,\"傼\"],\n[\"8340\",\"傽\",17,\"僐\",5,\"僗僘僙僛\",10,\"僨僩僪僫僯僰僱僲僴僶\",4,\"僼\",9,\"儈\"],\n[\"8380\",\"儉儊儌\",5,\"儓\",13,\"儢\",28,\"兂兇兊兌兎兏児兒兓兗兘兙兛兝\",4,\"兣兤兦內兩兪兯兲兺兾兿冃冄円冇冊冋冎冏冐冑冓冔冘冚冝冞冟冡冣冦\",4,\"冭冮冴冸冹冺冾冿凁凂凃凅凈凊凍凎凐凒\",5],\n[\"8440\",\"凘凙凚凜凞凟凢凣凥\",5,\"凬凮凱凲凴凷凾刄刅刉刋刌刏刐刓刔刕刜刞刟刡刢刣別刦刧刪刬刯刱刲刴刵刼刾剄\",5,\"剋剎剏剒剓剕剗剘\"],\n[\"8480\",\"剙剚剛剝剟剠剢剣剤剦剨剫剬剭剮剰剱剳\",9,\"剾劀劃\",4,\"劉\",6,\"劑劒劔\",6,\"劜劤劥劦劧劮劯劰労\",9,\"勀勁勂勄勅勆勈勊勌勍勎勏勑勓勔動勗務\",5,\"勠勡勢勣勥\",10,\"勱\",7,\"勻勼勽匁匂匃匄匇匉匊匋匌匎\"],\n[\"8540\",\"匑匒匓匔匘匛匜匞匟匢匤匥匧匨匩匫匬匭匯\",9,\"匼匽區卂卄卆卋卌卍卐協単卙卛卝卥卨卪卬卭卲卶卹卻卼卽卾厀厁厃厇厈厊厎厏\"],\n[\"8580\",\"厐\",4,\"厖厗厙厛厜厞厠厡厤厧厪厫厬厭厯\",6,\"厷厸厹厺厼厽厾叀參\",4,\"収叏叐叒叓叕叚叜叝叞叡叢叧叴叺叾叿吀吂吅吇吋吔吘吙吚吜吢吤吥吪吰吳吶吷吺吽吿呁呂呄呅呇呉呌呍呎呏呑呚呝\",4,\"呣呥呧呩\",7,\"呴呹呺呾呿咁咃咅咇咈咉咊咍咑咓咗咘咜咞咟咠咡\"],\n[\"8640\",\"咢咥咮咰咲咵咶咷咹咺咼咾哃哅哊哋哖哘哛哠\",4,\"哫哬哯哰哱哴\",5,\"哻哾唀唂唃唄唅唈唊\",4,\"唒唓唕\",5,\"唜唝唞唟唡唥唦\"],\n[\"8680\",\"唨唩唫唭唲唴唵唶唸唹唺唻唽啀啂啅啇啈啋\",4,\"啑啒啓啔啗\",4,\"啝啞啟啠啢啣啨啩啫啯\",5,\"啹啺啽啿喅喆喌喍喎喐喒喓喕喖喗喚喛喞喠\",6,\"喨\",8,\"喲喴営喸喺喼喿\",4,\"嗆嗇嗈嗊嗋嗎嗏嗐嗕嗗\",4,\"嗞嗠嗢嗧嗩嗭嗮嗰嗱嗴嗶嗸\",4,\"嗿嘂嘃嘄嘅\"],\n[\"8740\",\"嘆嘇嘊嘋嘍嘐\",7,\"嘙嘚嘜嘝嘠嘡嘢嘥嘦嘨嘩嘪嘫嘮嘯嘰嘳嘵嘷嘸嘺嘼嘽嘾噀\",11,\"噏\",4,\"噕噖噚噛噝\",4],\n[\"8780\",\"噣噥噦噧噭噮噯噰噲噳噴噵噷噸噹噺噽\",7,\"嚇\",6,\"嚐嚑嚒嚔\",14,\"嚤\",10,\"嚰\",6,\"嚸嚹嚺嚻嚽\",12,\"囋\",8,\"囕囖囘囙囜団囥\",5,\"囬囮囯囲図囶囷囸囻囼圀圁圂圅圇國\",6],\n[\"8840\",\"園\",9,\"圝圞圠圡圢圤圥圦圧圫圱圲圴\",4,\"圼圽圿坁坃坄坅坆坈坉坋坒\",4,\"坘坙坢坣坥坧坬坮坰坱坲坴坵坸坹坺坽坾坿垀\"],\n[\"8880\",\"垁垇垈垉垊垍\",4,\"垔\",6,\"垜垝垞垟垥垨垪垬垯垰垱垳垵垶垷垹\",8,\"埄\",6,\"埌埍埐埑埓埖埗埛埜埞埡埢埣埥\",7,\"埮埰埱埲埳埵埶執埻埼埾埿堁堃堄堅堈堉堊堌堎堏堐堒堓堔堖堗堘堚堛堜堝堟堢堣堥\",4,\"堫\",4,\"報堲堳場堶\",7],\n[\"8940\",\"堾\",5,\"塅\",6,\"塎塏塐塒塓塕塖塗塙\",4,\"塟\",5,\"塦\",4,\"塭\",16,\"塿墂墄墆墇墈墊墋墌\"],\n[\"8980\",\"墍\",4,\"墔\",4,\"墛墜墝墠\",7,\"墪\",17,\"墽墾墿壀壂壃壄壆\",10,\"壒壓壔壖\",13,\"壥\",5,\"壭壯壱売壴壵壷壸壺\",7,\"夃夅夆夈\",4,\"夎夐夑夒夓夗夘夛夝夞夠夡夢夣夦夨夬夰夲夳夵夶夻\"],\n[\"8a40\",\"夽夾夿奀奃奅奆奊奌奍奐奒奓奙奛\",4,\"奡奣奤奦\",12,\"奵奷奺奻奼奾奿妀妅妉妋妌妎妏妐妑妔妕妘妚妛妜妝妟妠妡妢妦\"],\n[\"8a80\",\"妧妬妭妰妱妳\",5,\"妺妼妽妿\",6,\"姇姈姉姌姍姎姏姕姖姙姛姞\",4,\"姤姦姧姩姪姫姭\",11,\"姺姼姽姾娀娂娊娋娍娎娏娐娒娔娕娖娗娙娚娛娝娞娡娢娤娦娧娨娪\",6,\"娳娵娷\",4,\"娽娾娿婁\",4,\"婇婈婋\",9,\"婖婗婘婙婛\",5],\n[\"8b40\",\"婡婣婤婥婦婨婩婫\",8,\"婸婹婻婼婽婾媀\",17,\"媓\",6,\"媜\",13,\"媫媬\"],\n[\"8b80\",\"媭\",4,\"媴媶媷媹\",4,\"媿嫀嫃\",5,\"嫊嫋嫍\",4,\"嫓嫕嫗嫙嫚嫛嫝嫞嫟嫢嫤嫥嫧嫨嫪嫬\",4,\"嫲\",22,\"嬊\",11,\"嬘\",25,\"嬳嬵嬶嬸\",7,\"孁\",6],\n[\"8c40\",\"孈\",7,\"孒孖孞孠孡孧孨孫孭孮孯孲孴孶孷學孹孻孼孾孿宂宆宊宍宎宐宑宒宔宖実宧宨宩宬宭宮宯宱宲宷宺宻宼寀寁寃寈寉寊寋寍寎寏\"],\n[\"8c80\",\"寑寔\",8,\"寠寢寣實寧審\",4,\"寯寱\",6,\"寽対尀専尃尅將專尋尌對導尐尒尓尗尙尛尞尟尠尡尣尦尨尩尪尫尭尮尯尰尲尳尵尶尷屃屄屆屇屌屍屒屓屔屖屗屘屚屛屜屝屟屢層屧\",6,\"屰屲\",6,\"屻屼屽屾岀岃\",4,\"岉岊岋岎岏岒岓岕岝\",4,\"岤\",4],\n[\"8d40\",\"岪岮岯岰岲岴岶岹岺岻岼岾峀峂峃峅\",5,\"峌\",5,\"峓\",5,\"峚\",6,\"峢峣峧峩峫峬峮峯峱\",9,\"峼\",4],\n[\"8d80\",\"崁崄崅崈\",5,\"崏\",4,\"崕崗崘崙崚崜崝崟\",4,\"崥崨崪崫崬崯\",4,\"崵\",7,\"崿\",7,\"嵈嵉嵍\",10,\"嵙嵚嵜嵞\",10,\"嵪嵭嵮嵰嵱嵲嵳嵵\",12,\"嶃\",21,\"嶚嶛嶜嶞嶟嶠\"],\n[\"8e40\",\"嶡\",21,\"嶸\",12,\"巆\",6,\"巎\",12,\"巜巟巠巣巤巪巬巭\"],\n[\"8e80\",\"巰巵巶巸\",4,\"巿帀帄帇帉帊帋帍帎帒帓帗帞\",7,\"帨\",4,\"帯帰帲\",4,\"帹帺帾帿幀幁幃幆\",5,\"幍\",6,\"幖\",4,\"幜幝幟幠幣\",14,\"幵幷幹幾庁庂広庅庈庉庌庍庎庒庘庛庝庡庢庣庤庨\",4,\"庮\",4,\"庴庺庻庼庽庿\",6],\n[\"8f40\",\"廆廇廈廋\",5,\"廔廕廗廘廙廚廜\",11,\"廩廫\",8,\"廵廸廹廻廼廽弅弆弇弉弌弍弎弐弒弔弖弙弚弜弝弞弡弢弣弤\"],\n[\"8f80\",\"弨弫弬弮弰弲\",6,\"弻弽弾弿彁\",14,\"彑彔彙彚彛彜彞彟彠彣彥彧彨彫彮彯彲彴彵彶彸彺彽彾彿徃徆徍徎徏徑従徔徖徚徛徝從徟徠徢\",5,\"復徫徬徯\",5,\"徶徸徹徺徻徾\",4,\"忇忈忊忋忎忓忔忕忚忛応忞忟忢忣忥忦忨忩忬忯忰忲忳忴忶忷忹忺忼怇\"],\n[\"9040\",\"怈怉怋怌怐怑怓怗怘怚怞怟怢怣怤怬怭怮怰\",4,\"怶\",4,\"怽怾恀恄\",6,\"恌恎恏恑恓恔恖恗恘恛恜恞恟恠恡恥恦恮恱恲恴恵恷恾悀\"],\n[\"9080\",\"悁悂悅悆悇悈悊悋悎悏悐悑悓悕悗悘悙悜悞悡悢悤悥悧悩悪悮悰悳悵悶悷悹悺悽\",7,\"惇惈惉惌\",4,\"惒惓惔惖惗惙惛惞惡\",4,\"惪惱惲惵惷惸惻\",4,\"愂愃愄愅愇愊愋愌愐\",4,\"愖愗愘愙愛愜愝愞愡愢愥愨愩愪愬\",18,\"慀\",6],\n[\"9140\",\"慇慉態慍慏慐慒慓慔慖\",6,\"慞慟慠慡慣慤慥慦慩\",6,\"慱慲慳慴慶慸\",18,\"憌憍憏\",4,\"憕\"],\n[\"9180\",\"憖\",6,\"憞\",8,\"憪憫憭\",9,\"憸\",5,\"憿懀懁懃\",4,\"應懌\",4,\"懓懕\",16,\"懧\",13,\"懶\",8,\"戀\",5,\"戇戉戓戔戙戜戝戞戠戣戦戧戨戩戫戭戯戰戱戲戵戶戸\",4,\"扂扄扅扆扊\"],\n[\"9240\",\"扏扐払扖扗扙扚扜\",6,\"扤扥扨扱扲扴扵扷扸扺扻扽抁抂抃抅抆抇抈抋\",5,\"抔抙抜抝択抣抦抧抩抪抭抮抯抰抲抳抴抶抷抸抺抾拀拁\"],\n[\"9280\",\"拃拋拏拑拕拝拞拠拡拤拪拫拰拲拵拸拹拺拻挀挃挄挅挆挊挋挌挍挏挐挒挓挔挕挗挘挙挜挦挧挩挬挭挮挰挱挳\",5,\"挻挼挾挿捀捁捄捇捈捊捑捒捓捔捖\",7,\"捠捤捥捦捨捪捫捬捯捰捲捳捴捵捸捹捼捽捾捿掁掃掄掅掆掋掍掑掓掔掕掗掙\",6,\"採掤掦掫掯掱掲掵掶掹掻掽掿揀\"],\n[\"9340\",\"揁揂揃揅揇揈揊揋揌揑揓揔揕揗\",6,\"揟揢揤\",4,\"揫揬揮揯揰揱揳揵揷揹揺揻揼揾搃搄搆\",4,\"損搎搑搒搕\",5,\"搝搟搢搣搤\"],\n[\"9380\",\"搥搧搨搩搫搮\",5,\"搵\",4,\"搻搼搾摀摂摃摉摋\",6,\"摓摕摖摗摙\",4,\"摟\",7,\"摨摪摫摬摮\",9,\"摻\",6,\"撃撆撈\",8,\"撓撔撗撘撚撛撜撝撟\",4,\"撥撦撧撨撪撫撯撱撲撳撴撶撹撻撽撾撿擁擃擄擆\",6,\"擏擑擓擔擕擖擙據\"],\n[\"9440\",\"擛擜擝擟擠擡擣擥擧\",24,\"攁\",7,\"攊\",7,\"攓\",4,\"攙\",8],\n[\"9480\",\"攢攣攤攦\",4,\"攬攭攰攱攲攳攷攺攼攽敀\",4,\"敆敇敊敋敍敎敐敒敓敔敗敘敚敜敟敠敡敤敥敧敨敩敪敭敮敯敱敳敵敶數\",14,\"斈斉斊斍斎斏斒斔斕斖斘斚斝斞斠斢斣斦斨斪斬斮斱\",7,\"斺斻斾斿旀旂旇旈旉旊旍旐旑旓旔旕旘\",7,\"旡旣旤旪旫\"],\n[\"9540\",\"旲旳旴旵旸旹旻\",4,\"昁昄昅昇昈昉昋昍昐昑昒昖昗昘昚昛昜昞昡昢昣昤昦昩昪昫昬昮昰昲昳昷\",4,\"昽昿晀時晄\",6,\"晍晎晐晑晘\"],\n[\"9580\",\"晙晛晜晝晞晠晢晣晥晧晩\",4,\"晱晲晳晵晸晹晻晼晽晿暀暁暃暅暆暈暉暊暋暍暎暏暐暒暓暔暕暘\",4,\"暞\",8,\"暩\",4,\"暯\",4,\"暵暶暷暸暺暻暼暽暿\",25,\"曚曞\",7,\"曧曨曪\",5,\"曱曵曶書曺曻曽朁朂會\"],\n[\"9640\",\"朄朅朆朇朌朎朏朑朒朓朖朘朙朚朜朞朠\",5,\"朧朩朮朰朲朳朶朷朸朹朻朼朾朿杁杄杅杇杊杋杍杒杔杕杗\",4,\"杝杢杣杤杦杧杫杬杮東杴杶\"],\n[\"9680\",\"杸杹杺杻杽枀枂枃枅枆枈枊枌枍枎枏枑枒枓枔枖枙枛枟枠枡枤枦枩枬枮枱枲枴枹\",7,\"柂柅\",9,\"柕柖柗柛柟柡柣柤柦柧柨柪柫柭柮柲柵\",7,\"柾栁栂栃栄栆栍栐栒栔栕栘\",4,\"栞栟栠栢\",6,\"栫\",6,\"栴栵栶栺栻栿桇桋桍桏桒桖\",5],\n[\"9740\",\"桜桝桞桟桪桬\",7,\"桵桸\",8,\"梂梄梇\",7,\"梐梑梒梔梕梖梘\",9,\"梣梤梥梩梪梫梬梮梱梲梴梶梷梸\"],\n[\"9780\",\"梹\",6,\"棁棃\",5,\"棊棌棎棏棐棑棓棔棖棗棙棛\",4,\"棡棢棤\",9,\"棯棲棳棴棶棷棸棻棽棾棿椀椂椃椄椆\",4,\"椌椏椑椓\",11,\"椡椢椣椥\",7,\"椮椯椱椲椳椵椶椷椸椺椻椼椾楀楁楃\",16,\"楕楖楘楙楛楜楟\"],\n[\"9840\",\"楡楢楤楥楧楨楩楪楬業楯楰楲\",4,\"楺楻楽楾楿榁榃榅榊榋榌榎\",5,\"榖榗榙榚榝\",9,\"榩榪榬榮榯榰榲榳榵榶榸榹榺榼榽\"],\n[\"9880\",\"榾榿槀槂\",7,\"構槍槏槑槒槓槕\",5,\"槜槝槞槡\",11,\"槮槯槰槱槳\",9,\"槾樀\",9,\"樋\",11,\"標\",5,\"樠樢\",5,\"権樫樬樭樮樰樲樳樴樶\",6,\"樿\",4,\"橅橆橈\",7,\"橑\",6,\"橚\"],\n[\"9940\",\"橜\",4,\"橢橣橤橦\",10,\"橲\",6,\"橺橻橽橾橿檁檂檃檅\",8,\"檏檒\",4,\"檘\",7,\"檡\",5],\n[\"9980\",\"檧檨檪檭\",114,\"欥欦欨\",6],\n[\"9a40\",\"欯欰欱欳欴欵欶欸欻欼欽欿歀歁歂歄歅歈歊歋歍\",11,\"歚\",7,\"歨歩歫\",13,\"歺歽歾歿殀殅殈\"],\n[\"9a80\",\"殌殎殏殐殑殔殕殗殘殙殜\",4,\"殢\",7,\"殫\",7,\"殶殸\",6,\"毀毃毄毆\",4,\"毌毎毐毑毘毚毜\",4,\"毢\",7,\"毬毭毮毰毱毲毴毶毷毸毺毻毼毾\",6,\"氈\",4,\"氎氒気氜氝氞氠氣氥氫氬氭氱氳氶氷氹氺氻氼氾氿汃汄汅汈汋\",4,\"汑汒汓汖汘\"],\n[\"9b40\",\"汙汚汢汣汥汦汧汫\",4,\"汱汳汵汷汸決汻汼汿沀沄沇沊沋沍沎沑沒沕沖沗沘沚沜沝沞沠沢沨沬沯沰沴沵沶沷沺泀況泂泃泆泇泈泋泍泎泏泑泒泘\"],\n[\"9b80\",\"泙泚泜泝泟泤泦泧泩泬泭泲泴泹泿洀洂洃洅洆洈洉洊洍洏洐洑洓洔洕洖洘洜洝洟\",5,\"洦洨洩洬洭洯洰洴洶洷洸洺洿浀浂浄浉浌浐浕浖浗浘浛浝浟浡浢浤浥浧浨浫浬浭浰浱浲浳浵浶浹浺浻浽\",4,\"涃涄涆涇涊涋涍涏涐涒涖\",4,\"涜涢涥涬涭涰涱涳涴涶涷涹\",5,\"淁淂淃淈淉淊\"],\n[\"9c40\",\"淍淎淏淐淒淓淔淕淗淚淛淜淟淢淣淥淧淨淩淪淭淯淰淲淴淵淶淸淺淽\",7,\"渆渇済渉渋渏渒渓渕渘渙減渜渞渟渢渦渧渨渪測渮渰渱渳渵\"],\n[\"9c80\",\"渶渷渹渻\",7,\"湅\",7,\"湏湐湑湒湕湗湙湚湜湝湞湠\",10,\"湬湭湯\",14,\"満溁溂溄溇溈溊\",4,\"溑\",6,\"溙溚溛溝溞溠溡溣溤溦溨溩溫溬溭溮溰溳溵溸溹溼溾溿滀滃滄滅滆滈滉滊滌滍滎滐滒滖滘滙滛滜滝滣滧滪\",5],\n[\"9d40\",\"滰滱滲滳滵滶滷滸滺\",7,\"漃漄漅漇漈漊\",4,\"漐漑漒漖\",9,\"漡漢漣漥漦漧漨漬漮漰漲漴漵漷\",6,\"漿潀潁潂\"],\n[\"9d80\",\"潃潄潅潈潉潊潌潎\",9,\"潙潚潛潝潟潠潡潣潤潥潧\",5,\"潯潰潱潳潵潶潷潹潻潽\",6,\"澅澆澇澊澋澏\",12,\"澝澞澟澠澢\",4,\"澨\",10,\"澴澵澷澸澺\",5,\"濁濃\",5,\"濊\",6,\"濓\",10,\"濟濢濣濤濥\"],\n[\"9e40\",\"濦\",7,\"濰\",32,\"瀒\",7,\"瀜\",6,\"瀤\",6],\n[\"9e80\",\"瀫\",9,\"瀶瀷瀸瀺\",17,\"灍灎灐\",13,\"灟\",11,\"灮灱灲灳灴灷灹灺灻災炁炂炃炄炆炇炈炋炌炍炏炐炑炓炗炘炚炛炞\",12,\"炰炲炴炵炶為炾炿烄烅烆烇烉烋\",12,\"烚\"],\n[\"9f40\",\"烜烝烞烠烡烢烣烥烪烮烰\",6,\"烸烺烻烼烾\",10,\"焋\",4,\"焑焒焔焗焛\",10,\"焧\",7,\"焲焳焴\"],\n[\"9f80\",\"焵焷\",13,\"煆煇煈煉煋煍煏\",12,\"煝煟\",4,\"煥煩\",4,\"煯煰煱煴煵煶煷煹煻煼煾\",5,\"熅\",4,\"熋熌熍熎熐熑熒熓熕熖熗熚\",4,\"熡\",6,\"熩熪熫熭\",5,\"熴熶熷熸熺\",8,\"燄\",9,\"燏\",4],\n[\"a040\",\"燖\",9,\"燡燢燣燤燦燨\",5,\"燯\",9,\"燺\",11,\"爇\",19],\n[\"a080\",\"爛爜爞\",9,\"爩爫爭爮爯爲爳爴爺爼爾牀\",6,\"牉牊牋牎牏牐牑牓牔牕牗牘牚牜牞牠牣牤牥牨牪牫牬牭牰牱牳牴牶牷牸牻牼牽犂犃犅\",4,\"犌犎犐犑犓\",11,\"犠\",11,\"犮犱犲犳犵犺\",6,\"狅狆狇狉狊狋狌狏狑狓狔狕狖狘狚狛\"],\n[\"a1a1\",\"　、。·ˉˇ¨〃々—～‖…‘’“”〔〕〈\",7,\"〖〗【】±×÷∶∧∨∑∏∪∩∈∷√⊥∥∠⌒⊙∫∮≡≌≈∽∝≠≮≯≤≥∞∵∴♂♀°′″℃＄¤￠￡‰§№☆★○●◎◇◆□■△▲※→←↑↓〓\"],\n[\"a2a1\",\"ⅰ\",9],\n[\"a2b1\",\"⒈\",19,\"⑴\",19,\"①\",9],\n[\"a2e5\",\"㈠\",9],\n[\"a2f1\",\"Ⅰ\",11],\n[\"a3a1\",\"！＂＃￥％\",88,\"￣\"],\n[\"a4a1\",\"ぁ\",82],\n[\"a5a1\",\"ァ\",85],\n[\"a6a1\",\"Α\",16,\"Σ\",6],\n[\"a6c1\",\"α\",16,\"σ\",6],\n[\"a6e0\",\"︵︶︹︺︿﹀︽︾﹁﹂﹃﹄\"],\n[\"a6ee\",\"︻︼︷︸︱\"],\n[\"a6f4\",\"︳︴\"],\n[\"a7a1\",\"А\",5,\"ЁЖ\",25],\n[\"a7d1\",\"а\",5,\"ёж\",25],\n[\"a840\",\"ˊˋ˙–―‥‵℅℉↖↗↘↙∕∟∣≒≦≧⊿═\",35,\"▁\",6],\n[\"a880\",\"█\",7,\"▓▔▕▼▽◢◣◤◥☉⊕〒〝〞\"],\n[\"a8a1\",\"āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüêɑ\"],\n[\"a8bd\",\"ńň\"],\n[\"a8c0\",\"ɡ\"],\n[\"a8c5\",\"ㄅ\",36],\n[\"a940\",\"〡\",8,\"㊣㎎㎏㎜㎝㎞㎡㏄㏎㏑㏒㏕︰￢￤\"],\n[\"a959\",\"℡㈱\"],\n[\"a95c\",\"‐\"],\n[\"a960\",\"ー゛゜ヽヾ〆ゝゞ﹉\",9,\"﹔﹕﹖﹗﹙\",8],\n[\"a980\",\"﹢\",4,\"﹨﹩﹪﹫\"],\n[\"a996\",\"〇\"],\n[\"a9a4\",\"─\",75],\n[\"aa40\",\"狜狝狟狢\",5,\"狪狫狵狶狹狽狾狿猀猂猄\",5,\"猋猌猍猏猐猑猒猔猘猙猚猟猠猣猤猦猧猨猭猯猰猲猳猵猶猺猻猼猽獀\",8],\n[\"aa80\",\"獉獊獋獌獎獏獑獓獔獕獖獘\",7,\"獡\",10,\"獮獰獱\"],\n[\"ab40\",\"獲\",11,\"獿\",4,\"玅玆玈玊玌玍玏玐玒玓玔玕玗玘玙玚玜玝玞玠玡玣\",5,\"玪玬玭玱玴玵玶玸玹玼玽玾玿珁珃\",4],\n[\"ab80\",\"珋珌珎珒\",6,\"珚珛珜珝珟珡珢珣珤珦珨珪珫珬珮珯珰珱珳\",4],\n[\"ac40\",\"珸\",10,\"琄琇琈琋琌琍琎琑\",8,\"琜\",5,\"琣琤琧琩琫琭琯琱琲琷\",4,\"琽琾琿瑀瑂\",11],\n[\"ac80\",\"瑎\",6,\"瑖瑘瑝瑠\",12,\"瑮瑯瑱\",4,\"瑸瑹瑺\"],\n[\"ad40\",\"瑻瑼瑽瑿璂璄璅璆璈璉璊璌璍璏璑\",10,\"璝璟\",7,\"璪\",15,\"璻\",12],\n[\"ad80\",\"瓈\",9,\"瓓\",8,\"瓝瓟瓡瓥瓧\",6,\"瓰瓱瓲\"],\n[\"ae40\",\"瓳瓵瓸\",6,\"甀甁甂甃甅\",7,\"甎甐甒甔甕甖甗甛甝甞甠\",4,\"甦甧甪甮甴甶甹甼甽甿畁畂畃畄畆畇畉畊畍畐畑畒畓畕畖畗畘\"],\n[\"ae80\",\"畝\",7,\"畧畨畩畫\",6,\"畳畵當畷畺\",4,\"疀疁疂疄疅疇\"],\n[\"af40\",\"疈疉疊疌疍疎疐疓疕疘疛疜疞疢疦\",4,\"疭疶疷疺疻疿痀痁痆痋痌痎痏痐痑痓痗痙痚痜痝痟痠痡痥痩痬痭痮痯痲痳痵痶痷痸痺痻痽痾瘂瘄瘆瘇\"],\n[\"af80\",\"瘈瘉瘋瘍瘎瘏瘑瘒瘓瘔瘖瘚瘜瘝瘞瘡瘣瘧瘨瘬瘮瘯瘱瘲瘶瘷瘹瘺瘻瘽癁療癄\"],\n[\"b040\",\"癅\",6,\"癎\",5,\"癕癗\",4,\"癝癟癠癡癢癤\",6,\"癬癭癮癰\",7,\"癹発發癿皀皁皃皅皉皊皌皍皏皐皒皔皕皗皘皚皛\"],\n[\"b080\",\"皜\",7,\"皥\",8,\"皯皰皳皵\",9,\"盀盁盃啊阿埃挨哎唉哀皑癌蔼矮艾碍爱隘鞍氨安俺按暗岸胺案肮昂盎凹敖熬翱袄傲奥懊澳芭捌扒叭吧笆八疤巴拔跋靶把耙坝霸罢爸白柏百摆佰败拜稗斑班搬扳般颁板版扮拌伴瓣半办绊邦帮梆榜膀绑棒磅蚌镑傍谤苞胞包褒剥\"],\n[\"b140\",\"盄盇盉盋盌盓盕盙盚盜盝盞盠\",4,\"盦\",7,\"盰盳盵盶盷盺盻盽盿眀眂眃眅眆眊県眎\",10,\"眛眜眝眞眡眣眤眥眧眪眫\"],\n[\"b180\",\"眬眮眰\",4,\"眹眻眽眾眿睂睄睅睆睈\",7,\"睒\",7,\"睜薄雹保堡饱宝抱报暴豹鲍爆杯碑悲卑北辈背贝钡倍狈备惫焙被奔苯本笨崩绷甭泵蹦迸逼鼻比鄙笔彼碧蓖蔽毕毙毖币庇痹闭敝弊必辟壁臂避陛鞭边编贬扁便变卞辨辩辫遍标彪膘表鳖憋别瘪彬斌濒滨宾摈兵冰柄丙秉饼炳\"],\n[\"b240\",\"睝睞睟睠睤睧睩睪睭\",11,\"睺睻睼瞁瞂瞃瞆\",5,\"瞏瞐瞓\",11,\"瞡瞣瞤瞦瞨瞫瞭瞮瞯瞱瞲瞴瞶\",4],\n[\"b280\",\"瞼瞾矀\",12,\"矎\",8,\"矘矙矚矝\",4,\"矤病并玻菠播拨钵波博勃搏铂箔伯帛舶脖膊渤泊驳捕卜哺补埠不布步簿部怖擦猜裁材才财睬踩采彩菜蔡餐参蚕残惭惨灿苍舱仓沧藏操糙槽曹草厕策侧册测层蹭插叉茬茶查碴搽察岔差诧拆柴豺搀掺蝉馋谗缠铲产阐颤昌猖\"],\n[\"b340\",\"矦矨矪矯矰矱矲矴矵矷矹矺矻矼砃\",5,\"砊砋砎砏砐砓砕砙砛砞砠砡砢砤砨砪砫砮砯砱砲砳砵砶砽砿硁硂硃硄硆硈硉硊硋硍硏硑硓硔硘硙硚\"],\n[\"b380\",\"硛硜硞\",11,\"硯\",7,\"硸硹硺硻硽\",6,\"场尝常长偿肠厂敞畅唱倡超抄钞朝嘲潮巢吵炒车扯撤掣彻澈郴臣辰尘晨忱沉陈趁衬撑称城橙成呈乘程惩澄诚承逞骋秤吃痴持匙池迟弛驰耻齿侈尺赤翅斥炽充冲虫崇宠抽酬畴踌稠愁筹仇绸瞅丑臭初出橱厨躇锄雏滁除楚\"],\n[\"b440\",\"碄碅碆碈碊碋碏碐碒碔碕碖碙碝碞碠碢碤碦碨\",7,\"碵碶碷碸確碻碼碽碿磀磂磃磄磆磇磈磌磍磎磏磑磒磓磖磗磘磚\",9],\n[\"b480\",\"磤磥磦磧磩磪磫磭\",4,\"磳磵磶磸磹磻\",5,\"礂礃礄礆\",6,\"础储矗搐触处揣川穿椽传船喘串疮窗幢床闯创吹炊捶锤垂春椿醇唇淳纯蠢戳绰疵茨磁雌辞慈瓷词此刺赐次聪葱囱匆从丛凑粗醋簇促蹿篡窜摧崔催脆瘁粹淬翠村存寸磋撮搓措挫错搭达答瘩打大呆歹傣戴带殆代贷袋待逮\"],\n[\"b540\",\"礍\",5,\"礔\",9,\"礟\",4,\"礥\",14,\"礵\",4,\"礽礿祂祃祄祅祇祊\",8,\"祔祕祘祙祡祣\"],\n[\"b580\",\"祤祦祩祪祫祬祮祰\",6,\"祹祻\",4,\"禂禃禆禇禈禉禋禌禍禎禐禑禒怠耽担丹单郸掸胆旦氮但惮淡诞弹蛋当挡党荡档刀捣蹈倒岛祷导到稻悼道盗德得的蹬灯登等瞪凳邓堤低滴迪敌笛狄涤翟嫡抵底地蒂第帝弟递缔颠掂滇碘点典靛垫电佃甸店惦奠淀殿碉叼雕凋刁掉吊钓调跌爹碟蝶迭谍叠\"],\n[\"b640\",\"禓\",6,\"禛\",11,\"禨\",10,\"禴\",4,\"禼禿秂秄秅秇秈秊秌秎秏秐秓秔秖秗秙\",5,\"秠秡秢秥秨秪\"],\n[\"b680\",\"秬秮秱\",6,\"秹秺秼秾秿稁稄稅稇稈稉稊稌稏\",4,\"稕稖稘稙稛稜丁盯叮钉顶鼎锭定订丢东冬董懂动栋侗恫冻洞兜抖斗陡豆逗痘都督毒犊独读堵睹赌杜镀肚度渡妒端短锻段断缎堆兑队对墩吨蹲敦顿囤钝盾遁掇哆多夺垛躲朵跺舵剁惰堕蛾峨鹅俄额讹娥恶厄扼遏鄂饿恩而儿耳尔饵洱二\"],\n[\"b740\",\"稝稟稡稢稤\",14,\"稴稵稶稸稺稾穀\",5,\"穇\",9,\"穒\",4,\"穘\",16],\n[\"b780\",\"穩\",6,\"穱穲穳穵穻穼穽穾窂窅窇窉窊窋窌窎窏窐窓窔窙窚窛窞窡窢贰发罚筏伐乏阀法珐藩帆番翻樊矾钒繁凡烦反返范贩犯饭泛坊芳方肪房防妨仿访纺放菲非啡飞肥匪诽吠肺废沸费芬酚吩氛分纷坟焚汾粉奋份忿愤粪丰封枫蜂峰锋风疯烽逢冯缝讽奉凤佛否夫敷肤孵扶拂辐幅氟符伏俘服\"],\n[\"b840\",\"窣窤窧窩窪窫窮\",4,\"窴\",10,\"竀\",10,\"竌\",9,\"竗竘竚竛竜竝竡竢竤竧\",5,\"竮竰竱竲竳\"],\n[\"b880\",\"竴\",4,\"竻竼竾笀笁笂笅笇笉笌笍笎笐笒笓笖笗笘笚笜笝笟笡笢笣笧笩笭浮涪福袱弗甫抚辅俯釜斧脯腑府腐赴副覆赋复傅付阜父腹负富讣附妇缚咐噶嘎该改概钙盖溉干甘杆柑竿肝赶感秆敢赣冈刚钢缸肛纲岗港杠篙皋高膏羔糕搞镐稿告哥歌搁戈鸽胳疙割革葛格蛤阁隔铬个各给根跟耕更庚羹\"],\n[\"b940\",\"笯笰笲笴笵笶笷笹笻笽笿\",5,\"筆筈筊筍筎筓筕筗筙筜筞筟筡筣\",10,\"筯筰筳筴筶筸筺筼筽筿箁箂箃箄箆\",6,\"箎箏\"],\n[\"b980\",\"箑箒箓箖箘箙箚箛箞箟箠箣箤箥箮箯箰箲箳箵箶箷箹\",7,\"篂篃範埂耿梗工攻功恭龚供躬公宫弓巩汞拱贡共钩勾沟苟狗垢构购够辜菇咕箍估沽孤姑鼓古蛊骨谷股故顾固雇刮瓜剐寡挂褂乖拐怪棺关官冠观管馆罐惯灌贯光广逛瑰规圭硅归龟闺轨鬼诡癸桂柜跪贵刽辊滚棍锅郭国果裹过哈\"],\n[\"ba40\",\"篅篈築篊篋篍篎篏篐篒篔\",4,\"篛篜篞篟篠篢篣篤篧篨篩篫篬篭篯篰篲\",4,\"篸篹篺篻篽篿\",7,\"簈簉簊簍簎簐\",5,\"簗簘簙\"],\n[\"ba80\",\"簚\",4,\"簠\",5,\"簨簩簫\",12,\"簹\",5,\"籂骸孩海氦亥害骇酣憨邯韩含涵寒函喊罕翰撼捍旱憾悍焊汗汉夯杭航壕嚎豪毫郝好耗号浩呵喝荷菏核禾和何合盒貉阂河涸赫褐鹤贺嘿黑痕很狠恨哼亨横衡恒轰哄烘虹鸿洪宏弘红喉侯猴吼厚候后呼乎忽瑚壶葫胡蝴狐糊湖\"],\n[\"bb40\",\"籃\",9,\"籎\",36,\"籵\",5,\"籾\",9],\n[\"bb80\",\"粈粊\",6,\"粓粔粖粙粚粛粠粡粣粦粧粨粩粫粬粭粯粰粴\",4,\"粺粻弧虎唬护互沪户花哗华猾滑画划化话槐徊怀淮坏欢环桓还缓换患唤痪豢焕涣宦幻荒慌黄磺蝗簧皇凰惶煌晃幌恍谎灰挥辉徽恢蛔回毁悔慧卉惠晦贿秽会烩汇讳诲绘荤昏婚魂浑混豁活伙火获或惑霍货祸击圾基机畸稽积箕\"],\n[\"bc40\",\"粿糀糂糃糄糆糉糋糎\",6,\"糘糚糛糝糞糡\",6,\"糩\",5,\"糰\",7,\"糹糺糼\",13,\"紋\",5],\n[\"bc80\",\"紑\",14,\"紡紣紤紥紦紨紩紪紬紭紮細\",6,\"肌饥迹激讥鸡姬绩缉吉极棘辑籍集及急疾汲即嫉级挤几脊己蓟技冀季伎祭剂悸济寄寂计记既忌际妓继纪嘉枷夹佳家加荚颊贾甲钾假稼价架驾嫁歼监坚尖笺间煎兼肩艰奸缄茧检柬碱硷拣捡简俭剪减荐槛鉴践贱见键箭件\"],\n[\"bd40\",\"紷\",54,\"絯\",7],\n[\"bd80\",\"絸\",32,\"健舰剑饯渐溅涧建僵姜将浆江疆蒋桨奖讲匠酱降蕉椒礁焦胶交郊浇骄娇嚼搅铰矫侥脚狡角饺缴绞剿教酵轿较叫窖揭接皆秸街阶截劫节桔杰捷睫竭洁结解姐戒藉芥界借介疥诫届巾筋斤金今津襟紧锦仅谨进靳晋禁近烬浸\"],\n[\"be40\",\"継\",12,\"綧\",6,\"綯\",42],\n[\"be80\",\"線\",32,\"尽劲荆兢茎睛晶鲸京惊精粳经井警景颈静境敬镜径痉靖竟竞净炯窘揪究纠玖韭久灸九酒厩救旧臼舅咎就疚鞠拘狙疽居驹菊局咀矩举沮聚拒据巨具距踞锯俱句惧炬剧捐鹃娟倦眷卷绢撅攫抉掘倔爵觉决诀绝均菌钧军君峻\"],\n[\"bf40\",\"緻\",62],\n[\"bf80\",\"縺縼\",4,\"繂\",4,\"繈\",21,\"俊竣浚郡骏喀咖卡咯开揩楷凯慨刊堪勘坎砍看康慷糠扛抗亢炕考拷烤靠坷苛柯棵磕颗科壳咳可渴克刻客课肯啃垦恳坑吭空恐孔控抠口扣寇枯哭窟苦酷库裤夸垮挎跨胯块筷侩快宽款匡筐狂框矿眶旷况亏盔岿窥葵奎魁傀\"],\n[\"c040\",\"繞\",35,\"纃\",23,\"纜纝纞\"],\n[\"c080\",\"纮纴纻纼绖绤绬绹缊缐缞缷缹缻\",6,\"罃罆\",9,\"罒罓馈愧溃坤昆捆困括扩廓阔垃拉喇蜡腊辣啦莱来赖蓝婪栏拦篮阑兰澜谰揽览懒缆烂滥琅榔狼廊郎朗浪捞劳牢老佬姥酪烙涝勒乐雷镭蕾磊累儡垒擂肋类泪棱楞冷厘梨犁黎篱狸离漓理李里鲤礼莉荔吏栗丽厉励砾历利傈例俐\"],\n[\"c140\",\"罖罙罛罜罝罞罠罣\",4,\"罫罬罭罯罰罳罵罶罷罸罺罻罼罽罿羀羂\",7,\"羋羍羏\",4,\"羕\",4,\"羛羜羠羢羣羥羦羨\",6,\"羱\"],\n[\"c180\",\"羳\",4,\"羺羻羾翀翂翃翄翆翇翈翉翋翍翏\",4,\"翖翗翙\",5,\"翢翣痢立粒沥隶力璃哩俩联莲连镰廉怜涟帘敛脸链恋炼练粮凉梁粱良两辆量晾亮谅撩聊僚疗燎寥辽潦了撂镣廖料列裂烈劣猎琳林磷霖临邻鳞淋凛赁吝拎玲菱零龄铃伶羚凌灵陵岭领另令溜琉榴硫馏留刘瘤流柳六龙聋咙笼窿\"],\n[\"c240\",\"翤翧翨翪翫翬翭翯翲翴\",6,\"翽翾翿耂耇耈耉耊耎耏耑耓耚耛耝耞耟耡耣耤耫\",5,\"耲耴耹耺耼耾聀聁聄聅聇聈聉聎聏聐聑聓聕聖聗\"],\n[\"c280\",\"聙聛\",13,\"聫\",5,\"聲\",11,\"隆垄拢陇楼娄搂篓漏陋芦卢颅庐炉掳卤虏鲁麓碌露路赂鹿潞禄录陆戮驴吕铝侣旅履屡缕虑氯律率滤绿峦挛孪滦卵乱掠略抡轮伦仑沦纶论萝螺罗逻锣箩骡裸落洛骆络妈麻玛码蚂马骂嘛吗埋买麦卖迈脉瞒馒蛮满蔓曼慢漫\"],\n[\"c340\",\"聾肁肂肅肈肊肍\",5,\"肔肕肗肙肞肣肦肧肨肬肰肳肵肶肸肹肻胅胇\",4,\"胏\",6,\"胘胟胠胢胣胦胮胵胷胹胻胾胿脀脁脃脄脅脇脈脋\"],\n[\"c380\",\"脌脕脗脙脛脜脝脟\",12,\"脭脮脰脳脴脵脷脹\",4,\"脿谩芒茫盲氓忙莽猫茅锚毛矛铆卯茂冒帽貌贸么玫枚梅酶霉煤没眉媒镁每美昧寐妹媚门闷们萌蒙檬盟锰猛梦孟眯醚靡糜迷谜弥米秘觅泌蜜密幂棉眠绵冕免勉娩缅面苗描瞄藐秒渺庙妙蔑灭民抿皿敏悯闽明螟鸣铭名命谬摸\"],\n[\"c440\",\"腀\",5,\"腇腉腍腎腏腒腖腗腘腛\",4,\"腡腢腣腤腦腨腪腫腬腯腲腳腵腶腷腸膁膃\",4,\"膉膋膌膍膎膐膒\",5,\"膙膚膞\",4,\"膤膥\"],\n[\"c480\",\"膧膩膫\",7,\"膴\",5,\"膼膽膾膿臄臅臇臈臉臋臍\",6,\"摹蘑模膜磨摩魔抹末莫墨默沫漠寞陌谋牟某拇牡亩姆母墓暮幕募慕木目睦牧穆拿哪呐钠那娜纳氖乃奶耐奈南男难囊挠脑恼闹淖呢馁内嫩能妮霓倪泥尼拟你匿腻逆溺蔫拈年碾撵捻念娘酿鸟尿捏聂孽啮镊镍涅您柠狞凝宁\"],\n[\"c540\",\"臔\",14,\"臤臥臦臨臩臫臮\",4,\"臵\",5,\"臽臿舃與\",4,\"舎舏舑舓舕\",5,\"舝舠舤舥舦舧舩舮舲舺舼舽舿\"],\n[\"c580\",\"艀艁艂艃艅艆艈艊艌艍艎艐\",7,\"艙艛艜艝艞艠\",7,\"艩拧泞牛扭钮纽脓浓农弄奴努怒女暖虐疟挪懦糯诺哦欧鸥殴藕呕偶沤啪趴爬帕怕琶拍排牌徘湃派攀潘盘磐盼畔判叛乓庞旁耪胖抛咆刨炮袍跑泡呸胚培裴赔陪配佩沛喷盆砰抨烹澎彭蓬棚硼篷膨朋鹏捧碰坯砒霹批披劈琵毗\"],\n[\"c640\",\"艪艫艬艭艱艵艶艷艸艻艼芀芁芃芅芆芇芉芌芐芓芔芕芖芚芛芞芠芢芣芧芲芵芶芺芻芼芿苀苂苃苅苆苉苐苖苙苚苝苢苧苨苩苪苬苭苮苰苲苳苵苶苸\"],\n[\"c680\",\"苺苼\",4,\"茊茋茍茐茒茓茖茘茙茝\",9,\"茩茪茮茰茲茷茻茽啤脾疲皮匹痞僻屁譬篇偏片骗飘漂瓢票撇瞥拼频贫品聘乒坪苹萍平凭瓶评屏坡泼颇婆破魄迫粕剖扑铺仆莆葡菩蒲埔朴圃普浦谱曝瀑期欺栖戚妻七凄漆柒沏其棋奇歧畦崎脐齐旗祈祁骑起岂乞企启契砌器气迄弃汽泣讫掐\"],\n[\"c740\",\"茾茿荁荂荄荅荈荊\",4,\"荓荕\",4,\"荝荢荰\",6,\"荹荺荾\",6,\"莇莈莊莋莌莍莏莐莑莔莕莖莗莙莚莝莟莡\",6,\"莬莭莮\"],\n[\"c780\",\"莯莵莻莾莿菂菃菄菆菈菉菋菍菎菐菑菒菓菕菗菙菚菛菞菢菣菤菦菧菨菫菬菭恰洽牵扦钎铅千迁签仟谦乾黔钱钳前潜遣浅谴堑嵌欠歉枪呛腔羌墙蔷强抢橇锹敲悄桥瞧乔侨巧鞘撬翘峭俏窍切茄且怯窃钦侵亲秦琴勤芹擒禽寝沁青轻氢倾卿清擎晴氰情顷请庆琼穷秋丘邱球求囚酋泅趋区蛆曲躯屈驱渠\"],\n[\"c840\",\"菮華菳\",4,\"菺菻菼菾菿萀萂萅萇萈萉萊萐萒\",5,\"萙萚萛萞\",5,\"萩\",7,\"萲\",5,\"萹萺萻萾\",7,\"葇葈葉\"],\n[\"c880\",\"葊\",6,\"葒\",4,\"葘葝葞葟葠葢葤\",4,\"葪葮葯葰葲葴葷葹葻葼取娶龋趣去圈颧权醛泉全痊拳犬券劝缺炔瘸却鹊榷确雀裙群然燃冉染瓤壤攘嚷让饶扰绕惹热壬仁人忍韧任认刃妊纫扔仍日戎茸蓉荣融熔溶容绒冗揉柔肉茹蠕儒孺如辱乳汝入褥软阮蕊瑞锐闰润若弱撒洒萨腮鳃塞赛三叁\"],\n[\"c940\",\"葽\",4,\"蒃蒄蒅蒆蒊蒍蒏\",7,\"蒘蒚蒛蒝蒞蒟蒠蒢\",12,\"蒰蒱蒳蒵蒶蒷蒻蒼蒾蓀蓂蓃蓅蓆蓇蓈蓋蓌蓎蓏蓒蓔蓕蓗\"],\n[\"c980\",\"蓘\",4,\"蓞蓡蓢蓤蓧\",4,\"蓭蓮蓯蓱\",10,\"蓽蓾蔀蔁蔂伞散桑嗓丧搔骚扫嫂瑟色涩森僧莎砂杀刹沙纱傻啥煞筛晒珊苫杉山删煽衫闪陕擅赡膳善汕扇缮墒伤商赏晌上尚裳梢捎稍烧芍勺韶少哨邵绍奢赊蛇舌舍赦摄射慑涉社设砷申呻伸身深娠绅神沈审婶甚肾慎渗声生甥牲升绳\"],\n[\"ca40\",\"蔃\",8,\"蔍蔎蔏蔐蔒蔔蔕蔖蔘蔙蔛蔜蔝蔞蔠蔢\",8,\"蔭\",9,\"蔾\",4,\"蕄蕅蕆蕇蕋\",10],\n[\"ca80\",\"蕗蕘蕚蕛蕜蕝蕟\",4,\"蕥蕦蕧蕩\",8,\"蕳蕵蕶蕷蕸蕼蕽蕿薀薁省盛剩胜圣师失狮施湿诗尸虱十石拾时什食蚀实识史矢使屎驶始式示士世柿事拭誓逝势是嗜噬适仕侍释饰氏市恃室视试收手首守寿授售受瘦兽蔬枢梳殊抒输叔舒淑疏书赎孰熟薯暑曙署蜀黍鼠属术述树束戍竖墅庶数漱\"],\n[\"cb40\",\"薂薃薆薈\",6,\"薐\",10,\"薝\",6,\"薥薦薧薩薫薬薭薱\",5,\"薸薺\",6,\"藂\",6,\"藊\",4,\"藑藒\"],\n[\"cb80\",\"藔藖\",5,\"藝\",6,\"藥藦藧藨藪\",14,\"恕刷耍摔衰甩帅栓拴霜双爽谁水睡税吮瞬顺舜说硕朔烁斯撕嘶思私司丝死肆寺嗣四伺似饲巳松耸怂颂送宋讼诵搜艘擞嗽苏酥俗素速粟僳塑溯宿诉肃酸蒜算虽隋随绥髓碎岁穗遂隧祟孙损笋蓑梭唆缩琐索锁所塌他它她塔\"],\n[\"cc40\",\"藹藺藼藽藾蘀\",4,\"蘆\",10,\"蘒蘓蘔蘕蘗\",15,\"蘨蘪\",13,\"蘹蘺蘻蘽蘾蘿虀\"],\n[\"cc80\",\"虁\",11,\"虒虓處\",4,\"虛虜虝號虠虡虣\",7,\"獭挞蹋踏胎苔抬台泰酞太态汰坍摊贪瘫滩坛檀痰潭谭谈坦毯袒碳探叹炭汤塘搪堂棠膛唐糖倘躺淌趟烫掏涛滔绦萄桃逃淘陶讨套特藤腾疼誊梯剔踢锑提题蹄啼体替嚏惕涕剃屉天添填田甜恬舔腆挑条迢眺跳贴铁帖厅听烃\"],\n[\"cd40\",\"虭虯虰虲\",6,\"蚃\",6,\"蚎\",4,\"蚔蚖\",5,\"蚞\",4,\"蚥蚦蚫蚭蚮蚲蚳蚷蚸蚹蚻\",4,\"蛁蛂蛃蛅蛈蛌蛍蛒蛓蛕蛖蛗蛚蛜\"],\n[\"cd80\",\"蛝蛠蛡蛢蛣蛥蛦蛧蛨蛪蛫蛬蛯蛵蛶蛷蛺蛻蛼蛽蛿蜁蜄蜅蜆蜋蜌蜎蜏蜐蜑蜔蜖汀廷停亭庭挺艇通桐酮瞳同铜彤童桶捅筒统痛偷投头透凸秃突图徒途涂屠土吐兔湍团推颓腿蜕褪退吞屯臀拖托脱鸵陀驮驼椭妥拓唾挖哇蛙洼娃瓦袜歪外豌弯湾玩顽丸烷完碗挽晚皖惋宛婉万腕汪王亡枉网往旺望忘妄威\"],\n[\"ce40\",\"蜙蜛蜝蜟蜠蜤蜦蜧蜨蜪蜫蜬蜭蜯蜰蜲蜳蜵蜶蜸蜹蜺蜼蜽蝀\",6,\"蝊蝋蝍蝏蝐蝑蝒蝔蝕蝖蝘蝚\",5,\"蝡蝢蝦\",7,\"蝯蝱蝲蝳蝵\"],\n[\"ce80\",\"蝷蝸蝹蝺蝿螀螁螄螆螇螉螊螌螎\",4,\"螔螕螖螘\",6,\"螠\",4,\"巍微危韦违桅围唯惟为潍维苇萎委伟伪尾纬未蔚味畏胃喂魏位渭谓尉慰卫瘟温蚊文闻纹吻稳紊问嗡翁瓮挝蜗涡窝我斡卧握沃巫呜钨乌污诬屋无芜梧吾吴毋武五捂午舞伍侮坞戊雾晤物勿务悟误昔熙析西硒矽晰嘻吸锡牺\"],\n[\"cf40\",\"螥螦螧螩螪螮螰螱螲螴螶螷螸螹螻螼螾螿蟁\",4,\"蟇蟈蟉蟌\",4,\"蟔\",6,\"蟜蟝蟞蟟蟡蟢蟣蟤蟦蟧蟨蟩蟫蟬蟭蟯\",9],\n[\"cf80\",\"蟺蟻蟼蟽蟿蠀蠁蠂蠄\",5,\"蠋\",7,\"蠔蠗蠘蠙蠚蠜\",4,\"蠣稀息希悉膝夕惜熄烯溪汐犀檄袭席习媳喜铣洗系隙戏细瞎虾匣霞辖暇峡侠狭下厦夏吓掀锨先仙鲜纤咸贤衔舷闲涎弦嫌显险现献县腺馅羡宪陷限线相厢镶香箱襄湘乡翔祥详想响享项巷橡像向象萧硝霄削哮嚣销消宵淆晓\"],\n[\"d040\",\"蠤\",13,\"蠳\",5,\"蠺蠻蠽蠾蠿衁衂衃衆\",5,\"衎\",5,\"衕衖衘衚\",6,\"衦衧衪衭衯衱衳衴衵衶衸衹衺\"],\n[\"d080\",\"衻衼袀袃袆袇袉袊袌袎袏袐袑袓袔袕袗\",4,\"袝\",4,\"袣袥\",5,\"小孝校肖啸笑效楔些歇蝎鞋协挟携邪斜胁谐写械卸蟹懈泄泻谢屑薪芯锌欣辛新忻心信衅星腥猩惺兴刑型形邢行醒幸杏性姓兄凶胸匈汹雄熊休修羞朽嗅锈秀袖绣墟戌需虚嘘须徐许蓄酗叙旭序畜恤絮婿绪续轩喧宣悬旋玄\"],\n[\"d140\",\"袬袮袯袰袲\",4,\"袸袹袺袻袽袾袿裀裃裄裇裈裊裋裌裍裏裐裑裓裖裗裚\",4,\"裠裡裦裧裩\",6,\"裲裵裶裷裺裻製裿褀褁褃\",5],\n[\"d180\",\"褉褋\",4,\"褑褔\",4,\"褜\",4,\"褢褣褤褦褧褨褩褬褭褮褯褱褲褳褵褷选癣眩绚靴薛学穴雪血勋熏循旬询寻驯巡殉汛训讯逊迅压押鸦鸭呀丫芽牙蚜崖衙涯雅哑亚讶焉咽阉烟淹盐严研蜒岩延言颜阎炎沿奄掩眼衍演艳堰燕厌砚雁唁彦焰宴谚验殃央鸯秧杨扬佯疡羊洋阳氧仰痒养样漾邀腰妖瑶\"],\n[\"d240\",\"褸\",8,\"襂襃襅\",24,\"襠\",5,\"襧\",19,\"襼\"],\n[\"d280\",\"襽襾覀覂覄覅覇\",26,\"摇尧遥窑谣姚咬舀药要耀椰噎耶爷野冶也页掖业叶曳腋夜液一壹医揖铱依伊衣颐夷遗移仪胰疑沂宜姨彝椅蚁倚已乙矣以艺抑易邑屹亿役臆逸肄疫亦裔意毅忆义益溢诣议谊译异翼翌绎茵荫因殷音阴姻吟银淫寅饮尹引隐\"],\n[\"d340\",\"覢\",30,\"觃觍觓觔觕觗觘觙觛觝觟觠觡觢觤觧觨觩觪觬觭觮觰觱觲觴\",6],\n[\"d380\",\"觻\",4,\"訁\",5,\"計\",21,\"印英樱婴鹰应缨莹萤营荧蝇迎赢盈影颖硬映哟拥佣臃痈庸雍踊蛹咏泳涌永恿勇用幽优悠忧尤由邮铀犹油游酉有友右佑釉诱又幼迂淤于盂榆虞愚舆余俞逾鱼愉渝渔隅予娱雨与屿禹宇语羽玉域芋郁吁遇喻峪御愈欲狱育誉\"],\n[\"d440\",\"訞\",31,\"訿\",8,\"詉\",21],\n[\"d480\",\"詟\",25,\"詺\",6,\"浴寓裕预豫驭鸳渊冤元垣袁原援辕园员圆猿源缘远苑愿怨院曰约越跃钥岳粤月悦阅耘云郧匀陨允运蕴酝晕韵孕匝砸杂栽哉灾宰载再在咱攒暂赞赃脏葬遭糟凿藻枣早澡蚤躁噪造皂灶燥责择则泽贼怎增憎曾赠扎喳渣札轧\"],\n[\"d540\",\"誁\",7,\"誋\",7,\"誔\",46],\n[\"d580\",\"諃\",32,\"铡闸眨栅榨咋乍炸诈摘斋宅窄债寨瞻毡詹粘沾盏斩辗崭展蘸栈占战站湛绽樟章彰漳张掌涨杖丈帐账仗胀瘴障招昭找沼赵照罩兆肇召遮折哲蛰辙者锗蔗这浙珍斟真甄砧臻贞针侦枕疹诊震振镇阵蒸挣睁征狰争怔整拯正政\"],\n[\"d640\",\"諤\",34,\"謈\",27],\n[\"d680\",\"謤謥謧\",30,\"帧症郑证芝枝支吱蜘知肢脂汁之织职直植殖执值侄址指止趾只旨纸志挚掷至致置帜峙制智秩稚质炙痔滞治窒中盅忠钟衷终种肿重仲众舟周州洲诌粥轴肘帚咒皱宙昼骤珠株蛛朱猪诸诛逐竹烛煮拄瞩嘱主著柱助蛀贮铸筑\"],\n[\"d740\",\"譆\",31,\"譧\",4,\"譭\",25],\n[\"d780\",\"讇\",24,\"讬讱讻诇诐诪谉谞住注祝驻抓爪拽专砖转撰赚篆桩庄装妆撞壮状椎锥追赘坠缀谆准捉拙卓桌琢茁酌啄着灼浊兹咨资姿滋淄孜紫仔籽滓子自渍字鬃棕踪宗综总纵邹走奏揍租足卒族祖诅阻组钻纂嘴醉最罪尊遵昨左佐柞做作坐座\"],\n[\"d840\",\"谸\",8,\"豂豃豄豅豈豊豋豍\",7,\"豖豗豘豙豛\",5,\"豣\",6,\"豬\",6,\"豴豵豶豷豻\",6,\"貃貄貆貇\"],\n[\"d880\",\"貈貋貍\",6,\"貕貖貗貙\",20,\"亍丌兀丐廿卅丕亘丞鬲孬噩丨禺丿匕乇夭爻卮氐囟胤馗毓睾鼗丶亟鼐乜乩亓芈孛啬嘏仄厍厝厣厥厮靥赝匚叵匦匮匾赜卦卣刂刈刎刭刳刿剀剌剞剡剜蒯剽劂劁劐劓冂罔亻仃仉仂仨仡仫仞伛仳伢佤仵伥伧伉伫佞佧攸佚佝\"],\n[\"d940\",\"貮\",62],\n[\"d980\",\"賭\",32,\"佟佗伲伽佶佴侑侉侃侏佾佻侪佼侬侔俦俨俪俅俚俣俜俑俟俸倩偌俳倬倏倮倭俾倜倌倥倨偾偃偕偈偎偬偻傥傧傩傺僖儆僭僬僦僮儇儋仝氽佘佥俎龠汆籴兮巽黉馘冁夔勹匍訇匐凫夙兕亠兖亳衮袤亵脔裒禀嬴蠃羸冫冱冽冼\"],\n[\"da40\",\"贎\",14,\"贠赑赒赗赟赥赨赩赪赬赮赯赱赲赸\",8,\"趂趃趆趇趈趉趌\",4,\"趒趓趕\",9,\"趠趡\"],\n[\"da80\",\"趢趤\",12,\"趲趶趷趹趻趽跀跁跂跅跇跈跉跊跍跐跒跓跔凇冖冢冥讠讦讧讪讴讵讷诂诃诋诏诎诒诓诔诖诘诙诜诟诠诤诨诩诮诰诳诶诹诼诿谀谂谄谇谌谏谑谒谔谕谖谙谛谘谝谟谠谡谥谧谪谫谮谯谲谳谵谶卩卺阝阢阡阱阪阽阼陂陉陔陟陧陬陲陴隈隍隗隰邗邛邝邙邬邡邴邳邶邺\"],\n[\"db40\",\"跕跘跙跜跠跡跢跥跦跧跩跭跮跰跱跲跴跶跼跾\",6,\"踆踇踈踋踍踎踐踑踒踓踕\",7,\"踠踡踤\",4,\"踫踭踰踲踳踴踶踷踸踻踼踾\"],\n[\"db80\",\"踿蹃蹅蹆蹌\",4,\"蹓\",5,\"蹚\",11,\"蹧蹨蹪蹫蹮蹱邸邰郏郅邾郐郄郇郓郦郢郜郗郛郫郯郾鄄鄢鄞鄣鄱鄯鄹酃酆刍奂劢劬劭劾哿勐勖勰叟燮矍廴凵凼鬯厶弁畚巯坌垩垡塾墼壅壑圩圬圪圳圹圮圯坜圻坂坩垅坫垆坼坻坨坭坶坳垭垤垌垲埏垧垴垓垠埕埘埚埙埒垸埴埯埸埤埝\"],\n[\"dc40\",\"蹳蹵蹷\",4,\"蹽蹾躀躂躃躄躆躈\",6,\"躑躒躓躕\",6,\"躝躟\",11,\"躭躮躰躱躳\",6,\"躻\",7],\n[\"dc80\",\"軃\",10,\"軏\",21,\"堋堍埽埭堀堞堙塄堠塥塬墁墉墚墀馨鼙懿艹艽艿芏芊芨芄芎芑芗芙芫芸芾芰苈苊苣芘芷芮苋苌苁芩芴芡芪芟苄苎芤苡茉苷苤茏茇苜苴苒苘茌苻苓茑茚茆茔茕苠苕茜荑荛荜茈莒茼茴茱莛荞茯荏荇荃荟荀茗荠茭茺茳荦荥\"],\n[\"dd40\",\"軥\",62],\n[\"dd80\",\"輤\",32,\"荨茛荩荬荪荭荮莰荸莳莴莠莪莓莜莅荼莶莩荽莸荻莘莞莨莺莼菁萁菥菘堇萘萋菝菽菖萜萸萑萆菔菟萏萃菸菹菪菅菀萦菰菡葜葑葚葙葳蒇蒈葺蒉葸萼葆葩葶蒌蒎萱葭蓁蓍蓐蓦蒽蓓蓊蒿蒺蓠蒡蒹蒴蒗蓥蓣蔌甍蔸蓰蔹蔟蔺\"],\n[\"de40\",\"轅\",32,\"轪辀辌辒辝辠辡辢辤辥辦辧辪辬辭辮辯農辳辴辵辷辸辺辻込辿迀迃迆\"],\n[\"de80\",\"迉\",4,\"迏迒迖迗迚迠迡迣迧迬迯迱迲迴迵迶迺迻迼迾迿逇逈逌逎逓逕逘蕖蔻蓿蓼蕙蕈蕨蕤蕞蕺瞢蕃蕲蕻薤薨薇薏蕹薮薜薅薹薷薰藓藁藜藿蘧蘅蘩蘖蘼廾弈夼奁耷奕奚奘匏尢尥尬尴扌扪抟抻拊拚拗拮挢拶挹捋捃掭揶捱捺掎掴捭掬掊捩掮掼揲揸揠揿揄揞揎摒揆掾摅摁搋搛搠搌搦搡摞撄摭撖\"],\n[\"df40\",\"這逜連逤逥逧\",5,\"逰\",4,\"逷逹逺逽逿遀遃遅遆遈\",4,\"過達違遖遙遚遜\",5,\"遤遦遧適遪遫遬遯\",4,\"遶\",6,\"遾邁\"],\n[\"df80\",\"還邅邆邇邉邊邌\",4,\"邒邔邖邘邚邜邞邟邠邤邥邧邨邩邫邭邲邷邼邽邿郀摺撷撸撙撺擀擐擗擤擢攉攥攮弋忒甙弑卟叱叽叩叨叻吒吖吆呋呒呓呔呖呃吡呗呙吣吲咂咔呷呱呤咚咛咄呶呦咝哐咭哂咴哒咧咦哓哔呲咣哕咻咿哌哙哚哜咩咪咤哝哏哞唛哧唠哽唔哳唢唣唏唑唧唪啧喏喵啉啭啁啕唿啐唼\"],\n[\"e040\",\"郂郃郆郈郉郋郌郍郒郔郕郖郘郙郚郞郟郠郣郤郥郩郪郬郮郰郱郲郳郵郶郷郹郺郻郼郿鄀鄁鄃鄅\",19,\"鄚鄛鄜\"],\n[\"e080\",\"鄝鄟鄠鄡鄤\",10,\"鄰鄲\",6,\"鄺\",8,\"酄唷啖啵啶啷唳唰啜喋嗒喃喱喹喈喁喟啾嗖喑啻嗟喽喾喔喙嗪嗷嗉嘟嗑嗫嗬嗔嗦嗝嗄嗯嗥嗲嗳嗌嗍嗨嗵嗤辔嘞嘈嘌嘁嘤嘣嗾嘀嘧嘭噘嘹噗嘬噍噢噙噜噌噔嚆噤噱噫噻噼嚅嚓嚯囔囗囝囡囵囫囹囿圄圊圉圜帏帙帔帑帱帻帼\"],\n[\"e140\",\"酅酇酈酑酓酔酕酖酘酙酛酜酟酠酦酧酨酫酭酳酺酻酼醀\",4,\"醆醈醊醎醏醓\",6,\"醜\",5,\"醤\",5,\"醫醬醰醱醲醳醶醷醸醹醻\"],\n[\"e180\",\"醼\",10,\"釈釋釐釒\",9,\"針\",8,\"帷幄幔幛幞幡岌屺岍岐岖岈岘岙岑岚岜岵岢岽岬岫岱岣峁岷峄峒峤峋峥崂崃崧崦崮崤崞崆崛嵘崾崴崽嵬嵛嵯嵝嵫嵋嵊嵩嵴嶂嶙嶝豳嶷巅彳彷徂徇徉後徕徙徜徨徭徵徼衢彡犭犰犴犷犸狃狁狎狍狒狨狯狩狲狴狷猁狳猃狺\"],\n[\"e240\",\"釦\",62],\n[\"e280\",\"鈥\",32,\"狻猗猓猡猊猞猝猕猢猹猥猬猸猱獐獍獗獠獬獯獾舛夥飧夤夂饣饧\",5,\"饴饷饽馀馄馇馊馍馐馑馓馔馕庀庑庋庖庥庠庹庵庾庳赓廒廑廛廨廪膺忄忉忖忏怃忮怄忡忤忾怅怆忪忭忸怙怵怦怛怏怍怩怫怊怿怡恸恹恻恺恂\"],\n[\"e340\",\"鉆\",45,\"鉵\",16],\n[\"e380\",\"銆\",7,\"銏\",24,\"恪恽悖悚悭悝悃悒悌悛惬悻悱惝惘惆惚悴愠愦愕愣惴愀愎愫慊慵憬憔憧憷懔懵忝隳闩闫闱闳闵闶闼闾阃阄阆阈阊阋阌阍阏阒阕阖阗阙阚丬爿戕氵汔汜汊沣沅沐沔沌汨汩汴汶沆沩泐泔沭泷泸泱泗沲泠泖泺泫泮沱泓泯泾\"],\n[\"e440\",\"銨\",5,\"銯\",24,\"鋉\",31],\n[\"e480\",\"鋩\",32,\"洹洧洌浃浈洇洄洙洎洫浍洮洵洚浏浒浔洳涑浯涞涠浞涓涔浜浠浼浣渚淇淅淞渎涿淠渑淦淝淙渖涫渌涮渫湮湎湫溲湟溆湓湔渲渥湄滟溱溘滠漭滢溥溧溽溻溷滗溴滏溏滂溟潢潆潇漤漕滹漯漶潋潴漪漉漩澉澍澌潸潲潼潺濑\"],\n[\"e540\",\"錊\",51,\"錿\",10],\n[\"e580\",\"鍊\",31,\"鍫濉澧澹澶濂濡濮濞濠濯瀚瀣瀛瀹瀵灏灞宀宄宕宓宥宸甯骞搴寤寮褰寰蹇謇辶迓迕迥迮迤迩迦迳迨逅逄逋逦逑逍逖逡逵逶逭逯遄遑遒遐遨遘遢遛暹遴遽邂邈邃邋彐彗彖彘尻咫屐屙孱屣屦羼弪弩弭艴弼鬻屮妁妃妍妩妪妣\"],\n[\"e640\",\"鍬\",34,\"鎐\",27],\n[\"e680\",\"鎬\",29,\"鏋鏌鏍妗姊妫妞妤姒妲妯姗妾娅娆姝娈姣姘姹娌娉娲娴娑娣娓婀婧婊婕娼婢婵胬媪媛婷婺媾嫫媲嫒嫔媸嫠嫣嫱嫖嫦嫘嫜嬉嬗嬖嬲嬷孀尕尜孚孥孳孑孓孢驵驷驸驺驿驽骀骁骅骈骊骐骒骓骖骘骛骜骝骟骠骢骣骥骧纟纡纣纥纨纩\"],\n[\"e740\",\"鏎\",7,\"鏗\",54],\n[\"e780\",\"鐎\",32,\"纭纰纾绀绁绂绉绋绌绐绔绗绛绠绡绨绫绮绯绱绲缍绶绺绻绾缁缂缃缇缈缋缌缏缑缒缗缙缜缛缟缡\",6,\"缪缫缬缭缯\",4,\"缵幺畿巛甾邕玎玑玮玢玟珏珂珑玷玳珀珉珈珥珙顼琊珩珧珞玺珲琏琪瑛琦琥琨琰琮琬\"],\n[\"e840\",\"鐯\",14,\"鐿\",43,\"鑬鑭鑮鑯\"],\n[\"e880\",\"鑰\",20,\"钑钖钘铇铏铓铔铚铦铻锜锠琛琚瑁瑜瑗瑕瑙瑷瑭瑾璜璎璀璁璇璋璞璨璩璐璧瓒璺韪韫韬杌杓杞杈杩枥枇杪杳枘枧杵枨枞枭枋杷杼柰栉柘栊柩枰栌柙枵柚枳柝栀柃枸柢栎柁柽栲栳桠桡桎桢桄桤梃栝桕桦桁桧桀栾桊桉栩梵梏桴桷梓桫棂楮棼椟椠棹\"],\n[\"e940\",\"锧锳锽镃镈镋镕镚镠镮镴镵長\",7,\"門\",42],\n[\"e980\",\"閫\",32,\"椤棰椋椁楗棣椐楱椹楠楂楝榄楫榀榘楸椴槌榇榈槎榉楦楣楹榛榧榻榫榭槔榱槁槊槟榕槠榍槿樯槭樗樘橥槲橄樾檠橐橛樵檎橹樽樨橘橼檑檐檩檗檫猷獒殁殂殇殄殒殓殍殚殛殡殪轫轭轱轲轳轵轶轸轷轹轺轼轾辁辂辄辇辋\"],\n[\"ea40\",\"闌\",27,\"闬闿阇阓阘阛阞阠阣\",6,\"阫阬阭阯阰阷阸阹阺阾陁陃陊陎陏陑陒陓陖陗\"],\n[\"ea80\",\"陘陙陚陜陝陞陠陣陥陦陫陭\",4,\"陳陸\",12,\"隇隉隊辍辎辏辘辚軎戋戗戛戟戢戡戥戤戬臧瓯瓴瓿甏甑甓攴旮旯旰昊昙杲昃昕昀炅曷昝昴昱昶昵耆晟晔晁晏晖晡晗晷暄暌暧暝暾曛曜曦曩贲贳贶贻贽赀赅赆赈赉赇赍赕赙觇觊觋觌觎觏觐觑牮犟牝牦牯牾牿犄犋犍犏犒挈挲掰\"],\n[\"eb40\",\"隌階隑隒隓隕隖隚際隝\",9,\"隨\",7,\"隱隲隴隵隷隸隺隻隿雂雃雈雊雋雐雑雓雔雖\",9,\"雡\",6,\"雫\"],\n[\"eb80\",\"雬雭雮雰雱雲雴雵雸雺電雼雽雿霂霃霅霊霋霌霐霑霒霔霕霗\",4,\"霝霟霠搿擘耄毪毳毽毵毹氅氇氆氍氕氘氙氚氡氩氤氪氲攵敕敫牍牒牖爰虢刖肟肜肓肼朊肽肱肫肭肴肷胧胨胩胪胛胂胄胙胍胗朐胝胫胱胴胭脍脎胲胼朕脒豚脶脞脬脘脲腈腌腓腴腙腚腱腠腩腼腽腭腧塍媵膈膂膑滕膣膪臌朦臊膻\"],\n[\"ec40\",\"霡\",8,\"霫霬霮霯霱霳\",4,\"霺霻霼霽霿\",18,\"靔靕靗靘靚靜靝靟靣靤靦靧靨靪\",7],\n[\"ec80\",\"靲靵靷\",4,\"靽\",7,\"鞆\",4,\"鞌鞎鞏鞐鞓鞕鞖鞗鞙\",4,\"臁膦欤欷欹歃歆歙飑飒飓飕飙飚殳彀毂觳斐齑斓於旆旄旃旌旎旒旖炀炜炖炝炻烀炷炫炱烨烊焐焓焖焯焱煳煜煨煅煲煊煸煺熘熳熵熨熠燠燔燧燹爝爨灬焘煦熹戾戽扃扈扉礻祀祆祉祛祜祓祚祢祗祠祯祧祺禅禊禚禧禳忑忐\"],\n[\"ed40\",\"鞞鞟鞡鞢鞤\",6,\"鞬鞮鞰鞱鞳鞵\",46],\n[\"ed80\",\"韤韥韨韮\",4,\"韴韷\",23,\"怼恝恚恧恁恙恣悫愆愍慝憩憝懋懑戆肀聿沓泶淼矶矸砀砉砗砘砑斫砭砜砝砹砺砻砟砼砥砬砣砩硎硭硖硗砦硐硇硌硪碛碓碚碇碜碡碣碲碹碥磔磙磉磬磲礅磴礓礤礞礴龛黹黻黼盱眄眍盹眇眈眚眢眙眭眦眵眸睐睑睇睃睚睨\"],\n[\"ee40\",\"頏\",62],\n[\"ee80\",\"顎\",32,\"睢睥睿瞍睽瞀瞌瞑瞟瞠瞰瞵瞽町畀畎畋畈畛畲畹疃罘罡罟詈罨罴罱罹羁罾盍盥蠲钅钆钇钋钊钌钍钏钐钔钗钕钚钛钜钣钤钫钪钭钬钯钰钲钴钶\",4,\"钼钽钿铄铈\",6,\"铐铑铒铕铖铗铙铘铛铞铟铠铢铤铥铧铨铪\"],\n[\"ef40\",\"顯\",5,\"颋颎颒颕颙颣風\",37,\"飏飐飔飖飗飛飜飝飠\",4],\n[\"ef80\",\"飥飦飩\",30,\"铩铫铮铯铳铴铵铷铹铼铽铿锃锂锆锇锉锊锍锎锏锒\",4,\"锘锛锝锞锟锢锪锫锩锬锱锲锴锶锷锸锼锾锿镂锵镄镅镆镉镌镎镏镒镓镔镖镗镘镙镛镞镟镝镡镢镤\",8,\"镯镱镲镳锺矧矬雉秕秭秣秫稆嵇稃稂稞稔\"],\n[\"f040\",\"餈\",4,\"餎餏餑\",28,\"餯\",26],\n[\"f080\",\"饊\",9,\"饖\",12,\"饤饦饳饸饹饻饾馂馃馉稹稷穑黏馥穰皈皎皓皙皤瓞瓠甬鸠鸢鸨\",4,\"鸲鸱鸶鸸鸷鸹鸺鸾鹁鹂鹄鹆鹇鹈鹉鹋鹌鹎鹑鹕鹗鹚鹛鹜鹞鹣鹦\",6,\"鹱鹭鹳疒疔疖疠疝疬疣疳疴疸痄疱疰痃痂痖痍痣痨痦痤痫痧瘃痱痼痿瘐瘀瘅瘌瘗瘊瘥瘘瘕瘙\"],\n[\"f140\",\"馌馎馚\",10,\"馦馧馩\",47],\n[\"f180\",\"駙\",32,\"瘛瘼瘢瘠癀瘭瘰瘿瘵癃瘾瘳癍癞癔癜癖癫癯翊竦穸穹窀窆窈窕窦窠窬窨窭窳衤衩衲衽衿袂袢裆袷袼裉裢裎裣裥裱褚裼裨裾裰褡褙褓褛褊褴褫褶襁襦襻疋胥皲皴矜耒耔耖耜耠耢耥耦耧耩耨耱耋耵聃聆聍聒聩聱覃顸颀颃\"],\n[\"f240\",\"駺\",62],\n[\"f280\",\"騹\",32,\"颉颌颍颏颔颚颛颞颟颡颢颥颦虍虔虬虮虿虺虼虻蚨蚍蚋蚬蚝蚧蚣蚪蚓蚩蚶蛄蚵蛎蚰蚺蚱蚯蛉蛏蚴蛩蛱蛲蛭蛳蛐蜓蛞蛴蛟蛘蛑蜃蜇蛸蜈蜊蜍蜉蜣蜻蜞蜥蜮蜚蜾蝈蜴蜱蜩蜷蜿螂蜢蝽蝾蝻蝠蝰蝌蝮螋蝓蝣蝼蝤蝙蝥螓螯螨蟒\"],\n[\"f340\",\"驚\",17,\"驲骃骉骍骎骔骕骙骦骩\",6,\"骲骳骴骵骹骻骽骾骿髃髄髆\",4,\"髍髎髏髐髒體髕髖髗髙髚髛髜\"],\n[\"f380\",\"髝髞髠髢髣髤髥髧髨髩髪髬髮髰\",8,\"髺髼\",6,\"鬄鬅鬆蟆螈螅螭螗螃螫蟥螬螵螳蟋蟓螽蟑蟀蟊蟛蟪蟠蟮蠖蠓蟾蠊蠛蠡蠹蠼缶罂罄罅舐竺竽笈笃笄笕笊笫笏筇笸笪笙笮笱笠笥笤笳笾笞筘筚筅筵筌筝筠筮筻筢筲筱箐箦箧箸箬箝箨箅箪箜箢箫箴篑篁篌篝篚篥篦篪簌篾篼簏簖簋\"],\n[\"f440\",\"鬇鬉\",5,\"鬐鬑鬒鬔\",10,\"鬠鬡鬢鬤\",10,\"鬰鬱鬳\",7,\"鬽鬾鬿魀魆魊魋魌魎魐魒魓魕\",5],\n[\"f480\",\"魛\",32,\"簟簪簦簸籁籀臾舁舂舄臬衄舡舢舣舭舯舨舫舸舻舳舴舾艄艉艋艏艚艟艨衾袅袈裘裟襞羝羟羧羯羰羲籼敉粑粝粜粞粢粲粼粽糁糇糌糍糈糅糗糨艮暨羿翎翕翥翡翦翩翮翳糸絷綦綮繇纛麸麴赳趄趔趑趱赧赭豇豉酊酐酎酏酤\"],\n[\"f540\",\"魼\",62],\n[\"f580\",\"鮻\",32,\"酢酡酰酩酯酽酾酲酴酹醌醅醐醍醑醢醣醪醭醮醯醵醴醺豕鹾趸跫踅蹙蹩趵趿趼趺跄跖跗跚跞跎跏跛跆跬跷跸跣跹跻跤踉跽踔踝踟踬踮踣踯踺蹀踹踵踽踱蹉蹁蹂蹑蹒蹊蹰蹶蹼蹯蹴躅躏躔躐躜躞豸貂貊貅貘貔斛觖觞觚觜\"],\n[\"f640\",\"鯜\",62],\n[\"f680\",\"鰛\",32,\"觥觫觯訾謦靓雩雳雯霆霁霈霏霎霪霭霰霾龀龃龅\",5,\"龌黾鼋鼍隹隼隽雎雒瞿雠銎銮鋈錾鍪鏊鎏鐾鑫鱿鲂鲅鲆鲇鲈稣鲋鲎鲐鲑鲒鲔鲕鲚鲛鲞\",5,\"鲥\",4,\"鲫鲭鲮鲰\",7,\"鲺鲻鲼鲽鳄鳅鳆鳇鳊鳋\"],\n[\"f740\",\"鰼\",62],\n[\"f780\",\"鱻鱽鱾鲀鲃鲄鲉鲊鲌鲏鲓鲖鲗鲘鲙鲝鲪鲬鲯鲹鲾\",4,\"鳈鳉鳑鳒鳚鳛鳠鳡鳌\",4,\"鳓鳔鳕鳗鳘鳙鳜鳝鳟鳢靼鞅鞑鞒鞔鞯鞫鞣鞲鞴骱骰骷鹘骶骺骼髁髀髅髂髋髌髑魅魃魇魉魈魍魑飨餍餮饕饔髟髡髦髯髫髻髭髹鬈鬏鬓鬟鬣麽麾縻麂麇麈麋麒鏖麝麟黛黜黝黠黟黢黩黧黥黪黯鼢鼬鼯鼹鼷鼽鼾齄\"],\n[\"f840\",\"鳣\",62],\n[\"f880\",\"鴢\",32],\n[\"f940\",\"鵃\",62],\n[\"f980\",\"鶂\",32],\n[\"fa40\",\"鶣\",62],\n[\"fa80\",\"鷢\",32],\n[\"fb40\",\"鸃\",27,\"鸤鸧鸮鸰鸴鸻鸼鹀鹍鹐鹒鹓鹔鹖鹙鹝鹟鹠鹡鹢鹥鹮鹯鹲鹴\",9,\"麀\"],\n[\"fb80\",\"麁麃麄麅麆麉麊麌\",5,\"麔\",8,\"麞麠\",5,\"麧麨麩麪\"],\n[\"fc40\",\"麫\",8,\"麵麶麷麹麺麼麿\",4,\"黅黆黇黈黊黋黌黐黒黓黕黖黗黙黚點黡黣黤黦黨黫黬黭黮黰\",8,\"黺黽黿\",6],\n[\"fc80\",\"鼆\",4,\"鼌鼏鼑鼒鼔鼕鼖鼘鼚\",5,\"鼡鼣\",8,\"鼭鼮鼰鼱\"],\n[\"fd40\",\"鼲\",4,\"鼸鼺鼼鼿\",4,\"齅\",10,\"齒\",38],\n[\"fd80\",\"齹\",5,\"龁龂龍\",11,\"龜龝龞龡\",4,\"郎凉秊裏隣\"],\n[\"fe40\",\"兀嗀﨎﨏﨑﨓﨔礼﨟蘒﨡﨣﨤﨧﨨﨩\"]\n]\n");
__memMods.set("iconv-lite/encodings/tables/cp949.json", "[\n[\"0\",\"\\u0000\",127],\n[\"8141\",\"갂갃갅갆갋\",4,\"갘갞갟갡갢갣갥\",6,\"갮갲갳갴\"],\n[\"8161\",\"갵갶갷갺갻갽갾갿걁\",9,\"걌걎\",5,\"걕\"],\n[\"8181\",\"걖걗걙걚걛걝\",18,\"걲걳걵걶걹걻\",4,\"겂겇겈겍겎겏겑겒겓겕\",6,\"겞겢\",5,\"겫겭겮겱\",6,\"겺겾겿곀곂곃곅곆곇곉곊곋곍\",7,\"곖곘\",7,\"곢곣곥곦곩곫곭곮곲곴곷\",4,\"곾곿괁괂괃괅괇\",4,\"괎괐괒괓\"],\n[\"8241\",\"괔괕괖괗괙괚괛괝괞괟괡\",7,\"괪괫괮\",5],\n[\"8261\",\"괶괷괹괺괻괽\",6,\"굆굈굊\",5,\"굑굒굓굕굖굗\"],\n[\"8281\",\"굙\",7,\"굢굤\",7,\"굮굯굱굲굷굸굹굺굾궀궃\",4,\"궊궋궍궎궏궑\",10,\"궞\",5,\"궥\",17,\"궸\",7,\"귂귃귅귆귇귉\",6,\"귒귔\",7,\"귝귞귟귡귢귣귥\",18],\n[\"8341\",\"귺귻귽귾긂\",5,\"긊긌긎\",5,\"긕\",7],\n[\"8361\",\"긝\",18,\"긲긳긵긶긹긻긼\"],\n[\"8381\",\"긽긾긿깂깄깇깈깉깋깏깑깒깓깕깗\",4,\"깞깢깣깤깦깧깪깫깭깮깯깱\",6,\"깺깾\",5,\"꺆\",5,\"꺍\",46,\"꺿껁껂껃껅\",6,\"껎껒\",5,\"껚껛껝\",8],\n[\"8441\",\"껦껧껩껪껬껮\",5,\"껵껶껷껹껺껻껽\",8],\n[\"8461\",\"꼆꼉꼊꼋꼌꼎꼏꼑\",18],\n[\"8481\",\"꼤\",7,\"꼮꼯꼱꼳꼵\",6,\"꼾꽀꽄꽅꽆꽇꽊\",5,\"꽑\",10,\"꽞\",5,\"꽦\",18,\"꽺\",5,\"꾁꾂꾃꾅꾆꾇꾉\",6,\"꾒꾓꾔꾖\",5,\"꾝\",26,\"꾺꾻꾽꾾\"],\n[\"8541\",\"꾿꿁\",5,\"꿊꿌꿏\",4,\"꿕\",6,\"꿝\",4],\n[\"8561\",\"꿢\",5,\"꿪\",5,\"꿲꿳꿵꿶꿷꿹\",6,\"뀂뀃\"],\n[\"8581\",\"뀅\",6,\"뀍뀎뀏뀑뀒뀓뀕\",6,\"뀞\",9,\"뀩\",26,\"끆끇끉끋끍끏끐끑끒끖끘끚끛끜끞\",29,\"끾끿낁낂낃낅\",6,\"낎낐낒\",5,\"낛낝낞낣낤\"],\n[\"8641\",\"낥낦낧낪낰낲낶낷낹낺낻낽\",6,\"냆냊\",5,\"냒\"],\n[\"8661\",\"냓냕냖냗냙\",6,\"냡냢냣냤냦\",10],\n[\"8681\",\"냱\",22,\"넊넍넎넏넑넔넕넖넗넚넞\",4,\"넦넧넩넪넫넭\",6,\"넶넺\",5,\"녂녃녅녆녇녉\",6,\"녒녓녖녗녙녚녛녝녞녟녡\",22,\"녺녻녽녾녿놁놃\",4,\"놊놌놎놏놐놑놕놖놗놙놚놛놝\"],\n[\"8741\",\"놞\",9,\"놩\",15],\n[\"8761\",\"놹\",18,\"뇍뇎뇏뇑뇒뇓뇕\"],\n[\"8781\",\"뇖\",5,\"뇞뇠\",7,\"뇪뇫뇭뇮뇯뇱\",7,\"뇺뇼뇾\",5,\"눆눇눉눊눍\",6,\"눖눘눚\",5,\"눡\",18,\"눵\",6,\"눽\",26,\"뉙뉚뉛뉝뉞뉟뉡\",6,\"뉪\",4],\n[\"8841\",\"뉯\",4,\"뉶\",5,\"뉽\",6,\"늆늇늈늊\",4],\n[\"8861\",\"늏늒늓늕늖늗늛\",4,\"늢늤늧늨늩늫늭늮늯늱늲늳늵늶늷\"],\n[\"8881\",\"늸\",15,\"닊닋닍닎닏닑닓\",4,\"닚닜닞닟닠닡닣닧닩닪닰닱닲닶닼닽닾댂댃댅댆댇댉\",6,\"댒댖\",5,\"댝\",54,\"덗덙덚덝덠덡덢덣\"],\n[\"8941\",\"덦덨덪덬덭덯덲덳덵덶덷덹\",6,\"뎂뎆\",5,\"뎍\"],\n[\"8961\",\"뎎뎏뎑뎒뎓뎕\",10,\"뎢\",5,\"뎩뎪뎫뎭\"],\n[\"8981\",\"뎮\",21,\"돆돇돉돊돍돏돑돒돓돖돘돚돜돞돟돡돢돣돥돦돧돩\",18,\"돽\",18,\"됑\",6,\"됙됚됛됝됞됟됡\",6,\"됪됬\",7,\"됵\",15],\n[\"8a41\",\"둅\",10,\"둒둓둕둖둗둙\",6,\"둢둤둦\"],\n[\"8a61\",\"둧\",4,\"둭\",18,\"뒁뒂\"],\n[\"8a81\",\"뒃\",4,\"뒉\",19,\"뒞\",5,\"뒥뒦뒧뒩뒪뒫뒭\",7,\"뒶뒸뒺\",5,\"듁듂듃듅듆듇듉\",6,\"듑듒듓듔듖\",5,\"듞듟듡듢듥듧\",4,\"듮듰듲\",5,\"듹\",26,\"딖딗딙딚딝\"],\n[\"8b41\",\"딞\",5,\"딦딫\",4,\"딲딳딵딶딷딹\",6,\"땂땆\"],\n[\"8b61\",\"땇땈땉땊땎땏땑땒땓땕\",6,\"땞땢\",8],\n[\"8b81\",\"땫\",52,\"떢떣떥떦떧떩떬떭떮떯떲떶\",4,\"떾떿뗁뗂뗃뗅\",6,\"뗎뗒\",5,\"뗙\",18,\"뗭\",18],\n[\"8c41\",\"똀\",15,\"똒똓똕똖똗똙\",4],\n[\"8c61\",\"똞\",6,\"똦\",5,\"똭\",6,\"똵\",5],\n[\"8c81\",\"똻\",12,\"뙉\",26,\"뙥뙦뙧뙩\",50,\"뚞뚟뚡뚢뚣뚥\",5,\"뚭뚮뚯뚰뚲\",16],\n[\"8d41\",\"뛃\",16,\"뛕\",8],\n[\"8d61\",\"뛞\",17,\"뛱뛲뛳뛵뛶뛷뛹뛺\"],\n[\"8d81\",\"뛻\",4,\"뜂뜃뜄뜆\",33,\"뜪뜫뜭뜮뜱\",6,\"뜺뜼\",7,\"띅띆띇띉띊띋띍\",6,\"띖\",9,\"띡띢띣띥띦띧띩\",6,\"띲띴띶\",5,\"띾띿랁랂랃랅\",6,\"랎랓랔랕랚랛랝랞\"],\n[\"8e41\",\"랟랡\",6,\"랪랮\",5,\"랶랷랹\",8],\n[\"8e61\",\"럂\",4,\"럈럊\",19],\n[\"8e81\",\"럞\",13,\"럮럯럱럲럳럵\",6,\"럾렂\",4,\"렊렋렍렎렏렑\",6,\"렚렜렞\",5,\"렦렧렩렪렫렭\",6,\"렶렺\",5,\"롁롂롃롅\",11,\"롒롔\",7,\"롞롟롡롢롣롥\",6,\"롮롰롲\",5,\"롹롺롻롽\",7],\n[\"8f41\",\"뢅\",7,\"뢎\",17],\n[\"8f61\",\"뢠\",7,\"뢩\",6,\"뢱뢲뢳뢵뢶뢷뢹\",4],\n[\"8f81\",\"뢾뢿룂룄룆\",5,\"룍룎룏룑룒룓룕\",7,\"룞룠룢\",5,\"룪룫룭룮룯룱\",6,\"룺룼룾\",5,\"뤅\",18,\"뤙\",6,\"뤡\",26,\"뤾뤿륁륂륃륅\",6,\"륍륎륐륒\",5],\n[\"9041\",\"륚륛륝륞륟륡\",6,\"륪륬륮\",5,\"륶륷륹륺륻륽\"],\n[\"9061\",\"륾\",5,\"릆릈릋릌릏\",15],\n[\"9081\",\"릟\",12,\"릮릯릱릲릳릵\",6,\"릾맀맂\",5,\"맊맋맍맓\",4,\"맚맜맟맠맢맦맧맩맪맫맭\",6,\"맶맻\",4,\"먂\",5,\"먉\",11,\"먖\",33,\"먺먻먽먾먿멁멃멄멅멆\"],\n[\"9141\",\"멇멊멌멏멐멑멒멖멗멙멚멛멝\",6,\"멦멪\",5],\n[\"9161\",\"멲멳멵멶멷멹\",9,\"몆몈몉몊몋몍\",5],\n[\"9181\",\"몓\",20,\"몪몭몮몯몱몳\",4,\"몺몼몾\",5,\"뫅뫆뫇뫉\",14,\"뫚\",33,\"뫽뫾뫿묁묂묃묅\",7,\"묎묐묒\",5,\"묙묚묛묝묞묟묡\",6],\n[\"9241\",\"묨묪묬\",7,\"묷묹묺묿\",4,\"뭆뭈뭊뭋뭌뭎뭑뭒\"],\n[\"9261\",\"뭓뭕뭖뭗뭙\",7,\"뭢뭤\",7,\"뭭\",4],\n[\"9281\",\"뭲\",21,\"뮉뮊뮋뮍뮎뮏뮑\",18,\"뮥뮦뮧뮩뮪뮫뮭\",6,\"뮵뮶뮸\",7,\"믁믂믃믅믆믇믉\",6,\"믑믒믔\",35,\"믺믻믽믾밁\"],\n[\"9341\",\"밃\",4,\"밊밎밐밒밓밙밚밠밡밢밣밦밨밪밫밬밮밯밲밳밵\"],\n[\"9361\",\"밶밷밹\",6,\"뱂뱆뱇뱈뱊뱋뱎뱏뱑\",8],\n[\"9381\",\"뱚뱛뱜뱞\",37,\"벆벇벉벊벍벏\",4,\"벖벘벛\",4,\"벢벣벥벦벩\",6,\"벲벶\",5,\"벾벿볁볂볃볅\",7,\"볎볒볓볔볖볗볙볚볛볝\",22,\"볷볹볺볻볽\"],\n[\"9441\",\"볾\",5,\"봆봈봊\",5,\"봑봒봓봕\",8],\n[\"9461\",\"봞\",5,\"봥\",6,\"봭\",12],\n[\"9481\",\"봺\",5,\"뵁\",6,\"뵊뵋뵍뵎뵏뵑\",6,\"뵚\",9,\"뵥뵦뵧뵩\",22,\"붂붃붅붆붋\",4,\"붒붔붖붗붘붛붝\",6,\"붥\",10,\"붱\",6,\"붹\",24],\n[\"9541\",\"뷒뷓뷖뷗뷙뷚뷛뷝\",11,\"뷪\",5,\"뷱\"],\n[\"9561\",\"뷲뷳뷵뷶뷷뷹\",6,\"븁븂븄븆\",5,\"븎븏븑븒븓\"],\n[\"9581\",\"븕\",6,\"븞븠\",35,\"빆빇빉빊빋빍빏\",4,\"빖빘빜빝빞빟빢빣빥빦빧빩빫\",4,\"빲빶\",4,\"빾빿뺁뺂뺃뺅\",6,\"뺎뺒\",5,\"뺚\",13,\"뺩\",14],\n[\"9641\",\"뺸\",23,\"뻒뻓\"],\n[\"9661\",\"뻕뻖뻙\",6,\"뻡뻢뻦\",5,\"뻭\",8],\n[\"9681\",\"뻶\",10,\"뼂\",5,\"뼊\",13,\"뼚뼞\",33,\"뽂뽃뽅뽆뽇뽉\",6,\"뽒뽓뽔뽖\",44],\n[\"9741\",\"뾃\",16,\"뾕\",8],\n[\"9761\",\"뾞\",17,\"뾱\",7],\n[\"9781\",\"뾹\",11,\"뿆\",5,\"뿎뿏뿑뿒뿓뿕\",6,\"뿝뿞뿠뿢\",89,\"쀽쀾쀿\"],\n[\"9841\",\"쁀\",16,\"쁒\",5,\"쁙쁚쁛\"],\n[\"9861\",\"쁝쁞쁟쁡\",6,\"쁪\",15],\n[\"9881\",\"쁺\",21,\"삒삓삕삖삗삙\",6,\"삢삤삦\",5,\"삮삱삲삷\",4,\"삾샂샃샄샆샇샊샋샍샎샏샑\",6,\"샚샞\",5,\"샦샧샩샪샫샭\",6,\"샶샸샺\",5,\"섁섂섃섅섆섇섉\",6,\"섑섒섓섔섖\",5,\"섡섢섥섨섩섪섫섮\"],\n[\"9941\",\"섲섳섴섵섷섺섻섽섾섿셁\",6,\"셊셎\",5,\"셖셗\"],\n[\"9961\",\"셙셚셛셝\",6,\"셦셪\",5,\"셱셲셳셵셶셷셹셺셻\"],\n[\"9981\",\"셼\",8,\"솆\",5,\"솏솑솒솓솕솗\",4,\"솞솠솢솣솤솦솧솪솫솭솮솯솱\",11,\"솾\",5,\"쇅쇆쇇쇉쇊쇋쇍\",6,\"쇕쇖쇙\",6,\"쇡쇢쇣쇥쇦쇧쇩\",6,\"쇲쇴\",7,\"쇾쇿숁숂숃숅\",6,\"숎숐숒\",5,\"숚숛숝숞숡숢숣\"],\n[\"9a41\",\"숤숥숦숧숪숬숮숰숳숵\",16],\n[\"9a61\",\"쉆쉇쉉\",6,\"쉒쉓쉕쉖쉗쉙\",6,\"쉡쉢쉣쉤쉦\"],\n[\"9a81\",\"쉧\",4,\"쉮쉯쉱쉲쉳쉵\",6,\"쉾슀슂\",5,\"슊\",5,\"슑\",6,\"슙슚슜슞\",5,\"슦슧슩슪슫슮\",5,\"슶슸슺\",33,\"싞싟싡싢싥\",5,\"싮싰싲싳싴싵싷싺싽싾싿쌁\",6,\"쌊쌋쌎쌏\"],\n[\"9b41\",\"쌐쌑쌒쌖쌗쌙쌚쌛쌝\",6,\"쌦쌧쌪\",8],\n[\"9b61\",\"쌳\",17,\"썆\",7],\n[\"9b81\",\"썎\",25,\"썪썫썭썮썯썱썳\",4,\"썺썻썾\",5,\"쎅쎆쎇쎉쎊쎋쎍\",50,\"쏁\",22,\"쏚\"],\n[\"9c41\",\"쏛쏝쏞쏡쏣\",4,\"쏪쏫쏬쏮\",5,\"쏶쏷쏹\",5],\n[\"9c61\",\"쏿\",8,\"쐉\",6,\"쐑\",9],\n[\"9c81\",\"쐛\",8,\"쐥\",6,\"쐭쐮쐯쐱쐲쐳쐵\",6,\"쐾\",9,\"쑉\",26,\"쑦쑧쑩쑪쑫쑭\",6,\"쑶쑷쑸쑺\",5,\"쒁\",18,\"쒕\",6,\"쒝\",12],\n[\"9d41\",\"쒪\",13,\"쒹쒺쒻쒽\",8],\n[\"9d61\",\"쓆\",25],\n[\"9d81\",\"쓠\",8,\"쓪\",5,\"쓲쓳쓵쓶쓷쓹쓻쓼쓽쓾씂\",9,\"씍씎씏씑씒씓씕\",6,\"씝\",10,\"씪씫씭씮씯씱\",6,\"씺씼씾\",5,\"앆앇앋앏앐앑앒앖앚앛앜앟앢앣앥앦앧앩\",6,\"앲앶\",5,\"앾앿얁얂얃얅얆얈얉얊얋얎얐얒얓얔\"],\n[\"9e41\",\"얖얙얚얛얝얞얟얡\",7,\"얪\",9,\"얶\"],\n[\"9e61\",\"얷얺얿\",4,\"엋엍엏엒엓엕엖엗엙\",6,\"엢엤엦엧\"],\n[\"9e81\",\"엨엩엪엫엯엱엲엳엵엸엹엺엻옂옃옄옉옊옋옍옎옏옑\",6,\"옚옝\",6,\"옦옧옩옪옫옯옱옲옶옸옺옼옽옾옿왂왃왅왆왇왉\",6,\"왒왖\",5,\"왞왟왡\",10,\"왭왮왰왲\",5,\"왺왻왽왾왿욁\",6,\"욊욌욎\",5,\"욖욗욙욚욛욝\",6,\"욦\"],\n[\"9f41\",\"욨욪\",5,\"욲욳욵욶욷욻\",4,\"웂웄웆\",5,\"웎\"],\n[\"9f61\",\"웏웑웒웓웕\",6,\"웞웟웢\",5,\"웪웫웭웮웯웱웲\"],\n[\"9f81\",\"웳\",4,\"웺웻웼웾\",5,\"윆윇윉윊윋윍\",6,\"윖윘윚\",5,\"윢윣윥윦윧윩\",6,\"윲윴윶윸윹윺윻윾윿읁읂읃읅\",4,\"읋읎읐읙읚읛읝읞읟읡\",6,\"읩읪읬\",7,\"읶읷읹읺읻읿잀잁잂잆잋잌잍잏잒잓잕잙잛\",4,\"잢잧\",4,\"잮잯잱잲잳잵잶잷\"],\n[\"a041\",\"잸잹잺잻잾쟂\",5,\"쟊쟋쟍쟏쟑\",6,\"쟙쟚쟛쟜\"],\n[\"a061\",\"쟞\",5,\"쟥쟦쟧쟩쟪쟫쟭\",13],\n[\"a081\",\"쟻\",4,\"젂젃젅젆젇젉젋\",4,\"젒젔젗\",4,\"젞젟젡젢젣젥\",6,\"젮젰젲\",5,\"젹젺젻젽젾젿졁\",6,\"졊졋졎\",5,\"졕\",26,\"졲졳졵졶졷졹졻\",4,\"좂좄좈좉좊좎\",5,\"좕\",7,\"좞좠좢좣좤\"],\n[\"a141\",\"좥좦좧좩\",18,\"좾좿죀죁\"],\n[\"a161\",\"죂죃죅죆죇죉죊죋죍\",6,\"죖죘죚\",5,\"죢죣죥\"],\n[\"a181\",\"죦\",14,\"죶\",5,\"죾죿줁줂줃줇\",4,\"줎　、。·‥…¨〃­―∥＼∼‘’“”〔〕〈\",9,\"±×÷≠≤≥∞∴°′″℃Å￠￡￥♂♀∠⊥⌒∂∇≡≒§※☆★○●◎◇◆□■△▲▽▼→←↑↓↔〓≪≫√∽∝∵∫∬∈∋⊆⊇⊂⊃∪∩∧∨￢\"],\n[\"a241\",\"줐줒\",5,\"줙\",18],\n[\"a261\",\"줭\",6,\"줵\",18],\n[\"a281\",\"쥈\",7,\"쥒쥓쥕쥖쥗쥙\",6,\"쥢쥤\",7,\"쥭쥮쥯⇒⇔∀∃´～ˇ˘˝˚˙¸˛¡¿ː∮∑∏¤℉‰◁◀▷▶♤♠♡♥♧♣⊙◈▣◐◑▒▤▥▨▧▦▩♨☏☎☜☞¶†‡↕↗↙↖↘♭♩♪♬㉿㈜№㏇™㏂㏘℡€®\"],\n[\"a341\",\"쥱쥲쥳쥵\",6,\"쥽\",10,\"즊즋즍즎즏\"],\n[\"a361\",\"즑\",6,\"즚즜즞\",16],\n[\"a381\",\"즯\",16,\"짂짃짅짆짉짋\",4,\"짒짔짗짘짛！\",58,\"￦］\",32,\"￣\"],\n[\"a441\",\"짞짟짡짣짥짦짨짩짪짫짮짲\",5,\"짺짻짽짾짿쨁쨂쨃쨄\"],\n[\"a461\",\"쨅쨆쨇쨊쨎\",5,\"쨕쨖쨗쨙\",12],\n[\"a481\",\"쨦쨧쨨쨪\",28,\"ㄱ\",93],\n[\"a541\",\"쩇\",4,\"쩎쩏쩑쩒쩓쩕\",6,\"쩞쩢\",5,\"쩩쩪\"],\n[\"a561\",\"쩫\",17,\"쩾\",5,\"쪅쪆\"],\n[\"a581\",\"쪇\",16,\"쪙\",14,\"ⅰ\",9],\n[\"a5b0\",\"Ⅰ\",9],\n[\"a5c1\",\"Α\",16,\"Σ\",6],\n[\"a5e1\",\"α\",16,\"σ\",6],\n[\"a641\",\"쪨\",19,\"쪾쪿쫁쫂쫃쫅\"],\n[\"a661\",\"쫆\",5,\"쫎쫐쫒쫔쫕쫖쫗쫚\",5,\"쫡\",6],\n[\"a681\",\"쫨쫩쫪쫫쫭\",6,\"쫵\",18,\"쬉쬊─│┌┐┘└├┬┤┴┼━┃┏┓┛┗┣┳┫┻╋┠┯┨┷┿┝┰┥┸╂┒┑┚┙┖┕┎┍┞┟┡┢┦┧┩┪┭┮┱┲┵┶┹┺┽┾╀╁╃\",7],\n[\"a741\",\"쬋\",4,\"쬑쬒쬓쬕쬖쬗쬙\",6,\"쬢\",7],\n[\"a761\",\"쬪\",22,\"쭂쭃쭄\"],\n[\"a781\",\"쭅쭆쭇쭊쭋쭍쭎쭏쭑\",6,\"쭚쭛쭜쭞\",5,\"쭥\",7,\"㎕㎖㎗ℓ㎘㏄㎣㎤㎥㎦㎙\",9,\"㏊㎍㎎㎏㏏㎈㎉㏈㎧㎨㎰\",9,\"㎀\",4,\"㎺\",5,\"㎐\",4,\"Ω㏀㏁㎊㎋㎌㏖㏅㎭㎮㎯㏛㎩㎪㎫㎬㏝㏐㏓㏃㏉㏜㏆\"],\n[\"a841\",\"쭭\",10,\"쭺\",14],\n[\"a861\",\"쮉\",18,\"쮝\",6],\n[\"a881\",\"쮤\",19,\"쮹\",11,\"ÆÐªĦ\"],\n[\"a8a6\",\"Ĳ\"],\n[\"a8a8\",\"ĿŁØŒºÞŦŊ\"],\n[\"a8b1\",\"㉠\",27,\"ⓐ\",25,\"①\",14,\"½⅓⅔¼¾⅛⅜⅝⅞\"],\n[\"a941\",\"쯅\",14,\"쯕\",10],\n[\"a961\",\"쯠쯡쯢쯣쯥쯦쯨쯪\",18],\n[\"a981\",\"쯽\",14,\"찎찏찑찒찓찕\",6,\"찞찟찠찣찤æđðħıĳĸŀłøœßþŧŋŉ㈀\",27,\"⒜\",25,\"⑴\",14,\"¹²³⁴ⁿ₁₂₃₄\"],\n[\"aa41\",\"찥찦찪찫찭찯찱\",6,\"찺찿\",4,\"챆챇챉챊챋챍챎\"],\n[\"aa61\",\"챏\",4,\"챖챚\",5,\"챡챢챣챥챧챩\",6,\"챱챲\"],\n[\"aa81\",\"챳챴챶\",29,\"ぁ\",82],\n[\"ab41\",\"첔첕첖첗첚첛첝첞첟첡\",6,\"첪첮\",5,\"첶첷첹\"],\n[\"ab61\",\"첺첻첽\",6,\"쳆쳈쳊\",5,\"쳑쳒쳓쳕\",5],\n[\"ab81\",\"쳛\",8,\"쳥\",6,\"쳭쳮쳯쳱\",12,\"ァ\",85],\n[\"ac41\",\"쳾쳿촀촂\",5,\"촊촋촍촎촏촑\",6,\"촚촜촞촟촠\"],\n[\"ac61\",\"촡촢촣촥촦촧촩촪촫촭\",11,\"촺\",4],\n[\"ac81\",\"촿\",28,\"쵝쵞쵟А\",5,\"ЁЖ\",25],\n[\"acd1\",\"а\",5,\"ёж\",25],\n[\"ad41\",\"쵡쵢쵣쵥\",6,\"쵮쵰쵲\",5,\"쵹\",7],\n[\"ad61\",\"춁\",6,\"춉\",10,\"춖춗춙춚춛춝춞춟\"],\n[\"ad81\",\"춠춡춢춣춦춨춪\",5,\"춱\",18,\"췅\"],\n[\"ae41\",\"췆\",5,\"췍췎췏췑\",16],\n[\"ae61\",\"췢\",5,\"췩췪췫췭췮췯췱\",6,\"췺췼췾\",4],\n[\"ae81\",\"츃츅츆츇츉츊츋츍\",6,\"츕츖츗츘츚\",5,\"츢츣츥츦츧츩츪츫\"],\n[\"af41\",\"츬츭츮츯츲츴츶\",19],\n[\"af61\",\"칊\",13,\"칚칛칝칞칢\",5,\"칪칬\"],\n[\"af81\",\"칮\",5,\"칶칷칹칺칻칽\",6,\"캆캈캊\",5,\"캒캓캕캖캗캙\"],\n[\"b041\",\"캚\",5,\"캢캦\",5,\"캮\",12],\n[\"b061\",\"캻\",5,\"컂\",19],\n[\"b081\",\"컖\",13,\"컦컧컩컪컭\",6,\"컶컺\",5,\"가각간갇갈갉갊감\",7,\"같\",4,\"갠갤갬갭갯갰갱갸갹갼걀걋걍걔걘걜거걱건걷걸걺검겁것겄겅겆겉겊겋게겐겔겜겝겟겠겡겨격겪견겯결겸겹겻겼경곁계곈곌곕곗고곡곤곧골곪곬곯곰곱곳공곶과곽관괄괆\"],\n[\"b141\",\"켂켃켅켆켇켉\",6,\"켒켔켖\",5,\"켝켞켟켡켢켣\"],\n[\"b161\",\"켥\",6,\"켮켲\",5,\"켹\",11],\n[\"b181\",\"콅\",14,\"콖콗콙콚콛콝\",6,\"콦콨콪콫콬괌괍괏광괘괜괠괩괬괭괴괵괸괼굄굅굇굉교굔굘굡굣구국군굳굴굵굶굻굼굽굿궁궂궈궉권궐궜궝궤궷귀귁귄귈귐귑귓규균귤그극근귿글긁금급긋긍긔기긱긴긷길긺김깁깃깅깆깊까깍깎깐깔깖깜깝깟깠깡깥깨깩깬깰깸\"],\n[\"b241\",\"콭콮콯콲콳콵콶콷콹\",6,\"쾁쾂쾃쾄쾆\",5,\"쾍\"],\n[\"b261\",\"쾎\",18,\"쾢\",5,\"쾩\"],\n[\"b281\",\"쾪\",5,\"쾱\",18,\"쿅\",6,\"깹깻깼깽꺄꺅꺌꺼꺽꺾껀껄껌껍껏껐껑께껙껜껨껫껭껴껸껼꼇꼈꼍꼐꼬꼭꼰꼲꼴꼼꼽꼿꽁꽂꽃꽈꽉꽐꽜꽝꽤꽥꽹꾀꾄꾈꾐꾑꾕꾜꾸꾹꾼꿀꿇꿈꿉꿋꿍꿎꿔꿜꿨꿩꿰꿱꿴꿸뀀뀁뀄뀌뀐뀔뀜뀝뀨끄끅끈끊끌끎끓끔끕끗끙\"],\n[\"b341\",\"쿌\",19,\"쿢쿣쿥쿦쿧쿩\"],\n[\"b361\",\"쿪\",5,\"쿲쿴쿶\",5,\"쿽쿾쿿퀁퀂퀃퀅\",5],\n[\"b381\",\"퀋\",5,\"퀒\",5,\"퀙\",19,\"끝끼끽낀낄낌낍낏낑나낙낚난낟날낡낢남납낫\",4,\"낱낳내낵낸낼냄냅냇냈냉냐냑냔냘냠냥너넉넋넌널넒넓넘넙넛넜넝넣네넥넨넬넴넵넷넸넹녀녁년녈념녑녔녕녘녜녠노녹논놀놂놈놉놋농높놓놔놘놜놨뇌뇐뇔뇜뇝\"],\n[\"b441\",\"퀮\",5,\"퀶퀷퀹퀺퀻퀽\",6,\"큆큈큊\",5],\n[\"b461\",\"큑큒큓큕큖큗큙\",6,\"큡\",10,\"큮큯\"],\n[\"b481\",\"큱큲큳큵\",6,\"큾큿킀킂\",18,\"뇟뇨뇩뇬뇰뇹뇻뇽누눅눈눋눌눔눕눗눙눠눴눼뉘뉜뉠뉨뉩뉴뉵뉼늄늅늉느늑는늘늙늚늠늡늣능늦늪늬늰늴니닉닌닐닒님닙닛닝닢다닥닦단닫\",4,\"닳담답닷\",4,\"닿대댁댄댈댐댑댓댔댕댜더덕덖던덛덜덞덟덤덥\"],\n[\"b541\",\"킕\",14,\"킦킧킩킪킫킭\",5],\n[\"b561\",\"킳킶킸킺\",5,\"탂탃탅탆탇탊\",5,\"탒탖\",4],\n[\"b581\",\"탛탞탟탡탢탣탥\",6,\"탮탲\",5,\"탹\",11,\"덧덩덫덮데덱덴델뎀뎁뎃뎄뎅뎌뎐뎔뎠뎡뎨뎬도독돈돋돌돎돐돔돕돗동돛돝돠돤돨돼됐되된될됨됩됫됴두둑둔둘둠둡둣둥둬뒀뒈뒝뒤뒨뒬뒵뒷뒹듀듄듈듐듕드득든듣들듦듬듭듯등듸디딕딘딛딜딤딥딧딨딩딪따딱딴딸\"],\n[\"b641\",\"턅\",7,\"턎\",17],\n[\"b661\",\"턠\",15,\"턲턳턵턶턷턹턻턼턽턾\"],\n[\"b681\",\"턿텂텆\",5,\"텎텏텑텒텓텕\",6,\"텞텠텢\",5,\"텩텪텫텭땀땁땃땄땅땋때땍땐땔땜땝땟땠땡떠떡떤떨떪떫떰떱떳떴떵떻떼떽뗀뗄뗌뗍뗏뗐뗑뗘뗬또똑똔똘똥똬똴뙈뙤뙨뚜뚝뚠뚤뚫뚬뚱뛔뛰뛴뛸뜀뜁뜅뜨뜩뜬뜯뜰뜸뜹뜻띄띈띌띔띕띠띤띨띰띱띳띵라락란랄람랍랏랐랑랒랖랗\"],\n[\"b741\",\"텮\",13,\"텽\",6,\"톅톆톇톉톊\"],\n[\"b761\",\"톋\",20,\"톢톣톥톦톧\"],\n[\"b781\",\"톩\",6,\"톲톴톶톷톸톹톻톽톾톿퇁\",14,\"래랙랜랠램랩랫랬랭랴략랸럇량러럭런럴럼럽럿렀렁렇레렉렌렐렘렙렛렝려력련렬렴렵렷렸령례롄롑롓로록론롤롬롭롯롱롸롼뢍뢨뢰뢴뢸룀룁룃룅료룐룔룝룟룡루룩룬룰룸룹룻룽뤄뤘뤠뤼뤽륀륄륌륏륑류륙륜률륨륩\"],\n[\"b841\",\"퇐\",7,\"퇙\",17],\n[\"b861\",\"퇫\",8,\"퇵퇶퇷퇹\",13],\n[\"b881\",\"툈툊\",5,\"툑\",24,\"륫륭르륵른를름릅릇릉릊릍릎리릭린릴림립릿링마막만많\",4,\"맘맙맛망맞맡맣매맥맨맬맴맵맷맸맹맺먀먁먈먕머먹먼멀멂멈멉멋멍멎멓메멕멘멜멤멥멧멨멩며멱면멸몃몄명몇몌모목몫몬몰몲몸몹못몽뫄뫈뫘뫙뫼\"],\n[\"b941\",\"툪툫툮툯툱툲툳툵\",6,\"툾퉀퉂\",5,\"퉉퉊퉋퉌\"],\n[\"b961\",\"퉍\",14,\"퉝\",6,\"퉥퉦퉧퉨\"],\n[\"b981\",\"퉩\",22,\"튂튃튅튆튇튉튊튋튌묀묄묍묏묑묘묜묠묩묫무묵묶문묻물묽묾뭄뭅뭇뭉뭍뭏뭐뭔뭘뭡뭣뭬뮈뮌뮐뮤뮨뮬뮴뮷므믄믈믐믓미믹민믿밀밂밈밉밋밌밍및밑바\",4,\"받\",4,\"밤밥밧방밭배백밴밸뱀뱁뱃뱄뱅뱉뱌뱍뱐뱝버벅번벋벌벎범법벗\"],\n[\"ba41\",\"튍튎튏튒튓튔튖\",5,\"튝튞튟튡튢튣튥\",6,\"튭\"],\n[\"ba61\",\"튮튯튰튲\",5,\"튺튻튽튾틁틃\",4,\"틊틌\",5],\n[\"ba81\",\"틒틓틕틖틗틙틚틛틝\",6,\"틦\",9,\"틲틳틵틶틷틹틺벙벚베벡벤벧벨벰벱벳벴벵벼벽변별볍볏볐병볕볘볜보복볶본볼봄봅봇봉봐봔봤봬뵀뵈뵉뵌뵐뵘뵙뵤뵨부북분붇불붉붊붐붑붓붕붙붚붜붤붰붸뷔뷕뷘뷜뷩뷰뷴뷸븀븃븅브븍븐블븜븝븟비빅빈빌빎빔빕빗빙빚빛빠빡빤\"],\n[\"bb41\",\"틻\",4,\"팂팄팆\",5,\"팏팑팒팓팕팗\",4,\"팞팢팣\"],\n[\"bb61\",\"팤팦팧팪팫팭팮팯팱\",6,\"팺팾\",5,\"퍆퍇퍈퍉\"],\n[\"bb81\",\"퍊\",31,\"빨빪빰빱빳빴빵빻빼빽뺀뺄뺌뺍뺏뺐뺑뺘뺙뺨뻐뻑뻔뻗뻘뻠뻣뻤뻥뻬뼁뼈뼉뼘뼙뼛뼜뼝뽀뽁뽄뽈뽐뽑뽕뾔뾰뿅뿌뿍뿐뿔뿜뿟뿡쀼쁑쁘쁜쁠쁨쁩삐삑삔삘삠삡삣삥사삭삯산삳살삵삶삼삽삿샀상샅새색샌샐샘샙샛샜생샤\"],\n[\"bc41\",\"퍪\",17,\"퍾퍿펁펂펃펅펆펇\"],\n[\"bc61\",\"펈펉펊펋펎펒\",5,\"펚펛펝펞펟펡\",6,\"펪펬펮\"],\n[\"bc81\",\"펯\",4,\"펵펶펷펹펺펻펽\",6,\"폆폇폊\",5,\"폑\",5,\"샥샨샬샴샵샷샹섀섄섈섐섕서\",4,\"섣설섦섧섬섭섯섰성섶세섹센셀셈셉셋셌셍셔셕션셜셤셥셧셨셩셰셴셸솅소속솎손솔솖솜솝솟송솥솨솩솬솰솽쇄쇈쇌쇔쇗쇘쇠쇤쇨쇰쇱쇳쇼쇽숀숄숌숍숏숑수숙순숟술숨숩숫숭\"],\n[\"bd41\",\"폗폙\",7,\"폢폤\",7,\"폮폯폱폲폳폵폶폷\"],\n[\"bd61\",\"폸폹폺폻폾퐀퐂\",5,\"퐉\",13],\n[\"bd81\",\"퐗\",5,\"퐞\",25,\"숯숱숲숴쉈쉐쉑쉔쉘쉠쉥쉬쉭쉰쉴쉼쉽쉿슁슈슉슐슘슛슝스슥슨슬슭슴습슷승시식신싣실싫심십싯싱싶싸싹싻싼쌀쌈쌉쌌쌍쌓쌔쌕쌘쌜쌤쌥쌨쌩썅써썩썬썰썲썸썹썼썽쎄쎈쎌쏀쏘쏙쏜쏟쏠쏢쏨쏩쏭쏴쏵쏸쐈쐐쐤쐬쐰\"],\n[\"be41\",\"퐸\",7,\"푁푂푃푅\",14],\n[\"be61\",\"푔\",7,\"푝푞푟푡푢푣푥\",7,\"푮푰푱푲\"],\n[\"be81\",\"푳\",4,\"푺푻푽푾풁풃\",4,\"풊풌풎\",5,\"풕\",8,\"쐴쐼쐽쑈쑤쑥쑨쑬쑴쑵쑹쒀쒔쒜쒸쒼쓩쓰쓱쓴쓸쓺쓿씀씁씌씐씔씜씨씩씬씰씸씹씻씽아악안앉않알앍앎앓암압앗았앙앝앞애액앤앨앰앱앳앴앵야약얀얄얇얌얍얏양얕얗얘얜얠얩어억언얹얻얼얽얾엄\",6,\"엌엎\"],\n[\"bf41\",\"풞\",10,\"풪\",14],\n[\"bf61\",\"풹\",18,\"퓍퓎퓏퓑퓒퓓퓕\"],\n[\"bf81\",\"퓖\",5,\"퓝퓞퓠\",7,\"퓩퓪퓫퓭퓮퓯퓱\",6,\"퓹퓺퓼에엑엔엘엠엡엣엥여역엮연열엶엷염\",5,\"옅옆옇예옌옐옘옙옛옜오옥온올옭옮옰옳옴옵옷옹옻와왁완왈왐왑왓왔왕왜왝왠왬왯왱외왹왼욀욈욉욋욍요욕욘욜욤욥욧용우욱운울욹욺움웁웃웅워웍원월웜웝웠웡웨\"],\n[\"c041\",\"퓾\",5,\"픅픆픇픉픊픋픍\",6,\"픖픘\",5],\n[\"c061\",\"픞\",25],\n[\"c081\",\"픸픹픺픻픾픿핁핂핃핅\",6,\"핎핐핒\",5,\"핚핛핝핞핟핡핢핣웩웬웰웸웹웽위윅윈윌윔윕윗윙유육윤율윰윱윳융윷으윽은을읊음읍읏응\",7,\"읜읠읨읫이익인일읽읾잃임입잇있잉잊잎자작잔잖잗잘잚잠잡잣잤장잦재잭잰잴잼잽잿쟀쟁쟈쟉쟌쟎쟐쟘쟝쟤쟨쟬저적전절젊\"],\n[\"c141\",\"핤핦핧핪핬핮\",5,\"핶핷핹핺핻핽\",6,\"햆햊햋\"],\n[\"c161\",\"햌햍햎햏햑\",19,\"햦햧\"],\n[\"c181\",\"햨\",31,\"점접젓정젖제젝젠젤젬젭젯젱져젼졀졈졉졌졍졔조족존졸졺좀좁좃종좆좇좋좌좍좔좝좟좡좨좼좽죄죈죌죔죕죗죙죠죡죤죵주죽준줄줅줆줌줍줏중줘줬줴쥐쥑쥔쥘쥠쥡쥣쥬쥰쥴쥼즈즉즌즐즘즙즛증지직진짇질짊짐집짓\"],\n[\"c241\",\"헊헋헍헎헏헑헓\",4,\"헚헜헞\",5,\"헦헧헩헪헫헭헮\"],\n[\"c261\",\"헯\",4,\"헶헸헺\",5,\"혂혃혅혆혇혉\",6,\"혒\"],\n[\"c281\",\"혖\",5,\"혝혞혟혡혢혣혥\",7,\"혮\",9,\"혺혻징짖짙짚짜짝짠짢짤짧짬짭짯짰짱째짹짼쨀쨈쨉쨋쨌쨍쨔쨘쨩쩌쩍쩐쩔쩜쩝쩟쩠쩡쩨쩽쪄쪘쪼쪽쫀쫄쫌쫍쫏쫑쫓쫘쫙쫠쫬쫴쬈쬐쬔쬘쬠쬡쭁쭈쭉쭌쭐쭘쭙쭝쭤쭸쭹쮜쮸쯔쯤쯧쯩찌찍찐찔찜찝찡찢찧차착찬찮찰참찹찻\"],\n[\"c341\",\"혽혾혿홁홂홃홄홆홇홊홌홎홏홐홒홓홖홗홙홚홛홝\",4],\n[\"c361\",\"홢\",4,\"홨홪\",5,\"홲홳홵\",11],\n[\"c381\",\"횁횂횄횆\",5,\"횎횏횑횒횓횕\",7,\"횞횠횢\",5,\"횩횪찼창찾채책챈챌챔챕챗챘챙챠챤챦챨챰챵처척천철첨첩첫첬청체첵첸첼쳄쳅쳇쳉쳐쳔쳤쳬쳰촁초촉촌촐촘촙촛총촤촨촬촹최쵠쵤쵬쵭쵯쵱쵸춈추축춘출춤춥춧충춰췄췌췐취췬췰췸췹췻췽츄츈츌츔츙츠측츤츨츰츱츳층\"],\n[\"c441\",\"횫횭횮횯횱\",7,\"횺횼\",7,\"훆훇훉훊훋\"],\n[\"c461\",\"훍훎훏훐훒훓훕훖훘훚\",5,\"훡훢훣훥훦훧훩\",4],\n[\"c481\",\"훮훯훱훲훳훴훶\",5,\"훾훿휁휂휃휅\",11,\"휒휓휔치칙친칟칠칡침칩칫칭카칵칸칼캄캅캇캉캐캑캔캘캠캡캣캤캥캬캭컁커컥컨컫컬컴컵컷컸컹케켁켄켈켐켑켓켕켜켠켤켬켭켯켰켱켸코콕콘콜콤콥콧콩콰콱콴콸쾀쾅쾌쾡쾨쾰쿄쿠쿡쿤쿨쿰쿱쿳쿵쿼퀀퀄퀑퀘퀭퀴퀵퀸퀼\"],\n[\"c541\",\"휕휖휗휚휛휝휞휟휡\",6,\"휪휬휮\",5,\"휶휷휹\"],\n[\"c561\",\"휺휻휽\",6,\"흅흆흈흊\",5,\"흒흓흕흚\",4],\n[\"c581\",\"흟흢흤흦흧흨흪흫흭흮흯흱흲흳흵\",6,\"흾흿힀힂\",5,\"힊힋큄큅큇큉큐큔큘큠크큭큰클큼큽킁키킥킨킬킴킵킷킹타탁탄탈탉탐탑탓탔탕태택탠탤탬탭탯탰탱탸턍터턱턴털턺텀텁텃텄텅테텍텐텔템텝텟텡텨텬텼톄톈토톡톤톨톰톱톳통톺톼퇀퇘퇴퇸툇툉툐투툭툰툴툼툽툿퉁퉈퉜\"],\n[\"c641\",\"힍힎힏힑\",6,\"힚힜힞\",5],\n[\"c6a1\",\"퉤튀튁튄튈튐튑튕튜튠튤튬튱트특튼튿틀틂틈틉틋틔틘틜틤틥티틱틴틸팀팁팃팅파팍팎판팔팖팜팝팟팠팡팥패팩팬팰팸팹팻팼팽퍄퍅퍼퍽펀펄펌펍펏펐펑페펙펜펠펨펩펫펭펴편펼폄폅폈평폐폘폡폣포폭폰폴폼폽폿퐁\"],\n[\"c7a1\",\"퐈퐝푀푄표푠푤푭푯푸푹푼푿풀풂품풉풋풍풔풩퓌퓐퓔퓜퓟퓨퓬퓰퓸퓻퓽프픈플픔픕픗피픽핀필핌핍핏핑하학한할핥함합핫항해핵핸핼햄햅햇했행햐향허헉헌헐헒험헙헛헝헤헥헨헬헴헵헷헹혀혁현혈혐협혓혔형혜혠\"],\n[\"c8a1\",\"혤혭호혹혼홀홅홈홉홋홍홑화확환활홧황홰홱홴횃횅회획횐횔횝횟횡효횬횰횹횻후훅훈훌훑훔훗훙훠훤훨훰훵훼훽휀휄휑휘휙휜휠휨휩휫휭휴휵휸휼흄흇흉흐흑흔흖흗흘흙흠흡흣흥흩희흰흴흼흽힁히힉힌힐힘힙힛힝\"],\n[\"caa1\",\"伽佳假價加可呵哥嘉嫁家暇架枷柯歌珂痂稼苛茄街袈訶賈跏軻迦駕刻却各恪慤殼珏脚覺角閣侃刊墾奸姦干幹懇揀杆柬桿澗癎看磵稈竿簡肝艮艱諫間乫喝曷渴碣竭葛褐蝎鞨勘坎堪嵌感憾戡敢柑橄減甘疳監瞰紺邯鑑鑒龕\"],\n[\"cba1\",\"匣岬甲胛鉀閘剛堈姜岡崗康强彊慷江畺疆糠絳綱羌腔舡薑襁講鋼降鱇介价個凱塏愷愾慨改槪漑疥皆盖箇芥蓋豈鎧開喀客坑更粳羹醵倨去居巨拒据據擧渠炬祛距踞車遽鉅鋸乾件健巾建愆楗腱虔蹇鍵騫乞傑杰桀儉劍劒檢\"],\n[\"cca1\",\"瞼鈐黔劫怯迲偈憩揭擊格檄激膈覡隔堅牽犬甄絹繭肩見譴遣鵑抉決潔結缺訣兼慊箝謙鉗鎌京俓倞傾儆勁勍卿坰境庚徑慶憬擎敬景暻更梗涇炅烱璟璥瓊痙硬磬竟競絅經耕耿脛莖警輕逕鏡頃頸驚鯨係啓堺契季屆悸戒桂械\"],\n[\"cda1\",\"棨溪界癸磎稽系繫繼計誡谿階鷄古叩告呱固姑孤尻庫拷攷故敲暠枯槁沽痼皐睾稿羔考股膏苦苽菰藁蠱袴誥賈辜錮雇顧高鼓哭斛曲梏穀谷鵠困坤崑昆梱棍滾琨袞鯤汨滑骨供公共功孔工恐恭拱控攻珙空蚣貢鞏串寡戈果瓜\"],\n[\"cea1\",\"科菓誇課跨過鍋顆廓槨藿郭串冠官寬慣棺款灌琯瓘管罐菅觀貫關館刮恝括适侊光匡壙廣曠洸炚狂珖筐胱鑛卦掛罫乖傀塊壞怪愧拐槐魁宏紘肱轟交僑咬喬嬌嶠巧攪敎校橋狡皎矯絞翹膠蕎蛟較轎郊餃驕鮫丘久九仇俱具勾\"],\n[\"cfa1\",\"區口句咎嘔坵垢寇嶇廐懼拘救枸柩構歐毆毬求溝灸狗玖球瞿矩究絿耉臼舅舊苟衢謳購軀逑邱鉤銶駒驅鳩鷗龜國局菊鞠鞫麴君窘群裙軍郡堀屈掘窟宮弓穹窮芎躬倦券勸卷圈拳捲權淃眷厥獗蕨蹶闕机櫃潰詭軌饋句晷歸貴\"],\n[\"d0a1\",\"鬼龜叫圭奎揆槻珪硅窺竅糾葵規赳逵閨勻均畇筠菌鈞龜橘克剋劇戟棘極隙僅劤勤懃斤根槿瑾筋芹菫覲謹近饉契今妗擒昑檎琴禁禽芩衾衿襟金錦伋及急扱汲級給亘兢矜肯企伎其冀嗜器圻基埼夔奇妓寄岐崎己幾忌技旗旣\"],\n[\"d1a1\",\"朞期杞棋棄機欺氣汽沂淇玘琦琪璂璣畸畿碁磯祁祇祈祺箕紀綺羈耆耭肌記譏豈起錡錤飢饑騎騏驥麒緊佶吉拮桔金喫儺喇奈娜懦懶拏拿癩\",5,\"那樂\",4,\"諾酪駱亂卵暖欄煖爛蘭難鸞捏捺南嵐枏楠湳濫男藍襤拉\"],\n[\"d2a1\",\"納臘蠟衲囊娘廊\",4,\"乃來內奈柰耐冷女年撚秊念恬拈捻寧寗努勞奴弩怒擄櫓爐瑙盧\",5,\"駑魯\",10,\"濃籠聾膿農惱牢磊腦賂雷尿壘\",7,\"嫩訥杻紐勒\",5,\"能菱陵尼泥匿溺多茶\"],\n[\"d3a1\",\"丹亶但單團壇彖斷旦檀段湍短端簞緞蛋袒鄲鍛撻澾獺疸達啖坍憺擔曇淡湛潭澹痰聃膽蕁覃談譚錟沓畓答踏遝唐堂塘幢戇撞棠當糖螳黨代垈坮大對岱帶待戴擡玳臺袋貸隊黛宅德悳倒刀到圖堵塗導屠島嶋度徒悼挑掉搗桃\"],\n[\"d4a1\",\"棹櫂淘渡滔濤燾盜睹禱稻萄覩賭跳蹈逃途道都鍍陶韜毒瀆牘犢獨督禿篤纛讀墩惇敦旽暾沌焞燉豚頓乭突仝冬凍動同憧東桐棟洞潼疼瞳童胴董銅兜斗杜枓痘竇荳讀豆逗頭屯臀芚遁遯鈍得嶝橙燈登等藤謄鄧騰喇懶拏癩羅\"],\n[\"d5a1\",\"蘿螺裸邏樂洛烙珞絡落諾酪駱丹亂卵欄欒瀾爛蘭鸞剌辣嵐擥攬欖濫籃纜藍襤覽拉臘蠟廊朗浪狼琅瑯螂郞來崍徠萊冷掠略亮倆兩凉梁樑粮粱糧良諒輛量侶儷勵呂廬慮戾旅櫚濾礪藜蠣閭驢驪麗黎力曆歷瀝礫轢靂憐戀攣漣\"],\n[\"d6a1\",\"煉璉練聯蓮輦連鍊冽列劣洌烈裂廉斂殮濂簾獵令伶囹寧岺嶺怜玲笭羚翎聆逞鈴零靈領齡例澧禮醴隷勞怒撈擄櫓潞瀘爐盧老蘆虜路輅露魯鷺鹵碌祿綠菉錄鹿麓論壟弄朧瀧瓏籠聾儡瀨牢磊賂賚賴雷了僚寮廖料燎療瞭聊蓼\"],\n[\"d7a1\",\"遼鬧龍壘婁屢樓淚漏瘻累縷蔞褸鏤陋劉旒柳榴流溜瀏琉瑠留瘤硫謬類六戮陸侖倫崙淪綸輪律慄栗率隆勒肋凜凌楞稜綾菱陵俚利厘吏唎履悧李梨浬犁狸理璃異痢籬罹羸莉裏裡里釐離鯉吝潾燐璘藺躪隣鱗麟林淋琳臨霖砬\"],\n[\"d8a1\",\"立笠粒摩瑪痲碼磨馬魔麻寞幕漠膜莫邈万卍娩巒彎慢挽晩曼滿漫灣瞞萬蔓蠻輓饅鰻唜抹末沫茉襪靺亡妄忘忙望網罔芒茫莽輞邙埋妹媒寐昧枚梅每煤罵買賣邁魅脈貊陌驀麥孟氓猛盲盟萌冪覓免冕勉棉沔眄眠綿緬面麵滅\"],\n[\"d9a1\",\"蔑冥名命明暝椧溟皿瞑茗蓂螟酩銘鳴袂侮冒募姆帽慕摸摹暮某模母毛牟牡瑁眸矛耗芼茅謀謨貌木沐牧目睦穆鶩歿沒夢朦蒙卯墓妙廟描昴杳渺猫竗苗錨務巫憮懋戊拇撫无楙武毋無珷畝繆舞茂蕪誣貿霧鵡墨默們刎吻問文\"],\n[\"daa1\",\"汶紊紋聞蚊門雯勿沕物味媚尾嵋彌微未梶楣渼湄眉米美薇謎迷靡黴岷悶愍憫敏旻旼民泯玟珉緡閔密蜜謐剝博拍搏撲朴樸泊珀璞箔粕縛膊舶薄迫雹駁伴半反叛拌搬攀斑槃泮潘班畔瘢盤盼磐磻礬絆般蟠返頒飯勃拔撥渤潑\"],\n[\"dba1\",\"發跋醱鉢髮魃倣傍坊妨尨幇彷房放方旁昉枋榜滂磅紡肪膀舫芳蒡蚌訪謗邦防龐倍俳北培徘拜排杯湃焙盃背胚裴裵褙賠輩配陪伯佰帛柏栢白百魄幡樊煩燔番磻繁蕃藩飜伐筏罰閥凡帆梵氾汎泛犯範范法琺僻劈壁擘檗璧癖\"],\n[\"dca1\",\"碧蘗闢霹便卞弁變辨辯邊別瞥鱉鼈丙倂兵屛幷昞昺柄棅炳甁病秉竝輧餠騈保堡報寶普步洑湺潽珤甫菩補褓譜輔伏僕匐卜宓復服福腹茯蔔複覆輹輻馥鰒本乶俸奉封峯峰捧棒烽熢琫縫蓬蜂逢鋒鳳不付俯傅剖副否咐埠夫婦\"],\n[\"dda1\",\"孚孵富府復扶敷斧浮溥父符簿缶腐腑膚艀芙莩訃負賦賻赴趺部釜阜附駙鳧北分吩噴墳奔奮忿憤扮昐汾焚盆粉糞紛芬賁雰不佛弗彿拂崩朋棚硼繃鵬丕備匕匪卑妃婢庇悲憊扉批斐枇榧比毖毗毘沸泌琵痺砒碑秕秘粃緋翡肥\"],\n[\"dea1\",\"脾臂菲蜚裨誹譬費鄙非飛鼻嚬嬪彬斌檳殯浜濱瀕牝玭貧賓頻憑氷聘騁乍事些仕伺似使俟僿史司唆嗣四士奢娑寫寺射巳師徙思捨斜斯柶査梭死沙泗渣瀉獅砂社祀祠私篩紗絲肆舍莎蓑蛇裟詐詞謝賜赦辭邪飼駟麝削數朔索\"],\n[\"dfa1\",\"傘刪山散汕珊産疝算蒜酸霰乷撒殺煞薩三參杉森渗芟蔘衫揷澁鈒颯上傷像償商喪嘗孀尙峠常床庠廂想桑橡湘爽牀狀相祥箱翔裳觴詳象賞霜塞璽賽嗇塞穡索色牲生甥省笙墅壻嶼序庶徐恕抒捿敍暑曙書栖棲犀瑞筮絮緖署\"],\n[\"e0a1\",\"胥舒薯西誓逝鋤黍鼠夕奭席惜昔晳析汐淅潟石碩蓆釋錫仙僊先善嬋宣扇敾旋渲煽琁瑄璇璿癬禪線繕羨腺膳船蘚蟬詵跣選銑鐥饍鮮卨屑楔泄洩渫舌薛褻設說雪齧剡暹殲纖蟾贍閃陝攝涉燮葉城姓宬性惺成星晟猩珹盛省筬\"],\n[\"e1a1\",\"聖聲腥誠醒世勢歲洗稅笹細說貰召嘯塑宵小少巢所掃搔昭梳沼消溯瀟炤燒甦疏疎瘙笑篠簫素紹蔬蕭蘇訴逍遡邵銷韶騷俗屬束涑粟續謖贖速孫巽損蓀遜飡率宋悚松淞訟誦送頌刷殺灑碎鎖衰釗修受嗽囚垂壽嫂守岫峀帥愁\"],\n[\"e2a1\",\"戍手授搜收數樹殊水洙漱燧狩獸琇璲瘦睡秀穗竪粹綏綬繡羞脩茱蒐蓚藪袖誰讐輸遂邃酬銖銹隋隧隨雖需須首髓鬚叔塾夙孰宿淑潚熟琡璹肅菽巡徇循恂旬栒楯橓殉洵淳珣盾瞬筍純脣舜荀蓴蕣詢諄醇錞順馴戌術述鉥崇崧\"],\n[\"e3a1\",\"嵩瑟膝蝨濕拾習褶襲丞乘僧勝升承昇繩蠅陞侍匙嘶始媤尸屎屍市弑恃施是時枾柴猜矢示翅蒔蓍視試詩諡豕豺埴寔式息拭植殖湜熄篒蝕識軾食飾伸侁信呻娠宸愼新晨燼申神紳腎臣莘薪藎蜃訊身辛辰迅失室實悉審尋心沁\"],\n[\"e4a1\",\"沈深瀋甚芯諶什十拾雙氏亞俄兒啞娥峨我牙芽莪蛾衙訝阿雅餓鴉鵝堊岳嶽幄惡愕握樂渥鄂鍔顎鰐齷安岸按晏案眼雁鞍顔鮟斡謁軋閼唵岩巖庵暗癌菴闇壓押狎鴨仰央怏昻殃秧鴦厓哀埃崖愛曖涯碍艾隘靄厄扼掖液縊腋額\"],\n[\"e5a1\",\"櫻罌鶯鸚也倻冶夜惹揶椰爺耶若野弱掠略約若葯蒻藥躍亮佯兩凉壤孃恙揚攘敭暘梁楊樣洋瀁煬痒瘍禳穰糧羊良襄諒讓釀陽量養圄御於漁瘀禦語馭魚齬億憶抑檍臆偃堰彦焉言諺孼蘖俺儼嚴奄掩淹嶪業円予余勵呂女如廬\"],\n[\"e6a1\",\"旅歟汝濾璵礖礪與艅茹輿轝閭餘驪麗黎亦力域役易曆歷疫繹譯轢逆驛嚥堧姸娟宴年延憐戀捐挻撚椽沇沿涎涓淵演漣烟然煙煉燃燕璉硏硯秊筵緣練縯聯衍軟輦蓮連鉛鍊鳶列劣咽悅涅烈熱裂說閱厭廉念捻染殮炎焰琰艶苒\"],\n[\"e7a1\",\"簾閻髥鹽曄獵燁葉令囹塋寧嶺嶸影怜映暎楹榮永泳渶潁濚瀛瀯煐營獰玲瑛瑩瓔盈穎纓羚聆英詠迎鈴鍈零霙靈領乂倪例刈叡曳汭濊猊睿穢芮藝蘂禮裔詣譽豫醴銳隸霓預五伍俉傲午吾吳嗚塢墺奧娛寤悟惡懊敖旿晤梧汚澳\"],\n[\"e8a1\",\"烏熬獒筽蜈誤鰲鼇屋沃獄玉鈺溫瑥瘟穩縕蘊兀壅擁瓮甕癰翁邕雍饔渦瓦窩窪臥蛙蝸訛婉完宛梡椀浣玩琓琬碗緩翫脘腕莞豌阮頑曰往旺枉汪王倭娃歪矮外嵬巍猥畏了僚僥凹堯夭妖姚寥寮尿嶢拗搖撓擾料曜樂橈燎燿瑤療\"],\n[\"e9a1\",\"窈窯繇繞耀腰蓼蟯要謠遙遼邀饒慾欲浴縟褥辱俑傭冗勇埇墉容庸慂榕涌湧溶熔瑢用甬聳茸蓉踊鎔鏞龍于佑偶優又友右宇寓尤愚憂旴牛玗瑀盂祐禑禹紆羽芋藕虞迂遇郵釪隅雨雩勖彧旭昱栯煜稶郁頊云暈橒殞澐熉耘芸蕓\"],\n[\"eaa1\",\"運隕雲韻蔚鬱亐熊雄元原員圓園垣媛嫄寃怨愿援沅洹湲源爰猿瑗苑袁轅遠阮院願鴛月越鉞位偉僞危圍委威尉慰暐渭爲瑋緯胃萎葦蔿蝟衛褘謂違韋魏乳侑儒兪劉唯喩孺宥幼幽庾悠惟愈愉揄攸有杻柔柚柳楡楢油洧流游溜\"],\n[\"eba1\",\"濡猶猷琉瑜由留癒硫紐維臾萸裕誘諛諭踰蹂遊逾遺酉釉鍮類六堉戮毓肉育陸倫允奫尹崙淪潤玧胤贇輪鈗閏律慄栗率聿戎瀜絨融隆垠恩慇殷誾銀隱乙吟淫蔭陰音飮揖泣邑凝應膺鷹依倚儀宜意懿擬椅毅疑矣義艤薏蟻衣誼\"],\n[\"eca1\",\"議醫二以伊利吏夷姨履已弛彛怡易李梨泥爾珥理異痍痢移罹而耳肄苡荑裏裡貽貳邇里離飴餌匿溺瀷益翊翌翼謚人仁刃印吝咽因姻寅引忍湮燐璘絪茵藺蚓認隣靭靷鱗麟一佚佾壹日溢逸鎰馹任壬妊姙恁林淋稔臨荏賃入卄\"],\n[\"eda1\",\"立笠粒仍剩孕芿仔刺咨姉姿子字孜恣慈滋炙煮玆瓷疵磁紫者自茨蔗藉諮資雌作勺嚼斫昨灼炸爵綽芍酌雀鵲孱棧殘潺盞岑暫潛箴簪蠶雜丈仗匠場墻壯奬將帳庄張掌暲杖樟檣欌漿牆狀獐璋章粧腸臟臧莊葬蔣薔藏裝贓醬長\"],\n[\"eea1\",\"障再哉在宰才材栽梓渽滓災縡裁財載齋齎爭箏諍錚佇低儲咀姐底抵杵楮樗沮渚狙猪疽箸紵苧菹著藷詛貯躇這邸雎齟勣吊嫡寂摘敵滴狄炙的積笛籍績翟荻謫賊赤跡蹟迪迹適鏑佃佺傳全典前剪塡塼奠專展廛悛戰栓殿氈澱\"],\n[\"efa1\",\"煎琠田甸畑癲筌箋箭篆纏詮輾轉鈿銓錢鐫電顚顫餞切截折浙癤竊節絶占岾店漸点粘霑鮎點接摺蝶丁井亭停偵呈姃定幀庭廷征情挺政整旌晶晸柾楨檉正汀淀淨渟湞瀞炡玎珽町睛碇禎程穽精綎艇訂諪貞鄭酊釘鉦鋌錠霆靖\"],\n[\"f0a1\",\"靜頂鼎制劑啼堤帝弟悌提梯濟祭第臍薺製諸蹄醍除際霽題齊俎兆凋助嘲弔彫措操早晁曺曹朝條棗槽漕潮照燥爪璪眺祖祚租稠窕粗糟組繰肇藻蚤詔調趙躁造遭釣阻雕鳥族簇足鏃存尊卒拙猝倧宗從悰慫棕淙琮種終綜縱腫\"],\n[\"f1a1\",\"踪踵鍾鐘佐坐左座挫罪主住侏做姝胄呪周嗾奏宙州廚晝朱柱株注洲湊澍炷珠疇籌紂紬綢舟蛛註誅走躊輳週酎酒鑄駐竹粥俊儁准埈寯峻晙樽浚準濬焌畯竣蠢逡遵雋駿茁中仲衆重卽櫛楫汁葺增憎曾拯烝甑症繒蒸證贈之只\"],\n[\"f2a1\",\"咫地址志持指摯支旨智枝枳止池沚漬知砥祉祗紙肢脂至芝芷蜘誌識贄趾遲直稙稷織職唇嗔塵振搢晉晋桭榛殄津溱珍瑨璡畛疹盡眞瞋秦縉縝臻蔯袗診賑軫辰進鎭陣陳震侄叱姪嫉帙桎瓆疾秩窒膣蛭質跌迭斟朕什執潗緝輯\"],\n[\"f3a1\",\"鏶集徵懲澄且侘借叉嗟嵯差次此磋箚茶蹉車遮捉搾着窄錯鑿齪撰澯燦璨瓚竄簒纂粲纘讚贊鑽餐饌刹察擦札紮僭參塹慘慙懺斬站讒讖倉倡創唱娼廠彰愴敞昌昶暢槍滄漲猖瘡窓脹艙菖蒼債埰寀寨彩採砦綵菜蔡采釵冊柵策\"],\n[\"f4a1\",\"責凄妻悽處倜刺剔尺慽戚拓擲斥滌瘠脊蹠陟隻仟千喘天川擅泉淺玔穿舛薦賤踐遷釧闡阡韆凸哲喆徹撤澈綴輟轍鐵僉尖沾添甛瞻簽籤詹諂堞妾帖捷牒疊睫諜貼輒廳晴淸聽菁請靑鯖切剃替涕滯締諦逮遞體初剿哨憔抄招梢\"],\n[\"f5a1\",\"椒楚樵炒焦硝礁礎秒稍肖艸苕草蕉貂超酢醋醮促囑燭矗蜀觸寸忖村邨叢塚寵悤憁摠總聰蔥銃撮催崔最墜抽推椎楸樞湫皺秋芻萩諏趨追鄒酋醜錐錘鎚雛騶鰍丑畜祝竺筑築縮蓄蹙蹴軸逐春椿瑃出朮黜充忠沖蟲衝衷悴膵萃\"],\n[\"f6a1\",\"贅取吹嘴娶就炊翠聚脆臭趣醉驟鷲側仄厠惻測層侈値嗤峙幟恥梔治淄熾痔痴癡稚穉緇緻置致蚩輜雉馳齒則勅飭親七柒漆侵寢枕沈浸琛砧針鍼蟄秤稱快他咤唾墮妥惰打拖朶楕舵陀馱駝倬卓啄坼度托拓擢晫柝濁濯琢琸託\"],\n[\"f7a1\",\"鐸呑嘆坦彈憚歎灘炭綻誕奪脫探眈耽貪塔搭榻宕帑湯糖蕩兌台太怠態殆汰泰笞胎苔跆邰颱宅擇澤撑攄兎吐土討慟桶洞痛筒統通堆槌腿褪退頹偸套妬投透鬪慝特闖坡婆巴把播擺杷波派爬琶破罷芭跛頗判坂板版瓣販辦鈑\"],\n[\"f8a1\",\"阪八叭捌佩唄悖敗沛浿牌狽稗覇貝彭澎烹膨愎便偏扁片篇編翩遍鞭騙貶坪平枰萍評吠嬖幣廢弊斃肺蔽閉陛佈包匍匏咆哺圃布怖抛抱捕暴泡浦疱砲胞脯苞葡蒲袍褒逋鋪飽鮑幅暴曝瀑爆輻俵剽彪慓杓標漂瓢票表豹飇飄驃\"],\n[\"f9a1\",\"品稟楓諷豊風馮彼披疲皮被避陂匹弼必泌珌畢疋筆苾馝乏逼下何厦夏廈昰河瑕荷蝦賀遐霞鰕壑學虐謔鶴寒恨悍旱汗漢澣瀚罕翰閑閒限韓割轄函含咸啣喊檻涵緘艦銜陷鹹合哈盒蛤閤闔陜亢伉姮嫦巷恒抗杭桁沆港缸肛航\"],\n[\"faa1\",\"行降項亥偕咳垓奚孩害懈楷海瀣蟹解該諧邂駭骸劾核倖幸杏荇行享向嚮珦鄕響餉饗香噓墟虛許憲櫶獻軒歇險驗奕爀赫革俔峴弦懸晛泫炫玄玹現眩睍絃絢縣舷衒見賢鉉顯孑穴血頁嫌俠協夾峽挾浹狹脅脇莢鋏頰亨兄刑型\"],\n[\"fba1\",\"形泂滎瀅灐炯熒珩瑩荊螢衡逈邢鎣馨兮彗惠慧暳蕙蹊醯鞋乎互呼壕壺好岵弧戶扈昊晧毫浩淏湖滸澔濠濩灝狐琥瑚瓠皓祜糊縞胡芦葫蒿虎號蝴護豪鎬頀顥惑或酷婚昏混渾琿魂忽惚笏哄弘汞泓洪烘紅虹訌鴻化和嬅樺火畵\"],\n[\"fca1\",\"禍禾花華話譁貨靴廓擴攫確碻穫丸喚奐宦幻患換歡晥桓渙煥環紈還驩鰥活滑猾豁闊凰幌徨恍惶愰慌晃晄榥況湟滉潢煌璜皇篁簧荒蝗遑隍黃匯回廻徊恢悔懷晦會檜淮澮灰獪繪膾茴蛔誨賄劃獲宖橫鐄哮嚆孝效斅曉梟涍淆\"],\n[\"fda1\",\"爻肴酵驍侯候厚后吼喉嗅帿後朽煦珝逅勛勳塤壎焄熏燻薰訓暈薨喧暄煊萱卉喙毁彙徽揮暉煇諱輝麾休携烋畦虧恤譎鷸兇凶匈洶胸黑昕欣炘痕吃屹紇訖欠欽歆吸恰洽翕興僖凞喜噫囍姬嬉希憙憘戱晞曦熙熹熺犧禧稀羲詰\"]\n]\n");
__memMods.set("iconv-lite/encodings/tables/cp950.json", "[\n[\"0\",\"\\u0000\",127],\n[\"a140\",\"　，、。．‧；：？！︰…‥﹐﹑﹒·﹔﹕﹖﹗｜–︱—︳╴︴﹏（）︵︶｛｝︷︸〔〕︹︺【】︻︼《》︽︾〈〉︿﹀「」﹁﹂『』﹃﹄﹙﹚\"],\n[\"a1a1\",\"﹛﹜﹝﹞‘’“”〝〞‵′＃＆＊※§〃○●△▲◎☆★◇◆□■▽▼㊣℅¯￣＿ˍ﹉﹊﹍﹎﹋﹌﹟﹠﹡＋－×÷±√＜＞＝≦≧≠∞≒≡﹢\",4,\"～∩∪⊥∠∟⊿㏒㏑∫∮∵∴♀♂⊕⊙↑↓←→↖↗↙↘∥∣／\"],\n[\"a240\",\"＼∕﹨＄￥〒￠￡％＠℃℉﹩﹪﹫㏕㎜㎝㎞㏎㎡㎎㎏㏄°兙兛兞兝兡兣嗧瓩糎▁\",7,\"▏▎▍▌▋▊▉┼┴┬┤├▔─│▕┌┐└┘╭\"],\n[\"a2a1\",\"╮╰╯═╞╪╡◢◣◥◤╱╲╳０\",9,\"Ⅰ\",9,\"〡\",8,\"十卄卅Ａ\",25,\"ａ\",21],\n[\"a340\",\"ｗｘｙｚΑ\",16,\"Σ\",6,\"α\",16,\"σ\",6,\"ㄅ\",10],\n[\"a3a1\",\"ㄐ\",25,\"˙ˉˊˇˋ\"],\n[\"a3e1\",\"€\"],\n[\"a440\",\"一乙丁七乃九了二人儿入八几刀刁力匕十卜又三下丈上丫丸凡久么也乞于亡兀刃勺千叉口土士夕大女子孑孓寸小尢尸山川工己已巳巾干廾弋弓才\"],\n[\"a4a1\",\"丑丐不中丰丹之尹予云井互五亢仁什仃仆仇仍今介仄元允內六兮公冗凶分切刈勻勾勿化匹午升卅卞厄友及反壬天夫太夭孔少尤尺屯巴幻廿弔引心戈戶手扎支文斗斤方日曰月木欠止歹毋比毛氏水火爪父爻片牙牛犬王丙\"],\n[\"a540\",\"世丕且丘主乍乏乎以付仔仕他仗代令仙仞充兄冉冊冬凹出凸刊加功包匆北匝仟半卉卡占卯卮去可古右召叮叩叨叼司叵叫另只史叱台句叭叻四囚外\"],\n[\"a5a1\",\"央失奴奶孕它尼巨巧左市布平幼弁弘弗必戊打扔扒扑斥旦朮本未末札正母民氐永汁汀氾犯玄玉瓜瓦甘生用甩田由甲申疋白皮皿目矛矢石示禾穴立丞丟乒乓乩亙交亦亥仿伉伙伊伕伍伐休伏仲件任仰仳份企伋光兇兆先全\"],\n[\"a640\",\"共再冰列刑划刎刖劣匈匡匠印危吉吏同吊吐吁吋各向名合吃后吆吒因回囝圳地在圭圬圯圩夙多夷夸妄奸妃好她如妁字存宇守宅安寺尖屹州帆并年\"],\n[\"a6a1\",\"式弛忙忖戎戌戍成扣扛托收早旨旬旭曲曳有朽朴朱朵次此死氖汝汗汙江池汐汕污汛汍汎灰牟牝百竹米糸缶羊羽老考而耒耳聿肉肋肌臣自至臼舌舛舟艮色艾虫血行衣西阡串亨位住佇佗佞伴佛何估佐佑伽伺伸佃佔似但佣\"],\n[\"a740\",\"作你伯低伶余佝佈佚兌克免兵冶冷別判利刪刨劫助努劬匣即卵吝吭吞吾否呎吧呆呃吳呈呂君吩告吹吻吸吮吵吶吠吼呀吱含吟听囪困囤囫坊坑址坍\"],\n[\"a7a1\",\"均坎圾坐坏圻壯夾妝妒妨妞妣妙妖妍妤妓妊妥孝孜孚孛完宋宏尬局屁尿尾岐岑岔岌巫希序庇床廷弄弟彤形彷役忘忌志忍忱快忸忪戒我抄抗抖技扶抉扭把扼找批扳抒扯折扮投抓抑抆改攻攸旱更束李杏材村杜杖杞杉杆杠\"],\n[\"a840\",\"杓杗步每求汞沙沁沈沉沅沛汪決沐汰沌汨沖沒汽沃汲汾汴沆汶沍沔沘沂灶灼災灸牢牡牠狄狂玖甬甫男甸皂盯矣私秀禿究系罕肖肓肝肘肛肚育良芒\"],\n[\"a8a1\",\"芋芍見角言谷豆豕貝赤走足身車辛辰迂迆迅迄巡邑邢邪邦那酉釆里防阮阱阪阬並乖乳事些亞享京佯依侍佳使佬供例來侃佰併侈佩佻侖佾侏侑佺兔兒兕兩具其典冽函刻券刷刺到刮制剁劾劻卒協卓卑卦卷卸卹取叔受味呵\"],\n[\"a940\",\"咖呸咕咀呻呷咄咒咆呼咐呱呶和咚呢周咋命咎固垃坷坪坩坡坦坤坼夜奉奇奈奄奔妾妻委妹妮姑姆姐姍始姓姊妯妳姒姅孟孤季宗定官宜宙宛尚屈居\"],\n[\"a9a1\",\"屆岷岡岸岩岫岱岳帘帚帖帕帛帑幸庚店府底庖延弦弧弩往征彿彼忝忠忽念忿怏怔怯怵怖怪怕怡性怩怫怛或戕房戾所承拉拌拄抿拂抹拒招披拓拔拋拈抨抽押拐拙拇拍抵拚抱拘拖拗拆抬拎放斧於旺昔易昌昆昂明昀昏昕昊\"],\n[\"aa40\",\"昇服朋杭枋枕東果杳杷枇枝林杯杰板枉松析杵枚枓杼杪杲欣武歧歿氓氛泣注泳沱泌泥河沽沾沼波沫法泓沸泄油況沮泗泅泱沿治泡泛泊沬泯泜泖泠\"],\n[\"aaa1\",\"炕炎炒炊炙爬爭爸版牧物狀狎狙狗狐玩玨玟玫玥甽疝疙疚的盂盲直知矽社祀祁秉秈空穹竺糾罔羌羋者肺肥肢肱股肫肩肴肪肯臥臾舍芳芝芙芭芽芟芹花芬芥芯芸芣芰芾芷虎虱初表軋迎返近邵邸邱邶采金長門阜陀阿阻附\"],\n[\"ab40\",\"陂隹雨青非亟亭亮信侵侯便俠俑俏保促侶俘俟俊俗侮俐俄係俚俎俞侷兗冒冑冠剎剃削前剌剋則勇勉勃勁匍南卻厚叛咬哀咨哎哉咸咦咳哇哂咽咪品\"],\n[\"aba1\",\"哄哈咯咫咱咻咩咧咿囿垂型垠垣垢城垮垓奕契奏奎奐姜姘姿姣姨娃姥姪姚姦威姻孩宣宦室客宥封屎屏屍屋峙峒巷帝帥帟幽庠度建弈弭彥很待徊律徇後徉怒思怠急怎怨恍恰恨恢恆恃恬恫恪恤扁拜挖按拼拭持拮拽指拱拷\"],\n[\"ac40\",\"拯括拾拴挑挂政故斫施既春昭映昧是星昨昱昤曷柿染柱柔某柬架枯柵柩柯柄柑枴柚查枸柏柞柳枰柙柢柝柒歪殃殆段毒毗氟泉洋洲洪流津洌洱洞洗\"],\n[\"aca1\",\"活洽派洶洛泵洹洧洸洩洮洵洎洫炫為炳炬炯炭炸炮炤爰牲牯牴狩狠狡玷珊玻玲珍珀玳甚甭畏界畎畋疫疤疥疢疣癸皆皇皈盈盆盃盅省盹相眉看盾盼眇矜砂研砌砍祆祉祈祇禹禺科秒秋穿突竿竽籽紂紅紀紉紇約紆缸美羿耄\"],\n[\"ad40\",\"耐耍耑耶胖胥胚胃胄背胡胛胎胞胤胝致舢苧范茅苣苛苦茄若茂茉苒苗英茁苜苔苑苞苓苟苯茆虐虹虻虺衍衫要觔計訂訃貞負赴赳趴軍軌述迦迢迪迥\"],\n[\"ada1\",\"迭迫迤迨郊郎郁郃酋酊重閂限陋陌降面革韋韭音頁風飛食首香乘亳倌倍倣俯倦倥俸倩倖倆值借倚倒們俺倀倔倨俱倡個候倘俳修倭倪俾倫倉兼冤冥冢凍凌准凋剖剜剔剛剝匪卿原厝叟哨唐唁唷哼哥哲唆哺唔哩哭員唉哮哪\"],\n[\"ae40\",\"哦唧唇哽唏圃圄埂埔埋埃堉夏套奘奚娑娘娜娟娛娓姬娠娣娩娥娌娉孫屘宰害家宴宮宵容宸射屑展屐峭峽峻峪峨峰島崁峴差席師庫庭座弱徒徑徐恙\"],\n[\"aea1\",\"恣恥恐恕恭恩息悄悟悚悍悔悌悅悖扇拳挈拿捎挾振捕捂捆捏捉挺捐挽挪挫挨捍捌效敉料旁旅時晉晏晃晒晌晅晁書朔朕朗校核案框桓根桂桔栩梳栗桌桑栽柴桐桀格桃株桅栓栘桁殊殉殷氣氧氨氦氤泰浪涕消涇浦浸海浙涓\"],\n[\"af40\",\"浬涉浮浚浴浩涌涊浹涅浥涔烊烘烤烙烈烏爹特狼狹狽狸狷玆班琉珮珠珪珞畔畝畜畚留疾病症疲疳疽疼疹痂疸皋皰益盍盎眩真眠眨矩砰砧砸砝破砷\"],\n[\"afa1\",\"砥砭砠砟砲祕祐祠祟祖神祝祗祚秤秣秧租秦秩秘窄窈站笆笑粉紡紗紋紊素索純紐紕級紜納紙紛缺罟羔翅翁耆耘耕耙耗耽耿胱脂胰脅胭胴脆胸胳脈能脊胼胯臭臬舀舐航舫舨般芻茫荒荔荊茸荐草茵茴荏茲茹茶茗荀茱茨荃\"],\n[\"b040\",\"虔蚊蚪蚓蚤蚩蚌蚣蚜衰衷袁袂衽衹記訐討訌訕訊託訓訖訏訑豈豺豹財貢起躬軒軔軏辱送逆迷退迺迴逃追逅迸邕郡郝郢酒配酌釘針釗釜釙閃院陣陡\"],\n[\"b0a1\",\"陛陝除陘陞隻飢馬骨高鬥鬲鬼乾偺偽停假偃偌做偉健偶偎偕偵側偷偏倏偯偭兜冕凰剪副勒務勘動匐匏匙匿區匾參曼商啪啦啄啞啡啃啊唱啖問啕唯啤唸售啜唬啣唳啁啗圈國圉域堅堊堆埠埤基堂堵執培夠奢娶婁婉婦婪婀\"],\n[\"b140\",\"娼婢婚婆婊孰寇寅寄寂宿密尉專將屠屜屝崇崆崎崛崖崢崑崩崔崙崤崧崗巢常帶帳帷康庸庶庵庾張強彗彬彩彫得徙從徘御徠徜恿患悉悠您惋悴惦悽\"],\n[\"b1a1\",\"情悻悵惜悼惘惕惆惟悸惚惇戚戛扈掠控捲掖探接捷捧掘措捱掩掉掃掛捫推掄授掙採掬排掏掀捻捩捨捺敝敖救教敗啟敏敘敕敔斜斛斬族旋旌旎晝晚晤晨晦晞曹勗望梁梯梢梓梵桿桶梱梧梗械梃棄梭梆梅梔條梨梟梡梂欲殺\"],\n[\"b240\",\"毫毬氫涎涼淳淙液淡淌淤添淺清淇淋涯淑涮淞淹涸混淵淅淒渚涵淚淫淘淪深淮淨淆淄涪淬涿淦烹焉焊烽烯爽牽犁猜猛猖猓猙率琅琊球理現琍瓠瓶\"],\n[\"b2a1\",\"瓷甜產略畦畢異疏痔痕疵痊痍皎盔盒盛眷眾眼眶眸眺硫硃硎祥票祭移窒窕笠笨笛第符笙笞笮粒粗粕絆絃統紮紹紼絀細紳組累終紲紱缽羞羚翌翎習耜聊聆脯脖脣脫脩脰脤舂舵舷舶船莎莞莘荸莢莖莽莫莒莊莓莉莠荷荻荼\"],\n[\"b340\",\"莆莧處彪蛇蛀蚶蛄蚵蛆蛋蚱蚯蛉術袞袈被袒袖袍袋覓規訪訝訣訥許設訟訛訢豉豚販責貫貨貪貧赧赦趾趺軛軟這逍通逗連速逝逐逕逞造透逢逖逛途\"],\n[\"b3a1\",\"部郭都酗野釵釦釣釧釭釩閉陪陵陳陸陰陴陶陷陬雀雪雩章竟頂頃魚鳥鹵鹿麥麻傢傍傅備傑傀傖傘傚最凱割剴創剩勞勝勛博厥啻喀喧啼喊喝喘喂喜喪喔喇喋喃喳單喟唾喲喚喻喬喱啾喉喫喙圍堯堪場堤堰報堡堝堠壹壺奠\"],\n[\"b440\",\"婷媚婿媒媛媧孳孱寒富寓寐尊尋就嵌嵐崴嵇巽幅帽幀幃幾廊廁廂廄弼彭復循徨惑惡悲悶惠愜愣惺愕惰惻惴慨惱愎惶愉愀愒戟扉掣掌描揀揩揉揆揍\"],\n[\"b4a1\",\"插揣提握揖揭揮捶援揪換摒揚揹敞敦敢散斑斐斯普晰晴晶景暑智晾晷曾替期朝棺棕棠棘棗椅棟棵森棧棹棒棲棣棋棍植椒椎棉棚楮棻款欺欽殘殖殼毯氮氯氬港游湔渡渲湧湊渠渥渣減湛湘渤湖湮渭渦湯渴湍渺測湃渝渾滋\"],\n[\"b540\",\"溉渙湎湣湄湲湩湟焙焚焦焰無然煮焜牌犄犀猶猥猴猩琺琪琳琢琥琵琶琴琯琛琦琨甥甦畫番痢痛痣痙痘痞痠登發皖皓皴盜睏短硝硬硯稍稈程稅稀窘\"],\n[\"b5a1\",\"窗窖童竣等策筆筐筒答筍筋筏筑粟粥絞結絨絕紫絮絲絡給絢絰絳善翔翕耋聒肅腕腔腋腑腎脹腆脾腌腓腴舒舜菩萃菸萍菠菅萋菁華菱菴著萊菰萌菌菽菲菊萸萎萄菜萇菔菟虛蛟蛙蛭蛔蛛蛤蛐蛞街裁裂袱覃視註詠評詞証詁\"],\n[\"b640\",\"詔詛詐詆訴診訶詖象貂貯貼貳貽賁費賀貴買貶貿貸越超趁跎距跋跚跑跌跛跆軻軸軼辜逮逵週逸進逶鄂郵鄉郾酣酥量鈔鈕鈣鈉鈞鈍鈐鈇鈑閔閏開閑\"],\n[\"b6a1\",\"間閒閎隊階隋陽隅隆隍陲隄雁雅雄集雇雯雲韌項順須飧飪飯飩飲飭馮馭黃黍黑亂傭債傲傳僅傾催傷傻傯僇剿剷剽募勦勤勢勣匯嗟嗨嗓嗦嗎嗜嗇嗑嗣嗤嗯嗚嗡嗅嗆嗥嗉園圓塞塑塘塗塚塔填塌塭塊塢塒塋奧嫁嫉嫌媾媽媼\"],\n[\"b740\",\"媳嫂媲嵩嵯幌幹廉廈弒彙徬微愚意慈感想愛惹愁愈慎慌慄慍愾愴愧愍愆愷戡戢搓搾搞搪搭搽搬搏搜搔損搶搖搗搆敬斟新暗暉暇暈暖暄暘暍會榔業\"],\n[\"b7a1\",\"楚楷楠楔極椰概楊楨楫楞楓楹榆楝楣楛歇歲毀殿毓毽溢溯滓溶滂源溝滇滅溥溘溼溺溫滑準溜滄滔溪溧溴煎煙煩煤煉照煜煬煦煌煥煞煆煨煖爺牒猷獅猿猾瑯瑚瑕瑟瑞瑁琿瑙瑛瑜當畸瘀痰瘁痲痱痺痿痴痳盞盟睛睫睦睞督\"],\n[\"b840\",\"睹睪睬睜睥睨睢矮碎碰碗碘碌碉硼碑碓硿祺祿禁萬禽稜稚稠稔稟稞窟窠筷節筠筮筧粱粳粵經絹綑綁綏絛置罩罪署義羨群聖聘肆肄腱腰腸腥腮腳腫\"],\n[\"b8a1\",\"腹腺腦舅艇蒂葷落萱葵葦葫葉葬葛萼萵葡董葩葭葆虞虜號蛹蜓蜈蜇蜀蛾蛻蜂蜃蜆蜊衙裟裔裙補裘裝裡裊裕裒覜解詫該詳試詩詰誇詼詣誠話誅詭詢詮詬詹詻訾詨豢貊貉賊資賈賄貲賃賂賅跡跟跨路跳跺跪跤跦躲較載軾輊\"],\n[\"b940\",\"辟農運遊道遂達逼違遐遇遏過遍遑逾遁鄒鄗酬酪酩釉鈷鉗鈸鈽鉀鈾鉛鉋鉤鉑鈴鉉鉍鉅鈹鈿鉚閘隘隔隕雍雋雉雊雷電雹零靖靴靶預頑頓頊頒頌飼飴\"],\n[\"b9a1\",\"飽飾馳馱馴髡鳩麂鼎鼓鼠僧僮僥僖僭僚僕像僑僱僎僩兢凳劃劂匱厭嗾嘀嘛嘗嗽嘔嘆嘉嘍嘎嗷嘖嘟嘈嘐嗶團圖塵塾境墓墊塹墅塽壽夥夢夤奪奩嫡嫦嫩嫗嫖嫘嫣孵寞寧寡寥實寨寢寤察對屢嶄嶇幛幣幕幗幔廓廖弊彆彰徹慇\"],\n[\"ba40\",\"愿態慷慢慣慟慚慘慵截撇摘摔撤摸摟摺摑摧搴摭摻敲斡旗旖暢暨暝榜榨榕槁榮槓構榛榷榻榫榴槐槍榭槌榦槃榣歉歌氳漳演滾漓滴漩漾漠漬漏漂漢\"],\n[\"baa1\",\"滿滯漆漱漸漲漣漕漫漯澈漪滬漁滲滌滷熔熙煽熊熄熒爾犒犖獄獐瑤瑣瑪瑰瑭甄疑瘧瘍瘋瘉瘓盡監瞄睽睿睡磁碟碧碳碩碣禎福禍種稱窪窩竭端管箕箋筵算箝箔箏箸箇箄粹粽精綻綰綜綽綾綠緊綴網綱綺綢綿綵綸維緒緇綬\"],\n[\"bb40\",\"罰翠翡翟聞聚肇腐膀膏膈膊腿膂臧臺與舔舞艋蓉蒿蓆蓄蒙蒞蒲蒜蓋蒸蓀蓓蒐蒼蓑蓊蜿蜜蜻蜢蜥蜴蜘蝕蜷蜩裳褂裴裹裸製裨褚裯誦誌語誣認誡誓誤\"],\n[\"bba1\",\"說誥誨誘誑誚誧豪貍貌賓賑賒赫趙趕跼輔輒輕輓辣遠遘遜遣遙遞遢遝遛鄙鄘鄞酵酸酷酴鉸銀銅銘銖鉻銓銜銨鉼銑閡閨閩閣閥閤隙障際雌雒需靼鞅韶頗領颯颱餃餅餌餉駁骯骰髦魁魂鳴鳶鳳麼鼻齊億儀僻僵價儂儈儉儅凜\"],\n[\"bc40\",\"劇劈劉劍劊勰厲嘮嘻嘹嘲嘿嘴嘩噓噎噗噴嘶嘯嘰墀墟增墳墜墮墩墦奭嬉嫻嬋嫵嬌嬈寮寬審寫層履嶝嶔幢幟幡廢廚廟廝廣廠彈影德徵慶慧慮慝慕憂\"],\n[\"bca1\",\"慼慰慫慾憧憐憫憎憬憚憤憔憮戮摩摯摹撞撲撈撐撰撥撓撕撩撒撮播撫撚撬撙撢撳敵敷數暮暫暴暱樣樟槨樁樞標槽模樓樊槳樂樅槭樑歐歎殤毅毆漿潼澄潑潦潔澆潭潛潸潮澎潺潰潤澗潘滕潯潠潟熟熬熱熨牖犛獎獗瑩璋璃\"],\n[\"bd40\",\"瑾璀畿瘠瘩瘟瘤瘦瘡瘢皚皺盤瞎瞇瞌瞑瞋磋磅確磊碾磕碼磐稿稼穀稽稷稻窯窮箭箱範箴篆篇篁箠篌糊締練緯緻緘緬緝編緣線緞緩綞緙緲緹罵罷羯\"],\n[\"bda1\",\"翩耦膛膜膝膠膚膘蔗蔽蔚蓮蔬蔭蔓蔑蔣蔡蔔蓬蔥蓿蔆螂蝴蝶蝠蝦蝸蝨蝙蝗蝌蝓衛衝褐複褒褓褕褊誼諒談諄誕請諸課諉諂調誰論諍誶誹諛豌豎豬賠賞賦賤賬賭賢賣賜質賡赭趟趣踫踐踝踢踏踩踟踡踞躺輝輛輟輩輦輪輜輞\"],\n[\"be40\",\"輥適遮遨遭遷鄰鄭鄧鄱醇醉醋醃鋅銻銷鋪銬鋤鋁銳銼鋒鋇鋰銲閭閱霄霆震霉靠鞍鞋鞏頡頫頜颳養餓餒餘駝駐駟駛駑駕駒駙骷髮髯鬧魅魄魷魯鴆鴉\"],\n[\"bea1\",\"鴃麩麾黎墨齒儒儘儔儐儕冀冪凝劑劓勳噙噫噹噩噤噸噪器噥噱噯噬噢噶壁墾壇壅奮嬝嬴學寰導彊憲憑憩憊懍憶憾懊懈戰擅擁擋撻撼據擄擇擂操撿擒擔撾整曆曉暹曄曇暸樽樸樺橙橫橘樹橄橢橡橋橇樵機橈歙歷氅濂澱澡\"],\n[\"bf40\",\"濃澤濁澧澳激澹澶澦澠澴熾燉燐燒燈燕熹燎燙燜燃燄獨璜璣璘璟璞瓢甌甍瘴瘸瘺盧盥瞠瞞瞟瞥磨磚磬磧禦積穎穆穌穋窺篙簑築篤篛篡篩篦糕糖縊\"],\n[\"bfa1\",\"縑縈縛縣縞縝縉縐罹羲翰翱翮耨膳膩膨臻興艘艙蕊蕙蕈蕨蕩蕃蕉蕭蕪蕞螃螟螞螢融衡褪褲褥褫褡親覦諦諺諫諱謀諜諧諮諾謁謂諷諭諳諶諼豫豭貓賴蹄踱踴蹂踹踵輻輯輸輳辨辦遵遴選遲遼遺鄴醒錠錶鋸錳錯錢鋼錫錄錚\"],\n[\"c040\",\"錐錦錡錕錮錙閻隧隨險雕霎霑霖霍霓霏靛靜靦鞘頰頸頻頷頭頹頤餐館餞餛餡餚駭駢駱骸骼髻髭鬨鮑鴕鴣鴦鴨鴒鴛默黔龍龜優償儡儲勵嚎嚀嚐嚅嚇\"],\n[\"c0a1\",\"嚏壕壓壑壎嬰嬪嬤孺尷屨嶼嶺嶽嶸幫彌徽應懂懇懦懋戲戴擎擊擘擠擰擦擬擱擢擭斂斃曙曖檀檔檄檢檜櫛檣橾檗檐檠歜殮毚氈濘濱濟濠濛濤濫濯澀濬濡濩濕濮濰燧營燮燦燥燭燬燴燠爵牆獰獲璩環璦璨癆療癌盪瞳瞪瞰瞬\"],\n[\"c140\",\"瞧瞭矯磷磺磴磯礁禧禪穗窿簇簍篾篷簌篠糠糜糞糢糟糙糝縮績繆縷縲繃縫總縱繅繁縴縹繈縵縿縯罄翳翼聱聲聰聯聳臆臃膺臂臀膿膽臉膾臨舉艱薪\"],\n[\"c1a1\",\"薄蕾薜薑薔薯薛薇薨薊虧蟀蟑螳蟒蟆螫螻螺蟈蟋褻褶襄褸褽覬謎謗謙講謊謠謝謄謐豁谿豳賺賽購賸賻趨蹉蹋蹈蹊轄輾轂轅輿避遽還邁邂邀鄹醣醞醜鍍鎂錨鍵鍊鍥鍋錘鍾鍬鍛鍰鍚鍔闊闋闌闈闆隱隸雖霜霞鞠韓顆颶餵騁\"],\n[\"c240\",\"駿鮮鮫鮪鮭鴻鴿麋黏點黜黝黛鼾齋叢嚕嚮壙壘嬸彝懣戳擴擲擾攆擺擻擷斷曜朦檳檬櫃檻檸櫂檮檯歟歸殯瀉瀋濾瀆濺瀑瀏燻燼燾燸獷獵璧璿甕癖癘\"],\n[\"c2a1\",\"癒瞽瞿瞻瞼礎禮穡穢穠竄竅簫簧簪簞簣簡糧織繕繞繚繡繒繙罈翹翻職聶臍臏舊藏薩藍藐藉薰薺薹薦蟯蟬蟲蟠覆覲觴謨謹謬謫豐贅蹙蹣蹦蹤蹟蹕軀轉轍邇邃邈醫醬釐鎔鎊鎖鎢鎳鎮鎬鎰鎘鎚鎗闔闖闐闕離雜雙雛雞霤鞣鞦\"],\n[\"c340\",\"鞭韹額顏題顎顓颺餾餿餽餮馥騎髁鬃鬆魏魎魍鯊鯉鯽鯈鯀鵑鵝鵠黠鼕鼬儳嚥壞壟壢寵龐廬懲懷懶懵攀攏曠曝櫥櫝櫚櫓瀛瀟瀨瀚瀝瀕瀘爆爍牘犢獸\"],\n[\"c3a1\",\"獺璽瓊瓣疇疆癟癡矇礙禱穫穩簾簿簸簽簷籀繫繭繹繩繪羅繳羶羹羸臘藩藝藪藕藤藥藷蟻蠅蠍蟹蟾襠襟襖襞譁譜識證譚譎譏譆譙贈贊蹼蹲躇蹶蹬蹺蹴轔轎辭邊邋醱醮鏡鏑鏟鏃鏈鏜鏝鏖鏢鏍鏘鏤鏗鏨關隴難霪霧靡韜韻類\"],\n[\"c440\",\"願顛颼饅饉騖騙鬍鯨鯧鯖鯛鶉鵡鵲鵪鵬麒麗麓麴勸嚨嚷嚶嚴嚼壤孀孃孽寶巉懸懺攘攔攙曦朧櫬瀾瀰瀲爐獻瓏癢癥礦礪礬礫竇競籌籃籍糯糰辮繽繼\"],\n[\"c4a1\",\"纂罌耀臚艦藻藹蘑藺蘆蘋蘇蘊蠔蠕襤覺觸議譬警譯譟譫贏贍躉躁躅躂醴釋鐘鐃鏽闡霰飄饒饑馨騫騰騷騵鰓鰍鹹麵黨鼯齟齣齡儷儸囁囀囂夔屬巍懼懾攝攜斕曩櫻欄櫺殲灌爛犧瓖瓔癩矓籐纏續羼蘗蘭蘚蠣蠢蠡蠟襪襬覽譴\"],\n[\"c540\",\"護譽贓躊躍躋轟辯醺鐮鐳鐵鐺鐸鐲鐫闢霸霹露響顧顥饗驅驃驀騾髏魔魑鰭鰥鶯鶴鷂鶸麝黯鼙齜齦齧儼儻囈囊囉孿巔巒彎懿攤權歡灑灘玀瓤疊癮癬\"],\n[\"c5a1\",\"禳籠籟聾聽臟襲襯觼讀贖贗躑躓轡酈鑄鑑鑒霽霾韃韁顫饕驕驍髒鬚鱉鰱鰾鰻鷓鷗鼴齬齪龔囌巖戀攣攫攪曬欐瓚竊籤籣籥纓纖纔臢蘸蘿蠱變邐邏鑣鑠鑤靨顯饜驚驛驗髓體髑鱔鱗鱖鷥麟黴囑壩攬灞癱癲矗罐羈蠶蠹衢讓讒\"],\n[\"c640\",\"讖艷贛釀鑪靂靈靄韆顰驟鬢魘鱟鷹鷺鹼鹽鼇齷齲廳欖灣籬籮蠻觀躡釁鑲鑰顱饞髖鬣黌灤矚讚鑷韉驢驥纜讜躪釅鑽鑾鑼鱷鱸黷豔鑿鸚爨驪鬱鸛鸞籲\"],\n[\"c940\",\"乂乜凵匚厂万丌乇亍囗兀屮彳丏冇与丮亓仂仉仈冘勼卬厹圠夃夬尐巿旡殳毌气爿丱丼仨仜仩仡仝仚刌匜卌圢圣夗夯宁宄尒尻屴屳帄庀庂忉戉扐氕\"],\n[\"c9a1\",\"氶汃氿氻犮犰玊禸肊阞伎优伬仵伔仱伀价伈伝伂伅伢伓伄仴伒冱刓刉刐劦匢匟卍厊吇囡囟圮圪圴夼妀奼妅奻奾奷奿孖尕尥屼屺屻屾巟幵庄异弚彴忕忔忏扜扞扤扡扦扢扙扠扚扥旯旮朾朹朸朻机朿朼朳氘汆汒汜汏汊汔汋\"],\n[\"ca40\",\"汌灱牞犴犵玎甪癿穵网艸艼芀艽艿虍襾邙邗邘邛邔阢阤阠阣佖伻佢佉体佤伾佧佒佟佁佘伭伳伿佡冏冹刜刞刡劭劮匉卣卲厎厏吰吷吪呔呅吙吜吥吘\"],\n[\"caa1\",\"吽呏呁吨吤呇囮囧囥坁坅坌坉坋坒夆奀妦妘妠妗妎妢妐妏妧妡宎宒尨尪岍岏岈岋岉岒岊岆岓岕巠帊帎庋庉庌庈庍弅弝彸彶忒忑忐忭忨忮忳忡忤忣忺忯忷忻怀忴戺抃抌抎抏抔抇扱扻扺扰抁抈扷扽扲扴攷旰旴旳旲旵杅杇\"],\n[\"cb40\",\"杙杕杌杈杝杍杚杋毐氙氚汸汧汫沄沋沏汱汯汩沚汭沇沕沜汦汳汥汻沎灴灺牣犿犽狃狆狁犺狅玕玗玓玔玒町甹疔疕皁礽耴肕肙肐肒肜芐芏芅芎芑芓\"],\n[\"cba1\",\"芊芃芄豸迉辿邟邡邥邞邧邠阰阨阯阭丳侘佼侅佽侀侇佶佴侉侄佷佌侗佪侚佹侁佸侐侜侔侞侒侂侕佫佮冞冼冾刵刲刳剆刱劼匊匋匼厒厔咇呿咁咑咂咈呫呺呾呥呬呴呦咍呯呡呠咘呣呧呤囷囹坯坲坭坫坱坰坶垀坵坻坳坴坢\"],\n[\"cc40\",\"坨坽夌奅妵妺姏姎妲姌姁妶妼姃姖妱妽姀姈妴姇孢孥宓宕屄屇岮岤岠岵岯岨岬岟岣岭岢岪岧岝岥岶岰岦帗帔帙弨弢弣弤彔徂彾彽忞忥怭怦怙怲怋\"],\n[\"cca1\",\"怴怊怗怳怚怞怬怢怍怐怮怓怑怌怉怜戔戽抭抴拑抾抪抶拊抮抳抯抻抩抰抸攽斨斻昉旼昄昒昈旻昃昋昍昅旽昑昐曶朊枅杬枎枒杶杻枘枆构杴枍枌杺枟枑枙枃杽极杸杹枔欥殀歾毞氝沓泬泫泮泙沶泔沭泧沷泐泂沺泃泆泭泲\"],\n[\"cd40\",\"泒泝沴沊沝沀泞泀洰泍泇沰泹泏泩泑炔炘炅炓炆炄炑炖炂炚炃牪狖狋狘狉狜狒狔狚狌狑玤玡玭玦玢玠玬玝瓝瓨甿畀甾疌疘皯盳盱盰盵矸矼矹矻矺\"],\n[\"cda1\",\"矷祂礿秅穸穻竻籵糽耵肏肮肣肸肵肭舠芠苀芫芚芘芛芵芧芮芼芞芺芴芨芡芩苂芤苃芶芢虰虯虭虮豖迒迋迓迍迖迕迗邲邴邯邳邰阹阽阼阺陃俍俅俓侲俉俋俁俔俜俙侻侳俛俇俖侺俀侹俬剄剉勀勂匽卼厗厖厙厘咺咡咭咥哏\"],\n[\"ce40\",\"哃茍咷咮哖咶哅哆咠呰咼咢咾呲哞咰垵垞垟垤垌垗垝垛垔垘垏垙垥垚垕壴复奓姡姞姮娀姱姝姺姽姼姶姤姲姷姛姩姳姵姠姾姴姭宨屌峐峘峌峗峋峛\"],\n[\"cea1\",\"峞峚峉峇峊峖峓峔峏峈峆峎峟峸巹帡帢帣帠帤庰庤庢庛庣庥弇弮彖徆怷怹恔恲恞恅恓恇恉恛恌恀恂恟怤恄恘恦恮扂扃拏挍挋拵挎挃拫拹挏挌拸拶挀挓挔拺挕拻拰敁敃斪斿昶昡昲昵昜昦昢昳昫昺昝昴昹昮朏朐柁柲柈枺\"],\n[\"cf40\",\"柜枻柸柘柀枷柅柫柤柟枵柍枳柷柶柮柣柂枹柎柧柰枲柼柆柭柌枮柦柛柺柉柊柃柪柋欨殂殄殶毖毘毠氠氡洨洴洭洟洼洿洒洊泚洳洄洙洺洚洑洀洝浂\"],\n[\"cfa1\",\"洁洘洷洃洏浀洇洠洬洈洢洉洐炷炟炾炱炰炡炴炵炩牁牉牊牬牰牳牮狊狤狨狫狟狪狦狣玅珌珂珈珅玹玶玵玴珫玿珇玾珃珆玸珋瓬瓮甮畇畈疧疪癹盄眈眃眄眅眊盷盻盺矧矨砆砑砒砅砐砏砎砉砃砓祊祌祋祅祄秕种秏秖秎窀\"],\n[\"d040\",\"穾竑笀笁籺籸籹籿粀粁紃紈紁罘羑羍羾耇耎耏耔耷胘胇胠胑胈胂胐胅胣胙胜胊胕胉胏胗胦胍臿舡芔苙苾苹茇苨茀苕茺苫苖苴苬苡苲苵茌苻苶苰苪\"],\n[\"d0a1\",\"苤苠苺苳苭虷虴虼虳衁衎衧衪衩觓訄訇赲迣迡迮迠郱邽邿郕郅邾郇郋郈釔釓陔陏陑陓陊陎倞倅倇倓倢倰倛俵俴倳倷倬俶俷倗倜倠倧倵倯倱倎党冔冓凊凄凅凈凎剡剚剒剞剟剕剢勍匎厞唦哢唗唒哧哳哤唚哿唄唈哫唑唅哱\"],\n[\"d140\",\"唊哻哷哸哠唎唃唋圁圂埌堲埕埒垺埆垽垼垸垶垿埇埐垹埁夎奊娙娖娭娮娕娏娗娊娞娳孬宧宭宬尃屖屔峬峿峮峱峷崀峹帩帨庨庮庪庬弳弰彧恝恚恧\"],\n[\"d1a1\",\"恁悢悈悀悒悁悝悃悕悛悗悇悜悎戙扆拲挐捖挬捄捅挶捃揤挹捋捊挼挩捁挴捘捔捙挭捇挳捚捑挸捗捀捈敊敆旆旃旄旂晊晟晇晑朒朓栟栚桉栲栳栻桋桏栖栱栜栵栫栭栯桎桄栴栝栒栔栦栨栮桍栺栥栠欬欯欭欱欴歭肂殈毦毤\"],\n[\"d240\",\"毨毣毢毧氥浺浣浤浶洍浡涒浘浢浭浯涑涍淯浿涆浞浧浠涗浰浼浟涂涘洯浨涋浾涀涄洖涃浻浽浵涐烜烓烑烝烋缹烢烗烒烞烠烔烍烅烆烇烚烎烡牂牸\"],\n[\"d2a1\",\"牷牶猀狺狴狾狶狳狻猁珓珙珥珖玼珧珣珩珜珒珛珔珝珚珗珘珨瓞瓟瓴瓵甡畛畟疰痁疻痄痀疿疶疺皊盉眝眛眐眓眒眣眑眕眙眚眢眧砣砬砢砵砯砨砮砫砡砩砳砪砱祔祛祏祜祓祒祑秫秬秠秮秭秪秜秞秝窆窉窅窋窌窊窇竘笐\"],\n[\"d340\",\"笄笓笅笏笈笊笎笉笒粄粑粊粌粈粍粅紞紝紑紎紘紖紓紟紒紏紌罜罡罞罠罝罛羖羒翃翂翀耖耾耹胺胲胹胵脁胻脀舁舯舥茳茭荄茙荑茥荖茿荁茦茜茢\"],\n[\"d3a1\",\"荂荎茛茪茈茼荍茖茤茠茷茯茩荇荅荌荓茞茬荋茧荈虓虒蚢蚨蚖蚍蚑蚞蚇蚗蚆蚋蚚蚅蚥蚙蚡蚧蚕蚘蚎蚝蚐蚔衃衄衭衵衶衲袀衱衿衯袃衾衴衼訒豇豗豻貤貣赶赸趵趷趶軑軓迾迵适迿迻逄迼迶郖郠郙郚郣郟郥郘郛郗郜郤酐\"],\n[\"d440\",\"酎酏釕釢釚陜陟隼飣髟鬯乿偰偪偡偞偠偓偋偝偲偈偍偁偛偊偢倕偅偟偩偫偣偤偆偀偮偳偗偑凐剫剭剬剮勖勓匭厜啵啶唼啍啐唴唪啑啢唶唵唰啒啅\"],\n[\"d4a1\",\"唌唲啥啎唹啈唭唻啀啋圊圇埻堔埢埶埜埴堀埭埽堈埸堋埳埏堇埮埣埲埥埬埡堎埼堐埧堁堌埱埩埰堍堄奜婠婘婕婧婞娸娵婭婐婟婥婬婓婤婗婃婝婒婄婛婈媎娾婍娹婌婰婩婇婑婖婂婜孲孮寁寀屙崞崋崝崚崠崌崨崍崦崥崏\"],\n[\"d540\",\"崰崒崣崟崮帾帴庱庴庹庲庳弶弸徛徖徟悊悐悆悾悰悺惓惔惏惤惙惝惈悱惛悷惊悿惃惍惀挲捥掊掂捽掽掞掭掝掗掫掎捯掇掐据掯捵掜捭掮捼掤挻掟\"],\n[\"d5a1\",\"捸掅掁掑掍捰敓旍晥晡晛晙晜晢朘桹梇梐梜桭桮梮梫楖桯梣梬梩桵桴梲梏桷梒桼桫桲梪梀桱桾梛梖梋梠梉梤桸桻梑梌梊桽欶欳欷欸殑殏殍殎殌氪淀涫涴涳湴涬淩淢涷淶淔渀淈淠淟淖涾淥淜淝淛淴淊涽淭淰涺淕淂淏淉\"],\n[\"d640\",\"淐淲淓淽淗淍淣涻烺焍烷焗烴焌烰焄烳焐烼烿焆焓焀烸烶焋焂焎牾牻牼牿猝猗猇猑猘猊猈狿猏猞玈珶珸珵琄琁珽琇琀珺珼珿琌琋珴琈畤畣痎痒痏\"],\n[\"d6a1\",\"痋痌痑痐皏皉盓眹眯眭眱眲眴眳眽眥眻眵硈硒硉硍硊硌砦硅硐祤祧祩祪祣祫祡离秺秸秶秷窏窔窐笵筇笴笥笰笢笤笳笘笪笝笱笫笭笯笲笸笚笣粔粘粖粣紵紽紸紶紺絅紬紩絁絇紾紿絊紻紨罣羕羜羝羛翊翋翍翐翑翇翏翉耟\"],\n[\"d740\",\"耞耛聇聃聈脘脥脙脛脭脟脬脞脡脕脧脝脢舑舸舳舺舴舲艴莐莣莨莍荺荳莤荴莏莁莕莙荵莔莩荽莃莌莝莛莪莋荾莥莯莈莗莰荿莦莇莮荶莚虙虖蚿蚷\"],\n[\"d7a1\",\"蛂蛁蛅蚺蚰蛈蚹蚳蚸蛌蚴蚻蚼蛃蚽蚾衒袉袕袨袢袪袚袑袡袟袘袧袙袛袗袤袬袌袓袎覂觖觙觕訰訧訬訞谹谻豜豝豽貥赽赻赹趼跂趹趿跁軘軞軝軜軗軠軡逤逋逑逜逌逡郯郪郰郴郲郳郔郫郬郩酖酘酚酓酕釬釴釱釳釸釤釹釪\"],\n[\"d840\",\"釫釷釨釮镺閆閈陼陭陫陱陯隿靪頄飥馗傛傕傔傞傋傣傃傌傎傝偨傜傒傂傇兟凔匒匑厤厧喑喨喥喭啷噅喢喓喈喏喵喁喣喒喤啽喌喦啿喕喡喎圌堩堷\"],\n[\"d8a1\",\"堙堞堧堣堨埵塈堥堜堛堳堿堶堮堹堸堭堬堻奡媯媔媟婺媢媞婸媦婼媥媬媕媮娷媄媊媗媃媋媩婻婽媌媜媏媓媝寪寍寋寔寑寊寎尌尰崷嵃嵫嵁嵋崿崵嵑嵎嵕崳崺嵒崽崱嵙嵂崹嵉崸崼崲崶嵀嵅幄幁彘徦徥徫惉悹惌惢惎惄愔\"],\n[\"d940\",\"惲愊愖愅惵愓惸惼惾惁愃愘愝愐惿愄愋扊掔掱掰揎揥揨揯揃撝揳揊揠揶揕揲揵摡揟掾揝揜揄揘揓揂揇揌揋揈揰揗揙攲敧敪敤敜敨敥斌斝斞斮旐旒\"],\n[\"d9a1\",\"晼晬晻暀晱晹晪晲朁椌棓椄棜椪棬棪棱椏棖棷棫棤棶椓椐棳棡椇棌椈楰梴椑棯棆椔棸棐棽棼棨椋椊椗棎棈棝棞棦棴棑椆棔棩椕椥棇欹欻欿欼殔殗殙殕殽毰毲毳氰淼湆湇渟湉溈渼渽湅湢渫渿湁湝湳渜渳湋湀湑渻渃渮湞\"],\n[\"da40\",\"湨湜湡渱渨湠湱湫渹渢渰湓湥渧湸湤湷湕湹湒湦渵渶湚焠焞焯烻焮焱焣焥焢焲焟焨焺焛牋牚犈犉犆犅犋猒猋猰猢猱猳猧猲猭猦猣猵猌琮琬琰琫琖\"],\n[\"daa1\",\"琚琡琭琱琤琣琝琩琠琲瓻甯畯畬痧痚痡痦痝痟痤痗皕皒盚睆睇睄睍睅睊睎睋睌矞矬硠硤硥硜硭硱硪确硰硩硨硞硢祴祳祲祰稂稊稃稌稄窙竦竤筊笻筄筈筌筎筀筘筅粢粞粨粡絘絯絣絓絖絧絪絏絭絜絫絒絔絩絑絟絎缾缿罥\"],\n[\"db40\",\"罦羢羠羡翗聑聏聐胾胔腃腊腒腏腇脽腍脺臦臮臷臸臹舄舼舽舿艵茻菏菹萣菀菨萒菧菤菼菶萐菆菈菫菣莿萁菝菥菘菿菡菋菎菖菵菉萉萏菞萑萆菂菳\"],\n[\"dba1\",\"菕菺菇菑菪萓菃菬菮菄菻菗菢萛菛菾蛘蛢蛦蛓蛣蛚蛪蛝蛫蛜蛬蛩蛗蛨蛑衈衖衕袺裗袹袸裀袾袶袼袷袽袲褁裉覕覘覗觝觚觛詎詍訹詙詀詗詘詄詅詒詈詑詊詌詏豟貁貀貺貾貰貹貵趄趀趉跘跓跍跇跖跜跏跕跙跈跗跅軯軷軺\"],\n[\"dc40\",\"軹軦軮軥軵軧軨軶軫軱軬軴軩逭逴逯鄆鄬鄄郿郼鄈郹郻鄁鄀鄇鄅鄃酡酤酟酢酠鈁鈊鈥鈃鈚鈦鈏鈌鈀鈒釿釽鈆鈄鈧鈂鈜鈤鈙鈗鈅鈖镻閍閌閐隇陾隈\"],\n[\"dca1\",\"隉隃隀雂雈雃雱雰靬靰靮頇颩飫鳦黹亃亄亶傽傿僆傮僄僊傴僈僂傰僁傺傱僋僉傶傸凗剺剸剻剼嗃嗛嗌嗐嗋嗊嗝嗀嗔嗄嗩喿嗒喍嗏嗕嗢嗖嗈嗲嗍嗙嗂圔塓塨塤塏塍塉塯塕塎塝塙塥塛堽塣塱壼嫇嫄嫋媺媸媱媵媰媿嫈媻嫆\"],\n[\"dd40\",\"媷嫀嫊媴媶嫍媹媐寖寘寙尟尳嵱嵣嵊嵥嵲嵬嵞嵨嵧嵢巰幏幎幊幍幋廅廌廆廋廇彀徯徭惷慉慊愫慅愶愲愮慆愯慏愩慀戠酨戣戥戤揅揱揫搐搒搉搠搤\"],\n[\"dda1\",\"搳摃搟搕搘搹搷搢搣搌搦搰搨摁搵搯搊搚摀搥搧搋揧搛搮搡搎敯斒旓暆暌暕暐暋暊暙暔晸朠楦楟椸楎楢楱椿楅楪椹楂楗楙楺楈楉椵楬椳椽楥棰楸椴楩楀楯楄楶楘楁楴楌椻楋椷楜楏楑椲楒椯楻椼歆歅歃歂歈歁殛嗀毻毼\"],\n[\"de40\",\"毹毷毸溛滖滈溏滀溟溓溔溠溱溹滆滒溽滁溞滉溷溰滍溦滏溲溾滃滜滘溙溒溎溍溤溡溿溳滐滊溗溮溣煇煔煒煣煠煁煝煢煲煸煪煡煂煘煃煋煰煟煐煓\"],\n[\"dea1\",\"煄煍煚牏犍犌犑犐犎猼獂猻猺獀獊獉瑄瑊瑋瑒瑑瑗瑀瑏瑐瑎瑂瑆瑍瑔瓡瓿瓾瓽甝畹畷榃痯瘏瘃痷痾痼痹痸瘐痻痶痭痵痽皙皵盝睕睟睠睒睖睚睩睧睔睙睭矠碇碚碔碏碄碕碅碆碡碃硹碙碀碖硻祼禂祽祹稑稘稙稒稗稕稢稓\"],\n[\"df40\",\"稛稐窣窢窞竫筦筤筭筴筩筲筥筳筱筰筡筸筶筣粲粴粯綈綆綀綍絿綅絺綎絻綃絼綌綔綄絽綒罭罫罧罨罬羦羥羧翛翜耡腤腠腷腜腩腛腢腲朡腞腶腧腯\"],\n[\"dfa1\",\"腄腡舝艉艄艀艂艅蓱萿葖葶葹蒏蒍葥葑葀蒆葧萰葍葽葚葙葴葳葝蔇葞萷萺萴葺葃葸萲葅萩菙葋萯葂萭葟葰萹葎葌葒葯蓅蒎萻葇萶萳葨葾葄萫葠葔葮葐蜋蜄蛷蜌蛺蛖蛵蝍蛸蜎蜉蜁蛶蜍蜅裖裋裍裎裞裛裚裌裐覅覛觟觥觤\"],\n[\"e040\",\"觡觠觢觜触詶誆詿詡訿詷誂誄詵誃誁詴詺谼豋豊豥豤豦貆貄貅賌赨赩趑趌趎趏趍趓趔趐趒跰跠跬跱跮跐跩跣跢跧跲跫跴輆軿輁輀輅輇輈輂輋遒逿\"],\n[\"e0a1\",\"遄遉逽鄐鄍鄏鄑鄖鄔鄋鄎酮酯鉈鉒鈰鈺鉦鈳鉥鉞銃鈮鉊鉆鉭鉬鉏鉠鉧鉯鈶鉡鉰鈱鉔鉣鉐鉲鉎鉓鉌鉖鈲閟閜閞閛隒隓隑隗雎雺雽雸雵靳靷靸靲頏頍頎颬飶飹馯馲馰馵骭骫魛鳪鳭鳧麀黽僦僔僗僨僳僛僪僝僤僓僬僰僯僣僠\"],\n[\"e140\",\"凘劀劁勩勫匰厬嘧嘕嘌嘒嗼嘏嘜嘁嘓嘂嗺嘝嘄嗿嗹墉塼墐墘墆墁塿塴墋塺墇墑墎塶墂墈塻墔墏壾奫嫜嫮嫥嫕嫪嫚嫭嫫嫳嫢嫠嫛嫬嫞嫝嫙嫨嫟孷寠\"],\n[\"e1a1\",\"寣屣嶂嶀嵽嶆嵺嶁嵷嶊嶉嶈嵾嵼嶍嵹嵿幘幙幓廘廑廗廎廜廕廙廒廔彄彃彯徶愬愨慁慞慱慳慒慓慲慬憀慴慔慺慛慥愻慪慡慖戩戧戫搫摍摛摝摴摶摲摳摽摵摦撦摎撂摞摜摋摓摠摐摿搿摬摫摙摥摷敳斠暡暠暟朅朄朢榱榶槉\"],\n[\"e240\",\"榠槎榖榰榬榼榑榙榎榧榍榩榾榯榿槄榽榤槔榹槊榚槏榳榓榪榡榞槙榗榐槂榵榥槆歊歍歋殞殟殠毃毄毾滎滵滱漃漥滸漷滻漮漉潎漙漚漧漘漻漒滭漊\"],\n[\"e2a1\",\"漶潳滹滮漭潀漰漼漵滫漇漎潃漅滽滶漹漜滼漺漟漍漞漈漡熇熐熉熀熅熂熏煻熆熁熗牄牓犗犕犓獃獍獑獌瑢瑳瑱瑵瑲瑧瑮甀甂甃畽疐瘖瘈瘌瘕瘑瘊瘔皸瞁睼瞅瞂睮瞀睯睾瞃碲碪碴碭碨硾碫碞碥碠碬碢碤禘禊禋禖禕禔禓\"],\n[\"e340\",\"禗禈禒禐稫穊稰稯稨稦窨窫窬竮箈箜箊箑箐箖箍箌箛箎箅箘劄箙箤箂粻粿粼粺綧綷緂綣綪緁緀緅綝緎緄緆緋緌綯綹綖綼綟綦綮綩綡緉罳翢翣翥翞\"],\n[\"e3a1\",\"耤聝聜膉膆膃膇膍膌膋舕蒗蒤蒡蒟蒺蓎蓂蒬蒮蒫蒹蒴蓁蓍蒪蒚蒱蓐蒝蒧蒻蒢蒔蓇蓌蒛蒩蒯蒨蓖蒘蒶蓏蒠蓗蓔蓒蓛蒰蒑虡蜳蜣蜨蝫蝀蜮蜞蜡蜙蜛蝃蜬蝁蜾蝆蜠蜲蜪蜭蜼蜒蜺蜱蜵蝂蜦蜧蜸蜤蜚蜰蜑裷裧裱裲裺裾裮裼裶裻\"],\n[\"e440\",\"裰裬裫覝覡覟覞觩觫觨誫誙誋誒誏誖谽豨豩賕賏賗趖踉踂跿踍跽踊踃踇踆踅跾踀踄輐輑輎輍鄣鄜鄠鄢鄟鄝鄚鄤鄡鄛酺酲酹酳銥銤鉶銛鉺銠銔銪銍\"],\n[\"e4a1\",\"銦銚銫鉹銗鉿銣鋮銎銂銕銢鉽銈銡銊銆銌銙銧鉾銇銩銝銋鈭隞隡雿靘靽靺靾鞃鞀鞂靻鞄鞁靿韎韍頖颭颮餂餀餇馝馜駃馹馻馺駂馽駇骱髣髧鬾鬿魠魡魟鳱鳲鳵麧僿儃儰僸儆儇僶僾儋儌僽儊劋劌勱勯噈噂噌嘵噁噊噉噆噘\"],\n[\"e540\",\"噚噀嘳嘽嘬嘾嘸嘪嘺圚墫墝墱墠墣墯墬墥墡壿嫿嫴嫽嫷嫶嬃嫸嬂嫹嬁嬇嬅嬏屧嶙嶗嶟嶒嶢嶓嶕嶠嶜嶡嶚嶞幩幝幠幜緳廛廞廡彉徲憋憃慹憱憰憢憉\"],\n[\"e5a1\",\"憛憓憯憭憟憒憪憡憍慦憳戭摮摰撖撠撅撗撜撏撋撊撌撣撟摨撱撘敶敺敹敻斲斳暵暰暩暲暷暪暯樀樆樗槥槸樕槱槤樠槿槬槢樛樝槾樧槲槮樔槷槧橀樈槦槻樍槼槫樉樄樘樥樏槶樦樇槴樖歑殥殣殢殦氁氀毿氂潁漦潾澇濆澒\"],\n[\"e640\",\"澍澉澌潢潏澅潚澖潶潬澂潕潲潒潐潗澔澓潝漀潡潫潽潧澐潓澋潩潿澕潣潷潪潻熲熯熛熰熠熚熩熵熝熥熞熤熡熪熜熧熳犘犚獘獒獞獟獠獝獛獡獚獙\"],\n[\"e6a1\",\"獢璇璉璊璆璁瑽璅璈瑼瑹甈甇畾瘥瘞瘙瘝瘜瘣瘚瘨瘛皜皝皞皛瞍瞏瞉瞈磍碻磏磌磑磎磔磈磃磄磉禚禡禠禜禢禛歶稹窲窴窳箷篋箾箬篎箯箹篊箵糅糈糌糋緷緛緪緧緗緡縃緺緦緶緱緰緮緟罶羬羰羭翭翫翪翬翦翨聤聧膣膟\"],\n[\"e740\",\"膞膕膢膙膗舖艏艓艒艐艎艑蔤蔻蔏蔀蔩蔎蔉蔍蔟蔊蔧蔜蓻蔫蓺蔈蔌蓴蔪蓲蔕蓷蓫蓳蓼蔒蓪蓩蔖蓾蔨蔝蔮蔂蓽蔞蓶蔱蔦蓧蓨蓰蓯蓹蔘蔠蔰蔋蔙蔯虢\"],\n[\"e7a1\",\"蝖蝣蝤蝷蟡蝳蝘蝔蝛蝒蝡蝚蝑蝞蝭蝪蝐蝎蝟蝝蝯蝬蝺蝮蝜蝥蝏蝻蝵蝢蝧蝩衚褅褌褔褋褗褘褙褆褖褑褎褉覢覤覣觭觰觬諏諆誸諓諑諔諕誻諗誾諀諅諘諃誺誽諙谾豍貏賥賟賙賨賚賝賧趠趜趡趛踠踣踥踤踮踕踛踖踑踙踦踧\"],\n[\"e840\",\"踔踒踘踓踜踗踚輬輤輘輚輠輣輖輗遳遰遯遧遫鄯鄫鄩鄪鄲鄦鄮醅醆醊醁醂醄醀鋐鋃鋄鋀鋙銶鋏鋱鋟鋘鋩鋗鋝鋌鋯鋂鋨鋊鋈鋎鋦鋍鋕鋉鋠鋞鋧鋑鋓\"],\n[\"e8a1\",\"銵鋡鋆銴镼閬閫閮閰隤隢雓霅霈霂靚鞊鞎鞈韐韏頞頝頦頩頨頠頛頧颲餈飺餑餔餖餗餕駜駍駏駓駔駎駉駖駘駋駗駌骳髬髫髳髲髱魆魃魧魴魱魦魶魵魰魨魤魬鳼鳺鳽鳿鳷鴇鴀鳹鳻鴈鴅鴄麃黓鼏鼐儜儓儗儚儑凞匴叡噰噠噮\"],\n[\"e940\",\"噳噦噣噭噲噞噷圜圛壈墽壉墿墺壂墼壆嬗嬙嬛嬡嬔嬓嬐嬖嬨嬚嬠嬞寯嶬嶱嶩嶧嶵嶰嶮嶪嶨嶲嶭嶯嶴幧幨幦幯廩廧廦廨廥彋徼憝憨憖懅憴懆懁懌憺\"],\n[\"e9a1\",\"憿憸憌擗擖擐擏擉撽撉擃擛擳擙攳敿敼斢曈暾曀曊曋曏暽暻暺曌朣樴橦橉橧樲橨樾橝橭橶橛橑樨橚樻樿橁橪橤橐橏橔橯橩橠樼橞橖橕橍橎橆歕歔歖殧殪殫毈毇氄氃氆澭濋澣濇澼濎濈潞濄澽澞濊澨瀄澥澮澺澬澪濏澿澸\"],\n[\"ea40\",\"澢濉澫濍澯澲澰燅燂熿熸燖燀燁燋燔燊燇燏熽燘熼燆燚燛犝犞獩獦獧獬獥獫獪瑿璚璠璔璒璕璡甋疀瘯瘭瘱瘽瘳瘼瘵瘲瘰皻盦瞚瞝瞡瞜瞛瞢瞣瞕瞙\"],\n[\"eaa1\",\"瞗磝磩磥磪磞磣磛磡磢磭磟磠禤穄穈穇窶窸窵窱窷篞篣篧篝篕篥篚篨篹篔篪篢篜篫篘篟糒糔糗糐糑縒縡縗縌縟縠縓縎縜縕縚縢縋縏縖縍縔縥縤罃罻罼罺羱翯耪耩聬膱膦膮膹膵膫膰膬膴膲膷膧臲艕艖艗蕖蕅蕫蕍蕓蕡蕘\"],\n[\"eb40\",\"蕀蕆蕤蕁蕢蕄蕑蕇蕣蔾蕛蕱蕎蕮蕵蕕蕧蕠薌蕦蕝蕔蕥蕬虣虥虤螛螏螗螓螒螈螁螖螘蝹螇螣螅螐螑螝螄螔螜螚螉褞褦褰褭褮褧褱褢褩褣褯褬褟觱諠\"],\n[\"eba1\",\"諢諲諴諵諝謔諤諟諰諈諞諡諨諿諯諻貑貒貐賵賮賱賰賳赬赮趥趧踳踾踸蹀蹅踶踼踽蹁踰踿躽輶輮輵輲輹輷輴遶遹遻邆郺鄳鄵鄶醓醐醑醍醏錧錞錈錟錆錏鍺錸錼錛錣錒錁鍆錭錎錍鋋錝鋺錥錓鋹鋷錴錂錤鋿錩錹錵錪錔錌\"],\n[\"ec40\",\"錋鋾錉錀鋻錖閼闍閾閹閺閶閿閵閽隩雔霋霒霐鞙鞗鞔韰韸頵頯頲餤餟餧餩馞駮駬駥駤駰駣駪駩駧骹骿骴骻髶髺髹髷鬳鮀鮅鮇魼魾魻鮂鮓鮒鮐魺鮕\"],\n[\"eca1\",\"魽鮈鴥鴗鴠鴞鴔鴩鴝鴘鴢鴐鴙鴟麈麆麇麮麭黕黖黺鼒鼽儦儥儢儤儠儩勴嚓嚌嚍嚆嚄嚃噾嚂噿嚁壖壔壏壒嬭嬥嬲嬣嬬嬧嬦嬯嬮孻寱寲嶷幬幪徾徻懃憵憼懧懠懥懤懨懞擯擩擣擫擤擨斁斀斶旚曒檍檖檁檥檉檟檛檡檞檇檓檎\"],\n[\"ed40\",\"檕檃檨檤檑橿檦檚檅檌檒歛殭氉濌澩濴濔濣濜濭濧濦濞濲濝濢濨燡燱燨燲燤燰燢獳獮獯璗璲璫璐璪璭璱璥璯甐甑甒甏疄癃癈癉癇皤盩瞵瞫瞲瞷瞶\"],\n[\"eda1\",\"瞴瞱瞨矰磳磽礂磻磼磲礅磹磾礄禫禨穜穛穖穘穔穚窾竀竁簅簏篲簀篿篻簎篴簋篳簂簉簃簁篸篽簆篰篱簐簊糨縭縼繂縳顈縸縪繉繀繇縩繌縰縻縶繄縺罅罿罾罽翴翲耬膻臄臌臊臅臇膼臩艛艚艜薃薀薏薧薕薠薋薣蕻薤薚薞\"],\n[\"ee40\",\"蕷蕼薉薡蕺蕸蕗薎薖薆薍薙薝薁薢薂薈薅蕹蕶薘薐薟虨螾螪螭蟅螰螬螹螵螼螮蟉蟃蟂蟌螷螯蟄蟊螴螶螿螸螽蟞螲褵褳褼褾襁襒褷襂覭覯覮觲觳謞\"],\n[\"eea1\",\"謘謖謑謅謋謢謏謒謕謇謍謈謆謜謓謚豏豰豲豱豯貕貔賹赯蹎蹍蹓蹐蹌蹇轃轀邅遾鄸醚醢醛醙醟醡醝醠鎡鎃鎯鍤鍖鍇鍼鍘鍜鍶鍉鍐鍑鍠鍭鎏鍌鍪鍹鍗鍕鍒鍏鍱鍷鍻鍡鍞鍣鍧鎀鍎鍙闇闀闉闃闅閷隮隰隬霠霟霘霝霙鞚鞡鞜\"],\n[\"ef40\",\"鞞鞝韕韔韱顁顄顊顉顅顃餥餫餬餪餳餲餯餭餱餰馘馣馡騂駺駴駷駹駸駶駻駽駾駼騃骾髾髽鬁髼魈鮚鮨鮞鮛鮦鮡鮥鮤鮆鮢鮠鮯鴳鵁鵧鴶鴮鴯鴱鴸鴰\"],\n[\"efa1\",\"鵅鵂鵃鴾鴷鵀鴽翵鴭麊麉麍麰黈黚黻黿鼤鼣鼢齔龠儱儭儮嚘嚜嚗嚚嚝嚙奰嬼屩屪巀幭幮懘懟懭懮懱懪懰懫懖懩擿攄擽擸攁攃擼斔旛曚曛曘櫅檹檽櫡櫆檺檶檷櫇檴檭歞毉氋瀇瀌瀍瀁瀅瀔瀎濿瀀濻瀦濼濷瀊爁燿燹爃燽獶\"],\n[\"f040\",\"璸瓀璵瓁璾璶璻瓂甔甓癜癤癙癐癓癗癚皦皽盬矂瞺磿礌礓礔礉礐礒礑禭禬穟簜簩簙簠簟簭簝簦簨簢簥簰繜繐繖繣繘繢繟繑繠繗繓羵羳翷翸聵臑臒\"],\n[\"f0a1\",\"臐艟艞薴藆藀藃藂薳薵薽藇藄薿藋藎藈藅薱薶藒蘤薸薷薾虩蟧蟦蟢蟛蟫蟪蟥蟟蟳蟤蟔蟜蟓蟭蟘蟣螤蟗蟙蠁蟴蟨蟝襓襋襏襌襆襐襑襉謪謧謣謳謰謵譇謯謼謾謱謥謷謦謶謮謤謻謽謺豂豵貙貘貗賾贄贂贀蹜蹢蹠蹗蹖蹞蹥蹧\"],\n[\"f140\",\"蹛蹚蹡蹝蹩蹔轆轇轈轋鄨鄺鄻鄾醨醥醧醯醪鎵鎌鎒鎷鎛鎝鎉鎧鎎鎪鎞鎦鎕鎈鎙鎟鎍鎱鎑鎲鎤鎨鎴鎣鎥闒闓闑隳雗雚巂雟雘雝霣霢霥鞬鞮鞨鞫鞤鞪\"],\n[\"f1a1\",\"鞢鞥韗韙韖韘韺顐顑顒颸饁餼餺騏騋騉騍騄騑騊騅騇騆髀髜鬈鬄鬅鬩鬵魊魌魋鯇鯆鯃鮿鯁鮵鮸鯓鮶鯄鮹鮽鵜鵓鵏鵊鵛鵋鵙鵖鵌鵗鵒鵔鵟鵘鵚麎麌黟鼁鼀鼖鼥鼫鼪鼩鼨齌齕儴儵劖勷厴嚫嚭嚦嚧嚪嚬壚壝壛夒嬽嬾嬿巃幰\"],\n[\"f240\",\"徿懻攇攐攍攉攌攎斄旞旝曞櫧櫠櫌櫑櫙櫋櫟櫜櫐櫫櫏櫍櫞歠殰氌瀙瀧瀠瀖瀫瀡瀢瀣瀩瀗瀤瀜瀪爌爊爇爂爅犥犦犤犣犡瓋瓅璷瓃甖癠矉矊矄矱礝礛\"],\n[\"f2a1\",\"礡礜礗礞禰穧穨簳簼簹簬簻糬糪繶繵繸繰繷繯繺繲繴繨罋罊羃羆羷翽翾聸臗臕艤艡艣藫藱藭藙藡藨藚藗藬藲藸藘藟藣藜藑藰藦藯藞藢蠀蟺蠃蟶蟷蠉蠌蠋蠆蟼蠈蟿蠊蠂襢襚襛襗襡襜襘襝襙覈覷覶觶譐譈譊譀譓譖譔譋譕\"],\n[\"f340\",\"譑譂譒譗豃豷豶貚贆贇贉趬趪趭趫蹭蹸蹳蹪蹯蹻軂轒轑轏轐轓辴酀鄿醰醭鏞鏇鏏鏂鏚鏐鏹鏬鏌鏙鎩鏦鏊鏔鏮鏣鏕鏄鏎鏀鏒鏧镽闚闛雡霩霫霬霨霦\"],\n[\"f3a1\",\"鞳鞷鞶韝韞韟顜顙顝顗颿颽颻颾饈饇饃馦馧騚騕騥騝騤騛騢騠騧騣騞騜騔髂鬋鬊鬎鬌鬷鯪鯫鯠鯞鯤鯦鯢鯰鯔鯗鯬鯜鯙鯥鯕鯡鯚鵷鶁鶊鶄鶈鵱鶀鵸鶆鶋鶌鵽鵫鵴鵵鵰鵩鶅鵳鵻鶂鵯鵹鵿鶇鵨麔麑黀黼鼭齀齁齍齖齗齘匷嚲\"],\n[\"f440\",\"嚵嚳壣孅巆巇廮廯忀忁懹攗攖攕攓旟曨曣曤櫳櫰櫪櫨櫹櫱櫮櫯瀼瀵瀯瀷瀴瀱灂瀸瀿瀺瀹灀瀻瀳灁爓爔犨獽獼璺皫皪皾盭矌矎矏矍矲礥礣礧礨礤礩\"],\n[\"f4a1\",\"禲穮穬穭竷籉籈籊籇籅糮繻繾纁纀羺翿聹臛臙舋艨艩蘢藿蘁藾蘛蘀藶蘄蘉蘅蘌藽蠙蠐蠑蠗蠓蠖襣襦覹觷譠譪譝譨譣譥譧譭趮躆躈躄轙轖轗轕轘轚邍酃酁醷醵醲醳鐋鐓鏻鐠鐏鐔鏾鐕鐐鐨鐙鐍鏵鐀鏷鐇鐎鐖鐒鏺鐉鏸鐊鏿\"],\n[\"f540\",\"鏼鐌鏶鐑鐆闞闠闟霮霯鞹鞻韽韾顠顢顣顟飁飂饐饎饙饌饋饓騲騴騱騬騪騶騩騮騸騭髇髊髆鬐鬒鬑鰋鰈鯷鰅鰒鯸鱀鰇鰎鰆鰗鰔鰉鶟鶙鶤鶝鶒鶘鶐鶛\"],\n[\"f5a1\",\"鶠鶔鶜鶪鶗鶡鶚鶢鶨鶞鶣鶿鶩鶖鶦鶧麙麛麚黥黤黧黦鼰鼮齛齠齞齝齙龑儺儹劘劗囃嚽嚾孈孇巋巏廱懽攛欂櫼欃櫸欀灃灄灊灈灉灅灆爝爚爙獾甗癪矐礭礱礯籔籓糲纊纇纈纋纆纍罍羻耰臝蘘蘪蘦蘟蘣蘜蘙蘧蘮蘡蘠蘩蘞蘥\"],\n[\"f640\",\"蠩蠝蠛蠠蠤蠜蠫衊襭襩襮襫觺譹譸譅譺譻贐贔趯躎躌轞轛轝酆酄酅醹鐿鐻鐶鐩鐽鐼鐰鐹鐪鐷鐬鑀鐱闥闤闣霵霺鞿韡顤飉飆飀饘饖騹騽驆驄驂驁騺\"],\n[\"f6a1\",\"騿髍鬕鬗鬘鬖鬺魒鰫鰝鰜鰬鰣鰨鰩鰤鰡鶷鶶鶼鷁鷇鷊鷏鶾鷅鷃鶻鶵鷎鶹鶺鶬鷈鶱鶭鷌鶳鷍鶲鹺麜黫黮黭鼛鼘鼚鼱齎齥齤龒亹囆囅囋奱孋孌巕巑廲攡攠攦攢欋欈欉氍灕灖灗灒爞爟犩獿瓘瓕瓙瓗癭皭礵禴穰穱籗籜籙籛籚\"],\n[\"f740\",\"糴糱纑罏羇臞艫蘴蘵蘳蘬蘲蘶蠬蠨蠦蠪蠥襱覿覾觻譾讄讂讆讅譿贕躕躔躚躒躐躖躗轠轢酇鑌鑐鑊鑋鑏鑇鑅鑈鑉鑆霿韣顪顩飋饔饛驎驓驔驌驏驈驊\"],\n[\"f7a1\",\"驉驒驐髐鬙鬫鬻魖魕鱆鱈鰿鱄鰹鰳鱁鰼鰷鰴鰲鰽鰶鷛鷒鷞鷚鷋鷐鷜鷑鷟鷩鷙鷘鷖鷵鷕鷝麶黰鼵鼳鼲齂齫龕龢儽劙壨壧奲孍巘蠯彏戁戃戄攩攥斖曫欑欒欏毊灛灚爢玂玁玃癰矔籧籦纕艬蘺虀蘹蘼蘱蘻蘾蠰蠲蠮蠳襶襴襳觾\"],\n[\"f840\",\"讌讎讋讈豅贙躘轤轣醼鑢鑕鑝鑗鑞韄韅頀驖驙鬞鬟鬠鱒鱘鱐鱊鱍鱋鱕鱙鱌鱎鷻鷷鷯鷣鷫鷸鷤鷶鷡鷮鷦鷲鷰鷢鷬鷴鷳鷨鷭黂黐黲黳鼆鼜鼸鼷鼶齃齏\"],\n[\"f8a1\",\"齱齰齮齯囓囍孎屭攭曭曮欓灟灡灝灠爣瓛瓥矕礸禷禶籪纗羉艭虃蠸蠷蠵衋讔讕躞躟躠躝醾醽釂鑫鑨鑩雥靆靃靇韇韥驞髕魙鱣鱧鱦鱢鱞鱠鸂鷾鸇鸃鸆鸅鸀鸁鸉鷿鷽鸄麠鼞齆齴齵齶囔攮斸欘欙欗欚灢爦犪矘矙礹籩籫糶纚\"],\n[\"f940\",\"纘纛纙臠臡虆虇虈襹襺襼襻觿讘讙躥躤躣鑮鑭鑯鑱鑳靉顲饟鱨鱮鱭鸋鸍鸐鸏鸒鸑麡黵鼉齇齸齻齺齹圞灦籯蠼趲躦釃鑴鑸鑶鑵驠鱴鱳鱱鱵鸔鸓黶鼊\"],\n[\"f9a1\",\"龤灨灥糷虪蠾蠽蠿讞貜躩軉靋顳顴飌饡馫驤驦驧鬤鸕鸗齈戇欞爧虌躨钂钀钁驩驨鬮鸙爩虋讟钃鱹麷癵驫鱺鸝灩灪麤齾齉龘碁銹裏墻恒粧嫺╔╦╗╠╬╣╚╩╝╒╤╕╞╪╡╘╧╛╓╥╖╟╫╢╙╨╜║═╭╮╰╯▓\"]\n]\n");
__memMods.set("iconv-lite/encodings/tables/eucjp.json", "[\n[\"0\",\"\\u0000\",127],\n[\"8ea1\",\"｡\",62],\n[\"a1a1\",\"　、。，．・：；？！゛゜´｀¨＾￣＿ヽヾゝゞ〃仝々〆〇ー―‐／＼～∥｜…‥‘’“”（）〔〕［］｛｝〈\",9,\"＋－±×÷＝≠＜＞≦≧∞∴♂♀°′″℃￥＄￠￡％＃＆＊＠§☆★○●◎◇\"],\n[\"a2a1\",\"◆□■△▲▽▼※〒→←↑↓〓\"],\n[\"a2ba\",\"∈∋⊆⊇⊂⊃∪∩\"],\n[\"a2ca\",\"∧∨￢⇒⇔∀∃\"],\n[\"a2dc\",\"∠⊥⌒∂∇≡≒≪≫√∽∝∵∫∬\"],\n[\"a2f2\",\"Å‰♯♭♪†‡¶\"],\n[\"a2fe\",\"◯\"],\n[\"a3b0\",\"０\",9],\n[\"a3c1\",\"Ａ\",25],\n[\"a3e1\",\"ａ\",25],\n[\"a4a1\",\"ぁ\",82],\n[\"a5a1\",\"ァ\",85],\n[\"a6a1\",\"Α\",16,\"Σ\",6],\n[\"a6c1\",\"α\",16,\"σ\",6],\n[\"a7a1\",\"А\",5,\"ЁЖ\",25],\n[\"a7d1\",\"а\",5,\"ёж\",25],\n[\"a8a1\",\"─│┌┐┘└├┬┤┴┼━┃┏┓┛┗┣┳┫┻╋┠┯┨┷┿┝┰┥┸╂\"],\n[\"ada1\",\"①\",19,\"Ⅰ\",9],\n[\"adc0\",\"㍉㌔㌢㍍㌘㌧㌃㌶㍑㍗㌍㌦㌣㌫㍊㌻㎜㎝㎞㎎㎏㏄㎡\"],\n[\"addf\",\"㍻〝〟№㏍℡㊤\",4,\"㈱㈲㈹㍾㍽㍼≒≡∫∮∑√⊥∠∟⊿∵∩∪\"],\n[\"b0a1\",\"亜唖娃阿哀愛挨姶逢葵茜穐悪握渥旭葦芦鯵梓圧斡扱宛姐虻飴絢綾鮎或粟袷安庵按暗案闇鞍杏以伊位依偉囲夷委威尉惟意慰易椅為畏異移維緯胃萎衣謂違遺医井亥域育郁磯一壱溢逸稲茨芋鰯允印咽員因姻引飲淫胤蔭\"],\n[\"b1a1\",\"院陰隠韻吋右宇烏羽迂雨卯鵜窺丑碓臼渦嘘唄欝蔚鰻姥厩浦瓜閏噂云運雲荏餌叡営嬰影映曳栄永泳洩瑛盈穎頴英衛詠鋭液疫益駅悦謁越閲榎厭円園堰奄宴延怨掩援沿演炎焔煙燕猿縁艶苑薗遠鉛鴛塩於汚甥凹央奥往応\"],\n[\"b2a1\",\"押旺横欧殴王翁襖鴬鴎黄岡沖荻億屋憶臆桶牡乙俺卸恩温穏音下化仮何伽価佳加可嘉夏嫁家寡科暇果架歌河火珂禍禾稼箇花苛茄荷華菓蝦課嘩貨迦過霞蚊俄峨我牙画臥芽蛾賀雅餓駕介会解回塊壊廻快怪悔恢懐戒拐改\"],\n[\"b3a1\",\"魁晦械海灰界皆絵芥蟹開階貝凱劾外咳害崖慨概涯碍蓋街該鎧骸浬馨蛙垣柿蛎鈎劃嚇各廓拡撹格核殻獲確穫覚角赫較郭閣隔革学岳楽額顎掛笠樫橿梶鰍潟割喝恰括活渇滑葛褐轄且鰹叶椛樺鞄株兜竃蒲釜鎌噛鴨栢茅萱\"],\n[\"b4a1\",\"粥刈苅瓦乾侃冠寒刊勘勧巻喚堪姦完官寛干幹患感慣憾換敢柑桓棺款歓汗漢澗潅環甘監看竿管簡緩缶翰肝艦莞観諌貫還鑑間閑関陥韓館舘丸含岸巌玩癌眼岩翫贋雁頑顔願企伎危喜器基奇嬉寄岐希幾忌揮机旗既期棋棄\"],\n[\"b5a1\",\"機帰毅気汽畿祈季稀紀徽規記貴起軌輝飢騎鬼亀偽儀妓宜戯技擬欺犠疑祇義蟻誼議掬菊鞠吉吃喫桔橘詰砧杵黍却客脚虐逆丘久仇休及吸宮弓急救朽求汲泣灸球究窮笈級糾給旧牛去居巨拒拠挙渠虚許距鋸漁禦魚亨享京\"],\n[\"b6a1\",\"供侠僑兇競共凶協匡卿叫喬境峡強彊怯恐恭挟教橋況狂狭矯胸脅興蕎郷鏡響饗驚仰凝尭暁業局曲極玉桐粁僅勤均巾錦斤欣欽琴禁禽筋緊芹菌衿襟謹近金吟銀九倶句区狗玖矩苦躯駆駈駒具愚虞喰空偶寓遇隅串櫛釧屑屈\"],\n[\"b7a1\",\"掘窟沓靴轡窪熊隈粂栗繰桑鍬勲君薫訓群軍郡卦袈祁係傾刑兄啓圭珪型契形径恵慶慧憩掲携敬景桂渓畦稽系経継繋罫茎荊蛍計詣警軽頚鶏芸迎鯨劇戟撃激隙桁傑欠決潔穴結血訣月件倹倦健兼券剣喧圏堅嫌建憲懸拳捲\"],\n[\"b8a1\",\"検権牽犬献研硯絹県肩見謙賢軒遣鍵険顕験鹸元原厳幻弦減源玄現絃舷言諺限乎個古呼固姑孤己庫弧戸故枯湖狐糊袴股胡菰虎誇跨鈷雇顧鼓五互伍午呉吾娯後御悟梧檎瑚碁語誤護醐乞鯉交佼侯候倖光公功効勾厚口向\"],\n[\"b9a1\",\"后喉坑垢好孔孝宏工巧巷幸広庚康弘恒慌抗拘控攻昂晃更杭校梗構江洪浩港溝甲皇硬稿糠紅紘絞綱耕考肯肱腔膏航荒行衡講貢購郊酵鉱砿鋼閤降項香高鴻剛劫号合壕拷濠豪轟麹克刻告国穀酷鵠黒獄漉腰甑忽惚骨狛込\"],\n[\"baa1\",\"此頃今困坤墾婚恨懇昏昆根梱混痕紺艮魂些佐叉唆嵯左差査沙瑳砂詐鎖裟坐座挫債催再最哉塞妻宰彩才採栽歳済災采犀砕砦祭斎細菜裁載際剤在材罪財冴坂阪堺榊肴咲崎埼碕鷺作削咋搾昨朔柵窄策索錯桜鮭笹匙冊刷\"],\n[\"bba1\",\"察拶撮擦札殺薩雑皐鯖捌錆鮫皿晒三傘参山惨撒散桟燦珊産算纂蚕讃賛酸餐斬暫残仕仔伺使刺司史嗣四士始姉姿子屍市師志思指支孜斯施旨枝止死氏獅祉私糸紙紫肢脂至視詞詩試誌諮資賜雌飼歯事似侍児字寺慈持時\"],\n[\"bca1\",\"次滋治爾璽痔磁示而耳自蒔辞汐鹿式識鴫竺軸宍雫七叱執失嫉室悉湿漆疾質実蔀篠偲柴芝屡蕊縞舎写射捨赦斜煮社紗者謝車遮蛇邪借勺尺杓灼爵酌釈錫若寂弱惹主取守手朱殊狩珠種腫趣酒首儒受呪寿授樹綬需囚収周\"],\n[\"bda1\",\"宗就州修愁拾洲秀秋終繍習臭舟蒐衆襲讐蹴輯週酋酬集醜什住充十従戎柔汁渋獣縦重銃叔夙宿淑祝縮粛塾熟出術述俊峻春瞬竣舜駿准循旬楯殉淳準潤盾純巡遵醇順処初所暑曙渚庶緒署書薯藷諸助叙女序徐恕鋤除傷償\"],\n[\"bea1\",\"勝匠升召哨商唱嘗奨妾娼宵将小少尚庄床廠彰承抄招掌捷昇昌昭晶松梢樟樵沼消渉湘焼焦照症省硝礁祥称章笑粧紹肖菖蒋蕉衝裳訟証詔詳象賞醤鉦鍾鐘障鞘上丈丞乗冗剰城場壌嬢常情擾条杖浄状畳穣蒸譲醸錠嘱埴飾\"],\n[\"bfa1\",\"拭植殖燭織職色触食蝕辱尻伸信侵唇娠寝審心慎振新晋森榛浸深申疹真神秦紳臣芯薪親診身辛進針震人仁刃塵壬尋甚尽腎訊迅陣靭笥諏須酢図厨逗吹垂帥推水炊睡粋翠衰遂酔錐錘随瑞髄崇嵩数枢趨雛据杉椙菅頗雀裾\"],\n[\"c0a1\",\"澄摺寸世瀬畝是凄制勢姓征性成政整星晴棲栖正清牲生盛精聖声製西誠誓請逝醒青静斉税脆隻席惜戚斥昔析石積籍績脊責赤跡蹟碩切拙接摂折設窃節説雪絶舌蝉仙先千占宣専尖川戦扇撰栓栴泉浅洗染潜煎煽旋穿箭線\"],\n[\"c1a1\",\"繊羨腺舛船薦詮賎践選遷銭銑閃鮮前善漸然全禅繕膳糎噌塑岨措曾曽楚狙疏疎礎祖租粗素組蘇訴阻遡鼠僧創双叢倉喪壮奏爽宋層匝惣想捜掃挿掻操早曹巣槍槽漕燥争痩相窓糟総綜聡草荘葬蒼藻装走送遭鎗霜騒像増憎\"],\n[\"c2a1\",\"臓蔵贈造促側則即息捉束測足速俗属賊族続卒袖其揃存孫尊損村遜他多太汰詑唾堕妥惰打柁舵楕陀駄騨体堆対耐岱帯待怠態戴替泰滞胎腿苔袋貸退逮隊黛鯛代台大第醍題鷹滝瀧卓啄宅托択拓沢濯琢託鐸濁諾茸凧蛸只\"],\n[\"c3a1\",\"叩但達辰奪脱巽竪辿棚谷狸鱈樽誰丹単嘆坦担探旦歎淡湛炭短端箪綻耽胆蛋誕鍛団壇弾断暖檀段男談値知地弛恥智池痴稚置致蜘遅馳築畜竹筑蓄逐秩窒茶嫡着中仲宙忠抽昼柱注虫衷註酎鋳駐樗瀦猪苧著貯丁兆凋喋寵\"],\n[\"c4a1\",\"帖帳庁弔張彫徴懲挑暢朝潮牒町眺聴脹腸蝶調諜超跳銚長頂鳥勅捗直朕沈珍賃鎮陳津墜椎槌追鎚痛通塚栂掴槻佃漬柘辻蔦綴鍔椿潰坪壷嬬紬爪吊釣鶴亭低停偵剃貞呈堤定帝底庭廷弟悌抵挺提梯汀碇禎程締艇訂諦蹄逓\"],\n[\"c5a1\",\"邸鄭釘鼎泥摘擢敵滴的笛適鏑溺哲徹撤轍迭鉄典填天展店添纏甜貼転顛点伝殿澱田電兎吐堵塗妬屠徒斗杜渡登菟賭途都鍍砥砺努度土奴怒倒党冬凍刀唐塔塘套宕島嶋悼投搭東桃梼棟盗淘湯涛灯燈当痘祷等答筒糖統到\"],\n[\"c6a1\",\"董蕩藤討謄豆踏逃透鐙陶頭騰闘働動同堂導憧撞洞瞳童胴萄道銅峠鴇匿得徳涜特督禿篤毒独読栃橡凸突椴届鳶苫寅酉瀞噸屯惇敦沌豚遁頓呑曇鈍奈那内乍凪薙謎灘捺鍋楢馴縄畷南楠軟難汝二尼弐迩匂賑肉虹廿日乳入\"],\n[\"c7a1\",\"如尿韮任妊忍認濡禰祢寧葱猫熱年念捻撚燃粘乃廼之埜嚢悩濃納能脳膿農覗蚤巴把播覇杷波派琶破婆罵芭馬俳廃拝排敗杯盃牌背肺輩配倍培媒梅楳煤狽買売賠陪這蝿秤矧萩伯剥博拍柏泊白箔粕舶薄迫曝漠爆縛莫駁麦\"],\n[\"c8a1\",\"函箱硲箸肇筈櫨幡肌畑畠八鉢溌発醗髪伐罰抜筏閥鳩噺塙蛤隼伴判半反叛帆搬斑板氾汎版犯班畔繁般藩販範釆煩頒飯挽晩番盤磐蕃蛮匪卑否妃庇彼悲扉批披斐比泌疲皮碑秘緋罷肥被誹費避非飛樋簸備尾微枇毘琵眉美\"],\n[\"c9a1\",\"鼻柊稗匹疋髭彦膝菱肘弼必畢筆逼桧姫媛紐百謬俵彪標氷漂瓢票表評豹廟描病秒苗錨鋲蒜蛭鰭品彬斌浜瀕貧賓頻敏瓶不付埠夫婦富冨布府怖扶敷斧普浮父符腐膚芙譜負賦赴阜附侮撫武舞葡蕪部封楓風葺蕗伏副復幅服\"],\n[\"caa1\",\"福腹複覆淵弗払沸仏物鮒分吻噴墳憤扮焚奮粉糞紛雰文聞丙併兵塀幣平弊柄並蔽閉陛米頁僻壁癖碧別瞥蔑箆偏変片篇編辺返遍便勉娩弁鞭保舗鋪圃捕歩甫補輔穂募墓慕戊暮母簿菩倣俸包呆報奉宝峰峯崩庖抱捧放方朋\"],\n[\"cba1\",\"法泡烹砲縫胞芳萌蓬蜂褒訪豊邦鋒飽鳳鵬乏亡傍剖坊妨帽忘忙房暴望某棒冒紡肪膨謀貌貿鉾防吠頬北僕卜墨撲朴牧睦穆釦勃没殆堀幌奔本翻凡盆摩磨魔麻埋妹昧枚毎哩槙幕膜枕鮪柾鱒桝亦俣又抹末沫迄侭繭麿万慢満\"],\n[\"cca1\",\"漫蔓味未魅巳箕岬密蜜湊蓑稔脈妙粍民眠務夢無牟矛霧鵡椋婿娘冥名命明盟迷銘鳴姪牝滅免棉綿緬面麺摸模茂妄孟毛猛盲網耗蒙儲木黙目杢勿餅尤戻籾貰問悶紋門匁也冶夜爺耶野弥矢厄役約薬訳躍靖柳薮鑓愉愈油癒\"],\n[\"cda1\",\"諭輸唯佑優勇友宥幽悠憂揖有柚湧涌猶猷由祐裕誘遊邑郵雄融夕予余与誉輿預傭幼妖容庸揚揺擁曜楊様洋溶熔用窯羊耀葉蓉要謡踊遥陽養慾抑欲沃浴翌翼淀羅螺裸来莱頼雷洛絡落酪乱卵嵐欄濫藍蘭覧利吏履李梨理璃\"],\n[\"cea1\",\"痢裏裡里離陸律率立葎掠略劉流溜琉留硫粒隆竜龍侶慮旅虜了亮僚両凌寮料梁涼猟療瞭稜糧良諒遼量陵領力緑倫厘林淋燐琳臨輪隣鱗麟瑠塁涙累類令伶例冷励嶺怜玲礼苓鈴隷零霊麗齢暦歴列劣烈裂廉恋憐漣煉簾練聯\"],\n[\"cfa1\",\"蓮連錬呂魯櫓炉賂路露労婁廊弄朗楼榔浪漏牢狼篭老聾蝋郎六麓禄肋録論倭和話歪賄脇惑枠鷲亙亘鰐詫藁蕨椀湾碗腕\"],\n[\"d0a1\",\"弌丐丕个丱丶丼丿乂乖乘亂亅豫亊舒弍于亞亟亠亢亰亳亶从仍仄仆仂仗仞仭仟价伉佚估佛佝佗佇佶侈侏侘佻佩佰侑佯來侖儘俔俟俎俘俛俑俚俐俤俥倚倨倔倪倥倅伜俶倡倩倬俾俯們倆偃假會偕偐偈做偖偬偸傀傚傅傴傲\"],\n[\"d1a1\",\"僉僊傳僂僖僞僥僭僣僮價僵儉儁儂儖儕儔儚儡儺儷儼儻儿兀兒兌兔兢竸兩兪兮冀冂囘册冉冏冑冓冕冖冤冦冢冩冪冫决冱冲冰况冽凅凉凛几處凩凭凰凵凾刄刋刔刎刧刪刮刳刹剏剄剋剌剞剔剪剴剩剳剿剽劍劔劒剱劈劑辨\"],\n[\"d2a1\",\"辧劬劭劼劵勁勍勗勞勣勦飭勠勳勵勸勹匆匈甸匍匐匏匕匚匣匯匱匳匸區卆卅丗卉卍凖卞卩卮夘卻卷厂厖厠厦厥厮厰厶參簒雙叟曼燮叮叨叭叺吁吽呀听吭吼吮吶吩吝呎咏呵咎呟呱呷呰咒呻咀呶咄咐咆哇咢咸咥咬哄哈咨\"],\n[\"d3a1\",\"咫哂咤咾咼哘哥哦唏唔哽哮哭哺哢唹啀啣啌售啜啅啖啗唸唳啝喙喀咯喊喟啻啾喘喞單啼喃喩喇喨嗚嗅嗟嗄嗜嗤嗔嘔嗷嘖嗾嗽嘛嗹噎噐營嘴嘶嘲嘸噫噤嘯噬噪嚆嚀嚊嚠嚔嚏嚥嚮嚶嚴囂嚼囁囃囀囈囎囑囓囗囮囹圀囿圄圉\"],\n[\"d4a1\",\"圈國圍圓團圖嗇圜圦圷圸坎圻址坏坩埀垈坡坿垉垓垠垳垤垪垰埃埆埔埒埓堊埖埣堋堙堝塲堡塢塋塰毀塒堽塹墅墹墟墫墺壞墻墸墮壅壓壑壗壙壘壥壜壤壟壯壺壹壻壼壽夂夊夐夛梦夥夬夭夲夸夾竒奕奐奎奚奘奢奠奧奬奩\"],\n[\"d5a1\",\"奸妁妝佞侫妣妲姆姨姜妍姙姚娥娟娑娜娉娚婀婬婉娵娶婢婪媚媼媾嫋嫂媽嫣嫗嫦嫩嫖嫺嫻嬌嬋嬖嬲嫐嬪嬶嬾孃孅孀孑孕孚孛孥孩孰孳孵學斈孺宀它宦宸寃寇寉寔寐寤實寢寞寥寫寰寶寳尅將專對尓尠尢尨尸尹屁屆屎屓\"],\n[\"d6a1\",\"屐屏孱屬屮乢屶屹岌岑岔妛岫岻岶岼岷峅岾峇峙峩峽峺峭嶌峪崋崕崗嵜崟崛崑崔崢崚崙崘嵌嵒嵎嵋嵬嵳嵶嶇嶄嶂嶢嶝嶬嶮嶽嶐嶷嶼巉巍巓巒巖巛巫已巵帋帚帙帑帛帶帷幄幃幀幎幗幔幟幢幤幇幵并幺麼广庠廁廂廈廐廏\"],\n[\"d7a1\",\"廖廣廝廚廛廢廡廨廩廬廱廳廰廴廸廾弃弉彝彜弋弑弖弩弭弸彁彈彌彎弯彑彖彗彙彡彭彳彷徃徂彿徊很徑徇從徙徘徠徨徭徼忖忻忤忸忱忝悳忿怡恠怙怐怩怎怱怛怕怫怦怏怺恚恁恪恷恟恊恆恍恣恃恤恂恬恫恙悁悍惧悃悚\"],\n[\"d8a1\",\"悄悛悖悗悒悧悋惡悸惠惓悴忰悽惆悵惘慍愕愆惶惷愀惴惺愃愡惻惱愍愎慇愾愨愧慊愿愼愬愴愽慂慄慳慷慘慙慚慫慴慯慥慱慟慝慓慵憙憖憇憬憔憚憊憑憫憮懌懊應懷懈懃懆憺懋罹懍懦懣懶懺懴懿懽懼懾戀戈戉戍戌戔戛\"],\n[\"d9a1\",\"戞戡截戮戰戲戳扁扎扞扣扛扠扨扼抂抉找抒抓抖拔抃抔拗拑抻拏拿拆擔拈拜拌拊拂拇抛拉挌拮拱挧挂挈拯拵捐挾捍搜捏掖掎掀掫捶掣掏掉掟掵捫捩掾揩揀揆揣揉插揶揄搖搴搆搓搦搶攝搗搨搏摧摯摶摎攪撕撓撥撩撈撼\"],\n[\"daa1\",\"據擒擅擇撻擘擂擱擧舉擠擡抬擣擯攬擶擴擲擺攀擽攘攜攅攤攣攫攴攵攷收攸畋效敖敕敍敘敞敝敲數斂斃變斛斟斫斷旃旆旁旄旌旒旛旙无旡旱杲昊昃旻杳昵昶昴昜晏晄晉晁晞晝晤晧晨晟晢晰暃暈暎暉暄暘暝曁暹曉暾暼\"],\n[\"dba1\",\"曄暸曖曚曠昿曦曩曰曵曷朏朖朞朦朧霸朮朿朶杁朸朷杆杞杠杙杣杤枉杰枩杼杪枌枋枦枡枅枷柯枴柬枳柩枸柤柞柝柢柮枹柎柆柧檜栞框栩桀桍栲桎梳栫桙档桷桿梟梏梭梔條梛梃檮梹桴梵梠梺椏梍桾椁棊椈棘椢椦棡椌棍\"],\n[\"dca1\",\"棔棧棕椶椒椄棗棣椥棹棠棯椨椪椚椣椡棆楹楷楜楸楫楔楾楮椹楴椽楙椰楡楞楝榁楪榲榮槐榿槁槓榾槎寨槊槝榻槃榧樮榑榠榜榕榴槞槨樂樛槿權槹槲槧樅榱樞槭樔槫樊樒櫁樣樓橄樌橲樶橸橇橢橙橦橈樸樢檐檍檠檄檢檣\"],\n[\"dda1\",\"檗蘗檻櫃櫂檸檳檬櫞櫑櫟檪櫚櫪櫻欅蘖櫺欒欖鬱欟欸欷盜欹飮歇歃歉歐歙歔歛歟歡歸歹歿殀殄殃殍殘殕殞殤殪殫殯殲殱殳殷殼毆毋毓毟毬毫毳毯麾氈氓气氛氤氣汞汕汢汪沂沍沚沁沛汾汨汳沒沐泄泱泓沽泗泅泝沮沱沾\"],\n[\"dea1\",\"沺泛泯泙泪洟衍洶洫洽洸洙洵洳洒洌浣涓浤浚浹浙涎涕濤涅淹渕渊涵淇淦涸淆淬淞淌淨淒淅淺淙淤淕淪淮渭湮渮渙湲湟渾渣湫渫湶湍渟湃渺湎渤滿渝游溂溪溘滉溷滓溽溯滄溲滔滕溏溥滂溟潁漑灌滬滸滾漿滲漱滯漲滌\"],\n[\"dfa1\",\"漾漓滷澆潺潸澁澀潯潛濳潭澂潼潘澎澑濂潦澳澣澡澤澹濆澪濟濕濬濔濘濱濮濛瀉瀋濺瀑瀁瀏濾瀛瀚潴瀝瀘瀟瀰瀾瀲灑灣炙炒炯烱炬炸炳炮烟烋烝烙焉烽焜焙煥煕熈煦煢煌煖煬熏燻熄熕熨熬燗熹熾燒燉燔燎燠燬燧燵燼\"],\n[\"e0a1\",\"燹燿爍爐爛爨爭爬爰爲爻爼爿牀牆牋牘牴牾犂犁犇犒犖犢犧犹犲狃狆狄狎狒狢狠狡狹狷倏猗猊猜猖猝猴猯猩猥猾獎獏默獗獪獨獰獸獵獻獺珈玳珎玻珀珥珮珞璢琅瑯琥珸琲琺瑕琿瑟瑙瑁瑜瑩瑰瑣瑪瑶瑾璋璞璧瓊瓏瓔珱\"],\n[\"e1a1\",\"瓠瓣瓧瓩瓮瓲瓰瓱瓸瓷甄甃甅甌甎甍甕甓甞甦甬甼畄畍畊畉畛畆畚畩畤畧畫畭畸當疆疇畴疊疉疂疔疚疝疥疣痂疳痃疵疽疸疼疱痍痊痒痙痣痞痾痿痼瘁痰痺痲痳瘋瘍瘉瘟瘧瘠瘡瘢瘤瘴瘰瘻癇癈癆癜癘癡癢癨癩癪癧癬癰\"],\n[\"e2a1\",\"癲癶癸發皀皃皈皋皎皖皓皙皚皰皴皸皹皺盂盍盖盒盞盡盥盧盪蘯盻眈眇眄眩眤眞眥眦眛眷眸睇睚睨睫睛睥睿睾睹瞎瞋瞑瞠瞞瞰瞶瞹瞿瞼瞽瞻矇矍矗矚矜矣矮矼砌砒礦砠礪硅碎硴碆硼碚碌碣碵碪碯磑磆磋磔碾碼磅磊磬\"],\n[\"e3a1\",\"磧磚磽磴礇礒礑礙礬礫祀祠祗祟祚祕祓祺祿禊禝禧齋禪禮禳禹禺秉秕秧秬秡秣稈稍稘稙稠稟禀稱稻稾稷穃穗穉穡穢穩龝穰穹穽窈窗窕窘窖窩竈窰窶竅竄窿邃竇竊竍竏竕竓站竚竝竡竢竦竭竰笂笏笊笆笳笘笙笞笵笨笶筐\"],\n[\"e4a1\",\"筺笄筍笋筌筅筵筥筴筧筰筱筬筮箝箘箟箍箜箚箋箒箏筝箙篋篁篌篏箴篆篝篩簑簔篦篥籠簀簇簓篳篷簗簍篶簣簧簪簟簷簫簽籌籃籔籏籀籐籘籟籤籖籥籬籵粃粐粤粭粢粫粡粨粳粲粱粮粹粽糀糅糂糘糒糜糢鬻糯糲糴糶糺紆\"],\n[\"e5a1\",\"紂紜紕紊絅絋紮紲紿紵絆絳絖絎絲絨絮絏絣經綉絛綏絽綛綺綮綣綵緇綽綫總綢綯緜綸綟綰緘緝緤緞緻緲緡縅縊縣縡縒縱縟縉縋縢繆繦縻縵縹繃縷縲縺繧繝繖繞繙繚繹繪繩繼繻纃緕繽辮繿纈纉續纒纐纓纔纖纎纛纜缸缺\"],\n[\"e6a1\",\"罅罌罍罎罐网罕罔罘罟罠罨罩罧罸羂羆羃羈羇羌羔羞羝羚羣羯羲羹羮羶羸譱翅翆翊翕翔翡翦翩翳翹飜耆耄耋耒耘耙耜耡耨耿耻聊聆聒聘聚聟聢聨聳聲聰聶聹聽聿肄肆肅肛肓肚肭冐肬胛胥胙胝胄胚胖脉胯胱脛脩脣脯腋\"],\n[\"e7a1\",\"隋腆脾腓腑胼腱腮腥腦腴膃膈膊膀膂膠膕膤膣腟膓膩膰膵膾膸膽臀臂膺臉臍臑臙臘臈臚臟臠臧臺臻臾舁舂舅與舊舍舐舖舩舫舸舳艀艙艘艝艚艟艤艢艨艪艫舮艱艷艸艾芍芒芫芟芻芬苡苣苟苒苴苳苺莓范苻苹苞茆苜茉苙\"],\n[\"e8a1\",\"茵茴茖茲茱荀茹荐荅茯茫茗茘莅莚莪莟莢莖茣莎莇莊荼莵荳荵莠莉莨菴萓菫菎菽萃菘萋菁菷萇菠菲萍萢萠莽萸蔆菻葭萪萼蕚蒄葷葫蒭葮蒂葩葆萬葯葹萵蓊葢蒹蒿蒟蓙蓍蒻蓚蓐蓁蓆蓖蒡蔡蓿蓴蔗蔘蔬蔟蔕蔔蓼蕀蕣蕘蕈\"],\n[\"e9a1\",\"蕁蘂蕋蕕薀薤薈薑薊薨蕭薔薛藪薇薜蕷蕾薐藉薺藏薹藐藕藝藥藜藹蘊蘓蘋藾藺蘆蘢蘚蘰蘿虍乕虔號虧虱蚓蚣蚩蚪蚋蚌蚶蚯蛄蛆蚰蛉蠣蚫蛔蛞蛩蛬蛟蛛蛯蜒蜆蜈蜀蜃蛻蜑蜉蜍蛹蜊蜴蜿蜷蜻蜥蜩蜚蝠蝟蝸蝌蝎蝴蝗蝨蝮蝙\"],\n[\"eaa1\",\"蝓蝣蝪蠅螢螟螂螯蟋螽蟀蟐雖螫蟄螳蟇蟆螻蟯蟲蟠蠏蠍蟾蟶蟷蠎蟒蠑蠖蠕蠢蠡蠱蠶蠹蠧蠻衄衂衒衙衞衢衫袁衾袞衵衽袵衲袂袗袒袮袙袢袍袤袰袿袱裃裄裔裘裙裝裹褂裼裴裨裲褄褌褊褓襃褞褥褪褫襁襄褻褶褸襌褝襠襞\"],\n[\"eba1\",\"襦襤襭襪襯襴襷襾覃覈覊覓覘覡覩覦覬覯覲覺覽覿觀觚觜觝觧觴觸訃訖訐訌訛訝訥訶詁詛詒詆詈詼詭詬詢誅誂誄誨誡誑誥誦誚誣諄諍諂諚諫諳諧諤諱謔諠諢諷諞諛謌謇謚諡謖謐謗謠謳鞫謦謫謾謨譁譌譏譎證譖譛譚譫\"],\n[\"eca1\",\"譟譬譯譴譽讀讌讎讒讓讖讙讚谺豁谿豈豌豎豐豕豢豬豸豺貂貉貅貊貍貎貔豼貘戝貭貪貽貲貳貮貶賈賁賤賣賚賽賺賻贄贅贊贇贏贍贐齎贓賍贔贖赧赭赱赳趁趙跂趾趺跏跚跖跌跛跋跪跫跟跣跼踈踉跿踝踞踐踟蹂踵踰踴蹊\"],\n[\"eda1\",\"蹇蹉蹌蹐蹈蹙蹤蹠踪蹣蹕蹶蹲蹼躁躇躅躄躋躊躓躑躔躙躪躡躬躰軆躱躾軅軈軋軛軣軼軻軫軾輊輅輕輒輙輓輜輟輛輌輦輳輻輹轅轂輾轌轉轆轎轗轜轢轣轤辜辟辣辭辯辷迚迥迢迪迯邇迴逅迹迺逑逕逡逍逞逖逋逧逶逵逹迸\"],\n[\"eea1\",\"遏遐遑遒逎遉逾遖遘遞遨遯遶隨遲邂遽邁邀邊邉邏邨邯邱邵郢郤扈郛鄂鄒鄙鄲鄰酊酖酘酣酥酩酳酲醋醉醂醢醫醯醪醵醴醺釀釁釉釋釐釖釟釡釛釼釵釶鈞釿鈔鈬鈕鈑鉞鉗鉅鉉鉤鉈銕鈿鉋鉐銜銖銓銛鉚鋏銹銷鋩錏鋺鍄錮\"],\n[\"efa1\",\"錙錢錚錣錺錵錻鍜鍠鍼鍮鍖鎰鎬鎭鎔鎹鏖鏗鏨鏥鏘鏃鏝鏐鏈鏤鐚鐔鐓鐃鐇鐐鐶鐫鐵鐡鐺鑁鑒鑄鑛鑠鑢鑞鑪鈩鑰鑵鑷鑽鑚鑼鑾钁鑿閂閇閊閔閖閘閙閠閨閧閭閼閻閹閾闊濶闃闍闌闕闔闖關闡闥闢阡阨阮阯陂陌陏陋陷陜陞\"],\n[\"f0a1\",\"陝陟陦陲陬隍隘隕隗險隧隱隲隰隴隶隸隹雎雋雉雍襍雜霍雕雹霄霆霈霓霎霑霏霖霙霤霪霰霹霽霾靄靆靈靂靉靜靠靤靦靨勒靫靱靹鞅靼鞁靺鞆鞋鞏鞐鞜鞨鞦鞣鞳鞴韃韆韈韋韜韭齏韲竟韶韵頏頌頸頤頡頷頽顆顏顋顫顯顰\"],\n[\"f1a1\",\"顱顴顳颪颯颱颶飄飃飆飩飫餃餉餒餔餘餡餝餞餤餠餬餮餽餾饂饉饅饐饋饑饒饌饕馗馘馥馭馮馼駟駛駝駘駑駭駮駱駲駻駸騁騏騅駢騙騫騷驅驂驀驃騾驕驍驛驗驟驢驥驤驩驫驪骭骰骼髀髏髑髓體髞髟髢髣髦髯髫髮髴髱髷\"],\n[\"f2a1\",\"髻鬆鬘鬚鬟鬢鬣鬥鬧鬨鬩鬪鬮鬯鬲魄魃魏魍魎魑魘魴鮓鮃鮑鮖鮗鮟鮠鮨鮴鯀鯊鮹鯆鯏鯑鯒鯣鯢鯤鯔鯡鰺鯲鯱鯰鰕鰔鰉鰓鰌鰆鰈鰒鰊鰄鰮鰛鰥鰤鰡鰰鱇鰲鱆鰾鱚鱠鱧鱶鱸鳧鳬鳰鴉鴈鳫鴃鴆鴪鴦鶯鴣鴟鵄鴕鴒鵁鴿鴾鵆鵈\"],\n[\"f3a1\",\"鵝鵞鵤鵑鵐鵙鵲鶉鶇鶫鵯鵺鶚鶤鶩鶲鷄鷁鶻鶸鶺鷆鷏鷂鷙鷓鷸鷦鷭鷯鷽鸚鸛鸞鹵鹹鹽麁麈麋麌麒麕麑麝麥麩麸麪麭靡黌黎黏黐黔黜點黝黠黥黨黯黴黶黷黹黻黼黽鼇鼈皷鼕鼡鼬鼾齊齒齔齣齟齠齡齦齧齬齪齷齲齶龕龜龠\"],\n[\"f4a1\",\"堯槇遙瑤凜熙\"],\n[\"f9a1\",\"纊褜鍈銈蓜俉炻昱棈鋹曻彅丨仡仼伀伃伹佖侒侊侚侔俍偀倢俿倞偆偰偂傔僴僘兊兤冝冾凬刕劜劦勀勛匀匇匤卲厓厲叝﨎咜咊咩哿喆坙坥垬埈埇﨏塚增墲夋奓奛奝奣妤妺孖寀甯寘寬尞岦岺峵崧嵓﨑嵂嵭嶸嶹巐弡弴彧德\"],\n[\"faa1\",\"忞恝悅悊惞惕愠惲愑愷愰憘戓抦揵摠撝擎敎昀昕昻昉昮昞昤晥晗晙晴晳暙暠暲暿曺朎朗杦枻桒柀栁桄棏﨓楨﨔榘槢樰橫橆橳橾櫢櫤毖氿汜沆汯泚洄涇浯涖涬淏淸淲淼渹湜渧渼溿澈澵濵瀅瀇瀨炅炫焏焄煜煆煇凞燁燾犱\"],\n[\"fba1\",\"犾猤猪獷玽珉珖珣珒琇珵琦琪琩琮瑢璉璟甁畯皂皜皞皛皦益睆劯砡硎硤硺礰礼神祥禔福禛竑竧靖竫箞精絈絜綷綠緖繒罇羡羽茁荢荿菇菶葈蒴蕓蕙蕫﨟薰蘒﨡蠇裵訒訷詹誧誾諟諸諶譓譿賰賴贒赶﨣軏﨤逸遧郞都鄕鄧釚\"],\n[\"fca1\",\"釗釞釭釮釤釥鈆鈐鈊鈺鉀鈼鉎鉙鉑鈹鉧銧鉷鉸鋧鋗鋙鋐﨧鋕鋠鋓錥錡鋻﨨錞鋿錝錂鍰鍗鎤鏆鏞鏸鐱鑅鑈閒隆﨩隝隯霳霻靃靍靏靑靕顗顥飯飼餧館馞驎髙髜魵魲鮏鮱鮻鰀鵰鵫鶴鸙黑\"],\n[\"fcf1\",\"ⅰ\",9,\"￢￤＇＂\"],\n[\"8fa2af\",\"˘ˇ¸˙˝¯˛˚～΄΅\"],\n[\"8fa2c2\",\"¡¦¿\"],\n[\"8fa2eb\",\"ºª©®™¤№\"],\n[\"8fa6e1\",\"ΆΈΉΊΪ\"],\n[\"8fa6e7\",\"Ό\"],\n[\"8fa6e9\",\"ΎΫ\"],\n[\"8fa6ec\",\"Ώ\"],\n[\"8fa6f1\",\"άέήίϊΐόςύϋΰώ\"],\n[\"8fa7c2\",\"Ђ\",10,\"ЎЏ\"],\n[\"8fa7f2\",\"ђ\",10,\"ўџ\"],\n[\"8fa9a1\",\"ÆĐ\"],\n[\"8fa9a4\",\"Ħ\"],\n[\"8fa9a6\",\"Ĳ\"],\n[\"8fa9a8\",\"ŁĿ\"],\n[\"8fa9ab\",\"ŊØŒ\"],\n[\"8fa9af\",\"ŦÞ\"],\n[\"8fa9c1\",\"æđðħıĳĸłŀŉŋøœßŧþ\"],\n[\"8faaa1\",\"ÁÀÄÂĂǍĀĄÅÃĆĈČÇĊĎÉÈËÊĚĖĒĘ\"],\n[\"8faaba\",\"ĜĞĢĠĤÍÌÏÎǏİĪĮĨĴĶĹĽĻŃŇŅÑÓÒÖÔǑŐŌÕŔŘŖŚŜŠŞŤŢÚÙÜÛŬǓŰŪŲŮŨǗǛǙǕŴÝŸŶŹŽŻ\"],\n[\"8faba1\",\"áàäâăǎāąåãćĉčçċďéèëêěėēęǵĝğ\"],\n[\"8fabbd\",\"ġĥíìïîǐ\"],\n[\"8fabc5\",\"īįĩĵķĺľļńňņñóòöôǒőōõŕřŗśŝšşťţúùüûŭǔűūųůũǘǜǚǖŵýÿŷźžż\"],\n[\"8fb0a1\",\"丂丄丅丌丒丟丣两丨丫丮丯丰丵乀乁乄乇乑乚乜乣乨乩乴乵乹乿亍亖亗亝亯亹仃仐仚仛仠仡仢仨仯仱仳仵份仾仿伀伂伃伈伋伌伒伕伖众伙伮伱你伳伵伷伹伻伾佀佂佈佉佋佌佒佔佖佘佟佣佪佬佮佱佷佸佹佺佽佾侁侂侄\"],\n[\"8fb1a1\",\"侅侉侊侌侎侐侒侓侔侗侙侚侞侟侲侷侹侻侼侽侾俀俁俅俆俈俉俋俌俍俏俒俜俠俢俰俲俼俽俿倀倁倄倇倊倌倎倐倓倗倘倛倜倝倞倢倧倮倰倲倳倵偀偁偂偅偆偊偌偎偑偒偓偗偙偟偠偢偣偦偧偪偭偰偱倻傁傃傄傆傊傎傏傐\"],\n[\"8fb2a1\",\"傒傓傔傖傛傜傞\",4,\"傪傯傰傹傺傽僀僃僄僇僌僎僐僓僔僘僜僝僟僢僤僦僨僩僯僱僶僺僾儃儆儇儈儋儌儍儎僲儐儗儙儛儜儝儞儣儧儨儬儭儯儱儳儴儵儸儹兂兊兏兓兕兗兘兟兤兦兾冃冄冋冎冘冝冡冣冭冸冺冼冾冿凂\"],\n[\"8fb3a1\",\"凈减凑凒凓凕凘凞凢凥凮凲凳凴凷刁刂刅划刓刕刖刘刢刨刱刲刵刼剅剉剕剗剘剚剜剟剠剡剦剮剷剸剹劀劂劅劊劌劓劕劖劗劘劚劜劤劥劦劧劯劰劶劷劸劺劻劽勀勄勆勈勌勏勑勔勖勛勜勡勥勨勩勪勬勰勱勴勶勷匀匃匊匋\"],\n[\"8fb4a1\",\"匌匑匓匘匛匜匞匟匥匧匨匩匫匬匭匰匲匵匼匽匾卂卌卋卙卛卡卣卥卬卭卲卹卾厃厇厈厎厓厔厙厝厡厤厪厫厯厲厴厵厷厸厺厽叀叅叏叒叓叕叚叝叞叠另叧叵吂吓吚吡吧吨吪启吱吴吵呃呄呇呍呏呞呢呤呦呧呩呫呭呮呴呿\"],\n[\"8fb5a1\",\"咁咃咅咈咉咍咑咕咖咜咟咡咦咧咩咪咭咮咱咷咹咺咻咿哆哊响哎哠哪哬哯哶哼哾哿唀唁唅唈唉唌唍唎唕唪唫唲唵唶唻唼唽啁啇啉啊啍啐啑啘啚啛啞啠啡啤啦啿喁喂喆喈喎喏喑喒喓喔喗喣喤喭喲喿嗁嗃嗆嗉嗋嗌嗎嗑嗒\"],\n[\"8fb6a1\",\"嗓嗗嗘嗛嗞嗢嗩嗶嗿嘅嘈嘊嘍\",5,\"嘙嘬嘰嘳嘵嘷嘹嘻嘼嘽嘿噀噁噃噄噆噉噋噍噏噔噞噠噡噢噣噦噩噭噯噱噲噵嚄嚅嚈嚋嚌嚕嚙嚚嚝嚞嚟嚦嚧嚨嚩嚫嚬嚭嚱嚳嚷嚾囅囉囊囋囏囐囌囍囙囜囝囟囡囤\",4,\"囱囫园\"],\n[\"8fb7a1\",\"囶囷圁圂圇圊圌圑圕圚圛圝圠圢圣圤圥圩圪圬圮圯圳圴圽圾圿坅坆坌坍坒坢坥坧坨坫坭\",4,\"坳坴坵坷坹坺坻坼坾垁垃垌垔垗垙垚垜垝垞垟垡垕垧垨垩垬垸垽埇埈埌埏埕埝埞埤埦埧埩埭埰埵埶埸埽埾埿堃堄堈堉埡\"],\n[\"8fb8a1\",\"堌堍堛堞堟堠堦堧堭堲堹堿塉塌塍塏塐塕塟塡塤塧塨塸塼塿墀墁墇墈墉墊墌墍墏墐墔墖墝墠墡墢墦墩墱墲壄墼壂壈壍壎壐壒壔壖壚壝壡壢壩壳夅夆夋夌夒夓夔虁夝夡夣夤夨夯夰夳夵夶夿奃奆奒奓奙奛奝奞奟奡奣奫奭\"],\n[\"8fb9a1\",\"奯奲奵奶她奻奼妋妌妎妒妕妗妟妤妧妭妮妯妰妳妷妺妼姁姃姄姈姊姍姒姝姞姟姣姤姧姮姯姱姲姴姷娀娄娌娍娎娒娓娞娣娤娧娨娪娭娰婄婅婇婈婌婐婕婞婣婥婧婭婷婺婻婾媋媐媓媖媙媜媞媟媠媢媧媬媱媲媳媵媸媺媻媿\"],\n[\"8fbaa1\",\"嫄嫆嫈嫏嫚嫜嫠嫥嫪嫮嫵嫶嫽嬀嬁嬈嬗嬴嬙嬛嬝嬡嬥嬭嬸孁孋孌孒孖孞孨孮孯孼孽孾孿宁宄宆宊宎宐宑宓宔宖宨宩宬宭宯宱宲宷宺宼寀寁寍寏寖\",4,\"寠寯寱寴寽尌尗尞尟尣尦尩尫尬尮尰尲尵尶屙屚屜屢屣屧屨屩\"],\n[\"8fbba1\",\"屭屰屴屵屺屻屼屽岇岈岊岏岒岝岟岠岢岣岦岪岲岴岵岺峉峋峒峝峗峮峱峲峴崁崆崍崒崫崣崤崦崧崱崴崹崽崿嵂嵃嵆嵈嵕嵑嵙嵊嵟嵠嵡嵢嵤嵪嵭嵰嵹嵺嵾嵿嶁嶃嶈嶊嶒嶓嶔嶕嶙嶛嶟嶠嶧嶫嶰嶴嶸嶹巃巇巋巐巎巘巙巠巤\"],\n[\"8fbca1\",\"巩巸巹帀帇帍帒帔帕帘帟帠帮帨帲帵帾幋幐幉幑幖幘幛幜幞幨幪\",4,\"幰庀庋庎庢庤庥庨庪庬庱庳庽庾庿廆廌廋廎廑廒廔廕廜廞廥廫异弆弇弈弎弙弜弝弡弢弣弤弨弫弬弮弰弴弶弻弽弿彀彄彅彇彍彐彔彘彛彠彣彤彧\"],\n[\"8fbda1\",\"彯彲彴彵彸彺彽彾徉徍徏徖徜徝徢徧徫徤徬徯徰徱徸忄忇忈忉忋忐\",4,\"忞忡忢忨忩忪忬忭忮忯忲忳忶忺忼怇怊怍怓怔怗怘怚怟怤怭怳怵恀恇恈恉恌恑恔恖恗恝恡恧恱恾恿悂悆悈悊悎悑悓悕悘悝悞悢悤悥您悰悱悷\"],\n[\"8fbea1\",\"悻悾惂惄惈惉惊惋惎惏惔惕惙惛惝惞惢惥惲惵惸惼惽愂愇愊愌愐\",4,\"愖愗愙愜愞愢愪愫愰愱愵愶愷愹慁慅慆慉慞慠慬慲慸慻慼慿憀憁憃憄憋憍憒憓憗憘憜憝憟憠憥憨憪憭憸憹憼懀懁懂懎懏懕懜懝懞懟懡懢懧懩懥\"],\n[\"8fbfa1\",\"懬懭懯戁戃戄戇戓戕戜戠戢戣戧戩戫戹戽扂扃扄扆扌扐扑扒扔扖扚扜扤扭扯扳扺扽抍抎抏抐抦抨抳抶抷抺抾抿拄拎拕拖拚拪拲拴拼拽挃挄挊挋挍挐挓挖挘挩挪挭挵挶挹挼捁捂捃捄捆捊捋捎捒捓捔捘捛捥捦捬捭捱捴捵\"],\n[\"8fc0a1\",\"捸捼捽捿掂掄掇掊掐掔掕掙掚掞掤掦掭掮掯掽揁揅揈揎揑揓揔揕揜揠揥揪揬揲揳揵揸揹搉搊搐搒搔搘搞搠搢搤搥搩搪搯搰搵搽搿摋摏摑摒摓摔摚摛摜摝摟摠摡摣摭摳摴摻摽撅撇撏撐撑撘撙撛撝撟撡撣撦撨撬撳撽撾撿\"],\n[\"8fc1a1\",\"擄擉擊擋擌擎擐擑擕擗擤擥擩擪擭擰擵擷擻擿攁攄攈攉攊攏攓攔攖攙攛攞攟攢攦攩攮攱攺攼攽敃敇敉敐敒敔敟敠敧敫敺敽斁斅斊斒斕斘斝斠斣斦斮斲斳斴斿旂旈旉旎旐旔旖旘旟旰旲旴旵旹旾旿昀昄昈昉昍昑昒昕昖昝\"],\n[\"8fc2a1\",\"昞昡昢昣昤昦昩昪昫昬昮昰昱昳昹昷晀晅晆晊晌晑晎晗晘晙晛晜晠晡曻晪晫晬晾晳晵晿晷晸晹晻暀晼暋暌暍暐暒暙暚暛暜暟暠暤暭暱暲暵暻暿曀曂曃曈曌曎曏曔曛曟曨曫曬曮曺朅朇朎朓朙朜朠朢朳朾杅杇杈杌杔杕杝\"],\n[\"8fc3a1\",\"杦杬杮杴杶杻极构枎枏枑枓枖枘枙枛枰枱枲枵枻枼枽柹柀柂柃柅柈柉柒柗柙柜柡柦柰柲柶柷桒栔栙栝栟栨栧栬栭栯栰栱栳栻栿桄桅桊桌桕桗桘桛桫桮\",4,\"桵桹桺桻桼梂梄梆梈梖梘梚梜梡梣梥梩梪梮梲梻棅棈棌棏\"],\n[\"8fc4a1\",\"棐棑棓棖棙棜棝棥棨棪棫棬棭棰棱棵棶棻棼棽椆椉椊椐椑椓椖椗椱椳椵椸椻楂楅楉楎楗楛楣楤楥楦楨楩楬楰楱楲楺楻楿榀榍榒榖榘榡榥榦榨榫榭榯榷榸榺榼槅槈槑槖槗槢槥槮槯槱槳槵槾樀樁樃樏樑樕樚樝樠樤樨樰樲\"],\n[\"8fc5a1\",\"樴樷樻樾樿橅橆橉橊橎橐橑橒橕橖橛橤橧橪橱橳橾檁檃檆檇檉檋檑檛檝檞檟檥檫檯檰檱檴檽檾檿櫆櫉櫈櫌櫐櫔櫕櫖櫜櫝櫤櫧櫬櫰櫱櫲櫼櫽欂欃欆欇欉欏欐欑欗欛欞欤欨欫欬欯欵欶欻欿歆歊歍歒歖歘歝歠歧歫歮歰歵歽\"],\n[\"8fc6a1\",\"歾殂殅殗殛殟殠殢殣殨殩殬殭殮殰殸殹殽殾毃毄毉毌毖毚毡毣毦毧毮毱毷毹毿氂氄氅氉氍氎氐氒氙氟氦氧氨氬氮氳氵氶氺氻氿汊汋汍汏汒汔汙汛汜汫汭汯汴汶汸汹汻沅沆沇沉沔沕沗沘沜沟沰沲沴泂泆泍泏泐泑泒泔泖\"],\n[\"8fc7a1\",\"泚泜泠泧泩泫泬泮泲泴洄洇洊洎洏洑洓洚洦洧洨汧洮洯洱洹洼洿浗浞浟浡浥浧浯浰浼涂涇涑涒涔涖涗涘涪涬涴涷涹涽涿淄淈淊淎淏淖淛淝淟淠淢淥淩淯淰淴淶淼渀渄渞渢渧渲渶渹渻渼湄湅湈湉湋湏湑湒湓湔湗湜湝湞\"],\n[\"8fc8a1\",\"湢湣湨湳湻湽溍溓溙溠溧溭溮溱溳溻溿滀滁滃滇滈滊滍滎滏滫滭滮滹滻滽漄漈漊漌漍漖漘漚漛漦漩漪漯漰漳漶漻漼漭潏潑潒潓潗潙潚潝潞潡潢潨潬潽潾澃澇澈澋澌澍澐澒澓澔澖澚澟澠澥澦澧澨澮澯澰澵澶澼濅濇濈濊\"],\n[\"8fc9a1\",\"濚濞濨濩濰濵濹濼濽瀀瀅瀆瀇瀍瀗瀠瀣瀯瀴瀷瀹瀼灃灄灈灉灊灋灔灕灝灞灎灤灥灬灮灵灶灾炁炅炆炔\",4,\"炛炤炫炰炱炴炷烊烑烓烔烕烖烘烜烤烺焃\",4,\"焋焌焏焞焠焫焭焯焰焱焸煁煅煆煇煊煋煐煒煗煚煜煞煠\"],\n[\"8fcaa1\",\"煨煹熀熅熇熌熒熚熛熠熢熯熰熲熳熺熿燀燁燄燋燌燓燖燙燚燜燸燾爀爇爈爉爓爗爚爝爟爤爫爯爴爸爹牁牂牃牅牎牏牐牓牕牖牚牜牞牠牣牨牫牮牯牱牷牸牻牼牿犄犉犍犎犓犛犨犭犮犱犴犾狁狇狉狌狕狖狘狟狥狳狴狺狻\"],\n[\"8fcba1\",\"狾猂猄猅猇猋猍猒猓猘猙猞猢猤猧猨猬猱猲猵猺猻猽獃獍獐獒獖獘獝獞獟獠獦獧獩獫獬獮獯獱獷獹獼玀玁玃玅玆玎玐玓玕玗玘玜玞玟玠玢玥玦玪玫玭玵玷玹玼玽玿珅珆珉珋珌珏珒珓珖珙珝珡珣珦珧珩珴珵珷珹珺珻珽\"],\n[\"8fcca1\",\"珿琀琁琄琇琊琑琚琛琤琦琨\",9,\"琹瑀瑃瑄瑆瑇瑋瑍瑑瑒瑗瑝瑢瑦瑧瑨瑫瑭瑮瑱瑲璀璁璅璆璇璉璏璐璑璒璘璙璚璜璟璠璡璣璦璨璩璪璫璮璯璱璲璵璹璻璿瓈瓉瓌瓐瓓瓘瓚瓛瓞瓟瓤瓨瓪瓫瓯瓴瓺瓻瓼瓿甆\"],\n[\"8fcda1\",\"甒甖甗甠甡甤甧甩甪甯甶甹甽甾甿畀畃畇畈畎畐畒畗畞畟畡畯畱畹\",5,\"疁疅疐疒疓疕疙疜疢疤疴疺疿痀痁痄痆痌痎痏痗痜痟痠痡痤痧痬痮痯痱痹瘀瘂瘃瘄瘇瘈瘊瘌瘏瘒瘓瘕瘖瘙瘛瘜瘝瘞瘣瘥瘦瘩瘭瘲瘳瘵瘸瘹\"],\n[\"8fcea1\",\"瘺瘼癊癀癁癃癄癅癉癋癕癙癟癤癥癭癮癯癱癴皁皅皌皍皕皛皜皝皟皠皢\",6,\"皪皭皽盁盅盉盋盌盎盔盙盠盦盨盬盰盱盶盹盼眀眆眊眎眒眔眕眗眙眚眜眢眨眭眮眯眴眵眶眹眽眾睂睅睆睊睍睎睏睒睖睗睜睞睟睠睢\"],\n[\"8fcfa1\",\"睤睧睪睬睰睲睳睴睺睽瞀瞄瞌瞍瞔瞕瞖瞚瞟瞢瞧瞪瞮瞯瞱瞵瞾矃矉矑矒矕矙矞矟矠矤矦矪矬矰矱矴矸矻砅砆砉砍砎砑砝砡砢砣砭砮砰砵砷硃硄硇硈硌硎硒硜硞硠硡硣硤硨硪确硺硾碊碏碔碘碡碝碞碟碤碨碬碭碰碱碲碳\"],\n[\"8fd0a1\",\"碻碽碿磇磈磉磌磎磒磓磕磖磤磛磟磠磡磦磪磲磳礀磶磷磺磻磿礆礌礐礚礜礞礟礠礥礧礩礭礱礴礵礻礽礿祄祅祆祊祋祏祑祔祘祛祜祧祩祫祲祹祻祼祾禋禌禑禓禔禕禖禘禛禜禡禨禩禫禯禱禴禸离秂秄秇秈秊秏秔秖秚秝秞\"],\n[\"8fd1a1\",\"秠秢秥秪秫秭秱秸秼稂稃稇稉稊稌稑稕稛稞稡稧稫稭稯稰稴稵稸稹稺穄穅穇穈穌穕穖穙穜穝穟穠穥穧穪穭穵穸穾窀窂窅窆窊窋窐窑窔窞窠窣窬窳窵窹窻窼竆竉竌竎竑竛竨竩竫竬竱竴竻竽竾笇笔笟笣笧笩笪笫笭笮笯笰\"],\n[\"8fd2a1\",\"笱笴笽笿筀筁筇筎筕筠筤筦筩筪筭筯筲筳筷箄箉箎箐箑箖箛箞箠箥箬箯箰箲箵箶箺箻箼箽篂篅篈篊篔篖篗篙篚篛篨篪篲篴篵篸篹篺篼篾簁簂簃簄簆簉簋簌簎簏簙簛簠簥簦簨簬簱簳簴簶簹簺籆籊籕籑籒籓籙\",5],\n[\"8fd3a1\",\"籡籣籧籩籭籮籰籲籹籼籽粆粇粏粔粞粠粦粰粶粷粺粻粼粿糄糇糈糉糍糏糓糔糕糗糙糚糝糦糩糫糵紃紇紈紉紏紑紒紓紖紝紞紣紦紪紭紱紼紽紾絀絁絇絈絍絑絓絗絙絚絜絝絥絧絪絰絸絺絻絿綁綂綃綅綆綈綋綌綍綑綖綗綝\"],\n[\"8fd4a1\",\"綞綦綧綪綳綶綷綹緂\",4,\"緌緍緎緗緙縀緢緥緦緪緫緭緱緵緶緹緺縈縐縑縕縗縜縝縠縧縨縬縭縯縳縶縿繄繅繇繎繐繒繘繟繡繢繥繫繮繯繳繸繾纁纆纇纊纍纑纕纘纚纝纞缼缻缽缾缿罃罄罇罏罒罓罛罜罝罡罣罤罥罦罭\"],\n[\"8fd5a1\",\"罱罽罾罿羀羋羍羏羐羑羖羗羜羡羢羦羪羭羴羼羿翀翃翈翎翏翛翟翣翥翨翬翮翯翲翺翽翾翿耇耈耊耍耎耏耑耓耔耖耝耞耟耠耤耦耬耮耰耴耵耷耹耺耼耾聀聄聠聤聦聭聱聵肁肈肎肜肞肦肧肫肸肹胈胍胏胒胔胕胗胘胠胭胮\"],\n[\"8fd6a1\",\"胰胲胳胶胹胺胾脃脋脖脗脘脜脞脠脤脧脬脰脵脺脼腅腇腊腌腒腗腠腡腧腨腩腭腯腷膁膐膄膅膆膋膎膖膘膛膞膢膮膲膴膻臋臃臅臊臎臏臕臗臛臝臞臡臤臫臬臰臱臲臵臶臸臹臽臿舀舃舏舓舔舙舚舝舡舢舨舲舴舺艃艄艅艆\"],\n[\"8fd7a1\",\"艋艎艏艑艖艜艠艣艧艭艴艻艽艿芀芁芃芄芇芉芊芎芑芔芖芘芚芛芠芡芣芤芧芨芩芪芮芰芲芴芷芺芼芾芿苆苐苕苚苠苢苤苨苪苭苯苶苷苽苾茀茁茇茈茊茋荔茛茝茞茟茡茢茬茭茮茰茳茷茺茼茽荂荃荄荇荍荎荑荕荖荗荰荸\"],\n[\"8fd8a1\",\"荽荿莀莂莄莆莍莒莔莕莘莙莛莜莝莦莧莩莬莾莿菀菇菉菏菐菑菔菝荓菨菪菶菸菹菼萁萆萊萏萑萕萙莭萯萹葅葇葈葊葍葏葑葒葖葘葙葚葜葠葤葥葧葪葰葳葴葶葸葼葽蒁蒅蒒蒓蒕蒞蒦蒨蒩蒪蒯蒱蒴蒺蒽蒾蓀蓂蓇蓈蓌蓏蓓\"],\n[\"8fd9a1\",\"蓜蓧蓪蓯蓰蓱蓲蓷蔲蓺蓻蓽蔂蔃蔇蔌蔎蔐蔜蔞蔢蔣蔤蔥蔧蔪蔫蔯蔳蔴蔶蔿蕆蕏\",4,\"蕖蕙蕜\",6,\"蕤蕫蕯蕹蕺蕻蕽蕿薁薅薆薉薋薌薏薓薘薝薟薠薢薥薧薴薶薷薸薼薽薾薿藂藇藊藋藎薭藘藚藟藠藦藨藭藳藶藼\"],\n[\"8fdaa1\",\"藿蘀蘄蘅蘍蘎蘐蘑蘒蘘蘙蘛蘞蘡蘧蘩蘶蘸蘺蘼蘽虀虂虆虒虓虖虗虘虙虝虠\",4,\"虩虬虯虵虶虷虺蚍蚑蚖蚘蚚蚜蚡蚦蚧蚨蚭蚱蚳蚴蚵蚷蚸蚹蚿蛀蛁蛃蛅蛑蛒蛕蛗蛚蛜蛠蛣蛥蛧蚈蛺蛼蛽蜄蜅蜇蜋蜎蜏蜐蜓蜔蜙蜞蜟蜡蜣\"],\n[\"8fdba1\",\"蜨蜮蜯蜱蜲蜹蜺蜼蜽蜾蝀蝃蝅蝍蝘蝝蝡蝤蝥蝯蝱蝲蝻螃\",6,\"螋螌螐螓螕螗螘螙螞螠螣螧螬螭螮螱螵螾螿蟁蟈蟉蟊蟎蟕蟖蟙蟚蟜蟟蟢蟣蟤蟪蟫蟭蟱蟳蟸蟺蟿蠁蠃蠆蠉蠊蠋蠐蠙蠒蠓蠔蠘蠚蠛蠜蠞蠟蠨蠭蠮蠰蠲蠵\"],\n[\"8fdca1\",\"蠺蠼衁衃衅衈衉衊衋衎衑衕衖衘衚衜衟衠衤衩衱衹衻袀袘袚袛袜袟袠袨袪袺袽袾裀裊\",4,\"裑裒裓裛裞裧裯裰裱裵裷褁褆褍褎褏褕褖褘褙褚褜褠褦褧褨褰褱褲褵褹褺褾襀襂襅襆襉襏襒襗襚襛襜襡襢襣襫襮襰襳襵襺\"],\n[\"8fdda1\",\"襻襼襽覉覍覐覔覕覛覜覟覠覥覰覴覵覶覷覼觔\",4,\"觥觩觫觭觱觳觶觹觽觿訄訅訇訏訑訒訔訕訞訠訢訤訦訫訬訯訵訷訽訾詀詃詅詇詉詍詎詓詖詗詘詜詝詡詥詧詵詶詷詹詺詻詾詿誀誃誆誋誏誐誒誖誗誙誟誧誩誮誯誳\"],\n[\"8fdea1\",\"誶誷誻誾諃諆諈諉諊諑諓諔諕諗諝諟諬諰諴諵諶諼諿謅謆謋謑謜謞謟謊謭謰謷謼譂\",4,\"譈譒譓譔譙譍譞譣譭譶譸譹譼譾讁讄讅讋讍讏讔讕讜讞讟谸谹谽谾豅豇豉豋豏豑豓豔豗豘豛豝豙豣豤豦豨豩豭豳豵豶豻豾貆\"],\n[\"8fdfa1\",\"貇貋貐貒貓貙貛貜貤貹貺賅賆賉賋賏賖賕賙賝賡賨賬賯賰賲賵賷賸賾賿贁贃贉贒贗贛赥赩赬赮赿趂趄趈趍趐趑趕趞趟趠趦趫趬趯趲趵趷趹趻跀跅跆跇跈跊跎跑跔跕跗跙跤跥跧跬跰趼跱跲跴跽踁踄踅踆踋踑踔踖踠踡踢\"],\n[\"8fe0a1\",\"踣踦踧踱踳踶踷踸踹踽蹀蹁蹋蹍蹎蹏蹔蹛蹜蹝蹞蹡蹢蹩蹬蹭蹯蹰蹱蹹蹺蹻躂躃躉躐躒躕躚躛躝躞躢躧躩躭躮躳躵躺躻軀軁軃軄軇軏軑軔軜軨軮軰軱軷軹軺軭輀輂輇輈輏輐輖輗輘輞輠輡輣輥輧輨輬輭輮輴輵輶輷輺轀轁\"],\n[\"8fe1a1\",\"轃轇轏轑\",4,\"轘轝轞轥辝辠辡辤辥辦辵辶辸达迀迁迆迊迋迍运迒迓迕迠迣迤迨迮迱迵迶迻迾适逄逈逌逘逛逨逩逯逪逬逭逳逴逷逿遃遄遌遛遝遢遦遧遬遰遴遹邅邈邋邌邎邐邕邗邘邙邛邠邡邢邥邰邲邳邴邶邽郌邾郃\"],\n[\"8fe2a1\",\"郄郅郇郈郕郗郘郙郜郝郟郥郒郶郫郯郰郴郾郿鄀鄄鄅鄆鄈鄍鄐鄔鄖鄗鄘鄚鄜鄞鄠鄥鄢鄣鄧鄩鄮鄯鄱鄴鄶鄷鄹鄺鄼鄽酃酇酈酏酓酗酙酚酛酡酤酧酭酴酹酺酻醁醃醅醆醊醎醑醓醔醕醘醞醡醦醨醬醭醮醰醱醲醳醶醻醼醽醿\"],\n[\"8fe3a1\",\"釂釃釅釓釔釗釙釚釞釤釥釩釪釬\",5,\"釷釹釻釽鈀鈁鈄鈅鈆鈇鈉鈊鈌鈐鈒鈓鈖鈘鈜鈝鈣鈤鈥鈦鈨鈮鈯鈰鈳鈵鈶鈸鈹鈺鈼鈾鉀鉂鉃鉆鉇鉊鉍鉎鉏鉑鉘鉙鉜鉝鉠鉡鉥鉧鉨鉩鉮鉯鉰鉵\",4,\"鉻鉼鉽鉿銈銉銊銍銎銒銗\"],\n[\"8fe4a1\",\"銙銟銠銤銥銧銨銫銯銲銶銸銺銻銼銽銿\",4,\"鋅鋆鋇鋈鋋鋌鋍鋎鋐鋓鋕鋗鋘鋙鋜鋝鋟鋠鋡鋣鋥鋧鋨鋬鋮鋰鋹鋻鋿錀錂錈錍錑錔錕錜錝錞錟錡錤錥錧錩錪錳錴錶錷鍇鍈鍉鍐鍑鍒鍕鍗鍘鍚鍞鍤鍥鍧鍩鍪鍭鍯鍰鍱鍳鍴鍶\"],\n[\"8fe5a1\",\"鍺鍽鍿鎀鎁鎂鎈鎊鎋鎍鎏鎒鎕鎘鎛鎞鎡鎣鎤鎦鎨鎫鎴鎵鎶鎺鎩鏁鏄鏅鏆鏇鏉\",4,\"鏓鏙鏜鏞鏟鏢鏦鏧鏹鏷鏸鏺鏻鏽鐁鐂鐄鐈鐉鐍鐎鐏鐕鐖鐗鐟鐮鐯鐱鐲鐳鐴鐻鐿鐽鑃鑅鑈鑊鑌鑕鑙鑜鑟鑡鑣鑨鑫鑭鑮鑯鑱鑲钄钃镸镹\"],\n[\"8fe6a1\",\"镾閄閈閌閍閎閝閞閟閡閦閩閫閬閴閶閺閽閿闆闈闉闋闐闑闒闓闙闚闝闞闟闠闤闦阝阞阢阤阥阦阬阱阳阷阸阹阺阼阽陁陒陔陖陗陘陡陮陴陻陼陾陿隁隂隃隄隉隑隖隚隝隟隤隥隦隩隮隯隳隺雊雒嶲雘雚雝雞雟雩雯雱雺霂\"],\n[\"8fe7a1\",\"霃霅霉霚霛霝霡霢霣霨霱霳靁靃靊靎靏靕靗靘靚靛靣靧靪靮靳靶靷靸靻靽靿鞀鞉鞕鞖鞗鞙鞚鞞鞟鞢鞬鞮鞱鞲鞵鞶鞸鞹鞺鞼鞾鞿韁韄韅韇韉韊韌韍韎韐韑韔韗韘韙韝韞韠韛韡韤韯韱韴韷韸韺頇頊頙頍頎頔頖頜頞頠頣頦\"],\n[\"8fe8a1\",\"頫頮頯頰頲頳頵頥頾顄顇顊顑顒顓顖顗顙顚顢顣顥顦顪顬颫颭颮颰颴颷颸颺颻颿飂飅飈飌飡飣飥飦飧飪飳飶餂餇餈餑餕餖餗餚餛餜餟餢餦餧餫餱\",4,\"餹餺餻餼饀饁饆饇饈饍饎饔饘饙饛饜饞饟饠馛馝馟馦馰馱馲馵\"],\n[\"8fe9a1\",\"馹馺馽馿駃駉駓駔駙駚駜駞駧駪駫駬駰駴駵駹駽駾騂騃騄騋騌騐騑騖騞騠騢騣騤騧騭騮騳騵騶騸驇驁驄驊驋驌驎驑驔驖驝骪骬骮骯骲骴骵骶骹骻骾骿髁髃髆髈髎髐髒髕髖髗髛髜髠髤髥髧髩髬髲髳髵髹髺髽髿\",4],\n[\"8feaa1\",\"鬄鬅鬈鬉鬋鬌鬍鬎鬐鬒鬖鬙鬛鬜鬠鬦鬫鬭鬳鬴鬵鬷鬹鬺鬽魈魋魌魕魖魗魛魞魡魣魥魦魨魪\",4,\"魳魵魷魸魹魿鮀鮄鮅鮆鮇鮉鮊鮋鮍鮏鮐鮔鮚鮝鮞鮦鮧鮩鮬鮰鮱鮲鮷鮸鮻鮼鮾鮿鯁鯇鯈鯎鯐鯗鯘鯝鯟鯥鯧鯪鯫鯯鯳鯷鯸\"],\n[\"8feba1\",\"鯹鯺鯽鯿鰀鰂鰋鰏鰑鰖鰘鰙鰚鰜鰞鰢鰣鰦\",4,\"鰱鰵鰶鰷鰽鱁鱃鱄鱅鱉鱊鱎鱏鱐鱓鱔鱖鱘鱛鱝鱞鱟鱣鱩鱪鱜鱫鱨鱮鱰鱲鱵鱷鱻鳦鳲鳷鳹鴋鴂鴑鴗鴘鴜鴝鴞鴯鴰鴲鴳鴴鴺鴼鵅鴽鵂鵃鵇鵊鵓鵔鵟鵣鵢鵥鵩鵪鵫鵰鵶鵷鵻\"],\n[\"8feca1\",\"鵼鵾鶃鶄鶆鶊鶍鶎鶒鶓鶕鶖鶗鶘鶡鶪鶬鶮鶱鶵鶹鶼鶿鷃鷇鷉鷊鷔鷕鷖鷗鷚鷞鷟鷠鷥鷧鷩鷫鷮鷰鷳鷴鷾鸊鸂鸇鸎鸐鸑鸒鸕鸖鸙鸜鸝鹺鹻鹼麀麂麃麄麅麇麎麏麖麘麛麞麤麨麬麮麯麰麳麴麵黆黈黋黕黟黤黧黬黭黮黰黱黲黵\"],\n[\"8feda1\",\"黸黿鼂鼃鼉鼏鼐鼑鼒鼔鼖鼗鼙鼚鼛鼟鼢鼦鼪鼫鼯鼱鼲鼴鼷鼹鼺鼼鼽鼿齁齃\",4,\"齓齕齖齗齘齚齝齞齨齩齭\",4,\"齳齵齺齽龏龐龑龒龔龖龗龞龡龢龣龥\"]\n]\n");
__memMods.set("iconv-lite/encodings/tables/gb18030-ranges.json", "{\"uChars\":[128,165,169,178,184,216,226,235,238,244,248,251,253,258,276,284,300,325,329,334,364,463,465,467,469,471,473,475,477,506,594,610,712,716,730,930,938,962,970,1026,1104,1106,8209,8215,8218,8222,8231,8241,8244,8246,8252,8365,8452,8454,8458,8471,8482,8556,8570,8596,8602,8713,8720,8722,8726,8731,8737,8740,8742,8748,8751,8760,8766,8777,8781,8787,8802,8808,8816,8854,8858,8870,8896,8979,9322,9372,9548,9588,9616,9622,9634,9652,9662,9672,9676,9680,9702,9735,9738,9793,9795,11906,11909,11913,11917,11928,11944,11947,11951,11956,11960,11964,11979,12284,12292,12312,12319,12330,12351,12436,12447,12535,12543,12586,12842,12850,12964,13200,13215,13218,13253,13263,13267,13270,13384,13428,13727,13839,13851,14617,14703,14801,14816,14964,15183,15471,15585,16471,16736,17208,17325,17330,17374,17623,17997,18018,18212,18218,18301,18318,18760,18811,18814,18820,18823,18844,18848,18872,19576,19620,19738,19887,40870,59244,59336,59367,59413,59417,59423,59431,59437,59443,59452,59460,59478,59493,63789,63866,63894,63976,63986,64016,64018,64021,64025,64034,64037,64042,65074,65093,65107,65112,65127,65132,65375,65510,65536],\"gbChars\":[0,36,38,45,50,81,89,95,96,100,103,104,105,109,126,133,148,172,175,179,208,306,307,308,309,310,311,312,313,341,428,443,544,545,558,741,742,749,750,805,819,820,7922,7924,7925,7927,7934,7943,7944,7945,7950,8062,8148,8149,8152,8164,8174,8236,8240,8262,8264,8374,8380,8381,8384,8388,8390,8392,8393,8394,8396,8401,8406,8416,8419,8424,8437,8439,8445,8482,8485,8496,8521,8603,8936,8946,9046,9050,9063,9066,9076,9092,9100,9108,9111,9113,9131,9162,9164,9218,9219,11329,11331,11334,11336,11346,11361,11363,11366,11370,11372,11375,11389,11682,11686,11687,11692,11694,11714,11716,11723,11725,11730,11736,11982,11989,12102,12336,12348,12350,12384,12393,12395,12397,12510,12553,12851,12962,12973,13738,13823,13919,13933,14080,14298,14585,14698,15583,15847,16318,16434,16438,16481,16729,17102,17122,17315,17320,17402,17418,17859,17909,17911,17915,17916,17936,17939,17961,18664,18703,18814,18962,19043,33469,33470,33471,33484,33485,33490,33497,33501,33505,33513,33520,33536,33550,37845,37921,37948,38029,38038,38064,38065,38066,38069,38075,38076,38078,39108,39109,39113,39114,39115,39116,39265,39394,189000]}");
__memMods.set("iconv-lite/encodings/tables/gbk-added.json", "[\n[\"a140\",\"\",62],\n[\"a180\",\"\",32],\n[\"a240\",\"\",62],\n[\"a280\",\"\",32],\n[\"a2ab\",\"\",5],\n[\"a2e3\",\"€\"],\n[\"a2ef\",\"\"],\n[\"a2fd\",\"\"],\n[\"a340\",\"\",62],\n[\"a380\",\"\",31,\"　\"],\n[\"a440\",\"\",62],\n[\"a480\",\"\",32],\n[\"a4f4\",\"\",10],\n[\"a540\",\"\",62],\n[\"a580\",\"\",32],\n[\"a5f7\",\"\",7],\n[\"a640\",\"\",62],\n[\"a680\",\"\",32],\n[\"a6b9\",\"\",7],\n[\"a6d9\",\"\",6],\n[\"a6ec\",\"\"],\n[\"a6f3\",\"\"],\n[\"a6f6\",\"\",8],\n[\"a740\",\"\",62],\n[\"a780\",\"\",32],\n[\"a7c2\",\"\",14],\n[\"a7f2\",\"\",12],\n[\"a896\",\"\",10],\n[\"a8bc\",\"ḿ\"],\n[\"a8bf\",\"ǹ\"],\n[\"a8c1\",\"\"],\n[\"a8ea\",\"\",20],\n[\"a958\",\"\"],\n[\"a95b\",\"\"],\n[\"a95d\",\"\"],\n[\"a989\",\"〾⿰\",11],\n[\"a997\",\"\",12],\n[\"a9f0\",\"\",14],\n[\"aaa1\",\"\",93],\n[\"aba1\",\"\",93],\n[\"aca1\",\"\",93],\n[\"ada1\",\"\",93],\n[\"aea1\",\"\",93],\n[\"afa1\",\"\",93],\n[\"d7fa\",\"\",4],\n[\"f8a1\",\"\",93],\n[\"f9a1\",\"\",93],\n[\"faa1\",\"\",93],\n[\"fba1\",\"\",93],\n[\"fca1\",\"\",93],\n[\"fda1\",\"\",93],\n[\"fe50\",\"⺁⺄㑳㑇⺈⺋㖞㘚㘎⺌⺗㥮㤘㧏㧟㩳㧐㭎㱮㳠⺧⺪䁖䅟⺮䌷⺳⺶⺷䎱䎬⺻䏝䓖䙡䙌\"],\n[\"fe80\",\"䜣䜩䝼䞍⻊䥇䥺䥽䦂䦃䦅䦆䦟䦛䦷䦶䲣䲟䲠䲡䱷䲢䴓\",6,\"䶮\",93],\n[\"8135f437\",\"\"]\n]\n");
__memMods.set("iconv-lite/encodings/tables/shiftjis.json", "[\n[\"0\",\"\\u0000\",128],\n[\"a1\",\"｡\",62],\n[\"8140\",\"　、。，．・：；？！゛゜´｀¨＾￣＿ヽヾゝゞ〃仝々〆〇ー―‐／＼～∥｜…‥‘’“”（）〔〕［］｛｝〈\",9,\"＋－±×\"],\n[\"8180\",\"÷＝≠＜＞≦≧∞∴♂♀°′″℃￥＄￠￡％＃＆＊＠§☆★○●◎◇◆□■△▲▽▼※〒→←↑↓〓\"],\n[\"81b8\",\"∈∋⊆⊇⊂⊃∪∩\"],\n[\"81c8\",\"∧∨￢⇒⇔∀∃\"],\n[\"81da\",\"∠⊥⌒∂∇≡≒≪≫√∽∝∵∫∬\"],\n[\"81f0\",\"Å‰♯♭♪†‡¶\"],\n[\"81fc\",\"◯\"],\n[\"824f\",\"０\",9],\n[\"8260\",\"Ａ\",25],\n[\"8281\",\"ａ\",25],\n[\"829f\",\"ぁ\",82],\n[\"8340\",\"ァ\",62],\n[\"8380\",\"ム\",22],\n[\"839f\",\"Α\",16,\"Σ\",6],\n[\"83bf\",\"α\",16,\"σ\",6],\n[\"8440\",\"А\",5,\"ЁЖ\",25],\n[\"8470\",\"а\",5,\"ёж\",7],\n[\"8480\",\"о\",17],\n[\"849f\",\"─│┌┐┘└├┬┤┴┼━┃┏┓┛┗┣┳┫┻╋┠┯┨┷┿┝┰┥┸╂\"],\n[\"8740\",\"①\",19,\"Ⅰ\",9],\n[\"875f\",\"㍉㌔㌢㍍㌘㌧㌃㌶㍑㍗㌍㌦㌣㌫㍊㌻㎜㎝㎞㎎㎏㏄㎡\"],\n[\"877e\",\"㍻\"],\n[\"8780\",\"〝〟№㏍℡㊤\",4,\"㈱㈲㈹㍾㍽㍼≒≡∫∮∑√⊥∠∟⊿∵∩∪\"],\n[\"889f\",\"亜唖娃阿哀愛挨姶逢葵茜穐悪握渥旭葦芦鯵梓圧斡扱宛姐虻飴絢綾鮎或粟袷安庵按暗案闇鞍杏以伊位依偉囲夷委威尉惟意慰易椅為畏異移維緯胃萎衣謂違遺医井亥域育郁磯一壱溢逸稲茨芋鰯允印咽員因姻引飲淫胤蔭\"],\n[\"8940\",\"院陰隠韻吋右宇烏羽迂雨卯鵜窺丑碓臼渦嘘唄欝蔚鰻姥厩浦瓜閏噂云運雲荏餌叡営嬰影映曳栄永泳洩瑛盈穎頴英衛詠鋭液疫益駅悦謁越閲榎厭円\"],\n[\"8980\",\"園堰奄宴延怨掩援沿演炎焔煙燕猿縁艶苑薗遠鉛鴛塩於汚甥凹央奥往応押旺横欧殴王翁襖鴬鴎黄岡沖荻億屋憶臆桶牡乙俺卸恩温穏音下化仮何伽価佳加可嘉夏嫁家寡科暇果架歌河火珂禍禾稼箇花苛茄荷華菓蝦課嘩貨迦過霞蚊俄峨我牙画臥芽蛾賀雅餓駕介会解回塊壊廻快怪悔恢懐戒拐改\"],\n[\"8a40\",\"魁晦械海灰界皆絵芥蟹開階貝凱劾外咳害崖慨概涯碍蓋街該鎧骸浬馨蛙垣柿蛎鈎劃嚇各廓拡撹格核殻獲確穫覚角赫較郭閣隔革学岳楽額顎掛笠樫\"],\n[\"8a80\",\"橿梶鰍潟割喝恰括活渇滑葛褐轄且鰹叶椛樺鞄株兜竃蒲釜鎌噛鴨栢茅萱粥刈苅瓦乾侃冠寒刊勘勧巻喚堪姦完官寛干幹患感慣憾換敢柑桓棺款歓汗漢澗潅環甘監看竿管簡緩缶翰肝艦莞観諌貫還鑑間閑関陥韓館舘丸含岸巌玩癌眼岩翫贋雁頑顔願企伎危喜器基奇嬉寄岐希幾忌揮机旗既期棋棄\"],\n[\"8b40\",\"機帰毅気汽畿祈季稀紀徽規記貴起軌輝飢騎鬼亀偽儀妓宜戯技擬欺犠疑祇義蟻誼議掬菊鞠吉吃喫桔橘詰砧杵黍却客脚虐逆丘久仇休及吸宮弓急救\"],\n[\"8b80\",\"朽求汲泣灸球究窮笈級糾給旧牛去居巨拒拠挙渠虚許距鋸漁禦魚亨享京供侠僑兇競共凶協匡卿叫喬境峡強彊怯恐恭挟教橋況狂狭矯胸脅興蕎郷鏡響饗驚仰凝尭暁業局曲極玉桐粁僅勤均巾錦斤欣欽琴禁禽筋緊芹菌衿襟謹近金吟銀九倶句区狗玖矩苦躯駆駈駒具愚虞喰空偶寓遇隅串櫛釧屑屈\"],\n[\"8c40\",\"掘窟沓靴轡窪熊隈粂栗繰桑鍬勲君薫訓群軍郡卦袈祁係傾刑兄啓圭珪型契形径恵慶慧憩掲携敬景桂渓畦稽系経継繋罫茎荊蛍計詣警軽頚鶏芸迎鯨\"],\n[\"8c80\",\"劇戟撃激隙桁傑欠決潔穴結血訣月件倹倦健兼券剣喧圏堅嫌建憲懸拳捲検権牽犬献研硯絹県肩見謙賢軒遣鍵険顕験鹸元原厳幻弦減源玄現絃舷言諺限乎個古呼固姑孤己庫弧戸故枯湖狐糊袴股胡菰虎誇跨鈷雇顧鼓五互伍午呉吾娯後御悟梧檎瑚碁語誤護醐乞鯉交佼侯候倖光公功効勾厚口向\"],\n[\"8d40\",\"后喉坑垢好孔孝宏工巧巷幸広庚康弘恒慌抗拘控攻昂晃更杭校梗構江洪浩港溝甲皇硬稿糠紅紘絞綱耕考肯肱腔膏航荒行衡講貢購郊酵鉱砿鋼閤降\"],\n[\"8d80\",\"項香高鴻剛劫号合壕拷濠豪轟麹克刻告国穀酷鵠黒獄漉腰甑忽惚骨狛込此頃今困坤墾婚恨懇昏昆根梱混痕紺艮魂些佐叉唆嵯左差査沙瑳砂詐鎖裟坐座挫債催再最哉塞妻宰彩才採栽歳済災采犀砕砦祭斎細菜裁載際剤在材罪財冴坂阪堺榊肴咲崎埼碕鷺作削咋搾昨朔柵窄策索錯桜鮭笹匙冊刷\"],\n[\"8e40\",\"察拶撮擦札殺薩雑皐鯖捌錆鮫皿晒三傘参山惨撒散桟燦珊産算纂蚕讃賛酸餐斬暫残仕仔伺使刺司史嗣四士始姉姿子屍市師志思指支孜斯施旨枝止\"],\n[\"8e80\",\"死氏獅祉私糸紙紫肢脂至視詞詩試誌諮資賜雌飼歯事似侍児字寺慈持時次滋治爾璽痔磁示而耳自蒔辞汐鹿式識鴫竺軸宍雫七叱執失嫉室悉湿漆疾質実蔀篠偲柴芝屡蕊縞舎写射捨赦斜煮社紗者謝車遮蛇邪借勺尺杓灼爵酌釈錫若寂弱惹主取守手朱殊狩珠種腫趣酒首儒受呪寿授樹綬需囚収周\"],\n[\"8f40\",\"宗就州修愁拾洲秀秋終繍習臭舟蒐衆襲讐蹴輯週酋酬集醜什住充十従戎柔汁渋獣縦重銃叔夙宿淑祝縮粛塾熟出術述俊峻春瞬竣舜駿准循旬楯殉淳\"],\n[\"8f80\",\"準潤盾純巡遵醇順処初所暑曙渚庶緒署書薯藷諸助叙女序徐恕鋤除傷償勝匠升召哨商唱嘗奨妾娼宵将小少尚庄床廠彰承抄招掌捷昇昌昭晶松梢樟樵沼消渉湘焼焦照症省硝礁祥称章笑粧紹肖菖蒋蕉衝裳訟証詔詳象賞醤鉦鍾鐘障鞘上丈丞乗冗剰城場壌嬢常情擾条杖浄状畳穣蒸譲醸錠嘱埴飾\"],\n[\"9040\",\"拭植殖燭織職色触食蝕辱尻伸信侵唇娠寝審心慎振新晋森榛浸深申疹真神秦紳臣芯薪親診身辛進針震人仁刃塵壬尋甚尽腎訊迅陣靭笥諏須酢図厨\"],\n[\"9080\",\"逗吹垂帥推水炊睡粋翠衰遂酔錐錘随瑞髄崇嵩数枢趨雛据杉椙菅頗雀裾澄摺寸世瀬畝是凄制勢姓征性成政整星晴棲栖正清牲生盛精聖声製西誠誓請逝醒青静斉税脆隻席惜戚斥昔析石積籍績脊責赤跡蹟碩切拙接摂折設窃節説雪絶舌蝉仙先千占宣専尖川戦扇撰栓栴泉浅洗染潜煎煽旋穿箭線\"],\n[\"9140\",\"繊羨腺舛船薦詮賎践選遷銭銑閃鮮前善漸然全禅繕膳糎噌塑岨措曾曽楚狙疏疎礎祖租粗素組蘇訴阻遡鼠僧創双叢倉喪壮奏爽宋層匝惣想捜掃挿掻\"],\n[\"9180\",\"操早曹巣槍槽漕燥争痩相窓糟総綜聡草荘葬蒼藻装走送遭鎗霜騒像増憎臓蔵贈造促側則即息捉束測足速俗属賊族続卒袖其揃存孫尊損村遜他多太汰詑唾堕妥惰打柁舵楕陀駄騨体堆対耐岱帯待怠態戴替泰滞胎腿苔袋貸退逮隊黛鯛代台大第醍題鷹滝瀧卓啄宅托択拓沢濯琢託鐸濁諾茸凧蛸只\"],\n[\"9240\",\"叩但達辰奪脱巽竪辿棚谷狸鱈樽誰丹単嘆坦担探旦歎淡湛炭短端箪綻耽胆蛋誕鍛団壇弾断暖檀段男談値知地弛恥智池痴稚置致蜘遅馳築畜竹筑蓄\"],\n[\"9280\",\"逐秩窒茶嫡着中仲宙忠抽昼柱注虫衷註酎鋳駐樗瀦猪苧著貯丁兆凋喋寵帖帳庁弔張彫徴懲挑暢朝潮牒町眺聴脹腸蝶調諜超跳銚長頂鳥勅捗直朕沈珍賃鎮陳津墜椎槌追鎚痛通塚栂掴槻佃漬柘辻蔦綴鍔椿潰坪壷嬬紬爪吊釣鶴亭低停偵剃貞呈堤定帝底庭廷弟悌抵挺提梯汀碇禎程締艇訂諦蹄逓\"],\n[\"9340\",\"邸鄭釘鼎泥摘擢敵滴的笛適鏑溺哲徹撤轍迭鉄典填天展店添纏甜貼転顛点伝殿澱田電兎吐堵塗妬屠徒斗杜渡登菟賭途都鍍砥砺努度土奴怒倒党冬\"],\n[\"9380\",\"凍刀唐塔塘套宕島嶋悼投搭東桃梼棟盗淘湯涛灯燈当痘祷等答筒糖統到董蕩藤討謄豆踏逃透鐙陶頭騰闘働動同堂導憧撞洞瞳童胴萄道銅峠鴇匿得徳涜特督禿篤毒独読栃橡凸突椴届鳶苫寅酉瀞噸屯惇敦沌豚遁頓呑曇鈍奈那内乍凪薙謎灘捺鍋楢馴縄畷南楠軟難汝二尼弐迩匂賑肉虹廿日乳入\"],\n[\"9440\",\"如尿韮任妊忍認濡禰祢寧葱猫熱年念捻撚燃粘乃廼之埜嚢悩濃納能脳膿農覗蚤巴把播覇杷波派琶破婆罵芭馬俳廃拝排敗杯盃牌背肺輩配倍培媒梅\"],\n[\"9480\",\"楳煤狽買売賠陪這蝿秤矧萩伯剥博拍柏泊白箔粕舶薄迫曝漠爆縛莫駁麦函箱硲箸肇筈櫨幡肌畑畠八鉢溌発醗髪伐罰抜筏閥鳩噺塙蛤隼伴判半反叛帆搬斑板氾汎版犯班畔繁般藩販範釆煩頒飯挽晩番盤磐蕃蛮匪卑否妃庇彼悲扉批披斐比泌疲皮碑秘緋罷肥被誹費避非飛樋簸備尾微枇毘琵眉美\"],\n[\"9540\",\"鼻柊稗匹疋髭彦膝菱肘弼必畢筆逼桧姫媛紐百謬俵彪標氷漂瓢票表評豹廟描病秒苗錨鋲蒜蛭鰭品彬斌浜瀕貧賓頻敏瓶不付埠夫婦富冨布府怖扶敷\"],\n[\"9580\",\"斧普浮父符腐膚芙譜負賦赴阜附侮撫武舞葡蕪部封楓風葺蕗伏副復幅服福腹複覆淵弗払沸仏物鮒分吻噴墳憤扮焚奮粉糞紛雰文聞丙併兵塀幣平弊柄並蔽閉陛米頁僻壁癖碧別瞥蔑箆偏変片篇編辺返遍便勉娩弁鞭保舗鋪圃捕歩甫補輔穂募墓慕戊暮母簿菩倣俸包呆報奉宝峰峯崩庖抱捧放方朋\"],\n[\"9640\",\"法泡烹砲縫胞芳萌蓬蜂褒訪豊邦鋒飽鳳鵬乏亡傍剖坊妨帽忘忙房暴望某棒冒紡肪膨謀貌貿鉾防吠頬北僕卜墨撲朴牧睦穆釦勃没殆堀幌奔本翻凡盆\"],\n[\"9680\",\"摩磨魔麻埋妹昧枚毎哩槙幕膜枕鮪柾鱒桝亦俣又抹末沫迄侭繭麿万慢満漫蔓味未魅巳箕岬密蜜湊蓑稔脈妙粍民眠務夢無牟矛霧鵡椋婿娘冥名命明盟迷銘鳴姪牝滅免棉綿緬面麺摸模茂妄孟毛猛盲網耗蒙儲木黙目杢勿餅尤戻籾貰問悶紋門匁也冶夜爺耶野弥矢厄役約薬訳躍靖柳薮鑓愉愈油癒\"],\n[\"9740\",\"諭輸唯佑優勇友宥幽悠憂揖有柚湧涌猶猷由祐裕誘遊邑郵雄融夕予余与誉輿預傭幼妖容庸揚揺擁曜楊様洋溶熔用窯羊耀葉蓉要謡踊遥陽養慾抑欲\"],\n[\"9780\",\"沃浴翌翼淀羅螺裸来莱頼雷洛絡落酪乱卵嵐欄濫藍蘭覧利吏履李梨理璃痢裏裡里離陸律率立葎掠略劉流溜琉留硫粒隆竜龍侶慮旅虜了亮僚両凌寮料梁涼猟療瞭稜糧良諒遼量陵領力緑倫厘林淋燐琳臨輪隣鱗麟瑠塁涙累類令伶例冷励嶺怜玲礼苓鈴隷零霊麗齢暦歴列劣烈裂廉恋憐漣煉簾練聯\"],\n[\"9840\",\"蓮連錬呂魯櫓炉賂路露労婁廊弄朗楼榔浪漏牢狼篭老聾蝋郎六麓禄肋録論倭和話歪賄脇惑枠鷲亙亘鰐詫藁蕨椀湾碗腕\"],\n[\"989f\",\"弌丐丕个丱丶丼丿乂乖乘亂亅豫亊舒弍于亞亟亠亢亰亳亶从仍仄仆仂仗仞仭仟价伉佚估佛佝佗佇佶侈侏侘佻佩佰侑佯來侖儘俔俟俎俘俛俑俚俐俤俥倚倨倔倪倥倅伜俶倡倩倬俾俯們倆偃假會偕偐偈做偖偬偸傀傚傅傴傲\"],\n[\"9940\",\"僉僊傳僂僖僞僥僭僣僮價僵儉儁儂儖儕儔儚儡儺儷儼儻儿兀兒兌兔兢竸兩兪兮冀冂囘册冉冏冑冓冕冖冤冦冢冩冪冫决冱冲冰况冽凅凉凛几處凩凭\"],\n[\"9980\",\"凰凵凾刄刋刔刎刧刪刮刳刹剏剄剋剌剞剔剪剴剩剳剿剽劍劔劒剱劈劑辨辧劬劭劼劵勁勍勗勞勣勦飭勠勳勵勸勹匆匈甸匍匐匏匕匚匣匯匱匳匸區卆卅丗卉卍凖卞卩卮夘卻卷厂厖厠厦厥厮厰厶參簒雙叟曼燮叮叨叭叺吁吽呀听吭吼吮吶吩吝呎咏呵咎呟呱呷呰咒呻咀呶咄咐咆哇咢咸咥咬哄哈咨\"],\n[\"9a40\",\"咫哂咤咾咼哘哥哦唏唔哽哮哭哺哢唹啀啣啌售啜啅啖啗唸唳啝喙喀咯喊喟啻啾喘喞單啼喃喩喇喨嗚嗅嗟嗄嗜嗤嗔嘔嗷嘖嗾嗽嘛嗹噎噐營嘴嘶嘲嘸\"],\n[\"9a80\",\"噫噤嘯噬噪嚆嚀嚊嚠嚔嚏嚥嚮嚶嚴囂嚼囁囃囀囈囎囑囓囗囮囹圀囿圄圉圈國圍圓團圖嗇圜圦圷圸坎圻址坏坩埀垈坡坿垉垓垠垳垤垪垰埃埆埔埒埓堊埖埣堋堙堝塲堡塢塋塰毀塒堽塹墅墹墟墫墺壞墻墸墮壅壓壑壗壙壘壥壜壤壟壯壺壹壻壼壽夂夊夐夛梦夥夬夭夲夸夾竒奕奐奎奚奘奢奠奧奬奩\"],\n[\"9b40\",\"奸妁妝佞侫妣妲姆姨姜妍姙姚娥娟娑娜娉娚婀婬婉娵娶婢婪媚媼媾嫋嫂媽嫣嫗嫦嫩嫖嫺嫻嬌嬋嬖嬲嫐嬪嬶嬾孃孅孀孑孕孚孛孥孩孰孳孵學斈孺宀\"],\n[\"9b80\",\"它宦宸寃寇寉寔寐寤實寢寞寥寫寰寶寳尅將專對尓尠尢尨尸尹屁屆屎屓屐屏孱屬屮乢屶屹岌岑岔妛岫岻岶岼岷峅岾峇峙峩峽峺峭嶌峪崋崕崗嵜崟崛崑崔崢崚崙崘嵌嵒嵎嵋嵬嵳嵶嶇嶄嶂嶢嶝嶬嶮嶽嶐嶷嶼巉巍巓巒巖巛巫已巵帋帚帙帑帛帶帷幄幃幀幎幗幔幟幢幤幇幵并幺麼广庠廁廂廈廐廏\"],\n[\"9c40\",\"廖廣廝廚廛廢廡廨廩廬廱廳廰廴廸廾弃弉彝彜弋弑弖弩弭弸彁彈彌彎弯彑彖彗彙彡彭彳彷徃徂彿徊很徑徇從徙徘徠徨徭徼忖忻忤忸忱忝悳忿怡恠\"],\n[\"9c80\",\"怙怐怩怎怱怛怕怫怦怏怺恚恁恪恷恟恊恆恍恣恃恤恂恬恫恙悁悍惧悃悚悄悛悖悗悒悧悋惡悸惠惓悴忰悽惆悵惘慍愕愆惶惷愀惴惺愃愡惻惱愍愎慇愾愨愧慊愿愼愬愴愽慂慄慳慷慘慙慚慫慴慯慥慱慟慝慓慵憙憖憇憬憔憚憊憑憫憮懌懊應懷懈懃懆憺懋罹懍懦懣懶懺懴懿懽懼懾戀戈戉戍戌戔戛\"],\n[\"9d40\",\"戞戡截戮戰戲戳扁扎扞扣扛扠扨扼抂抉找抒抓抖拔抃抔拗拑抻拏拿拆擔拈拜拌拊拂拇抛拉挌拮拱挧挂挈拯拵捐挾捍搜捏掖掎掀掫捶掣掏掉掟掵捫\"],\n[\"9d80\",\"捩掾揩揀揆揣揉插揶揄搖搴搆搓搦搶攝搗搨搏摧摯摶摎攪撕撓撥撩撈撼據擒擅擇撻擘擂擱擧舉擠擡抬擣擯攬擶擴擲擺攀擽攘攜攅攤攣攫攴攵攷收攸畋效敖敕敍敘敞敝敲數斂斃變斛斟斫斷旃旆旁旄旌旒旛旙无旡旱杲昊昃旻杳昵昶昴昜晏晄晉晁晞晝晤晧晨晟晢晰暃暈暎暉暄暘暝曁暹曉暾暼\"],\n[\"9e40\",\"曄暸曖曚曠昿曦曩曰曵曷朏朖朞朦朧霸朮朿朶杁朸朷杆杞杠杙杣杤枉杰枩杼杪枌枋枦枡枅枷柯枴柬枳柩枸柤柞柝柢柮枹柎柆柧檜栞框栩桀桍栲桎\"],\n[\"9e80\",\"梳栫桙档桷桿梟梏梭梔條梛梃檮梹桴梵梠梺椏梍桾椁棊椈棘椢椦棡椌棍棔棧棕椶椒椄棗棣椥棹棠棯椨椪椚椣椡棆楹楷楜楸楫楔楾楮椹楴椽楙椰楡楞楝榁楪榲榮槐榿槁槓榾槎寨槊槝榻槃榧樮榑榠榜榕榴槞槨樂樛槿權槹槲槧樅榱樞槭樔槫樊樒櫁樣樓橄樌橲樶橸橇橢橙橦橈樸樢檐檍檠檄檢檣\"],\n[\"9f40\",\"檗蘗檻櫃櫂檸檳檬櫞櫑櫟檪櫚櫪櫻欅蘖櫺欒欖鬱欟欸欷盜欹飮歇歃歉歐歙歔歛歟歡歸歹歿殀殄殃殍殘殕殞殤殪殫殯殲殱殳殷殼毆毋毓毟毬毫毳毯\"],\n[\"9f80\",\"麾氈氓气氛氤氣汞汕汢汪沂沍沚沁沛汾汨汳沒沐泄泱泓沽泗泅泝沮沱沾沺泛泯泙泪洟衍洶洫洽洸洙洵洳洒洌浣涓浤浚浹浙涎涕濤涅淹渕渊涵淇淦涸淆淬淞淌淨淒淅淺淙淤淕淪淮渭湮渮渙湲湟渾渣湫渫湶湍渟湃渺湎渤滿渝游溂溪溘滉溷滓溽溯滄溲滔滕溏溥滂溟潁漑灌滬滸滾漿滲漱滯漲滌\"],\n[\"e040\",\"漾漓滷澆潺潸澁澀潯潛濳潭澂潼潘澎澑濂潦澳澣澡澤澹濆澪濟濕濬濔濘濱濮濛瀉瀋濺瀑瀁瀏濾瀛瀚潴瀝瀘瀟瀰瀾瀲灑灣炙炒炯烱炬炸炳炮烟烋烝\"],\n[\"e080\",\"烙焉烽焜焙煥煕熈煦煢煌煖煬熏燻熄熕熨熬燗熹熾燒燉燔燎燠燬燧燵燼燹燿爍爐爛爨爭爬爰爲爻爼爿牀牆牋牘牴牾犂犁犇犒犖犢犧犹犲狃狆狄狎狒狢狠狡狹狷倏猗猊猜猖猝猴猯猩猥猾獎獏默獗獪獨獰獸獵獻獺珈玳珎玻珀珥珮珞璢琅瑯琥珸琲琺瑕琿瑟瑙瑁瑜瑩瑰瑣瑪瑶瑾璋璞璧瓊瓏瓔珱\"],\n[\"e140\",\"瓠瓣瓧瓩瓮瓲瓰瓱瓸瓷甄甃甅甌甎甍甕甓甞甦甬甼畄畍畊畉畛畆畚畩畤畧畫畭畸當疆疇畴疊疉疂疔疚疝疥疣痂疳痃疵疽疸疼疱痍痊痒痙痣痞痾痿\"],\n[\"e180\",\"痼瘁痰痺痲痳瘋瘍瘉瘟瘧瘠瘡瘢瘤瘴瘰瘻癇癈癆癜癘癡癢癨癩癪癧癬癰癲癶癸發皀皃皈皋皎皖皓皙皚皰皴皸皹皺盂盍盖盒盞盡盥盧盪蘯盻眈眇眄眩眤眞眥眦眛眷眸睇睚睨睫睛睥睿睾睹瞎瞋瞑瞠瞞瞰瞶瞹瞿瞼瞽瞻矇矍矗矚矜矣矮矼砌砒礦砠礪硅碎硴碆硼碚碌碣碵碪碯磑磆磋磔碾碼磅磊磬\"],\n[\"e240\",\"磧磚磽磴礇礒礑礙礬礫祀祠祗祟祚祕祓祺祿禊禝禧齋禪禮禳禹禺秉秕秧秬秡秣稈稍稘稙稠稟禀稱稻稾稷穃穗穉穡穢穩龝穰穹穽窈窗窕窘窖窩竈窰\"],\n[\"e280\",\"窶竅竄窿邃竇竊竍竏竕竓站竚竝竡竢竦竭竰笂笏笊笆笳笘笙笞笵笨笶筐筺笄筍笋筌筅筵筥筴筧筰筱筬筮箝箘箟箍箜箚箋箒箏筝箙篋篁篌篏箴篆篝篩簑簔篦篥籠簀簇簓篳篷簗簍篶簣簧簪簟簷簫簽籌籃籔籏籀籐籘籟籤籖籥籬籵粃粐粤粭粢粫粡粨粳粲粱粮粹粽糀糅糂糘糒糜糢鬻糯糲糴糶糺紆\"],\n[\"e340\",\"紂紜紕紊絅絋紮紲紿紵絆絳絖絎絲絨絮絏絣經綉絛綏絽綛綺綮綣綵緇綽綫總綢綯緜綸綟綰緘緝緤緞緻緲緡縅縊縣縡縒縱縟縉縋縢繆繦縻縵縹繃縷\"],\n[\"e380\",\"縲縺繧繝繖繞繙繚繹繪繩繼繻纃緕繽辮繿纈纉續纒纐纓纔纖纎纛纜缸缺罅罌罍罎罐网罕罔罘罟罠罨罩罧罸羂羆羃羈羇羌羔羞羝羚羣羯羲羹羮羶羸譱翅翆翊翕翔翡翦翩翳翹飜耆耄耋耒耘耙耜耡耨耿耻聊聆聒聘聚聟聢聨聳聲聰聶聹聽聿肄肆肅肛肓肚肭冐肬胛胥胙胝胄胚胖脉胯胱脛脩脣脯腋\"],\n[\"e440\",\"隋腆脾腓腑胼腱腮腥腦腴膃膈膊膀膂膠膕膤膣腟膓膩膰膵膾膸膽臀臂膺臉臍臑臙臘臈臚臟臠臧臺臻臾舁舂舅與舊舍舐舖舩舫舸舳艀艙艘艝艚艟艤\"],\n[\"e480\",\"艢艨艪艫舮艱艷艸艾芍芒芫芟芻芬苡苣苟苒苴苳苺莓范苻苹苞茆苜茉苙茵茴茖茲茱荀茹荐荅茯茫茗茘莅莚莪莟莢莖茣莎莇莊荼莵荳荵莠莉莨菴萓菫菎菽萃菘萋菁菷萇菠菲萍萢萠莽萸蔆菻葭萪萼蕚蒄葷葫蒭葮蒂葩葆萬葯葹萵蓊葢蒹蒿蒟蓙蓍蒻蓚蓐蓁蓆蓖蒡蔡蓿蓴蔗蔘蔬蔟蔕蔔蓼蕀蕣蕘蕈\"],\n[\"e540\",\"蕁蘂蕋蕕薀薤薈薑薊薨蕭薔薛藪薇薜蕷蕾薐藉薺藏薹藐藕藝藥藜藹蘊蘓蘋藾藺蘆蘢蘚蘰蘿虍乕虔號虧虱蚓蚣蚩蚪蚋蚌蚶蚯蛄蛆蚰蛉蠣蚫蛔蛞蛩蛬\"],\n[\"e580\",\"蛟蛛蛯蜒蜆蜈蜀蜃蛻蜑蜉蜍蛹蜊蜴蜿蜷蜻蜥蜩蜚蝠蝟蝸蝌蝎蝴蝗蝨蝮蝙蝓蝣蝪蠅螢螟螂螯蟋螽蟀蟐雖螫蟄螳蟇蟆螻蟯蟲蟠蠏蠍蟾蟶蟷蠎蟒蠑蠖蠕蠢蠡蠱蠶蠹蠧蠻衄衂衒衙衞衢衫袁衾袞衵衽袵衲袂袗袒袮袙袢袍袤袰袿袱裃裄裔裘裙裝裹褂裼裴裨裲褄褌褊褓襃褞褥褪褫襁襄褻褶褸襌褝襠襞\"],\n[\"e640\",\"襦襤襭襪襯襴襷襾覃覈覊覓覘覡覩覦覬覯覲覺覽覿觀觚觜觝觧觴觸訃訖訐訌訛訝訥訶詁詛詒詆詈詼詭詬詢誅誂誄誨誡誑誥誦誚誣諄諍諂諚諫諳諧\"],\n[\"e680\",\"諤諱謔諠諢諷諞諛謌謇謚諡謖謐謗謠謳鞫謦謫謾謨譁譌譏譎證譖譛譚譫譟譬譯譴譽讀讌讎讒讓讖讙讚谺豁谿豈豌豎豐豕豢豬豸豺貂貉貅貊貍貎貔豼貘戝貭貪貽貲貳貮貶賈賁賤賣賚賽賺賻贄贅贊贇贏贍贐齎贓賍贔贖赧赭赱赳趁趙跂趾趺跏跚跖跌跛跋跪跫跟跣跼踈踉跿踝踞踐踟蹂踵踰踴蹊\"],\n[\"e740\",\"蹇蹉蹌蹐蹈蹙蹤蹠踪蹣蹕蹶蹲蹼躁躇躅躄躋躊躓躑躔躙躪躡躬躰軆躱躾軅軈軋軛軣軼軻軫軾輊輅輕輒輙輓輜輟輛輌輦輳輻輹轅轂輾轌轉轆轎轗轜\"],\n[\"e780\",\"轢轣轤辜辟辣辭辯辷迚迥迢迪迯邇迴逅迹迺逑逕逡逍逞逖逋逧逶逵逹迸遏遐遑遒逎遉逾遖遘遞遨遯遶隨遲邂遽邁邀邊邉邏邨邯邱邵郢郤扈郛鄂鄒鄙鄲鄰酊酖酘酣酥酩酳酲醋醉醂醢醫醯醪醵醴醺釀釁釉釋釐釖釟釡釛釼釵釶鈞釿鈔鈬鈕鈑鉞鉗鉅鉉鉤鉈銕鈿鉋鉐銜銖銓銛鉚鋏銹銷鋩錏鋺鍄錮\"],\n[\"e840\",\"錙錢錚錣錺錵錻鍜鍠鍼鍮鍖鎰鎬鎭鎔鎹鏖鏗鏨鏥鏘鏃鏝鏐鏈鏤鐚鐔鐓鐃鐇鐐鐶鐫鐵鐡鐺鑁鑒鑄鑛鑠鑢鑞鑪鈩鑰鑵鑷鑽鑚鑼鑾钁鑿閂閇閊閔閖閘閙\"],\n[\"e880\",\"閠閨閧閭閼閻閹閾闊濶闃闍闌闕闔闖關闡闥闢阡阨阮阯陂陌陏陋陷陜陞陝陟陦陲陬隍隘隕隗險隧隱隲隰隴隶隸隹雎雋雉雍襍雜霍雕雹霄霆霈霓霎霑霏霖霙霤霪霰霹霽霾靄靆靈靂靉靜靠靤靦靨勒靫靱靹鞅靼鞁靺鞆鞋鞏鞐鞜鞨鞦鞣鞳鞴韃韆韈韋韜韭齏韲竟韶韵頏頌頸頤頡頷頽顆顏顋顫顯顰\"],\n[\"e940\",\"顱顴顳颪颯颱颶飄飃飆飩飫餃餉餒餔餘餡餝餞餤餠餬餮餽餾饂饉饅饐饋饑饒饌饕馗馘馥馭馮馼駟駛駝駘駑駭駮駱駲駻駸騁騏騅駢騙騫騷驅驂驀驃\"],\n[\"e980\",\"騾驕驍驛驗驟驢驥驤驩驫驪骭骰骼髀髏髑髓體髞髟髢髣髦髯髫髮髴髱髷髻鬆鬘鬚鬟鬢鬣鬥鬧鬨鬩鬪鬮鬯鬲魄魃魏魍魎魑魘魴鮓鮃鮑鮖鮗鮟鮠鮨鮴鯀鯊鮹鯆鯏鯑鯒鯣鯢鯤鯔鯡鰺鯲鯱鯰鰕鰔鰉鰓鰌鰆鰈鰒鰊鰄鰮鰛鰥鰤鰡鰰鱇鰲鱆鰾鱚鱠鱧鱶鱸鳧鳬鳰鴉鴈鳫鴃鴆鴪鴦鶯鴣鴟鵄鴕鴒鵁鴿鴾鵆鵈\"],\n[\"ea40\",\"鵝鵞鵤鵑鵐鵙鵲鶉鶇鶫鵯鵺鶚鶤鶩鶲鷄鷁鶻鶸鶺鷆鷏鷂鷙鷓鷸鷦鷭鷯鷽鸚鸛鸞鹵鹹鹽麁麈麋麌麒麕麑麝麥麩麸麪麭靡黌黎黏黐黔黜點黝黠黥黨黯\"],\n[\"ea80\",\"黴黶黷黹黻黼黽鼇鼈皷鼕鼡鼬鼾齊齒齔齣齟齠齡齦齧齬齪齷齲齶龕龜龠堯槇遙瑤凜熙\"],\n[\"ed40\",\"纊褜鍈銈蓜俉炻昱棈鋹曻彅丨仡仼伀伃伹佖侒侊侚侔俍偀倢俿倞偆偰偂傔僴僘兊兤冝冾凬刕劜劦勀勛匀匇匤卲厓厲叝﨎咜咊咩哿喆坙坥垬埈埇﨏\"],\n[\"ed80\",\"塚增墲夋奓奛奝奣妤妺孖寀甯寘寬尞岦岺峵崧嵓﨑嵂嵭嶸嶹巐弡弴彧德忞恝悅悊惞惕愠惲愑愷愰憘戓抦揵摠撝擎敎昀昕昻昉昮昞昤晥晗晙晴晳暙暠暲暿曺朎朗杦枻桒柀栁桄棏﨓楨﨔榘槢樰橫橆橳橾櫢櫤毖氿汜沆汯泚洄涇浯涖涬淏淸淲淼渹湜渧渼溿澈澵濵瀅瀇瀨炅炫焏焄煜煆煇凞燁燾犱\"],\n[\"ee40\",\"犾猤猪獷玽珉珖珣珒琇珵琦琪琩琮瑢璉璟甁畯皂皜皞皛皦益睆劯砡硎硤硺礰礼神祥禔福禛竑竧靖竫箞精絈絜綷綠緖繒罇羡羽茁荢荿菇菶葈蒴蕓蕙\"],\n[\"ee80\",\"蕫﨟薰蘒﨡蠇裵訒訷詹誧誾諟諸諶譓譿賰賴贒赶﨣軏﨤逸遧郞都鄕鄧釚釗釞釭釮釤釥鈆鈐鈊鈺鉀鈼鉎鉙鉑鈹鉧銧鉷鉸鋧鋗鋙鋐﨧鋕鋠鋓錥錡鋻﨨錞鋿錝錂鍰鍗鎤鏆鏞鏸鐱鑅鑈閒隆﨩隝隯霳霻靃靍靏靑靕顗顥飯飼餧館馞驎髙髜魵魲鮏鮱鮻鰀鵰鵫鶴鸙黑\"],\n[\"eeef\",\"ⅰ\",9,\"￢￤＇＂\"],\n[\"f040\",\"\",62],\n[\"f080\",\"\",124],\n[\"f140\",\"\",62],\n[\"f180\",\"\",124],\n[\"f240\",\"\",62],\n[\"f280\",\"\",124],\n[\"f340\",\"\",62],\n[\"f380\",\"\",124],\n[\"f440\",\"\",62],\n[\"f480\",\"\",124],\n[\"f540\",\"\",62],\n[\"f580\",\"\",124],\n[\"f640\",\"\",62],\n[\"f680\",\"\",124],\n[\"f740\",\"\",62],\n[\"f780\",\"\",124],\n[\"f840\",\"\",62],\n[\"f880\",\"\",124],\n[\"f940\",\"\"],\n[\"fa40\",\"ⅰ\",9,\"Ⅰ\",9,\"￢￤＇＂㈱№℡∵纊褜鍈銈蓜俉炻昱棈鋹曻彅丨仡仼伀伃伹佖侒侊侚侔俍偀倢俿倞偆偰偂傔僴僘兊\"],\n[\"fa80\",\"兤冝冾凬刕劜劦勀勛匀匇匤卲厓厲叝﨎咜咊咩哿喆坙坥垬埈埇﨏塚增墲夋奓奛奝奣妤妺孖寀甯寘寬尞岦岺峵崧嵓﨑嵂嵭嶸嶹巐弡弴彧德忞恝悅悊惞惕愠惲愑愷愰憘戓抦揵摠撝擎敎昀昕昻昉昮昞昤晥晗晙晴晳暙暠暲暿曺朎朗杦枻桒柀栁桄棏﨓楨﨔榘槢樰橫橆橳橾櫢櫤毖氿汜沆汯泚洄涇浯\"],\n[\"fb40\",\"涖涬淏淸淲淼渹湜渧渼溿澈澵濵瀅瀇瀨炅炫焏焄煜煆煇凞燁燾犱犾猤猪獷玽珉珖珣珒琇珵琦琪琩琮瑢璉璟甁畯皂皜皞皛皦益睆劯砡硎硤硺礰礼神\"],\n[\"fb80\",\"祥禔福禛竑竧靖竫箞精絈絜綷綠緖繒罇羡羽茁荢荿菇菶葈蒴蕓蕙蕫﨟薰蘒﨡蠇裵訒訷詹誧誾諟諸諶譓譿賰賴贒赶﨣軏﨤逸遧郞都鄕鄧釚釗釞釭釮釤釥鈆鈐鈊鈺鉀鈼鉎鉙鉑鈹鉧銧鉷鉸鋧鋗鋙鋐﨧鋕鋠鋓錥錡鋻﨨錞鋿錝錂鍰鍗鎤鏆鏞鏸鐱鑅鑈閒隆﨩隝隯霳霻靃靍靏靑靕顗顥飯飼餧館馞驎髙\"],\n[\"fc40\",\"髜魵魲鮏鮱鮻鰀鵰鵫鶴鸙黑\"]\n]\n");
__memMods.set("iconv-lite/encodings/utf16.js", "\"use strict\";\nvar Buffer = require(\"safer-buffer\").Buffer;\n\n// Note: UTF16-LE (or UCS2) codec is Node.js native. See encodings/internal.js\n\n// == UTF16-BE codec. ==========================================================\n\nexports.utf16be = Utf16BECodec;\nfunction Utf16BECodec() {\n}\n\nUtf16BECodec.prototype.encoder = Utf16BEEncoder;\nUtf16BECodec.prototype.decoder = Utf16BEDecoder;\nUtf16BECodec.prototype.bomAware = true;\n\n\n// -- Encoding\n\nfunction Utf16BEEncoder() {\n}\n\nUtf16BEEncoder.prototype.write = function(str) {\n    var buf = Buffer.from(str, 'ucs2');\n    for (var i = 0; i < buf.length; i += 2) {\n        var tmp = buf[i]; buf[i] = buf[i+1]; buf[i+1] = tmp;\n    }\n    return buf;\n}\n\nUtf16BEEncoder.prototype.end = function() {\n}\n\n\n// -- Decoding\n\nfunction Utf16BEDecoder() {\n    this.overflowByte = -1;\n}\n\nUtf16BEDecoder.prototype.write = function(buf) {\n    if (buf.length == 0)\n        return '';\n\n    var buf2 = Buffer.alloc(buf.length + 1),\n        i = 0, j = 0;\n\n    if (this.overflowByte !== -1) {\n        buf2[0] = buf[0];\n        buf2[1] = this.overflowByte;\n        i = 1; j = 2;\n    }\n\n    for (; i < buf.length-1; i += 2, j+= 2) {\n        buf2[j] = buf[i+1];\n        buf2[j+1] = buf[i];\n    }\n\n    this.overflowByte = (i == buf.length-1) ? buf[buf.length-1] : -1;\n\n    return buf2.slice(0, j).toString('ucs2');\n}\n\nUtf16BEDecoder.prototype.end = function() {\n    this.overflowByte = -1;\n}\n\n\n// == UTF-16 codec =============================================================\n// Decoder chooses automatically from UTF-16LE and UTF-16BE using BOM and space-based heuristic.\n// Defaults to UTF-16LE, as it's prevalent and default in Node.\n// http://en.wikipedia.org/wiki/UTF-16 and http://encoding.spec.whatwg.org/#utf-16le\n// Decoder default can be changed: iconv.decode(buf, 'utf16', {defaultEncoding: 'utf-16be'});\n\n// Encoder uses UTF-16LE and prepends BOM (which can be overridden with addBOM: false).\n\nexports.utf16 = Utf16Codec;\nfunction Utf16Codec(codecOptions, iconv) {\n    this.iconv = iconv;\n}\n\nUtf16Codec.prototype.encoder = Utf16Encoder;\nUtf16Codec.prototype.decoder = Utf16Decoder;\n\n\n// -- Encoding (pass-through)\n\nfunction Utf16Encoder(options, codec) {\n    options = options || {};\n    if (options.addBOM === undefined)\n        options.addBOM = true;\n    this.encoder = codec.iconv.getEncoder('utf-16le', options);\n}\n\nUtf16Encoder.prototype.write = function(str) {\n    return this.encoder.write(str);\n}\n\nUtf16Encoder.prototype.end = function() {\n    return this.encoder.end();\n}\n\n\n// -- Decoding\n\nfunction Utf16Decoder(options, codec) {\n    this.decoder = null;\n    this.initialBufs = [];\n    this.initialBufsLen = 0;\n\n    this.options = options || {};\n    this.iconv = codec.iconv;\n}\n\nUtf16Decoder.prototype.write = function(buf) {\n    if (!this.decoder) {\n        // Codec is not chosen yet. Accumulate initial bytes.\n        this.initialBufs.push(buf);\n        this.initialBufsLen += buf.length;\n        \n        if (this.initialBufsLen < 16) // We need more bytes to use space heuristic (see below)\n            return '';\n\n        // We have enough bytes -> detect endianness.\n        var encoding = detectEncoding(this.initialBufs, this.options.defaultEncoding);\n        this.decoder = this.iconv.getDecoder(encoding, this.options);\n\n        var resStr = '';\n        for (var i = 0; i < this.initialBufs.length; i++)\n            resStr += this.decoder.write(this.initialBufs[i]);\n\n        this.initialBufs.length = this.initialBufsLen = 0;\n        return resStr;\n    }\n\n    return this.decoder.write(buf);\n}\n\nUtf16Decoder.prototype.end = function() {\n    if (!this.decoder) {\n        var encoding = detectEncoding(this.initialBufs, this.options.defaultEncoding);\n        this.decoder = this.iconv.getDecoder(encoding, this.options);\n\n        var resStr = '';\n        for (var i = 0; i < this.initialBufs.length; i++)\n            resStr += this.decoder.write(this.initialBufs[i]);\n\n        var trail = this.decoder.end();\n        if (trail)\n            resStr += trail;\n\n        this.initialBufs.length = this.initialBufsLen = 0;\n        return resStr;\n    }\n    return this.decoder.end();\n}\n\nfunction detectEncoding(bufs, defaultEncoding) {\n    var b = [];\n    var charsProcessed = 0;\n    var asciiCharsLE = 0, asciiCharsBE = 0; // Number of ASCII chars when decoded as LE or BE.\n\n    outer_loop:\n    for (var i = 0; i < bufs.length; i++) {\n        var buf = bufs[i];\n        for (var j = 0; j < buf.length; j++) {\n            b.push(buf[j]);\n            if (b.length === 2) {\n                if (charsProcessed === 0) {\n                    // Check BOM first.\n                    if (b[0] === 0xFF && b[1] === 0xFE) return 'utf-16le';\n                    if (b[0] === 0xFE && b[1] === 0xFF) return 'utf-16be';\n                }\n\n                if (b[0] === 0 && b[1] !== 0) asciiCharsBE++;\n                if (b[0] !== 0 && b[1] === 0) asciiCharsLE++;\n\n                b.length = 0;\n                charsProcessed++;\n\n                if (charsProcessed >= 100) {\n                    break outer_loop;\n                }\n            }\n        }\n    }\n\n    // Make decisions.\n    // Most of the time, the content has ASCII chars (U+00**), but the opposite (U+**00) is uncommon.\n    // So, we count ASCII as if it was LE or BE, and decide from that.\n    if (asciiCharsBE > asciiCharsLE) return 'utf-16be';\n    if (asciiCharsBE < asciiCharsLE) return 'utf-16le';\n\n    // Couldn't decide (likely all zeros or not enough data).\n    return defaultEncoding || 'utf-16le';\n}\n\n\n");
__memMods.set("iconv-lite/encodings/utf32.js", "'use strict';\n\nvar Buffer = require('safer-buffer').Buffer;\n\n// == UTF32-LE/BE codec. ==========================================================\n\nexports._utf32 = Utf32Codec;\n\nfunction Utf32Codec(codecOptions, iconv) {\n    this.iconv = iconv;\n    this.bomAware = true;\n    this.isLE = codecOptions.isLE;\n}\n\nexports.utf32le = { type: '_utf32', isLE: true };\nexports.utf32be = { type: '_utf32', isLE: false };\n\n// Aliases\nexports.ucs4le = 'utf32le';\nexports.ucs4be = 'utf32be';\n\nUtf32Codec.prototype.encoder = Utf32Encoder;\nUtf32Codec.prototype.decoder = Utf32Decoder;\n\n// -- Encoding\n\nfunction Utf32Encoder(options, codec) {\n    this.isLE = codec.isLE;\n    this.highSurrogate = 0;\n}\n\nUtf32Encoder.prototype.write = function(str) {\n    var src = Buffer.from(str, 'ucs2');\n    var dst = Buffer.alloc(src.length * 2);\n    var write32 = this.isLE ? dst.writeUInt32LE : dst.writeUInt32BE;\n    var offset = 0;\n\n    for (var i = 0; i < src.length; i += 2) {\n        var code = src.readUInt16LE(i);\n        var isHighSurrogate = (0xD800 <= code && code < 0xDC00);\n        var isLowSurrogate = (0xDC00 <= code && code < 0xE000);\n\n        if (this.highSurrogate) {\n            if (isHighSurrogate || !isLowSurrogate) {\n                // There shouldn't be two high surrogates in a row, nor a high surrogate which isn't followed by a low\n                // surrogate. If this happens, keep the pending high surrogate as a stand-alone semi-invalid character\n                // (technically wrong, but expected by some applications, like Windows file names).\n                write32.call(dst, this.highSurrogate, offset);\n                offset += 4;\n            }\n            else {\n                // Create 32-bit value from high and low surrogates;\n                var codepoint = (((this.highSurrogate - 0xD800) << 10) | (code - 0xDC00)) + 0x10000;\n\n                write32.call(dst, codepoint, offset);\n                offset += 4;\n                this.highSurrogate = 0;\n\n                continue;\n            }\n        }\n\n        if (isHighSurrogate)\n            this.highSurrogate = code;\n        else {\n            // Even if the current character is a low surrogate, with no previous high surrogate, we'll\n            // encode it as a semi-invalid stand-alone character for the same reasons expressed above for\n            // unpaired high surrogates.\n            write32.call(dst, code, offset);\n            offset += 4;\n            this.highSurrogate = 0;\n        }\n    }\n\n    if (offset < dst.length)\n        dst = dst.slice(0, offset);\n\n    return dst;\n};\n\nUtf32Encoder.prototype.end = function() {\n    // Treat any leftover high surrogate as a semi-valid independent character.\n    if (!this.highSurrogate)\n        return;\n\n    var buf = Buffer.alloc(4);\n\n    if (this.isLE)\n        buf.writeUInt32LE(this.highSurrogate, 0);\n    else\n        buf.writeUInt32BE(this.highSurrogate, 0);\n\n    this.highSurrogate = 0;\n\n    return buf;\n};\n\n// -- Decoding\n\nfunction Utf32Decoder(options, codec) {\n    this.isLE = codec.isLE;\n    this.badChar = codec.iconv.defaultCharUnicode.charCodeAt(0);\n    this.overflow = [];\n}\n\nUtf32Decoder.prototype.write = function(src) {\n    if (src.length === 0)\n        return '';\n\n    var i = 0;\n    var codepoint = 0;\n    var dst = Buffer.alloc(src.length + 4);\n    var offset = 0;\n    var isLE = this.isLE;\n    var overflow = this.overflow;\n    var badChar = this.badChar;\n\n    if (overflow.length > 0) {\n        for (; i < src.length && overflow.length < 4; i++)\n            overflow.push(src[i]);\n        \n        if (overflow.length === 4) {\n            // NOTE: codepoint is a signed int32 and can be negative.\n            // NOTE: We copied this block from below to help V8 optimize it (it works with array, not buffer).\n            if (isLE) {\n                codepoint = overflow[i] | (overflow[i+1] << 8) | (overflow[i+2] << 16) | (overflow[i+3] << 24);\n            } else {\n                codepoint = overflow[i+3] | (overflow[i+2] << 8) | (overflow[i+1] << 16) | (overflow[i] << 24);\n            }\n            overflow.length = 0;\n\n            offset = _writeCodepoint(dst, offset, codepoint, badChar);\n        }\n    }\n\n    // Main loop. Should be as optimized as possible.\n    for (; i < src.length - 3; i += 4) {\n        // NOTE: codepoint is a signed int32 and can be negative.\n        if (isLE) {\n            codepoint = src[i] | (src[i+1] << 8) | (src[i+2] << 16) | (src[i+3] << 24);\n        } else {\n            codepoint = src[i+3] | (src[i+2] << 8) | (src[i+1] << 16) | (src[i] << 24);\n        }\n        offset = _writeCodepoint(dst, offset, codepoint, badChar);\n    }\n\n    // Keep overflowing bytes.\n    for (; i < src.length; i++) {\n        overflow.push(src[i]);\n    }\n\n    return dst.slice(0, offset).toString('ucs2');\n};\n\nfunction _writeCodepoint(dst, offset, codepoint, badChar) {\n    // NOTE: codepoint is signed int32 and can be negative. We keep it that way to help V8 with optimizations.\n    if (codepoint < 0 || codepoint > 0x10FFFF) {\n        // Not a valid Unicode codepoint\n        codepoint = badChar;\n    } \n\n    // Ephemeral Planes: Write high surrogate.\n    if (codepoint >= 0x10000) {\n        codepoint -= 0x10000;\n\n        var high = 0xD800 | (codepoint >> 10);\n        dst[offset++] = high & 0xff;\n        dst[offset++] = high >> 8;\n\n        // Low surrogate is written below.\n        var codepoint = 0xDC00 | (codepoint & 0x3FF);\n    }\n\n    // Write BMP char or low surrogate.\n    dst[offset++] = codepoint & 0xff;\n    dst[offset++] = codepoint >> 8;\n\n    return offset;\n};\n\nUtf32Decoder.prototype.end = function() {\n    this.overflow.length = 0;\n};\n\n// == UTF-32 Auto codec =============================================================\n// Decoder chooses automatically from UTF-32LE and UTF-32BE using BOM and space-based heuristic.\n// Defaults to UTF-32LE. http://en.wikipedia.org/wiki/UTF-32\n// Encoder/decoder default can be changed: iconv.decode(buf, 'utf32', {defaultEncoding: 'utf-32be'});\n\n// Encoder prepends BOM (which can be overridden with (addBOM: false}).\n\nexports.utf32 = Utf32AutoCodec;\nexports.ucs4 = 'utf32';\n\nfunction Utf32AutoCodec(options, iconv) {\n    this.iconv = iconv;\n}\n\nUtf32AutoCodec.prototype.encoder = Utf32AutoEncoder;\nUtf32AutoCodec.prototype.decoder = Utf32AutoDecoder;\n\n// -- Encoding\n\nfunction Utf32AutoEncoder(options, codec) {\n    options = options || {};\n\n    if (options.addBOM === undefined)\n        options.addBOM = true;\n\n    this.encoder = codec.iconv.getEncoder(options.defaultEncoding || 'utf-32le', options);\n}\n\nUtf32AutoEncoder.prototype.write = function(str) {\n    return this.encoder.write(str);\n};\n\nUtf32AutoEncoder.prototype.end = function() {\n    return this.encoder.end();\n};\n\n// -- Decoding\n\nfunction Utf32AutoDecoder(options, codec) {\n    this.decoder = null;\n    this.initialBufs = [];\n    this.initialBufsLen = 0;\n    this.options = options || {};\n    this.iconv = codec.iconv;\n}\n\nUtf32AutoDecoder.prototype.write = function(buf) {\n    if (!this.decoder) { \n        // Codec is not chosen yet. Accumulate initial bytes.\n        this.initialBufs.push(buf);\n        this.initialBufsLen += buf.length;\n\n        if (this.initialBufsLen < 32) // We need more bytes to use space heuristic (see below)\n            return '';\n\n        // We have enough bytes -> detect endianness.\n        var encoding = detectEncoding(this.initialBufs, this.options.defaultEncoding);\n        this.decoder = this.iconv.getDecoder(encoding, this.options);\n\n        var resStr = '';\n        for (var i = 0; i < this.initialBufs.length; i++)\n            resStr += this.decoder.write(this.initialBufs[i]);\n\n        this.initialBufs.length = this.initialBufsLen = 0;\n        return resStr;\n    }\n\n    return this.decoder.write(buf);\n};\n\nUtf32AutoDecoder.prototype.end = function() {\n    if (!this.decoder) {\n        var encoding = detectEncoding(this.initialBufs, this.options.defaultEncoding);\n        this.decoder = this.iconv.getDecoder(encoding, this.options);\n\n        var resStr = '';\n        for (var i = 0; i < this.initialBufs.length; i++)\n            resStr += this.decoder.write(this.initialBufs[i]);\n\n        var trail = this.decoder.end();\n        if (trail)\n            resStr += trail;\n\n        this.initialBufs.length = this.initialBufsLen = 0;\n        return resStr;\n    }\n\n    return this.decoder.end();\n};\n\nfunction detectEncoding(bufs, defaultEncoding) {\n    var b = [];\n    var charsProcessed = 0;\n    var invalidLE = 0, invalidBE = 0;   // Number of invalid chars when decoded as LE or BE.\n    var bmpCharsLE = 0, bmpCharsBE = 0; // Number of BMP chars when decoded as LE or BE.\n\n    outer_loop:\n    for (var i = 0; i < bufs.length; i++) {\n        var buf = bufs[i];\n        for (var j = 0; j < buf.length; j++) {\n            b.push(buf[j]);\n            if (b.length === 4) {\n                if (charsProcessed === 0) {\n                    // Check BOM first.\n                    if (b[0] === 0xFF && b[1] === 0xFE && b[2] === 0 && b[3] === 0) {\n                        return 'utf-32le';\n                    }\n                    if (b[0] === 0 && b[1] === 0 && b[2] === 0xFE && b[3] === 0xFF) {\n                        return 'utf-32be';\n                    }\n                }\n\n                if (b[0] !== 0 || b[1] > 0x10) invalidBE++;\n                if (b[3] !== 0 || b[2] > 0x10) invalidLE++;\n\n                if (b[0] === 0 && b[1] === 0 && (b[2] !== 0 || b[3] !== 0)) bmpCharsBE++;\n                if ((b[0] !== 0 || b[1] !== 0) && b[2] === 0 && b[3] === 0) bmpCharsLE++;\n\n                b.length = 0;\n                charsProcessed++;\n\n                if (charsProcessed >= 100) {\n                    break outer_loop;\n                }\n            }\n        }\n    }\n\n    // Make decisions.\n    if (bmpCharsBE - invalidBE > bmpCharsLE - invalidLE)  return 'utf-32be';\n    if (bmpCharsBE - invalidBE < bmpCharsLE - invalidLE)  return 'utf-32le';\n\n    // Couldn't decide (likely all zeros or not enough data).\n    return defaultEncoding || 'utf-32le';\n}\n");
__memMods.set("iconv-lite/encodings/utf7.js", "\"use strict\";\nvar Buffer = require(\"safer-buffer\").Buffer;\n\n// UTF-7 codec, according to https://tools.ietf.org/html/rfc2152\n// See also below a UTF-7-IMAP codec, according to http://tools.ietf.org/html/rfc3501#section-5.1.3\n\nexports.utf7 = Utf7Codec;\nexports.unicode11utf7 = 'utf7'; // Alias UNICODE-1-1-UTF-7\nfunction Utf7Codec(codecOptions, iconv) {\n    this.iconv = iconv;\n};\n\nUtf7Codec.prototype.encoder = Utf7Encoder;\nUtf7Codec.prototype.decoder = Utf7Decoder;\nUtf7Codec.prototype.bomAware = true;\n\n\n// -- Encoding\n\nvar nonDirectChars = /[^A-Za-z0-9'\\(\\),-\\.\\/:\\? \\n\\r\\t]+/g;\n\nfunction Utf7Encoder(options, codec) {\n    this.iconv = codec.iconv;\n}\n\nUtf7Encoder.prototype.write = function(str) {\n    // Naive implementation.\n    // Non-direct chars are encoded as \"+<base64>-\"; single \"+\" char is encoded as \"+-\".\n    return Buffer.from(str.replace(nonDirectChars, function(chunk) {\n        return \"+\" + (chunk === '+' ? '' : \n            this.iconv.encode(chunk, 'utf16-be').toString('base64').replace(/=+$/, '')) \n            + \"-\";\n    }.bind(this)));\n}\n\nUtf7Encoder.prototype.end = function() {\n}\n\n\n// -- Decoding\n\nfunction Utf7Decoder(options, codec) {\n    this.iconv = codec.iconv;\n    this.inBase64 = false;\n    this.base64Accum = '';\n}\n\nvar base64Regex = /[A-Za-z0-9\\/+]/;\nvar base64Chars = [];\nfor (var i = 0; i < 256; i++)\n    base64Chars[i] = base64Regex.test(String.fromCharCode(i));\n\nvar plusChar = '+'.charCodeAt(0), \n    minusChar = '-'.charCodeAt(0),\n    andChar = '&'.charCodeAt(0);\n\nUtf7Decoder.prototype.write = function(buf) {\n    var res = \"\", lastI = 0,\n        inBase64 = this.inBase64,\n        base64Accum = this.base64Accum;\n\n    // The decoder is more involved as we must handle chunks in stream.\n\n    for (var i = 0; i < buf.length; i++) {\n        if (!inBase64) { // We're in direct mode.\n            // Write direct chars until '+'\n            if (buf[i] == plusChar) {\n                res += this.iconv.decode(buf.slice(lastI, i), \"ascii\"); // Write direct chars.\n                lastI = i+1;\n                inBase64 = true;\n            }\n        } else { // We decode base64.\n            if (!base64Chars[buf[i]]) { // Base64 ended.\n                if (i == lastI && buf[i] == minusChar) {// \"+-\" -> \"+\"\n                    res += \"+\";\n                } else {\n                    var b64str = base64Accum + this.iconv.decode(buf.slice(lastI, i), \"ascii\");\n                    res += this.iconv.decode(Buffer.from(b64str, 'base64'), \"utf16-be\");\n                }\n\n                if (buf[i] != minusChar) // Minus is absorbed after base64.\n                    i--;\n\n                lastI = i+1;\n                inBase64 = false;\n                base64Accum = '';\n            }\n        }\n    }\n\n    if (!inBase64) {\n        res += this.iconv.decode(buf.slice(lastI), \"ascii\"); // Write direct chars.\n    } else {\n        var b64str = base64Accum + this.iconv.decode(buf.slice(lastI), \"ascii\");\n\n        var canBeDecoded = b64str.length - (b64str.length % 8); // Minimal chunk: 2 quads -> 2x3 bytes -> 3 chars.\n        base64Accum = b64str.slice(canBeDecoded); // The rest will be decoded in future.\n        b64str = b64str.slice(0, canBeDecoded);\n\n        res += this.iconv.decode(Buffer.from(b64str, 'base64'), \"utf16-be\");\n    }\n\n    this.inBase64 = inBase64;\n    this.base64Accum = base64Accum;\n\n    return res;\n}\n\nUtf7Decoder.prototype.end = function() {\n    var res = \"\";\n    if (this.inBase64 && this.base64Accum.length > 0)\n        res = this.iconv.decode(Buffer.from(this.base64Accum, 'base64'), \"utf16-be\");\n\n    this.inBase64 = false;\n    this.base64Accum = '';\n    return res;\n}\n\n\n// UTF-7-IMAP codec.\n// RFC3501 Sec. 5.1.3 Modified UTF-7 (http://tools.ietf.org/html/rfc3501#section-5.1.3)\n// Differences:\n//  * Base64 part is started by \"&\" instead of \"+\"\n//  * Direct characters are 0x20-0x7E, except \"&\" (0x26)\n//  * In Base64, \",\" is used instead of \"/\"\n//  * Base64 must not be used to represent direct characters.\n//  * No implicit shift back from Base64 (should always end with '-')\n//  * String must end in non-shifted position.\n//  * \"-&\" while in base64 is not allowed.\n\n\nexports.utf7imap = Utf7IMAPCodec;\nfunction Utf7IMAPCodec(codecOptions, iconv) {\n    this.iconv = iconv;\n};\n\nUtf7IMAPCodec.prototype.encoder = Utf7IMAPEncoder;\nUtf7IMAPCodec.prototype.decoder = Utf7IMAPDecoder;\nUtf7IMAPCodec.prototype.bomAware = true;\n\n\n// -- Encoding\n\nfunction Utf7IMAPEncoder(options, codec) {\n    this.iconv = codec.iconv;\n    this.inBase64 = false;\n    this.base64Accum = Buffer.alloc(6);\n    this.base64AccumIdx = 0;\n}\n\nUtf7IMAPEncoder.prototype.write = function(str) {\n    var inBase64 = this.inBase64,\n        base64Accum = this.base64Accum,\n        base64AccumIdx = this.base64AccumIdx,\n        buf = Buffer.alloc(str.length*5 + 10), bufIdx = 0;\n\n    for (var i = 0; i < str.length; i++) {\n        var uChar = str.charCodeAt(i);\n        if (0x20 <= uChar && uChar <= 0x7E) { // Direct character or '&'.\n            if (inBase64) {\n                if (base64AccumIdx > 0) {\n                    bufIdx += buf.write(base64Accum.slice(0, base64AccumIdx).toString('base64').replace(/\\//g, ',').replace(/=+$/, ''), bufIdx);\n                    base64AccumIdx = 0;\n                }\n\n                buf[bufIdx++] = minusChar; // Write '-', then go to direct mode.\n                inBase64 = false;\n            }\n\n            if (!inBase64) {\n                buf[bufIdx++] = uChar; // Write direct character\n\n                if (uChar === andChar)  // Ampersand -> '&-'\n                    buf[bufIdx++] = minusChar;\n            }\n\n        } else { // Non-direct character\n            if (!inBase64) {\n                buf[bufIdx++] = andChar; // Write '&', then go to base64 mode.\n                inBase64 = true;\n            }\n            if (inBase64) {\n                base64Accum[base64AccumIdx++] = uChar >> 8;\n                base64Accum[base64AccumIdx++] = uChar & 0xFF;\n\n                if (base64AccumIdx == base64Accum.length) {\n                    bufIdx += buf.write(base64Accum.toString('base64').replace(/\\//g, ','), bufIdx);\n                    base64AccumIdx = 0;\n                }\n            }\n        }\n    }\n\n    this.inBase64 = inBase64;\n    this.base64AccumIdx = base64AccumIdx;\n\n    return buf.slice(0, bufIdx);\n}\n\nUtf7IMAPEncoder.prototype.end = function() {\n    var buf = Buffer.alloc(10), bufIdx = 0;\n    if (this.inBase64) {\n        if (this.base64AccumIdx > 0) {\n            bufIdx += buf.write(this.base64Accum.slice(0, this.base64AccumIdx).toString('base64').replace(/\\//g, ',').replace(/=+$/, ''), bufIdx);\n            this.base64AccumIdx = 0;\n        }\n\n        buf[bufIdx++] = minusChar; // Write '-', then go to direct mode.\n        this.inBase64 = false;\n    }\n\n    return buf.slice(0, bufIdx);\n}\n\n\n// -- Decoding\n\nfunction Utf7IMAPDecoder(options, codec) {\n    this.iconv = codec.iconv;\n    this.inBase64 = false;\n    this.base64Accum = '';\n}\n\nvar base64IMAPChars = base64Chars.slice();\nbase64IMAPChars[','.charCodeAt(0)] = true;\n\nUtf7IMAPDecoder.prototype.write = function(buf) {\n    var res = \"\", lastI = 0,\n        inBase64 = this.inBase64,\n        base64Accum = this.base64Accum;\n\n    // The decoder is more involved as we must handle chunks in stream.\n    // It is forgiving, closer to standard UTF-7 (for example, '-' is optional at the end).\n\n    for (var i = 0; i < buf.length; i++) {\n        if (!inBase64) { // We're in direct mode.\n            // Write direct chars until '&'\n            if (buf[i] == andChar) {\n                res += this.iconv.decode(buf.slice(lastI, i), \"ascii\"); // Write direct chars.\n                lastI = i+1;\n                inBase64 = true;\n            }\n        } else { // We decode base64.\n            if (!base64IMAPChars[buf[i]]) { // Base64 ended.\n                if (i == lastI && buf[i] == minusChar) { // \"&-\" -> \"&\"\n                    res += \"&\";\n                } else {\n                    var b64str = base64Accum + this.iconv.decode(buf.slice(lastI, i), \"ascii\").replace(/,/g, '/');\n                    res += this.iconv.decode(Buffer.from(b64str, 'base64'), \"utf16-be\");\n                }\n\n                if (buf[i] != minusChar) // Minus may be absorbed after base64.\n                    i--;\n\n                lastI = i+1;\n                inBase64 = false;\n                base64Accum = '';\n            }\n        }\n    }\n\n    if (!inBase64) {\n        res += this.iconv.decode(buf.slice(lastI), \"ascii\"); // Write direct chars.\n    } else {\n        var b64str = base64Accum + this.iconv.decode(buf.slice(lastI), \"ascii\").replace(/,/g, '/');\n\n        var canBeDecoded = b64str.length - (b64str.length % 8); // Minimal chunk: 2 quads -> 2x3 bytes -> 3 chars.\n        base64Accum = b64str.slice(canBeDecoded); // The rest will be decoded in future.\n        b64str = b64str.slice(0, canBeDecoded);\n\n        res += this.iconv.decode(Buffer.from(b64str, 'base64'), \"utf16-be\");\n    }\n\n    this.inBase64 = inBase64;\n    this.base64Accum = base64Accum;\n\n    return res;\n}\n\nUtf7IMAPDecoder.prototype.end = function() {\n    var res = \"\";\n    if (this.inBase64 && this.base64Accum.length > 0)\n        res = this.iconv.decode(Buffer.from(this.base64Accum, 'base64'), \"utf16-be\");\n\n    this.inBase64 = false;\n    this.base64Accum = '';\n    return res;\n}\n\n\n");
__memMods.set("iconv-lite/lib/bom-handling.js", "\"use strict\";\n\nvar BOMChar = '\\uFEFF';\n\nexports.PrependBOM = PrependBOMWrapper\nfunction PrependBOMWrapper(encoder, options) {\n    this.encoder = encoder;\n    this.addBOM = true;\n}\n\nPrependBOMWrapper.prototype.write = function(str) {\n    if (this.addBOM) {\n        str = BOMChar + str;\n        this.addBOM = false;\n    }\n\n    return this.encoder.write(str);\n}\n\nPrependBOMWrapper.prototype.end = function() {\n    return this.encoder.end();\n}\n\n\n//------------------------------------------------------------------------------\n\nexports.StripBOM = StripBOMWrapper;\nfunction StripBOMWrapper(decoder, options) {\n    this.decoder = decoder;\n    this.pass = false;\n    this.options = options || {};\n}\n\nStripBOMWrapper.prototype.write = function(buf) {\n    var res = this.decoder.write(buf);\n    if (this.pass || !res)\n        return res;\n\n    if (res[0] === BOMChar) {\n        res = res.slice(1);\n        if (typeof this.options.stripBOM === 'function')\n            this.options.stripBOM();\n    }\n\n    this.pass = true;\n    return res;\n}\n\nStripBOMWrapper.prototype.end = function() {\n    return this.decoder.end();\n}\n\n");
__memMods.set("iconv-lite/lib/index.js", "\"use strict\";\n\nvar Buffer = require(\"safer-buffer\").Buffer;\n\nvar bomHandling = require(\"./bom-handling\"),\n    iconv = module.exports;\n\n// All codecs and aliases are kept here, keyed by encoding name/alias.\n// They are lazy loaded in `iconv.getCodec` from `encodings/index.js`.\niconv.encodings = null;\n\n// Characters emitted in case of error.\niconv.defaultCharUnicode = '�';\niconv.defaultCharSingleByte = '?';\n\n// Public API.\niconv.encode = function encode(str, encoding, options) {\n    str = \"\" + (str || \"\"); // Ensure string.\n\n    var encoder = iconv.getEncoder(encoding, options);\n\n    var res = encoder.write(str);\n    var trail = encoder.end();\n    \n    return (trail && trail.length > 0) ? Buffer.concat([res, trail]) : res;\n}\n\niconv.decode = function decode(buf, encoding, options) {\n    if (typeof buf === 'string') {\n        if (!iconv.skipDecodeWarning) {\n            console.error('Iconv-lite warning: decode()-ing strings is deprecated. Refer to https://github.com/ashtuchkin/iconv-lite/wiki/Use-Buffers-when-decoding');\n            iconv.skipDecodeWarning = true;\n        }\n\n        buf = Buffer.from(\"\" + (buf || \"\"), \"binary\"); // Ensure buffer.\n    }\n\n    var decoder = iconv.getDecoder(encoding, options);\n\n    var res = decoder.write(buf);\n    var trail = decoder.end();\n\n    return trail ? (res + trail) : res;\n}\n\niconv.encodingExists = function encodingExists(enc) {\n    try {\n        iconv.getCodec(enc);\n        return true;\n    } catch (e) {\n        return false;\n    }\n}\n\n// Legacy aliases to convert functions\niconv.toEncoding = iconv.encode;\niconv.fromEncoding = iconv.decode;\n\n// Search for a codec in iconv.encodings. Cache codec data in iconv._codecDataCache.\niconv._codecDataCache = {};\niconv.getCodec = function getCodec(encoding) {\n    if (!iconv.encodings)\n        iconv.encodings = require(\"../encodings\"); // Lazy load all encoding definitions.\n    \n    // Canonicalize encoding name: strip all non-alphanumeric chars and appended year.\n    var enc = iconv._canonicalizeEncoding(encoding);\n\n    // Traverse iconv.encodings to find actual codec.\n    var codecOptions = {};\n    while (true) {\n        var codec = iconv._codecDataCache[enc];\n        if (codec)\n            return codec;\n\n        var codecDef = iconv.encodings[enc];\n\n        switch (typeof codecDef) {\n            case \"string\": // Direct alias to other encoding.\n                enc = codecDef;\n                break;\n\n            case \"object\": // Alias with options. Can be layered.\n                for (var key in codecDef)\n                    codecOptions[key] = codecDef[key];\n\n                if (!codecOptions.encodingName)\n                    codecOptions.encodingName = enc;\n                \n                enc = codecDef.type;\n                break;\n\n            case \"function\": // Codec itself.\n                if (!codecOptions.encodingName)\n                    codecOptions.encodingName = enc;\n\n                // The codec function must load all tables and return object with .encoder and .decoder methods.\n                // It'll be called only once (for each different options object).\n                codec = new codecDef(codecOptions, iconv);\n\n                iconv._codecDataCache[codecOptions.encodingName] = codec; // Save it to be reused later.\n                return codec;\n\n            default:\n                throw new Error(\"Encoding not recognized: '\" + encoding + \"' (searched as: '\"+enc+\"')\");\n        }\n    }\n}\n\niconv._canonicalizeEncoding = function(encoding) {\n    // Canonicalize encoding name: strip all non-alphanumeric chars and appended year.\n    return (''+encoding).toLowerCase().replace(/:\\d{4}$|[^0-9a-z]/g, \"\");\n}\n\niconv.getEncoder = function getEncoder(encoding, options) {\n    var codec = iconv.getCodec(encoding),\n        encoder = new codec.encoder(options, codec);\n\n    if (codec.bomAware && options && options.addBOM)\n        encoder = new bomHandling.PrependBOM(encoder, options);\n\n    return encoder;\n}\n\niconv.getDecoder = function getDecoder(encoding, options) {\n    var codec = iconv.getCodec(encoding),\n        decoder = new codec.decoder(options, codec);\n\n    if (codec.bomAware && !(options && options.stripBOM === false))\n        decoder = new bomHandling.StripBOM(decoder, options);\n\n    return decoder;\n}\n\n// Streaming API\n// NOTE: Streaming API naturally depends on 'stream' module from Node.js. Unfortunately in browser environments this module can add\n// up to 100Kb to the output bundle. To avoid unnecessary code bloat, we don't enable Streaming API in browser by default.\n// If you would like to enable it explicitly, please add the following code to your app:\n// > iconv.enableStreamingAPI(require('stream'));\niconv.enableStreamingAPI = function enableStreamingAPI(stream_module) {\n    if (iconv.supportsStreams)\n        return;\n\n    // Dependency-inject stream module to create IconvLite stream classes.\n    var streams = require(\"./streams\")(stream_module);\n\n    // Not public API yet, but expose the stream classes.\n    iconv.IconvLiteEncoderStream = streams.IconvLiteEncoderStream;\n    iconv.IconvLiteDecoderStream = streams.IconvLiteDecoderStream;\n\n    // Streaming API.\n    iconv.encodeStream = function encodeStream(encoding, options) {\n        return new iconv.IconvLiteEncoderStream(iconv.getEncoder(encoding, options), options);\n    }\n\n    iconv.decodeStream = function decodeStream(encoding, options) {\n        return new iconv.IconvLiteDecoderStream(iconv.getDecoder(encoding, options), options);\n    }\n\n    iconv.supportsStreams = true;\n}\n\n// Enable Streaming API automatically if 'stream' module is available and non-empty (the majority of environments).\nvar stream_module;\ntry {\n    stream_module = require(\"stream\");\n} catch (e) {}\n\nif (stream_module && stream_module.Transform) {\n    iconv.enableStreamingAPI(stream_module);\n\n} else {\n    // In rare cases where 'stream' module is not available by default, throw a helpful exception.\n    iconv.encodeStream = iconv.decodeStream = function() {\n        throw new Error(\"iconv-lite Streaming API is not enabled. Use iconv.enableStreamingAPI(require('stream')); to enable it.\");\n    };\n}\n\nif (\"Ā\" != \"\\u0100\") {\n    console.error(\"iconv-lite warning: js files use non-utf8 encoding. See https://github.com/ashtuchkin/iconv-lite/wiki/Javascript-source-file-encodings for more info.\");\n}\n");
__memMods.set("iconv-lite/lib/streams.js", "\"use strict\";\n\nvar Buffer = require(\"safer-buffer\").Buffer;\n\n// NOTE: Due to 'stream' module being pretty large (~100Kb, significant in browser environments), \n// we opt to dependency-inject it instead of creating a hard dependency.\nmodule.exports = function(stream_module) {\n    var Transform = stream_module.Transform;\n\n    // == Encoder stream =======================================================\n\n    function IconvLiteEncoderStream(conv, options) {\n        this.conv = conv;\n        options = options || {};\n        options.decodeStrings = false; // We accept only strings, so we don't need to decode them.\n        Transform.call(this, options);\n    }\n\n    IconvLiteEncoderStream.prototype = Object.create(Transform.prototype, {\n        constructor: { value: IconvLiteEncoderStream }\n    });\n\n    IconvLiteEncoderStream.prototype._transform = function(chunk, encoding, done) {\n        if (typeof chunk != 'string')\n            return done(new Error(\"Iconv encoding stream needs strings as its input.\"));\n        try {\n            var res = this.conv.write(chunk);\n            if (res && res.length) this.push(res);\n            done();\n        }\n        catch (e) {\n            done(e);\n        }\n    }\n\n    IconvLiteEncoderStream.prototype._flush = function(done) {\n        try {\n            var res = this.conv.end();\n            if (res && res.length) this.push(res);\n            done();\n        }\n        catch (e) {\n            done(e);\n        }\n    }\n\n    IconvLiteEncoderStream.prototype.collect = function(cb) {\n        var chunks = [];\n        this.on('error', cb);\n        this.on('data', function(chunk) { chunks.push(chunk); });\n        this.on('end', function() {\n            cb(null, Buffer.concat(chunks));\n        });\n        return this;\n    }\n\n\n    // == Decoder stream =======================================================\n\n    function IconvLiteDecoderStream(conv, options) {\n        this.conv = conv;\n        options = options || {};\n        options.encoding = this.encoding = 'utf8'; // We output strings.\n        Transform.call(this, options);\n    }\n\n    IconvLiteDecoderStream.prototype = Object.create(Transform.prototype, {\n        constructor: { value: IconvLiteDecoderStream }\n    });\n\n    IconvLiteDecoderStream.prototype._transform = function(chunk, encoding, done) {\n        if (!Buffer.isBuffer(chunk) && !(chunk instanceof Uint8Array))\n            return done(new Error(\"Iconv decoding stream needs buffers as its input.\"));\n        try {\n            var res = this.conv.write(chunk);\n            if (res && res.length) this.push(res, this.encoding);\n            done();\n        }\n        catch (e) {\n            done(e);\n        }\n    }\n\n    IconvLiteDecoderStream.prototype._flush = function(done) {\n        try {\n            var res = this.conv.end();\n            if (res && res.length) this.push(res, this.encoding);                \n            done();\n        }\n        catch (e) {\n            done(e);\n        }\n    }\n\n    IconvLiteDecoderStream.prototype.collect = function(cb) {\n        var res = '';\n        this.on('error', cb);\n        this.on('data', function(chunk) { res += chunk; });\n        this.on('end', function() {\n            cb(null, res);\n        });\n        return this;\n    }\n\n    return {\n        IconvLiteEncoderStream: IconvLiteEncoderStream,\n        IconvLiteDecoderStream: IconvLiteDecoderStream,\n    };\n};\n");
__memMods.set("iconv-lite/package.json", "{\n  \"name\": \"iconv-lite\",\n  \"description\": \"Convert character encodings in pure javascript.\",\n  \"version\": \"0.6.3\",\n  \"license\": \"MIT\",\n  \"author\": \"Alexander Shtuchkin <ashtuchkin@gmail.com>\",\n  \"main\": \"./lib/index.js\",\n  \"typings\": \"./lib/index.d.ts\",\n  \"homepage\": \"https://github.com/ashtuchkin/iconv-lite\",\n  \"repository\": {\n    \"type\": \"git\",\n    \"url\": \"git://github.com/ashtuchkin/iconv-lite.git\"\n  },\n  \"engines\": {\n    \"node\": \">=0.10.0\"\n  },\n  \"browser\": {\n    \"stream\": false\n  },\n  \"devDependencies\": {\n    \"async\": \"^3.2.0\",\n    \"c8\": \"^7.2.0\",\n    \"errto\": \"^0.2.1\",\n    \"iconv\": \"^2.3.5\",\n    \"mocha\": \"^3.5.3\",\n    \"request\": \"^2.88.2\",\n    \"semver\": \"^6.3.0\",\n    \"unorm\": \"^1.6.0\"\n  },\n  \"dependencies\": {\n    \"safer-buffer\": \">= 2.1.2 < 3.0.0\"\n  }\n}");
__memMods.set("safer-buffer/dangerous.js", "/* eslint-disable node/no-deprecated-api */\n\n'use strict'\n\nvar buffer = require('buffer')\nvar Buffer = buffer.Buffer\nvar safer = require('./safer.js')\nvar Safer = safer.Buffer\n\nvar dangerous = {}\n\nvar key\n\nfor (key in safer) {\n  if (!safer.hasOwnProperty(key)) continue\n  dangerous[key] = safer[key]\n}\n\nvar Dangereous = dangerous.Buffer = {}\n\n// Copy Safer API\nfor (key in Safer) {\n  if (!Safer.hasOwnProperty(key)) continue\n  Dangereous[key] = Safer[key]\n}\n\n// Copy those missing unsafe methods, if they are present\nfor (key in Buffer) {\n  if (!Buffer.hasOwnProperty(key)) continue\n  if (Dangereous.hasOwnProperty(key)) continue\n  Dangereous[key] = Buffer[key]\n}\n\nif (!Dangereous.allocUnsafe) {\n  Dangereous.allocUnsafe = function (size) {\n    if (typeof size !== 'number') {\n      throw new TypeError('The \"size\" argument must be of type number. Received type ' + typeof size)\n    }\n    if (size < 0 || size >= 2 * (1 << 30)) {\n      throw new RangeError('The value \"' + size + '\" is invalid for option \"size\"')\n    }\n    return Buffer(size)\n  }\n}\n\nif (!Dangereous.allocUnsafeSlow) {\n  Dangereous.allocUnsafeSlow = function (size) {\n    if (typeof size !== 'number') {\n      throw new TypeError('The \"size\" argument must be of type number. Received type ' + typeof size)\n    }\n    if (size < 0 || size >= 2 * (1 << 30)) {\n      throw new RangeError('The value \"' + size + '\" is invalid for option \"size\"')\n    }\n    return buffer.SlowBuffer(size)\n  }\n}\n\nmodule.exports = dangerous\n");
__memMods.set("safer-buffer/package.json", "{\n  \"name\": \"safer-buffer\",\n  \"version\": \"2.1.2\",\n  \"description\": \"Modern Buffer API polyfill without footguns\",\n  \"main\": \"safer.js\",\n  \"author\": {\n    \"name\": \"Nikita Skovoroda\",\n    \"email\": \"chalkerx@gmail.com\",\n    \"url\": \"https://github.com/ChALkeR\"\n  },\n  \"license\": \"MIT\",\n  \"repository\": {\n    \"type\": \"git\",\n    \"url\": \"git+https://github.com/ChALkeR/safer-buffer.git\"\n  },\n  \"devDependencies\": {\n    \"standard\": \"^11.0.1\",\n    \"tape\": \"^4.9.0\"\n  },\n  \"files\": [\n    \"Porting-Buffer.md\",\n    \"Readme.md\",\n    \"tests.js\",\n    \"dangerous.js\",\n    \"safer.js\"\n  ]\n}");
__memMods.set("safer-buffer/safer.js", "/* eslint-disable node/no-deprecated-api */\n\n'use strict'\n\nvar buffer = require('buffer')\nvar Buffer = buffer.Buffer\n\nvar safer = {}\n\nvar key\n\nfor (key in buffer) {\n  if (!buffer.hasOwnProperty(key)) continue\n  if (key === 'SlowBuffer' || key === 'Buffer') continue\n  safer[key] = buffer[key]\n}\n\nvar Safer = safer.Buffer = {}\nfor (key in Buffer) {\n  if (!Buffer.hasOwnProperty(key)) continue\n  if (key === 'allocUnsafe' || key === 'allocUnsafeSlow') continue\n  Safer[key] = Buffer[key]\n}\n\nsafer.Buffer.prototype = Buffer.prototype\n\nif (!Safer.from || Safer.from === Uint8Array.from) {\n  Safer.from = function (value, encodingOrOffset, length) {\n    if (typeof value === 'number') {\n      throw new TypeError('The \"value\" argument must not be of type number. Received type ' + typeof value)\n    }\n    if (value && typeof value.length === 'undefined') {\n      throw new TypeError('The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type ' + typeof value)\n    }\n    return Buffer(value, encodingOrOffset, length)\n  }\n}\n\nif (!Safer.alloc) {\n  Safer.alloc = function (size, fill, encoding) {\n    if (typeof size !== 'number') {\n      throw new TypeError('The \"size\" argument must be of type number. Received type ' + typeof size)\n    }\n    if (size < 0 || size >= 2 * (1 << 30)) {\n      throw new RangeError('The value \"' + size + '\" is invalid for option \"size\"')\n    }\n    var buf = Buffer(size)\n    if (!fill || fill.length === 0) {\n      buf.fill(0)\n    } else if (typeof encoding === 'string') {\n      buf.fill(fill, encoding)\n    } else {\n      buf.fill(fill)\n    }\n    return buf\n  }\n}\n\nif (!safer.kStringMaxLength) {\n  try {\n    safer.kStringMaxLength = process.binding('buffer').kStringMaxLength\n  } catch (e) {\n    // we can't determine kStringMaxLength in environments where process.binding\n    // is unsupported, so let's not set it\n  }\n}\n\nif (!safer.constants) {\n  safer.constants = {\n    MAX_LENGTH: safer.kMaxLength\n  }\n  if (safer.kStringMaxLength) {\n    safer.constants.MAX_STRING_LENGTH = safer.kStringMaxLength\n  }\n}\n\nmodule.exports = safer\n");
__memMods.set("safer-buffer/tests.js", "/* eslint-disable node/no-deprecated-api */\n\n'use strict'\n\nvar test = require('tape')\n\nvar buffer = require('buffer')\n\nvar index = require('./')\nvar safer = require('./safer')\nvar dangerous = require('./dangerous')\n\n/* Inheritance tests */\n\ntest('Default is Safer', function (t) {\n  t.equal(index, safer)\n  t.notEqual(safer, dangerous)\n  t.notEqual(index, dangerous)\n  t.end()\n})\n\ntest('Is not a function', function (t) {\n  [index, safer, dangerous].forEach(function (impl) {\n    t.equal(typeof impl, 'object')\n    t.equal(typeof impl.Buffer, 'object')\n  });\n  [buffer].forEach(function (impl) {\n    t.equal(typeof impl, 'object')\n    t.equal(typeof impl.Buffer, 'function')\n  })\n  t.end()\n})\n\ntest('Constructor throws', function (t) {\n  [index, safer, dangerous].forEach(function (impl) {\n    t.throws(function () { impl.Buffer() })\n    t.throws(function () { impl.Buffer(0) })\n    t.throws(function () { impl.Buffer('a') })\n    t.throws(function () { impl.Buffer('a', 'utf-8') })\n    t.throws(function () { return new impl.Buffer() })\n    t.throws(function () { return new impl.Buffer(0) })\n    t.throws(function () { return new impl.Buffer('a') })\n    t.throws(function () { return new impl.Buffer('a', 'utf-8') })\n  })\n  t.end()\n})\n\ntest('Safe methods exist', function (t) {\n  [index, safer, dangerous].forEach(function (impl) {\n    t.equal(typeof impl.Buffer.alloc, 'function', 'alloc')\n    t.equal(typeof impl.Buffer.from, 'function', 'from')\n  })\n  t.end()\n})\n\ntest('Unsafe methods exist only in Dangerous', function (t) {\n  [index, safer].forEach(function (impl) {\n    t.equal(typeof impl.Buffer.allocUnsafe, 'undefined')\n    t.equal(typeof impl.Buffer.allocUnsafeSlow, 'undefined')\n  });\n  [dangerous].forEach(function (impl) {\n    t.equal(typeof impl.Buffer.allocUnsafe, 'function')\n    t.equal(typeof impl.Buffer.allocUnsafeSlow, 'function')\n  })\n  t.end()\n})\n\ntest('Generic methods/properties are defined and equal', function (t) {\n  ['poolSize', 'isBuffer', 'concat', 'byteLength'].forEach(function (method) {\n    [index, safer, dangerous].forEach(function (impl) {\n      t.equal(impl.Buffer[method], buffer.Buffer[method], method)\n      t.notEqual(typeof impl.Buffer[method], 'undefined', method)\n    })\n  })\n  t.end()\n})\n\ntest('Built-in buffer static methods/properties are inherited', function (t) {\n  Object.keys(buffer).forEach(function (method) {\n    if (method === 'SlowBuffer' || method === 'Buffer') return;\n    [index, safer, dangerous].forEach(function (impl) {\n      t.equal(impl[method], buffer[method], method)\n      t.notEqual(typeof impl[method], 'undefined', method)\n    })\n  })\n  t.end()\n})\n\ntest('Built-in Buffer static methods/properties are inherited', function (t) {\n  Object.keys(buffer.Buffer).forEach(function (method) {\n    if (method === 'allocUnsafe' || method === 'allocUnsafeSlow') return;\n    [index, safer, dangerous].forEach(function (impl) {\n      t.equal(impl.Buffer[method], buffer.Buffer[method], method)\n      t.notEqual(typeof impl.Buffer[method], 'undefined', method)\n    })\n  })\n  t.end()\n})\n\ntest('.prototype property of Buffer is inherited', function (t) {\n  [index, safer, dangerous].forEach(function (impl) {\n    t.equal(impl.Buffer.prototype, buffer.Buffer.prototype, 'prototype')\n    t.notEqual(typeof impl.Buffer.prototype, 'undefined', 'prototype')\n  })\n  t.end()\n})\n\ntest('All Safer methods are present in Dangerous', function (t) {\n  Object.keys(safer).forEach(function (method) {\n    if (method === 'Buffer') return;\n    [index, safer, dangerous].forEach(function (impl) {\n      t.equal(impl[method], safer[method], method)\n      if (method !== 'kStringMaxLength') {\n        t.notEqual(typeof impl[method], 'undefined', method)\n      }\n    })\n  })\n  Object.keys(safer.Buffer).forEach(function (method) {\n    [index, safer, dangerous].forEach(function (impl) {\n      t.equal(impl.Buffer[method], safer.Buffer[method], method)\n      t.notEqual(typeof impl.Buffer[method], 'undefined', method)\n    })\n  })\n  t.end()\n})\n\ntest('Safe methods from Dangerous methods are present in Safer', function (t) {\n  Object.keys(dangerous).forEach(function (method) {\n    if (method === 'Buffer') return;\n    [index, safer, dangerous].forEach(function (impl) {\n      t.equal(impl[method], dangerous[method], method)\n      if (method !== 'kStringMaxLength') {\n        t.notEqual(typeof impl[method], 'undefined', method)\n      }\n    })\n  })\n  Object.keys(dangerous.Buffer).forEach(function (method) {\n    if (method === 'allocUnsafe' || method === 'allocUnsafeSlow') return;\n    [index, safer, dangerous].forEach(function (impl) {\n      t.equal(impl.Buffer[method], dangerous.Buffer[method], method)\n      t.notEqual(typeof impl.Buffer[method], 'undefined', method)\n    })\n  })\n  t.end()\n})\n\n/* Behaviour tests */\n\ntest('Methods return Buffers', function (t) {\n  [index, safer, dangerous].forEach(function (impl) {\n    t.ok(buffer.Buffer.isBuffer(impl.Buffer.alloc(0)))\n    t.ok(buffer.Buffer.isBuffer(impl.Buffer.alloc(0, 10)))\n    t.ok(buffer.Buffer.isBuffer(impl.Buffer.alloc(0, 'a')))\n    t.ok(buffer.Buffer.isBuffer(impl.Buffer.alloc(10)))\n    t.ok(buffer.Buffer.isBuffer(impl.Buffer.alloc(10, 'x')))\n    t.ok(buffer.Buffer.isBuffer(impl.Buffer.alloc(9, 'ab')))\n    t.ok(buffer.Buffer.isBuffer(impl.Buffer.from('')))\n    t.ok(buffer.Buffer.isBuffer(impl.Buffer.from('string')))\n    t.ok(buffer.Buffer.isBuffer(impl.Buffer.from('string', 'utf-8')))\n    t.ok(buffer.Buffer.isBuffer(impl.Buffer.from('b25ldHdvdGhyZWU=', 'base64')))\n    t.ok(buffer.Buffer.isBuffer(impl.Buffer.from([0, 42, 3])))\n    t.ok(buffer.Buffer.isBuffer(impl.Buffer.from(new Uint8Array([0, 42, 3]))))\n    t.ok(buffer.Buffer.isBuffer(impl.Buffer.from([])))\n  });\n  ['allocUnsafe', 'allocUnsafeSlow'].forEach(function (method) {\n    t.ok(buffer.Buffer.isBuffer(dangerous.Buffer[method](0)))\n    t.ok(buffer.Buffer.isBuffer(dangerous.Buffer[method](10)))\n  })\n  t.end()\n})\n\ntest('Constructor is buffer.Buffer', function (t) {\n  [index, safer, dangerous].forEach(function (impl) {\n    t.equal(impl.Buffer.alloc(0).constructor, buffer.Buffer)\n    t.equal(impl.Buffer.alloc(0, 10).constructor, buffer.Buffer)\n    t.equal(impl.Buffer.alloc(0, 'a').constructor, buffer.Buffer)\n    t.equal(impl.Buffer.alloc(10).constructor, buffer.Buffer)\n    t.equal(impl.Buffer.alloc(10, 'x').constructor, buffer.Buffer)\n    t.equal(impl.Buffer.alloc(9, 'ab').constructor, buffer.Buffer)\n    t.equal(impl.Buffer.from('').constructor, buffer.Buffer)\n    t.equal(impl.Buffer.from('string').constructor, buffer.Buffer)\n    t.equal(impl.Buffer.from('string', 'utf-8').constructor, buffer.Buffer)\n    t.equal(impl.Buffer.from('b25ldHdvdGhyZWU=', 'base64').constructor, buffer.Buffer)\n    t.equal(impl.Buffer.from([0, 42, 3]).constructor, buffer.Buffer)\n    t.equal(impl.Buffer.from(new Uint8Array([0, 42, 3])).constructor, buffer.Buffer)\n    t.equal(impl.Buffer.from([]).constructor, buffer.Buffer)\n  });\n  [0, 10, 100].forEach(function (arg) {\n    t.equal(dangerous.Buffer.allocUnsafe(arg).constructor, buffer.Buffer)\n    t.equal(dangerous.Buffer.allocUnsafeSlow(arg).constructor, buffer.SlowBuffer(0).constructor)\n  })\n  t.end()\n})\n\ntest('Invalid calls throw', function (t) {\n  [index, safer, dangerous].forEach(function (impl) {\n    t.throws(function () { impl.Buffer.from(0) })\n    t.throws(function () { impl.Buffer.from(10) })\n    t.throws(function () { impl.Buffer.from(10, 'utf-8') })\n    t.throws(function () { impl.Buffer.from('string', 'invalid encoding') })\n    t.throws(function () { impl.Buffer.from(-10) })\n    t.throws(function () { impl.Buffer.from(1e90) })\n    t.throws(function () { impl.Buffer.from(Infinity) })\n    t.throws(function () { impl.Buffer.from(-Infinity) })\n    t.throws(function () { impl.Buffer.from(NaN) })\n    t.throws(function () { impl.Buffer.from(null) })\n    t.throws(function () { impl.Buffer.from(undefined) })\n    t.throws(function () { impl.Buffer.from() })\n    t.throws(function () { impl.Buffer.from({}) })\n    t.throws(function () { impl.Buffer.alloc('') })\n    t.throws(function () { impl.Buffer.alloc('string') })\n    t.throws(function () { impl.Buffer.alloc('string', 'utf-8') })\n    t.throws(function () { impl.Buffer.alloc('b25ldHdvdGhyZWU=', 'base64') })\n    t.throws(function () { impl.Buffer.alloc(-10) })\n    t.throws(function () { impl.Buffer.alloc(1e90) })\n    t.throws(function () { impl.Buffer.alloc(2 * (1 << 30)) })\n    t.throws(function () { impl.Buffer.alloc(Infinity) })\n    t.throws(function () { impl.Buffer.alloc(-Infinity) })\n    t.throws(function () { impl.Buffer.alloc(null) })\n    t.throws(function () { impl.Buffer.alloc(undefined) })\n    t.throws(function () { impl.Buffer.alloc() })\n    t.throws(function () { impl.Buffer.alloc([]) })\n    t.throws(function () { impl.Buffer.alloc([0, 42, 3]) })\n    t.throws(function () { impl.Buffer.alloc({}) })\n  });\n  ['allocUnsafe', 'allocUnsafeSlow'].forEach(function (method) {\n    t.throws(function () { dangerous.Buffer[method]('') })\n    t.throws(function () { dangerous.Buffer[method]('string') })\n    t.throws(function () { dangerous.Buffer[method]('string', 'utf-8') })\n    t.throws(function () { dangerous.Buffer[method](2 * (1 << 30)) })\n    t.throws(function () { dangerous.Buffer[method](Infinity) })\n    if (dangerous.Buffer[method] === buffer.Buffer.allocUnsafe) {\n      t.skip('Skipping, older impl of allocUnsafe coerced negative sizes to 0')\n    } else {\n      t.throws(function () { dangerous.Buffer[method](-10) })\n      t.throws(function () { dangerous.Buffer[method](-1e90) })\n      t.throws(function () { dangerous.Buffer[method](-Infinity) })\n    }\n    t.throws(function () { dangerous.Buffer[method](null) })\n    t.throws(function () { dangerous.Buffer[method](undefined) })\n    t.throws(function () { dangerous.Buffer[method]() })\n    t.throws(function () { dangerous.Buffer[method]([]) })\n    t.throws(function () { dangerous.Buffer[method]([0, 42, 3]) })\n    t.throws(function () { dangerous.Buffer[method]({}) })\n  })\n  t.end()\n})\n\ntest('Buffers have appropriate lengths', function (t) {\n  [index, safer, dangerous].forEach(function (impl) {\n    t.equal(impl.Buffer.alloc(0).length, 0)\n    t.equal(impl.Buffer.alloc(10).length, 10)\n    t.equal(impl.Buffer.from('').length, 0)\n    t.equal(impl.Buffer.from('string').length, 6)\n    t.equal(impl.Buffer.from('string', 'utf-8').length, 6)\n    t.equal(impl.Buffer.from('b25ldHdvdGhyZWU=', 'base64').length, 11)\n    t.equal(impl.Buffer.from([0, 42, 3]).length, 3)\n    t.equal(impl.Buffer.from(new Uint8Array([0, 42, 3])).length, 3)\n    t.equal(impl.Buffer.from([]).length, 0)\n  });\n  ['allocUnsafe', 'allocUnsafeSlow'].forEach(function (method) {\n    t.equal(dangerous.Buffer[method](0).length, 0)\n    t.equal(dangerous.Buffer[method](10).length, 10)\n  })\n  t.end()\n})\n\ntest('Buffers have appropriate lengths (2)', function (t) {\n  t.equal(index.Buffer.alloc, safer.Buffer.alloc)\n  t.equal(index.Buffer.alloc, dangerous.Buffer.alloc)\n  var ok = true;\n  [ safer.Buffer.alloc,\n    dangerous.Buffer.allocUnsafe,\n    dangerous.Buffer.allocUnsafeSlow\n  ].forEach(function (method) {\n    for (var i = 0; i < 1e2; i++) {\n      var length = Math.round(Math.random() * 1e5)\n      var buf = method(length)\n      if (!buffer.Buffer.isBuffer(buf)) ok = false\n      if (buf.length !== length) ok = false\n    }\n  })\n  t.ok(ok)\n  t.end()\n})\n\ntest('.alloc(size) is zero-filled and has correct length', function (t) {\n  t.equal(index.Buffer.alloc, safer.Buffer.alloc)\n  t.equal(index.Buffer.alloc, dangerous.Buffer.alloc)\n  var ok = true\n  for (var i = 0; i < 1e2; i++) {\n    var length = Math.round(Math.random() * 2e6)\n    var buf = index.Buffer.alloc(length)\n    if (!buffer.Buffer.isBuffer(buf)) ok = false\n    if (buf.length !== length) ok = false\n    var j\n    for (j = 0; j < length; j++) {\n      if (buf[j] !== 0) ok = false\n    }\n    buf.fill(1)\n    for (j = 0; j < length; j++) {\n      if (buf[j] !== 1) ok = false\n    }\n  }\n  t.ok(ok)\n  t.end()\n})\n\ntest('.allocUnsafe / .allocUnsafeSlow are fillable and have correct lengths', function (t) {\n  ['allocUnsafe', 'allocUnsafeSlow'].forEach(function (method) {\n    var ok = true\n    for (var i = 0; i < 1e2; i++) {\n      var length = Math.round(Math.random() * 2e6)\n      var buf = dangerous.Buffer[method](length)\n      if (!buffer.Buffer.isBuffer(buf)) ok = false\n      if (buf.length !== length) ok = false\n      buf.fill(0, 0, length)\n      var j\n      for (j = 0; j < length; j++) {\n        if (buf[j] !== 0) ok = false\n      }\n      buf.fill(1, 0, length)\n      for (j = 0; j < length; j++) {\n        if (buf[j] !== 1) ok = false\n      }\n    }\n    t.ok(ok, method)\n  })\n  t.end()\n})\n\ntest('.alloc(size, fill) is `fill`-filled', function (t) {\n  t.equal(index.Buffer.alloc, safer.Buffer.alloc)\n  t.equal(index.Buffer.alloc, dangerous.Buffer.alloc)\n  var ok = true\n  for (var i = 0; i < 1e2; i++) {\n    var length = Math.round(Math.random() * 2e6)\n    var fill = Math.round(Math.random() * 255)\n    var buf = index.Buffer.alloc(length, fill)\n    if (!buffer.Buffer.isBuffer(buf)) ok = false\n    if (buf.length !== length) ok = false\n    for (var j = 0; j < length; j++) {\n      if (buf[j] !== fill) ok = false\n    }\n  }\n  t.ok(ok)\n  t.end()\n})\n\ntest('.alloc(size, fill) is `fill`-filled', function (t) {\n  t.equal(index.Buffer.alloc, safer.Buffer.alloc)\n  t.equal(index.Buffer.alloc, dangerous.Buffer.alloc)\n  var ok = true\n  for (var i = 0; i < 1e2; i++) {\n    var length = Math.round(Math.random() * 2e6)\n    var fill = Math.round(Math.random() * 255)\n    var buf = index.Buffer.alloc(length, fill)\n    if (!buffer.Buffer.isBuffer(buf)) ok = false\n    if (buf.length !== length) ok = false\n    for (var j = 0; j < length; j++) {\n      if (buf[j] !== fill) ok = false\n    }\n  }\n  t.ok(ok)\n  t.deepEqual(index.Buffer.alloc(9, 'a'), index.Buffer.alloc(9, 97))\n  t.notDeepEqual(index.Buffer.alloc(9, 'a'), index.Buffer.alloc(9, 98))\n\n  var tmp = new buffer.Buffer(2)\n  tmp.fill('ok')\n  if (tmp[1] === tmp[0]) {\n    // Outdated Node.js\n    t.deepEqual(index.Buffer.alloc(5, 'ok'), index.Buffer.from('ooooo'))\n  } else {\n    t.deepEqual(index.Buffer.alloc(5, 'ok'), index.Buffer.from('okoko'))\n  }\n  t.notDeepEqual(index.Buffer.alloc(5, 'ok'), index.Buffer.from('kokok'))\n\n  t.end()\n})\n\ntest('safer.Buffer.from returns results same as Buffer constructor', function (t) {\n  [index, safer, dangerous].forEach(function (impl) {\n    t.deepEqual(impl.Buffer.from(''), new buffer.Buffer(''))\n    t.deepEqual(impl.Buffer.from('string'), new buffer.Buffer('string'))\n    t.deepEqual(impl.Buffer.from('string', 'utf-8'), new buffer.Buffer('string', 'utf-8'))\n    t.deepEqual(impl.Buffer.from('b25ldHdvdGhyZWU=', 'base64'), new buffer.Buffer('b25ldHdvdGhyZWU=', 'base64'))\n    t.deepEqual(impl.Buffer.from([0, 42, 3]), new buffer.Buffer([0, 42, 3]))\n    t.deepEqual(impl.Buffer.from(new Uint8Array([0, 42, 3])), new buffer.Buffer(new Uint8Array([0, 42, 3])))\n    t.deepEqual(impl.Buffer.from([]), new buffer.Buffer([]))\n  })\n  t.end()\n})\n\ntest('safer.Buffer.from returns consistent results', function (t) {\n  [index, safer, dangerous].forEach(function (impl) {\n    t.deepEqual(impl.Buffer.from(''), impl.Buffer.alloc(0))\n    t.deepEqual(impl.Buffer.from([]), impl.Buffer.alloc(0))\n    t.deepEqual(impl.Buffer.from(new Uint8Array([])), impl.Buffer.alloc(0))\n    t.deepEqual(impl.Buffer.from('string', 'utf-8'), impl.Buffer.from('string'))\n    t.deepEqual(impl.Buffer.from('string'), impl.Buffer.from([115, 116, 114, 105, 110, 103]))\n    t.deepEqual(impl.Buffer.from('string'), impl.Buffer.from(impl.Buffer.from('string')))\n    t.deepEqual(impl.Buffer.from('b25ldHdvdGhyZWU=', 'base64'), impl.Buffer.from('onetwothree'))\n    t.notDeepEqual(impl.Buffer.from('b25ldHdvdGhyZWU='), impl.Buffer.from('onetwothree'))\n  })\n  t.end()\n})\n");
__memMods.set("basic-ftp/dist/Client.js", "\"use strict\";\nObject.defineProperty(exports, \"__esModule\", { value: true });\nexports.Client = void 0;\nconst fs_1 = require(\"fs\");\nconst path_1 = require(\"path\");\nconst tls_1 = require(\"tls\");\nconst util_1 = require(\"util\");\nconst FtpContext_1 = require(\"./FtpContext\");\nconst netUtils_1 = require(\"./netUtils\");\nconst parseControlResponse_1 = require(\"./parseControlResponse\");\nconst parseList_1 = require(\"./parseList\");\nconst parseListMLSD_1 = require(\"./parseListMLSD\");\nconst ProgressTracker_1 = require(\"./ProgressTracker\");\nconst StringWriter_1 = require(\"./StringWriter\");\nconst transfer_1 = require(\"./transfer\");\n// Use promisify to keep the library compatible with Node 8.\nconst fsReadDir = (0, util_1.promisify)(fs_1.readdir);\nconst fsMkDir = (0, util_1.promisify)(fs_1.mkdir);\nconst fsStat = (0, util_1.promisify)(fs_1.stat);\nconst fsFStat = (0, util_1.promisify)(fs_1.fstat);\nconst fsOpen = (0, util_1.promisify)(fs_1.open);\nconst fsClose = (0, util_1.promisify)(fs_1.close);\nconst fsUnlink = (0, util_1.promisify)(fs_1.unlink);\nconst defaultClientOptions = {\n    /** For security reasons this library should not allow separate transfer hosts by default. */\n    allowSeparateTransferHost: false,\n    maxListingBytes: 40 * 1024 * 1024\n};\nconst LIST_COMMANDS_DEFAULT = () => [\"LIST -a\", \"LIST\"];\nconst LIST_COMMANDS_MLSD = () => [\"MLSD\", \"LIST -a\", \"LIST\"];\n/**\n * High-level API to interact with an FTP server.\n */\nclass Client {\n    /**\n     * Instantiate an FTP client.\n     *\n     * @param timeout  Timeout in milliseconds, use 0 for no timeout. Optional, default is 30 seconds.\n     */\n    constructor(timeout = 30000, userOptions = defaultClientOptions) {\n        this.availableListCommands = LIST_COMMANDS_DEFAULT();\n        const options = { ...defaultClientOptions, ...userOptions };\n        this.ftp = new FtpContext_1.FTPContext(timeout);\n        this.prepareTransfer = this._enterFirstCompatibleMode([\n            transfer_1.enterPassiveModeIPv6,\n            options.allowSeparateTransferHost ? transfer_1.enterPassiveModeIPv4 : transfer_1.enterPassiveModeIPv4_forceControlHostIP\n        ]);\n        this.options = options;\n        this.parseList = parseList_1.parseList;\n        this._progressTracker = new ProgressTracker_1.ProgressTracker();\n    }\n    /**\n     * Close the client and all open socket connections.\n     *\n     * Close the client and all open socket connections. The client can’t be used anymore after calling this method,\n     * you have to either reconnect with `access` or `connect` or instantiate a new instance to continue any work.\n     * A client is also closed automatically if any timeout or connection error occurs.\n     */\n    close() {\n        this.ftp.close();\n        this._progressTracker.stop();\n    }\n    /**\n     * Returns true if the client is closed and can't be used anymore.\n     */\n    get closed() {\n        return this.ftp.closed;\n    }\n    /**\n     * Connect (or reconnect) to an FTP server.\n     *\n     * This is an instance method and thus can be called multiple times during the lifecycle of a `Client`\n     * instance. Whenever you do, the client is reset with a new control connection. This also implies that\n     * you can reopen a `Client` instance that has been closed due to an error when reconnecting with this\n     * method. In fact, reconnecting is the only way to continue using a closed `Client`.\n     *\n     * @param host  Host the client should connect to. Optional, default is \"localhost\".\n     * @param port  Port the client should connect to. Optional, default is 21.\n     */\n    connect(host = \"localhost\", port = 21) {\n        this.ftp.reset();\n        this.ftp.socket.connect({\n            host,\n            port,\n            family: this.ftp.ipFamily\n        }, () => this.ftp.log(`Connected to ${(0, netUtils_1.describeAddress)(this.ftp.socket)} (${(0, netUtils_1.describeTLS)(this.ftp.socket)})`));\n        return this._handleConnectResponse();\n    }\n    /**\n     * As `connect` but using implicit TLS. Implicit TLS is not an FTP standard and has been replaced by\n     * explicit TLS. There are still FTP servers that support only implicit TLS, though.\n     */\n    connectImplicitTLS(host = \"localhost\", port = 21, tlsOptions = {}) {\n        var _a;\n        this.ftp.reset();\n        // Remember the host identity so future data connections can resume this TLS\n        // session. Since Node.js v24.17.0 (CVE-2026-48934) a reusable TLS session is\n        // bound to the host it was authenticated for, and resumption is refused when\n        // the resuming connection's identity (servername ?? host ?? socket._host)\n        // differs. Data connections connect to the PASV/EPSV target, so without an\n        // explicit host they'd resume under a different (or missing) identity and the\n        // server would report the session as not resumed. This mirrors what `access`\n        // already does for explicit TLS, see https://github.com/patrickjuchli/basic-ftp/issues/166.\n        tlsOptions.host = (_a = tlsOptions.host) !== null && _a !== void 0 ? _a : host;\n        this.ftp.socket = (0, tls_1.connect)(port, host, tlsOptions, () => this.ftp.log(`Connected to ${(0, netUtils_1.describeAddress)(this.ftp.socket)} (${(0, netUtils_1.describeTLS)(this.ftp.socket)})`));\n        this.ftp.tlsOptions = tlsOptions;\n        return this._handleConnectResponse();\n    }\n    /**\n     * Handles the first reponse by an FTP server after the socket connection has been established.\n     */\n    _handleConnectResponse() {\n        return this.ftp.handle(undefined, (res, task) => {\n            if (res instanceof Error) {\n                // The connection has been destroyed by the FTPContext at this point.\n                task.reject(res);\n            }\n            else if ((0, parseControlResponse_1.positiveCompletion)(res.code)) {\n                task.resolve(res);\n            }\n            // Reject all other codes, including 120 \"Service ready in nnn minutes\".\n            else {\n                // Don't stay connected but don't replace the socket yet by using reset()\n                // so the user can inspect properties of this instance.\n                task.reject(new FtpContext_1.FTPError(res));\n            }\n        });\n    }\n    /**\n     * Send an FTP command and handle the first response.\n     */\n    send(command, ignoreErrorCodesDEPRECATED = false) {\n        if (ignoreErrorCodesDEPRECATED) { // Deprecated starting from 3.9.0\n            this.ftp.log(\"Deprecated call using send(command, flag) with boolean flag to ignore errors. Use sendIgnoringError(command).\");\n            return this.sendIgnoringError(command);\n        }\n        return this.ftp.request(command);\n    }\n    /**\n     * Send an FTP command and ignore an FTP error response. Any other kind of error or timeout will still reject the Promise.\n     *\n     * @param command\n     */\n    sendIgnoringError(command) {\n        return this.ftp.handle(command, (res, task) => {\n            if (res instanceof FtpContext_1.FTPError) {\n                task.resolve({ code: res.code, message: res.message });\n            }\n            else if (res instanceof Error) {\n                task.reject(res);\n            }\n            else {\n                task.resolve(res);\n            }\n        });\n    }\n    /**\n     * Upgrade the current socket connection to TLS.\n     *\n     * @param options  TLS options as in `tls.connect(options)`, optional.\n     * @param command  Set the authentication command. Optional, default is \"AUTH TLS\".\n     */\n    async useTLS(options = {}, command = \"AUTH TLS\") {\n        const ret = await this.send(command);\n        this.ftp.socket = await (0, netUtils_1.upgradeSocket)(this.ftp.socket, options);\n        this.ftp.tlsOptions = options; // Keep the TLS options for later data connections that should use the same options.\n        this.ftp.log(`Control socket is using: ${(0, netUtils_1.describeTLS)(this.ftp.socket)}`);\n        return ret;\n    }\n    /**\n     * Login a user with a password.\n     *\n     * @param user  Username to use for login. Optional, default is \"anonymous\".\n     * @param password  Password to use for login. Optional, default is \"guest\".\n     */\n    login(user = \"anonymous\", password = \"guest\") {\n        this.ftp.log(`Login security: ${(0, netUtils_1.describeTLS)(this.ftp.socket)}`);\n        return this.ftp.handle(\"USER \" + user, (res, task) => {\n            if (res instanceof Error) {\n                task.reject(res);\n            }\n            else if ((0, parseControlResponse_1.positiveCompletion)(res.code)) { // User logged in proceed OR Command superfluous\n                task.resolve(res);\n            }\n            else if (res.code === 331) { // User name okay, need password\n                this.ftp.send(\"PASS \" + password);\n            }\n            else { // Also report error on 332 (Need account)\n                task.reject(new FtpContext_1.FTPError(res));\n            }\n        });\n    }\n    /**\n     * Set the usual default settings.\n     *\n     * Settings used:\n     * * Binary mode (TYPE I)\n     * * File structure (STRU F)\n     * * Additional settings for FTPS (PBSZ 0, PROT P)\n     */\n    async useDefaultSettings() {\n        const features = await this.features();\n        // Use MLSD directory listing if possible. See https://tools.ietf.org/html/rfc3659#section-7.8:\n        // \"The presence of the MLST feature indicates that both MLST and MLSD are supported.\"\n        const supportsMLSD = features.has(\"MLST\");\n        this.availableListCommands = supportsMLSD ? LIST_COMMANDS_MLSD() : LIST_COMMANDS_DEFAULT();\n        await this.send(\"TYPE I\"); // Binary mode\n        await this.sendIgnoringError(\"STRU F\"); // Use file structure\n        await this.sendIgnoringError(\"OPTS UTF8 ON\"); // Some servers expect UTF-8 to be enabled explicitly and setting before login might not have worked.\n        if (supportsMLSD) {\n            await this.sendIgnoringError(\"OPTS MLST type;size;modify;unique;unix.mode;unix.owner;unix.group;unix.ownername;unix.groupname;\"); // Make sure MLSD listings include all we can parse\n        }\n        if (this.ftp.hasTLS) {\n            await this.sendIgnoringError(\"PBSZ 0\"); // Set to 0 for TLS\n            await this.sendIgnoringError(\"PROT P\"); // Protect channel (also for data connections)\n        }\n    }\n    /**\n     * Convenience method that calls `connect`, `useTLS`, `login` and `useDefaultSettings`.\n     *\n     * This is an instance method and thus can be called multiple times during the lifecycle of a `Client`\n     * instance. Whenever you do, the client is reset with a new control connection. This also implies that\n     * you can reopen a `Client` instance that has been closed due to an error when reconnecting with this\n     * method. In fact, reconnecting is the only way to continue using a closed `Client`.\n     */\n    async access(options = {}) {\n        var _a, _b;\n        const useExplicitTLS = options.secure === true;\n        const useImplicitTLS = options.secure === \"implicit\";\n        let welcome;\n        if (useImplicitTLS) {\n            welcome = await this.connectImplicitTLS(options.host, options.port, options.secureOptions);\n        }\n        else {\n            welcome = await this.connect(options.host, options.port);\n        }\n        if (useExplicitTLS) {\n            // Fixes https://github.com/patrickjuchli/basic-ftp/issues/166 by making sure\n            // host is set for any future data connection as well.\n            const secureOptions = (_a = options.secureOptions) !== null && _a !== void 0 ? _a : {};\n            secureOptions.host = (_b = secureOptions.host) !== null && _b !== void 0 ? _b : options.host;\n            await this.useTLS(secureOptions);\n        }\n        // Set UTF-8 on before login in case there are non-ascii characters in user or password.\n        // Note that this might not work before login depending on server.\n        await this.sendIgnoringError(\"OPTS UTF8 ON\");\n        await this.login(options.user, options.password);\n        await this.useDefaultSettings();\n        return welcome;\n    }\n    /**\n     * Get the current working directory.\n     */\n    async pwd() {\n        const res = await this.send(\"PWD\");\n        // The directory is part of the return message, for example:\n        // 257 \"/this/that\" is current directory.\n        const parsed = res.message.match(/\"(.+)\"/);\n        if (parsed === null || parsed[1] === undefined) {\n            throw new Error(`Can't parse response to command 'PWD': ${res.message}`);\n        }\n        return parsed[1];\n    }\n    /**\n     * Get a description of supported features.\n     *\n     * This sends the FEAT command and parses the result into a Map where keys correspond to available commands\n     * and values hold further information. Be aware that your FTP servers might not support this\n     * command in which case this method will not throw an exception but just return an empty Map.\n     */\n    async features() {\n        const res = await this.sendIgnoringError(\"FEAT\");\n        const features = new Map();\n        // Not supporting any special features will be reported with a single line.\n        if (res.code < 400 && (0, parseControlResponse_1.isMultiline)(res.message)) {\n            // The first and last line wrap the multiline response, ignore them.\n            res.message.split(\"\\n\").slice(1, -1).forEach(line => {\n                // A typical lines looks like: \" REST STREAM\" or \" MDTM\".\n                // Servers might not use an indentation though.\n                const entry = line.trim().split(\" \");\n                features.set(entry[0], entry[1] || \"\");\n            });\n        }\n        return features;\n    }\n    /**\n     * Set the working directory.\n     */\n    async cd(path) {\n        const validPath = await this.protectWhitespace(path);\n        return this.send(\"CWD \" + validPath);\n    }\n    /**\n     * Switch to the parent directory of the working directory.\n     */\n    async cdup() {\n        return this.send(\"CDUP\");\n    }\n    /**\n     * Get the last modified time of a file. This is not supported by every FTP server, in which case\n     * calling this method will throw an exception.\n     */\n    async lastMod(path) {\n        const validPath = await this.protectWhitespace(path);\n        const res = await this.send(`MDTM ${validPath}`);\n        const date = res.message.slice(4);\n        return (0, parseListMLSD_1.parseMLSxDate)(date);\n    }\n    /**\n     * Get the size of a file.\n     */\n    async size(path) {\n        const validPath = await this.protectWhitespace(path);\n        const command = `SIZE ${validPath}`;\n        const res = await this.send(command);\n        // The size is part of the response message, for example: \"213 555555\". It's\n        // possible that there is a commmentary appended like \"213 5555, some commentary\".\n        const size = parseInt(res.message.slice(4), 10);\n        if (Number.isNaN(size)) {\n            throw new Error(`Can't parse response to command '${command}' as a numerical value: ${res.message}`);\n        }\n        return size;\n    }\n    /**\n     * Rename a file.\n     *\n     * Depending on the FTP server this might also be used to move a file from one\n     * directory to another by providing full paths.\n     */\n    async rename(srcPath, destPath) {\n        const validSrc = await this.protectWhitespace(srcPath);\n        const validDest = await this.protectWhitespace(destPath);\n        await this.send(\"RNFR \" + validSrc);\n        return this.send(\"RNTO \" + validDest);\n    }\n    /**\n     * Remove a file from the current working directory.\n     *\n     * You can ignore FTP error return codes which won't throw an exception if e.g.\n     * the file doesn't exist.\n     */\n    async remove(path, ignoreErrorCodes = false) {\n        const validPath = await this.protectWhitespace(path);\n        if (ignoreErrorCodes) {\n            return this.sendIgnoringError(`DELE ${validPath}`);\n        }\n        return this.send(`DELE ${validPath}`);\n    }\n    /**\n     * Report transfer progress for any upload or download to a given handler.\n     *\n     * This will also reset the overall transfer counter that can be used for multiple transfers. You can\n     * also call the function without a handler to stop reporting to an earlier one.\n     *\n     * @param handler  Handler function to call on transfer progress.\n     */\n    trackProgress(handler) {\n        this._progressTracker.bytesOverall = 0;\n        this._progressTracker.reportTo(handler);\n    }\n    /**\n     * Upload data from a readable stream or a local file to a remote file.\n     *\n     * @param source  Readable stream or path to a local file.\n     * @param toRemotePath  Path to a remote file to write to.\n     */\n    async uploadFrom(source, toRemotePath, options = {}) {\n        return this._uploadWithCommand(source, toRemotePath, \"STOR\", options);\n    }\n    /**\n     * Upload data from a readable stream or a local file by appending it to an existing file. If the file doesn't\n     * exist the FTP server should create it.\n     *\n     * @param source  Readable stream or path to a local file.\n     * @param toRemotePath  Path to a remote file to write to.\n     */\n    async appendFrom(source, toRemotePath, options = {}) {\n        return this._uploadWithCommand(source, toRemotePath, \"APPE\", options);\n    }\n    /**\n     * @protected\n     */\n    async _uploadWithCommand(source, remotePath, command, options) {\n        if (typeof source === \"string\") {\n            return this._uploadLocalFile(source, remotePath, command, options);\n        }\n        return this._uploadFromStream(source, remotePath, command);\n    }\n    /**\n     * @protected\n     */\n    async _uploadLocalFile(localPath, remotePath, command, options) {\n        const fd = await fsOpen(localPath, \"r\");\n        const source = (0, fs_1.createReadStream)(\"\", {\n            fd,\n            start: options.localStart,\n            end: options.localEndInclusive,\n            autoClose: false\n        });\n        try {\n            const expectedBytes = await expectedBytesFromLocalFile(fd, options);\n            const response = await this._uploadFromStream(source, remotePath, command);\n            // A local file that is modified while it is being read results in an incomplete\n            // upload. Neither the FTP server nor the data connection can detect this, the\n            // transfer just ends early and is reported as successful. Compare what we read\n            // with what we expected to read to turn this into an error instead.\n            if (expectedBytes !== undefined && source.bytesRead !== expectedBytes) {\n                throw new Error(`Local file \"${localPath}\" changed while it was being uploaded to \"${remotePath}\": expected to send ${expectedBytes} bytes but sent ${source.bytesRead}. The remote file is incomplete.`);\n            }\n            return response;\n        }\n        finally {\n            await ignoreError(() => fsClose(fd));\n        }\n    }\n    /**\n     * @protected\n     */\n    async _uploadFromStream(source, remotePath, command) {\n        const onError = (err) => this.ftp.closeWithError(err);\n        source.once(\"error\", onError);\n        try {\n            const validPath = await this.protectWhitespace(remotePath);\n            await this.prepareTransfer(this.ftp);\n            // Keep the keyword `await` or the `finally` clause below runs too early\n            // and removes the event listener for the source stream too early.\n            return await (0, transfer_1.uploadFrom)(source, {\n                ftp: this.ftp,\n                tracker: this._progressTracker,\n                command,\n                remotePath: validPath,\n                type: \"upload\"\n            });\n        }\n        finally {\n            source.removeListener(\"error\", onError);\n        }\n    }\n    /**\n     * Download a remote file and pipe its data to a writable stream or to a local file.\n     *\n     * You can optionally define at which position of the remote file you'd like to start\n     * downloading. If the destination you provide is a file, the offset will be applied\n     * to it as well. For example: To resume a failed download, you'd request the size of\n     * the local, partially downloaded file and use that as the offset. Assuming the size\n     * is 23, you'd download the rest using `downloadTo(\"local.txt\", \"remote.txt\", 23)`.\n     *\n     * @param destination  Stream or path for a local file to write to.\n     * @param fromRemotePath  Path of the remote file to read from.\n     * @param startAt  Position within the remote file to start downloading at. If the destination is a file, this offset is also applied to it.\n     */\n    async downloadTo(destination, fromRemotePath, startAt = 0) {\n        if (typeof destination === \"string\") {\n            return this._downloadToFile(destination, fromRemotePath, startAt);\n        }\n        return this._downloadToStream(destination, fromRemotePath, startAt);\n    }\n    /**\n     * @protected\n     */\n    async _downloadToFile(localPath, remotePath, startAt) {\n        const appendingToLocalFile = startAt > 0;\n        const fileSystemFlags = appendingToLocalFile ? \"r+\" : \"w\";\n        const fd = await fsOpen(localPath, fileSystemFlags);\n        const destination = (0, fs_1.createWriteStream)(\"\", {\n            fd,\n            start: startAt,\n            autoClose: false\n        });\n        try {\n            return await this._downloadToStream(destination, remotePath, startAt);\n        }\n        catch (err) {\n            const localFileStats = await ignoreError(() => fsStat(localPath));\n            const hasDownloadedData = localFileStats && localFileStats.size > 0;\n            const shouldRemoveLocalFile = !appendingToLocalFile && !hasDownloadedData;\n            if (shouldRemoveLocalFile) {\n                await ignoreError(() => fsUnlink(localPath));\n            }\n            throw err;\n        }\n        finally {\n            await ignoreError(() => fsClose(fd));\n        }\n    }\n    /**\n     * @protected\n     */\n    async _downloadToStream(destination, remotePath, startAt) {\n        const onError = (err) => this.ftp.closeWithError(err);\n        destination.once(\"error\", onError);\n        try {\n            const validPath = await this.protectWhitespace(remotePath);\n            await this.prepareTransfer(this.ftp);\n            // Keep the keyword `await` or the `finally` clause below runs too early\n            // and removes the event listener for the source stream too early.\n            return await (0, transfer_1.downloadTo)(destination, {\n                ftp: this.ftp,\n                tracker: this._progressTracker,\n                command: startAt > 0 ? `REST ${startAt}` : `RETR ${validPath}`,\n                remotePath: validPath,\n                type: \"download\"\n            });\n        }\n        finally {\n            destination.removeListener(\"error\", onError);\n            destination.end();\n        }\n    }\n    /**\n     * List files and directories in the current working directory, or from `path` if specified.\n     *\n     * @param [path]  Path to remote file or directory.\n     */\n    async list(path = \"\") {\n        const validPath = await this.protectWhitespace(path);\n        let lastError;\n        for (const candidate of this.availableListCommands) {\n            const command = validPath === \"\" ? candidate : `${candidate} ${validPath}`;\n            await this.prepareTransfer(this.ftp);\n            try {\n                const parsedList = await this._requestListWithCommand(command);\n                // Use successful candidate for all subsequent requests.\n                this.availableListCommands = [candidate];\n                return parsedList;\n            }\n            catch (err) {\n                const shouldTryNext = err instanceof FtpContext_1.FTPError;\n                if (!shouldTryNext) {\n                    throw err;\n                }\n                lastError = err;\n            }\n        }\n        throw lastError;\n    }\n    /**\n     * @protected\n     */\n    async _requestListWithCommand(command) {\n        const buffer = new StringWriter_1.StringWriter(this.options.maxListingBytes);\n        await (0, transfer_1.downloadTo)(buffer, {\n            ftp: this.ftp,\n            tracker: this._progressTracker,\n            command,\n            remotePath: \"\",\n            type: \"list\"\n        });\n        const text = buffer.getText(this.ftp.encoding);\n        this.ftp.log(text);\n        return this.parseList(text);\n    }\n    /**\n     * Remove a directory and all of its content.\n     *\n     * @param remoteDirPath  The path of the remote directory to delete.\n     * @example client.removeDir(\"foo\") // Remove directory 'foo' using a relative path.\n     * @example client.removeDir(\"foo/bar\") // Remove directory 'bar' using a relative path.\n     * @example client.removeDir(\"/foo/bar\") // Remove directory 'bar' using an absolute path.\n     * @example client.removeDir(\"/\") // Remove everything.\n     */\n    async removeDir(remoteDirPath) {\n        return this._exitAtCurrentDirectory(async () => {\n            await this.cd(remoteDirPath);\n            // Get the absolute path of the target because remoteDirPath might be a relative path, even `../` is possible.\n            const absoluteDirPath = await this.pwd();\n            await this.clearWorkingDir();\n            const dirIsRoot = absoluteDirPath === \"/\";\n            if (!dirIsRoot) {\n                await this.cdup();\n                await this.removeEmptyDir(absoluteDirPath);\n            }\n        });\n    }\n    /**\n     * Remove all files and directories in the working directory without removing\n     * the working directory itself.\n     */\n    async clearWorkingDir() {\n        for (const file of await this.list()) {\n            if (file.isDirectory) {\n                await this.cd(file.name);\n                await this.clearWorkingDir();\n                await this.cdup();\n                await this.removeEmptyDir(file.name);\n            }\n            else {\n                await this.remove(file.name);\n            }\n        }\n    }\n    /**\n     * Upload the contents of a local directory to the remote working directory.\n     *\n     * This will overwrite existing files with the same names and reuse existing directories.\n     * Unrelated files and directories will remain untouched. You can optionally provide a `remoteDirPath`\n     * to put the contents inside a directory which will be created if necessary including all\n     * intermediate directories. If you did provide a remoteDirPath the working directory will stay\n     * the same as before calling this method.\n     *\n     * @param localDirPath  Local path, e.g. \"foo/bar\" or \"../test\"\n     * @param [remoteDirPath]  Remote path of a directory to upload to. Working directory if undefined.\n     */\n    async uploadFromDir(localDirPath, remoteDirPath) {\n        return this._exitAtCurrentDirectory(async () => {\n            if (remoteDirPath) {\n                await this.ensureDir(remoteDirPath);\n            }\n            return await this._uploadToWorkingDir(localDirPath);\n        });\n    }\n    /**\n     * @protected\n     */\n    async _uploadToWorkingDir(localDirPath) {\n        const files = await fsReadDir(localDirPath);\n        for (const file of files) {\n            const fullPath = (0, path_1.join)(localDirPath, file);\n            const stats = await fsStat(fullPath);\n            if (stats.isFile()) {\n                await this.uploadFrom(fullPath, file);\n            }\n            else if (stats.isDirectory()) {\n                await this._openDir(file);\n                await this._uploadToWorkingDir(fullPath);\n                await this.cdup();\n            }\n        }\n    }\n    /**\n     * Download all files and directories of the working directory to a local directory.\n     *\n     * @param localDirPath  The local directory to download to.\n     * @param remoteDirPath  Remote directory to download. Current working directory if not specified.\n     */\n    async downloadToDir(localDirPath, remoteDirPath) {\n        return this._exitAtCurrentDirectory(async () => {\n            if (remoteDirPath) {\n                await this.cd(remoteDirPath);\n            }\n            return await this._downloadFromWorkingDir(localDirPath);\n        });\n    }\n    /**\n     * @protected\n     */\n    async _downloadFromWorkingDir(localDirPath) {\n        await ensureLocalDirectory(localDirPath);\n        for (const file of await this.list()) {\n            const hasInvalidName = !file.name || (0, path_1.basename)(file.name) !== file.name;\n            if (hasInvalidName) {\n                const safeName = JSON.stringify(file.name);\n                this.ftp.log(`Invalid filename from server listing, will skip file. (${safeName})`);\n                continue;\n            }\n            const localPath = (0, path_1.join)(localDirPath, file.name);\n            if (file.isDirectory) {\n                await this.cd(file.name);\n                await this._downloadFromWorkingDir(localPath);\n                await this.cdup();\n            }\n            else if (file.isFile) {\n                await this.downloadTo(localPath, file.name);\n            }\n        }\n    }\n    /**\n     * Make sure a given remote path exists, creating all directories as necessary.\n     * This function also changes the current working directory to the given path.\n     */\n    async ensureDir(remoteDirPath) {\n        // If the remoteDirPath was absolute go to root directory.\n        if (remoteDirPath.startsWith(\"/\")) {\n            await this.cd(\"/\");\n        }\n        const names = remoteDirPath.split(\"/\").filter(name => name !== \"\");\n        for (const name of names) {\n            await this._openDir(name);\n        }\n    }\n    /**\n     * Try to create a directory and enter it. This will not raise an exception if the directory\n     * couldn't be created if for example it already exists.\n     * @protected\n     */\n    async _openDir(dirName) {\n        await this.sendIgnoringError(\"MKD \" + dirName);\n        await this.cd(dirName);\n    }\n    /**\n     * Remove an empty directory, will fail if not empty.\n     */\n    async removeEmptyDir(path) {\n        const validPath = await this.protectWhitespace(path);\n        return this.send(`RMD ${validPath}`);\n    }\n    /**\n     * FTP servers can't handle filenames that have leading whitespace. This method transforms\n     * a given path to fix that issue for most cases.\n     */\n    async protectWhitespace(path) {\n        if (!path.startsWith(\" \")) {\n            return path;\n        }\n        // Handle leading whitespace by prepending the absolute path:\n        // \" test.txt\" while being in the root directory becomes \"/ test.txt\".\n        const pwd = await this.pwd();\n        const absolutePathPrefix = pwd.endsWith(\"/\") ? pwd : pwd + \"/\";\n        return absolutePathPrefix + path;\n    }\n    async _exitAtCurrentDirectory(func) {\n        const userDir = await this.pwd();\n        try {\n            return await func();\n        }\n        finally {\n            if (!this.closed) {\n                await ignoreError(() => this.cd(userDir));\n            }\n        }\n    }\n    /**\n     * Try all available transfer strategies and pick the first one that works. Update `client` to\n     * use the working strategy for all successive transfer requests.\n     *\n     * @returns a function that will try the provided strategies.\n     */\n    _enterFirstCompatibleMode(strategies) {\n        return async (ftp) => {\n            ftp.log(\"Trying to find optimal transfer strategy...\");\n            let lastError = undefined;\n            for (const strategy of strategies) {\n                try {\n                    const res = await strategy(ftp);\n                    ftp.log(\"Optimal transfer strategy found.\");\n                    this.prepareTransfer = strategy;\n                    return res;\n                }\n                catch (err) {\n                    // Try the next candidate no matter the exact error. It's possible that a server\n                    // answered incorrectly to a strategy, for example a PASV answer to an EPSV.\n                    lastError = err;\n                }\n            }\n            throw new Error(`None of the available transfer strategies work. Last error response was '${lastError}'.`);\n        };\n    }\n    /**\n     * DEPRECATED, use `uploadFrom`.\n     * @deprecated\n     */\n    async upload(source, toRemotePath, options = {}) {\n        this.ftp.log(\"Warning: upload() has been deprecated, use uploadFrom().\");\n        return this.uploadFrom(source, toRemotePath, options);\n    }\n    /**\n     * DEPRECATED, use `appendFrom`.\n     * @deprecated\n     */\n    async append(source, toRemotePath, options = {}) {\n        this.ftp.log(\"Warning: append() has been deprecated, use appendFrom().\");\n        return this.appendFrom(source, toRemotePath, options);\n    }\n    /**\n     * DEPRECATED, use `downloadTo`.\n     * @deprecated\n     */\n    async download(destination, fromRemotePath, startAt = 0) {\n        this.ftp.log(\"Warning: download() has been deprecated, use downloadTo().\");\n        return this.downloadTo(destination, fromRemotePath, startAt);\n    }\n    /**\n     * DEPRECATED, use `uploadFromDir`.\n     * @deprecated\n     */\n    async uploadDir(localDirPath, remoteDirPath) {\n        this.ftp.log(\"Warning: uploadDir() has been deprecated, use uploadFromDir().\");\n        return this.uploadFromDir(localDirPath, remoteDirPath);\n    }\n    /**\n     * DEPRECATED, use `downloadToDir`.\n     * @deprecated\n     */\n    async downloadDir(localDirPath) {\n        this.ftp.log(\"Warning: downloadDir() has been deprecated, use downloadToDir().\");\n        return this.downloadToDir(localDirPath);\n    }\n}\nexports.Client = Client;\nasync function ensureLocalDirectory(path) {\n    try {\n        await fsStat(path);\n    }\n    catch (_a) {\n        await fsMkDir(path, { recursive: true });\n    }\n}\n/**\n * Return how many bytes an upload should read from an open local file, taking the optional\n * range described by `options` into account. Returns `undefined` if the size can't be known\n * upfront, for example because the source is a pipe or another non-regular file.\n */\nasync function expectedBytesFromLocalFile(fd, options) {\n    var _a;\n    const stats = await fsFStat(fd);\n    if (!stats.isFile()) {\n        return undefined;\n    }\n    const start = (_a = options.localStart) !== null && _a !== void 0 ? _a : 0;\n    // `localEndInclusive` beyond the end of the file just means \"read until the end\".\n    const endExclusive = options.localEndInclusive !== undefined\n        ? Math.min(options.localEndInclusive + 1, stats.size)\n        : stats.size;\n    return Math.max(0, endExclusive - start);\n}\nasync function ignoreError(func) {\n    try {\n        return await func();\n    }\n    catch (_a) {\n        // Ignore\n        return undefined;\n    }\n}\n");
__memMods.set("basic-ftp/dist/FileInfo.js", "\"use strict\";\nObject.defineProperty(exports, \"__esModule\", { value: true });\nexports.FileInfo = exports.FileType = void 0;\nvar FileType;\n(function (FileType) {\n    FileType[FileType[\"Unknown\"] = 0] = \"Unknown\";\n    FileType[FileType[\"File\"] = 1] = \"File\";\n    FileType[FileType[\"Directory\"] = 2] = \"Directory\";\n    FileType[FileType[\"SymbolicLink\"] = 3] = \"SymbolicLink\";\n})(FileType || (exports.FileType = FileType = {}));\n/**\n * Describes a file, directory or symbolic link.\n */\nclass FileInfo {\n    constructor(name) {\n        this.name = name;\n        this.type = FileType.Unknown;\n        this.size = 0;\n        /**\n         * Unparsed, raw modification date as a string.\n         *\n         * If `modifiedAt` is undefined, the FTP server you're connected to doesn't support the more modern\n         * MLSD command for machine-readable directory listings. The older command LIST is then used returning\n         * results that vary a lot between servers as the format hasn't been standardized. Here, directory listings\n         * and especially modification dates were meant to be human-readable first.\n         *\n         * Be careful when still trying to parse this by yourself. Parsing dates from listings using LIST is\n         * unreliable. This library decides to offer parsed dates only when they're absolutely reliable and safe to\n         * use e.g. for comparisons.\n         */\n        this.rawModifiedAt = \"\";\n        /**\n         * Parsed modification date.\n         *\n         * Available if the FTP server supports the MLSD command. Only MLSD guarantees dates than can be reliably\n         * parsed with the correct timezone and a resolution down to seconds. See `rawModifiedAt` property for the unparsed\n         * date that is always available.\n         */\n        this.modifiedAt = undefined;\n        /**\n         * Unix permissions if present. If the underlying FTP server is not running on Unix this will be undefined.\n         * If set, you might be able to edit permissions with the FTP command `SITE CHMOD`.\n         */\n        this.permissions = undefined;\n        /**\n         * Hard link count if available.\n         */\n        this.hardLinkCount = undefined;\n        /**\n         * Link name for symbolic links if available.\n         */\n        this.link = undefined;\n        /**\n         * Unix group if available.\n         */\n        this.group = undefined;\n        /**\n         * Unix user if available.\n         */\n        this.user = undefined;\n        /**\n         * Unique ID if available.\n         */\n        this.uniqueID = undefined;\n        this.name = name;\n    }\n    get isDirectory() {\n        return this.type === FileType.Directory;\n    }\n    get isSymbolicLink() {\n        return this.type === FileType.SymbolicLink;\n    }\n    get isFile() {\n        return this.type === FileType.File;\n    }\n    /**\n     * Deprecated, legacy API. Use `rawModifiedAt` instead.\n     * @deprecated\n     */\n    get date() {\n        return this.rawModifiedAt;\n    }\n    set date(rawModifiedAt) {\n        this.rawModifiedAt = rawModifiedAt;\n    }\n}\nexports.FileInfo = FileInfo;\nFileInfo.UnixPermission = {\n    Read: 4,\n    Write: 2,\n    Execute: 1\n};\n");
__memMods.set("basic-ftp/dist/FtpContext.js", "\"use strict\";\nObject.defineProperty(exports, \"__esModule\", { value: true });\nexports.FTPContext = exports.FTPError = void 0;\nconst net_1 = require(\"net\");\nconst tls_1 = require(\"tls\");\nconst parseControlResponse_1 = require(\"./parseControlResponse\");\n/**\n * Describes an FTP server error response including the FTP response code.\n */\nclass FTPError extends Error {\n    constructor(res) {\n        super(res.message);\n        this.name = this.constructor.name;\n        this.code = res.code;\n    }\n}\nexports.FTPError = FTPError;\nfunction doNothing() {\n    /** Do nothing */\n}\n// Limit the accepted size of the control response.\nconst maxControlResponseLength = 2 ** 16;\n/**\n * FTPContext holds the control and data sockets of an FTP connection and provides a\n * simplified way to interact with an FTP server, handle responses, errors and timeouts.\n *\n * It doesn't implement or use any FTP commands. It's only a foundation to make writing an FTP\n * client as easy as possible. You won't usually instantiate this, but use `Client`.\n */\nclass FTPContext {\n    /**\n     * Instantiate an FTP context.\n     *\n     * @param timeout - Timeout in milliseconds to apply to control and data connections. Use 0 for no timeout.\n     * @param encoding - Encoding to use for control connection. UTF-8 by default. Use \"latin1\" for older servers.\n     */\n    constructor(timeout = 0, encoding = \"utf8\") {\n        this.timeout = timeout;\n        /** Debug-level logging of all socket communication. */\n        this.verbose = false;\n        /** IP version to prefer (4: IPv4, 6: IPv6, undefined: automatic). */\n        this.ipFamily = undefined;\n        /** Options for TLS connections. */\n        this.tlsOptions = {};\n        /** Most recent TLS session from the control connection, used to resume the session on data connections. */\n        this.tlsSessionStore = undefined;\n        /** A multiline response might be received as multiple chunks. */\n        this._partialResponse = \"\";\n        this._encoding = encoding;\n        // Help Typescript understand that we do indeed set _socket in the constructor but use the setter method to do so.\n        this._socket = this.socket = this._newSocket();\n        this._dataSocket = undefined;\n    }\n    /**\n     * Close the context.\n     */\n    close() {\n        // Internally, closing a context is always described with an error. If there is still a task running, it will\n        // abort with an exception that the user closed the client during a task. If no task is running, no exception is\n        // thrown but all newly submitted tasks after that will abort the exception that the client has been closed.\n        // In addition the user will get a stack trace pointing to where exactly the client has been closed. So in any\n        // case use _closingError to determine whether a context is closed. This also allows us to have a single code-path\n        // for closing a context making the implementation easier.\n        const message = this._task ? \"User closed client during task\" : \"User closed client\";\n        const err = new Error(message);\n        this.closeWithError(err);\n    }\n    /**\n     * Close the context with an error.\n     */\n    closeWithError(err) {\n        // If this context already has been closed, don't overwrite the reason.\n        if (this._closingError) {\n            return;\n        }\n        this._closingError = err;\n        // Close the sockets but don't fully reset this context to preserve `this._closingError`.\n        this._closeControlSocket();\n        this._closeSocket(this._dataSocket);\n        // Give the user's task a chance to react, maybe cleanup resources.\n        this._passToHandler(err);\n        // The task might not have been rejected by the user after receiving the error.\n        this._stopTrackingTask();\n    }\n    /**\n     * Returns true if this context has been closed or hasn't been connected yet. You can reopen it with `access`.\n     */\n    get closed() {\n        return this.socket.remoteAddress === undefined || this._closingError !== undefined;\n    }\n    /**\n     * Reset this contex and all of its state.\n     */\n    reset() {\n        this.socket = this._newSocket();\n    }\n    /**\n     * Get the FTP control socket.\n     */\n    get socket() {\n        return this._socket;\n    }\n    /**\n     * Set the socket for the control connection. This will only close the current control socket\n     * if the new one is not an upgrade to the current one.\n     */\n    set socket(socket) {\n        // No data socket should be open in any case where the control socket is set or upgraded.\n        this.dataSocket = undefined;\n        // This being a reset, reset any other state apart from the socket.\n        this.tlsOptions = {};\n        this.tlsSessionStore = undefined;\n        this._partialResponse = \"\";\n        if (this._socket) {\n            const newSocketUpgradesExisting = socket.localPort === this._socket.localPort;\n            if (newSocketUpgradesExisting) {\n                this._removeSocketListeners(this.socket);\n            }\n            else {\n                this._closeControlSocket();\n            }\n        }\n        if (socket) {\n            // Setting a completely new control socket is in essence something like a reset. That's\n            // why we also close any open data connection above. We can go one step further and reset\n            // a possible closing error. That means that a closed FTPContext can be \"reopened\" by\n            // setting a new control socket.\n            this._closingError = undefined;\n            // Don't set a timeout yet. Timeout for control sockets is only active during a task, see handle() below.\n            socket.setTimeout(0);\n            socket.setEncoding(this._encoding);\n            socket.setKeepAlive(true);\n            socket.on(\"data\", data => this._onControlSocketData(data));\n            // Server sending a FIN packet is treated as an error.\n            socket.on(\"end\", () => this.closeWithError(new Error(\"Server sent FIN packet unexpectedly, closing connection.\")));\n            // Control being closed without error by server is treated as an error.\n            socket.on(\"close\", hadError => { if (!hadError)\n                this.closeWithError(new Error(\"Server closed connection unexpectedly.\")); });\n            this._setupDefaultErrorHandlers(socket, \"control socket\");\n            if (socket instanceof tls_1.TLSSocket) {\n                socket.on(\"session\", session => { this.tlsSessionStore = session; });\n            }\n        }\n        this._socket = socket;\n    }\n    /**\n     * Get the current FTP data connection if present.\n     */\n    get dataSocket() {\n        return this._dataSocket;\n    }\n    /**\n     * Set the socket for the data connection. This will automatically close the former data socket.\n     */\n    set dataSocket(socket) {\n        this._closeSocket(this._dataSocket);\n        if (socket) {\n            // Don't set a timeout yet. Timeout data socket should be activated when data transmission starts\n            // and timeout on control socket is deactivated.\n            socket.setTimeout(0);\n            this._setupDefaultErrorHandlers(socket, \"data socket\");\n        }\n        this._dataSocket = socket;\n    }\n    /**\n     * Get the currently used encoding.\n     */\n    get encoding() {\n        return this._encoding;\n    }\n    /**\n     * Set the encoding used for the control socket.\n     *\n     * See https://nodejs.org/api/buffer.html#buffer_buffers_and_character_encodings for what encodings\n     * are supported by Node.\n     */\n    set encoding(encoding) {\n        this._encoding = encoding;\n        if (this.socket) {\n            this.socket.setEncoding(encoding);\n        }\n    }\n    /**\n     * Send an FTP command without waiting for or handling the result.\n     */\n    send(command) {\n        // Reject control character injection attempts.\n        if (/[\\r\\n\\0]/.test(command)) {\n            throw new Error(`Invalid command: Contains control characters. (${command})`);\n        }\n        const containsPassword = command.startsWith(\"PASS\");\n        const message = containsPassword ? \"> PASS ###\" : `> ${command}`;\n        this.log(message);\n        this._socket.write(command + \"\\r\\n\", this.encoding);\n    }\n    /**\n     * Send an FTP command and handle the first response. Use this if you have a simple\n     * request-response situation.\n     */\n    request(command) {\n        return this.handle(command, (res, task) => {\n            if (res instanceof Error) {\n                task.reject(res);\n            }\n            else {\n                task.resolve(res);\n            }\n        });\n    }\n    /**\n     * Send an FTP command and handle any response until you resolve/reject. Use this if you expect multiple responses\n     * to a request. This returns a Promise that will hold whatever the response handler passed on when resolving/rejecting its task.\n     */\n    handle(command, responseHandler) {\n        if (this._task) {\n            const err = new Error(\"User launched a task while another one is still running. Forgot to use 'await' or '.then()'?\");\n            err.stack += `\\nRunning task launched at: ${this._task.stack}`;\n            this.closeWithError(err);\n            // Don't return here, continue with returning the Promise that will then be rejected\n            // because the context closed already. That way, users will receive an exception where\n            // they called this method by mistake.\n        }\n        return new Promise((resolveTask, rejectTask) => {\n            // A task can only be settled once. A handler can still hold on to its resolver after\n            // that, for example because a stream reports an error late. By then the next task\n            // might be running already and stopping to track it would leave it without a response.\n            let settled = false;\n            const stopTrackingOnce = () => {\n                if (settled) {\n                    return;\n                }\n                settled = true;\n                this._stopTrackingTask();\n            };\n            this._task = {\n                stack: new Error().stack || \"Unknown call stack\",\n                responseHandler,\n                resolver: {\n                    resolve: arg => {\n                        stopTrackingOnce();\n                        resolveTask(arg);\n                    },\n                    reject: err => {\n                        stopTrackingOnce();\n                        rejectTask(err);\n                    }\n                }\n            };\n            if (this._closingError) {\n                // This client has been closed. Provide an error that describes this one as being caused\n                // by `_closingError`, include stack traces for both.\n                const err = new Error(`Client is closed because ${this._closingError.message}`); // Type 'Error' is not correctly defined, doesn't have 'code'.\n                err.stack += `\\nClosing reason: ${this._closingError.stack}`;\n                err.code = this._closingError.code !== undefined ? this._closingError.code : \"0\";\n                this._passToHandler(err);\n                return;\n            }\n            // Only track control socket timeout during the lifecycle of a task. This avoids timeouts on idle sockets,\n            // the default socket behaviour which is not expected by most users.\n            this.socket.setTimeout(this.timeout);\n            if (command) {\n                this.send(command);\n            }\n        });\n    }\n    /**\n     * Log message if set to be verbose.\n     */\n    log(message) {\n        if (this.verbose) {\n            // tslint:disable-next-line no-console\n            console.log(message);\n        }\n    }\n    /**\n     * Return true if the control socket is using TLS. This does not mean that a session\n     * has already been negotiated.\n     */\n    get hasTLS() {\n        return \"encrypted\" in this._socket;\n    }\n    /**\n     * Removes reference to current task and handler. This won't resolve or reject the task.\n     * @protected\n     */\n    _stopTrackingTask() {\n        // Disable timeout on control socket if there is no task active.\n        this.socket.setTimeout(0);\n        this._task = undefined;\n    }\n    /**\n     * Handle incoming data on the control socket. The chunk is going to be of type `string`\n     * because we let `socket` handle encoding with `setEncoding`.\n     * @protected\n     */\n    _onControlSocketData(chunk) {\n        this.log(`< ${chunk}`);\n        // This chunk might complete an earlier partial response. Protect against unbounded response attack.\n        if (this._partialResponse.length + chunk.length > maxControlResponseLength) {\n            this.closeWithError(new Error(\"FTP control response exceeded maximum allowed size\"));\n            return;\n        }\n        const completeResponse = this._partialResponse + chunk;\n        const parsed = (0, parseControlResponse_1.parseControlResponse)(completeResponse);\n        // Remember any incomplete remainder.\n        this._partialResponse = parsed.rest;\n        // Each response group is passed along individually.\n        for (const message of parsed.messages) {\n            const code = parseInt(message.substr(0, 3), 10);\n            const response = { code, message };\n            const err = code >= 400 ? new FTPError(response) : undefined;\n            this._passToHandler(err ? err : response);\n        }\n    }\n    /**\n     * Send the current handler a response. This is usually a control socket response\n     * or a socket event, like an error or timeout.\n     * @protected\n     */\n    _passToHandler(response) {\n        if (this._task) {\n            this._task.responseHandler(response, this._task.resolver);\n        }\n        // Errors other than FTPError always close the client. If there isn't an active task to handle the error,\n        // the next one submitted will receive it using `_closingError`.\n        // There is only one edge-case: If there is an FTPError while no task is active, the error will be dropped.\n        // But that means that the user sent an FTP command with no intention of handling the result. So why should the\n        // error be handled? Maybe log it at least? Debug logging will already do that and the client stays useable after\n        // FTPError. So maybe no need to do anything here.\n    }\n    /**\n     * Setup all error handlers for a socket.\n     * @protected\n     */\n    _setupDefaultErrorHandlers(socket, identifier) {\n        socket.once(\"error\", error => {\n            error.message += ` (${identifier})`;\n            this.closeWithError(error);\n        });\n        socket.once(\"close\", hadError => {\n            if (hadError) {\n                this.closeWithError(new Error(`Socket closed due to transmission error (${identifier})`));\n            }\n        });\n        socket.once(\"timeout\", () => {\n            socket.destroy();\n            this.closeWithError(new Error(`Timeout (${identifier})`));\n        });\n    }\n    /**\n     * Close the control socket. Sends QUIT, then FIN, and ignores any response or error.\n     */\n    _closeControlSocket() {\n        this._removeSocketListeners(this._socket);\n        this._socket.on(\"error\", doNothing);\n        this.send(\"QUIT\");\n        this._closeSocket(this._socket);\n    }\n    /**\n     * Close a socket, ignores any error.\n     * @protected\n     */\n    _closeSocket(socket) {\n        if (socket) {\n            this._removeSocketListeners(socket);\n            socket.on(\"error\", doNothing);\n            socket.destroy();\n        }\n    }\n    /**\n     * Remove all default listeners for socket.\n     * @protected\n     */\n    _removeSocketListeners(socket) {\n        socket.removeAllListeners();\n        // Before Node.js 10.3.0, using `socket.removeAllListeners()` without any name did not work: https://github.com/nodejs/node/issues/20923.\n        socket.removeAllListeners(\"timeout\");\n        socket.removeAllListeners(\"data\");\n        socket.removeAllListeners(\"end\");\n        socket.removeAllListeners(\"error\");\n        socket.removeAllListeners(\"close\");\n        socket.removeAllListeners(\"connect\");\n    }\n    /**\n     * Provide a new socket instance.\n     *\n     * Internal use only, replaced for unit tests.\n     */\n    _newSocket() {\n        return new net_1.Socket();\n    }\n}\nexports.FTPContext = FTPContext;\n");
__memMods.set("basic-ftp/dist/index.js", "\"use strict\";\nvar __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {\n    if (k2 === undefined) k2 = k;\n    var desc = Object.getOwnPropertyDescriptor(m, k);\n    if (!desc || (\"get\" in desc ? !m.__esModule : desc.writable || desc.configurable)) {\n      desc = { enumerable: true, get: function() { return m[k]; } };\n    }\n    Object.defineProperty(o, k2, desc);\n}) : (function(o, m, k, k2) {\n    if (k2 === undefined) k2 = k;\n    o[k2] = m[k];\n}));\nvar __exportStar = (this && this.__exportStar) || function(m, exports) {\n    for (var p in m) if (p !== \"default\" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);\n};\nObject.defineProperty(exports, \"__esModule\", { value: true });\nexports.enterPassiveModeIPv6 = exports.enterPassiveModeIPv4 = void 0;\n/**\n * Public API\n */\n__exportStar(require(\"./Client\"), exports);\n__exportStar(require(\"./FtpContext\"), exports);\n__exportStar(require(\"./FileInfo\"), exports);\n__exportStar(require(\"./parseList\"), exports);\n__exportStar(require(\"./StringEncoding\"), exports);\nvar transfer_1 = require(\"./transfer\");\nObject.defineProperty(exports, \"enterPassiveModeIPv4\", { enumerable: true, get: function () { return transfer_1.enterPassiveModeIPv4; } });\nObject.defineProperty(exports, \"enterPassiveModeIPv6\", { enumerable: true, get: function () { return transfer_1.enterPassiveModeIPv6; } });\n");
__memMods.set("basic-ftp/dist/netUtils.js", "\"use strict\";\nObject.defineProperty(exports, \"__esModule\", { value: true });\nexports.describeTLS = describeTLS;\nexports.describeAddress = describeAddress;\nexports.upgradeSocket = upgradeSocket;\nexports.isLoopback = isLoopback;\nexports.ipIsPrivateV4Address = ipIsPrivateV4Address;\nconst tls_1 = require(\"tls\");\n/**\n * Returns a string describing the encryption on a given socket instance.\n */\nfunction describeTLS(socket) {\n    if (socket instanceof tls_1.TLSSocket) {\n        const protocol = socket.getProtocol();\n        return protocol ? protocol : \"Server socket or disconnected client socket\";\n    }\n    return \"No encryption\";\n}\n/**\n * Returns a string describing the remote address of a socket.\n */\nfunction describeAddress(socket) {\n    if (socket.remoteFamily === \"IPv6\") {\n        return `[${socket.remoteAddress}]:${socket.remotePort}`;\n    }\n    return `${socket.remoteAddress}:${socket.remotePort}`;\n}\n/**\n * Upgrade a socket connection with TLS.\n */\nfunction upgradeSocket(socket, options) {\n    return new Promise((resolve, reject) => {\n        const tlsOptions = Object.assign({}, options, {\n            socket\n        });\n        const tlsSocket = (0, tls_1.connect)(tlsOptions, () => {\n            const expectCertificate = tlsOptions.rejectUnauthorized !== false;\n            if (expectCertificate && !tlsSocket.authorized) {\n                reject(tlsSocket.authorizationError);\n            }\n            else {\n                // Remove error listener added below.\n                tlsSocket.removeAllListeners(\"error\");\n                resolve(tlsSocket);\n            }\n        }).once(\"error\", error => {\n            reject(error);\n        });\n    });\n}\n/**\n * Returns true if an IP address is a loopback address.\n */\nfunction isLoopback(ip) {\n    return ip === \"::1\" || ip.startsWith(\"127.\");\n}\n/**\n * Returns true if an IP is a private address according to https://tools.ietf.org/html/rfc1918#section-3.\n * This will handle IPv4-mapped IPv6 addresses correctly but return false for all other IPv6 addresses.\n *\n * @param ip  The IP as a string, e.g. \"192.168.0.1\"\n */\nfunction ipIsPrivateV4Address(ip = \"\") {\n    // Handle IPv4-mapped IPv6 addresses like ::ffff:192.168.0.1\n    if (ip.startsWith(\"::ffff:\")) {\n        ip = ip.substr(7); // Strip ::ffff: prefix\n    }\n    const octets = ip.split(\".\").map(o => parseInt(o, 10));\n    return octets[0] === 10 // 10.0.0.0 - 10.255.255.255\n        || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) // 172.16.0.0 - 172.31.255.255\n        || (octets[0] === 192 && octets[1] === 168) // 192.168.0.0 - 192.168.255.255\n        || ip === \"127.0.0.1\";\n}\n");
__memMods.set("basic-ftp/dist/parseControlResponse.js", "\"use strict\";\nObject.defineProperty(exports, \"__esModule\", { value: true });\nexports.parseControlResponse = parseControlResponse;\nexports.isSingleLine = isSingleLine;\nexports.isMultiline = isMultiline;\nexports.positiveCompletion = positiveCompletion;\nexports.positiveIntermediate = positiveIntermediate;\nconst LF = \"\\n\";\n/**\n * Parse an FTP control response as a collection of messages. A message is a complete\n * single- or multiline response. A response can also contain multiple multiline responses\n * that will each be represented by a message. A response can also be incomplete\n * and be completed on the next incoming data chunk for which case this function also\n * describes a `rest`. This function converts all CRLF to LF.\n */\nfunction parseControlResponse(text) {\n    const lines = text.split(/\\r?\\n/).filter(isNotBlank);\n    const messages = [];\n    let startAt = 0;\n    let tokenRegex;\n    for (let i = 0; i < lines.length; i++) {\n        const line = lines[i];\n        // No group has been opened.\n        if (!tokenRegex) {\n            if (isMultiline(line)) {\n                // Open a group by setting an expected token.\n                const token = line.substr(0, 3);\n                tokenRegex = new RegExp(`^${token}(?:$| )`);\n                startAt = i;\n            }\n            else if (isSingleLine(line)) {\n                // Single lines can be grouped immediately.\n                messages.push(line);\n            }\n        }\n        // Group has been opened, expect closing token.\n        else if (tokenRegex.test(line)) {\n            tokenRegex = undefined;\n            messages.push(lines.slice(startAt, i + 1).join(LF));\n        }\n    }\n    // The last group might not have been closed, report it as a rest.\n    const rest = tokenRegex ? lines.slice(startAt).join(LF) + LF : \"\";\n    return { messages, rest };\n}\nfunction isSingleLine(line) {\n    return /^\\d\\d\\d(?:$| )/.test(line);\n}\nfunction isMultiline(line) {\n    return /^\\d\\d\\d-/.test(line);\n}\n/**\n * Return true if an FTP return code describes a positive completion.\n */\nfunction positiveCompletion(code) {\n    return code >= 200 && code < 300;\n}\n/**\n * Return true if an FTP return code describes a positive intermediate response.\n */\nfunction positiveIntermediate(code) {\n    return code >= 300 && code < 400;\n}\nfunction isNotBlank(str) {\n    return str.trim() !== \"\";\n}\n");
__memMods.set("basic-ftp/dist/parseList.js", "\"use strict\";\nvar __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {\n    if (k2 === undefined) k2 = k;\n    var desc = Object.getOwnPropertyDescriptor(m, k);\n    if (!desc || (\"get\" in desc ? !m.__esModule : desc.writable || desc.configurable)) {\n      desc = { enumerable: true, get: function() { return m[k]; } };\n    }\n    Object.defineProperty(o, k2, desc);\n}) : (function(o, m, k, k2) {\n    if (k2 === undefined) k2 = k;\n    o[k2] = m[k];\n}));\nvar __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {\n    Object.defineProperty(o, \"default\", { enumerable: true, value: v });\n}) : function(o, v) {\n    o[\"default\"] = v;\n});\nvar __importStar = (this && this.__importStar) || (function () {\n    var ownKeys = function(o) {\n        ownKeys = Object.getOwnPropertyNames || function (o) {\n            var ar = [];\n            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;\n            return ar;\n        };\n        return ownKeys(o);\n    };\n    return function (mod) {\n        if (mod && mod.__esModule) return mod;\n        var result = {};\n        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== \"default\") __createBinding(result, mod, k[i]);\n        __setModuleDefault(result, mod);\n        return result;\n    };\n})();\nObject.defineProperty(exports, \"__esModule\", { value: true });\nexports.parseList = parseList;\nconst dosParser = __importStar(require(\"./parseListDOS\"));\nconst unixParser = __importStar(require(\"./parseListUnix\"));\nconst mlsdParser = __importStar(require(\"./parseListMLSD\"));\n/**\n * Available directory listing parsers. These are candidates that will be tested\n * in the order presented. The first candidate will be used to parse the whole list.\n */\nconst availableParsers = [\n    dosParser,\n    unixParser,\n    mlsdParser // Keep MLSD last, may accept filename only\n];\nfunction firstCompatibleParser(line, parsers) {\n    return parsers.find(parser => parser.testLine(line) === true);\n}\nfunction isNotBlank(str) {\n    return str.trim() !== \"\";\n}\nfunction isNotMeta(str) {\n    return !str.startsWith(\"total\");\n}\nconst REGEX_NEWLINE = /\\r?\\n/;\n/**\n * Parse raw directory listing.\n */\nfunction parseList(rawList) {\n    const lines = rawList\n        .split(REGEX_NEWLINE)\n        .filter(isNotBlank)\n        .filter(isNotMeta);\n    if (lines.length === 0) {\n        return [];\n    }\n    const testLine = lines[lines.length - 1];\n    const parser = firstCompatibleParser(testLine, availableParsers);\n    if (!parser) {\n        throw new Error(\"This library only supports MLSD, Unix- or DOS-style directory listing. Your FTP server seems to be using another format. You can see the transmitted listing when setting `client.ftp.verbose = true`. You can then provide a custom parser to `client.parseList`, see the documentation for details.\");\n    }\n    const files = lines\n        .map(parser.parseLine)\n        .filter((info) => info !== undefined);\n    return parser.transformList(files);\n}\n");
__memMods.set("basic-ftp/dist/parseListDOS.js", "\"use strict\";\nObject.defineProperty(exports, \"__esModule\", { value: true });\nexports.testLine = testLine;\nexports.parseLine = parseLine;\nexports.transformList = transformList;\nconst FileInfo_1 = require(\"./FileInfo\");\n/**\n * This parser is based on the FTP client library source code in Apache Commons Net provided\n * under the Apache 2.0 license. It has been simplified and rewritten to better fit the Javascript language.\n *\n * https://github.com/apache/commons-net/blob/master/src/main/java/org/apache/commons/net/ftp/parser/NTFTPEntryParser.java\n */\nconst RE_LINE = new RegExp(\"(\\\\S+)\\\\s+(\\\\S+)\\\\s+\" // MM-dd-yy whitespace hh:mma|kk:mm swallow trailing spaces\n    + \"(?:(<DIR>)|([0-9]+))\\\\s+\" // <DIR> or ddddd swallow trailing spaces\n    + \"(\\\\S.*)\" // First non-space followed by rest of line (name)\n);\n/**\n * Returns true if a given line might be a DOS-style listing.\n *\n * - Example: `12-05-96  05:03PM       <DIR>          myDir`\n */\nfunction testLine(line) {\n    return /^\\d{2}/.test(line) && RE_LINE.test(line);\n}\n/**\n * Parse a single line of a DOS-style directory listing.\n */\nfunction parseLine(line) {\n    const groups = line.match(RE_LINE);\n    if (groups === null) {\n        return undefined;\n    }\n    const name = groups[5];\n    if (name === \".\" || name === \"..\") { // Ignore parent directory links\n        return undefined;\n    }\n    const file = new FileInfo_1.FileInfo(name);\n    const fileType = groups[3];\n    if (fileType === \"<DIR>\") {\n        file.type = FileInfo_1.FileType.Directory;\n        file.size = 0;\n    }\n    else {\n        file.type = FileInfo_1.FileType.File;\n        file.size = parseInt(groups[4], 10);\n    }\n    file.rawModifiedAt = groups[1] + \" \" + groups[2];\n    return file;\n}\nfunction transformList(files) {\n    return files;\n}\n");
__memMods.set("basic-ftp/dist/parseListMLSD.js", "\"use strict\";\nObject.defineProperty(exports, \"__esModule\", { value: true });\nexports.testLine = testLine;\nexports.parseLine = parseLine;\nexports.transformList = transformList;\nexports.parseMLSxDate = parseMLSxDate;\nconst FileInfo_1 = require(\"./FileInfo\");\nfunction parseSize(value, info) {\n    info.size = parseInt(value, 10);\n}\n/**\n * Parsers for MLSD facts.\n */\nconst factHandlersByName = {\n    \"size\": parseSize, // File size\n    \"sizd\": parseSize, // Directory size\n    \"unique\": (value, info) => {\n        info.uniqueID = value;\n    },\n    \"modify\": (value, info) => {\n        info.modifiedAt = parseMLSxDate(value);\n        info.rawModifiedAt = info.modifiedAt.toISOString();\n    },\n    \"type\": (value, info) => {\n        // There seems to be confusion on how to handle symbolic links for Unix. RFC 3659 doesn't describe\n        // this but mentions some examples using the syntax `type=OS.unix=slink:<target>`. But according to\n        // an entry in the Errata (https://www.rfc-editor.org/errata/eid1500) this syntax can't be valid.\n        // Instead it proposes to use `type=OS.unix=symlink` and to then list the actual target of the\n        // symbolic link as another entry in the directory listing. The unique identifiers can then be used\n        // to derive the connection between link(s) and target. We'll have to handle both cases as there\n        // are differing opinions on how to deal with this. Here are some links on this topic:\n        // - ProFTPD source: https://github.com/proftpd/proftpd/blob/56e6dfa598cbd4ef5c6cba439bcbcd53a63e3b21/modules/mod_facts.c#L531\n        // - ProFTPD bug: http://bugs.proftpd.org/show_bug.cgi?id=3318\n        // - ProFTPD statement: http://www.proftpd.org/docs/modules/mod_facts.html\n        // – FileZilla bug: https://trac.filezilla-project.org/ticket/9310\n        if (value.startsWith(\"OS.unix=slink\")) {\n            info.type = FileInfo_1.FileType.SymbolicLink;\n            info.link = value.substr(value.indexOf(\":\") + 1);\n            return 1 /* FactHandlerResult.Continue */;\n        }\n        switch (value) {\n            case \"file\":\n                info.type = FileInfo_1.FileType.File;\n                break;\n            case \"dir\":\n                info.type = FileInfo_1.FileType.Directory;\n                break;\n            case \"OS.unix=symlink\":\n                info.type = FileInfo_1.FileType.SymbolicLink;\n                // The target of the symbolic link might be defined in another line in the directory listing.\n                // We'll handle this in `transformList()` below.\n                break;\n            case \"cdir\": // Current directory being listed\n            case \"pdir\": // Parent directory\n                return 2 /* FactHandlerResult.IgnoreFile */; // Don't include these entries in the listing\n            default:\n                info.type = FileInfo_1.FileType.Unknown;\n        }\n        return 1 /* FactHandlerResult.Continue */;\n    },\n    \"unix.mode\": (value, info) => {\n        const digits = value.substr(-3);\n        info.permissions = {\n            user: parseInt(digits[0], 10),\n            group: parseInt(digits[1], 10),\n            world: parseInt(digits[2], 10)\n        };\n    },\n    \"unix.ownername\": (value, info) => {\n        info.user = value;\n    },\n    \"unix.owner\": (value, info) => {\n        if (info.user === undefined)\n            info.user = value;\n    },\n    get \"unix.uid\"() {\n        return this[\"unix.owner\"];\n    },\n    \"unix.groupname\": (value, info) => {\n        info.group = value;\n    },\n    \"unix.group\": (value, info) => {\n        if (info.group === undefined)\n            info.group = value;\n    },\n    get \"unix.gid\"() {\n        return this[\"unix.group\"];\n    }\n    // Regarding the fact \"perm\":\n    // We don't handle permission information stored in \"perm\" because its information is conceptually\n    // different from what users of FTP clients usually associate with \"permissions\". Those that have\n    // some expectations (and probably want to edit them with a SITE command) often unknowingly expect\n    // the Unix permission system. The information passed by \"perm\" describes what FTP commands can be\n    // executed with a file/directory. But even this can be either incomplete or just meant as a \"guide\"\n    // as the spec mentions. From https://tools.ietf.org/html/rfc3659#section-7.5.5: \"The permissions are\n    // described here as they apply to FTP commands. They may not map easily into particular permissions\n    // available on the server's operating system.\" The parser by Apache Commons tries to translate these\n    // to Unix permissions – this is misleading users and might not even be correct.\n};\n/**\n * Split a string once at the first position of a delimiter. For example\n * `splitStringOnce(\"a b c d\", \" \")` returns `[\"a\", \"b c d\"]`.\n */\nfunction splitStringOnce(str, delimiter) {\n    const pos = str.indexOf(delimiter);\n    const a = str.substr(0, pos);\n    const b = str.substr(pos + delimiter.length);\n    return [a, b];\n}\n/**\n * Returns true if a given line might be part of an MLSD listing.\n *\n * - Example 1: `size=15227;type=dir;perm=el;modify=20190419065730; test one`\n * - Example 2: ` file name` (leading space)\n */\nfunction testLine(line) {\n    return /^\\S+=\\S+;/.test(line) || line.startsWith(\" \");\n}\n/**\n * Parse single line as MLSD listing, see specification at https://tools.ietf.org/html/rfc3659#section-7.\n */\nfunction parseLine(line) {\n    const [packedFacts, name] = splitStringOnce(line, \" \");\n    if (name === \"\" || name === \".\" || name === \"..\") {\n        return undefined;\n    }\n    const info = new FileInfo_1.FileInfo(name);\n    const facts = packedFacts.split(\";\");\n    for (const fact of facts) {\n        const [factName, factValue] = splitStringOnce(fact, \"=\");\n        if (!factValue) {\n            continue;\n        }\n        const factHandler = factHandlersByName[factName.toLowerCase()];\n        if (!factHandler) {\n            continue;\n        }\n        const result = factHandler(factValue, info);\n        if (result === 2 /* FactHandlerResult.IgnoreFile */) {\n            return undefined;\n        }\n    }\n    return info;\n}\nfunction transformList(files) {\n    // Create a map of all files that are not symbolic links by their unique ID\n    const nonLinksByID = new Map();\n    for (const file of files) {\n        if (!file.isSymbolicLink && file.uniqueID !== undefined) {\n            nonLinksByID.set(file.uniqueID, file);\n        }\n    }\n    const resolvedFiles = [];\n    for (const file of files) {\n        // Try to associate unresolved symbolic links with a target file/directory.\n        if (file.isSymbolicLink && file.uniqueID !== undefined && file.link === undefined) {\n            const target = nonLinksByID.get(file.uniqueID);\n            if (target !== undefined) {\n                file.link = target.name;\n            }\n        }\n        // The target of a symbolic link is listed as an entry in the directory listing but might\n        // have a path pointing outside of this directory. In that case we don't want this entry\n        // to be part of the listing. We generally don't want these kind of entries at all.\n        const isPartOfDirectory = !file.name.includes(\"/\");\n        if (isPartOfDirectory) {\n            resolvedFiles.push(file);\n        }\n    }\n    return resolvedFiles;\n}\n/**\n * Parse date as specified in https://tools.ietf.org/html/rfc3659#section-2.3.\n *\n * Message contains response code and modified time in the format: YYYYMMDDHHMMSS[.sss]\n * For example `19991005213102` or `19980615100045.014`.\n */\nfunction parseMLSxDate(fact) {\n    return new Date(Date.UTC(+fact.slice(0, 4), // Year\n    +fact.slice(4, 6) - 1, // Month\n    +fact.slice(6, 8), // Date\n    +fact.slice(8, 10), // Hours\n    +fact.slice(10, 12), // Minutes\n    +fact.slice(12, 14), // Seconds\n    +fact.slice(15, 18) // Milliseconds\n    ));\n}\n");
__memMods.set("basic-ftp/dist/parseListUnix.js", "\"use strict\";\nObject.defineProperty(exports, \"__esModule\", { value: true });\nexports.testLine = testLine;\nexports.parseLine = parseLine;\nexports.transformList = transformList;\nconst FileInfo_1 = require(\"./FileInfo\");\nconst JA_MONTH = \"\\u6708\";\nconst JA_DAY = \"\\u65e5\";\nconst JA_YEAR = \"\\u5e74\";\n/**\n * This parser is based on the FTP client library source code in Apache Commons Net provided\n * under the Apache 2.0 license. It has been simplified and rewritten to better fit the Javascript language.\n *\n * https://github.com/apache/commons-net/blob/master/src/main/java/org/apache/commons/net/ftp/parser/UnixFTPEntryParser.java\n *\n * Below is the regular expression used by this parser.\n *\n * Permissions:\n *    r   the file is readable\n *    w   the file is writable\n *    x   the file is executable\n *    -   the indicated permission is not granted\n *    L   mandatory locking occurs during access (the set-group-ID bit is\n *        on and the group execution bit is off)\n *    s   the set-user-ID or set-group-ID bit is on, and the corresponding\n *        user or group execution bit is also on\n *    S   undefined bit-state (the set-user-ID bit is on and the user\n *        execution bit is off)\n *    t   the 1000 (octal) bit, or sticky bit, is on [see chmod(1)], and\n *        execution is on\n *    T   the 1000 bit is turned on, and execution is off (undefined bit-\n *        state)\n *    e   z/OS external link bit\n *    Final letter may be appended:\n *    +   file has extended security attributes (e.g. ACL)\n *    Note: local listings on MacOSX also use '@'\n *    this is not allowed for here as does not appear to be shown by FTP servers\n *    {@code @}   file has extended attributes\n */\nconst RE_LINE = new RegExp(\"([bcdelfmpSs-])\" // file type\n    + \"(((r|-)(w|-)([xsStTL-]))((r|-)(w|-)([xsStTL-]))((r|-)(w|-)([xsStTL-]?)))\\\\+?\" // permissions\n    + \"\\\\s*\" // separator TODO why allow it to be omitted??\n    + \"(\\\\d+)\" // link count\n    + \"\\\\s+\" // separator\n    + \"(?:(\\\\S+(?:\\\\s\\\\S+)*?)\\\\s+)?\" // owner name (optional spaces)\n    + \"(?:(\\\\S+(?:\\\\s\\\\S+)*)\\\\s+)?\" // group name (optional spaces)\n    + \"(\\\\d+(?:,\\\\s*\\\\d+)?)\" // size or n,m\n    + \"\\\\s+\" // separator\n    /**\n     * numeric or standard format date:\n     *   yyyy-mm-dd (expecting hh:mm to follow)\n     *   MMM [d]d\n     *   [d]d MMM\n     *   N.B. use non-space for MMM to allow for languages such as German which use\n     *   diacritics (e.g. umlaut) in some abbreviations.\n     *   Japanese uses numeric day and month with suffixes to distinguish them\n     *   [d]dXX [d]dZZ\n     */\n    + \"(\" +\n    \"(?:\\\\d+[-/]\\\\d+[-/]\\\\d+)\" + // yyyy-mm-dd\n    \"|(?:\\\\S{3}\\\\s+\\\\d{1,2})\" + // MMM [d]d\n    \"|(?:\\\\d{1,2}\\\\s+\\\\S{3})\" + // [d]d MMM\n    \"|(?:\\\\d{1,2}\" + JA_MONTH + \"\\\\s+\\\\d{1,2}\" + JA_DAY + \")\" +\n    \")\"\n    + \"\\\\s+\" // separator\n    /**\n     * year (for non-recent standard format) - yyyy\n     * or time (for numeric or recent standard format) [h]h:mm\n     * or Japanese year - yyyyXX\n     */\n    + \"((?:\\\\d+(?::\\\\d+)?)|(?:\\\\d{4}\" + JA_YEAR + \"))\" // (20)\n    + \"\\\\s\" // separator\n    + \"(.*)\"); // the rest (21)\n/**\n * Returns true if a given line might be a Unix-style listing.\n *\n * - Example: `-rw-r--r--+   1 patrick  staff   1057 Dec 11 14:35 test.txt`\n */\nfunction testLine(line) {\n    return RE_LINE.test(line);\n}\n/**\n * Parse a single line of a Unix-style directory listing.\n */\nfunction parseLine(line) {\n    const groups = line.match(RE_LINE);\n    if (groups === null) {\n        return undefined;\n    }\n    const name = groups[21];\n    if (name === \".\" || name === \"..\") { // Ignore parent directory links\n        return undefined;\n    }\n    const file = new FileInfo_1.FileInfo(name);\n    file.size = parseInt(groups[18], 10);\n    file.user = groups[16];\n    file.group = groups[17];\n    file.hardLinkCount = parseInt(groups[15], 10);\n    file.rawModifiedAt = groups[19] + \" \" + groups[20];\n    file.permissions = {\n        user: parseMode(groups[4], groups[5], groups[6]),\n        group: parseMode(groups[8], groups[9], groups[10]),\n        world: parseMode(groups[12], groups[13], groups[14]),\n    };\n    // Set file type\n    switch (groups[1].charAt(0)) {\n        case \"d\":\n            file.type = FileInfo_1.FileType.Directory;\n            break;\n        case \"e\": // NET-39 => z/OS external link\n            file.type = FileInfo_1.FileType.SymbolicLink;\n            break;\n        case \"l\":\n            file.type = FileInfo_1.FileType.SymbolicLink;\n            break;\n        case \"b\":\n        case \"c\":\n            file.type = FileInfo_1.FileType.File; // TODO change this if DEVICE_TYPE implemented\n            break;\n        case \"f\":\n        case \"-\":\n            file.type = FileInfo_1.FileType.File;\n            break;\n        default:\n            // A 'whiteout' file is an ARTIFICIAL entry in any of several types of\n            // 'translucent' filesystems, of which a 'union' filesystem is one.\n            file.type = FileInfo_1.FileType.Unknown;\n    }\n    // Separate out the link name for symbolic links\n    if (file.isSymbolicLink) {\n        const end = name.indexOf(\" -> \");\n        if (end !== -1) {\n            file.name = name.substring(0, end);\n            file.link = name.substring(end + 4);\n        }\n    }\n    return file;\n}\nfunction transformList(files) {\n    return files;\n}\nfunction parseMode(r, w, x) {\n    let value = 0;\n    if (r !== \"-\") {\n        value += FileInfo_1.FileInfo.UnixPermission.Read;\n    }\n    if (w !== \"-\") {\n        value += FileInfo_1.FileInfo.UnixPermission.Write;\n    }\n    const execToken = x.charAt(0);\n    if (execToken !== \"-\" && execToken.toUpperCase() !== execToken) {\n        value += FileInfo_1.FileInfo.UnixPermission.Execute;\n    }\n    return value;\n}\n");
__memMods.set("basic-ftp/dist/ProgressTracker.js", "\"use strict\";\nObject.defineProperty(exports, \"__esModule\", { value: true });\nexports.ProgressTracker = void 0;\n/**\n * Tracks progress of one socket data transfer at a time.\n */\nclass ProgressTracker {\n    constructor() {\n        this.bytesOverall = 0;\n        this.intervalMs = 500;\n        this.onStop = noop;\n        this.onHandle = noop;\n    }\n    /**\n     * Register a new handler for progress info. Use `undefined` to disable reporting.\n     */\n    reportTo(onHandle = noop) {\n        this.onHandle = onHandle;\n    }\n    /**\n     * Start tracking transfer progress of a socket.\n     *\n     * @param socket  The socket to observe.\n     * @param name  A name associated with this progress tracking, e.g. a filename.\n     * @param type  The type of the transfer, typically \"upload\" or \"download\".\n     */\n    start(socket, name, type) {\n        let lastBytes = 0;\n        this.onStop = poll(this.intervalMs, () => {\n            const bytes = socket.bytesRead + socket.bytesWritten;\n            this.bytesOverall += bytes - lastBytes;\n            lastBytes = bytes;\n            this.onHandle({\n                name,\n                type,\n                bytes,\n                bytesOverall: this.bytesOverall\n            });\n        });\n    }\n    /**\n     * Stop tracking transfer progress.\n     */\n    stop() {\n        this.onStop(false);\n    }\n    /**\n     * Call the progress handler one more time, then stop tracking.\n     */\n    updateAndStop() {\n        this.onStop(true);\n    }\n}\nexports.ProgressTracker = ProgressTracker;\n/**\n * Starts calling a callback function at a regular interval. The first call will go out\n * immediately. The function returns a function to stop the polling.\n */\nfunction poll(intervalMs, updateFunc) {\n    const id = setInterval(updateFunc, intervalMs);\n    const stopFunc = (stopWithUpdate) => {\n        clearInterval(id);\n        if (stopWithUpdate) {\n            updateFunc();\n        }\n        // Prevent repeated calls to stop calling handler.\n        updateFunc = noop;\n    };\n    updateFunc();\n    return stopFunc;\n}\nfunction noop() { }\n");
__memMods.set("basic-ftp/dist/StringEncoding.js", "\"use strict\";\nObject.defineProperty(exports, \"__esModule\", { value: true });\n");
__memMods.set("basic-ftp/dist/StringWriter.js", "\"use strict\";\nObject.defineProperty(exports, \"__esModule\", { value: true });\nexports.StringWriter = void 0;\nconst stream_1 = require(\"stream\");\nclass StringWriter extends stream_1.Writable {\n    constructor(maxByteLength = 1 * 1024 * 1024) {\n        super();\n        this.maxByteLength = maxByteLength;\n        this.byteLength = 0;\n        this.bufs = [];\n    }\n    _write(chunk, _, callback) {\n        if (!(chunk instanceof Buffer)) {\n            callback(new Error(\"StringWriter: expects chunks of type 'Buffer'.\"));\n            return;\n        }\n        if (this.byteLength + chunk.byteLength > this.maxByteLength) {\n            callback(new Error(`StringWriter: Maximum bytes exceeded, maxByteLength=${this.maxByteLength}.`));\n            return;\n        }\n        this.byteLength += chunk.byteLength;\n        this.bufs.push(chunk);\n        callback(null);\n    }\n    getText(encoding) {\n        return Buffer.concat(this.bufs).toString(encoding);\n    }\n}\nexports.StringWriter = StringWriter;\n");
__memMods.set("basic-ftp/dist/transfer.js", "\"use strict\";\nObject.defineProperty(exports, \"__esModule\", { value: true });\nexports.enterPassiveModeIPv6 = enterPassiveModeIPv6;\nexports.parseEpsvResponse = parseEpsvResponse;\nexports.enterPassiveModeIPv4 = enterPassiveModeIPv4;\nexports.enterPassiveModeIPv4_forceControlHostIP = enterPassiveModeIPv4_forceControlHostIP;\nexports.parsePasvResponse = parsePasvResponse;\nexports.connectForPassiveTransfer = connectForPassiveTransfer;\nexports.uploadFrom = uploadFrom;\nexports.downloadTo = downloadTo;\nconst stream_1 = require(\"stream\");\nconst tls_1 = require(\"tls\");\nconst TransferWatchdog_1 = require(\"./TransferWatchdog\");\nconst netUtils_1 = require(\"./netUtils\");\nconst parseControlResponse_1 = require(\"./parseControlResponse\");\n/**\n * Prepare a data socket using passive mode over IPv6.\n */\nasync function enterPassiveModeIPv6(ftp) {\n    const res = await ftp.request(\"EPSV\");\n    const port = parseEpsvResponse(res.message);\n    if (!port) {\n        throw new Error(\"Can't parse EPSV response: \" + res.message);\n    }\n    const controlHost = ftp.socket.remoteAddress;\n    if (controlHost === undefined) {\n        throw new Error(\"Control socket is disconnected, can't get remote address.\");\n    }\n    await connectForPassiveTransfer(controlHost, port, ftp);\n    return res;\n}\n/**\n * Parse an EPSV response. Returns only the port as in EPSV the host of the control connection is used.\n */\nfunction parseEpsvResponse(message) {\n    // Get port from EPSV response, e.g. \"229 Entering Extended Passive Mode (|||6446|)\"\n    // Some FTP Servers such as the one on IBM i (OS/400) use ! instead of | in their EPSV response.\n    const groups = message.match(/[|!]{3}(.+)[|!]/);\n    if (groups === null || groups[1] === undefined) {\n        throw new Error(`Can't parse response to 'EPSV': ${message}`);\n    }\n    const port = parseInt(groups[1], 10);\n    if (Number.isNaN(port)) {\n        throw new Error(`Can't parse response to 'EPSV', port is not a number: ${message}`);\n    }\n    return port;\n}\n/**\n * Prepare a data socket using passive mode over IPv4.\n */\nasync function enterPassiveModeIPv4(ftp) {\n    const res = await ftp.request(\"PASV\");\n    const target = parsePasvResponse(res.message);\n    if (!target) {\n        throw new Error(\"Can't parse PASV response: \" + res.message);\n    }\n    // If the host in the PASV response has a local address while the control connection hasn't,\n    // we assume a NAT issue and use the IP of the control connection as the target for the data connection.\n    // We can't always perform this replacement because it's possible (although unlikely) that the FTP server\n    // indeed uses a different host for data connections.\n    const controlHost = ftp.socket.remoteAddress;\n    if ((0, netUtils_1.ipIsPrivateV4Address)(target.host) && controlHost && !(0, netUtils_1.ipIsPrivateV4Address)(controlHost)) {\n        target.host = controlHost;\n    }\n    await connectForPassiveTransfer(target.host, target.port, ftp);\n    return res;\n}\n/**\n * Prepare a data socket using passive mode over IPv4.\n *\n * Will throw an error if the IP provided by the PASV response doesn't match the one of the control connection.\n * The error will contain detailed information. This is done to provide more security by preventing FTP bounce\n * attacks.\n */\nasync function enterPassiveModeIPv4_forceControlHostIP(ftp) {\n    const res = await ftp.request(\"PASV\");\n    const target = parsePasvResponse(res.message);\n    if (!target) {\n        throw new Error(\"Can't parse PASV response: \" + res.message);\n    }\n    const controlHost = ftp.socket.remoteAddress;\n    if (controlHost === undefined) {\n        throw new Error(\"Control socket is disconnected, can't get remote address.\");\n    }\n    // Strip IPv4-mapped IPv6 prefix (e.g. \"::ffff:1.2.3.4\" → \"1.2.3.4\") so the\n    // comparison works regardless of whether the OS uses a dual-stack socket.\n    const normalizedControlHost = controlHost.replace(/^::ffff:/i, \"\");\n    const hostsAreCompatible = normalizedControlHost === target.host\n        || ((0, netUtils_1.isLoopback)(normalizedControlHost) && (0, netUtils_1.isLoopback)(target.host));\n    if (!hostsAreCompatible) {\n        throw new Error(`PASV returned another host (${target.host}) for data transfer that you have connected to (${controlHost}). Even though the FTP protocol allows this, basic-ftp disables this feature by default for security reasons. If you do need this feature, instantiate the Client with the optional paramter \"allowSeparateTransferHost: true\". See the README documentation for more information.`);\n    }\n    await connectForPassiveTransfer(normalizedControlHost, target.port, ftp);\n    return res;\n}\n/**\n * Parse a PASV response.\n */\nfunction parsePasvResponse(message) {\n    // Get host and port from PASV response, e.g. \"227 Entering Passive Mode (192,168,1,100,10,229)\"\n    const groups = message.match(/([-\\d]+,[-\\d]+,[-\\d]+,[-\\d]+),([-\\d]+),([-\\d]+)/);\n    if (groups === null || groups.length !== 4) {\n        throw new Error(`Can't parse response to 'PASV': ${message}`);\n    }\n    return {\n        host: groups[1].replace(/,/g, \".\"),\n        port: (parseInt(groups[2], 10) & 255) * 256 + (parseInt(groups[3], 10) & 255)\n    };\n}\nfunction connectForPassiveTransfer(host, port, ftp) {\n    return new Promise((resolve, reject) => {\n        const rawSocket = ftp._newSocket();\n        let socket = rawSocket;\n        const handleConnErr = function (err) {\n            err.message = \"Can't open data connection in passive mode: \" + err.message;\n            reject(err);\n        };\n        const handleTimeout = function () {\n            socket.destroy();\n            reject(new Error(`Timeout when trying to open data connection to ${host}:${port}`));\n        };\n        socket.setTimeout(ftp.timeout);\n        socket.on(\"error\", handleConnErr);\n        socket.on(\"timeout\", handleTimeout);\n        socket.connect({ port, host, family: ftp.ipFamily }, () => {\n            var _a;\n            if (ftp.socket instanceof tls_1.TLSSocket) {\n                const tlsSocket = (0, tls_1.connect)(Object.assign({}, ftp.tlsOptions, {\n                    socket: rawSocket,\n                    // Reuse the TLS session negotiated earlier when the control connection\n                    // was upgraded. Servers expect this because it provides additional\n                    // security: If a completely new session would be negotiated, a hacker\n                    // could guess the port and connect to the new data connection before we do\n                    // by just starting his/her own TLS session.\n                    session: (_a = ftp.tlsSessionStore) !== null && _a !== void 0 ? _a : ftp.socket.getSession()\n                }));\n                // When the server issues a new session ticket after this data connection's\n                // TLS handshake (TLS 1.3 single-use tickets), capture it so the next data\n                // connection can present a fresh ticket and resume successfully.\n                tlsSocket.on(\"session\", session => { ftp.tlsSessionStore = session; });\n                socket = tlsSocket;\n                // It's the responsibility of the transfer task to wait until the\n                // TLS socket issued the event 'secureConnect'. We can't do this\n                // here because some servers will start upgrading after the\n                // specific transfer request has been made. List and download don't\n                // have to wait for this event because the server sends whenever it\n                // is ready. But for upload this has to be taken into account,\n                // see the details in the upload() function below.\n            }\n            // Disable the timeout that was guarding the connection attempt. This has to happen on\n            // the socket it was set on: when using TLS, `socket` is by now a wrapper around that\n            // socket, and a timeout left running underneath would destroy the data connection\n            // during a transfer that is idle for a legitimate reason.\n            rawSocket.setTimeout(0);\n            // Let the FTPContext listen to errors from now on, remove local handler.\n            socket.removeListener(\"error\", handleConnErr);\n            socket.removeListener(\"timeout\", handleTimeout);\n            ftp.dataSocket = socket;\n            resolve();\n        });\n    });\n}\n/**\n * Helps resolving/rejecting transfers.\n *\n * This is used internally for all FTP transfers. For example when downloading, the server might confirm\n * with \"226 Transfer complete\" when in fact the download on the data connection has not finished\n * yet. With all transfers we make sure that a) the result arrived and b) has been confirmed by\n * e.g. the control connection. We just don't know in which order this will happen.\n */\nclass TransferResolver {\n    /**\n     * Instantiate a TransferResolver\n     */\n    constructor(ftp, progress) {\n        this.ftp = ftp;\n        this.progress = progress;\n        this.response = undefined;\n        this.dataTransferDone = false;\n        this.taskSettled = false;\n        this.watchdog = new TransferWatchdog_1.TransferWatchdog();\n    }\n    /**\n     * Mark the beginning of a transfer.\n     *\n     * @param name - Name of the transfer, usually the filename.\n     * @param type - Type of transfer, usually \"upload\" or \"download\".\n     */\n    onDataStart(name, type) {\n        // Let the data connection be in charge of tracking timeouts during transfer.\n        // The control socket sits idle during this time anyway and might provoke\n        // a timeout unnecessarily. The control connection will take care\n        // of timeouts again once data transfer is complete or failed.\n        if (this.ftp.dataSocket === undefined) {\n            throw new Error(\"Data transfer should start but there is no data connection.\");\n        }\n        this.ftp.socket.setTimeout(0);\n        // An inactivity timeout on the data socket would also fire while a slow local source or\n        // destination is holding up an otherwise healthy transfer. Watch the transfer instead.\n        this.ftp.dataSocket.setTimeout(0);\n        this.watchdog.start(this.ftp.dataSocket, type === \"upload\" ? \"upload\" : \"download\", this.ftp.timeout, () => {\n            this.ftp.closeWithError(new Error(\"Timeout (data socket)\"));\n        });\n        this.progress.start(this.ftp.dataSocket, name, type);\n    }\n    /**\n     * The data connection has finished the transfer.\n     */\n    onDataDone(task) {\n        if (this.taskSettled) {\n            return;\n        }\n        this.watchdog.stop();\n        this.progress.updateAndStop();\n        // Hand-over timeout tracking back to the control connection. It's possible that\n        // we don't receive the response over the control connection that the transfer is\n        // done. In this case, we want to correctly associate the resulting timeout with\n        // the control connection.\n        this.ftp.socket.setTimeout(this.ftp.timeout);\n        this.dataTransferDone = true;\n        this.tryResolve(task);\n    }\n    /**\n     * The control connection reports the transfer as finished.\n     */\n    onControlDone(task, response) {\n        this.response = response;\n        this.tryResolve(task);\n    }\n    /**\n     * An error has been reported and the task should be rejected.\n     */\n    onError(task, err) {\n        // A transfer can report a problem more than once, e.g. when the server sends an error\n        // response and the stream of the data connection reports the resulting shutdown as an\n        // error as well. Only the first one decides the outcome, acting on a later one would\n        // interfere with whatever the client is doing by then.\n        if (this.taskSettled) {\n            return;\n        }\n        this.taskSettled = true;\n        this.watchdog.stop();\n        this.progress.updateAndStop();\n        this.ftp.socket.setTimeout(this.ftp.timeout);\n        this.ftp.dataSocket = undefined;\n        task.reject(err);\n    }\n    /**\n     * Control connection sent an unexpected request requiring a response from our part. We\n     * can't provide that (because unknown) and have to close the contrext with an error because\n     * the FTP server is now caught up in a state we can't resolve.\n     */\n    onUnexpectedRequest(response) {\n        const err = new Error(`Unexpected FTP response is requesting an answer: ${response.message}`);\n        this.ftp.closeWithError(err);\n    }\n    tryResolve(task) {\n        // To resolve, we need both control and data connection to report that the transfer is done.\n        const canResolve = this.dataTransferDone && this.response !== undefined;\n        if (canResolve) {\n            this.taskSettled = true;\n            this.ftp.dataSocket = undefined;\n            task.resolve(this.response);\n        }\n    }\n}\nfunction uploadFrom(source, config) {\n    const resolver = new TransferResolver(config.ftp, config.tracker);\n    const fullCommand = `${config.command} ${config.remotePath}`;\n    // This handler runs for every reply that arrives while the task is active. RFC 959 lists\n    // \"125\" and \"150\" as alternatives, so a well-behaved server sends exactly one of them, but\n    // nothing here enforces that. Let only the first one start the transfer: piping the source\n    // into the data connection a second time writes parts of it twice and would silently\n    // corrupt the remote file.\n    let transferStarted = false;\n    return config.ftp.handle(fullCommand, (res, task) => {\n        if (res instanceof Error) {\n            resolver.onError(task, res);\n        }\n        else if (res.code === 150 || res.code === 125) { // Ready to upload\n            if (transferStarted) {\n                return;\n            }\n            transferStarted = true;\n            const dataSocket = config.ftp.dataSocket;\n            if (!dataSocket) {\n                resolver.onError(task, new Error(\"Upload should begin but no data connection is available.\"));\n                return;\n            }\n            // If we are using TLS, we have to wait until the dataSocket issued\n            // 'secureConnect'. If this hasn't happened yet, getCipher() returns undefined.\n            const canUpload = \"getCipher\" in dataSocket ? dataSocket.getCipher() !== undefined : true;\n            onConditionOrEvent(canUpload, dataSocket, \"secureConnect\", () => {\n                config.ftp.log(`Uploading to ${(0, netUtils_1.describeAddress)(dataSocket)} (${(0, netUtils_1.describeTLS)(dataSocket)})`);\n                resolver.onDataStart(config.remotePath, config.type);\n                (0, stream_1.pipeline)(source, dataSocket, err => {\n                    if (err) {\n                        resolver.onError(task, err);\n                    }\n                    else {\n                        resolver.onDataDone(task);\n                    }\n                });\n            });\n        }\n        else if ((0, parseControlResponse_1.positiveCompletion)(res.code)) { // Transfer complete\n            resolver.onControlDone(task, res);\n        }\n        else if ((0, parseControlResponse_1.positiveIntermediate)(res.code)) {\n            resolver.onUnexpectedRequest(res);\n        }\n        // Ignore all other positive preliminary response codes (< 200)\n    });\n}\nfunction downloadTo(destination, config) {\n    if (!config.ftp.dataSocket) {\n        throw new Error(\"Download will be initiated but no data connection is available.\");\n    }\n    const resolver = new TransferResolver(config.ftp, config.tracker);\n    // See the comment in uploadFrom(): only the first preliminary reply may start the transfer.\n    let transferStarted = false;\n    return config.ftp.handle(config.command, (res, task) => {\n        if (res instanceof Error) {\n            resolver.onError(task, res);\n        }\n        else if (res.code === 150 || res.code === 125) { // Ready to download\n            if (transferStarted) {\n                return;\n            }\n            transferStarted = true;\n            const dataSocket = config.ftp.dataSocket;\n            if (!dataSocket) {\n                resolver.onError(task, new Error(\"Download should begin but no data connection is available.\"));\n                return;\n            }\n            config.ftp.log(`Downloading from ${(0, netUtils_1.describeAddress)(dataSocket)} (${(0, netUtils_1.describeTLS)(dataSocket)})`);\n            resolver.onDataStart(config.remotePath, config.type);\n            // Keep piping the data connection: TransferWatchdog recognizes a destination that\n            // can't keep up by the socket being paused, and only piping does that. Consuming the\n            // socket in another way, e.g. by iterating over it, makes the watchdog report a\n            // transfer as stalled while it's in fact waiting for us.\n            (0, stream_1.pipeline)(dataSocket, destination, err => {\n                if (err) {\n                    resolver.onError(task, err);\n                }\n                else {\n                    resolver.onDataDone(task);\n                }\n            });\n        }\n        else if (res.code === 350) { // Restarting at startAt.\n            config.ftp.send(\"RETR \" + config.remotePath);\n        }\n        else if ((0, parseControlResponse_1.positiveCompletion)(res.code)) { // Transfer complete\n            resolver.onControlDone(task, res);\n        }\n        else if ((0, parseControlResponse_1.positiveIntermediate)(res.code)) {\n            resolver.onUnexpectedRequest(res);\n        }\n        // Ignore all other positive preliminary response codes (< 200)\n    });\n}\n/**\n * Calls a function immediately if a condition is met or subscribes to an event and calls\n * it once the event is emitted.\n *\n * @param condition  The condition to test.\n * @param emitter  The emitter to use if the condition is not met.\n * @param eventName  The event to subscribe to if the condition is not met.\n * @param action  The function to call.\n */\nfunction onConditionOrEvent(condition, emitter, eventName, action) {\n    if (condition === true) {\n        action();\n    }\n    else {\n        emitter.once(eventName, () => action());\n    }\n}\n");
__memMods.set("basic-ftp/dist/TransferWatchdog.js", "\"use strict\";\nObject.defineProperty(exports, \"__esModule\", { value: true });\nexports.TransferWatchdog = void 0;\n/** How long to wait between two checks of a transfer at most, in milliseconds. */\nconst maxCheckIntervalMs = 500;\n/**\n * How many checks a timeout is split into, at least. A transfer is only reported as stalled if\n * every single one of them found the connection idle. Deciding on a single check would make brief\n * moments where a transfer looks idle without being stalled matter, for example just after a\n * destination signalled that it can accept data again but before the first bytes arrived.\n *\n * Splitting into n checks means such a moment has to last about (n-1)/n of the timeout to be\n * mistaken for a stall, so the value matters much less than it being greater than one. It only\n * has an effect on timeouts below `minChecksPerTimeout * maxCheckIntervalMs` anyway, longer ones\n * are split into more checks by the interval limit alone.\n */\nconst minChecksPerTimeout = 4;\n/**\n * Watches a data connection during a transfer and reports it as stalled if the server stopped\n * making progress.\n *\n * This replaces a plain inactivity timeout on the data socket. Such a timeout can't tell apart\n * \"the server stopped sending\" from \"our own source or destination isn't ready yet\". A slow local\n * stream is not an error: A download piped into a decompressor, or an upload fed by a stream that\n * computes its data, can legitimately leave the connection idle for minutes. Timing out on that\n * kills a healthy transfer and truncates the data the destination already received.\n *\n * Only time spent waiting for the server counts towards the timeout, see `isWaitingForServer`.\n */\nclass TransferWatchdog {\n    constructor() {\n        this.timer = undefined;\n    }\n    /**\n     * Start watching a transfer. Calls `onStall` if the server hasn't made progress for\n     * `timeout` milliseconds. A timeout of 0 disables the watchdog.\n     */\n    start(socket, direction, timeout, onStall) {\n        this.stop();\n        if (timeout <= 0) {\n            return;\n        }\n        const intervalMs = Math.max(1, Math.min(Math.floor(timeout / minChecksPerTimeout), maxCheckIntervalMs));\n        let lastBytes = countBytes(socket);\n        let idleMs = 0;\n        this.timer = setInterval(() => {\n            const bytes = countBytes(socket);\n            const madeProgress = bytes !== lastBytes;\n            lastBytes = bytes;\n            if (madeProgress || !isWaitingForServer(socket, direction)) {\n                idleMs = 0;\n                return;\n            }\n            // Count checks instead of measuring elapsed time: a blocked event loop delays our\n            // checks just as much as it delays reading from the socket, and that's not something\n            // the server should be blamed for.\n            idleMs += intervalMs;\n            if (idleMs >= timeout) {\n                this.stop();\n                onStall();\n            }\n        }, intervalMs);\n        // Don't keep the process alive just to watch a transfer.\n        this.timer.unref();\n    }\n    /**\n     * Stop watching. Safe to call at any time, also if no transfer is being watched.\n     */\n    stop() {\n        if (this.timer) {\n            clearInterval(this.timer);\n            this.timer = undefined;\n        }\n    }\n}\nexports.TransferWatchdog = TransferWatchdog;\nfunction countBytes(socket) {\n    return socket.bytesRead + socket.bytesWritten;\n}\n/**\n * Returns true if the transfer can only continue once the server acts. When downloading, that's\n * the case as long as we're ready to receive: if the socket is paused, our destination applied\n * backpressure and the server may well be waiting for us. When uploading, it's the case if we\n * still have data queued that the server isn't accepting: an empty queue means we're waiting for\n * our own source instead.\n *\n * `isPaused()` only reports backpressure for a socket that is being piped, which is what\n * `downloadTo` in transfer.ts does. Should that ever change to reading the socket directly, e.g.\n * by iterating over it, this would report a transfer as stalled while it's waiting for us.\n */\nfunction isWaitingForServer(socket, direction) {\n    return direction === \"download\" ? !socket.isPaused() : socket.writableLength > 0;\n}\n");
__memMods.set("basic-ftp/package.json", "{\n  \"name\": \"basic-ftp\",\n  \"version\": \"6.2.0\",\n  \"description\": \"FTP client for Node.js, supports FTPS over TLS, IPv6, Async/Await, and Typescript.\",\n  \"main\": \"dist/index\",\n  \"types\": \"dist/index\",\n  \"files\": [\n    \"dist/**/*\"\n  ],\n  \"scripts\": {\n    \"prepublishOnly\": \"npm run clean && npm run lint && tsc && node --test test/*Spec.js\",\n    \"prepare\": \"tsc\",\n    \"test\": \"npm run prepublishOnly\",\n    \"clean\": \"rm -rf dist\",\n    \"lint\": \"eslint \\\"./src/**/*.ts\\\"\",\n    \"lint-fix\": \"eslint --fix \\\"./src/**/*.ts\\\"\",\n    \"dev\": \"npm run clean && tsc --watch\",\n    \"tdd\": \"node --test --watch test/*Spec.js\",\n    \"buildOnly\": \"tsc\",\n    \"test:integration\": \"npm run buildOnly && node --test test/integration/*Spec.js\"\n  },\n  \"repository\": {\n    \"type\": \"git\",\n    \"url\": \"https://github.com/patrickjuchli/basic-ftp.git\"\n  },\n  \"author\": \"Patrick Juchli <patrickjuchli@gmail.com>\",\n  \"license\": \"MIT\",\n  \"keywords\": [\n    \"ftp\",\n    \"ftps\",\n    \"promise\",\n    \"async\",\n    \"await\",\n    \"tls\",\n    \"ipv6\",\n    \"typescript\"\n  ],\n  \"engines\": {\n    \"node\": \">=10.0.0\"\n  },\n  \"devDependencies\": {\n    \"@eslint/eslintrc\": \"3.3.6\",\n    \"@eslint/js\": \"10.0.1\",\n    \"@types/node\": \"26.1.1\",\n    \"@typescript-eslint/eslint-plugin\": \"8.65.0\",\n    \"@typescript-eslint/parser\": \"8.65.0\",\n    \"eslint\": \"10.8.0\",\n    \"testcontainers\": \"12.0.4\",\n    \"typescript\": \"6.0.3\"\n  }\n}\n");

eval("\nglobal.__iconvLite = (() => {\n  const __cache = {};\n  function __load(abs, rawId) {\n    if (__cache[abs]) return __cache[abs].exports;\n    if (!__memMods.has(abs)) {\n      try { return require(rawId); } catch (e2) { throw new Error('模块未注册: ' + abs); }\n    }\n    const code = __memMods.get(abs);\n    const m = { exports: {} };\n    __cache[abs] = m;\n    if (abs.endsWith('.json')) {\n      m.exports = JSON.parse(code);\n    } else {\n      const wrapped = '(function(require,module,exports,__dirname,__filename){' + code + '\\n})';\n      const fn = eval(wrapped);\n      const parentAbs = abs;\n      fn((r) => {\n        let rabs = r;\n        if (r === 'iconv-lite') rabs = 'iconv-lite/lib/index.js';\n        else if (r === 'safer-buffer') rabs = 'safer-buffer/safer.js';\n        else if (r === 'basic-ftp') rabs = 'basic-ftp/dist/index.js';\n        if (r.startsWith('.')) {\n          const base = __path.posix.dirname(parentAbs);\n          rabs = __path.posix.normalize(__path.posix.join(base, r));\n          if (!__memMods.has(rabs)) {\n            if (__memMods.has(rabs + '.js')) rabs = rabs + '.js';\n            else if (__memMods.has(rabs + '/index.js')) rabs = rabs + '/index.js';\n          }\n        }\n        return __load(rabs, r);\n      }, m, m.exports, __path.posix.dirname(abs), abs);\n    }\n    return m.exports;\n  }\n  return __load('iconv-lite/lib/index.js', 'iconv-lite/lib/index.js');\n})();\n\n\nglobal.__basicFtp = (() => {\n  const __c2 = {};\n  function __l2(abs, rawId) {\n    if (__c2[abs]) return __c2[abs].exports;\n    if (!__memMods.has(abs)) { try { return require(rawId); } catch (e2) { throw new Error('模块未注册: ' + abs); } }\n    const code = __memMods.get(abs);\n    const m = { exports: {} };\n    __c2[abs] = m;\n    if (abs.endsWith('.json')) { m.exports = JSON.parse(code); }\n    else {\n      const wrapped = '(function(require,module,exports,__dirname,__filename){' + code + '\\n})';\n      const fn = eval(wrapped);\n      const parentAbs = abs;\n      fn((r) => {\n        let rabs = r;\n        if (r === 'basic-ftp') rabs = 'basic-ftp/dist/index.js';\n        if (r.startsWith('.')) {\n          const base = __path.posix.dirname(parentAbs);\n          rabs = __path.posix.normalize(__path.posix.join(base, r));\n          if (!__memMods.has(rabs)) {\n            if (__memMods.has(rabs + '.js')) rabs = rabs + '.js';\n            else if (__memMods.has(rabs + '/index.js')) rabs = rabs + '/index.js';\n          }\n        }\n        return __l2(rabs, r);\n      }, m, m.exports, __path.posix.dirname(abs), abs);\n    }\n    return m.exports;\n  }\n  return __l2('basic-ftp/dist/index.js', 'basic-ftp/dist/index.js');\n})();\n\n");
// 爆率工具核心逻辑 v3 — 真实传奇 MonItems 格式 + GBK 编码
// 传奇服务端刷怪/爆率/货币工具核心库
//   真实格式（血僵尸.txt 验证）：
//     "1/1<TAB>金币 1000"                普通爆率（概率在前，Tab/空格分隔，可带数量）
//     "#CHILD 1/22 RANDOM [U3=0]"       随机子项头（RANDOM 标记 + 可选条件）
//     "(" / ")"                          子项块边界
//     "1/1<TAB>道士头盔"                 子项行（块内）
//     "5/10<TAB>金创药"                  比例爆率
//   编码：GBK（传奇引擎默认），还原自 iconv-lite 在依赖中的存在
const fs = require('fs');
const path = require('path');
let iconv = null;
try { iconv = global.__iconvLite || require('iconv-lite'); } catch (e) { /* CLI SEA 内联版在 bundle 里注入 */ }

const MONITEMS_REL = path.join('Mir200', 'Envir', 'MonItems'); // 还原自常量池 "Mir200\Envir\MonItems"
const MAX_RATE = 90000000; // 还原自 LdaSmi 90000000

// ---- 解析（还原自 SFI13237/13425 正则）----
const RE_RATE = /^(\d+)\s*\/\s*(\d+)[\t ]+(.+)$/;          // "1/1\t金币 1000"
const RE_CHILD = /^#CHILD\s+(\d+)\s*\/\s*(\d+)(?:\s+([A-Za-z0-9_]+))?(?:\s+(\[.*\]))?(?:\s+(.+))?$/i; // "#CHILD 1/22 RANDOM [U3=0]"
const RE_RATIO = /^(\d+)\s*\/\s*(\d+)$/;                    // 纯比例 "5/10"
const RE_PURE_RATIO = /^(\d+)\s*\/\s*(\d+)$/;               // 比例校验（SFI13229）

function parseLine(line) {
  const t = line.trim();
  if (!t) return { kind: 'blank', raw: line };
  if (t === '(' || t === ')') return { kind: 'paren', raw: line };
  let m = RE_CHILD.exec(t);
  if (m) return { kind: 'child', num: +m[1], rate: +m[2], flag: m[3], cond: m[4], item: m[5] ? m[5].trim() : undefined, raw: line };
  m = RE_RATE.exec(t);
  if (m) {
    const rest = m[3].trim();
    const parts = rest.split(/[\t ]+/);
    const count = parts.length > 1 ? +parts[1] : 1;
    return { kind: 'rate', item: parts[0], num: +m[1], rate: +m[2], count: isNaN(count) ? 1 : count, raw: line };
  }
  m = RE_RATIO.exec(t);
  if (m) return { kind: 'ratio', num: +m[1], rate: +m[2], raw: line };
  return { kind: 'unknown', item: t, raw: line };
}

function parseFile(content) {
  return String(content || '')
    .split(/\r\n|\r|\n/)
    .map(parseLine);
}

// ---- 序列化（还原自 SFI13303：保留原格式）----
function serializeLine(item) {
  switch (item.kind) {
    case 'paren': return item.raw.trim() === '(' ? '(' : ')';
    case 'child': {
      let s = '#CHILD ' + (item.num != null ? item.num : 1) + '/' + item.rate;
      if (item.flag) s += ' ' + item.flag;
      if (item.cond) s += ' ' + item.cond;
      if (item.item) s += ' ' + item.item;
      return s;
    }
    case 'rate': {
      const cnt = item.count && item.count > 1 ? ' ' + item.count : '';
      return (item.num != null ? item.num : 1) + '/' + item.rate + '\t' + item.item + cnt;
    }
    case 'ratio': return (item.num != null ? item.num : 1) + '/' + item.rate;
    case 'blank': return '';
    default: return item.raw;
  }
}

function serializeFile(items) {
  return items.map(x => (typeof x === 'string' ? x : serializeLine(x))).join('\r\n');
}

// ---- 文件操作（GBK 编码，还原自 iconv-lite 依赖）----
// 智能定位 MonItems：支持 服务端根(含Mir200) / Mir200 / Envir 三种层级
function monItemsDir(engineRoot) {
  // 还原自虾米：支持 MonItems / MonItemsEx / MonItems_def / MonDrop 多爆率目录
  const cands = [
    path.join(engineRoot, MONITEMS_REL),      // 服务端根\Mir200\Envir\MonItems（标准）
    path.join(engineRoot, 'Mir200', 'Envir', 'MonItemsEx'),
    path.join(engineRoot, 'Mir200', 'Envir', 'MonItems_def'),
    path.join(engineRoot, 'Mir200', 'Envir', 'MonDrop'),
    path.join(engineRoot, 'Envir', 'MonItems'), // 已选到 Mir200
    path.join(engineRoot, 'MonItems'),          // 已选到 Envir
  ];
  for (const c of cands) { try { if (fs.existsSync(c) && fs.statSync(c).isDirectory()) return c; } catch (e) { /* 忽略 */ } }
  return path.join(engineRoot, MONITEMS_REL);
}

// 智能定位 MonGen.txt（同样支持三层级）
function monGenFile(engineRoot) {
  const cands = [
    path.join(engineRoot, 'Mir200', 'Envir', 'MonGen.txt'),
    path.join(engineRoot, 'Envir', 'MonGen.txt'),
    path.join(engineRoot, 'MonGen.txt'),
  ];
  for (const c of cands) {
    try { if (fs.existsSync(c)) return c; } catch (e) { /* 忽略 */ }
  }
  return cands[0];
}

function monFile(engineRoot, monName) {
  return path.join(monItemsDir(engineRoot), monName.toLowerCase() + '.txt'); // 还原自 toLowerCase
}

// 多编码检测（还原自虾米 _read_lines_best_effort：gb18030/utf-8-sig/gbk/big5）
function detectEncoding(buf) {
  if (!buf || !buf.length) return 'gbk';
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) return 'utf8'; // UTF-8 BOM
  if (buf[0] === 0xFF && buf[1] === 0xFE) return 'utf16le';
  if (buf[0] === 0xFE && buf[1] === 0xFF) return 'utf16be';
  try { if (Buffer.from(buf.toString('utf8'), 'utf8').equals(buf)) return 'utf8'; } catch (e) { /* 忽略 */ }
  return 'gb18030'; // GBK 超集
}
function decodeBuf(buf) {
  if (iconv) {
    try { return iconv.decode(buf, detectEncoding(buf)); }
    catch (e) { return iconv.decode(buf, 'gbk'); }
  }
  return buf.toString('utf8');
}
function encodeStr(str, enc) {
  if (iconv) return iconv.encode(str, enc || 'gbk');
  return Buffer.from(str, 'utf8');
}
// 统一文本写助手（还原自虾米 _drop_encode_text：保留原文件编码与 UTF-8 BOM，UTF-8 端不写坏；新文件默认 GBK）
function writeTextFile(f, str, enc) {
  let e = enc || 'gbk';
  let bom = false;
  try {
    if (fs.existsSync(f)) {
      const buf = fs.readFileSync(f);
      e = detectEncoding(buf);
      bom = buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
    }
  } catch (err) { /* 新文件默认 gbk */ }
  let out = encodeStr(str, e);
  if (bom && !(out[0] === 0xEF && out[1] === 0xBB && out[2] === 0xBF)) out = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), out]);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, out);
}

function readMonFile(engineRoot, monName) {
  const f = monFile(engineRoot, monName);
  if (!fs.existsSync(f)) return { file: f, exists: false, items: [] };
  return { file: f, exists: true, items: parseFile(decodeBuf(fs.readFileSync(f))) };
}

function writeMonFile(engineRoot, monName, items) {
  const f = monFile(engineRoot, monName);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  writeTextFile(f, serializeFile(items));
  return f;
}

// 全部怪物文件列表（全服）
function listMonFiles(engineRoot) {
  const dir = monItemsDir(engineRoot);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.toLowerCase().endsWith('.txt'))
    .filter(f => !f.toLowerCase().startsWith('@backup') && !f.toLowerCase().includes('.backup'))
    .map(f => f.replace(/\.txt$/i, ''));
}

// ============ 虾米融合：物品名规范化 + den 换算 + 整体优化 + 自动备份/还原 ============
// 物品名规范化（还原自虾米 _normalize_item_name：去 BOM/全角空格/NBSP/制表符/注释/RANDOM 后缀）
function normalizeItemName(name) {
  let v = String(name || '');
  v = v.replace(/^\ufeff/, '').replace(/[\u3000\u00A0\t]+/g, ' ').trim();
  const ci = v.indexOf('//');
  if (ci >= 0) v = v.slice(0, ci).trim();
  v = v.replace(/\s+random.*$/i, '').trim();
  return v;
}
// den（概率分母 1/x）<-> rate（百分比）换算
function denFromRate(rate) { const r = +rate || 0; return r >= 100 ? 1 : r <= 0 ? 0 : Math.max(1, Math.round(100 / r)); }
function rateFromDen(den) { const d = +den || 0; return d <= 0 ? 0 : d === 1 ? 100 : d >= 100 ? 1 : Math.max(1, Math.round(100 / d)); }
// 运算（还原自虾米 _apply_op：加/减/乘/除/设；下限 1、den<=0→1、除 0 报错）
function applyOp(den, op, val) {
  let d = Math.round(+den || 0);
  if (d <= 0) d = 1;
  const v = +val || 0;
  let res;
  switch (op) {
    case 'add': res = d + v; break;
    case 'sub': res = d - v; break;
    case 'mul': res = d * v; break;
    case 'div':
      if (v === 0) return { ok: false, msg: '除数不能为 0' };
      res = d / v; break;
    case 'set': res = v; break;
    default: res = d;
  }
  const ri = Math.round(res);
  if (Number.isFinite(ri)) { if (ri < 1) return 1; return ri; }
  return d;
}
// 指定删除增强（还原自虾米 _DropSpecificDeleteWorker：按内容匹配全服删除，自动备份）
function delRates(engineRoot, o) {
  const opts = o || {};
  const content = String(opts.content || '').trim();
  if (!content) return { ok: false, msg: '未填写要删除的内容' };
  const method = opts.method || 'item'; // item=物品名 exact；contain=包含；regex=正则
  const autoBackup = opts.autoBackup !== false;
  if (autoBackup) backupMonItems(engineRoot, '指定删除');
  let matcher = null;
  if (method === 'regex') { try { matcher = new RegExp(content, 'i'); } catch (e) { return { ok: false, msg: '正则无效: ' + e.message }; } }
  else if (method === 'contain') matcher = (v) => v.includes(content);
  else matcher = (v) => v === content;
  let removed = 0, filesChanged = 0;
  for (const mon of listMonFiles(engineRoot)) {
    const rf = readMonFile(engineRoot, mon);
    if (!rf.exists) continue;
    const before = rf.items.length;
    let fileRemoved = 0;
    const kept = rf.items.filter(it => {
      if (it.kind !== 'rate') return true;
      const item = normalizeItemName(it.item);
      const hit = method === 'regex' ? matcher.test(item) : matcher(item);
      if (hit) { fileRemoved++; return false; }
      return true;
    });
    if (fileRemoved && kept.length !== before) { writeMonFile(engineRoot, mon, kept); filesChanged++; removed += fileRemoved; }
  }
  return { ok: true, files: filesChanged, removed, msg: '指定删除完成：' + filesChanged + ' 个文件 / 删除 ' + removed + ' 条（' + content + '）' };
}
// 普通爆率分组（还原自虾米 _DropGroupingWorker：按 group_size 把散落普通爆率合并成 #CHILD RANDOM 组）
function groupRates(engineRoot, o) {
  const opts = o || {};
  const groupSize = Math.max(2, +opts.groupSize || 5);
  const autoBackup = opts.autoBackup !== false;
  if (autoBackup) backupMonItems(engineRoot, '普通分组');
  let filesChanged = 0, groups = 0;
  for (const mon of listMonFiles(engineRoot)) {
    const rf = readMonFile(engineRoot, mon);
    if (!rf.exists) continue;
    // 收集连续普通爆率行（kind=rate），已有 #CHILD 组内行（括号深度>0）透传不参与分组
    const newItems = [];
    let pending = [];
    let depth = 0;
    const flush = () => {
      if (pending.length < 2) { newItems.push(...pending); pending = []; return; }
      // 按 groupSize 分批；组头保留该批第一条的分母（对齐虾米 flush_buffer：old_n = chunk[0][2]）
      for (let i = 0; i < pending.length; i += groupSize) {
        const batch = pending.slice(i, i + groupSize);
        newItems.push({ kind: 'child', num: 1, rate: batch[0].rate, flag: 'RANDOM', item: undefined, raw: '' });
        newItems.push({ kind: 'paren', raw: '(' });
        // 组内子项归一为 1/1（#CHILD 组语义：组头承担概率、组内等权重；对齐虾米 f'1/1 {name}'）
        for (const it of batch) newItems.push({ kind: 'rate', num: 1, rate: 1, item: it.item, count: it.count });
        newItems.push({ kind: 'paren', raw: ')' });
        groups++;
      }
      pending = [];
    };
    for (const it of rf.items) {
      if (it.kind === 'paren') {
        const isOpen = it.raw.trim() === '(';
        if (isOpen) depth++;
        flush();            // 括号边界：先冲 pending 再透传
        newItems.push(it);
        if (!isOpen) depth = Math.max(0, depth - 1);
        continue;
      }
      if (depth > 0) { newItems.push(it); continue; }   // 已有 #CHILD 组内行透传
      if (it.kind === 'rate') { pending.push(it); continue; }
      flush(); newItems.push(it);
    }
    flush();
    if (groups) { writeMonFile(engineRoot, mon, newItems); filesChanged++; }
  }
  return { ok: true, files: filesChanged, groups, msg: '普通分组完成：' + filesChanged + ' 个文件 / ' + groups + ' 个 #CHILD 随机组（每组 ≤' + groupSize + ' 条，组头保原分母）' };
}
// 二级爆率优化（还原自虾米 _DropOptimizeWorker._optimize_content：整理 #CHILD 结构——去重/空组清理/子项规范化）
function optimizeRates(engineRoot, o) {
  const opts = o || {};
  const autoBackup = opts.autoBackup !== false;
  if (autoBackup) backupMonItems(engineRoot, '二级优化');
  let filesChanged = 0, removed = 0;
  for (const mon of listMonFiles(engineRoot)) {
    const rf = readMonFile(engineRoot, mon);
    if (!rf.exists) continue;
    const items = rf.items;
    const out = [];
    let i = 0;
    let changed = false;
    while (i < items.length) {
      const it = items[i];
      if (it.kind === 'child' && items[i + 1] && items[i + 1].kind === 'paren' && items[i + 1].raw.trim() === '(') {
        // 收集组内子项直到 )
        let j = i + 2;
        const inner = [];
        while (j < items.length && !(items[j].kind === 'paren' && items[j].raw.trim() === ')')) { inner.push(items[j]); j++; }
        if (j >= items.length) { out.push(...inner); i = j; changed = true; continue; } // 未闭合，展平
        // 去重（物品名相同保留第一条）
        const seen = new Set();
        const dedup = inner.filter(x => {
          if (x.kind !== 'rate') return true;
          const n = normalizeItemName(x.item);
          if (seen.has(n)) { changed = true; removed++; return false; }
          seen.add(n); return true;
        });
        // 空组删除
        if (!dedup.length) { changed = true; removed++; i = j + 1; continue; }
        out.push(it);
        out.push({ kind: 'paren', raw: '(' });
        out.push(...dedup);
        out.push({ kind: 'paren', raw: ')' });
        i = j + 1;
      } else { out.push(it); i++; }
    }
    if (changed) { writeMonFile(engineRoot, mon, out); filesChanged++; }
  }
  return { ok: true, files: filesChanged, removed, msg: '二级优化完成：' + filesChanged + ' 个文件（清理重复/空组 ' + removed + ' 条）' };
}

// 解析 #CALL 目标（还原自虾米 _drop_resolve_call：路径校验/防设备与扩展路径/防指向备份目录）
function resolveCall(engineRoot, callPath) {
  const env = path.join(engineRoot, 'Mir200', 'Envir');
  let p = String(callPath || '').trim().replace(/^\[|\]$/g, '');
  if (!p) return { ok: false, msg: '空引用' };
  if (/^[A-Za-z]:/.test(p)) return { ok: false, msg: '禁止设备路径: ' + p };
  const norm = path.normalize(p).replace(/^[\\/]+/, '');
  if (norm.split(/[\\/]/).includes('..')) return { ok: false, msg: '禁止目录穿越: ' + p };
  if (/@backup|\.backup|\.xiami-|备份/i.test(norm)) return { ok: false, msg: '禁止指向备份目录: ' + p };
  let full = path.isAbsolute(p) ? path.normalize(p) : path.join(env, norm);
  if (!/\.txt$/i.test(full)) full += '.txt';
  if (!fs.existsSync(full)) return { ok: false, msg: '目标不存在: ' + full };
  return { ok: true, file: full };
}
// 扫描所有 MonItems 文件里的 #CALL 引用
function scanCallRefs(engineRoot) {
  const refs = [];
  for (const mon of listMonFiles(engineRoot)) {
    const f = monFile(engineRoot, mon);
    const content = decodeBuf(fs.readFileSync(f));
    for (const raw of content.split(/\r?\n/)) {
      const m = raw.match(/#CALL\s*\[([^\]]+)\]/i);
      if (m) refs.push({ mon, call: m[1].trim(), raw });
    }
  }
  return refs;
}
// #CALL 还原：默认 dry-run 扫描报告；--apply 时把引用目标内容展开进 MonItems（还原自虾米 #CALL 还原）
function restoreCall(engineRoot, opts) {
  const o = opts || {};
  const refs = scanCallRefs(engineRoot);
  if (!refs.length) return { ok: true, refs: 0, expanded: 0, msg: '未发现 #CALL 引用（MonItems 无引用）' };
  const dryRun = o.dryRun !== false;
  if (o.autoBackup !== false && !dryRun) backupMonItems(engineRoot, '#CALL还原');
  let expanded = 0, failed = 0;
  const failList = [];
  for (const ref of refs) {
    const r = resolveCall(engineRoot, ref.call);
    if (!r.ok) { failed++; if (failList.length < 5) failList.push(ref.mon + ' → ' + ref.call + '（' + r.msg + '）'); continue; }
    if (dryRun) { expanded++; continue; }
    const f = monFile(engineRoot, ref.mon);
    const content = decodeBuf(fs.readFileSync(f));
    const target = decodeBuf(fs.readFileSync(r.file)).replace(/\r?\n$/, '');
    const replaced = content.replace(ref.raw, target);
    writeTextFile(f, replaced);
    expanded++;
  }
  return { ok: true, refs: refs.length, expanded, failed, failList,
    msg: (dryRun ? '扫描到 ' : '已展开 ') + expanded + ' 处 #CALL' + (failed ? '（' + failed + ' 处解析失败：' + failList.join('；') + '）' : '') + '（共 ' + refs.length + ' 处引用）' };
}

// 批量新增爆率（还原自虾米 _MonItemsAddWorker：items 列表 + rate 追加到全服或指定怪）
function addRates(engineRoot, o) {
  const opts = o || {};
  const items = (opts.items || []).map(normalizeItemName).filter(Boolean);
  if (!items.length) return { ok: false, msg: '未填写物品名称' };
  const rate = Math.max(1, Math.round(+opts.rate || 1));   // 0/空/负数/小数一律钳到 ≥1，避免写入 1/0 或 1/-5
  const method = opts.method || 'all';
  const autoBackup = opts.autoBackup !== false;
  if (autoBackup) backupMonItems(engineRoot, '批量新增');
  let targets = [];
  if (method === 'monster') targets = (opts.monsters || []).map(normalizeItemName).filter(Boolean);
  else targets = listMonFiles(engineRoot);
  if (!targets.length) return { ok: false, msg: '未找到目标怪物文件' };
  let added = 0, filesChanged = 0, skipped = 0;
  const count = +opts.count > 1 ? +opts.count : 1;
  for (const mon of targets) {
    const rf = readMonFile(engineRoot, mon);
    if (!rf.exists) { skipped++; continue; }
    const rows = items.map(it => ({ kind: 'rate', num: 1, rate, item: it, count, raw: '' }));
    writeMonFile(engineRoot, mon, rf.items.concat(rows));
    added += rows.length; filesChanged++;
  }
  return { ok: true, files: filesChanged, added, skipped, msg: '批量新增完成：' + filesChanged + ' 个文件 / ' + added + ' 条（' + items.join('、') + ' 1/' + rate + (count > 1 ? ' ×' + count : '') + '）' };
}

// 备份 MonItems 到 @backup/<tag>_<时间戳>（还原自虾米"XX备份"）
function backupMonItems(engineRoot, tag) {
  const src = monItemsDir(engineRoot);
  if (!src || !fs.existsSync(src)) return { ok: false, msg: 'MonItems 目录不存在' };
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const tagName = (tag || 'backup') + '_' + ts;
  const dst = path.join(src, '@backup', tagName);
  fs.mkdirSync(dst, { recursive: true });
  let n = 0;
  for (const f of fs.readdirSync(src)) {
    if (f.startsWith('@backup')) continue;
    if (f.toLowerCase().endsWith('.txt')) { fs.copyFileSync(path.join(src, f), path.join(dst, f)); n++; }
  }
  return { ok: true, name: tagName, count: n, dir: dst, msg: '已备份 ' + n + ' 个爆率文件到 @backup/' + tagName };
}
// 列出备份
function listBackups(engineRoot) {
  const bakDir = path.join(monItemsDir(engineRoot) || '', '@backup');
  if (!fs.existsSync(bakDir)) return { ok: true, list: [] };
  return { ok: true, list: fs.readdirSync(bakDir).filter(d => fs.statSync(path.join(bakDir, d)).isDirectory()).sort().reverse() };
}
// 还原备份（校验名称安全：只能还原 @backup 下的目录）
function restoreBackup(engineRoot, name) {
  const n = String(name || '').trim();
  if (!n || n.includes('..') || n.includes('/') || n.includes('\\')) return { ok: false, msg: '备份名无效' };
  const src = path.join(monItemsDir(engineRoot) || '', '@backup', n);
  if (!fs.existsSync(src)) return { ok: false, msg: '备份不存在: ' + n };
  let restored = 0;
  for (const f of fs.readdirSync(src)) {
    if (f.toLowerCase().endsWith('.txt')) { fs.copyFileSync(path.join(src, f), path.join(monItemsDir(engineRoot), f)); restored++; }
  }
  return { ok: true, count: restored, msg: '已还原 ' + restored + ' 个文件（' + n + '）' };
}
// MapInfo 双向映射（还原自虾米 _load_mapinfo/_maps_to_codes）
function mapNamesToCodes(engineRoot, mapNames) {
  const mi = path.join(engineRoot, 'Mir200', 'Envir', 'MapInfo.txt');
  const nameToCode = {};
  if (fs.existsSync(mi)) {
    for (const raw of decodeBuf(fs.readFileSync(mi)).split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith(';')) continue;
      const m = line.match(/^\[([^\]]+)\]/);
      if (!m) continue;
      const parts = m[1].split('|');
      const code = String(parts[0]).split(/[\s\t]+/)[0].trim();
      const nmM = m[1].match(/\s+([^\s].*)$/);
      const nm = (nmM ? nmM[1].trim() : code).replace(/\s+/g, ' ');
      nameToCode[nm] = code;
      nameToCode[code] = code;
      for (const a of parts.slice(1)) { const am = a.match(/^([^\s]+)/); if (am) nameToCode[am[1].trim()] = code; }
    }
  }
  return (mapNames || []).map(x => String(x || '').trim()).filter(Boolean).map(x => nameToCode[x] || x);
}
// 从 MonGen 按地图代码取怪（还原自虾米 _monsters_from_mongen）
function monstersFromMonGen(engineRoot, mapCodes) {
  const f = monGenFile(engineRoot);
  const set = new Set();
  if (!fs.existsSync(f)) return [...set];
  const want = new Set(mapCodes);
  for (const raw of decodeBuf(fs.readFileSync(f)).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;
    const parts = line.split(/[\t ]+/);
    if (parts.length < 4) continue;
    if (want.has(parts[0])) set.add(parts[3]);
  }
  return [...set];
}
// 整体爆率优化（还原自虾米 _DropOverallOptimizeWorker：method 筛选 + 范围匹配 + 运算）
function overallOptimize(engineRoot, opts) {
  const o = opts || {};
  const method = o.method || 'all';
  const autoBackup = o.autoBackup !== false;
  if (autoBackup) backupMonItems(engineRoot, '整体优化');
  // 1. 圈定目标文件
  let targets = [];
  if (method === 'monster') {
    targets = (o.monsters || []).map(normalizeItemName).filter(Boolean).map(m => ({ mon: m }));
  } else if (method === 'map') {
    const codes = mapNamesToCodes(engineRoot, o.maps || []);
    const mons = monstersFromMonGen(engineRoot, codes);
    targets = mons.map(m => ({ mon: m }));
  } else if (method === 'item') {
    const items = (o.items || []).map(normalizeItemName).filter(Boolean);
    targets = listMonFiles(engineRoot).map(m => ({ mon: m, matchItems: items }));
  } else {
    targets = listMonFiles(engineRoot).map(m => ({ mon: m }));
  }
  if (!targets.length) return { ok: false, msg: '未找到需要处理的爆率文件（还原自虾米）', total: 0, changed: 0 };
  // 2. 逐文件处理
  let changed = 0, filesChanged = 0, skipped = 0;
  for (const t of targets) {
    const rf = readMonFile(engineRoot, t.mon);
    if (!rf.exists) { skipped++; continue; }
    let fileChanged = 0;
    let aborted = null;
    const newItems = rf.items.map(it => {
      if (it.kind !== 'rate') return it;
      const item = normalizeItemName(it.item);
      if (method === 'item' && t.matchItems && !t.matchItems.includes(item)) return { ...it, item };
      // rate 字段就是分母 den（1/100 → 100，与虾米一致），直接操作
      const den = it.rate;
      if (o.rangeOp && o.rangeValue != null) {
        const rv = +o.rangeValue;
        const ok = o.rangeOp === '>' ? den > rv : o.rangeOp === '<' ? den < rv : o.rangeOp === '>=' ? den >= rv : o.rangeOp === '<=' ? den <= rv : den === rv;
        if (!ok) return { ...it, item };
      }
      const newDen = applyOp(den, o.op || 'mul', o.opValue != null ? o.opValue : 1);
      if (newDen && typeof newDen === 'object' && newDen.ok === false) { aborted = newDen.msg; return { ...it, item }; }
      if (newDen !== it.rate) { fileChanged++; return { ...it, item, rate: newDen }; }
      return { ...it, item };
    });
    if (aborted) return { ok: false, msg: '整体优化中止：' + aborted + '（' + t.mon + '）' };
    if (fileChanged) { writeMonFile(engineRoot, t.mon, newItems); filesChanged++; changed += fileChanged; }
  }
  return { ok: true, total: targets.length, changed, filesChanged, skipped, msg: '整体优化完成：' + filesChanged + ' 个文件 / ' + changed + ' 条调整（共 ' + targets.length + ' 目标）' };
}

// 按地图获取怪物列表（解析 MonGen.txt：代码 x y 名称 范围 数量...，分号注释）
// 还原自 renderer 提示"目前只能从MonGen.txt获取地图刷哪些怪，动态刷怪脚本无法获取"
function monsByMap(engineRoot, mapCode) {
  const f = monGenFile(engineRoot);
  if (!fs.existsSync(f)) return [];
  const content = decodeBuf(fs.readFileSync(f));
  const mons = new Set();
  for (const line of content.split(/\r\n|\r|\n/)) {
    const t = line.trim();
    if (!t || t.startsWith(';')) continue;
    const parts = t.split(/[\t ]+/);
    if (parts.length >= 4 && parts[0] === mapCode) mons.add(parts[3]);
  }
  return [...mons];
}

// ---- 修改操作 ----
// 追加爆率（还原自 setRate/setUpdateItems：append 语义）
function addRate(engineRoot, monName, itemName, rate, count, append = true, child = false) {
  const { file, exists, items } = readMonFile(engineRoot, monName);
  let target = items;
  if (!append) {
    // 删除模式：移除同物品条目（还原自 setRemoves）
    target = items.filter(it => it.kind !== 'rate' || it.item !== itemName);
  }
  if (child) {
    target.push({ kind: 'child', num: 1, rate: Math.max(1, Math.round(+rate || 1)), flag: 'RANDOM', cond: null, raw: '' });
  } else {
    target.push({ kind: 'rate', item: itemName, num: 1, rate: Math.max(1, Math.round(+rate || 1)), count: Math.max(1, +count || 1), raw: '' });
  }
  writeMonFile(engineRoot, monName, target);
  return { file, exists: exists || true, added: 1, total: target.filter(x => x.kind !== 'blank').length };
}

// 删除爆率
function delRate(engineRoot, monName, itemName) {
  const { file, exists, items } = readMonFile(engineRoot, monName);
  if (!exists) return { file, exists: false, removed: 0, total: 0 };
  const before = items.length;
  const target = items.filter(it => it.kind !== 'rate' || it.item !== itemName);
  writeMonFile(engineRoot, monName, target);
  return { file, exists: true, removed: before - target.length, total: target.filter(x => x.kind !== 'blank').length };
}

// 全局操作（遍历所有怪物文件，还原自 SFI13258/13277 forEach）
function globalOp(engineRoot, op, itemName, rate, count, append = true, child = false) {
  const mons = listMonFiles(engineRoot);
  const results = [];
  for (const m of mons) {
    try {
      const r = op === 'add'
        ? addRate(engineRoot, m, itemName, rate, count, append, child)
        : delRate(engineRoot, m, itemName);
      results.push({ mon: m, ...r });
    } catch (e) {
      results.push({ mon: m, error: e.message });
    }
  }
  return { total: mons.length, results };
}

// ---- 批量调整爆率（还原自 SFI13425 + 转换闭包 ctx[7]）----
// 参数：{ rate(倍率), minRate, maxRate, maxLimit, type('normal'|'child') }
// type=normal 只调普通爆率行；type=child 只调 #CHILD 头行
function adjustItem(item, opt) {
  if (!item) return item;
  if (item.kind === 'blank' || item.kind === 'paren' || item.kind === 'unknown') return item;
  if (item.rate <= 0) return item;
  const isChild = item.kind === 'child';
  if (opt.type === 'normal' && isChild) return item;
  if (opt.type === 'child' && !isChild) return item;
  if (opt.minRate != null && item.rate < opt.minRate) return item;
  if (opt.maxRate != null && item.rate > opt.maxRate) return item;
  let r = Math.round(item.rate * (opt.rate != null ? opt.rate : 1));
  if (opt.maxLimit != null && r > opt.maxLimit) r = opt.maxLimit;  // 上限限定
  r = Math.max(1, Math.min(MAX_RATE, r));          // 最小值1 / 上限90000000
  item.rate = r;
  return item;
}

function adjustRateFile(engineRoot, monName, opt) {
  const { file, exists, items } = readMonFile(engineRoot, monName);
  if (!exists) return { file, exists: false, changed: 0, total: 0 };
  let changed = 0;
  const before = items.map(serializeLine);
  const out = [];
  let depth = 0;
  const mult = opt.rate != null ? opt.rate : 1;
  for (const it of items) {
    if (it.kind === 'paren') {
      if (it.raw.trim() === '(') depth++; else depth = Math.max(0, depth - 1);
      out.push(it);
      continue;
    }
    // 过滤条件（rate 条目 / child 组头）
    const filtered = (it.kind === 'rate' || it.kind === 'child') && (it.rate <= 0 ||
      (opt.minRate != null && it.rate < opt.minRate) ||
      (opt.maxRate != null && it.rate > opt.maxRate));
    if (filtered) { out.push(it); continue; }

    if (it.kind === 'rate') {
      if (opt.type === 'child' && depth === 0) {
        // 随机爆率 #CHILD 1/*：组外普通爆率 → 随机组（对齐原版 #CHILD 1/N RANDOM 组格式）
        let r = Math.max(1, Math.min(MAX_RATE, Math.round(it.rate * mult)));
        if (opt.maxLimit != null && r > opt.maxLimit) r = opt.maxLimit;
        out.push({ kind: 'child', num: it.num != null ? it.num : 1, rate: r, flag: 'RANDOM', cond: null, item: undefined, raw: '' });
        out.push({ kind: 'paren', raw: '(' });
        out.push({ kind: 'rate', item: it.item, num: 1, rate: 1, count: it.count != null ? it.count : 1, raw: '' });
        out.push({ kind: 'paren', raw: ')' });
        changed++;
        continue;
      }
      if (depth > 0) { out.push(it); continue; } // 组内条目不参与倍率
      let r = Math.max(1, Math.min(MAX_RATE, Math.round(it.rate * mult)));
      if (opt.maxLimit != null && r > opt.maxLimit) r = opt.maxLimit;
      it.rate = r;
      out.push(it);
      if (serializeLine(it) !== before[items.indexOf(it)]) changed++;
      continue;
    }
    if (it.kind === 'child') {
      if (opt.type === 'normal') { out.push(it); continue; } // 普通模式不碰随机组头
      // 随机组头：概率 × 倍率（仅随机爆率模式）
      let r = Math.max(1, Math.min(MAX_RATE, Math.round(it.rate * mult)));
      if (opt.maxLimit != null && r > opt.maxLimit) r = opt.maxLimit;
      it.rate = r;
      out.push(it);
      if (serializeLine(it) !== before[items.indexOf(it)]) changed++;
      continue;
    }
    out.push(it);
  }
  writeMonFile(engineRoot, monName, out);
  return { file, exists: true, changed, total: out.filter(x => x.kind !== 'blank' && x.kind !== 'paren').length };
}


function convertRandomFile(engineRoot, monName, opt) {
  const { file, exists, items } = readMonFile(engineRoot, monName);
  if (!exists) return { file, exists: false, changed: 0, total: 0 };
  let changed = 0;
  let depth = 0;
  const out = [];
  for (const it of items) {
    if (it.kind === 'paren') {
      if (it.raw.trim() === '(') depth++; else depth = Math.max(0, depth - 1);
      out.push(it);
      continue;
    }
    const eligible = it.kind === 'rate' && it.rate > 0 && depth === 0 &&
      !(opt.minRate != null && it.rate < opt.minRate) &&
      !(opt.maxRate != null && it.rate > opt.maxRate);
    if (!eligible) { out.push(it); continue; }
    // 普通爆率（组外）→ 随机组：#CHILD num/rate RANDOM + ( + 1/1 物品 + )
    changed++;
    out.push({ kind: 'child', num: it.num != null ? it.num : 1, rate: it.rate, flag: 'RANDOM', cond: null, item: undefined, raw: '' });
    out.push({ kind: 'paren', raw: '(' });
    out.push({ kind: 'rate', item: it.item, num: 1, rate: 1, count: it.count != null ? it.count : 1, raw: '' });
    out.push({ kind: 'paren', raw: ')' });
  }
  writeMonFile(engineRoot, monName, out);
  return { file, exists: true, changed, total: out.filter(x => x.kind !== 'blank' && x.kind !== 'paren').length };
}


// ---- 地图查看 / 物品产出查询（整合功能）----
// 查看地图刷怪 + 每怪的爆率文件概况（还原自"按地图"与"按物品产出"）
function mapMonsters(engineRoot, mapCode) {
  const mons = monsByMap(engineRoot, mapCode);
  return mons.map(m => {
    const r = readMonFile(engineRoot, m);
    return {
      mon: m,
      exists: r.exists,
      lines: r.items.filter(x => x.kind === 'rate' || x.kind === 'child').length,
      items: r.exists ? r.items.filter(x => x.kind === 'rate').slice(0, 10).map(serializeLine) : [],
    };
  });
}

// 全服扫描：某物品被哪些怪掉落（还原自 goods 模块"按物品产出"）
function findItemDrops(engineRoot, itemName) {
  const mons = listMonFiles(engineRoot);
  const drops = [];
  const key = String(itemName).trim();
  for (const m of mons) {
    const r = readMonFile(engineRoot, m);
    for (const it of r.items) {
      if (it.kind === 'rate' && it.item === key) {
        drops.push({ mon: m, line: serializeLine(it), rate: it.rate, num: it.num, count: it.count });
      }
    }
  }
  return drops;
}


// ---- 追加在指定物品后（还原自 renderer goods 类型"指定加在某个物品后"）----
// targetItem: 目标物品（找到它在哪些怪掉、插在其后）；newItemName: 追加的物品
function addAfterItem(engineRoot, targetItem, newItemName, rate, count, child) {
  const drops = findItemDrops(engineRoot, targetItem);
  const results = [];
  for (const d of drops) {
    const { file, items } = readMonFile(engineRoot, d.mon);
    const idx = items.findIndex(it => it.kind === 'rate' && it.item === targetItem);
    if (idx >= 0) {
      const ni = child
        ? { kind: 'child', num: 1, rate: rate || 0, flag: 'RANDOM', cond: null, raw: '' }
        : { kind: 'rate', item: newItemName, num: 1, rate: rate || 0, count: count || 1, raw: '' };
      items.splice(idx + 1, 0, ni);
      writeMonFile(engineRoot, d.mon, items);
      results.push({ mon: d.mon, file, after: targetItem, line: serializeLine(ni) });
    }
  }
  return results;
}

// ---- #CHILD 区间随机值（还原自"随机爆率#CHILD(开始和结束之间的)"）----
function randRate(start, end) {
  const s = Math.min(start, end);
  const e = Math.max(start, end);
  if (s >= e) return s;
  return s + Math.floor(Math.random() * (e - s + 1));
}

// 全局批量调整 / 随机转换
function globalAdjust(engineRoot, opt) {
  const mons = listMonFiles(engineRoot);
  const results = [];
  for (const m of mons) {
    try { results.push({ mon: m, ...adjustRateFile(engineRoot, m, opt) }); }
    catch (e) { results.push({ mon: m, error: e.message }); }
  }
  return { total: mons.length, results };
}
function globalConvert(engineRoot, opt) {
  const mons = listMonFiles(engineRoot);
  const results = [];
  for (const m of mons) {
    try { results.push({ mon: m, ...convertRandomFile(engineRoot, m, opt) }); }
    catch (e) { results.push({ mon: m, error: e.message }); }
  }
  return { total: mons.length, results };
}


// ==================== MonGen.txt（怪物刷新配置） ====================
// 格式（空格分隔，7~10 列）：地图 X Y 怪物名 数量 范围 间隔 [时间 触发编号] [附加参数]
// 首行表头、";"注释行、空行保留原样

// 解析 MonGen.txt：返回 { file, header, rawLines, spawns }（支持 MONGENEX 前缀 + 多 token 怪名，还原自虾米 parse_mongen_line）
function readMonGen(engineRoot) {
  const f = monGenFile(engineRoot);
  if (!f || !fs.existsSync(f)) return null;
  const content = decodeBuf(fs.readFileSync(f));
  const newline = content.includes('\r\n') ? '\r\n' : content.includes('\r') ? '\r' : content.includes('\n') ? '\n' : '\r\n';
  const rawLines = content.split(/\r\n|\r|\n/);
  const spawns = [];
  let header = '';
  const isNum = (s) => /^-?\d+(\.\d+)?$/.test(s);
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (i === 0 && /代码|名称|范围/i.test(line)) { header = line; continue; }
    const t = line.trim();
    if (!t || t.startsWith(';')) continue;
    const p = t.split(/[\s\u00A0\u3000]+/);
    let start = 0, cmd = '';
    if (p[0] && p[0].trim().toLowerCase() === 'mongenex') { start = 1; cmd = 'mongenex'; }
    if (p.length - start < 6) continue;
    // 怪物名：从第 4 列起收集非数字 token（虾米：多 token 怪名）
    let i2 = start + 3;
    const nameToks = [];
    while (i2 < p.length && !isNum(p[i2])) { nameToks.push(p[i2]); i2++; }
    if (!nameToks.length) continue;
    const mon = nameToks.join(' ');
    if (i2 + 2 > p.length) continue;   // G1：6 列行(i2+2==p.length)时 range/count 刚好存在，>= 会误丢
    const range = p[i2], count = p[i2 + 1];
    let j = i2 + 2;
    let interval = '', time = '', trigger = '', extra = '', extraCols = [];
    if (j < p.length) { interval = p[j]; time = p[j]; j++; }   // 第7列 = 时间间隔（虾米 0997：count 后第1列为 time）
    if (cmd === 'mongenex') {
      // MONGENEX：剩余列全为附加尾巴（name_color/国家/备注等）
      extraCols = p.slice(j);
      extra = extraCols.join(' ');
    } else {
      // 虾米 0997：间隔之后的数字列归 trigger/default/name_range，非数字列归 extra（颜色/国家/备注）
      const tailNums = [];
      while (j < p.length && isNum(p[j])) { tailNums.push(p[j]); j++; }
      if (tailNums.length >= 2) { trigger = tailNums[0]; extraCols = tailNums.slice(1); }
      else if (tailNums.length === 1) { trigger = tailNums[0]; }
      extraCols = extraCols.concat(p.slice(j));
      extra = extraCols.join(' ');
    }
    spawns.push({
      lineIdx: i, cmd, map: p[start], x: p[start + 1], y: p[start + 2], mon,
      range, count, interval, time, trigger, extra, extraCols
    });
  }
  return { file: f, header, rawLines, spawns, newline };
}

// 序列化一条刷怪行（保留 MONGENEX 前缀与列风格）
function serializeSpawn(s) {
  const pre = s.cmd === 'mongenex' ? 'MONGENEX ' : '';
  let line = pre + s.map + ' ' + s.x + ' ' + s.y + ' ' + s.mon + ' ' + s.range + ' ' + s.count + ' ' + s.interval;
  if (s.cmd === 'mongenex') {
    if (s.extraCols && s.extraCols.length) line += ' ' + s.extraCols.join(' ');
    return line;
  }
  // 普通行：time 与 interval 同列赋值（readMonGen），不能重复写；只按原版列序写第 8+ 列（trigger + extraCols）
  const tail = [];
  if (s.trigger !== '') tail.push(s.trigger);
  if (s.extraCols && s.extraCols.length) tail.push(...s.extraCols);
  if (tail.length) line += ' ' + tail.join(' ');
  return line;
}

// 查看：按地图列出刷怪
function listMonGen(engineRoot, mapCode) {
  const mg = readMonGen(engineRoot);
  if (!mg) return { ok: false, msg: '未找到 MonGen.txt（期望 Mir200\\Envir\\MonGen.txt）' };
  const rows = mapCode ? mg.spawns.filter(s => s.map === mapCode) : mg.spawns;
  return { ok: true, file: mg.file, total: mg.spawns.length, rows, header: mg.header };
}

// 追加一条刷怪
function addMonGen(engineRoot, s) {
  const mg = readMonGen(engineRoot);
  if (!mg) return { ok: false, msg: '未找到 MonGen.txt' };
  if (!s.map || s.x == null || s.y == null || !s.mon) return { ok: false, msg: '缺少必填字段（地图 X Y 怪物名）' };   // 坐标 0 合法（地图边缘）
  const line = serializeSpawn({
    map: s.map, x: s.x, y: s.y, mon: s.mon,
    count: s.count != null ? s.count : 1,
    range: s.range != null ? s.range : 0,
    interval: s.interval != null ? s.interval : 0,
    time: s.time != null ? s.time : 0,
    trigger: s.trigger != null ? s.trigger : 0,
    extra: s.extra || '', extraCols: s.extraCols || []
  });
  // 追加行 + 保留原换行（R3-7/T-P2-7：不再硬编码 CRLF）；末尾空串是 split 产物（原文件以换行结尾），写前清理
  while (mg.rawLines.length && mg.rawLines[mg.rawLines.length - 1] === '') mg.rawLines.pop();
  mg.rawLines.push(line);
  preserveMonGenWrite(mg.file, mg.rawLines, mg.newline);
  return { ok: true, line, file: mg.file };
}

// 删除：按地图+怪物名删除刷怪行
function delMonGen(engineRoot, mapCode, mon) {
  const mg = readMonGen(engineRoot);
  if (!mg) return { ok: false, msg: '未找到 MonGen.txt' };
  const removed = [];
  for (let i = mg.spawns.length - 1; i >= 0; i--) {
    const s = mg.spawns[i];
    if (s.map === mapCode && s.mon === mon) {
      removed.push(s);
      mg.rawLines.splice(s.lineIdx, 1);   // 整行移除，不留空行
    }
  }
  if (removed.length === 0) return { ok: false, msg: '未找到 ' + mapCode + ' 的「' + mon + '」刷怪行', removed: 0 };
  while (mg.rawLines.length && mg.rawLines[mg.rawLines.length - 1] === '') mg.rawLines.pop();   // 末尾空串清理
  preserveMonGenWrite(mg.file, mg.rawLines, mg.newline);
  return { ok: true, removed: removed.length, file: mg.file };
}


// ==================== 货币消耗管理（扫描脚本货币命令） ====================
// 扫描 Envir 下所有脚本，匹配货币命令（CHECKGOLD/TAKE/GIVE/GOLDCOUNT/GAMEGOLD/DEC/INC 等）
// 还原自原软件"版本消耗-货币花费"功能 + 翎风引擎命令文档

// 内置货币：名称 -> 脚本命令关键字
const BUILTIN_CURRENCIES = [
  { name: '金币', keywords: ['金币', 'GOLD'] },
  { name: '元宝', keywords: ['元宝', 'GAMEGOLD'] },
  { name: '金刚石', keywords: ['金刚石', 'GAMEDIAMOND'] },
  { name: '灵符', keywords: ['灵符', 'GAMEGIRD'] },
  { name: '游戏点', keywords: ['游戏点', 'GAMEPOINT'] },
  { name: '声望', keywords: ['声望', 'CREDITPOINT'] },
  { name: '荣誉', keywords: ['荣誉', 'GAMEGLORY'] },
];

// 判断一个命令是否货币消耗/收入/检查，返回 { type: 'consume'|'income'|'check', currency, amount } 或 null
function matchCurrencyCmd(line) {
  const t = line.trim();
  // 去掉行首 [@段] 不影响（段名单独处理）
  const upper = t.toUpperCase();
  // GOLDCOUNT =/+/- N
  let m = upper.match(/^(GOLDCOUNT|CHANGEGOLD)\s*([=+-])\s*(\d+)/);
  if (m) {
    const type = m[2] === '-' ? 'consume' : (m[2] === '+' ? 'income' : 'check');
    return { type, currency: '金币', amount: parseInt(m[3], 10) };
  }
  // GAMEGOLD =/+/- N（元宝）
  m = upper.match(/^(GAMEGOLD|GAMEDIAMOND|GAMEPOINT|GAMEGIRD|CREDITPOINT|GAMEGLORY)\s*([=+-])\s*(\d+)/);
  if (m) {
    const names = { GAMEGOLD: '元宝', GAMEDIAMOND: '金刚石', GAMEPOINT: '游戏点', GAMEGIRD: '灵符', CREDITPOINT: '声望', GAMEGLORY: '荣誉' };
    const type = m[2] === '-' ? 'consume' : (m[2] === '+' ? 'income' : 'check');
    return { type, currency: names[m[1]], amount: parseInt(m[3], 10) };
  }
  // CHECKGOLD N（检查金币）
  m = upper.match(/^CHECKGOLD\s+(\d+)/);
  if (m) return { type: 'check', currency: '金币', amount: parseInt(m[1], 10) };
  // CHECK 金币 N / CHECKGAMEGOLD > N 等检查
  m = upper.match(/^CHECK\s+(金币|元宝|金刚石|灵符|游戏点|声望|荣誉|GOLD|GAMEGOLD)\s*(>|<|=)?\s*(\d+)/);
  if (m) {
    const names = { 金币: '金币', 元宝: '元宝', 金刚石: '金刚石', 灵符: '灵符', 游戏点: '游戏点', 声望: '声望', 荣誉: '荣誉', GOLD: '金币', GAMEGOLD: '元宝' };
    return { type: 'check', currency: names[m[1]], amount: parseInt(m[3], 10) };
  }
  m = upper.match(/^CHECKGAMEGOLD\s*(>|<|=)?\s*(\d+)/);
  if (m) return { type: 'check', currency: '元宝', amount: parseInt(m[2], 10) };
  // TAKE/GIVE 金币 N（G2：白名单补 GAMEDIAMOND|GAMEPOINT|GAMEGIRD|CREDITPOINT|GAMEGLORY）
  m = upper.match(/^(TAKE|GIVE)\s+(金币|元宝|金刚石|灵符|游戏点|声望|荣誉|GOLD|GAMEGOLD|GAMEDIAMOND|GAMEPOINT|GAMEGIRD|CREDITPOINT|GAMEGLORY)\s+(\d+)/);
  if (m) {
    const names = { 金币: '金币', 元宝: '元宝', 金刚石: '金刚石', 灵符: '灵符', 游戏点: '游戏点', 声望: '声望', 荣誉: '荣誉', GOLD: '金币', GAMEGOLD: '元宝', GAMEDIAMOND: '金刚石', GAMEPOINT: '游戏点', GAMEGIRD: '灵符', CREDITPOINT: '声望', GAMEGLORY: '荣誉' };
    return { type: m[1] === 'TAKE' ? 'consume' : 'income', currency: names[m[2]], amount: parseInt(m[3], 10) };
  }
  // 自定义货币：TAKE/DEC 变量 N（U1-U99、N$xxx、中文 N$ 变量、<$STR(x)> 等变量）
  m = upper.match(/^(TAKE|DEC|GIVE|INC)\s+([A-Z$0-9_.<>\u4e00-\u9fa5]+)\s+(\d+)/);
  if (m && /^[A-Z_$]/.test(m[2])) {
    return { type: (m[1] === 'TAKE' || m[1] === 'DEC') ? 'consume' : 'income', currency: m[2], amount: parseInt(m[3], 10) };
  }
  return null;
}

// 扫描 Envir 下所有脚本文件（排除爆率/刷怪/数据文件）
function listScriptFiles(engineRoot) {
  const envir = path.join(engineRoot, 'Mir200', 'Envir');
  const alt = path.join(engineRoot, 'Envir');
  const base = fs.existsSync(envir) ? envir : (fs.existsSync(alt) ? alt : null);
  if (!base) return { base: null, files: [] };
  const files = [];
  const skipDirs = new Set(['MonItems', 'MonGen', 'StartPoint', 'Npc', 'Npc脚本', 'Robot_def']);
  (function walk(d) {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (!skipDirs.has(e.name)) walk(p);
      } else if (/.txt$/i.test(e.name)) {
        files.push(p);
      }
    }
  })(base);
  return { base, files };
}

// 分析版本货币消耗
// opts: { dropQFunction: true, dropQManage: true, dropNoNpc: true }
function findCurrency(engineRoot, opts) {
  opts = opts || {};
  const { base, files } = listScriptFiles(engineRoot);
  if (!base) return { ok: false, msg: '未找到 Envir 目录（期望 Mir200\\Envir）' };
  const results = [];
  for (const f of files) {
    const rel = f.slice(base.length + 1).replace(/\\/g, '/');
    const fname = path.basename(f).toLowerCase();
    if (opts.dropQFunction && fname === 'qfunction-0.txt') continue;
    if (opts.dropQManage && fname === 'qmanage.txt') continue;
    let content;
    try { content = decodeBuf(fs.readFileSync(f)); } catch (e) { continue; }
    // 按 [@段] 分段
    const sections = content.split(/\r?\n(?=\[@)/);
    for (const sec of sections) {
      const lines = sec.split(/\r?\n/);
      const head = lines[0] || '';
      const section = (head.match(/^\[@([^\]]+)\]/) || [])[1] || '';
      // NPC 名：QuestDiary 用文件相对路径+段名；Market_Def 用文件名
      const npc = section || rel;
      for (const line of lines) {
        const r = matchCurrencyCmd(line);
        if (r) {
          results.push({ file: rel, npc, section, type: r.type, currency: r.currency, amount: r.amount, line: line.trim() });
        }
      }
    }
  }
  return { ok: true, base, total: results.length, results };
}

// 汇总报告：按货币统计
function currencyReport(engineRoot, opts) {
  const r = findCurrency(engineRoot, opts);
  if (!r.ok) return r;
  const byCur = {};
  const byNpc = {};
  for (const x of r.results) {
    const c = byCur[x.currency] || (byCur[x.currency] = { currency: x.currency, consume: 0, income: 0, check: 0, count: 0, files: new Set(), npcs: new Set() });
    c.count++;
    c.files.add(x.file);
    c.npcs.add(x.npc);
    if (x.type === 'consume') c.consume += x.amount;
    else if (x.type === 'income') c.income += x.amount;
    else c.check += x.amount;
    const key = x.currency + '|' + x.npc;
    const n = byNpc[key] || (byNpc[key] = { currency: x.currency, npc: x.npc, consume: 0, income: 0, check: 0, count: 0 });
    n.count++;
    if (x.type === 'consume') n.consume += x.amount;
    else if (x.type === 'income') n.income += x.amount;
    else n.check += x.amount;
  }
  // 序列化 Set
  const curList = Object.values(byCur).map(c => ({ currency: c.currency, consume: c.consume, income: c.income, check: c.check, count: c.count, fileCount: c.files.size, npcCount: c.npcs.size }))
    .sort((a, b) => b.consume - a.consume);
  const npcList = Object.values(byNpc).sort((a, b) => b.consume - a.consume);
  return { ok: true, base: r.base, total: r.total, currencies: curList, npcs: npcList };
}


// ==================== 脚本搜索替换（还原自 index-0a99aa24） ====================
// 表单：path(目录) type(.txt/*.*) isCase(区分大小写) isChildren(包含子目录) oldContent(搜索) newContent(替换)
// 搜索模式返回匹配行号；替换模式写回文件（GBK）

// 扫描目录下符合条件的文件
// opts: { dir, types: ['.txt'], isChildren: true }
function collectScriptFiles(opts) {
  const dir = opts.dir;
  if (!dir || !fs.existsSync(dir)) return [];
  const files = [];
  const types = (opts.types && opts.types.length) ? opts.types : ['.txt'];
  const allTypes = types.includes('*.*');
  (function walk(d) {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (opts.isChildren !== false) walk(p);
      } else if (allTypes || types.some(t => e.name.toLowerCase().endsWith(t.toLowerCase()))) {
        files.push(p);
      }
    }
  })(dir);
  return files;
}

// 搜索：返回 [{ file, rel, count, lines: [行号] }]
function searchScripts(root, opts) {
  const dir = opts.dir || path.join(root, 'Mir200', 'Envir');
  if (!fs.existsSync(dir)) return { ok: false, msg: '目录不存在: ' + dir };
  const files = collectScriptFiles(opts);
  const results = [];
  for (const f of files) {
    let content;
    try { content = decodeBuf(fs.readFileSync(f)); } catch (e) { continue; }
    const lines = content.split(/\r?\n/);
    const hits = [];
    const needle = opts.search;
    const caseSensitive = opts.isCase !== false;
    const cmp = caseSensitive ? needle : needle.toLowerCase();
    const mode = opts.matchMode || 'contains'; // contains | exact | regex | prefix | suffix
    let re = null;
    if (mode === 'regex') { try { re = new RegExp(needle, caseSensitive ? '' : 'i'); } catch (e2) { re = null; } }
    for (let i = 0; i < lines.length; i++) {
      const l = caseSensitive ? lines[i] : lines[i].toLowerCase();
      let matched = false;
      if (mode === 'exact') matched = (l === cmp);
      else if (mode === 'regex') matched = !!(re && re.test(lines[i]));
      else if (mode === 'prefix') matched = l.startsWith(cmp);
      else if (mode === 'suffix') matched = l.endsWith(cmp);
      else matched = l.indexOf(cmp) >= 0;
      if (matched) hits.push(i + 1);
    }
    if (hits.length) results.push({ file: f, rel: f.slice(dir.length + 1), count: hits.length, lines: hits });
  }
  return { ok: true, dir, total: results.reduce((a, r) => a + r.count, 0), results };
}

// 替换：返回 [{ file, rel, replaced }]
function replaceScripts(root, opts) {
  if (!opts.search) return { ok: false, msg: '搜索内容为空' };   // 空搜索：不区分大小写分支 idx+=0 死循环、区分分支 split('') 逐字符拆
  const dir = opts.dir || path.join(root, 'Mir200', 'Envir');
  if (!fs.existsSync(dir)) return { ok: false, msg: '目录不存在: ' + dir };
  const files = collectScriptFiles(opts);
  const results = [];
  let totalReplaced = 0;
  for (const f of files) {
    let content;
    try { content = decodeBuf(fs.readFileSync(f)); } catch (e) { continue; }
    let replaced = 0;
    const from = opts.search;
    const to = opts.replace != null ? opts.replace : '';
    if (opts.isCase === false) {
      // 不区分大小写：逐段扫描替换（避开正则转义）
      const lowerFrom = from.toLowerCase();
      let newContent = '';
      let idx = 0;
      while (idx < content.length) {
        const chunk = content.slice(idx, idx + from.length);
        if (chunk.toLowerCase() === lowerFrom) { newContent += to; replaced++; idx += from.length; }
        else { newContent += content[idx]; idx++; }
      }
      content = newContent;
    } else {
      // 区分大小写：split/join
      const parts = content.split(from);
      replaced = parts.length - 1;
      content = parts.join(to);
    }
    if (replaced > 0) {
      writeTextFile(f, content);
      totalReplaced += replaced;
      results.push({ file: f, rel: f.slice(dir.length + 1), replaced });
    }
  }
  return { ok: true, dir, total: totalReplaced, results };
}


// ==================== 货币兑换 NPC 生成（还原自 index-eae1c9c2） ====================
// 流程：MerChant.txt 注册 NPC + Market_Def 生成兑换脚本
// NPC 名固定

const EXCHANGE_NPC_NAME = '元歌货币兑换';

function merchantFile(engineRoot) {
  return path.join(engineRoot, 'Mir200', 'Envir', 'MerChant.txt');
}

// 生成兑换脚本内容
// items: [{ from, fromName, fromAmount, to, toName, toAmount }]
// from/to: 'gold'|'gamegold'|自定义变量
// 货币指令映射（GOM/LF 系）：金币走通用 CHECK/TAKE/GIVE，其余走专用指令
const CURRENCY_CMDS = {
  gold:        { check: n => 'CHECKGOLD ' + n,          take: n => 'TAKE 金币 ' + n,      give: n => 'GIVE 金币 ' + n,      name: '金币',   var: '<$GOLDCOUNT>', ge: true },
  gamegold:    { check: n => 'CHECKGameGold ' + n,      take: n => 'GameGold - ' + n,     give: n => 'GameGold + ' + n,     name: '元宝',   var: '<$GameGold>' },
  gamediamond: { check: n => 'CHECKGameDiamond ' + n,   take: n => 'GameDiamond - ' + n,  give: n => 'GameDiamond + ' + n,  name: '金刚石', var: '<$GameDiamond>' },
  gameglory:   { check: n => 'CHECKGameGlory ' + n,     take: n => 'GameGlory - ' + n,    give: n => 'GameGlory + ' + n,    name: '荣誉',   var: '<$GameGlory>' },
  creditpoint: { check: n => 'CHECKCreditPoint ' + n,   take: n => 'CreditPoint - ' + n,  give: n => 'CreditPoint + ' + n,  name: '声望',   var: '<$CreditPoint>' },
  gamepoint:   { check: n => 'CHECKGamePoint ' + n,     take: n => 'GamePoint - ' + n,    give: n => 'GamePoint + ' + n,    name: '充值点', var: '<$GamePoint>' },
  gamegird:    { check: n => 'CHECKGameGird ' + n,      take: n => 'GameGird - ' + n,     give: n => 'GameGird + ' + n,     name: '灵符',   var: '<$GameGird>' },
  diy:         { varOnly: true, check: v => n => 'CHECK ' + v + ' ' + n, take: v => n => 'DEC ' + v + ' ' + n, give: v => n => 'INC ' + v + ' ' + n, name: '自定义' }
};// 取货币命令（key 支持内置或自定义指令名）
function curCmd(key) {
  if (CURRENCY_CMDS[key]) return CURRENCY_CMDS[key];
  // 未知 key：视为自定义货币名（直接用 CHECK/TAKE/GIVE + 名称）
  const name = key;
  return { check: n => 'CHECK ' + name + ' ' + n, take: n => 'TAKE ' + name + ' ' + n, give: n => 'GIVE ' + name + ' ' + n, name };
}

function genExchangeScript(items, count) {
  // 对齐真实端原版（货币兑换_QQ群835162076-3.txt）：
  //   [@MAIN] 直接 #SAY 菜单（<500金币兑换10元宝/@兑换N>）+ 货币概况
  //   每段双 IF：不足 → MESSAGEBOX 当前没有 + BREAK；足够 → 扣除/给予/MESSAGEBOX 成功 + GOTO @MAIN
  const times = [];
  for (let k = 0; k < (count || 1); k++) times.push(Math.pow(10, k + 1)); // 还原蜗牛：count=N → N 档 ×10¹..×10ᴺ（count=1 → ×10，count=2 → ×10+×100）
  const lines = [';' + EXCHANGE_NPC_NAME + ' 自动生成', '[@MAIN]', '#IF', '#ACT', '#SAY'];
  // 货币概况行（去重出现过的货币）
  const curVars = [];
  for (const it of items) {
    const c = curCmd(it.from);
    if (c.var && !curVars.some(x => x.name === c.name)) curVars.push(c);
  }
  if (curVars.length) {
    const parts = curVars.map(c => '<' + c.name + '：' + c.var + '/scolor=215>');
    lines.push('<> <您当前的货币概况：/scolor=215> ' + parts.join('  ' + String.fromCharCode(92) + ' '));
    lines.push('<>' + String.fromCharCode(92));
  }
  // 菜单项
  let seg = 0;
  const segs = [];
  for (const it of items) {
    for (const t of times) {
      seg++;
      segs.push({ it, t, seg });
      const fAmt = Math.round((it.fromAmount || 1) * t);
      const tAmt = Math.round((it.toAmount || 1) * t);
      const fName = (it.fromName || curCmd(it.from).name).split('|')[0];
      const tName = (it.toName || curCmd(it.to).name).split('|')[0];
      lines.push('<> <' + fAmt + fName + '兑换' + tAmt + tName + '/@兑换' + seg + '> ' + String.fromCharCode(92));
    }
  }
  lines.push('<>' + String.fromCharCode(92));
  // 兑换段（双 IF）
  for (const { it, t, seg } of segs) {
    const from = curCmd(it.from);
    const to = curCmd(it.to);
    const fAmt = Math.round((it.fromAmount || 1) * t);
    const tAmt = Math.round((it.toAmount || 1) * t);
    const fVar = it.fromName && it.fromName.includes('|') ? it.fromName.split('|')[1].trim() : it.fromName;
    const tVar = it.toName && it.toName.includes('|') ? it.toName.split('|')[1].trim() : it.toName;
    const fName = (it.fromName || from.name).split('|')[0];
    const tName = (it.toName || to.name).split('|')[0];
    lines.push('[@兑换' + seg + ']');
    const isGe = from.ge || from.varOnly; // 金币/自定义变量：指令本身检查≥（无比较符）
    if (isGe) {
      lines.push('#IF');
      lines.push(from.varOnly ? from.check(fVar)(fAmt) : from.check(fAmt));
      lines.push('#ACT');
      lines.push(from.varOnly ? from.take(fVar)(fAmt) : from.take(fAmt));
      lines.push(to.varOnly ? to.give(tVar)(tAmt) : to.give(tAmt));
      lines.push('MESSAGEBOX 尊敬的【<$USERNAME>】玩家：成功兑换了' + tAmt + tName);
      lines.push('GOTO @MAIN');
      lines.push('BREAK');
      lines.push('#ELSEACT');
      lines.push('MESSAGEBOX 当前没有' + fAmt + fName);
      lines.push('BREAK');
    } else {
      lines.push('#IF');
      lines.push(from.varOnly ? from.check(fVar)('< ' + fAmt) : from.check('< ' + fAmt));
      lines.push('#ACT');
      lines.push('MESSAGEBOX 当前没有' + fAmt + fName);
      lines.push('BREAK');
      lines.push('#IF');
      lines.push(from.varOnly ? from.check(fVar)('> ' + (fAmt - 1)) : from.check('> ' + (fAmt - 1)));
      lines.push('#ACT');
      lines.push(from.varOnly ? from.take(fVar)(fAmt) : from.take(fAmt));
      lines.push(to.varOnly ? to.give(tVar)(tAmt) : to.give(tAmt));
      lines.push('MESSAGEBOX 尊敬的【<$USERNAME>】玩家：成功兑换了' + tAmt + tName);
      lines.push('GOTO @MAIN');
      lines.push('BREAK');
    }
    lines.push('');
  }
  return lines;
}// 生成兑换 NPC：返回 { ok, merchant, script, scriptFile }
function addExchangeNpc(engineRoot, opts) {
  // opts: { mapCode, x, y, npcName, items: [{from,fromName,fromAmount,to,toName,toAmount}], count, generateOnly }
const mf = merchantFile(engineRoot);
  if (!fs.existsSync(mf)) return { ok: false, msg: '未找到 MerChant.txt（期望 Mir200\\Envir\\MerChant.txt）' };
  if (!opts.mapCode || !opts.x || !opts.y || !opts.npcName) return { ok: false, msg: '缺少必填字段（地图/坐标/NPC名）' };
  if (!opts.items || !opts.items.length) return { ok: false, msg: '缺少兑换项' };
  // 1. MerChant.txt 更新
  const content = decodeBuf(fs.readFileSync(mf));
  const lines = content.split(/\r?\n/);
  let updated = false;
  for (let l = 0; l < lines.length; l++) {
    const t = lines[l].trim();
    if (t.startsWith(EXCHANGE_NPC_NAME)) {
      const cols = t.split(/\s+/);
      // F-P1-7：NPC 名 + 地图码双条件（同 NPC 换地图不覆盖旧地图行，避免旧脚本残留）
      if (cols[1] === opts.mapCode) {
        lines[l] = EXCHANGE_NPC_NAME + ' ' + opts.mapCode + ' ' + opts.x + ' ' + opts.y + ' ' + opts.npcName + '\t0\t8\t0';
        updated = true;
        break;
      }
    }
  }
  if (!updated) {
    lines.push(EXCHANGE_NPC_NAME + ' ' + opts.mapCode + ' ' + opts.x + ' ' + opts.y + ' ' + opts.npcName + '\t0\t8\t0');
  }
  writeTextFile(mf, lines.join('\r\n'));
  // 2. Market_Def 脚本
  const scriptFile = path.join(engineRoot, 'Mir200', 'Envir', 'Market_Def', EXCHANGE_NPC_NAME + '-' + opts.mapCode + '.txt');
  fs.mkdirSync(path.dirname(scriptFile), { recursive: true });
  const script = genExchangeScript(opts.items, opts.count);
  if (opts.generateOnly) {
    // 还原自虾米"只生成主脚本内容不写入文件不添加 NPC 配置"
    return { ok: true, generateOnly: true, script: script.join('\r\n'), scriptLines: script.length, msg: '已生成兑换脚本内容（未写入文件，共 ' + script.length + ' 行）' };
  }
  writeTextFile(scriptFile, script.join('\r\n'));
  return { ok: true, merchant: mf, scriptFile, npc: EXCHANGE_NPC_NAME, updated, scriptLines: script.length };
}


// ==================== 端口扫描与占用检测（还原自 index-23c7e9a1） ====================
// 扫描服务端各配置文件（!Setup.txt / Config.ini / LoginGate / SelGate / RunGate / DBServer）的端口键，
// 检测本机占用情况

const PORT_SCAN_FILES = [
  { dir: '', file: 'Config.ini', label: '根配置' },
  { dir: 'Mir200', file: '!Setup.txt', label: 'M2 !Setup' },
  { dir: 'LoginGate', file: 'Config.ini', label: 'LoginGate' },
  { dir: 'SelGate', file: 'Config.ini', label: 'SelGate' },
  { dir: 'RunGate', file: 'Config.ini', label: 'RunGate' },
  { dir: 'DBServer', file: 'Config.ini', label: 'DBServer' },
];

// 扫描端口：返回 [{ file, label, key, port }]
function scanPorts(engineRoot) {
  const found = [];
  const seen = new Set();
  for (const s of PORT_SCAN_FILES) {
    const f = path.join(engineRoot, s.dir, s.file);
    if (!fs.existsSync(f)) continue;
    let content;
    try { content = decodeBuf(fs.readFileSync(f)); } catch (e) { continue; }
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^([A-Za-z0-9_]*[Pp]ort[A-Za-z0-9_]*)\s*=\s*(\d+)/);
      if (m && /port\d*$/i.test(m[1])) {
        const port = parseInt(m[2], 10);
        if (port > 0 && port < 65536) {
          const key = s.label + '/' + m[1];
          if (!seen.has(key)) {
            seen.add(key);
            found.push({ file: s.dir ? s.dir + '/' + s.file : s.file, label: s.label, key: m[1], port });
          }
        }
      }
    }
  }
  // 按端口分组统计（同端口多处配置）；DBPort_MulThread 与同文件 DBPort1/DBPort 同端口豁免
  const byPort = {};
  for (const x of found) {
    let exempt = false;
    if (x.key === 'DBPort_MulThread') {
      exempt = found.some(y => y.file === x.file && (y.key === 'DBPort' || y.key === 'DBPort1') && y.port === x.port);
    }
    const item = exempt ? Object.assign({}, x, { exempt: true }) : x;
    (byPort[item.port] = byPort[item.port] || []).push(item);
  }
  return { ports: found, byPort, count: found.length };
}

// ---- 端口配置管理（三家融合：读取/修改全服务端口 + 冲突检测 + 一键替换）----
const PORT_CFG_FILES = [
  { dir: '', file: 'Config.ini', label: '根配置' },
  { dir: 'Mir200', file: '!setup.txt', label: 'M2 !Setup' },
  { dir: 'LoginGate', file: 'Config.ini', label: 'LoginGate' },
  { dir: 'SelGate', file: 'Config.ini', label: 'SelGate' },
  { dir: 'RunGate', file: 'Config.ini', label: 'RunGate' },
  { dir: 'DBServer', file: 'dbsrc.ini', label: 'DBServer' },
  { dir: 'DBServer', file: 'Config.ini', label: 'DBServer' },
  { dir: 'LogServer', file: 'Config.ini', label: 'LogServer' },
];
// 读取全服务端口配置：返回 { files: [{file,label,entries:[{key,port,line}]}], all:[...] }
function readPortConfig(engineRoot) {
  const files = [];
  const seen = new Set();
  for (const s of PORT_CFG_FILES) {
    const f = path.join(engineRoot, s.dir, s.file);
    if (!fs.existsSync(f)) continue;
    let content;
    try { content = decodeBuf(fs.readFileSync(f)); } catch (e) { continue; }
    const lines = content.split(/\r?\n/);
    const entries = [];
    lines.forEach((line, idx) => {
      // 严格匹配大写 Port 键，排除 Support 类误匹配（TZSupportRenameItem）
      const m = line.match(/^([A-Za-z0-9_]*Port[A-Za-z0-9_]*)\s*=\s*(\d+)/);
      if (m && !/support/i.test(m[1])) {
        const port = parseInt(m[2], 10);
        if (port > 0 && port < 65536) {
          entries.push({ key: m[1], port, line: idx });
        }
      }
    });
    if (entries.length) {
      // DBPort_MulThread 与 DBPort1/DBPort 同端口属正常设计（多线程 DB 端口=第一 DB 端口），标记豁免
      const dbMain = entries.find(e => e.key === 'DBPort' || e.key === 'DBPort1');
      if (dbMain) {
        for (const e of entries) {
          if (e.key === 'DBPort_MulThread' && e.port === dbMain.port) e.exempt = true;
        }
      }
      files.push({ file: s.dir ? s.dir + '/' + s.file : s.file, label: s.label, entries, content });
    }
  }
  const all = [];
  for (const f of files) for (const e of f.entries) all.push({ file: f.file, label: f.label, key: e.key, port: e.port, exempt: !!e.exempt });
  return { files, all, count: all.length };
}
// 修改单个端口键：返回 { ok, msg }
// 端口写操作公共备份（事故教训 2026-08-08：改前必须留底，防止误改活动组断服）
function portBackupDir(engineRoot) {
  const d = path.join(engineRoot, 'port-backup', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
  fs.mkdirSync(d, { recursive: true });
  return d;
}
function backupPortFile(engineRoot, relFile) {
  const f = path.join(engineRoot, relFile);
  if (!fs.existsSync(f)) return null;
  const bak = path.join(portBackupDir(engineRoot), relFile.replace(/[\\/:]/g, '_'));
  fs.copyFileSync(f, bak);
  return bak;
}
// 写单个端口键：写前自动备份到 port-backup\时间戳\，返回备份路径（供恢复）
function writePortConfig(engineRoot, relFile, key, newPort) {
  const f = path.join(engineRoot, relFile);
  if (!fs.existsSync(f)) return { ok: false, msg: '文件不存在: ' + relFile };
  let content;
  try { content = decodeBuf(fs.readFileSync(f)); } catch (e) { return { ok: false, msg: '读取失败: ' + e.message }; }
  const re = new RegExp('^(' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*=\\s*)\\d+', 'm');
  if (!re.test(content)) return { ok: false, msg: '未找到键: ' + key };
  const updated = content.replace(re, '$1' + newPort);
  const bak = backupPortFile(engineRoot, relFile);
  try {
    writeTextFile(f, updated);
    return { ok: true, msg: '已修改 ' + relFile + ' 的 ' + key + ' = ' + newPort + '（备份: ' + (bak || '无') + '）', backup: bak };
  } catch (e) { return { ok: false, msg: '写入失败: ' + e.message }; }
}
// 一键替换：把所有配置文件里的旧端口替换为新端口（三家融合）
function replacePorts(engineRoot, fromPort, toPort) {
  if (!(fromPort > 0) || !(toPort > 0) || fromPort === toPort) return { ok: false, msg: '参数无效' };
  const files = [];
  for (const s of PORT_CFG_FILES) {
    const f = path.join(engineRoot, s.dir, s.file);
    if (!fs.existsSync(f)) continue;
    let content;
    try { content = decodeBuf(fs.readFileSync(f)); } catch (e) { continue; }
    const re = new RegExp('(=\\s*)' + fromPort + '(?![0-9])', 'g');
    if (re.test(content)) {
      const updated = content.replace(re, '$1' + toPort);
      const rel = s.dir ? s.dir + '/' + s.file : s.file;
      backupPortFile(engineRoot, rel); // 写前备份（事故教训）
      try { writeTextFile(f, updated); files.push({ file: rel, count: (content.match(re) || []).length }); }
      catch (e) { /* 跳过写失败 */ }
    }
  }
  return { ok: files.length > 0, msg: files.length ? '已替换 ' + files.length + ' 个文件: ' + files.map(f => f.file + '×' + f.count).join(', ') : '未找到使用端口 ' + fromPort + ' 的配置' };
}

// 检测单个端口是否被占用
function checkPortInUse(port, host, timeout) {
  const net = require('net');
  return new Promise(resolve => {
    const s = net.createConnection({ port, host: host || '127.0.0.1', timeout: timeout || 600 });
    let done = false;
    const fin = (v) => { if (!done) { done = true; try { s.destroy(); } catch (e) {} resolve(v); } };
    s.on('connect', () => fin(true));
    s.on('error', () => fin(false));
    s.on('timeout', () => fin(false));
  });
}

// 检测全部端口占用：返回 [{ port, inUse, keys: [..] }]
async function checkPorts(engineRoot, host) {
  const { byPort } = scanPorts(engineRoot);
  const list = Object.keys(byPort).map(p => parseInt(p, 10)).sort((a, b) => a - b);
  const results = [];
  for (const port of list) {
    const inUse = await checkPortInUse(port, host);
    results.push({ port, inUse, keys: byPort[port] });
  }
  return { results, total: results.length, inUseCount: results.filter(r => r.inUse).length };
}


// ==================== 脚本注入（还原自 index-ec0ab199） ====================
// 注入项：{ name, target: 'QF'|'QM'|文件相对路径, content, mode: 'append'|'overwrite'|'cancel', varReplace: bool }
// 防重复：内容前后加标记
// 变量占用替换：把注入内容中与目标文件冲突的变量（N$/S$/U/G$/I$ 等）替换为未占用变量

const INJECT_MARK = ';@@yge-inject:';
const INJECT_MARK_END = ';@@yge-inject-end:';

// 变量提取（传奇脚本变量）
const VAR_PATTERNS = [
  /N\$[A-Za-z0-9_\u4e00-\u9fff]+/g,   // 数字变量 N$xxx
  /S\$[A-Za-z0-9_\u4e00-\u9fff]+/g,   // 字符串变量 S$xxx
  /G\$[A-Za-z0-9_\u4e00-\u9fff]+/g,   // 全局变量 G$xxx
  /I\$[A-Za-z0-9_\u4e00-\u9fff]+/g,   // 整型变量 I$xxx
  /A\$[A-Za-z0-9_\u4e00-\u9fff]+/g,   // 数组 A$xxx
  /T\$[A-Za-z0-9_\u4e00-\u9fff]+/g,   // 临时 T$xxx
  /D\$[A-Za-z0-9_\u4e00-\u9fff]+/g,   // 日期 D$xxx
  /M\$[A-Za-z0-9_\u4e00-\u9fff]+/g,   // 人物 M$xxx
  /P\$[A-Za-z0-9_\u4e00-\u9fff]+/g,   // 个人 P$xxx
  /U\d{1,3}/g,           // 个人变量 U1-U499（蜗牛 index-ec0ab199：U max=499）
  /Q\d{1,3}/g,           // Q1-Q999
];

function extractVars(text) {
  const set = new Set();
  for (const re of VAR_PATTERNS) {
    let m;
    while ((m = re.exec(text))) set.add(m[0]);
  }
  return [...set];
}

// 变量占用替换：注入内容中与 targetText 冲突的变量换成新名
function replaceOccupyVars(injectContent, targetText) {
  const targetVars = new Set(extractVars(targetText));
  // R3-5：按长度降序处理（U1 在 U10 之前替换会把 U10 污染成 U1010）
  const injectVars = extractVars(injectContent).sort((a, b) => b.length - a.length);
  let out = injectContent;
  let used = new Set(targetVars);
  for (const v of injectVars) {
    if (used.has(v)) {
      // 生成新名：同前缀 + 递增序号
      const m = v.match(/^([A-Za-z$]+)(\d+)$/) || v.match(/^([A-Za-z]+\$)([A-Za-z0-9_]+)$/);
      let newV;
      if (m) {
        let n = 1;
        // 数字分支也递增（U11 冲突时 U111 若也在目标里，+100 固定值会死循环）
        do { newV = m[1] + (m[2].match(/^\d+$/) ? (parseInt(m[2], 10) + 100 + n) : (m[2] + '_' + n)); n++; }
        while (used.has(newV));
      } else {
        let n = 1;
        do { newV = v + '_' + n; n++; } while (used.has(newV));
      }
      // 替换所有出现（含 <$STR()> 包裹）；R3-5：带 (?!\d) 边界防 U1 匹配 U10/U100；用函数替换避免 $ 特殊含义
      out = out.replace(new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?!\\d)', 'g'), () => newV);
      used.add(newV);
    }
  }
  return out;
}

// 解析注入目标文件
function injectTargetFile(engineRoot, target) {
  const t = String(target || '').toLowerCase();
  if (t === 'qf') return path.join(engineRoot, 'Mir200', 'Envir', 'Market_Def', 'QFunction-0.txt');
  if (t === 'qm') return path.join(engineRoot, 'Mir200', 'Envir', 'MapQuest_Def', 'QManage.txt');
  if (t === 'effectimagelist') return path.join(engineRoot, 'Mir200', 'Envir', 'EffectImageList.txt');
  if (t === 'groupitemlist') return path.join(engineRoot, 'Mir200', 'Envir', 'GroupItemList.txt');
  if (t === 'itemrulelist') return path.join(engineRoot, 'Mir200', 'Envir', 'ItemRuleList.txt');
  if (t === 'itemdesclist') return path.join(engineRoot, 'Mir200', 'Envir', 'ItemDescList.txt');
  if (target && /(\/|\\)/.test(target)) {
    const resolved = path.resolve(engineRoot, 'Mir200', 'Envir', target);
    const envir = path.resolve(engineRoot, 'Mir200', 'Envir') + path.sep;
    if (resolved.startsWith(envir)) return resolved;
    return null; // 越界拒绝
  }
  return null;
}

// 删除注入块
function removeInjectedBlock(content, name) {
  const re = new RegExp(INJECT_MARK + name + '[\\s\\S]*?' + INJECT_MARK_END + name, 'g');
  return content.replace(re, '');
}

// 检查是否已注入
function isInjected(engineRoot, target, name) {
  const file = injectTargetFile(engineRoot, target);
  if (!file || !fs.existsSync(file)) return false;
  const content = decodeBuf(fs.readFileSync(file));
  return content.includes(INJECT_MARK + name);
}

// 执行注入
// item: { name, target, content, mode, varReplace }
function injectScript(engineRoot, item) {
  const file = injectTargetFile(engineRoot, item.target);
  if (!file) return { ok: false, msg: '无效的注入目标: ' + item.target };
  if (!item.name) return { ok: false, msg: '未填写注入名称' };
  if (!item.content || !item.content.trim()) return { ok: false, msg: '注入内容为空' };
  if (!fs.existsSync(file)) return { ok: false, msg: '目标文件不存在: ' + file };
  let content = decodeBuf(fs.readFileSync(file));
  // 列表类目标（素材/分组/规则/描述）：追加行 + 防重复（逐行已存在跳过）；不解析段、不写注释标记（引擎按行读素材/配置，注释行可能被当素材或读取失败）
  const listFiles = new Set(['effectimagelist.txt', 'groupitemlist.txt', 'itemrulelist.txt', 'itemdesclist.txt']);
  if (listFiles.has(String(path.basename(file)).toLowerCase())) {
    const lines = String(item.content).split(/\r?\n/).map(l => l.replace(/\r$/, '')).filter(l => l.trim() !== '');
    if (!lines.length) return { ok: false, msg: '内容为空' };
    const existing = new Set(content.split(/\r?\n/).map(l => l.trim()));
    const addLines = lines.filter(l => !existing.has(l.trim()));
    if (!addLines.length) return { ok: true, already: true, added: 0, skipped: lines.length, file, msg: '「' + item.name + '」内容已全部存在，无需追加（防重复）' };
    fs.writeFileSync(file, encodeStr(content.replace(/[\r\n]+$/, '') + '\r\n' + addLines.join('\r\n') + '\r\n', 'gbk'));  // 列表文件必须 GBK（writeTextFile 对纯 ASCII 原文件误判 utf8 会写坏中文行）
    return { ok: true, already: false, added: addLines.length, skipped: lines.length - addLines.length, file, msg: '追加「' + item.name + '」' + addLines.length + ' 行（跳过已存在 ' + (lines.length - addLines.length) + '）→ ' + file };
  }
  const already = isInjected(engineRoot, item.target, item.name);
  if (already && item.mode !== 'overwrite') return { ok: false, already: true, msg: '检测到已注入过「' + item.name + '」（' + (item.mode === 'cancel' ? '已按模式「取消」停止' : 'append 模式防重复，如需覆盖请用 overwrite 模式') + '）', file };
  if (already && item.mode === 'overwrite') content = removeInjectedBlock(content, item.name);
  // 变量占用替换（注入内容整体，基于目标文件现状）
  let injectContent = String(item.content);
  if (item.varReplace) injectContent = replaceOccupyVars(injectContent, content);
  // 解析注入内容为段（[@段名] + 内容）——段级合并（对齐手动注入标准：同名段内容合并进该段末尾，新段追加）
  const segments = [];
  {
    const lines = injectContent.split(/\r?\n/);
    let cur = null;
    for (const line of lines) {
      const m = line.match(/^\[@([^\]]+)\]\s*$/);
      if (m) { cur = { seg: m[1], lines: [] }; segments.push(cur); }
      else if (cur) cur.lines.push(line);
    }
  }
  if (!segments.length) return { ok: false, msg: '注入内容未解析到段（需含 [@段名]）' };
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let merged = 0, appended = 0;
  for (const seg of segments) {
    const segContent = seg.lines.join('\r\n').replace(/\r?\n+$/, '');
    const block = '\r\n' + INJECT_MARK + item.name + '\r\n' + segContent + '\r\n' + INJECT_MARK_END + item.name + '\r\n';  // 结束标记后换行：合并进已有段时避免注释掉后续 [@段名]
    const segRe = new RegExp('\\[@' + esc(seg.seg) + '\\]', 'i');
    const hit = content.match(segRe);
    if (hit) {
      // 已有同名段（大小写不敏感）：段内容插入该段末尾（下一个 [@段名] 之前）
      const segStart = hit.index + hit[0].length;
      const rest = content.slice(segStart);
      const next = rest.match(/^\[@[^\]]+\]\s*$/m);
      const insertAt = next ? segStart + next.index : content.length;
      content = content.slice(0, insertAt) + block + content.slice(insertAt);
      merged++;
    } else {
      // 无此段：文件末尾追加新段（含段头）
      content = content.replace(/[\r\n]+$/, '') + '\r\n' + INJECT_MARK + item.name + '\r\n[@' + seg.seg + ']\r\n' + segContent + '\r\n' + INJECT_MARK_END + item.name + '\r\n';
      appended++;
    }
  }
  writeTextFile(file, content);
  return { ok: true, already, merged, appended, file, mode: item.mode || 'append', name: item.name, msg: (already ? '覆盖' : '注入') + '「' + item.name + '」：段合并 ' + merged + '、新增 ' + appended + ' → ' + file };
}




// ==================== 机器人脚本（还原自 index-342fb122） ====================
// AutoRunRobot.txt：#AutoRun NPC <SEC|MIN|HOUR|RUNONDAY|RUNONWEEK> <值> @<触发段>
// RobotManage.txt：[@段] + #IF/#ACT 脚本逻辑
// 刷怪命令：GMEXECUTE @MOB 怪物 数量（还原自 CHM「GM命令刷怪」）
// 清怪命令：CLEARMAPMON 地图（还原自 CHM「清除指定地图里的怪物」）

function robotDir(engineRoot) {
  return path.join(engineRoot, 'Mir200', 'Envir', 'Robot_def');
}

// 解析 AutoRunRobot.txt + RobotManage.txt
function readRobots(engineRoot) {
  const dir = robotDir(engineRoot);
  if (!fs.existsSync(dir)) return { ok: false, msg: '未找到 Robot_def 目录' };
  const arf = path.join(dir, 'AutoRunRobot.txt');
  const rmf = path.join(dir, 'RobotManage.txt');
  const robots = [];
  let robotManageExists = false;
  let manageContent = '';
  if (fs.existsSync(arf)) {
    const content = decodeBuf(fs.readFileSync(arf));
    manageContent = content;
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^#AutoRun\s+NPC\s+(SEC|MIN|HOUR|RUNONDAY|RUNONWEEK)\s+(\S+)\s+@([^\s]+)/i);
      if (m) {
        robots.push({ line, unit: m[1].toUpperCase(), value: m[2], section: m[3], enabled: !line.trim().startsWith(';') });
      }
    }
  }
  // RobotManage.txt 的 [@段] 列表
  const sections = [];
  if (fs.existsSync(rmf)) {
    const mc = decodeBuf(fs.readFileSync(rmf));
    const ms = mc.split(/\r?\n/);
    for (const l of ms) {
      const sm = l.match(/^\[@([^\]]+)\]/);
      if (sm) sections.push(sm[1]);
    }
    robotManageExists = true;
  }
  return { ok: true, dir, robots, sections, robotManageExists, manageContent };
}

// 新增机器人：opts = { name, interval, unit: 'SEC'|'MIN'|'HOUR', type: 'spawn'|'clear', map, mon, count }
function addRobot(engineRoot, opts) {
  const dir = robotDir(engineRoot);
  if (!fs.existsSync(dir)) return { ok: false, msg: '未找到 Robot_def 目录' };
  if (!opts.name) return { ok: false, msg: '未填写机器人名称' };
  const section = '@' + opts.name;
  // 1. AutoRunRobot.txt 加定时行
  const arf = path.join(dir, 'AutoRunRobot.txt');
  let arContent = fs.existsSync(arf) ? decodeBuf(fs.readFileSync(arf)) : '';
  const runLine = '#AutoRun NPC ' + (opts.unit || 'SEC') + ' ' + (opts.interval != null ? opts.interval : 60) + ' ' + section;
  if (arContent.includes(runLine)) return { ok: false, msg: '该机器人定时行已存在: ' + runLine };
  arContent = arContent.replace(/[\r\n]+$/, '') + '\r\n' + runLine + '\r\n';
  writeTextFile(arf, arContent);
  // 2. RobotManage.txt 加 [@段]
  const rmf = path.join(dir, 'RobotManage.txt');
  let rmContent = fs.existsSync(rmf) ? decodeBuf(fs.readFileSync(rmf)) : '';
  if (rmContent.includes('[' + section + ']')) return { ok: false, msg: 'RobotManage.txt 已存在段 ' + section };
  // 生成段内容
  let block;
  if (opts.type === 'clear') {
    // 清怪：CLEARMAPMON 地图
    const maps = (opts.maps && opts.maps.length) ? opts.maps : (opts.map ? [opts.map] : []);
    if (!maps.length) return { ok: false, msg: '未填写要清怪的地图' };
    const cmds = maps.map(mp => 'CLEARMAPMON ' + mp).join('\r\n');
    block = '[' + section + ']\r\n#IF\r\n#ACT\r\n' + cmds + '\r\nBREAK\r\n';
  } else {
    // 刷怪：GMEXECUTE @MOB 怪物 数量
    if (!opts.map || !opts.mon) return { ok: false, msg: '刷怪需要填写地图和怪物名' };
    const cnt = opts.count != null ? opts.count : 1;
    block = '[' + section + ']\r\n#IF\r\n#ACT\r\nGMEXECUTE @MOB ' + opts.mon + ' ' + cnt + '\r\nBREAK\r\n';
  }
  rmContent = rmContent.replace(/[\r\n]+$/, '') + '\r\n\r\n' + block;
  writeTextFile(rmf, rmContent);
  return { ok: true, section, runLine, autoFile: arf, manageFile: rmf };
}

// 删除机器人：opts = { name }
function delRobot(engineRoot, name) {
  const dir = robotDir(engineRoot);
  const arf = path.join(dir, 'AutoRunRobot.txt');
  const rmf = path.join(dir, 'RobotManage.txt');
  let removed = 0;
  if (fs.existsSync(arf)) {
    let c = decodeBuf(fs.readFileSync(arf));
    const re = new RegExp('^#AutoRun\\s+NPC\\s+\\S+\\s+\\S+\\s+@' + name + '\\s*$', 'gm');
    const before = c;
    c = c.replace(re, ';' + '$&'.replace(/^/, ''));
    removed = (before.match(re) || []).length;
    writeTextFile(arf, c);
  }
  if (fs.existsSync(rmf)) {
    let c = decodeBuf(fs.readFileSync(rmf));
    const re2 = new RegExp('\\[@' + name + '\\][\\s\\S]*?BREAK\\s*\\r?\\n', 'g');
    c = c.replace(re2, '');
    writeTextFile(rmf, c);
  }
  return { ok: true, removed };
}


// ==================== 目录同步（FTP，还原自 index-c1dce787 远程脚本服务器） ====================
// 配置：{ host, port, user, pass, rules: [{ local, remote }] }
// 规则 local 相对引擎根（如 Mir200/Envir），remote 为远程目录（如 /Envir）
// 使用 basic-ftp（纯内置依赖，可内联 SEA 打包）

function syncConfigFile() {
  return path.join(__dirname, 'sync-config.json');
}

function loadSyncConfig() {
  try {
    return JSON.parse(fs.readFileSync(syncConfigFile(), 'utf8'));
  } catch (e) {
    return { host: '', port: 21, user: '', pass: '', rules: [{ local: 'Mir200/Envir', remote: '/Envir' }] };
  }
}

function saveSyncConfig(cfg) {
  fs.writeFileSync(syncConfigFile(), JSON.stringify(cfg, null, 2), 'utf8');
  return { ok: true, file: syncConfigFile() };
}

// 执行 FTP 同步
// opts: { host, port, user, pass, rules: [{local, remote}], deleteRemote: bool }
async function ftpSync(engineRoot, opts, onLog) {
  const log = onLog || ((m) => {});
  const { Client: FtpClient } = global.__basicFtp || require('basic-ftp');
  const client = new FtpClient();
  client.ftp.verbose = false;
  try {
    log('连接 ' + (opts.host || '') + ':' + (opts.port || 21) + ' ...');
    await client.access({
      host: opts.host || '127.0.0.1',
      port: opts.port || 21,
      user: opts.user || 'anonymous',
      password: opts.pass || '',
      secure: false
    });
    log('✓ 登录成功（' + client.ftp.user + '）');
  } catch (e) {
    return { ok: false, msg: 'FTP 连接失败: ' + e.message };
  }
  const stat = { uploaded: 0, skipped: 0, failed: 0, errors: [] };
  const rules = (opts.rules && opts.rules.length) ? opts.rules : [{ local: 'Mir200/Envir', remote: '/Envir' }];
  for (const rule of rules) {
    const localBase = path.join(engineRoot, rule.local);
    const remoteBase = (rule.remote || '/').replace(/\\/g, '/').replace(/\/$/, '');
    if (!fs.existsSync(localBase)) { log('✗ 本地目录不存在: ' + localBase); stat.failed++; continue; }
    log('同步 ' + rule.local + ' → ' + remoteBase);
    try { await client.ensureDir(remoteBase); } catch (e) { log('✗ 远程目录创建失败: ' + remoteBase + '（' + e.message + '）'); stat.failed++; continue; }
    // 递归上传
    const walk = async (localDir, remoteDir) => {
      let entries;
      try { entries = fs.readdirSync(localDir, { withFileTypes: true }); } catch (e) { return; }
      for (const en of entries) {
        const lp = path.join(localDir, en.name);
        const rp = remoteDir + '/' + en.name;
        if (en.isDirectory()) {
          try { await client.ensureDir(rp); } catch (e) { stat.failed++; stat.errors.push(rp + ': ' + e.message); continue; }
          await walk(lp, rp);
        } else if (en.isFile()) {
          // 对比远程大小，相同则跳过
          let skip = false;
          try {
            const lst = await client.list(rp);
            const rm = lst.find(x => x.name === en.name && !x.isDirectory);
            if (rm && rm.size === fs.statSync(lp).size) skip = true;
          } catch (e) { /* 远程不存在则上传 */ }
          if (skip) { stat.skipped++; continue; }
          try {
            await client.uploadFrom(lp, rp);
            stat.uploaded++;
          } catch (e) {
            stat.failed++;
            stat.errors.push(rp + ': ' + e.message);
          }
        }
      }
    };
    try { await walk(localBase, remoteBase); } catch (e) { log('✗ 同步出错: ' + e.message); }
  }
  try { await client.close(); } catch (e) {}
  return { ok: true, ...stat };
}


// ==================== 回收 NPC 脚本生成器（还原自 index-f056a783） ====================
// 生成：MerChant.txt 注册 NPC + Market_Def 回收脚本
// 脚本结构（还原自 renderer 片段）：
//   [@回收] MOV N$元歌回收数量 0 → [@单项回收N] MUL N$元歌回收货币N 数量 价格 → GIVE/INC 货币

// 生成回收脚本
// items: [{ name, price }], currency: { key: 'gold'|'gamegold'|'diy'|'good', name, diyVar }
function genRecycleScript(opts, currency, npcName) {
  // 原版（index-f056a783.js）回收生成器：勾选界面 + 总开关 + 全选/反选 + 每分类回收逻辑
  // opts.cats: [{ name(分类名), tip(提示), color(SCOLOR), names:[物品], extracts:[{key,name,value}] }]
  // opts.sc: 'str'(无素材) | 'this'(版本素材，需 wil/npc/checked/noChecked)
  // opts.col: 每行列数(默认4)  opts.point: 名字占位(默认11)  opts.strBlank: 排版占位(默认2)
  // opts.checks: [总开关, 分类1勾选, 分类2...] 个人标识数组
  const cats = opts.cats || [];
  const sc = opts.sc || 'str';
  const col = opts.col || 4;
  const point = opts.point || 11;
  const strBlank = opts.strBlank || 2;
  const checks = opts.checks || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const wil = opts.wil || 0, npcImg = opts.npc || 0, checked = opts.checked || 1, noChecked = opts.noChecked || 2;
  const P = '元歌'; // 品牌前缀

  // B 函数（原版）：生成勾选图 MOV
  const B = (arr, idx, cfg, isChecked) => {
    arr.push('MOV S$' + P + '回收项' + idx + ' ' + (sc !== 'str'
      ? '<Img:' + (isChecked ? checked : noChecked) + ':' + wil + ':-2:' + (isChecked || sc !== 'wn2' ? '-3' : '-1') + '/@' + P + '回收勾选' + idx + '>'
      : '<' + (isChecked ? '【√】' : '【×】{FCOLOR=22}') + '/@' + P + '回收勾选' + idx + '>'));
  };

  const lines = [];
  lines.push(';该脚本由元歌工具箱生成');
  lines.push('[@' + P + '自动回收]');
  lines.push('{');
  // ---- r：初始化 + 总开关 ----
  lines.push('#IF');
  lines.push('CHECK [' + checks[0] + '] 1');
  lines.push('#ACT');
  lines.push('MOV S$' + P + '总回收开关 <【√】/@' + P + '总回收开关><关闭自动回收/SCOLOR=249>');
  lines.push('#ELSEACT');
  lines.push('MOV S$' + P + '总回收开关 <【×】{FCOLOR=22}/@' + P + '总回收开关><开启自动回收/SCOLOR=250>');
  lines.push('#IF');
  lines.push('#ACT');
  lines.push('MOV N$' + P + '回收名字占位 ' + point);
  lines.push('MOV S$' + P + '回收排版占位');
  lines.push('SetStringBlank S$' + P + '回收排版占位 ' + strBlank);
  lines.push('');
  cats.forEach((e, idx) => {
    const ci = idx + 1;
    const flag = checks[idx + 1];
    lines.push('MOV S$' + P + '回收名称' + ci + ' ' + e.name);
    lines.push('SetStringBlank S$' + P + '回收名称' + ci + ' <$str(N$' + P + '回收名字占位)> 1');
    lines.push('');
  });
  // ---- c：每分类勾选行 ----
  cats.forEach((e, idx) => {
    const ci = idx + 1;
    const flag = checks[idx + 1];
    lines.push('#IF');
    lines.push('CHECK [' + flag + '] 1');
    lines.push('#ACT');
    B(lines, ci, { sc, wil, checked, noChecked }, true);
    lines.push('INC S$' + P + '回收项' + ci + ' {<$str(S$' + P + '回收名称' + ci + ')>|' + (e.tip || '') + '/SCOLOR=' + (e.color || 7) + '}');
    lines.push('#ELSEACT');
    B(lines, ci, { sc, wil, checked, noChecked }, false);
    lines.push('INC S$' + P + '回收项' + ci + ' {<$str(S$' + P + '回收名称' + ci + ')>|' + (e.tip || '') + '/SCOLOR=' + (e.color || 7) + '}');
    lines.push('');
  });
  // ---- d：对话界面 ----
  lines.push('#IF');
  lines.push('#ACT');
  lines.push(';自行设置背景框');
  lines.push(';CloseBigDialogBox');
  lines.push(';OPENMERCHANTBIGDLG ' + wil + ' ' + npcImg + ' 0 4 0 0 1 490 10');
  lines.push('#SAY');
  lines.push('<>' + String.fromCharCode(92));
  lines.push('<>' + String.fromCharCode(92));
  // 每行 col 个：原版是直接 push，每 ci%col===0 加 \ \
  cats.forEach((e, idx) => {
    const ci = idx + 1;
    lines.push('<$STR(S$' + P + '回收排版占位)><$STR(S$' + P + '回收项' + ci + ')>' + (ci % col === 0 ? String.fromCharCode(92) + ' ' + String.fromCharCode(92) : ''));
  });
  lines.push(String.fromCharCode(92) + ' ' + String.fromCharCode(92) + '<   ><$STR(S$' + P + '总回收开关)><     ><一键勾选全部/@' + P + '一键回收全选><     ><一键取消全部/@' + P + '一键回收反选><     ><一键手动回收/@' + P + '一键回收>');
  lines.push('');
  // ---- h：辅助段（勾选切换/总开关/全选/反选） ----
  cats.forEach((e, idx) => {
    const ci = idx + 1;
    const flag = checks[idx + 1];
    lines.push('[@' + P + '回收勾选' + ci + ']');
    lines.push('#IF');
    lines.push('CHECK [' + flag + '] 1');
    lines.push('#ACT');
    lines.push('SET [' + flag + '] 0');
    lines.push('GOTO @' + P + '自动回收');
    lines.push('BREAK');
    lines.push('#ELSEACT');
    lines.push('SET [' + flag + '] 1');
    lines.push('GOTO @' + P + '自动回收');
    lines.push('BREAK');
    lines.push('');
  });
  lines.push('[@' + P + '总回收开关]');
  lines.push('#IF');
  lines.push('CHECK [' + checks[0] + '] 1');
  lines.push('#ACT');
  lines.push('SET [' + checks[0] + '] 0');
  lines.push('GOTO @' + P + '自动回收');
  lines.push('#ELSEACT');
  lines.push('SET [' + checks[0] + '] 1');
  lines.push('GOTO @' + P + '自动回收');
  lines.push('BREAK');
  lines.push('');
  lines.push('[@' + P + '一键回收全选]');
  lines.push('#IF');
  lines.push('#ACT');
  cats.forEach((e, idx) => lines.push('set [' + checks[idx + 1] + '] 1'));
  lines.push('GOTO @' + P + '自动回收');
  lines.push('');
  lines.push('[@' + P + '一键回收反选]');
  lines.push('#IF');
  lines.push('#ACT');
  cats.forEach((e, idx) => lines.push('set [' + checks[idx + 1] + '] 0'));
  lines.push('GOTO @' + P + '自动回收');
  lines.push('');
  // ---- m：每分类回收逻辑（[@元歌一键回收] 段内串联） ----
  lines.push('[@' + P + '一键回收]');
  cats.forEach((e, idx) => {
    const ci = idx + 1;
    const flag = checks[idx + 1];
    const itemStr = (e.names || []).join('|');
    lines.push('#IF');
    lines.push('CHECK [' + flag + '] 1');
    lines.push('#ACT');
    lines.push('TakeBagItem ' + itemStr + ' 40 0 0 0 0 N$' + P + '回收数量 0');
    lines.push('#IF');
    lines.push('LARGE <$STR(N$' + P + '回收数量)> 0 ');
    lines.push('#ACT');
    const gives = [];
    (e.extracts || []).forEach((g, gi) => {
      const a = 'N$' + P + '回收货币' + (gi + 1);
      if (!g.value) return;
      lines.push('MUL ' + a + ' <$STR(N$' + P + '回收数量)> ' + g.value);
      if (g.key === 'gold') lines.push('GIVE 金币 <$STR(' + a + ')>');
      else if (g.key === 'good') lines.push('GIVE ' + g.name + ' <$STR(' + a + ')> ');
      else if (g.key === 'diy') lines.push('INC ' + (g.name || '').split('|')[1] + ' <$STR(' + a + ')> ');
      else lines.push((g.key || '').toUpperCase() + ' + <$STR(' + a + ')>');
      gives.push('[<$STR(' + a + ')>' + (g.name || '').split('|')[0] + ']');
    });
    lines.push('SENDMSG 7 成功回收[<$STR(N$' + P + '回收数量)>]件[' + e.name + ']物品，获得了' + gives.join(''));
    lines.push('MOV N$' + P + '回收数量 0');
    lines.push('');
  });
  lines.push('}');
  return lines;
}
// 生成回收 NPC
// opts: { mapCode, x, y, npcName, currency: {key,name,diyVar}, items: [{name, price}] }
function addRecycleNpc(engineRoot, opts) {
  const mf = merchantFile(engineRoot);
  if (!fs.existsSync(mf)) return { ok: false, msg: '未找到 MerChant.txt（期望 Mir200\\Envir\\MerChant.txt）' };
  if (!opts.mapCode || !opts.x || !opts.y || !opts.npcName) return { ok: false, msg: '缺少必填字段（地图/坐标/NPC名）' };
  if (!opts.cats || !opts.cats.length) return { ok: false, msg: '缺少回收分类' };
  const npc = opts.npcName;
  // 0. 分配个人标识（从脚本中找空闲号段）
  const checks = allocFlags(engineRoot, opts.cats.length + 1);
  opts.checks = checks;
  // 1. MerChant.txt 注册
  const content = decodeBuf(fs.readFileSync(mf));
  const lines = content.split(/\r?\n/);
  let updated = false;
  for (let l = 0; l < lines.length; l++) {
    const t = lines[l].trim();
    if (t.startsWith(npc + ' ')) {
      const cols = t.split(/\s+/);
      // F-P1-7：NPC 名 + 地图码双条件（换地图不覆盖旧地图行）
      if (cols[1] === opts.mapCode) {
        lines[l] = npc + ' ' + opts.mapCode + ' ' + opts.x + ' ' + opts.y + ' ' + npc + '\t0\t8\t0';
        updated = true;
        break;
      }
    }
  }
  if (!updated) lines.push(npc + ' ' + opts.mapCode + ' ' + opts.x + ' ' + opts.y + ' ' + npc + '\t0\t8\t0');
  writeTextFile(mf, lines.join('\r\n'));
  // 2. Market_Def 脚本
  const scriptFile = path.join(engineRoot, 'Mir200', 'Envir', 'Market_Def', npc + '-' + opts.mapCode + '.txt');
  fs.mkdirSync(path.dirname(scriptFile), { recursive: true });
  const script = genRecycleScript(opts, opts.currency || { key: 'gold', name: '金币' }, npc);
  writeTextFile(scriptFile, script.join('\r\n'));
  return { ok: true, merchant: mf, scriptFile, npc, updated, scriptLines: script.length, script: script.join('\r\n'), checks };
}

// 分配空闲个人标识：扫描 Envir 脚本里已用的 [N] 标识，返回从 0 起空闲的连续 n 个
function allocFlags(engineRoot, n) {
  const used = new Set();
  const envir = path.join(engineRoot, 'Mir200', 'Envir');
  if (fs.existsSync(envir)) {
    const files = listAllFiles(envir, ['.txt']);
    for (const f of files) {
      try {
        const c = decodeBuf(fs.readFileSync(f));
        const re = /\[\s*(\d{1,3})\s*\]/g;
        let m;
        while ((m = re.exec(c))) used.add(parseInt(m[1], 10));
      } catch (e) { /* 忽略读失败 */ }
    }
  }
  const res = [];
  let cur = 0;
  while (res.length < n) {
    if (!used.has(cur)) res.push(cur);
    cur++;
    if (cur > 999) { res.push(res.length); break; }
  }
  return res;
}

// 列出目录下所有指定扩展名文件
function listAllFiles(dir, exts) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...listAllFiles(p, exts));
    else if (exts.some(x => f.toLowerCase().endsWith(x))) out.push(p);
  }
  return out;
}
// 分配空闲个人标识：扫描 Envir 脚本里已用的 [N] 标识，返回从 0 起空闲的连续 n 个
function allocFlags(engineRoot, n) {
  const used = new Set();
  const envir = path.join(engineRoot, 'Mir200', 'Envir');
  if (fs.existsSync(envir)) {
    const files = listAllFiles(envir, ['.txt']);
    for (const f of files) {
      try {
        const c = decodeBuf(fs.readFileSync(f));
        const re = /\[\s*(\d{1,3})\s*\]/g;
        let m;
        while ((m = re.exec(c))) used.add(parseInt(m[1], 10));
      } catch (e) { /* 忽略读失败 */ }
    }
  }
  const res = [];
  let cur = 0;
  while (res.length < n) {
    if (!used.has(cur)) res.push(cur);
    cur++;
    if (cur > 999) { res.push(res.length); break; }
  }
  return res;
}

// 列出目录下所有指定扩展名文件
function listAllFiles(dir, exts) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...listAllFiles(p, exts));
    else if (exts.some(x => f.toLowerCase().endsWith(x))) out.push(p);
  }
  return out;
}
// 分配空闲个人标识：扫描 Envir 脚本里已用的 [N] 标识，返回从 0 起空闲的连续 n 个
function allocFlags(engineRoot, n) {
  const used = new Set();
  const envir = path.join(engineRoot, 'Mir200', 'Envir');
  if (fs.existsSync(envir)) {
    const files = listAllFiles(envir, ['.txt']);
    for (const f of files) {
      try {
        const c = decodeBuf(fs.readFileSync(f));
        const re = /\[\s*(\d{1,3})\s*\]/g;
        let m;
        while ((m = re.exec(c))) used.add(parseInt(m[1], 10));
      } catch (e) { /* 忽略读失败 */ }
    }
  }
  const res = [];
  let cur = 0;
  while (res.length < n) {
    if (!used.has(cur)) res.push(cur);
    cur++;
    if (cur > 999) { res.push(res.length); break; }
  }
  return res;
}

// 列出目录下所有指定扩展名文件
function listAllFiles(dir, exts) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...listAllFiles(p, exts));
    else if (exts.some(x => f.toLowerCase().endsWith(x))) out.push(p);
  }
  return out;
}

// ==================== 存销系统（还原自 index-c1dce787） ====================
// 把服务端关键数据（物品/爆率/刷怪）抽取打包成可分发数据包
// 表单（还原）：path生成路径、name数据目录名、处理爆率格式(new/old)、新爆率分组数、用户编号(数字/字母/数字+字母)、版本引擎
// 生成阶段（还原）：物品数据→掉落数据→刷新地图数据→存储数据生成完毕→搞定了，可以放心给别人了

// 用户编号生成器（还原自"玩家多，请用数字+字母防止重复编号"）
function genUserId(type, index) {
  if (type === '字母') {
    // 26 进制字母编号：A, B, ..., Z, AA...
    let s = '';
    let n = index + 1;
    while (n > 0) {
      n--;
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26);
    }
    return s;
  }
  if (type === '数字+字母') {
    // 数字+字母：1A, 1B... 9Z, 10A...
    const letters = genUserId('字母', index % 26);
    return Math.floor(index / 26) + 1 + letters;
  }
  return String(index + 1); // 数字
}

// 新爆率格式分组（还原自"新爆率分组 N 个/组"）
// items: [{...}]，按组大小分组
function groupItems(items, groupSize) {
  const size = groupSize > 0 ? groupSize : 100;
  const groups = [];
  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size));
  }
  return groups;
}

// 生成存销数据包
// opts: { outDir, name, format: 'new'|'old', groupSize, userIdType, engine }
// 存销定时器占用检查（还原自虾米 _choose_unused_store_timer_id：读 QManage 找未用定时器 id）
function salesTimers(engineRoot) {
  const qm = findQManage(engineRoot);
  if (!qm) return { ok: false, msg: '未找到 QManage.txt' };
  const content = decodeBuf(fs.readFileSync(qm));
  const used = new Set();
  for (const m of content.matchAll(/SETONTIMER\s+(\d+)/gi)) used.add(+m[1]);
  for (const m of content.matchAll(/@OnTimer\s*(\d+)/gi)) used.add(+m[1]);
  let next = 1;
  while (used.has(next)) next++;
  return { ok: true, used: [...used].sort((a, b) => a - b), next, qmanage: qm };
}

// ============ 移植：商店脚本生成（还原自 1.3.6 _StoreGeneratorLite：咕咕鸡通区存储模板 + 全 Envir 定时器扫描）============
// 全 Envir 扫描 SETONTIMER 占用，选空闲定时器（对齐 1.3.6 _choose_unused_store_timer_id：
//   先复用标记块旧 id，再 51 → 52-255 → 1-50；QManage 先剥离自身标记块）
function storeTimerId(engineRoot, opts = {}) {
  const { featureFolder, scriptName } = opts;
  const env = path.join(engineRoot, 'Mir200', 'Envir');
  const qm = path.join(env, 'MapQuest_def', 'QManage.txt');
  const used = new Set();
  const ignoreFiles = new Set();
  try {
    ignoreFiles.add(path.resolve(path.join(env, 'QuestDiary', featureFolder || '', (scriptName || '') + '.txt')));
  } catch (e) { /* 忽略 */ }
  // 先尝试复用标记块旧 id（虾米 _extract_timer_id_from_marked_block）
  let prevId = null;
  if (fs.existsSync(qm)) {
    const qc = decodeBuf(fs.readFileSync(qm));
    const m = qc.match(/;TOOL_STORE_TIMER_START[\s\S]*?@OnTimer\s*(\d+)[\s\S]*?;TOOL_STORE_TIMER_END/i);
    if (m) prevId = +m[1];
  }
  const walk = (d) => {
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!['@backup', 'node_modules', 'port-backup', 'MonItems', 'MapInfo'].includes(e.name)) walk(p); }
      else if (/\.txt$/i.test(e.name)) {
        try {
          if (ignoreFiles.has(path.resolve(p))) continue;
          let c = decodeBuf(fs.readFileSync(p));
          // QManage 先剥离自身标记块（虾米 _strip_marked_block）
          if (path.resolve(p) === path.resolve(qm)) {
            c = c.replace(/;TOOL_STORE_TIMER_START[\s\S]*?;TOOL_STORE_TIMER_END/g, '');
            c = c.replace(/;TOOL_INJECTED_START[\s\S]*?;TOOL_INJECTED_END/g, '');
          }
          for (const mm of c.matchAll(/SETONTIMER\s+(\d+)/gi)) used.add(+mm[1]);
          for (const mm of c.matchAll(/@OnTimer\s*(\d+)/gi)) used.add(+mm[1]);
        } catch (e2) { /* 忽略 */ }
      }
    }
  };
  if (fs.existsSync(env)) walk(env);
  const isFree = (t) => t >= 1 && t <= 255 && !used.has(t);
  if (prevId != null && isFree(prevId)) return prevId;
  if (isFree(51)) return 51;
  for (let i = 52; i <= 255; i++) if (isFree(i)) return i;
  for (let i = 1; i <= 50; i++) if (isFree(i)) return i;
  return 0;
}
// 商店脚本模板加载（SEA 单文件：bundle 注入 global.__STORE_TEMPLATE；否则读文件）
function loadStoreTemplate() {
  if (global.__STORE_TEMPLATE) return global.__STORE_TEMPLATE;
  const f = path.join(__dirname, 'store-template.txt');
  if (fs.existsSync(f)) return decodeBuf(fs.readFileSync(f));
  return '';
}
// 生成商店脚本（还原自 1.3.6 _StoreGeneratorLite._ensure_feature_scripts）
// opts: { featureFolder 功能文件夹, scriptName 脚本名, methodName 方法名, categoryFolder 分类目录,
//         commonFolder 通区目录名(默认通区文件), zoneFolder 区服文件夹(默认 <$SERVERNAME>), storeU U变量(默认 U51),
//         timerId 定时器(默认自动选), interval 定时器间隔(秒,默认 60), teleportCondition 传送条件, outDir }
// 生成商店脚本（还原自 1.3.6 _StoreGeneratorLite：4 文件 + QManage 登录段/定时器块 + QF 掉落检测 + 通区部署）
// opts: { featureFolder 功能文件夹, scriptName 脚本名, methodName 方法名, categoryFolder 分类目录(默认咕咕鸡物品分类),
//         commonFolder 通区目录名(默认通区文件), zoneFolder 区服文件夹(默认 <$SERVERNAME>), storeU U变量(默认 U335 编号槽),
//         timerId 定时器(默认自动选+复用旧 id), interval 定时器间隔(秒,默认 60), teleportCondition 传送条件,
//         btn QR 触发序号(默认 200), rid 资源编号(>0 时自动 -1), qrMethod QF 掉落检测方法名(默认 掉落前检测), outDir }
// 探测服务端区名（Mir200/!setup.txt 的 ServerName=，GBK）——存销通区目录/数据路径写死实际区名（对齐虾米，勿用 <$SERVERNAME> 占位）
function serverZoneName(engineRoot) {
  try {
    const f = path.join(engineRoot, 'Mir200', '!setup.txt');
    if (!fs.existsSync(f)) return '';
    const m = decodeBuf(fs.readFileSync(f)).match(/ServerName\s*=\s*([^\r\n]+)/i);
    return m ? m[1].trim() : '';
  } catch (e) { return ''; }
}

// 存销分类文件生成（还原虾米 _generate_categories_from_db）：读引擎 SQLite 物品库(StdItems 表) → 按分类规则写 22×3 文件
// 分类规则反推自虾米生成结果 + 该端 StdItems：武器5 衣服10,11 头盔15 斗笠16 项链19,21 戒指22(Shape<100),23 生肖22(Shape>=100)
// 手镯24,26 毒符25,51 勋章30 盾牌12 腰带64 军鼓65 宝石63 特殊3,4 时装66,67,68,75,78,79,81 其它其余(含靴子62)
function genCategories(engineRoot, categoryFolder) {
  const cats = ['宝石', '斗笠', '毒符', '盾牌', '过滤', '戒指', '军鼓', '灵玉', '马牌', '衣服', '其它', '生肖', '时装', '手镯', '特殊', '头盔', '武器', '项链', '面巾', '勋章', '腰带', '所有物品'];
  const R = { '武器': [5], '衣服': [10, 11], '头盔': [15], '斗笠': [16], '项链': [19, 21], '手镯': [24, 26], '毒符': [25, 51], '勋章': [30], '盾牌': [12], '腰带': [64], '军鼓': [65], '宝石': [63], '特殊': [3, 4], '时装': [66, 67, 68, 75, 78, 79, 81] };
  // 读 SQLite 物品库（降级链：node:sqlite → spawn 系统 node；GUI Electron 无 node:sqlite 时走 spawn）
  const readStd = (dbPath) => {
    try {
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(dbPath, { readOnly: true });
      const t = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      if (!t.some(x => x.name === 'StdItems')) { db.close(); return null; }
      const r = db.prepare('SELECT Idx, Name, StdMode, Shape FROM StdItems ORDER BY Idx').all();
      db.close();
      return r;
    } catch (e) { /* 当前运行时无 node:sqlite（如 Electron）→ spawn 系统 node */ }
    try {
      const { execFileSync } = require('child_process');
      const nodePath = process.env.YUGE_NODE || 'D:/nodejs/node.exe';
      const script = "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1],{readOnly:true});const t=db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all();if(!t.some(x=>x.name==='StdItems')){console.log('NO');process.exit(0)}const r=db.prepare('SELECT Idx,Name,StdMode,Shape FROM StdItems ORDER BY Idx').all();console.log(JSON.stringify(r));db.close();";
      const out = execFileSync(nodePath, ['-e', script, dbPath], { timeout: 20000, encoding: 'utf8' }).trim();
      if (out && out !== 'NO') return JSON.parse(out);
    } catch (e2) { /* 降级失败 */ }
    return null;
  };
  const dbDir = path.join(engineRoot, 'Mud2', 'DB');
  let rows = null;
  if (fs.existsSync(dbDir)) {
    for (const f of fs.readdirSync(dbDir)) {
      if (!/\.db$/i.test(f)) continue;
      rows = readStd(path.join(dbDir, f));
      if (rows) break;
    }
  }
  if (!rows) return { ok: false, msg: '未找到可读的 SQLite 物品库（Mud2/DB/*.db 含 StdItems 表；GUI 需系统 node 或本机 node.exe）' };
  const out = {};
  for (const c of cats) out[c] = [];
  for (const r of rows) {
    const name = String(r.Name || '').trim();
    if (!name) continue;
    const m = r.StdMode, sh = r.Shape || 0, id = r.Idx;
    let cat = null;
    if (m === 22) cat = sh >= 100 ? '生肖' : '戒指';
    else if (m === 23) cat = '戒指';
    else { for (const [c, modes] of Object.entries(R)) { if (modes.indexOf(m) >= 0) { cat = c; break; } } }
    if (!cat) cat = '其它';
    out[cat].push([id, name]);
    out['所有物品'].push([id, name]);
  }
  const dir = path.join(engineRoot, 'Mir200', 'Envir', 'QuestDiary', categoryFolder);
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  let count = 0;
  for (const c of cats) {
    const items = out[c];
    const lines = items.map(([id, nm]) => id + ':' + nm);
    fs.writeFileSync(path.join(dir, c + '分类.txt'), encodeStr(lines.join('\r\n'), 'gbk'));
    fs.writeFileSync(path.join(dir, c + '名称.txt'), encodeStr('此行禁止删除------自动生成\r\n' + items.map(([, nm]) => nm + 'XM').join('\r\n'), 'gbk'));
    fs.writeFileSync(path.join(dir, c + '显示.txt'), encodeStr('格式为ID:物品名称\r\n' + lines.join('\r\n'), 'gbk'));
    count++;
  }
  return { ok: true, count, total: rows.length, msg: '已生成 ' + count + ' 个分类 × 3 文件（物品库 ' + rows.length + ' 件）' };
}


// 生成通区数据：物品数据（怪物掉落，还原虾米 1153）+ 地图数据（怪物刷新，还原虾米 1150）
// 通区路径 = 引擎根上一级/通区文件夹名/区名（引擎脚本 ..\\..\\..\\..\\ 基准 QuestDiary）
async function genZoneData(engineRoot, commonFolder, zoneFolder) {
  const env = path.join(engineRoot, 'Mir200', 'Envir');
  if (!zoneFolder || /[<>]/.test(zoneFolder)) return { ok: false, msg: '区名无效，跳过通区数据' };
  const zoneDir = path.resolve(engineRoot, '..', commonFolder || '通区文件', zoneFolder);
  // 1. 物品数据（反向索引）：MonItems/<怪物>.txt（新爆率 1/x 物品名）→ 物品 → 掉落它的怪物列表
  // 主脚本 [@加载怪物集合(物品名)] 读 物品数据/<物品名>.txt，内容=怪物名（每行一个，见 商店.txt 2056-2068）
  const itemsSrc = path.join(env, 'MonItems');
  const outItems = path.join(zoneDir, '物品数据');
  let nItems = 0, itemRows = 0, batch = 0;
  const itemToMons = {};
  if (fs.existsSync(itemsSrc)) {
    try { fs.mkdirSync(outItems, { recursive: true }); } catch (e) {}
    for (const f of fs.readdirSync(itemsSrc)) {
      if (!/\.txt$/i.test(f) || /^@/.test(f)) continue;
      const monName = f.replace(/\.txt$/i, '');
      let c = '';
      try { c = decodeBuf(fs.readFileSync(path.join(itemsSrc, f))); } catch (e) { continue; }
      const names = [];
      for (const line of c.split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith(';') || t.startsWith('#') || t === '(' || t === ')') continue;
        let item = null;
        const m = t.match(/^1\/\d+\s+(.+)$/);
        if (m) item = m[1];
        else if (!/^[A-Za-z]/.test(t)) item = t; // 老格式纯物品名行
        if (!item) continue;
        item = item.replace(/\s+\d+$/, '').trim();
        if (item && !names.includes(item)) names.push(item);
      }
      for (const item of names) {
        if (/[<>:"/\\|?*]/.test(item)) continue; // 非法文件名字符跳过
        if (!itemToMons[item]) itemToMons[item] = [];
        if (!itemToMons[item].includes(monName)) itemToMons[item].push(monName);
      }
      if (++batch % 40 === 0) await new Promise(r => setImmediate(r));
    }
  }
  for (const [item, mons] of Object.entries(itemToMons)) {
    try { fs.writeFileSync(path.join(outItems, item + '.txt'), encodeStr(mons.join('\r\n'), 'gbk')); nItems++; itemRows += mons.length; } catch (e) {}
    if (++batch % 40 === 0) await new Promise(r => setImmediate(r));
  }
  // 2. 地图数据：MonGen.txt（地图 x y 名称 范围 数量 时间）→ 按怪物聚合 地图|地图名|数量|时间|X|Y（X/Y 供点击传送）
  const mgFile = path.join(env, 'MonGen.txt');
  const outMaps = path.join(zoneDir, '地图数据');
  // 读 MapInfo 标题（[代码|标题]）——刷新地图显示地图名（方案 A 整段标题，查不到兜底代码）
  const mapTitles = {};
  const mapInfoFile = path.join(env, 'MapInfo.txt');
  if (fs.existsSync(mapInfoFile)) {
    for (const line of decodeBuf(fs.readFileSync(mapInfoFile)).split(/\r?\n/)) {
      // 三种标题格式都支持：[代码|标题]（|）、[代码\t标题]（tab）、[代码 标题]（空格）
      const mm = line.match(/^\[([^\]|\t ]+)[|\t ]+([^\]]+)\]/);
      if (mm) mapTitles[mm[1].trim()] = mm[2].trim();
    }
  }
  let nMaps = 0, mapRows = 0;
  if (fs.existsSync(mgFile)) {
    try { fs.mkdirSync(outMaps, { recursive: true }); } catch (e) {}
    const byMon = {};
    for (const line of decodeBuf(fs.readFileSync(mgFile)).split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith(';')) continue;
      const p = t.split(/\s+/);
      if (p.length < 7 || /NaN|NaN/i.test(t)) continue;
      const mapCode = p[0], monName = p[3], count = p[5] || '0', time = p[6] || '0', mx = p[1] || '0', my = p[2] || '0';
      if (!monName || !mapCode) continue;
      if (!byMon[monName]) byMon[monName] = [];
      // 数据格式：代码|地图名|数量|时间|X|Y（数据5/6=X/Y 供点击传送 @虾米飞走(代码,X,Y)；标题清理 |/tab 避免 ExtractStringEx 拆错位）
      const title = (mapTitles[mapCode] || mapCode).replace(/[|\t\r\n]+/g, ' ').trim().replace(/ +/g, '　');
      byMon[monName].push(mapCode + '|' + title + '|' + count + '|' + time + '|' + mx + '|' + my);
    }
    for (const [mon, rows] of Object.entries(byMon)) {
      try { fs.writeFileSync(path.join(outMaps, mon + '.txt'), encodeStr(rows.join('\r\n'), 'gbk')); nMaps++; mapRows += rows.length; } catch (e) {}
      if (++batch % 40 === 0) await new Promise(r => setImmediate(r));
    }
  }
  return { ok: true, items: nItems, itemRows, maps: nMaps, mapRows, msg: '通区数据：物品数据 ' + nItems + ' 怪(' + itemRows + ' 行)、地图数据 ' + nMaps + ' 怪(' + mapRows + ' 行)' };
}


// MonItems 掉落检测挂钩（还原虾米 1929 b01b_transform_markerless）：#CHILD ... RANDOM 行加 [N<99999,7,@掉落前检测]（N 为未用变量），括号外裸行包成 #CHILD
// 该引擎（Apex/翎风）掉落检测靠 MonItems 新爆率挂钩触发（QF 段不被自动调用），钩子格式：N<99999,7,@段名（N<99999 恒真 + 概率7 + 触发段）
async function hookMonItemsDrops(engineRoot, qrMethod) {
  const mi = path.join(engineRoot, 'Mir200', 'Envir', 'MonItems');
  if (!fs.existsSync(mi)) return { ok: false, msg: 'MonItems 不存在' };
  const method = String(qrMethod || '掉落前检测');
  // 找未用 N 变量（N1-N99，MonItems 里未出现的）
  const used = new Set();
  const files = fs.readdirSync(mi).filter(f => /\.txt$/i.test(f) && !/^@/.test(f));
  for (const f of files) {
    try { for (const m of decodeBuf(fs.readFileSync(path.join(mi, f))).matchAll(/N(\d+)/g)) used.add(+m[1]); } catch (e) {}
  }
  let varN = 1;
  while (used.has(varN) && varN < 999) varN++;
  const hook = 'N' + varN + '<99999,7,@' + method;
  const hookRe = /\[\s*N\d+\s*<\s*99999\s*,\s*7\s*,\s*@[^\[\]]+\s*\]\s*$/i;
  let changed = 0, linesChanged = 0, batch = 0;
  for (const f of files) {
    const p = path.join(mi, f);
    let c = '';
    try { c = decodeBuf(fs.readFileSync(p)); } catch (e) { continue; }
    const lines = c.split(/\r?\n/);
    const out = [];
    let depth = 0, mod = false;
    for (const line of lines) {
      const t = line.trim();
      if (/^\($/.test(t)) depth++;
      else if (/^\)$/.test(t)) depth = Math.max(0, depth - 1);
      if (/^#CHILD\b/i.test(t) && /RANDOM/i.test(t) && !hookRe.test(line) && !t.includes('@' + method)) {
        out.push(line.replace(/\s*$/, ' [' + hook + ']'));
        mod = true; linesChanged++;
      } else if (depth === 0 && !/^#/.test(t) && !/^[;(]/.test(t) && /^\s*\d+\s*\/\s*\d+\s+/.test(line) && !hookRe.test(line)) {
        // 括号外裸行（1/x 物品）→ 包成 #CHILD + hook（对齐虾米 transform_markerless）
        const m = line.match(/^(\s*)(\d+\s*\/\s*\d+)\s+(.+?)\s*$/);
        if (m && !/^@/.test(m[3])) {
          const indent = m[1], ratio = m[2].replace(/\s+/g, ''), item = m[3];
          out.push(indent + '#CHILD ' + ratio + ' RANDOM [' + hook + ']', indent + '(', indent + ' 1/1\t ' + item, indent + ')');
          mod = true; linesChanged++;
        } else out.push(line);
      } else out.push(line);
    }
    if (mod) {
      try { fs.writeFileSync(p, encodeStr(out.join('\r\n'), 'gbk')); changed++; } catch (e) {}
    }
    if (++batch % 40 === 0) await new Promise(r => setImmediate(r));
  }
  return { ok: true, changed, linesChanged, varN, msg: 'MonItems 掉落检测挂钩 ' + changed + ' 文件 / ' + linesChanged + ' 行（变量 N' + varN + '，段 @' + method + '）' };
}
// 移除 MonItems 掉落检测挂钩（还原虾米 1843 remove_store_qr_hooks_from_text：去 [N<99999,7,@段名]）
async function unhookMonItemsDrops(engineRoot, qrMethod) {
  const mi = path.join(engineRoot, 'Mir200', 'Envir', 'MonItems');
  if (!fs.existsSync(mi)) return { ok: true, changed: 0, msg: 'MonItems 无挂钩' };
  const hookRe = /\[\s*N\d+\s*<\s*99999\s*,\s*7\s*,\s*@[^\[\]]+\s*\]\s*$/i;
  let changed = 0, lines = 0, batch = 0;
  for (const f of fs.readdirSync(mi)) {
    if (!/\.txt$/i.test(f) || /^@/.test(f)) continue;
    const p = path.join(mi, f);
    let c = '';
    try { c = decodeBuf(fs.readFileSync(p)); } catch (e) { continue; }
    const out = c.split(/\r?\n/).map(l => hookRe.test(l) ? (lines++, l.replace(hookRe, '')) : l);
    if (lines) { try { fs.writeFileSync(p, encodeStr(out.join('\r\n'), 'gbk')); changed++; } catch (e) {} lines = 0; }
    if (++batch % 40 === 0) await new Promise(r => setImmediate(r));
  }
  return { ok: true, changed, msg: changed ? 'MonItems 挂钩已移除（' + changed + ' 文件）' : 'MonItems 无挂钩' };
}

async function genStoreScript(engineRoot, opts = {}) {
  const featureFolder = String(opts.featureFolder || '').trim();
  const scriptName = String(opts.scriptName || '').trim();
  const methodName = String(opts.methodName || '').trim();
  if (!featureFolder || !scriptName || !methodName) return { ok: false, msg: '请填写功能文件夹名、脚本名、方法名' };
  const categoryFolder = String(opts.categoryFolder || '').trim() || '咕咕鸡物品分类';
  const commonFolder2 = String(opts.commonFolder || '').trim().replace(/^[/\\]+|[/\\]+$/g, '') || '通区文件';
  let zoneFolder2 = String(opts.zoneFolder || '').trim().replace(/^[/\\]+|[/\\]+$/g, '');
  // 区服名称必须是实际区名（如 翎风01）：<$SERVERNAME> 含 <> 在文件路径命令里不被解析，会导致目录/文件不一致
  if (!zoneFolder2 || /[<>]/.test(zoneFolder2)) zoneFolder2 = serverZoneName(engineRoot);
  if (!zoneFolder2) return { ok: false, msg: '请填写区服名称（实际区名，如 翎风01；勿用 <$SERVERNAME> 占位）' };
  const storeU = String(opts.storeU || 'U335').trim();           // 虾米固定 U335（运行时编号槽 1000-9999）
  const timerId = opts.timerId || storeTimerId(engineRoot, { featureFolder, scriptName });
  const interval = +opts.interval || 60;
  const teleportCondition = String(opts.teleportCondition || '').trim();
  const btn = String(opts.btn || '200').trim();                   // QR 触发序号（虾米默认 200）
  // 注册咕咕鸡素材到 EffectImageList.txt（还原 1.4.3 b01b_add_b01a_version_plan：生成时追加咕咕鸡素材.Pak 行）
  // &ImgEx / ADDBUTTON 的资源编号 = EffectImageList.txt 的行序（0 起）；注册后自动算行号填 rid，用户无需手填
  const effectFile = path.join(engineRoot, 'Mir200', 'Envir', 'EffectImageList.txt');
  let effectLog = 'EffectImageList.txt 未找到';
  let effectLines = [];
  if (fs.existsSync(effectFile)) effectLines = decodeBuf(fs.readFileSync(effectFile)).split(/\r?\n/).map(l => l.replace(/\r$/, '')).filter(l => l.trim() !== '');  // 过滤空行：引擎按行读素材，空行致行号偏移→资源编号错位
  const normL = (l) => String(l || '').trim().toLowerCase().replace(/\s+/g, '');
  const GUGU = ['咕咕鸡素材.pak', '咕咕鸡素材pak'];
  let guguIdx = effectLines.findIndex(l => GUGU.includes(normL(l)));
  if (guguIdx < 0) {
    effectLines.push('咕咕鸡素材.Pak');
    fs.writeFileSync(effectFile, encodeStr(effectLines.join('\r\n'), 'gbk'));  // 引擎列表文件惯例 GBK，不能走 utf8 自动检测
    guguIdx = effectLines.length - 1;
    effectLog = '已注册咕咕鸡素材.Pak 到 EffectImageList.txt（第 ' + (guguIdx + 1) + ' 个）';
  } else {
    effectLog = '咕咕鸡素材.Pak 已在 EffectImageList.txt（第 ' + (guguIdx + 1) + ' 个）';
  }
  let rid = parseInt(opts.rid, 10) || 0;
  if (rid <= 0 && guguIdx >= 0) rid = guguIdx + 1;   // 资源编号 0 = 自动用咕咕鸡素材（1 起行号，内部 -1 → 0 起）
  if (rid > 0) rid -= 1;                                          // 虾米：资源编号 >0 时 -1
  const qrMethod = String(opts.qrMethod || '').trim() || '掉落前检测';  // 虾米存销标准段名（用户端实测 MonDropItem 亦不触发，故默认沿用虾米段名；若仍不生效需 OnKillMob 手动挂钩）
  const filterTip = String(opts.filterTip || '咕咕鸡过滤').trim();   // 1.4.3 过滤提示
  const storeTip = String(opts.storeTip || '咕咕鸡存储').trim();     // 1.4.3 存储提示
  const env = path.join(engineRoot, 'Mir200', 'Envir');
  const qd = path.join(env, 'QuestDiary', featureFolder);
  // 通区目录由引擎脚本运行时 ForceDirectories 建（路径基准 QuestDiary，4 级 = 引擎根上一级）；生成时不再建引擎根下空目录
  fs.mkdirSync(qd, { recursive: true });
  // 分类目录（QuestDiary\<分类>\）——界面配置读取的 GetTextLineCount 会向该目录写 LineCounts.ini 缓存，目录必须先存在
  if (categoryFolder) fs.mkdirSync(path.join(env, 'QuestDiary', categoryFolder), { recursive: true });
  const zoneSlash = '..\\..\\..\\..\\' + commonFolder2 + '\\' + zoneFolder2 + '\\';
  // 1. 模板替换（对齐 1.3.6 _ensure_feature_scripts.other_replacements + _replace_category_in_text）
  //    注意：用占位符隔离功能性锚点（.txt / @ / [@]），避免裸词替换互相污染（如 scriptName 含"咕咕鸡过滤"时二次替换）
  const applyRepl = (content) => {
    let t = content;
    // 1.4.3 增强：仓库刷新标记段（1818 render_local_store_feature）——模板锚点后插入，仓库取物后刷新列表缓存
    t = t.replace('ReadConfigFileItem S$用户数据存储地址 咕咕鸡过滤 背包存储定时 N$背包存储_定时开关', 'ReadConfigFileItem S$用户数据存储地址 咕咕鸡过滤 背包存储定时 N$背包存储_定时开关\nMOV N$仓库刷新标记 0\nReadConfigFileItem S$用户数据存储地址 仓库刷新 标记 N$仓库刷新标记\n#IF\nEQUAL S$当前操作模式 仓库取物\nEQUAL N$仓库刷新标记 1\n#ACT\nWriteConfigFileItem S$用户数据存储地址 仓库刷新 标记 0\nMOV S$上次列表缓存Key \"\"\nMOV S$当前页已显示列表 \"\"\nMOV S$搜索关键字 \"\"\nMOV S$UI搜索关键字 \"\"\n', 1);
    const P = '\u0000YGE\u0000';
    t = t.replace(/咕咕鸡过滤\.txt/g, P + 'T');
    t = t.replace(/\[@咕咕鸡过滤\]/g, P + 'B');
    t = t.replace(/@咕咕鸡过滤/g, P + 'A');
    t = t.replace(/咕咕鸡过滤/g, scriptName);
    t = t.replace(new RegExp(P + 'T', 'g'), scriptName + '.txt')
         .replace(new RegExp(P + 'B', 'g'), '[@' + methodName + ']')
         .replace(new RegExp(P + 'A', 'g'), '@' + methodName);
    t = t.replace(/\\游戏功能\\/g, '\\' + featureFolder + '\\');
    t = t.replace(/\.\.\\\.\.\\\.\.\\\.\.\\通区文件\\/g, '..\\..\\..\\..\\' + commonFolder2 + '\\');
    t = t.replace(/<\$SERVERNAME>/g, zoneFolder2);
    // 分类目录替换（虾米 _replace_category_in_text；模板真实路径为 ..\QuestDiary\ggjfl\，7 处）
    if (categoryFolder && categoryFolder !== 'ggjfl') t = t.replace(/\.\.\\QuestDiary\\ggjfl\\/g, '..\\QuestDiary\\' + categoryFolder + '\\');
    if (teleportCondition) t = t.replace(/LARGE U599 499/g, teleportCondition);
    if (timerId) {
      t = t.replace(/(SETONTIMER\s+)51\b/ig, '$1' + timerId).replace(/(@OnTimer\s*)51\b/ig, '$1' + timerId);
      // R3-16：间隔数字一并替换（模板 SetOnTimer 51 2 → SetOnTimer {timerId} {interval}）
      t = t.replace(new RegExp('(SETONTIMER\\s+' + timerId + '\\s+)\\d+', 'ig'), '$1' + interval);
    }
    return t;
  };
  // 2. 生成 4 个脚本（对齐虾米 1119 build_feature_content）
  const tpl = loadStoreTemplate();
  const written = [];
  const mk = (name, body) => {
    const f = path.join(qd, name);
    writeTextFile(f, body);
    return name;
  };
  // 创建文件.txt
  written.push(mk('创建文件.txt',
    '[@创建文件]\r\n{\r\n\r\n#IF\r\nNOT CHECKTEXTLIST ' + zoneSlash + '检测是否已经创建目录.txt 已创建目录\r\n#ACT\r\nmov S$用户数据存储地址 ' + zoneSlash + '<$STR(' + storeU + ')>.ini\r\nForceDirectories ..\\..\\..\\..\\' + commonFolder2 + '\\\r\nForceDirectories ' + zoneSlash + '\r\nCreateFile ' + zoneSlash + '检测是否已经创建目录.txt\r\nAddTextListEx ' + zoneSlash + '检测是否已经创建目录.txt 已创建目录 0\r\nCreateFile S$用户数据存储地址\r\n#elseact\r\nCreateFile S$用户数据存储地址\r\n\r\n}'));
  // 界面配置读取.txt（22 分类 GetTextLineCount）
  const catPairs = [['宝石分类.txt','宝石总行数'],['斗笠分类.txt','斗笠总行数'],['毒符分类.txt','毒符总行数'],['盾牌分类.txt','盾牌总行数'],['过滤分类.txt','过滤总行数'],['戒指分类.txt','戒指总行数'],['军鼓分类.txt','军鼓总行数'],['灵玉分类.txt','灵玉总行数'],['马牌分类.txt','马牌总行数'],['衣服分类.txt','衣服总行数'],['其它分类.txt','其它总行数'],['生肖分类.txt','生肖总行数'],['时装分类.txt','时装总行数'],['手镯分类.txt','手镯总行数'],['特殊分类.txt','特殊总行数'],['头盔分类.txt','头盔总行数'],['武器分类.txt','武器总行数'],['项链分类.txt','项链总行数'],['面巾分类.txt','面巾总行数'],['勋章分类.txt','勋章总行数'],['腰带分类.txt','腰带总行数'],['所有物品.txt','所有物品总行数']];
  written.push(mk('界面配置读取.txt',
    '[@界面配置读取]\r\n{\r\n#if\r\n#act\r\n' + catPairs.map(([fn, tn]) => 'GetTextLineCount ..\\QuestDiary\\' + categoryFolder + '\\' + fn + ' N$' + tn).join('\r\n') + '\r\n\r\n}'));
  // 存销变量初始化.txt（建通区目录；数据文件用账号_角色名固定命名，无需 U335 编号）
  written.push(mk('存销变量初始化.txt',
    '[@存销变量初始化]\r\n{\r\n#IF\r\n#ACT\r\n; 先建通区目录（ForceDirectories 不递归父级，分两级建）\r\nForceDirectories ..\\..\\..\\..\\' + commonFolder2 + '\\\r\nForceDirectories ' + zoneSlash + '\r\n}'));
  if (tpl) written.push(mk(scriptName + '.txt', applyRepl(tpl)));
  // 3. QManage：[@Login] 段（虾米 1134 ADDBUTTON + 三连 CALL）+ 定时器块（虾米 1133 append 尾部）
  const qm = path.join(env, 'MapQuest_def', 'QManage.txt');
  let qmLog = 'QManage 未找到';
  if (fs.existsSync(qm)) {
    fs.copyFileSync(qm, qm + '.store-bak');
    let c = decodeBuf(fs.readFileSync(qm)).replace(/\r\n/g, '\n');
    // 清旧标记（虾米 1135/0837：新标记 + 旧 TOOL 标记 + 元歌旧标记）
    c = c.replace(/\n?\s*;TOOL_INJECTED_START[\s\S]*?;TOOL_INJECTED_END\s*\n?/gi, '\n');
    c = c.replace(/\n?\s*;TOOL_STORE_TIMER_START[\s\S]*?;TOOL_STORE_TIMER_END\s*\n?/gi, '\n');
    c = c.replace(/\n?\s*;@@yge-store-login[\s\S]*?;@@yge-store-login-end\s*\n?/gi, '\n');
    c = c.replace(/\n{3,}/g, '\n\n');
    // [@Login] 段
    const loginBlock = [
      ';TOOL_INJECTED_START', ';存销写入记录结束,请勿删除,元歌工具箱',
      '#IF', 'NOT ISDUMMY', '#ACT',
      '#CALL [\\' + featureFolder + '\\存销变量初始化.txt] @存销变量初始化',
      'mov S$用户数据存储地址 ' + zoneSlash + '<$USERID>_<$USERNAME>.ini',
      'mov S$物品数据存储地址 ' + zoneSlash + '物品数据\\',
      'mov S$地图数据存储地址 ' + zoneSlash + '地图数据\\',
      'mov S$本地物品数据存储地址 ..\\QuestDiary\\' + categoryFolder + '\\',
      '#CALL [\\' + featureFolder + '\\界面配置读取.txt] @界面配置读取',
      'mov N$虾米资源编号 ' + rid,
      'ADDBUTTON <$STR(N$虾米资源编号)> ' + btn + ' 10 11 12 10 92 1 -1',
      '',
      '#IF', 'NOT ISDUMMY', 'ISNEWHUMAN', '#ACT',
      '#CALL [\\' + featureFolder + '\\创建文件.txt] @创建文件',
      ';TOOL_INJECTED_END'
    ].join('\n');
    const loginIdx = c.indexOf('[@Login]');
    if (loginIdx >= 0) {
      const nl = c.indexOf('\n', loginIdx);
      c = c.slice(0, nl + 1) + loginBlock + '\n\n' + c.slice(nl + 1);
    } else {
      c = c.replace(/[\r\n]+$/, '') + '\n\n[@Login]\n' + loginBlock + '\n';
    }
    // 定时器块（[@OnTimer{id}] 无空格 + SetOffTimer 关闭，append 尾部）
    const timerBlock = [
      ';TOOL_STORE_TIMER_START',
      '[@OnTimer' + timerId + ']',
      '#IF', '#ACT',
      'MOV S$用户数据存储地址 ' + zoneSlash + '<$USERID>_<$USERNAME>.ini',
      'MOV N$背包存储_定时开关 0',
      'ReadConfigFileItem S$用户数据存储地址 ' + scriptName + ' 背包存储定时 N$背包存储_定时开关',
      '',
      '#IF', 'EQUAL N$背包存储_定时开关 1', '#ACT',
      '#CALL [\\' + featureFolder + '\\' + scriptName + '.txt] @开启背包存储',
      '#IF', 'NOT EQUAL N$背包存储_定时开关 1', '#ACT',
      'SetOffTimer ' + timerId,
      'BREAK',
      ';TOOL_STORE_TIMER_END'
    ].join('\n');
    c = c.replace(/[\r\n]+$/, '') + '\n\n' + timerBlock + '\n';
    fs.writeFileSync(qm, encodeStr(c, 'gbk'));  // QManage 必须 GBK（引擎按 GBK 读；writeTextFile 对纯 ASCII 原文件误判 utf8 会导致中文段名乱码）
    qmLog = '已注入 QManage（[@Login] 段 + 定时器 ' + timerId + '）';
  }
  // 4. QFunction-0.txt：掉落检测段 + [@ButtonClick{btn}]（虾米 1139）
  const qf = path.join(env, 'Market_Def', 'QFunction-0.txt');
  let qfLog = 'QFunction-0.txt 未找到';
  if (fs.existsSync(qf)) {
    const origQf = decodeBuf(fs.readFileSync(qf));
    // F-P2-10：注入前扫描 QF 已用段名/按钮号，冲突提示（不阻断，但用户可见）；重复生成时先剥离自身旧标记块，旧注入不计冲突
    const selfStripped = origQf.replace(/;======装备掉落检测开始======[\s\S]*?;======装备掉落检测结束======/gi, '').replace(/;======按钮触发开始======[\s\S]*?;======按钮触发结束======/gi, '');
    const usedSeg = new Set([...selfStripped.matchAll(/^\[@([^\]]+)\]\s*$/gm)].map(m => m[1].trim()));
    const conflicts = [];
    if (usedSeg.has(qrMethod)) conflicts.push('[@' + qrMethod + ']');
    if (usedSeg.has('ButtonClick' + btn)) conflicts.push('[@ButtonClick' + btn + ']');
    fs.copyFileSync(qf, qf + '.store-bak');
    let c = decodeBuf(fs.readFileSync(qf)).replace(/\r\n/g, '\n');
    c = c.replace(/\n?\s*;======装备掉落检测开始======[\s\S]*?;======装备掉落检测结束======\s*\n?/gi, '\n');
    c = c.replace(/\n?\s*;======按钮触发开始======[\s\S]*?;======按钮触发结束======\s*\n?/gi, '\n');
    c = c.replace(/\n{3,}/g, '\n\n');
    const qfBlock = [
      ';======装备掉落检测开始======',
      '[@' + qrMethod + ']',
      '#IF', 'EQUAL S$用户数据存储地址 ""', '#ACT',
      'MOV S$用户数据存储地址 ' + zoneSlash + '<$USERID>_<$USERNAME>.ini',
      '',
      '#IF', '#ACT',
      'ForceDirectories ' + zoneSlash + '',
      'MOV S$仓库索引文件 ' + zoneSlash + '仓库索引_<$USERID>_<$USERNAME>.txt',
      'MOV S$仓库数量文件 ' + zoneSlash + '仓库数量_<$USERID>_<$USERNAME>.txt',
      'CreateFile S$用户数据存储地址',
      'CreateFile S$仓库索引文件',
      'CreateFile S$仓库数量文件',
      '',
      '#IF', '#ACT', 'MOV S$掉落物品名 <$CURITEMNAME>',
      '',
      '#IF', 'EQUAL S$掉落物品名 ""', '#ACT', 'MOV S$掉落物品名 <$CurItemName>',
      '#IF', 'EQUAL S$掉落物品名 ""', '#ACT', 'break',
      '',
      '#IF', '#ACT',
      'MOV N$是否过滤 0', 'MOV N$是否存储 0', 'MOV N$仓库存储数量 0',
      'ReadConfigFileItem S$用户数据存储地址 过滤物品 <$STR(S$掉落物品名)> <$STR(N$是否过滤)>',
      'ReadConfigFileItem S$用户数据存储地址 存储物品 <$STR(S$掉落物品名)> <$STR(N$是否存储)>',
      '',
      '#if', 'EQUAL N$是否过滤 88', '#ACT',
      'Sendmsg 7 【' + filterTip + '】：物品【<$STR(S$掉落物品名)>】已经被过滤掉了',
      'StopDropItem', 'break',
      '',
      '#if', 'EQUAL N$是否存储 88', '#ACT',
      'ReadConfigFileItem S$仓库数量文件 仓库数量 <$STR(S$掉落物品名)> <$STR(N$仓库存储数量)>',
      'INC N$仓库存储数量 1',
      'WriteConfigFileItem S$仓库数量文件 仓库数量 <$STR(S$掉落物品名)> <$STR(N$仓库存储数量)>',
      '',
      '#IF', 'EQUAL N$是否存储 88', 'NOT CheckTextList <$STR(S$仓库索引文件)> <$STR(S$掉落物品名)>', '#ACT',
      'AddTextListEx <$STR(S$仓库索引文件)> <$STR(S$掉落物品名)> 0',
      '',
      '#IF', 'EQUAL N$是否存储 88', '#ACT',
      'Sendmsg 7 【' + storeTip + '】：物品【<$STR(S$掉落物品名)>】已经为您存入仓库，当前数量：<$STR(N$仓库存储数量)>个',
      'WriteConfigFileItem S$用户数据存储地址 仓库刷新 标记 1',
      'StopDropItem', 'break',
      ';======装备掉落检测结束======',
      ';======按钮触发开始======',
      '[@ButtonClick' + btn + ']',
      '#IF', '#ACT',
      '#CALL [\\' + featureFolder + '\\' + scriptName + '.txt] @' + methodName,
      ';======按钮触发结束======'
    ].join('\n');
    c = c.replace(/[\r\n]+$/, '') + '\n\n' + qfBlock + '\n';
    fs.writeFileSync(qf, encodeStr(c, 'gbk'));  // QF 必须 GBK（引擎按 GBK 读段名，utf8 会导致掉落检测段名乱码失效）
    qfLog = '已注入 QFunction（掉落检测 + @ButtonClick' + btn + '）' + (conflicts.length ? '；⚠ 检测到 QF 已存在同名段: ' + conflicts.join(', ') + '（请改方法名/按钮号避免冲突）' : '');
  }
  const zoneRes = await genZoneData(engineRoot, commonFolder2, zoneFolder2);
  const hookRes = await hookMonItemsDrops(engineRoot, qrMethod);
  const catRes = genCategories(engineRoot, categoryFolder);
  const catLog = catRes.ok ? '；' + catRes.msg : '；⚠ ' + catRes.msg;
  const zoneLog = zoneRes.ok ? '；' + zoneRes.msg : '；⚠ ' + zoneRes.msg;
  const hookLog = hookRes.ok ? '；' + hookRes.msg : '；⚠ ' + hookRes.msg;
  return { ok: true, timerId, qm: qmLog, qf: qfLog, files: written, effect: effectLog, cats: catRes, zone: zoneRes, hook: hookRes, msg: '已生成 ' + written.length + ' 个商店脚本 + ' + qmLog + ' + ' + qfLog + ' + ' + effectLog + catLog + zoneLog + hookLog };
}

// 跨文件清理存销（还原 1.3.6 0837 remove_all_injection_blocks / 1124/1125：清 QManage/QF 标记块 + 删除 QuestDiary 功能目录）
async function storeCleanScripts(engineRoot, opts = {}) {
  const featureFolder = String(opts.featureFolder || '').trim();
  const env = path.join(engineRoot, 'Mir200', 'Envir');
  if (!featureFolder) return { ok: false, msg: '请填写功能文件夹名' };
  const qrMethod = String(opts.qrMethod || '').trim() || '掉落前检测';  // 修 bug：qrMethod 未定义
  let cleaned = 0, deleted = 0;
  // 1. 清理 QManage / QFunction-0.txt 的标记块
  const targets = [
    path.join(env, 'MapQuest_def', 'QManage.txt'),
    path.join(env, 'Market_Def', 'QFunction-0.txt'),
  ];
  const patterns = [
    [/;TOOL_INJECTED_START[\s\S]*?;TOOL_INJECTED_END/g, ''],
    [/;TOOL_STORE_TIMER_START[\s\S]*?;TOOL_STORE_TIMER_END/g, ''],
    [/;@@yge-store-login[\s\S]*?;@@yge-store-login-end/g, ''],
    [/;======装备掉落检测开始======[\s\S]*?;======装备掉落检测结束======/g, ''],
    [/;======按钮触发开始======[\s\S]*?;======按钮触发结束======/g, ''],
  ];
  for (const f of targets) {
    if (!fs.existsSync(f)) continue;
    fs.copyFileSync(f, f + '.clean-bak');
    let c = decodeBuf(fs.readFileSync(f));
    let before = c.length;
    for (const [re, rep] of patterns) c = c.replace(re, rep);
    c = c.replace(/\n{3,}/g, '\n\n');
    if (c.length !== before) { writeTextFile(f, c); cleaned++; }
  }
  // 1.5 移除 MonItems 掉落检测挂钩（还原虾米 1843）
  const unhookRes = await unhookMonItemsDrops(engineRoot, qrMethod);
  // 2. 删除 QuestDiary 功能目录（1125 delete_or_strip）
  const qd = path.join(env, 'QuestDiary', featureFolder);
  if (fs.existsSync(qd)) { fs.rmSync(qd, { recursive: true, force: true }); deleted = 1; }
  // 3. 移除咕咕鸡素材注册（还原 1.4.3 b01b delete：从 EffectImageList.txt 删除咕咕鸡素材.Pak 行）
  const effectFile = path.join(env, 'EffectImageList.txt');
  let effectRemoved = 0;
  if (fs.existsSync(effectFile)) {
    const normL = (l) => String(l || '').trim().toLowerCase().replace(/\s+/g, '');
    const GUGU = ['咕咕鸡素材.pak', '咕咕鸡素材pak'];
    const lines = decodeBuf(fs.readFileSync(effectFile)).split(/\r?\n/).filter(l => l.trim() !== '');  // 过滤空行
    const kept = lines.filter(l => !GUGU.includes(normL(l)));
    if (kept.length !== lines.length) { fs.writeFileSync(effectFile, encodeStr(kept.join('\r\n'), 'gbk')); effectRemoved = 1; }  // 强制 GBK 写回
  }
  return { ok: true, cleaned, deleted, effect: effectRemoved, hook: unhookRes, msg: '存销清理完成：' + cleaned + ' 个文件标记已剥离' + (deleted ? '，功能目录已删除' : '') + (effectRemoved ? '，咕咕鸡素材注册已移除' : '') + (unhookRes.changed ? '，MonItems 挂钩已移除' : '') };
}

function genSalesData(engineRoot, opts) {
  if (!opts.outDir) return { ok: false, msg: '未填写生成路径' };
  if (!opts.name) return { ok: false, msg: '未填写数据目录名' };
  const stages = [];
  const outBase = path.join(opts.outDir, opts.name);
  try {
    // 阶段1：物品数据
    stages.push('正在生成物品数据...');
    const files = listMonFiles(engineRoot);
    const itemsData = [];
    for (const mon of files) {
      const rf = readMonFile(engineRoot, mon);
      for (const it of rf.items) {
        if (it.kind === 'rate') itemsData.push({ mon, item: it.item, rate: it.rate, count: it.count });
        else if (it.kind === 'child') itemsData.push({ mon, item: '#CHILD', rate: it.rate });
      }
    }
    const itemsDir = path.join(outBase, 'items');
    fs.mkdirSync(itemsDir, { recursive: true });
    writeTextFile(path.join(itemsDir, '物品数据.json'), JSON.stringify(itemsData, null, 2));
    // 按用户编号分组生成物品表
    const groupSize = opts.groupSize > 0 ? opts.groupSize : 100;
    const groups = groupItems(itemsData, groupSize);
    const groupDir = path.join(itemsDir, '分组');
    fs.mkdirSync(groupDir, { recursive: true });
    groups.forEach((g, gi) => {
      const uid = genUserId(opts.userIdType || '数字', gi);
      writeTextFile(path.join(groupDir, '组' + uid + '.json'), JSON.stringify(g, null, 2));
    });
    stages.push('物品数据生成成功！（' + itemsData.length + ' 条，' + groups.length + ' 组）');

    // 阶段2：掉落数据（按格式处理爆率）
    stages.push('正在生成掉落数据...');
    const dropsDir = path.join(outBase, 'drops');
    fs.mkdirSync(dropsDir, { recursive: true });
    if (opts.format === 'new') {
      // 新爆率格式：按 #CHILD 1/N RANDOM 分组结构生成（F-P2-11：组头保分母、组内 1/1 归一、已有组透传——与 P0-2 groupRates 同语义）
      const dstDir = path.join(dropsDir, 'MonItems');
      fs.mkdirSync(dstDir, { recursive: true });
      for (const mon of files) {
        const rf = readMonFile(engineRoot, mon);
        const outItems = [];
        let pending = [];
        let depth = 0;
        const flush = () => {
          if (pending.length < 2) { outItems.push(...pending); pending = []; return; }
          for (let i = 0; i < pending.length; i += 5) {
            const batch = pending.slice(i, i + 5);
            outItems.push({ kind: 'child', num: 1, rate: batch[0].rate, flag: 'RANDOM', raw: '' });
            outItems.push({ kind: 'paren', raw: '(' });
            for (const it of batch) outItems.push({ kind: 'rate', num: 1, rate: 1, item: it.item, count: it.count });
            outItems.push({ kind: 'paren', raw: ')' });
          }
          pending = [];
        };
        for (const it of rf.items) {
          if (it.kind === 'paren') {
            const isOpen = it.raw.trim() === '(';
            if (isOpen) depth++;
            flush(); outItems.push(it);
            if (!isOpen) depth = Math.max(0, depth - 1);
            continue;
          }
          if (depth > 0) { outItems.push(it); continue; }
          if (it.kind === 'rate') { pending.push(it); continue; }
          flush(); outItems.push(it);
        }
        flush();
        writeTextFile(path.join(dstDir, mon.toLowerCase() + '.txt'), serializeFile(outItems));
      }
    } else {
      // 原版爆率：复制原始爆率文件
      const srcDir = monItemsDir(engineRoot);
      const dstDir = path.join(dropsDir, 'MonItems');
      fs.mkdirSync(dstDir, { recursive: true });
      for (const mon of files) {
        const rf = readMonFile(engineRoot, mon);
        writeTextFile(path.join(dstDir, mon.toLowerCase() + '.txt'), serializeFile(rf.items));
      }
    }
    stages.push('掉落数据生成成功！');

    // 阶段3：刷新地图数据
    stages.push('正在生成刷新地图数据...');
    const mg = readMonGen(engineRoot);
    if (mg) {
      writeTextFile(path.join(outBase, '刷新地图数据.json'), JSON.stringify(mg.spawns, null, 2));
      stages.push('刷新地图数据生成成功！（' + mg.spawns.length + ' 条刷怪）');
    } else {
      stages.push('刷新地图数据：未找到 MonGen.txt，跳过');
    }

    // 阶段4：存储数据生成完毕（F-P1-8：单次写入，含真实键名，不再被第二次 note 覆盖）
    writeTextFile(path.join(outBase, '说明.txt'),
      ';元歌存销数据 - 请勿删除本文件\r\n' +
      '存销数据包：' + opts.name + '\r\n' +
      '生成时间: ' + new Date().toLocaleString() + '\r\n' +
      '版本引擎: ' + (opts.engine || 'GOM') + '\r\n' +
      '爆率格式: ' + (opts.format === 'new' ? '新爆率格式' : '原版爆率') + '\r\n' +
      '用户编号: ' + (opts.userIdType || '数字') + '\r\n' +
      '物品: ' + itemsData.length + ' 条 / 分组: ' + groups.length + ' 组'
    );
    stages.push('存储数据生成完毕');
    stages.push('搞定了，可以放心给别人了');
    return { ok: true, outBase, stages, note: '说明.txt' };
  } catch (e) {
    return { ok: false, msg: '生成失败: ' + e.message, stages };
  }
}


// ==================== 原刷怪调整（还原自 index-342fb122） ====================
// MonGen.txt 批量修改：刷新数量倍数、刷新时间倍数，支持排除条件
// 表单（还原）：修改类型(全服/按地图/按怪物)、刷新数量倍数、刷新时间倍数、
//   排除刷新时间(>=/<= X分钟)、排除刷新数量(>=/<= X只)

function adjustMonGen(engineRoot, opts) {
  const mg = readMonGen(engineRoot);
  if (!mg) return { ok: false, msg: '未找到 MonGen.txt' };
  const monCountMul = parseFloat(opts.monCount);
  const monDateMul = parseFloat(opts.monDate);
  if ((!monCountMul || monCountMul === 1) && (!monDateMul || monDateMul === 1)) {
    return { ok: false, msg: '请填写刷新数量或刷新时间的倍数' };
  }
  let changedCount = 0, changedDate = 0, skipped = 0;
  for (const s of mg.spawns) {
    if (opts.type === 'map' && s.map !== opts.name) continue;
    if (opts.type === 'mongen' && s.mon !== opts.name) continue;
    // 排除条件（间隔单位=分钟）
    const intervalMin = parseFloat(s.interval) || 0;
    const cnt = parseInt(s.count, 10) || 0;
    let excluded = false;
    if (opts.excludeDateCount != null && opts.excludeDateCount !== '' && opts.expressionDate === '>=' && intervalMin >= parseFloat(opts.excludeDateCount)) excluded = true;
    if (opts.excludeDateCount != null && opts.excludeDateCount !== '' && opts.expressionDate === '<=' && intervalMin <= parseFloat(opts.excludeDateCount)) excluded = true;
    if (opts.excludeMonCount != null && opts.excludeMonCount !== '' && opts.expressionMon === '>=' && cnt >= parseFloat(opts.excludeMonCount)) excluded = true;
    if (opts.excludeMonCount != null && opts.excludeMonCount !== '' && opts.expressionMon === '<=' && cnt <= parseFloat(opts.excludeMonCount)) excluded = true;
    if (excluded) { skipped++; continue; }
    // 刷新数量 × 倍数（上限 5000、下限 1、≤ maxCount——还原自蜗牛 342fb122 clamp）
    if (monCountMul && monCountMul !== 1 && s.count !== '' && s.count !== '0') {
      let v = Math.round(cnt * monCountMul);
      if (v > 5000) v = 5000; else if (v < 1) v = 1;
      if (opts.maxCount > 0 && v > opts.maxCount) v = opts.maxCount;
      s.count = String(v);
      changedCount++;
    }
    // 刷新时间 × 倍数（上限 1000、下限 1）
    if (monDateMul && monDateMul !== 1 && s.interval !== '' && s.interval !== '0') {
      let v = Math.round(intervalMin * monDateMul);
      if (v > 1000) v = 1000; else if (v < 1) v = 1;
      s.interval = String(v);
      changedDate++;
    }
  }
  if (opts.autoBackup !== false) backupMonGen(engineRoot, '原刷怪调整');
  for (const s of mg.spawns) mg.rawLines[s.lineIdx] = serializeSpawn(s);
  preserveMonGenWrite(mg.file, mg.rawLines, mg.newline);
  return { ok: true, changedCount, changedDate, skipped, file: mg.file };
}

// ==================== 动态刷怪配置（还原自 index-342fb122） ====================
// "有人有怪，无人清怪，性能节约、稳定不卡"
// 表单（还原）：触发百分比pro、触发人数count、刷怪百分比monCount、刷怪间隔intervaled(秒)、
//   清怪间隔interval(秒)、版本引擎、排除地图、排除怪物、排除刷新时间(startTime/endTime)

const DYNAMIC_NPC = '元歌动态刷新';
const DYNAMIC_CLEAR = '元歌动态清除';

// MonGen 备份（还原自虾米"XX备份"：写前备份到 Envir/@backup/）
function backupMonGen(engineRoot, tag) {
  const f = monGenFile(engineRoot);
  if (!f || !fs.existsSync(f)) return { ok: false, msg: 'MonGen.txt 不存在' };
  const env = path.dirname(f);
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const name = (tag || 'MonGen') + '_' + ts + '.txt';
  const dst = path.join(env, '@backup', name);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(f, dst);
  return { ok: true, file: dst, msg: 'MonGen 已备份到 @backup/' + name };
}
// 原子写入（写临时文件 + rename，防中断损坏——还原自虾米 _spawn_atomic_write）
function atomicWrite(file, content) {
  const tmp = file + '.tmp-' + Date.now();
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
  return true;
}
// 保留原格式写入（newline 类型 + 尾换行——还原自虾米 _spawn_serialize_document）
function preserveMonGenWrite(file, rawLines, newline) {
  const nl = newline || '\r\n';
  const content = rawLines.join(nl) + (rawLines.length ? nl : '');
  atomicWrite(file, encodeStr(content));
  return true;
}

// ==================== 刷怪表格 + 副本地图/个人/副本刷怪（还原自虾米 _SpawnToolLite） ====================
// 刷怪表格数据（对齐虾米 _map_header_labels 列：map/x/y/monster/range/count/time）
// 地图列表（MapInfo.txt，对齐虾米 _build_exchange_map_combo 地图下拉+自动补全）
function listMaps(engineRoot) {
  const mi = path.join(engineRoot, 'Mir200', 'Envir', 'MapInfo.txt');
  if (!fs.existsSync(mi)) return { ok: false, msg: '未找到 MapInfo.txt' };
  const maps = [];
  const seen = new Set();
  for (const line of decodeBuf(fs.readFileSync(mi)).split(/\r?\n/)) {
    const m = line.match(/^\[([^\]]+)\s+([^\]]+)\]/);
    if (!m) continue;
    const codes = m[1].split('|').map(x => x.trim());
    const name = m[2].trim();
    for (const c of codes) {
      if (!seen.has(c)) { seen.add(c); maps.push({ code: c, name }); }
    }
  }
  return { ok: true, maps, count: maps.length };
}
// 变量查询（还原自虾米 _VarQueryWorker + _VarQueryPage：扫描 Envir 全部脚本的变量占用）
function scanVariables(engineRoot) {
  const envir = path.join(engineRoot, 'Mir200', 'Envir');
  if (!fs.existsSync(envir)) return { ok: false, msg: '未找到 Mir200\\Envir' };
  // 对齐虾米 1.4.3 _VarQueryPage._var_types：5 组 + 类型上限（A/G/I/J/M/N/S/P=999, U/T=599, Z=499, 定时器=255, OK框=31, 自定义按钮=200, 物品触发=2000, 魔法触发=1500）
  const VAR_LIMITS = { 'A': 999, 'G': 999, 'I': 999, 'J': 999, 'M': 999, 'N': 999, 'S': 999, 'P': 999, 'U': 599, 'T': 599, 'Z': 499, '定时器': 255 };
  const GROUPS = {
    '常规类型': ['A', 'G', 'I', 'J', 'M', 'N', 'S', 'P', 'U', 'T', 'Z'],
    '计时与标识': ['定时器', '个人标识'],
    '输入与交互': ['输入字符串', '输入整数', 'ok框', '自定义按钮'],
    '触发与主体': ['物品触发', 'HUMAN', '魔法触发'],
    '命名变量': ['N$', 'S$']
  };
  const byGroup = {};      // 组名 → { 类型名: { 变量名: [详情] } }
  const push = (group, type, key, file, line, text) => {
    if (!byGroup[group]) byGroup[group] = {};
    if (!byGroup[group][type]) byGroup[group][type] = {};
    if (!byGroup[group][type][key]) byGroup[group][type][key] = [];
    const arr = byGroup[group][type][key];
    if (arr.length < 300) arr.push({ file, line, text });
  };
  let totalFiles = 0, totalMatches = 0;
  const walk = (d) => {
    let entries;
    try { entries = fs.readdirSync(d); } catch (e) { return; }
    for (const f of entries) {
      if (f.startsWith('@') || f.endsWith('.map') || f.endsWith('.wav') || f.endsWith('.wil') || f.endsWith('.wzl')) continue;
      const p2 = path.join(d, f);
      let st; try { st = fs.statSync(p2); } catch (e) { continue; }
      if (st.isDirectory()) { if (f !== 'MonItems' && !/^\./.test(f)) walk(p2); continue; }
      if (!/\.(txt|ini)$/.test(f) || st.size > 3000000) continue;
      try {
        const c = decodeBuf(fs.readFileSync(p2));
        const rel = p2.split(path.sep).join('/').replace(engineRoot.split(path.sep).join('/') + '/', '');
        totalFiles++;
        const lines = c.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i];
          if (!l.trim() || l.trim().startsWith(';')) continue;
          const tl = l.trim();
          // 1. 命名变量（N$/S$/G$/I$/A$/T$/D$/M$/P$；U/Q 交给单字母表，避免双计——R3-12）
          for (const re of VAR_PATTERNS) {
            let m; re.lastIndex = 0;
            while ((m = re.exec(l))) {
              const v = m[0];
              if (/^[UQ]\d/.test(v)) continue;   // U/Q 由单字母表统一处理（单计）
              const t = v.slice(0, 2);
              const key = v.slice(2);
              if (t === 'N$' || t === 'S$') push('命名变量', t, key, rel, i + 1, tl.slice(0, 120));
              else if (['G$', 'I$', 'A$', 'T$', 'D$', 'M$', 'P$'].includes(t)) push('常规类型', t[0], key, rel, i + 1, tl.slice(0, 120));
              totalMatches++;
            }
          }
          // 2. 单字母索引变量（常规类型 A/G/I/J/M/N/S/P/U/T/Z + 编号；按 1.4.3 类型上限校验，超限不报——U 到 599、T 到 599、Z 到 499、其余 999）
          for (const ch of GROUPS['常规类型']) {
            const re = new RegExp('\\b' + ch + '\\d{1,3}\\b', 'g');
            let m;
            while ((m = re.exec(l))) {
              if (l.includes('$' + m[0])) continue;  // 命名变量已处理
              const num = parseInt(m[0].slice(1), 10);
              const limit = VAR_LIMITS[ch] || 999;
              if (!(num >= 0 && num <= limit)) continue;   // 超引擎上限的编号不报（U600+ / Z500+ 为误报源）
              push('常规类型', ch, m[0], rel, i + 1, tl.slice(0, 120));
              totalMatches++;
            }
          }
          // 3. 定时器（SETONTIMER n / @OnTimer n；1.4.3 上限 255，超限不报）
          let m2;
          const tm = /SETONTIMER\s+(\d+)/gi;
          while ((m2 = tm.exec(l))) { const n = parseInt(m2[1], 10); if (n >= 0 && n <= 255) { push('计时与标识', '定时器', '定时器' + m2[1], rel, i + 1, tl.slice(0, 120)); totalMatches++; } }
          const om = /@OnTimer\s*(\d+)/gi;
          while ((m2 = om.exec(l))) { const n = parseInt(m2[1], 10); if (n >= 0 && n <= 255) { push('计时与标识', '定时器', 'OnTimer' + m2[1], rel, i + 1, tl.slice(0, 120)); totalMatches++; } }
          // 4. 个人标识 [N]
          const fm = /\[\s*(\d{1,3})\s*\]/g;
          while ((m2 = fm.exec(l))) { push('计时与标识', '个人标识', '[' + m2[1] + ']', rel, i + 1, tl.slice(0, 120)); totalMatches++; }
          // 5. 输入与交互
          if (/INPUTSTR/gi.test(l)) { push('输入与交互', '输入字符串', 'INPUTSTR', rel, i + 1, tl.slice(0, 120)); totalMatches++; }
          if (/INPUTNUM/gi.test(l)) { push('输入与交互', '输入整数', 'INPUTNUM', rel, i + 1, tl.slice(0, 120)); totalMatches++; }
          if (/MESSAGEBOX/gi.test(l)) { push('输入与交互', 'ok框', 'MESSAGEBOX', rel, i + 1, tl.slice(0, 120)); totalMatches++; }
          if (/自定义按钮/i.test(l)) { push('输入与交互', '自定义按钮', '自定义按钮', rel, i + 1, tl.slice(0, 120)); totalMatches++; }
          // 6. 触发与主体
          if (/\bHUMAN\b/gi.test(l)) { push('触发与主体', 'HUMAN', 'HUMAN', rel, i + 1, tl.slice(0, 120)); totalMatches++; }
          if (/UseItem|物品触发/gi.test(l)) { push('触发与主体', '物品触发', '物品触发', rel, i + 1, tl.slice(0, 120)); totalMatches++; }
          if (/MagSelfFunc|魔法触发/gi.test(l)) { push('触发与主体', '魔法触发', '魔法触发', rel, i + 1, tl.slice(0, 120)); totalMatches++; }
        }
      } catch (e) {}
    }
  };
  walk(envir);
  // 组装 groups + types（组名-类型名 平铺）
  const groups = {};
  const types = [];
  for (const g of Object.keys(GROUPS)) {
    groups[g] = {};
    for (const t of GROUPS[g]) {
      const vars = byGroup[g] && byGroup[g][t];
      if (vars && Object.keys(vars).length) {
        groups[g][t] = vars;
        types.push(g + '-' + t);
      }
    }
  }
  return { ok: true, files: totalFiles, matches: totalMatches, groups, types, byGroup, limits: VAR_LIMITS };
}

function spawnTable(engineRoot, opts) {
  opts = opts || {};
  const mg = readMonGen(engineRoot);
  if (!mg) return { ok: false, msg: '未找到 MonGen.txt' };
  // 地图名映射（MapInfo.txt）
  const mapNames = {};
  const mi = path.join(engineRoot, 'Mir200', 'Envir', 'MapInfo.txt');
  if (fs.existsSync(mi)) {
    for (const line of decodeBuf(fs.readFileSync(mi)).split(/\r?\n/)) {
      const m = line.match(/^\[([^\]]+)\s+([^\]]+)\]/);
      if (m) {
        const codes = m[1].split('|');
        for (const c of codes) if (!mapNames[c.trim()]) mapNames[c.trim()] = m[2].trim();
      }
    }
  }
  const rows = [];
  for (const sp of mg.spawns) {
    if (opts.map && sp.map !== opts.map) continue;
    if (opts.mon && !sp.mon.includes(opts.mon)) continue;
    rows.push({
      map: sp.map, mapName: mapNames[sp.map] || '', x: sp.x, y: sp.y,
      monster: sp.mon, range: sp.range, count: sp.count, time: sp.interval,
      extra: sp.time || sp.trigger || sp.extra || ''
    });
  }
  const limit = Math.max(0, parseInt(opts.limit, 10) || 0);
  return { ok: true, total: rows.length, maps: Object.keys(mapNames).length, rows: limit > 0 ? rows.slice(0, limit) : rows };
}
// 副本地图识别（MapInfo.txt 的 [实例|主图 名称] 格式——还原自虾米 _copy_map_alias_files_for_instance）
function detectDungeonMaps(engineRoot) {
  const mi = path.join(engineRoot, 'Mir200', 'Envir', 'MapInfo.txt');
  const mapDir = path.join(engineRoot, 'Mir200', 'Map');
  if (!fs.existsSync(mi)) return { ok: false, msg: '未找到 MapInfo.txt' };
  const dungeons = [];
  for (const line of decodeBuf(fs.readFileSync(mi)).split(/\r?\n/)) {
    const m = line.match(/^\[([^\]]+)\s+([^\]]+)\]/);
    if (!m) continue;
    const codes = m[1].split('|').map(x => x.trim());
    if (codes.length > 1) {
      const inst = codes[0], main = codes[1];
      dungeons.push({
        code: inst, main: main, name: m[2].trim(),
        hasMap: fs.existsSync(path.join(mapDir, inst + '.map')),
        mainHasMap: fs.existsSync(path.join(mapDir, main + '.map'))
      });
    }
  }
  return { ok: true, dungeons, count: dungeons.length };
}
// 个人刷怪（还原自虾米 _generate_personal_spawn：QuestDiary\元歌个人刷怪 + QManage 定时器）
function genPersonalSpawn(engineRoot, cfg) {
  cfg = cfg || {};
  const map = (cfg.map || '').trim();
  const mon = (cfg.monster || '').trim();
  const count = Math.max(1, parseInt(cfg.count, 10) || 1);
  const range = Math.max(1, parseInt(cfg.range, 10) || 3);
  if (!map) return { ok: false, msg: '请填写地图代码' };
  if (!mon) return { ok: false, msg: '请填写怪物名' };
  const qd = path.join(engineRoot, 'Mir200', 'Envir', 'QuestDiary', '元歌个人刷怪');
  fs.mkdirSync(qd, { recursive: true });
  const label = '@元歌个人刷怪-' + map;
  const body = '[' + label.slice(1) + ']\r\n#IF\r\nCHECKMAPMONCOUNT ' + map + ' < 1\r\n#ACT\r\nMONGEN ' + mon + ' ' + count + ' ' + range + '\r\nBREAK\r\n';
  const file = path.join(qd, map + '.txt');
  if (!fs.existsSync(file)) writeTextFile(file, body);
  else {
    const cur = decodeBuf(fs.readFileSync(file));
    if (!cur.includes('MONGEN ' + mon)) {
      const segHead = '[' + label.slice(1) + ']';
      const segIdx = cur.indexOf(segHead);
      if (segIdx >= 0) {
        // R3-7：已有同 label 段 → 只把 MONGEN 行插入段内 BREAK 前（同地图多怪不重复段头）
        const segEnd = cur.indexOf('\r\nBREAK', segIdx);
        const mgenLine = '\r\nMONGEN ' + mon + ' ' + count + ' ' + range;
        writeTextFile(file, segEnd >= 0 ? cur.slice(0, segEnd) + mgenLine + cur.slice(segEnd) : cur + mgenLine);
      } else {
        writeTextFile(file, cur.replace(/\r?\n$/, '') + '\r\n' + body);
      }
    }
  }
  let qm = null;
  if (cfg.injectQmanage !== false) qm = injectQManageTimer(engineRoot, { label, callFile: '..\\QuestDiary\\元歌个人刷怪\\' + map + '.txt', interval: cfg.interval });
  return { ok: true, file, label, qm, msg: '个人刷怪已生成：' + file.replace(engineRoot, '') + (qm ? '；' + qm.msg : '') };
}
// 副本刷怪（还原自虾米 _generate_instance_spawn：QuestDiary\元歌副本刷怪 + 地图实例复制）
function genInstanceSpawn(engineRoot, cfg) {
  cfg = cfg || {};
  const map = (cfg.map || '').trim();
  const mon = (cfg.monster || '').trim();
  const count = Math.max(1, parseInt(cfg.count, 10) || 1);
  const range = Math.max(1, parseInt(cfg.range, 10) || 3);
  if (!map) return { ok: false, msg: '请填写副本地图代码' };
  if (!mon) return { ok: false, msg: '请填写怪物名' };
  // 地图实例复制（还原自虾米 _copy_map_alias_files_for_instance）
  const mapDir = path.join(engineRoot, 'Mir200', 'Map');
  let copied = 0;
  const info = detectDungeonMaps(engineRoot);
  if (info.ok) {
    for (const d of info.dungeons) {
      if (!d.hasMap && d.mainHasMap && d.main) {
        try { fs.copyFileSync(path.join(mapDir, d.main + '.map'), path.join(mapDir, d.code + '.map')); copied++; } catch (e) {}
      }
    }
  }
  const qd = path.join(engineRoot, 'Mir200', 'Envir', 'QuestDiary', '元歌副本刷怪');
  fs.mkdirSync(qd, { recursive: true });
  const label = '@元歌副本刷怪-' + map;
  const body = '[' + label.slice(1) + ']\r\n#IF\r\nCHECKMAPMONCOUNT ' + map + ' < 1\r\n#ACT\r\nMONGEN ' + mon + ' ' + count + ' ' + range + '\r\nBREAK\r\n';
  const file = path.join(qd, map + '.txt');
  if (!fs.existsSync(file)) writeTextFile(file, body);
  else {
    const cur = decodeBuf(fs.readFileSync(file));
    if (!cur.includes('MONGEN ' + mon)) {
      const segHead = '[' + label.slice(1) + ']';
      const segIdx = cur.indexOf(segHead);
      if (segIdx >= 0) {
        // R3-7：已有同 label 段 → 只把 MONGEN 行插入段内 BREAK 前（同地图多怪不重复段头）
        const segEnd = cur.indexOf('\r\nBREAK', segIdx);
        const mgenLine = '\r\nMONGEN ' + mon + ' ' + count + ' ' + range;
        writeTextFile(file, segEnd >= 0 ? cur.slice(0, segEnd) + mgenLine + cur.slice(segEnd) : cur + mgenLine);
      } else {
        writeTextFile(file, cur.replace(/\r?\n$/, '') + '\r\n' + body);
      }
    }
  }
  let qm = null;
  if (cfg.injectQmanage !== false) qm = injectQManageTimer(engineRoot, { label, callFile: '..\\QuestDiary\\元歌副本刷怪\\' + map + '.txt', interval: cfg.interval });
  return { ok: true, file, label, qm, copied, msg: '副本刷怪已生成：' + file.replace(engineRoot, '') + (copied ? '；地图实例复制 ' + copied + ' 个' : '') + (qm ? '；' + qm.msg : '') };
}

// 查找 QManage.txt（探测 MapQuest_def / Market_Def / Envir）
function findQManage(engineRoot) {
  const candidates = [
    path.join(engineRoot, 'Mir200', 'Envir', 'MapQuest_def', 'QManage.txt'),
    path.join(engineRoot, 'Mir200', 'Envir', 'Market_Def', 'QManage.txt'),
    path.join(engineRoot, 'Mir200', 'Envir', 'QManage.txt'),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}
// QManage 定时器注入（还原自虾米 _inject_qmanage_timer：SETONTIMER + @OnTimer 段；复用同 label 旧 id，自动去重 next id）
function injectQManageTimer(engineRoot, opts) {
  const o = opts || {};
  const qm = findQManage(engineRoot);
  if (!qm) return { ok: false, msg: '未找到 QManage.txt（已探测 MapQuest_def / Market_Def / Envir）' };
  const content = decodeBuf(fs.readFileSync(qm));
  const label = o.label || '@动态刷怪';
  const interval = o.interval != null ? Math.max(1, Math.round(+o.interval)) : 60; // 蜗牛 jsc-preload: SETONTIMER 88 5（编号+间隔秒）
  const used = new Set();
  for (const m of content.matchAll(/SETONTIMER\s+(\d+)/gi)) used.add(+m[1]);
  for (const m of content.matchAll(/@OnTimer\s*(\d+)/gi)) used.add(+m[1]);
  // 复用同 label 旧定时器 id（对齐虾米 _extract_timer_id_from_marked_block：重复生成保持同一 id）
  let prevId = null;
  const prevM = content.match(new RegExp('\\[@OnTimer\\s*(\\d+)\\][\\s\\S]{0,120}?' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  if (prevM) prevId = +prevM[1];
  let id;
  if (o.timerId) { id = +o.timerId; while (used.has(id)) id++; }
  else if (prevId != null) { id = prevId; }            // 复用同 label 旧 id（幂等：不再递增）
  else { id = 1; while (used.has(id)) id++; }
  let updated = content;
  if (!new RegExp('SETONTIMER\\s+' + id + '\\b', 'i').test(updated)) {
    const loginIdx = updated.indexOf('[@Login]');
    if (loginIdx >= 0) {
      const nl = updated.indexOf('\n', loginIdx);
      if (nl >= 0) updated = updated.slice(0, nl + 1) + 'SETONTIMER ' + id + ' ' + interval + '\r\n' + updated.slice(nl + 1);
      else updated = updated + '\r\nSETONTIMER ' + id + ' ' + interval;
    } else {
      updated = 'SETONTIMER ' + id + ' ' + interval + '\r\n' + updated;
    }
  }
  if (!updated.includes('[@OnTimer ' + id + ']')) {
    // 段内跳转目标在 QuestDiary/Robot 子文件时用 #CALL 加载（蜗牛 jsc-preload：[@OnTimer88] #CALL [..\QuestDiary\…\刷怪脚本.txt] @WN个人刷怪）
    const action = o.callFile ? '#CALL [' + o.callFile + '] ' + label : label;
    updated = updated.replace(/[\r\n]+$/, '') + '\r\n\r\n[@OnTimer ' + id + ']\r\n#IF\r\n#ACT\r\n' + action + '\r\nBREAK\r\n';
  }
  writeTextFile(qm, updated);
  return { ok: true, qmanage: qm, timerId: id, msg: '已向 QManage 注入定时器 ' + id + '（@OnTimer ' + id + ' → ' + label + '）' };
}

// 动态刷怪（还原自 1.3.6 _apply_dynamic_spawn：记录级双概率触发，不改造原 MonGen）
// "有人有怪，无人清怪"：人数>=people 且 地图怪低于原始 trigger_count_percent% 时，
//   每条 MonGen 记录按 触发概率tp + 刷怪概率sp 独立 RANDOMEX 判定后 MONGENEX 补怪；无人时清除怪物+地上物品
// opts: { pro 触发概率%(默认50), monCount 刷怪概率%(默认100), count 触发人数(默认1),
//         triggerCountPercent 怪物阈值%(默认50), engine LFM2|GXXM2(默认LFM2),
//         intervaled 刷怪间隔秒(默认60), interval 清怪间隔秒(默认60),
//         excludeTimeMin 排除间隔>=X, excludeCountMax 排除数量<=X, excludeMaps, excludeMons,
//         autoBackup 备份, injectQmanage 注入 QManage 定时器 }
function genDynamicSpawn(engineRoot, opts = {}) {
  const mg = readMonGen(engineRoot);
  if (!mg) return { ok: false, msg: '未找到 MonGen.txt' };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  // 虾米 0985 默认值
  const tp = clamp(Math.round(opts.pro != null ? +opts.pro : 50), 0, 100);            // 触发概率
  const sp = clamp(Math.round(opts.monCount != null ? +opts.monCount : 100), 0, 100); // 刷怪概率（默认 100）
  if (tp <= 0) return { ok: false, msg: '触发概率必须大于 0，否则动态刷怪永远不会触发' };
  if (sp <= 0) return { ok: false, msg: '刷怪概率必须大于 0，否则不会生成有效刷怪' };
  const people = Math.max(1, Math.round(+opts.count || 1));
  const peopleCheck = people - 1;
  let engineName = String(opts.engine || 'LFM2').trim().toUpperCase();
  if (!['LFM2', 'GXXM2'].includes(engineName)) engineName = 'LFM2';
  const spawnCmd = engineName === 'LFM2' ? 'MONGENEX' : 'MonGenEx';
  const triggerCountPct = clamp(Math.round(+opts.triggerCountPercent || 50), 1, 100);
  const timeMin = +opts.excludeTimeMin || 0;          // 间隔 >= X 排除
  const countMaxEx = +opts.excludeCountMax || 0;      // 数量 <= X 排除
  const excludeMaps = opts.excludeMaps || [];
  const excludeMons = opts.excludeMons || [];
  const spawnSec = Math.max(1, Math.round(+opts.intervaled || 60));
  const clearSec = Math.max(1, Math.round(+opts.interval || 60));
  // 1. 筛选记录（虾米 0985：map/monster 存在、非排除、时间/数量排除）
  const rows = mg.spawns.filter(r => {
    const m = r.map, n = r.mon;
    if (!m || !n) return false;
    if (excludeMaps.includes(m) || excludeMons.includes(n)) return false;
    if (timeMin > 0 && (parseFloat(r.interval) || 0) >= timeMin) return false;
    if (countMaxEx > 0 && (parseInt(r.count, 10) || 0) <= countMaxEx) return false;
    return true;
  });
  if (!rows.length) return { ok: false, msg: '没有符合条件的刷怪行（请检查排除条件）' };
  // 2. 按地图分组 + 阈值（虾米：thresh = max(1, total * trigger_count_percent / 100)）
  const groups = {};
  for (const r of rows) { const m = r.map; (groups[m] = groups[m] || []).push(r); }
  const targets = [];
  for (const m of Object.keys(groups)) {
    const arr = groups[m];
    const total = arr.reduce((a, r) => a + (parseInt(r.count, 10) || 0), 0);
    targets.push({ m, arr, thresh: Math.max(1, Math.round(total * triggerCountPct / 100)) });
  }
  // 3. 生成刷新段（虾米 0985：每条记录独立 4 条件 + MONGENEX）
  const lines = ['[@' + DYNAMIC_NPC + ']', ';动态刷怪引擎: ' + engineName,
    ';人数>=' + people + ' 且怪物数量低于原始' + triggerCountPct + '%时，每条记录按触发概率' + tp + '%和刷怪概率' + sp + '%独立生成'];
  let generated = 0;
  for (const { m, arr } of targets) {
    for (const r of arr) {
      const x = parseInt(r.x, 10) || 0, y = parseInt(r.y, 10) || 0;
      const rg = parseInt(r.range, 10) || 0, ct = parseInt(r.count, 10) || 0;
      if (ct <= 0) continue;
      const extraTail = (r.extraCols && r.extraCols.length) ? ' ' + r.extraCols.join(' ') : '';
      lines.push('#IF',
        'CheckMapHumanCount ' + m + ' > ' + peopleCheck,
        'CheckMapMonCount ' + m + ' < ' + targets.find(t => t.m === m).thresh + ' 1',
        'RANDOMEX ' + tp + ' 100',
        'RANDOMEX ' + sp + ' 100',
        '#ACT',
        spawnCmd + ' ' + m + ' ' + x + ' ' + y + ' ' + r.mon + ' ' + rg + ' ' + ct + extraTail);
      generated++;
    }
  }
  if (generated <= 0) return { ok: false, msg: '没有生成有效动态刷怪记录，请检查数量、排除条件或原始 MonGen 数据' };
  // 4. 清除段（虾米：无人时 CLEARMAPMON + ClearItemMap 清地上物品）
  const clearLines = ['[@' + DYNAMIC_CLEAR + ']'];
  for (const { m } of targets) {
    clearLines.push('#IF',
      'CheckMapHumanCount ' + m + ' < ' + people,
      'CheckMonMap ' + m + ' 1',
      '#ACT',
      'CLEARMAPMON ' + m,
      'ClearItemMap ' + m);
  }
  // 4.5 移除被动态覆盖的静态 MonGen 行（蜗牛 index-342fb122:943-964：静态+动态同时刷会怪量叠加）
  const removeStatic = opts.removeStatic !== false;
  let monGenRemoved = 0;
  if (removeStatic && mg.rawLines) {
    backupMonGen(engineRoot, '动态刷怪前');
    const covered = new Set(rows.map(r => r.map + '\u0000' + r.mon));
    const removedIdx = new Set();
    for (const s of mg.spawns) if (covered.has(s.map + '\u0000' + s.mon)) removedIdx.add(s.lineIdx);
    if (removedIdx.size) {
      const newRaw = mg.rawLines.filter((_, i) => !removedIdx.has(i));
      preserveMonGenWrite(mg.file, newRaw, mg.newline);
      monGenRemoved = removedIdx.size;
    }
  }
  // 5. 写 RobotManage.txt（刷怪段 + 清除段）+ AutoRunRobot.txt（定时）
  const rmf = path.join(engineRoot, 'Mir200', 'Envir', 'Robot_def', 'RobotManage.txt');
  const arf = path.join(engineRoot, 'Mir200', 'Envir', 'Robot_def', 'AutoRunRobot.txt');
  if (opts.autoBackup !== false) {
    const robotBackup = (f) => { if (fs.existsSync(f)) fs.copyFileSync(f, f.replace(/\.txt$/, '_动态刷怪备份.txt')); };
    robotBackup(rmf); robotBackup(arf);
  }
  fs.mkdirSync(path.dirname(rmf), { recursive: true });
  const rmBlock = lines.concat(['BREAK', ''], clearLines, ['BREAK']);
  let rmContent = fs.existsSync(rmf) ? decodeBuf(fs.readFileSync(rmf)) : '';
  rmContent = rmContent.replace(/;元歌动态刷怪工具开始[\s\S]*?;元歌动态刷怪工具结束[\r\n]*/g, '');
  rmContent = rmContent.replace(/[\r\n]+$/, '');
  rmContent += '\r\n;元歌动态刷怪工具开始\r\n' + rmBlock.join('\r\n') + '\r\n;元歌动态刷怪工具结束\r\n';
  writeTextFile(rmf, rmContent);
  let arContent = fs.existsSync(arf) ? decodeBuf(fs.readFileSync(arf)) : '';
  arContent = arContent.replace(/;元歌动态刷怪工具开始[\s\S]*?;元歌动态刷怪工具结束[\r\n]*/g, '');
  arContent = arContent.replace(/[\r\n]+$/, '');
  arContent += '\r\n;元歌动态刷怪工具开始\r\n' +
    '#AutoRun NPC SEC ' + spawnSec + ' @' + DYNAMIC_NPC + '\r\n' +
    '#AutoRun NPC SEC ' + clearSec + ' @' + DYNAMIC_CLEAR + '\r\n' +
    ';元歌动态刷怪工具结束\r\n';
  writeTextFile(arf, arContent);
  // 6. 可选注入 QManage 定时器（复用 injectQManageTimer；#CALL RobotManage 段）
  let qmRes = null;
  if (opts.injectQmanage) {
    qmRes = injectQManageTimer(engineRoot, { label: '@' + DYNAMIC_NPC, timerId: opts.timerId, callFile: '..\\Robot_def\\RobotManage.txt', interval: opts.interval });
  }
  return { ok: true, records: generated, maps: targets.length, engine: engineName, spawnCmd, monGenRemoved,
    timerId: qmRes && qmRes.timerId,
    msg: '已生成 ' + generated + ' 条动态刷怪记录（' + targets.length + ' 张地图，引擎 ' + engineName + '）' + (monGenRemoved ? '；已移除静态行 ' + monGenRemoved + ' 条防叠加' : '') + (qmRes ? '；' + qmRes.msg : '') };
}

function extractCurrencies(engineRoot) {
  const { base, files } = listScriptFiles(engineRoot);
  if (!base) return { ok: false, msg: '未找到 Envir 目录（期望 Mir200\\Envir）' };
  const stat = {};
  for (const f of files) {
    let content;
    try { content = decodeBuf(fs.readFileSync(f)); } catch (e) { continue; }
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const r = matchCurrencyCmd(line);
      if (r) {
        const c = stat[r.currency] || (stat[r.currency] = { name: r.currency, count: 0, files: new Set() });
        c.count++;
        c.files.add(f.slice(base.length + 1));
      }
    }
  }
  const list = Object.values(stat)
    .sort((a, b) => b.count - a.count)
    .map(c => ({ name: c.name, count: c.count, fileCount: c.files.size }));
  return { ok: true, total: list.length, currencies: list };
}


// ==================== 快捷操作：一键备份（还原自原版"快捷操作"面板） ====================
// 备份 MonItems + Envir 关键脚本目录到 引擎根/Backup_时间戳/

function quickBackup(engineRoot, opts) {
  opts = opts || {};
  const mir = path.join(engineRoot, 'Mir200');
  const envir = path.join(mir, 'Envir');
  if (!fs.existsSync(envir)) return { ok: false, msg: '未找到 Mir200\\Envir 目录: ' + envir };
  const ts = new Date();
  const pad = n => String(n).padStart(2, '0');
  const stamp = ts.getFullYear() + pad(ts.getMonth() + 1) + pad(ts.getDate()) + '-' + pad(ts.getHours()) + pad(ts.getMinutes()) + pad(ts.getSeconds());
  const backDir = path.join(engineRoot, 'Backup_' + stamp);
  fs.mkdirSync(backDir, { recursive: true });
  const items = [
    { src: path.join(envir, 'MonItems'), name: 'MonItems' },
    { src: envir, name: 'Envir' },
    { src: path.join(mir, 'Data'), name: 'Data' }
  ];
  const copied = [], skipped = [], missing = [];
  for (const it of items) {
    const target = path.join(backDir, it.name);
    if (!fs.existsSync(it.src)) { missing.push(it.name); continue; }
    fs.mkdirSync(target, { recursive: true });
    copyTree(it.src, target, copied, skipped);
  }
  function copyTree(srcDir, dstDir, copied, skipped) {
    for (const f of fs.readdirSync(srcDir)) {
      const sp = path.join(srcDir, f);
      const dp = path.join(dstDir, f);
      if (fs.statSync(sp).isDirectory()) {
        fs.mkdirSync(dp, { recursive: true });
        copyTree(sp, dp, copied, skipped);
      } else {
        fs.copyFileSync(sp, dp);
        copied.push(f);
      }
    }
  }
  return {
    ok: true, backupDir: backDir,
    fileCount: copied.length,
    dirs: ['MonItems', 'Envir', 'Data'].filter(x => !missing.includes(x)),
    missing
  };
}


// ==================== NPC 工具（还原自原版"快捷操作"：左文件树+过滤 → 右脚本查看） ====================
// 默认关注的目录/文件（Envir 下）
const NPC_WATCH_DIRS = ['Market_Def', 'QuestDiary', 'Robot_def', 'MapQuest_def', 'Npc_def', 'MonItems'];

function listNpcFiles(engineRoot, opts) {
  opts = opts || {};
  const envir = path.join(engineRoot, 'Mir200', 'Envir');
  if (!fs.existsSync(envir)) return { ok: false, msg: '未找到 Mir200\\Envir' };
  const filter = (opts.filter || '').trim().toLowerCase();
  const custom = (opts.customDir || '').trim();
  const groups = [];
  // 1. 根目录脚本（QManage/QFunction 等）
  const rootFiles = fs.readdirSync(envir).filter(f => /.txt$/i.test(f)).sort();
  if (rootFiles.length) {
    const files = rootFiles.filter(f => !filter || f.toLowerCase().includes(filter)).map(f => ({ name: f, rel: 'Mir200\\Envir\\' + f }));
    if (files.length) groups.push({ dir: 'Envir 根目录', files });
  }
  // 2. 关注目录
  const dirs = [...NPC_WATCH_DIRS];
  if (custom) dirs.unshift(custom);
  const seen = new Set();
  for (const d of dirs) {
    if (seen.has(d)) continue;
    seen.add(d);
    const dp = path.join(envir, d);
    if (!fs.existsSync(dp) || !fs.statSync(dp).isDirectory()) continue;
    const files = [];
    const walk = (sub, prefix) => {
      let list;
      try { list = fs.readdirSync(sub); } catch (e) { return; }
      for (const f of list) {
        const fp = path.join(sub, f);
        const st = fs.statSync(fp);
        if (st.isDirectory()) walk(fp, prefix + f + '/');
        else if (/.txt$/i.test(f)) {
          if (!filter || (prefix + f).toLowerCase().includes(filter) || f.toLowerCase().includes(filter)) {
            files.push({ name: prefix + f, rel: 'Mir200\\Envir\\' + d + '\\' + prefix + f });
          }
        }
      }
    };
    walk(dp, '');
    files.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    if (files.length) groups.push({ dir: d, files });
  }
  // 总计数
  let total = 0;
  for (const g of groups) total += g.files.length;
  return { ok: true, groups, total };
}

function readScriptFile(engineRoot, rel) {
  // rel: 'Mir200\\Envir\\xxx.txt' 或 'Mir200\\Envir\\目录\\x.txt'（防路径穿越：解析后校验在 Envir 内）
  const resolved = path.resolve(engineRoot, rel.split('/').join('\\'));
  const envir = path.resolve(engineRoot, 'Mir200', 'Envir') + path.sep;
  if (!resolved.startsWith(envir)) return { ok: false, msg: '路径越界拒绝: ' + rel };
  const fp = resolved;
  if (!fs.existsSync(fp)) return { ok: false, msg: '文件不存在: ' + rel };
  try {
    const buf = fs.readFileSync(fp);
    // 尝试 GBK 解码；失败则 UTF8
    let content;
    try { content = decodeBuf(buf); } catch (e) { content = buf.toString('utf8'); }
    return { ok: true, content, rel, size: Buffer.byteLength(content, 'utf8') };   // 统一字节数（R3-13）
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

function saveScriptFile(engineRoot, rel, content) {
  // 防路径穿越：解析后校验在 Envir 内
  const resolved = path.resolve(engineRoot, rel.split('/').join('\\'));
  const envir = path.resolve(engineRoot, 'Mir200', 'Envir') + path.sep;
  if (!resolved.startsWith(envir)) return { ok: false, msg: '路径越界拒绝: ' + rel };
  const fp = resolved;
  if (!fs.existsSync(fp)) return { ok: false, msg: '文件不存在: ' + rel };
  try {
    writeTextFile(fp, content);
    return { ok: true, rel, size: Buffer.byteLength(content, 'utf8') };   // 统一字节数（R3-13）
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}


// ==================== 快捷操作（还原自原版 index-f856a6b2.js：一键打开常用文件/目录 + NPC列表） ====================
const QUICK_PATHS = [
  ['Mir200 目录', 'Mir200'],
  ['Envir 目录', 'Mir200/Envir'],
  ['NPC 文件(Npc_def)', 'Mir200/Envir/Npc_def'],
  ['NPC 目录(Market_Def)', 'Mir200/Envir/Market_Def'],
  ['刷怪文件(MonGen)', 'Mir200/Envir/MonGen.txt'],
  ['爆率目录(MonItems)', 'Mir200/Envir/MonItems'],
  ['机器人脚本(AutoRunRobot)', 'Mir200/Envir/Robot_def/AutoRunRobot.txt'],
  ['机器人触发(RobotManage)', 'Mir200/Envir/Robot_def/RobotManage.txt'],
  ['任务脚本(QuestDiary)', 'Mir200/Envir/QuestDiary'],
  ['地图事件(MapQuest_def)', 'Mir200/Envir/MapQuest_def'],
  ['怪物说话(MonSayMsg)', 'Mir200/Envir/MonSayMsg.txt'],
  ['地图配置(MapInfo)', 'Mir200/Envir/MapInfo.txt'],
  ['管理员列表(AdminList)', 'Mir200/Envir/AdminList.txt'],
  ['NPC注册(MerChant)', 'Mir200/Envir/MerChant.txt'],
  ['刷新点(StartPoint)', 'Mir200/Envir/StartPoint.txt'],
  ['行会目录(GuildBase)', 'Mir200/GuildBase'],
  ['共享数据(Share)', 'Mir200/Share'],
  ['账号数据库(DBServer)', 'DBServer']
];

// 解析 MerChant.txt → NPC 列表 [{path,map,x,y,name,script}]
function readMerChant(engineRoot) {
  const mf = merchantFile(engineRoot);
  if (!fs.existsSync(mf)) return { ok: false, msg: '未找到 MerChant.txt' };
  const content = decodeBuf(fs.readFileSync(mf));
  const npcs = [];
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(';')) continue;
    const parts = line.split(/\s+/);   // R3-14：空格分隔版 MerChant 也能解析（原 /\t+/ 把空格版全丢）
    if (parts.length < 5) continue;
    const npcPath = parts[0].trim();
    const map = parts[1].trim();
    const x = parts[2].trim();
    const y = parts[3].trim();
    const name = parts[4].trim();
    // 脚本文件：Market_Def\<npcPath>-<map>.txt（无则尝试 Market_Def\<npcPath>.txt）
    const base = path.join(engineRoot, 'Mir200', 'Envir', 'Market_Def');
    let script = null;
    const c1 = path.join(base, npcPath + '-' + map + '.txt');
    if (fs.existsSync(c1)) script = c1;
    else {
      const c2 = path.join(base, npcPath + '.txt');
      if (fs.existsSync(c2)) script = c2;
    }
    npcs.push({ path: npcPath, map, x, y, name, script });
  }
  return { ok: true, total: npcs.length, npcs };
}

// 按地图名/NPC名过滤
function filterNpcs(npcs, mapFilter, nameFilter) {
  const mf = (mapFilter || '').trim().toLowerCase();
  const nf = (nameFilter || '').trim().toLowerCase();
  return npcs.filter(n => (!mf || n.map.toLowerCase().includes(mf) || (n.name || '').toLowerCase().includes(mf)) &&
    (!nf || (n.name || '').toLowerCase().includes(nf) || n.path.toLowerCase().includes(nf)));
}


// ============ 物品管理（还原自快捷助手：备注/解包/商铺/套装） ============
function itemDescFile(engineRoot, top) {
  return path.join(engineRoot, 'Mir200', 'Envir', top ? 'ItemDescTopList.txt' : 'ItemDescList.txt');
}
// 物品备注格式：物品名=\颜色码/文本\颜色码/文本（\243 灰 \249 黄 \251 绿 \253 蓝 等）
function parseItemDescSegs(desc) {
  const segs = [];
  const re = /\\(\d+)\/([^\\]*)/g;
  let m;
  while ((m = re.exec(desc))) segs.push({ color: m[1], text: m[2] });
  if (!segs.length && desc) segs.push({ color: '243', text: desc });
  return segs;
}
function readItemDesc(engineRoot, top) {
  const f = itemDescFile(engineRoot, top);
  if (!fs.existsSync(f)) return { file: f, exists: false, items: [], count: 0 };
  const allLines = decodeBuf(fs.readFileSync(f)).split(/\r?\n/);
  const items = [];
  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    const t = line.trim();
    if (!t || t.startsWith(';')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const name = line.slice(0, eq).trim();
    const desc = line.slice(eq + 1);
    items.push({ name, raw: desc, segs: parseItemDescSegs(desc), lineNo: i });
  }
  return { file: f, exists: true, items, count: items.length, allLines };
}
function writeItemDesc(engineRoot, top, items, deletedLineNos) {
  // G3：按原行号替换，保留注释/空行/其他行；删除行清空原位；新项追加
  const f = itemDescFile(engineRoot, top);
  const prev = fs.existsSync(f) ? decodeBuf(fs.readFileSync(f)).split(/\r?\n/) : [];
  const byLine = new Map();
  for (const it of items) if (it.lineNo !== undefined) byLine.set(it.lineNo, it);
  const delSet = new Set(deletedLineNos || []);
  const ser = (it) => it.name + '=' + (it.raw !== undefined ? it.raw : it.segs.map(sg => '\\' + sg.color + '/' + sg.text).join(''));
  const out = prev.map((line, i) => {
    if (delSet.has(i)) return '';
    const it = byLine.get(i);
    return it ? ser(it) : line;
  });
  for (const it of items) if (it.lineNo === undefined) out.push(ser(it));
  writeTextFile(f, out.join('\r\n'));
  return { ok: true, count: items.length };
}
function addItemDesc(engineRoot, top, name, color, text) {
  const r = readItemDesc(engineRoot, top);
  const exists = r.items.find(x => x.name === name);
  if (exists) return { ok: false, msg: '已存在备注: ' + name };
  r.items.push({ name, segs: [{ color: color || '243', text: text || '' }] });
  writeItemDesc(engineRoot, top, r.items);
  return { ok: true, msg: '已添加 ' + name + ' 的备注' };
}
function delItemDesc(engineRoot, top, name) {
  const r = readItemDesc(engineRoot, top);
  const before = r.items.length;
  // G3：记录被删行的原行号，写入时清空对应行（保留注释/空行结构）
  const delLineNos = r.items.filter(x => x.name === name).map(x => x.lineNo);
  r.items = r.items.filter(x => x.name !== name);
  if (r.items.length === before) return { ok: false, msg: '未找到: ' + name };
  writeItemDesc(engineRoot, top, r.items, delLineNos);
  return { ok: true, msg: '已删除 ' + name };
}
// 物品解包 UnbindList.txt：物品ID 物品名
function readUnbindList(engineRoot) {
  const f = path.join(engineRoot, 'Mir200', 'Envir', 'UnbindList.txt');
  if (!fs.existsSync(f)) return { file: f, exists: false, items: [], count: 0 };
  const items = [];
  for (const line of decodeBuf(fs.readFileSync(f)).split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith(';')) continue;
    const m = t.match(/^(\d+)\s+(.+)$/);
    if (m) items.push({ id: parseInt(m[1], 10), name: m[2].trim() });
  }
  return { file: f, exists: true, items, count: items.length };
}
function writeUnbindList(engineRoot, items) {
  const lines = items.map(x => x.id + '\t' + x.name);
  writeTextFile(path.join(engineRoot, 'Mir200', 'Envir', 'UnbindList.txt'), lines.join('\r\n'));
  return { ok: true, count: items.length };
}
function addUnbindItem(engineRoot, id, name) {
  const r = readUnbindList(engineRoot);
  if (r.items.find(x => x.id === parseInt(id, 10))) return { ok: false, msg: '已存在 ID: ' + id };
  r.items.push({ id: parseInt(id, 10), name });
  writeUnbindList(engineRoot, r.items);
  return { ok: true, msg: '已添加解包 ' + id + ' ' + name };
}
function delUnbindItem(engineRoot, id) {
  const r = readUnbindList(engineRoot);
  const before = r.items.length;
  r.items = r.items.filter(x => x.id !== parseInt(id, 10));
  if (r.items.length === before) return { ok: false, msg: '未找到 ID: ' + id };
  writeUnbindList(engineRoot, r.items);
  return { ok: true, msg: '已删除解包 ' + id };
}
// 系统商铺 ShopItemList.txt：类型 物品名 价格 数量|... 说明
function readShopList(engineRoot) {
  const f = path.join(engineRoot, 'Mir200', 'Envir', 'ShopItemList.txt');
  if (!fs.existsSync(f)) return { file: f, exists: false, items: [], count: 0 };
  const items = [];
  for (const line of decodeBuf(fs.readFileSync(f)).split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith(';')) continue;
    const parts = t.split('\t');
    if (parts.length >= 2) items.push({ shopType: parts[0].trim(), name: parts[1].trim(), raw: line, parts });
  }
  return { file: f, exists: true, items, count: items.length };
}
// 物品套装 GroupItemList.txt（复杂格式，读+展示）
function readGroupItems(engineRoot) {
  const f = path.join(engineRoot, 'Mir200', 'Envir', 'GroupItemList.txt');
  if (!fs.existsSync(f)) return { file: f, exists: false, rows: [], count: 0 };
  const rows = [];
  for (const line of decodeBuf(fs.readFileSync(f)).split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith(';')) continue;
    const parts = t.split('\t');
    if (parts.length >= 4) {
      rows.push({ group: parts[0], type: parts[1], trigger: parts[2], members: parts[3].split('|'), parts });
    }
  }
  return { file: f, exists: true, rows, count: rows.length };
}

// ============ 融合：通用配置读写（快捷助手清单：复活/麻痹/护身/大刀卫士/怪物说话/怪物元素） ============
// 通用：读 Envir 下简单配置（跳过 ; 注释），返回 { file, exists, comments, items:[{cols, raw}] }
function readSimpleCfg(engineRoot, fileName) {
  const f = path.join(engineRoot, 'Mir200', 'Envir', fileName);
  if (!fs.existsSync(f)) return { file: f, exists: false, comments: [], items: [], count: 0 };
  const comments = [], items = [];
  for (const line of decodeBuf(fs.readFileSync(f)).split(/\r?\n/)) {
    const t = line.trim();
    if (!t) { continue; }
    if (t.startsWith(';')) { comments.push(line); continue; }
    const cols = t.split(/\s+/);
    items.push({ cols, raw: line });
  }
  return { file: f, exists: true, comments, items, count: items.length };
}
// 通用写回：保留注释行 + 数据行（join with \t）
function writeSimpleCfg(engineRoot, fileName, comments, items, joinCols) {
  const lines = [];
  for (const c of comments) lines.push(c);
  for (const it of items) {
    if (it.raw !== undefined) lines.push(it.raw);
    else lines.push(it.cols.join(joinCols || '\t'));
  }
  writeTextFile(path.join(engineRoot, 'Mir200', 'Envir', fileName), lines.join('\r\n'));
  return { ok: true, count: items.length };
}
// 各文件封装（快捷助手文件排版清单里的简单配置）
const SIMPLE_CFG_FILES = [
  ['RevivalItemList.txt', '复活戒指', '名称 复活间隔(秒) 恢复血量%'],
  ['ParalysisItemList.txt', '麻痹戒指', '名称 麻痹机率 麻痹时间'],
  ['MagicShieldItemList.txt', '护身戒指', '名称 掉蓝比例 伤害吸收(可选)'],
  ['GuardList.txt', '大刀卫士', '名称 区域 x y dir'],
  ['MonSayMsg.txt', '怪物说话', '状态 机率 颜色 怪物名称 文字'],
  ['MonSpAbilList.txt', '怪物元素', '怪物名 忽视防御 增伤 反弹 物减 魔减 麻痹 防麻 防毒 防火墙 防诱惑 破复活 破护身'],
];
function readSimpleFile(engineRoot, fileKey) {
  const hit = SIMPLE_CFG_FILES.find(x => x[0] === fileKey || x[1] === fileKey);
  if (!hit) return { ok: false, msg: '未知配置文件: ' + fileKey };
  const r = readSimpleCfg(engineRoot, hit[0]);
  return { ok: true, file: hit[0], label: hit[1], desc: hit[2], ...r };
}

// ============ 融合：端口一致性检查（虾米：检测端口冲突）+ 端口预设（快捷助手：预设3组） ============
function checkPortConsistency(engineRoot) {
  const r = readPortConfig(engineRoot);
  // 同文件内重复 = 真冲突（跨文件同端口是传奇服务端正常关联：主配置/!setup/各网关同端口）
  // 豁免规则：
  //  1. DBPort_MulThread 与 DBPort1 同端口（exempt 标记，多线程 DB 端口=第一 DB 端口）
  //  2. 主键与数字后缀键同值（GatePort/GatePort1/GatePort2、ServerPort/ServerPort1）——
  //     GEE/LF 引擎主键给 GameCenter 用，带数字后缀的组由 Count=N 决定启用，主/备组同值是模板常态，改之会误伤活动组
  const dups = [];
  for (const f of r.files) {
    const byPort = {};
    for (const e of f.entries) {
      if (e.exempt) continue;
      if (!byPort[e.port]) byPort[e.port] = [];
      byPort[e.port].push(e.key + '(L' + e.line + ')');
    }
    for (const [port, keys] of Object.entries(byPort)) {
      if (keys.length <= 1) continue;
      // 主/备组同值豁免：去掉行号、去掉尾部数字后的基名全相同 → 正常配置，跳过
      const baseNames = new Set(keys.map(k => k.replace(/\(L\d+\)$/, '').replace(/\d+$/, '')));
      if (baseNames.size === 1) continue;
      dups.push({ port: parseInt(port, 10), file: f.file, keys });
    }
  }
  dups.sort((a, b) => a.port - b.port);
  return { ok: dups.length === 0, dups, total: r.count };
}
// 端口预设：保存当前全部端口配置到 JSON（放工具目录）
function presetDir() {
  const base = process.env.APPDATA ? path.join(process.env.APPDATA, '元歌工具箱') : path.join(__dirname, 'presets');
  fs.mkdirSync(base, { recursive: true });
  return base;
}
function savePortPreset(engineRoot, name) {
  const r = readPortConfig(engineRoot);
  const data = { name, savedAt: new Date().toISOString(), files: r.files.map(f => ({ file: f.file, entries: f.entries.map(e => ({ key: e.key, port: e.port })) })) };
  const safe = (name || '预设').replace(/[\\/:*?"<>|]/g, '_');
  fs.writeFileSync(path.join(presetDir(), safe + '.json'), JSON.stringify(data, null, 1));
  return { ok: true, msg: '已保存预设: ' + safe + '（' + r.count + ' 个端口）' };
}
function listPortPresets() {
  const dir = presetDir();
  if (!fs.existsSync(dir)) return { ok: true, presets: [] };
  const presets = fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''));
  return { ok: true, presets };
}
function applyPortPreset(engineRoot, name) {
  const safe = (name || '').replace(/[\\/:*?"<>|]/g, '_');
  const f = path.join(presetDir(), safe + '.json');
  if (!fs.existsSync(f)) return { ok: false, msg: '未找到预设: ' + name + '（可用 --preset-list 查看）' };
  let data;
  try { data = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return { ok: false, msg: '预设文件损坏' }; }
  let changed = 0;
  for (const fobj of data.files || []) {
    const abs = path.join(engineRoot, fobj.file);
    if (!fs.existsSync(abs)) continue;
    let content;
    try { content = decodeBuf(fs.readFileSync(abs)); } catch (e) { continue; }
    let updated = content;
    for (const e of fobj.entries || []) {
      const re = new RegExp('^(' + e.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*=\\s*)\\d+', 'm');
      if (re.test(updated)) { updated = updated.replace(re, '$1' + e.port); changed++; }
    }
    if (updated !== content) { try { writeTextFile(abs, updated); } catch (err) { /* 跳过 */ } }
  }
  return { ok: true, msg: '已应用预设 ' + name + '（修改 ' + changed + ' 个端口）' };
}

// ============ 融合：地图事件 MapEvent.txt（快捷助手清单） ============
function readMapEvent(engineRoot) {
  const f = path.join(engineRoot, 'Mir200', 'Envir', 'MapEvent.txt');
  if (!fs.existsSync(f)) return { file: f, exists: false, items: [], count: 0 };
  const items = [];
  for (const line of decodeBuf(fs.readFileSync(f)).split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith(';')) continue;
    const cols = t.split(/\s+/);
    if (cols.length >= 2) items.push({ map: cols[0], cols, raw: line });
  }
  return { file: f, exists: true, items, count: items.length };
}

// ============ 安全区/地图配置（还原自快捷助手） ============
// 安全区 StartPoint.txt：地图 X Y 范围 类型 附加...
function readStartPoint(engineRoot) {
  const f = path.join(engineRoot, 'Mir200', 'Envir', 'StartPoint.txt');
  if (!fs.existsSync(f)) return { file: f, exists: false, rows: [], count: 0 };
  const rows = [];
  // 翎风格式：;地图号 座标X 座标Y 禁止说话 大小范围 光环类型 PKZONE PKFIRE
  for (const line of decodeBuf(fs.readFileSync(f)).split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith(';')) continue;
    const p = t.split(/\s+/);
    if (p.length >= 5) {
      rows.push({ map: p[0], x: parseInt(p[1], 10), y: parseInt(p[2], 10), noTalk: parseInt(p[3], 10), range: parseInt(p[4], 10), halo: parseInt(p[5] || 0, 10), pkzone: parseInt(p[6] || 0, 10), pkfire: parseInt(p[7] || 0, 10), raw: line });
    }
  }
  return { file: f, exists: true, rows, count: rows.length };
}
function writeStartPoint(engineRoot, rows) {
  // 翎风 8 列：地图号 X Y 禁止说话 大小范围 光环类型 PKZONE PKFIRE（旧行有 raw 原样保留）
  const lines = rows.map(r => (r.raw ? r.raw : [r.map, r.x, r.y, r.noTalk != null ? r.noTalk : 0, r.range != null ? r.range : 10, r.halo != null ? r.halo : 4, r.pkzone || 0, r.pkfire || 0].join(' ')));
  writeTextFile(path.join(engineRoot, 'Mir200', 'Envir', 'StartPoint.txt'), lines.join('\r\n'));
  return { ok: true, count: rows.length };
}
function addStartPoint(engineRoot, map, x, y, noTalk, range, halo) {
  const r = readStartPoint(engineRoot);
  r.rows.push({ map, x, y, noTalk: noTalk != null ? noTalk : 0, range: range != null ? range : 10, halo: halo != null ? halo : 4, pkzone: 0, pkfire: 0, raw: '' });
  writeStartPoint(engineRoot, r.rows);
  return { ok: true, msg: '已添加安全区 ' + map + ' ' + x + ',' + y + '（禁说' + (noTalk != null ? noTalk : 0) + ' 范围' + (range != null ? range : 10) + ' 光环' + (halo != null ? halo : 4) + '）' };
}
function delStartPoint(engineRoot, map, x, y) {
  const r = readStartPoint(engineRoot);
  const before = r.rows.length;
  r.rows = r.rows.filter(row => !(row.map === map && row.x === x && row.y === y));
  if (r.rows.length === before) return { ok: false, msg: '未找到 ' + map + ' ' + x + ',' + y };
  writeStartPoint(engineRoot, r.rows);
  return { ok: true, msg: '已删除 ' + map + ' ' + x + ',' + y };
}
// 地图配置 MapInfo.txt：[地图|标题 属性] + 传送门
function readMapInfo(engineRoot) {
  const f = path.join(engineRoot, 'Mir200', 'Envir', 'MapInfo.txt');
  if (!fs.existsSync(f)) return { file: f, exists: false, maps: [], links: [], count: 0 };
  const maps = [], links = [];
  for (const line of decodeBuf(fs.readFileSync(f)).split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith(';')) continue;
    const mm = t.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (mm) {
      const head = mm[1].trim();
      const props = mm[2].trim();
      // 与 exportSiteData 统一：先按 | 切，再取首段第一个空白 token 为 code；标题取空白后整段，无空白则取 | 后（虾米 8246-8254）
      const parts = head.split('|');
      const code = String(parts[0]).split(/[\s\t]+/)[0].trim();
      const titleM = head.match(/\s+([^\s].*)$/);
      const title = titleM ? titleM[1].trim().replace(/\s+/g, ' ') : (parts[1] || '').trim();
      maps.push({ code, title, props, raw: line });
    } else {
      const lm = t.match(/^(\S+)\s+([\d,]+)\s*->\s*(\S+)\s+([\d,]+)/);
      if (lm) links.push({ from: lm[1], fromXY: lm[2], to: lm[3], toXY: lm[4], raw: line });
    }
  }
  return { file: f, exists: true, maps, links, count: maps.length + links.length };
}
// 小地图 MiniMap.txt：地图 编号
function readMiniMap(engineRoot) {
  const f = path.join(engineRoot, 'Mir200', 'Envir', 'MiniMap.txt');
  if (!fs.existsSync(f)) return { file: f, exists: false, rows: [], count: 0 };
  const rows = [];
  for (const line of decodeBuf(fs.readFileSync(f)).split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith(';')) continue;
    const p = t.split(/\s+/);
    if (p.length >= 2) rows.push({ map: p[0], id: p[1], raw: line });
  }
  return { file: f, exists: true, rows, count: rows.length };
}
function writeMiniMap(engineRoot, rows) {
  const lines = rows.map(r => r.raw !== undefined ? r.raw : r.map + ' ' + r.id);
  writeTextFile(path.join(engineRoot, 'Mir200', 'Envir', 'MiniMap.txt'), lines.join('\r\n'));
  return { ok: true, count: rows.length };
}


// ============ 融合：编码往返校验（还原自虾米：写前严格往返解码检查防乱码） ============
function checkRoundTrip(str) {
  if (!iconv) return { ok: true, msg: '' };
  try {
    const back = iconv.decode(iconv.encode(str, 'gbk'), 'gbk');
    if (back === str) return { ok: true, msg: '' };
    // 找出有损字符
    const bad = [];
    for (const ch of str) {
      const e = iconv.encode(ch, 'gbk').toString('hex');
      const d = iconv.decode(Buffer.from(e, 'hex'), 'gbk');
      if (d !== ch) { bad.push(ch); if (bad.length >= 5) break; }
    }
    return { ok: false, msg: 'GBK 往返编码有损，无法安全写入: ' + bad.join(' ') };
  } catch (e) { return { ok: true, msg: '' }; }
}
// ============ 文件/目录对比（还原自虾米"文件对比"） ============
const IGNORE_DIRS = ['node_modules', '.git', 'BackUp', 'Log', 'Save', 'GuildBase', 'Notice', 'Market_Def', 'QuestDiary'];
function walkFiles(dir, base, out) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    const rel = base ? base + '/' + f : f;
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (IGNORE_DIRS.includes(f)) continue;
      walkFiles(full, rel, out);
    } else {
      out.push({ rel, full, size: st.size });
    }
  }
}
// 对比两个目录：返回 { onlyA, onlyB, same, diff:[{rel, aSize, bSize, lines:[{n,a,b}]}] }
function compareDirs(dirA, dirB, opts) {
  const o = opts || {};
  const ignore = o.ignore || IGNORE_DIRS;
  const a = [], b = [];
  walkFiles(dirA, '', a);
  walkFiles(dirB, '', b);
  const mapB = new Map(b.map(x => [x.rel, x]));
  const mapA = new Map(a.map(x => [x.rel, x]));
  const onlyA = [], onlyB = [], same = [], diff = [];
  for (const fa of a) {
    const fb = mapB.get(fa.rel);
    if (!fb) { onlyA.push(fa.rel); continue; }
    const eq = fa.size === fb.size && fs.readFileSync(fa.full).equals(fs.readFileSync(fb.full));
    if (eq) same.push(fa.rel);
    else {
      // 文本文件做行级对比
      const lines = compareTextLines(fa.full, fb.full, o.maxLines || 20);
      diff.push({ rel: fa.rel, aSize: fa.size, bSize: fb.size, lines });
    }
  }
  for (const fb of b) if (!mapA.has(fb.rel)) onlyB.push(fb.rel);
  onlyA.sort(); onlyB.sort(); same.sort();
  return { onlyA, onlyB, same, diff, aTotal: a.length, bTotal: b.length,
    summary: { onlyA: onlyA.length, onlyB: onlyB.length, same: same.length, diff: diff.length } };
}
// 文本行级对比（GBK 解码，返回前 N 个不同行）
function compareTextLines(fa, fb, maxLines) {
  const textExt = /\\.(txt|ini|json|cfg|lst|log|html|js)$/i;
  if (!textExt.test(fa) || !textExt.test(fb)) return [];
  let la, lb;
  try { la = decodeBuf(fs.readFileSync(fa)).split(/\r?\n/); } catch (e) { return []; }
  try { lb = decodeBuf(fs.readFileSync(fb)).split(/\r?\n/); } catch (e) { return []; }
  const out = [];
  const max = Math.max(la.length, lb.length);
  let shown = 0;
  for (let i = 0; i < max && shown < maxLines; i++) {
    const x = la[i] !== undefined ? la[i] : '（缺失）';
    const y = lb[i] !== undefined ? lb[i] : '（缺失）';
    if (x !== y) { out.push({ n: i + 1, a: x, b: y }); shown++; }
  }
  return out;
}

// ============ 一键服务端体检（整合引擎/端口/目录/网关） ============
function healthReport(engineRoot) {
  const checks = [];
  const issues = [];
  // 1. 引擎识别
  const eng = detectEngine(engineRoot);
  checks.push({ cat: '引擎', name: '引擎识别', ok: eng.ok, detail: eng.engine + (eng.sig ? '（特征 ' + eng.sig + '）' : '') + (eng.fileVersion ? ' v' + eng.fileVersion : '') });
  // 2. 核心文件存在性
  const core = [
    ['Mir200/M2Server.exe', 'M2 主程序'],
    ['Mir200/!setup.txt', 'M2 配置'],
    ['Mir200/Envir', 'Envir 目录'],
    ['Mir200/Envir/MonItems', '爆率目录'],
    ['Mir200/Envir/MonGen.txt', '刷怪配置'],
    ['DBServer/DBServer.exe', '数据库服务'],
    ['RunGate/RunGate.exe', 'RunGate'],
    ['SelGate/SelGate.exe', 'SelGate'],
    ['LoginGate/LoginGate.exe', 'LoginGate'],
  ];
  for (const [rel, name] of core) {
    const ok = fs.existsSync(path.join(engineRoot, rel));
    checks.push({ cat: '文件', name, ok, detail: ok ? '存在' : '缺失: ' + rel });
    if (!ok) issues.push('核心文件缺失: ' + rel);
  }
  // 3. 目录键
  const setup = path.join(engineRoot, 'Mir200', '!setup.txt');
  if (fs.existsSync(setup)) {
    const content = decodeBuf(fs.readFileSync(setup));
    for (const key of SETUP_DIR_KEYS) {
      const m = content.match(new RegExp('^' + key + '\\s*=\\s*(.+)$', 'm'));
      if (m) {
        const val = m[1].trim();
        const ok = fs.existsSync(val) || fs.existsSync(path.join(engineRoot, val.replace(/^\\/, ''))) || fs.existsSync(path.join(engineRoot, 'Mir200', val.replace(/^\\/, '')));
        checks.push({ cat: '目录键', name: key, ok, detail: val });
        if (!ok) issues.push('目录键 ' + key + ' 不存在: ' + val);
      }
    }
  }
  // 4. 端口一致性
  const cc = checkPortConsistency(engineRoot);
  checks.push({ cat: '端口', name: '端口一致性', ok: cc.ok, detail: cc.total + ' 个端口' + (cc.dups.length ? '，' + cc.dups.length + ' 组重复' : '，无重复') });
  if (!cc.ok) for (const d of cc.dups.slice(0, 5)) issues.push('端口 ' + d.port + ' 被多处使用: ' + d.keys.join(', '));
  // 5. DB 端口一致性（!setup DBPort vs DBServer）
  if (fs.existsSync(setup)) {
    const content = decodeBuf(fs.readFileSync(setup));
    const dbPort = (content.match(/^DBPort\s*=\s*(\d+)/m) || [])[1];
    const dbs = path.join(engineRoot, 'DBServer', 'dbsrc.ini');
    if (dbPort && fs.existsSync(dbs)) {
      const dc = decodeBuf(fs.readFileSync(dbs));
      const dm = (dc.match(/^ServerPort\s*=\s*(\d+)/m) || [])[1];
      const ok = dm === dbPort;
      checks.push({ cat: '端口', name: 'DB 端口一致性', ok, detail: '!setup=' + dbPort + ' / DBServer=' + dm });
      if (!ok) issues.push('!setup.txt DBPort=' + dbPort + ' 与 DBServer ServerPort=' + dm + ' 不一致');
    }
  }
  const okCount = checks.filter(c => c.ok).length;
  const score = checks.length ? Math.round(okCount / checks.length * 100) : 0;
  return { ok: issues.length === 0, score, checks, issues, engine: eng, total: checks.length, okCount };
}

// ============ 开区网站生成（还原自虾米"网站管理"：多页面 + 爆率查询 + 地图走法 + 后台发布） ============
const SITE_SKINS = {
  dark: { bg: '#1a1a2e', card: '#16213e', fg: '#e0e0e0', accent: '#e94560', title: '#e94560' },
  gold: { bg: '#2d2010', card: '#3e2d1a', fg: '#f5e6c8', accent: '#ffd700', title: '#ffd700' },
  blue: { bg: '#0f2027', card: '#203a43', fg: '#e8f1f2', accent: '#00b4d8', title: '#48cae4' },
  green: { bg: '#0b1f17', card: '#16382a', fg: '#e8f5e9', accent: '#4caf50', title: '#81c784' },
  light: { bg: '#f5f5f5', card: '#ffffff', fg: '#333333', accent: '#ff5722', title: '#d84315' },
};
// ============ 开区网站生成 v2（升级：还原自虾米"网站管理"——多页面+爆率查询+QQ群+下载） ============
// 全服爆率导出：monsters（怪物->[物品+概率]）+ items（物品->[怪]）——供 droprate.html 查询
// ============ 开区网站生成 v3（对齐虾米"网站管理"：hero 指标卡+4模式联动查询+地图走法） ============
// 站点数据导出：monsters(items) + maps(地图怪+传送走法) + npcs + routes(地图走法链)
function exportSiteData(engineRoot) {
  const env = path.join(engineRoot, 'Mir200', 'Envir');
  // MapInfo：地图名映射 + 传送关系 + 别名
  const mapNames = {}, mapAliases = {}, routes = [], mapKeyIndex = [];
  try {
    const mi = decodeBuf(fs.readFileSync(path.join(env, 'MapInfo.txt')));
    for (const raw of mi.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith(';')) continue;
      const m = line.match(/^\[([^\]]+)\]/);
      if (m) {
        const head = m[1];
        const parts = head.split('|');
        const code = String(parts[0]).split(/[\s\t]+/)[0].trim();
        const nameM = head.match(/\s+([^\s].*)$/);
        const name = (nameM ? nameM[1].trim() : code).replace(/\s+/g, ' ');
        mapNames[code] = name;
        for (const a of parts.slice(1)) { const am = a.match(/^([^\s]+)/); if (am) mapAliases[am[1].trim()] = code; }
        continue;
      }
      const t = line.match(/^([A-Za-z0-9_]+)\s+(-?\d+),(-?\d+)\s*->\s*([A-Za-z0-9_]+)\s+(-?\d+),(-?\d+)/);
      if (t) routes.push({ from: t[1], to: t[4], from_x: +t[2], from_y: +t[3], to_x: +t[5], to_y: +t[6], from_name: mapNames[t[1]] || t[1], to_name: mapNames[t[4]] || t[4] });
    }
  } catch (e) { /* 忽略 */ }
  const nameOf = (code) => mapNames[code] || mapNames[mapAliases[code]] || code;
  // MonGen：怪 spawns + 地图怪（readMonGen 返回 {spawns}，字段 map/mon/count/time）
  const spawnsByMon = {}, mapMonsters = {};
  try {
    const mg = readMonGen(engineRoot);
    for (const row of (mg && mg.spawns) || []) {
      const mon = String(row.mon || '').trim(), mc = String(row.map || '').trim();
      if (!mon || !mc) continue;
      if (!spawnsByMon[mon]) spawnsByMon[mon] = [];
      if (spawnsByMon[mon].length < 30) spawnsByMon[mon].push({ map: mc, x: +row.x || 0, y: +row.y || 0, count: +row.count || 1, time: +row.time || 0, time_text: '' });
      if (!mapMonsters[mc]) mapMonsters[mc] = new Set();
      if (mapMonsters[mc].size < 60) mapMonsters[mc].add(mon);
    }
  } catch (e) { /* 忽略 */ }
  // maps + map_index（key 唯一索引）——合并 MapInfo 地图 + MonGen 出现的代码（地图查询需 resolve）
  const maps = [], allMapKeys = new Set([...Object.keys(mapNames), ...Object.keys(mapAliases), ...Object.keys(mapMonsters)]);
  let ki = 0;
  for (const code of allMapKeys) {
    const nm = nameOf(code);
    if (!nm) continue;
    maps.push({ code, name: nm });
    const key = code + '_' + (ki++);
    mapKeyIndex.push({ key, code, name: nm });
  }
  // MerChant：NPC（+ NPC 传送走法 via:'npc'——还原虾米：MerChant NPC + Market_Def 脚本 mapmove）
  const npcs = [];
  const npcRoutes = [];
  try {
    const r = readMerChant(engineRoot);
    for (const n of (r && r.npcs) || []) {
      const nm = (n.name || n.path || '').trim();
      if (!nm || npcs.length > 2000) continue;
      npcs.push({ npc: nm, label: nm, map: String(n.map || ''), map_name: nameOf(n.map) || n.map || '', x: +n.x || 0, y: +n.y || 0, scripts: [], give: [], take: [], teleports: [] });
      // NPC 传送走法：读 Market_Def 脚本里的 mapmove 目标（如 地图/上古之地-dtmc.txt → mapmove 0613005 134 63）
      if (n.script && fs.existsSync(n.script) && npcRoutes.length < 4000) {
        try {
          const sc = decodeBuf(fs.readFileSync(n.script));
          const mm = sc.match(/(?:^|\n)\s*(?:#act\s*)?mapmove\s+(\S+)\s+(-?\d+)\s+(-?\d+)/i);
          if (mm) {
            npcRoutes.push({
              from: String(n.map || ''), to: mm[1], from_x: +n.x || 0, from_y: +n.y || 0, to_x: +mm[2], to_y: +mm[3],
              from_name: nameOf(n.map) || n.map || '', to_name: nameOf(mm[1]) || mm[1], via: 'npc', npc: nm
            });
          }
        } catch (e) { /* 单个 NPC 解析失败忽略 */ }
      }
    }
  } catch (e) { /* 忽略 */ }
  routes.push(...npcRoutes);
  // MonItems：怪掉落（den 换算）
  const files = listMonFiles(engineRoot);
  const monsters = [];
  const itemDrops = {};
  for (const mon of files) {
    const rf = readMonFile(engineRoot, mon);
    const items = [];
    // 组概率（#CHILD 1/N）累积：组内子项出处 den 需乘外层组 den（嵌套组累乘）——修复万年树妖 1/1→1/2
    let groupStack = [], curMul = 1;
    for (const it of rf.items) {
      if (it.kind === 'paren') {
        const isOpen = String(it.raw || '').trim() === '(';
        if (!isOpen && groupStack.length) curMul = groupStack.pop();
        continue;
      }
      if (it.kind === 'child') {
        const den = it.num > 1 ? Math.max(1, Math.round(it.rate / it.num)) : (it.rate >= 1 ? it.rate : 0);
        groupStack.push(curMul);
        curMul = Math.max(1, Math.round(curMul * den));
        items.push({ name: '#随机组', den, group_den: curMul });
        continue;
      }
      if (it.kind === 'rate') {
        const den = it.num > 1 ? Math.max(1, Math.round(it.rate / it.num)) : (it.rate >= 1 ? it.rate : 0);
        const effectiveDen = Math.max(1, Math.round(den * curMul));   // 子项 den × 组概率（组外 curMul=1）
        items.push({ name: it.item, den: effectiveDen, group_den: curMul });
        if (effectiveDen > 0) { (itemDrops[it.item] = itemDrops[it.item] || {})[mon] = effectiveDen; }
      }
    }
    if (items.length) monsters.push({ monster: mon, spawns: spawnsByMon[mon] || [], items });
  }
  // item_drops 转数组格式 {item: [[mon, den],...]}
  const itemDropsArr = {};
  for (const [item, mp] of Object.entries(itemDrops)) itemDropsArr[item] = Object.entries(mp).map(([mon, den]) => [mon, den]);
  const allMonsters = monsters.map(m => m.monster);
  // 服务端物品清单（虾米 695 = MonItems 有出处 375 + 清单无出处 320）：读 EnableMakeItem/FilterItemList 等 txt 合并进全部物品（「显示全部」勾选可见无掉落物品）
  const listed = new Set();
  const LIST_FILES = ['EnableMakeItem.txt', 'EnablePickUpItem.txt', 'GameLogItemNameList.txt', 'FilterItemList.txt', 'ItemDescList.txt', 'ItemDescTopList.txt', 'GroupItemList.txt', 'ItemRuleList.txt'];
  for (const lf of LIST_FILES) {
    const lfp = path.join(env, lf);
    if (!fs.existsSync(lfp)) continue;
    try {
      for (const raw of decodeBuf(fs.readFileSync(lfp)).split(/\r?\n/)) {
        const t = raw.trim();
        if (!t || t.startsWith(';')) continue;
        let name = t;
        if (t.includes('\t')) name = t.split('\t')[1] || t.split('\t')[0];   // FilterItemList: 1\t物品名\t...
        else if (t.includes('=')) name = t.split('=')[0].trim();             // ItemDescList: 物品名=\243/...
        name = name.trim();
        if (name && !/^=+$/.test(name) && name.length <= 40) listed.add(name);
      }
    } catch (e) { /* 单个清单解析失败忽略 */ }
  }
  const allItems = [...new Set([...Object.keys(itemDropsArr), ...listed])];
  return { schema_version: 1, generated_at: new Date().toISOString(), all_items: allItems, all_items_db: allItems, all_monsters: allMonsters,
    monsters, item_drops: itemDropsArr, maps, routes, map_index: mapKeyIndex, npcs, detail_file: '',
    meta: { monsterCount: monsters.length, itemCount: allItems.length, mapCount: maps.length, npcCount: npcs.length } };
}// 兼容旧调用
function exportDroprateJson(engineRoot) {
  const d = exportSiteData(engineRoot);
  return { monsters: d.monsters, items: d.items, generated: d.meta.generated, monsterCount: d.meta.monsterCount, itemCount: d.meta.itemCount };
}
// ============ 移植：远端同步（还原自 1.3.6 _WebsiteManagerPage：工具箱间 HTTP 同步爆率查询数据 + token 鉴权）============
// 推送本地爆率查询数据到远端（远端地址格式 http://ip:port）
// opts: { url 远端地址, token 远端密钥, root 引擎根, queryId 指定推送的查询id(默认全部) }
async function remotePush(engineRoot, opts = {}) {
  const { url, token, queryId } = opts;
  if (!url) return { ok: false, msg: '未填写远端地址' };
  const outDir = path.join(engineRoot, '开区网站');
  const dataDir = path.join(outDir, 'data');
  const siteJson = path.join(dataDir, 'site.json');
  if (!fs.existsSync(siteJson)) return { ok: false, msg: '未找到 site.json（请先生成网站）' };
  let site;
  try { site = JSON.parse(decodeBuf(fs.readFileSync(siteJson))); } catch (e) { return { ok: false, msg: 'site.json 解析失败' }; }
  const queries = (site.drop_queries || []).filter(q => q && q.id);
  const targets = queryId ? queries.filter(q => String(q.id) === String(queryId)) : queries;
  if (!targets.length) return { ok: false, msg: '没有可推送的爆率查询' };
  const pushed = [];
  for (const q of targets) {
    const payload = { query: q, files: {} };
    const df = path.join(dataDir, q.data_file || ('droprate_' + q.id + '.json'));
    if (fs.existsSync(df)) {
      payload.files.droprate = { name: path.basename(df), b64: fs.readFileSync(df).toString('base64') };
    }
    const base = String(url).replace(/\/+$/, '');
    const res = await fetch(base + '/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Token': token } : {}) },
      body: JSON.stringify(payload),
    });
    const txt = await res.text();
    if (res.ok) pushed.push(q.name || q.id);
    else return { ok: false, msg: '推送 ' + (q.name || q.id) + ' 失败: HTTP ' + res.status + ' ' + txt.slice(0, 100) };
  }
  return { ok: true, pushed, msg: '已推送 ' + pushed.length + ' 个爆率查询到 ' + url };
}
// 接收端 HTTP 服务：监听端口，接收远端同步（token 校验）→ 写 data/droprate_{id}.json + 更新 site.json
// opts: { port, token, outputDir 网站目录(默认 引擎根/开区网站), quiet }
function remoteListen(engineRoot, opts = {}) {
  const http = require('http');
  const port = opts.port !== undefined ? +opts.port : 8000;
  const token = String(opts.token || '');
  const outDir = opts.outputDir || path.join(engineRoot, '开区网站');
  const dataDir = path.join(outDir, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const readSiteJson = () => {
    const sj = path.join(dataDir, 'site.json');
    if (!fs.existsSync(sj)) return { drop_queries: [] };
    try { return JSON.parse(fs.readFileSync(sj, 'utf8')); } catch (e) { return { drop_queries: [] }; }
  };
  const server = http.createServer((req, res) => {
    const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
    if (req.method !== 'POST' || req.url.split('?')[0] !== '/api/sync') return send(404, { ok: false, msg: 'not found' });
    const got = String(req.headers['x-token'] || '');
    if (token && got !== token) return send(403, { ok: false, msg: 'token 无效' });
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 64 * 1024 * 1024) { try { res.end(JSON.stringify({ ok: false, msg: 'payload 过大（>64MB）' })); } catch (e) { /* 已断开 */ } req.destroy(); } });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const q = payload.query || {};
        const qid = String(q.id || '').replace(/[^a-zA-Z0-9_-]/g, '') || ('q' + Date.now());
        const files = payload.files || {};
        // 写 droprate 数据
        const dr = files.droprate;
        if (dr && dr.b64) {
          const raw = Buffer.from(String(dr.b64), 'base64');
          const fn = 'droprate_' + qid + '.json';
          fs.writeFileSync(path.join(dataDir, fn), raw);
          q.data_file = fn;
        }
        // 写 site.json（追加/更新 drop_queries，UTF-8）
        const site = readSiteJson();
        const list = Array.isArray(site.drop_queries) ? site.drop_queries.filter(x => x && String(x.id) !== qid) : [];
        list.push(q);
        site.drop_queries = list;
        fs.writeFileSync(path.join(dataDir, 'site.json'), JSON.stringify(site, null, 1), 'utf8');
        send(200, { ok: true, msg: '已接收 ' + (q.name || qid), id: qid });
      } catch (e) { send(400, { ok: false, msg: '解析失败: ' + e.message }); }
    });
  });
  server.listen(port, () => { server._ready = true; });
  server.on('error', (e) => { server._listenErr = e.message; });   // 记录失败（端口占用等），供调用方查 server._listenErr
  return { ok: true, server, port, msg: '远端同步服务已启动，监听 ' + port + '（POST /api/sync' + (token ? '，需 token' : '，无鉴权') + '）' };
}
// 生成开区网站（含 applyConfig 发布配置 / 多皮肤 / 爆率查询站）


function genOpenSite(engineRoot, opts) {
  const o = opts || {};
  // 后台发布：applyConfig 从导出的配置文件读取站点参数（对齐虾米"发布"动作）——须在 gameName/qqGroups 读取前
  if (o.applyConfig && fs.existsSync(o.applyConfig)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(o.applyConfig, 'utf8'));
      if (!o.title) o.title = cfg.title || cfg.gameName;
      if (!o.desc) o.desc = cfg.desc;
      if (!o.downloadUrl) o.downloadUrl = cfg.downloadUrl;
      if (!o.qqGroups) o.qqGroups = (cfg.qqGroups || []).join(',');
      if (!o.versions) o.versions = (cfg.versions || []).join(',');
      if (!o.announce) o.announce = (cfg.announce || []).join(',');
      if (!o.skin) o.skin = cfg.skin;
      if (cfg.site_enabled !== undefined) o.maint = cfg.site_enabled === false;
      if (!o.maintMsg) o.maintMsg = cfg.maintMsg;
    } catch (e) { /* 配置读取失败则忽略 */ }
  }
  const skin = SITE_SKINS[o.skin] || SITE_SKINS.dark;
  let gameName = o.title || '传奇服务端';
  let version = '';
  try {
    const cfg = path.join(engineRoot, 'Config.ini');
    if (fs.existsSync(cfg)) {
      const c = decodeBuf(fs.readFileSync(cfg));
      const m = c.match(/^GameName\s*=\s*(.+)$/m);
      if (m && !o.title) gameName = m[1].trim();
      const v = c.match(/^GameVersion\s*=\s*(.+)$/m);
      if (v) version = v[1].trim();
    }
  } catch (e) { /* 忽略 */ }
  const qqGroups = (o.qqGroups || '').split(/[,，\n]/).map(x => x.trim()).filter(Boolean);
  const downloadUrl = o.downloadUrl || '';
  const desc = o.desc || '欢迎来到我们的传奇世界！';
  const versions = (o.versions || '').split(/[,，\n]/).map(x => x.trim()).filter(Boolean);
  // F-P1-5：每日新区/快餐服/单职业 三卡片参数（原 renderer/CLI 传了但被丢弃）
  const newZones = (o.newZones || '').split(/[,，\n]/).map(x => x.trim()).filter(Boolean);
  const fastZones = (o.fastZones || '').split(/[,，\n]/).map(x => x.trim()).filter(Boolean);
  const soloZones = (o.soloZones || '').split(/[,，\n]/).map(x => x.trim()).filter(Boolean);
  const announce = (o.announce || '').split(/[,，\n]/).map(x => x.trim()).filter(Boolean);
  const skipDroprate = !!o.skipDroprate;
  const maint = !!o.maint;
  const withAdmin = !!o.admin;
  let data = null;
  if (!skipDroprate) { try { data = exportSiteData(engineRoot); } catch (e) { data = null; } }
  const outDir = o.output || path.join(engineRoot, '开区网站');
  fs.mkdirSync(outDir, { recursive: true });
  const files = [];
  const C = (s) => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = `*{box-sizing:border-box;margin:0;padding:0}
body{background:${skin.bg};color:${skin.fg};font-family:'Microsoft YaHei','PingFang SC',sans-serif;line-height:1.6}
a{color:inherit;text-decoration:none}
.header{position:sticky;top:0;z-index:50;background:color-mix(in srgb,${skin.bg} 88%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid ${skin.accent}22}
.inner{max-width:1160px;margin:0 auto;padding:0 22px;display:flex;align-items:center;justify-content:space-between;height:64px}
.brand h1{font-size:20px;color:${skin.title};letter-spacing:1px}
.brand .sub{font-size:12px;opacity:.6}
.nav{display:flex;gap:26px}
.nav a{position:relative;padding:6px 2px;opacity:.8;font-size:14px}
.nav a::after{content:'';position:absolute;left:0;bottom:0;width:0;height:2px;background:${skin.accent};transition:width .25s}
.nav a:hover::after,.nav a.active::after{width:100%}
.nav a.active{opacity:1;color:${skin.accent}}
.hero{position:relative;overflow:hidden;padding:88px 0 68px;border-bottom:1px solid ${skin.accent}22}
.hero::before{content:'';position:absolute;inset:0;background:radial-gradient(800px 300px at 30% 0%,${skin.accent}22,transparent),radial-gradient(600px 260px at 80% 100%,${skin.accent}18,transparent)}
.wrap{max-width:1160px;margin:0 auto;padding:0 22px;position:relative}
.hero-copy{max-width:720px}
.eyebrow{display:inline-block;font-size:12px;letter-spacing:3px;color:${skin.accent};border:1px solid ${skin.accent}44;padding:4px 14px;border-radius:99px;margin-bottom:20px;text-transform:uppercase}
.hero-copy h2{font-size:42px;color:${skin.title};margin-bottom:14px;font-weight:800}
.hero-copy p{opacity:.8;font-size:16px;margin-bottom:28px}
.hero-actions{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:34px}
.btn-dl{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 30px;border-radius:10px;background:${skin.accent};color:#fff;font-size:15px;font-weight:600;transition:transform .15s,box-shadow .15s;box-shadow:0 6px 22px ${skin.accent}33}
.btn-dl:hover{transform:translateY(-2px)}
.btn-dl.btn-outline{background:transparent;border:1px solid ${skin.accent};color:${skin.accent};box-shadow:none}
.hero-metrics{display:flex;gap:16px;flex-wrap:wrap}
.metric-card{background:${skin.card};border:1px solid ${skin.accent}26;border-radius:12px;padding:14px 26px;min-width:120px;text-align:center}
.metric-value{display:block;font-size:26px;font-weight:800;color:${skin.accent}}
.metric-label{font-size:12px;opacity:.65}
.section{padding:56px 0}
.section-alt{background:${skin.card}66;border-top:1px solid ${skin.accent}22;border-bottom:1px solid ${skin.accent}22}
.sec-title{margin-bottom:26px}
.sec-title h3{font-size:24px;color:${skin.title}}
.eyebrow-small{display:block;font-size:12px;letter-spacing:2px;color:${skin.accent};margin-bottom:6px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px}
.panel{background:${skin.card};border:1px solid ${skin.accent}22;border-radius:14px;padding:24px}
.panel h4{color:${skin.accent};font-size:16px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid ${skin.accent}22}
.panel li{list-style:none;padding:6px 0;border-bottom:1px dashed ${skin.accent}11;font-size:14px}
.empty-state{padding:30px 0;text-align:center;opacity:.6}
.qq-item{display:flex;justify-content:space-between;align-items:center;background:${skin.bg};border-radius:10px;padding:10px 14px;margin:8px 0}
.btn-sm{background:${skin.accent};color:#fff;border:none;border-radius:8px;padding:8px 18px;cursor:pointer;font-size:13px}
.footer{text-align:center;padding:34px 0;opacity:.55;font-size:13px}
/* droprate */
.toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:18px}
.navBtn{padding:9px 18px;border-radius:9px;border:1px solid ${skin.accent}55;background:transparent;color:${skin.fg};cursor:pointer;font-size:14px}
.navBtn.active{background:${skin.accent};color:#fff;border-color:${skin.accent}}
.navBtn.disabled{opacity:.4;cursor:not-allowed}
.sel,.mini{padding:9px 12px;border-radius:9px;border:1px solid ${skin.accent}55;background:${skin.bg};color:${skin.fg};font-size:13px;cursor:pointer}
.searchbar{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.searchbar input{flex:1;min-width:220px;padding:12px 16px;border-radius:10px;border:1px solid ${skin.accent}55;background:${skin.bg};color:${skin.fg};font-size:15px;outline:none}
.searchbar input:focus{border-color:${skin.accent}}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}
.col{background:${skin.card};border:1px solid ${skin.accent}22;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;min-height:340px}
.colH{padding:14px 16px;border-bottom:1px solid ${skin.accent}22}
.colTitle{display:flex;align-items:baseline;justify-content:space-between}
.colTitle span{font-weight:700;color:${skin.accent}}
.colTitle small{opacity:.55;font-size:12px}
.colSearch input{width:100%;margin-top:8px;padding:8px 10px;border-radius:8px;border:1px solid ${skin.accent}33;background:${skin.bg};color:${skin.fg};font-size:13px;outline:none}
.listWrap{flex:1;overflow-y:auto;max-height:480px}
.row{padding:9px 16px;border-bottom:1px dashed ${skin.accent}11;cursor:pointer;font-size:13px;display:flex;justify-content:space-between;gap:8px}
.row:hover{background:${skin.accent}11}
.row .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.row .rt{color:${skin.accent};font-size:12px;flex-shrink:0}
.row.dim{opacity:.45}
.hint{padding:20px;text-align:center;opacity:.5;font-size:13px}
.ver-pill{background:${skin.accent}22;border:1px solid ${skin.accent}55;color:${skin.accent};padding:6px 14px;border-radius:99px;font-size:12px}
.check{display:inline-flex;align-items:center;gap:6px;font-size:13px;opacity:.85;cursor:pointer}`;
  // ============ index.html（对齐虾米：hero+指标卡+版本+公告/社群） ============
  const eng = detectEngine(engineRoot);
  const maintBar = maint ? '<div style="background:#e74c3c;color:#fff;text-align:center;padding:12px 20px;font-weight:700;font-size:15px">⛔ 网站维护中：' + C(o.maintMsg || '服务器维护中，暂未开放，请稍后再来') + '</div>' : '';
  const indexHtml = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${C(gameName)} - 官网首页</title><style>${css}</style></head><body>
${maintBar}<header class="header"><div class="inner">
  <div class="brand"><h1>${C(gameName)}</h1><div class="sub">Legend of Mir 2 Private Server</div></div>
  <nav class="nav"><a href="./index.html" class="active">官网首页</a><a href="./droprate.html">爆率查询</a></nav>
</div></header>
<div class="hero"><div class="wrap hero-copy">
  <div class="eyebrow">Legend Portal</div>
  <h2>玛法大陆，再启征程</h2>
  <p>${C(desc)}</p>
  <div class="hero-actions">
    <a href="#versions" class="btn-dl">查看版本情报</a>
    <a href="./droprate.html" class="btn-dl btn-outline">爆率查询</a>
    ${downloadUrl ? '<a class="btn-dl btn-outline" href="' + C(downloadUrl) + '">下载登录器</a>' : ''}
  </div>
  <div class="hero-metrics">
    <div class="metric-card"><span class="metric-value">${String(versions.length).padStart(2, '0')}</span><span class="metric-label">版本入口</span></div>
    <div class="metric-card"><span class="metric-value">${String(qqGroups.length).padStart(2, '0')}</span><span class="metric-label">社群通道</span></div>
    <div class="metric-card"><span class="metric-value">${data ? 'ON' : 'OFF'}</span><span class="metric-label">查询状态</span></div>
  </div>
</div></div>
<section class="section" id="versions"><div class="wrap">
  <div class="sec-title"><span class="eyebrow-small">Server Chronicle</span><h3>热门版本与新区情报</h3></div>
  ${versions.length ? '<div class="grid">' + versions.map(v => '<div class="panel"><h4>🎮 ' + C(v) + '</h4><p style="opacity:.7;font-size:13px">版本入口已开放</p></div>').join('') + '</div>'
    : '<div class="panel empty-state"><p>版本内容正在准备中</p><p style="font-size:13px;opacity:.6;margin-top:8px">可在后台配置开区版本（--versions）</p></div>'}
  ${(newZones.length || fastZones.length || soloZones.length) ? '<div class="grid" style="margin-top:14px">' +
    (newZones.length ? '<div class="panel"><h4>🆕 每日新区</h4>' + newZones.map(z => '<p style="opacity:.75;font-size:13px;margin:4px 0">' + C(z) + '</p>').join('') + '</div>' : '') +
    (fastZones.length ? '<div class="panel"><h4>⚡ 快餐服</h4>' + fastZones.map(z => '<p style="opacity:.75;font-size:13px;margin:4px 0">' + C(z) + '</p>').join('') + '</div>' : '') +
    (soloZones.length ? '<div class="panel"><h4>🎯 单职业</h4>' + soloZones.map(z => '<p style="opacity:.75;font-size:13px;margin:4px 0">' + C(z) + '</p>').join('') + '</div>' : '') +
  '</div>' : ''}
</div></section>
<section class="section section-alt" id="info"><div class="wrap">
  <div class="sec-title"><span class="eyebrow-small">War Room</span><h3>公告、社群与指挥入口</h3></div>
  <div class="grid">
    <div class="panel"><h4>📢 游戏公告</h4>${announce.length ? announce.map(a => '<li>' + C(a) + '</li>').join('') : '<div class="empty-state"><p>暂无公告</p></div>'}</div>
    <div class="panel"><h4>👥 官方玩家群</h4>${qqGroups.length ? qqGroups.map(q => '<div class="qq-item"><span>' + C(q) + '</span><a class="btn-sm" href="tencent://groupwpa/subcmd=all&param=7&uin=' + C(q) + '" target="_blank">加入</a></div>').join('') : '<div class="empty-state"><p>暂无</p><p style="font-size:13px;opacity:.6">可在后台配置 QQ 群（--qq）</p></div>'}</div>
    <div class="panel"><h4>⚡ 快捷入口</h4><li><a href="#versions" style="color:${skin.accent}">版本情报 · 查看区服</a></li><li><a href="./droprate.html" style="color:${skin.accent}">爆率情报 · ${data ? '已开启' : '未开启'}（${data ? data.meta.monsterCount + ' 怪 / ' + data.meta.itemCount + ' 物品' : ''}）</a></li>${data ? '<li>地图情报 · ' + data.meta.mapCount + ' 张地图（含传送走法）</li><li>NPC 情报 · ' + data.meta.npcCount + ' 个 NPC</li>' : ''}</div>
  </div>
</div></section>
<footer class="footer"><div class="wrap">&copy; ${new Date().getFullYear()} ${C(gameName)}. All Rights Reserved.<br>Powered by 元歌工具箱</div></footer>
</body></html>`;
  fs.writeFileSync(path.join(outDir, 'index.html'), indexHtml, 'utf8'); files.push('index.html');
  // ============ droprate.html（虾米模板注入：完整查询引擎 + ./data/ 数据文件） ============
  // 数据（虾米格式）写 ./data/<file>
  const dataDir = path.join(outDir, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const versionId = 'v1';
  const dataFile = 'droprate_' + versionId + '.json';
  let dropData = null;
  if (!skipDroprate) { try { dropData = exportSiteData(engineRoot); } catch (e) { dropData = null; } }
  if (dropData) { fs.writeFileSync(path.join(dataDir, dataFile), JSON.stringify(dropData), 'utf8'); files.push('data/' + dataFile); }
  // site.json（bootstrapSite 优先 fetch 它——对齐虾米：避免 404 被 JSON.parse 成数字）
  fs.writeFileSync(path.join(dataDir, 'site.json'), JSON.stringify({
    name: gameName, title: gameName, site_enabled: !maint, announcement: announce.join('\n'), intro: desc,
    hero_video: '', hero_video_autoplay: false, hero_video_loop: false, versions, qq_groups: qqGroups,
    drop_enabled: !skipDroprate, drop_reverse: false, drop_types: ['沉默服', '复古版', '微变', '中变', '超变', '合击', '单职业', '沉默', '暗黑', '专属', '三职业'],
    drop_queries: [{ id: versionId, name: gameName, type: '微变', intro: '', show_rate: true, image: '', url: '', guide: '', data_file: dataFile, data_ts: Math.floor(Date.now() / 1000) }],
    penguin: { enabled: false, title: '', url: '' }
  }), 'utf8'); files.push('data/site.json');
  // 读模板并注入 __SITE_INLINE__
  let droprateHtml = '';
  const tplFile = path.join(__dirname, 'site-template', 'droprate.html');
  try {
    droprateHtml = global.__SITE_TPL || fs.readFileSync(tplFile, 'utf8');
  } catch (e) {
    droprateHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + gameName + ' - 爆率查询</title></head><body><p>模板缺失：site-template/droprate.html 未找到</p></body></html>';
  }
  const siteInline = JSON.stringify({
    name: gameName, title: gameName, site_enabled: !maint, announcement: announce.join('\n'), intro: desc,
    hero_video: '', hero_video_autoplay: false, hero_video_loop: false, versions, qq_groups: qqGroups,
    drop_enabled: !skipDroprate, drop_reverse: false, drop_types: ['沉默服', '复古版', '微变', '中变', '超变', '合击', '单职业', '沉默', '暗黑', '专属', '三职业'],
    drop_queries: [{ id: versionId, name: gameName, type: '微变', intro: '', show_rate: true, image: '', url: '', guide: '', data_file: dataFile, data_ts: Math.floor(Date.now() / 1000) }],
    penguin: { enabled: false, title: '', url: '' }
  }).replace(/</g, '\\u003c');
  const injMark = 'window.__SITE_INLINE__ = ';
  const injIdx = droprateHtml.indexOf(injMark);
  if (injIdx >= 0) {
    const semi = droprateHtml.indexOf(';', injIdx);
    if (semi > 0) droprateHtml = droprateHtml.slice(0, injIdx) + injMark + siteInline + droprateHtml.slice(semi);
  }
  fs.writeFileSync(path.join(outDir, 'droprate.html'), droprateHtml, 'utf8'); files.push('droprate.html');
  // ============ download.html（下载帮助页） ============
  const downloadHtml = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${C(gameName)} - 下载帮助</title><style>${css}</style></head><body>
<header class="header"><div class="inner"><div class="brand"><h1>📥 ${C(gameName)}</h1></div>
<nav class="nav"><a href="./index.html">官网首页</a><a href="./droprate.html">爆率查询</a></nav></div></header>
<div class="wrap" style="padding:60px 22px">
  <div class="grid">
    <div class="panel"><h4>登录器下载</h4>${downloadUrl ? '<p><a class="btn-dl" href="' + C(downloadUrl) + '">⬇ 立即下载</a></p>' : '<div class="empty-state"><p>下载链接未配置</p><p style="font-size:13px;opacity:.6">请在生成时填写 --dl</p></div>'}
    <li>1. 优先下载与当前游玩版本对应的登录器</li><li>2. 若兼容性异常可尝试备用资源包</li><li>3. 开区公告见官网公告区与官方群</li></div>
    <div class="panel"><h4>联系与加群</h4>${qqGroups.length ? qqGroups.map(q => '<div class="qq-item"><span>' + C(q) + '</span><a class="btn-sm" href="tencent://groupwpa/subcmd=all&param=7&uin=' + C(q) + '" target="_blank">加入</a></div>').join('') : '<div class="empty-state"><p>暂无群号</p></div>'}</div>
  </div>
</div>
<footer class="footer">Powered by 元歌工具箱</footer></body></html>`;
  fs.writeFileSync(path.join(outDir, 'download.html'), downloadHtml, 'utf8'); files.push('download.html');
  // ============ config.json ============
  fs.writeFileSync(path.join(outDir, 'config.json'), JSON.stringify({ title: gameName, version, skin: o.skin || 'dark', qqGroups, downloadUrl, desc, versions, announce, site_enabled: !maint, maintMsg: o.maintMsg || '', generated: new Date().toISOString() }, null, 1), 'utf8');
  files.push('config.json');
  return { ok: true, dir: outDir, files, size: files.reduce((a, f) => a + (fs.existsSync(path.join(outDir, f)) ? fs.statSync(path.join(outDir, f)).size : 0), 0),
    gameName, version, skin: o.skin || 'dark', monsterCount: data ? data.meta.monsterCount : 0, itemCount: data ? data.meta.itemCount : 0,
    mapCount: data ? data.meta.mapCount : 0, npcCount: data ? data.meta.npcCount : 0, maint, withAdmin,
    msg: '已生成站点 ' + files.length + ' 个文件（' + (data ? data.meta.monsterCount + ' 怪 / ' + data.meta.itemCount + ' 物品 / ' + data.meta.mapCount + ' 地图 / ' + data.meta.npcCount + ' NPC' : '未导出爆率') + (maint ? '，维护模式' : '') + (withAdmin ? '，含后台' : '') + '）' };
}

// ============ 引擎识别 + 参数检查（还原自虾米：M2Server.exe 特征串） ============
const ENGINE_SIGS = [
  ['GEEPAK3', 'GEE引擎(微端)'], ['GEEPAK2', 'GEE引擎'], ['GEEM2LP', 'GEE引擎(连服)'], ['GEEM2', 'GEE引擎'],
  ['GAMEOFMIR2', 'GOM引擎'], ['GAMEOFMIR', 'GOM引擎(老)'], ['D3DM2', 'D3D引擎'], ['MIRYQ', 'MirYQ引擎'],
  ['ssNGom', 'ssNGom引擎'], ['996M2', '996引擎'], ['BLUEM2', 'Blue引擎'],
];
function detectEngine(engineRoot) {
  const f = path.join(engineRoot, 'Mir200', 'M2Server.exe');
  if (!fs.existsSync(f)) return { ok: false, engine: '未知', msg: '未找到 Mir200/M2Server.exe' };
  let ascii;
  try { ascii = fs.readFileSync(f).toString('latin1'); }
  catch (e) { return { ok: false, engine: '未知', msg: '读取失败: ' + e.message }; }
  for (const [sig, name] of ENGINE_SIGS) {
    if (ascii.includes(sig)) return { ok: true, engine: name, sig, file: f };
  }
  // 兜底：读版本信息辅助判断（翎风等新引擎无特征串）
  let ver = '';
  try { ver = require('child_process').execSync('powershell -NoProfile -Command "(Get-Item \'' + f.replace(/'/g, "''") + '\').VersionInfo.FileVersion"', { encoding: 'utf8', timeout: 5000 }).trim(); } catch (e) { /* 忽略 */ }
  return { ok: true, engine: '未知引擎（可能为翎风/LF 系）', sig: null, file: f, fileVersion: ver || null };
}
// 服务端配置健检：目录键存在性 + 端口一致性
const SETUP_DIR_KEYS = ['BaseDir', 'BoxsDir', 'CastleDir', 'ChatDir', 'ConLogDir', 'LogDir', 'GuildDir', 'NoticeDir', 'SortDir'];
// 目录键 → 建议子目录（相对引擎根，用于一键校正残留路径）
const SETUP_DIR_MAP = {
  BaseDir: 'Mir200\\Share',
  BoxsDir: 'Mir200\\Envir\\Boxs',
  CastleDir: 'Mir200\\Castle',
  ChatDir: 'Mir200\\ChatLog',
  ConLogDir: 'Mir200\\ConLog',
  LogDir: 'Mir200\\Log',
  GuildDir: 'Mir200\\GuildBase\\Guilds',
  NoticeDir: 'Mir200\\Notice',
  SortDir: 'Mir200\\Sort',
};
// 扫描 !setup.txt 全部目录键：返回每个键的值/是否存在/建议值（还原自 ai-server「引擎健检」目录键检测）
function scanSetupDirKeys(engineRoot) {
  const setup = path.join(engineRoot, 'Mir200', '!setup.txt');
  if (!fs.existsSync(setup)) return { ok: false, msg: '未找到 Mir200/!setup.txt', keys: [] };
  const content = decodeBuf(fs.readFileSync(setup));
  const keys = [];
  const issues = [];
  for (const key of SETUP_DIR_KEYS) {
    const m = content.match(new RegExp('^' + key + '\\s*=\\s*(.+)$', 'm'));
    if (!m) { keys.push({ key, value: '', exists: false, suggest: '' }); continue; }
    const val = m[1].trim();
    const exists = fs.existsSync(val) || fs.existsSync(path.join(engineRoot, val.replace(/^\\/, ''))) || fs.existsSync(path.join(engineRoot, 'Mir200', val.replace(/^\\/, '')));
    const suggest = path.join(engineRoot, SETUP_DIR_MAP[key] || '') + '\\';
    keys.push({ key, value: val, exists, suggest });
    if (!exists) issues.push('目录键 ' + key + ' 不存在: ' + val + '（建议 ' + suggest + '）');
  }
  return { ok: issues.length === 0, keys, issues, file: setup };
}
// 一键校正目录键：把不存在的目录键修正为 <引擎根>\<子目录>\ 并创建目录（还原自 ai-server「目录键校正」建议）
// dryRun=true 只报告不写入
function fixSetupDirKeys(engineRoot, opts = {}) {
  const { dryRun = false } = opts;
  const scan = scanSetupDirKeys(engineRoot);
  if (!scan.ok && !scan.file) return { ok: false, msg: scan.msg, fixed: 0 };
  let fixed = 0;
  const changed = [];
  for (const k of scan.keys) {
    if (!k.exists && k.value && k.suggest) {
      changed.push({ key: k.key, from: k.value, to: k.suggest });
      fixed++;
    }
  }
  if (dryRun || fixed === 0) return { ok: fixed === 0, dryRun, fixed, changed, msg: dryRun ? '待校正 ' + fixed + ' 个目录键' : '全部目录键已存在' };
  // 写入：逐行替换不存在的目录键
  const content = decodeBuf(fs.readFileSync(scan.file));
  let updated = content;
  for (const c of changed) {
    const re = new RegExp('^(' + c.key + '\\s*=\\s*).+$', 'm');
    updated = updated.replace(re, '$1' + c.to);
    // 确保目录存在
    const d = path.join(engineRoot, SETUP_DIR_MAP[c.key]);
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
  // 备份后写
  const bak = scan.file + '.setup-bak';
  try { fs.copyFileSync(scan.file, bak); } catch (e) { /* 忽略备份失败 */ }
  writeTextFile(scan.file, updated);
  return { ok: true, dryRun, fixed, changed, msg: '已校正 ' + fixed + ' 个目录键（备份 ' + path.basename(bak) + '）' };
}
function checkServerConfig(engineRoot) {
  const issues = [];
  const checks = [];
  const eng = detectEngine(engineRoot);
  checks.push({ name: '引擎识别', ok: eng.ok, detail: eng.engine + (eng.sig ? '（特征 ' + eng.sig + '）' : '') });
  const setup = path.join(engineRoot, 'Mir200', '!setup.txt');
  if (fs.existsSync(setup)) {
    const content = decodeBuf(fs.readFileSync(setup));
    for (const key of SETUP_DIR_KEYS) {
      const m = content.match(new RegExp('^' + key + '\\s*=\\s*(.+)$', 'm'));
      if (m) {
        const val = m[1].trim();
        const ok = fs.existsSync(val) || fs.existsSync(path.join(engineRoot, val.replace(/^\\/, ''))) || fs.existsSync(path.join(engineRoot, 'Mir200', val.replace(/^\\/, '')));
        checks.push({ name: '目录键 ' + key, ok, detail: val });
        if (!ok) issues.push('目录键 ' + key + ' 不存在: ' + val);
      }
    }
    const getP = (key) => { const m = content.match(new RegExp('^' + key + '\\s*=\\s*(\\d+)', 'm')); return m ? parseInt(m[1], 10) : null; };
    const dbPort = getP('DBPort');
    const dbs = path.join(engineRoot, 'DBServer', 'dbsrc.ini');
    if (dbPort && fs.existsSync(dbs)) {
      const dc = decodeBuf(fs.readFileSync(dbs));
      const dm = dc.match(/^ServerPort\s*=\s*(\d+)/m);
      if (dm && parseInt(dm[1], 10) !== dbPort) {
        issues.push('!setup.txt DBPort=' + dbPort + ' 与 DBServer ServerPort=' + dm[1] + ' 不一致');
        checks.push({ name: 'DB 端口一致性', ok: false, detail: '!setup=' + dbPort + ' / DBServer=' + dm[1] });
      } else {
        checks.push({ name: 'DB 端口一致性', ok: true, detail: 'DBPort=' + dbPort });
      }
    }
  } else {
    issues.push('未找到 Mir200/!setup.txt');
    checks.push({ name: '目录键', ok: false, detail: '未找到 !setup.txt' });
  }
  return { ok: issues.length === 0, checks, issues, engine: eng };
}


// ============ 融合：MonGen 文件监控（还原自虾米"MonGen.txt 已被其他程序修改请重新加载后再保存"） ============
function monGenSnapshot(engineRoot) {
  const f = monGenFile(engineRoot);
  if (!f || !fs.existsSync(f)) return null;
  const st = fs.statSync(f);
  return { file: f, mtimeMs: st.mtimeMs, size: st.size };
}
function checkMonGenModified(engineRoot, snapshot) {
  if (!snapshot) return { modified: false, msg: '' };
  const cur = monGenSnapshot(engineRoot);
  if (!cur) return { modified: true, msg: 'MonGen.txt 已不存在（可能被移动/删除）' };
  if (cur.mtimeMs !== snapshot.mtimeMs || cur.size !== snapshot.size) {
    return { modified: true, msg: 'MonGen.txt 已被其他程序修改，请重新加载后再保存（还原自虾米监控）' };
  }
  return { modified: false, msg: '' };
}

// ============ 融合：爆率重复检测 + 指定删除（还原自虾米"整体优化分组和指定删除"） ============
function findDupRates(engineRoot, monName) {
  const r = readMonFile(engineRoot, monName);
  if (!r.exists) return { ok: false, msg: '无爆率文件' };
  const seen = new Map();
  for (const it of r.items) {
    if (it.kind !== 'rate') continue;
    const key = it.item + '@' + it.rate;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(it);
  }
  const dups = [];
  for (const [key, list] of seen) if (list.length > 1) dups.push({ item: list[0].item, rate: list[0].rate, count: list.length });
  return { ok: true, dups, total: r.items.filter(x => x.kind === 'rate').length };
}
function delDupRates(engineRoot, monName) {
  const r = readMonFile(engineRoot, monName);
  if (!r.exists) return { ok: false, msg: '无爆率文件' };
  const seen = new Set();
  const kept = [];
  let removed = 0;
  for (const it of r.items) {
    if (it.kind === 'rate') {
      const key = it.item + '@' + it.rate;
      if (seen.has(key)) { removed++; continue; }
      seen.add(key);
    }
    kept.push(it);
  }
  if (removed) { writeMonFile(engineRoot, monName, kept); }
  return { ok: true, removed, msg: removed ? '已删除 ' + monName + ' 的 ' + removed + ' 条重复爆率' : monName + ' 无重复爆率' };
}

// ============ 融合：注入输入框检测（还原自虾米"InPutString/InPutInteger 编号"） ============
function checkInputScript(content) {
  // 检测注入内容里的输入框指令是否缺少编号/变量
  const issues = [];
  const re = /@(InPutString|InPutInteger)\s+([^\\\r\n<]+)/g;
  let m;
  while ((m = re.exec(content || ''))) {
    const arg = m[2].trim();
    // 传奇语法：@InPutString 变量（无需编号）；若缺少变量则提示
    if (!arg || !arg.startsWith('<')) issues.push('输入框指令 ' + m[1] + ' 缺少变量参数: ' + m[0]);
  }
  return { ok: issues.length === 0, issues };
}

// ---- M2 重载（还原自"传奇服务端快捷助手"：FindWindow → GetMenu → PostMessage WM_COMMAND）----
// 22 项实测清单（翎风 M2"控制-重新加载"子菜单；虾米 _get_reload_menu_button_defs 23 项 + 三合一/m2重载/m2重载.md 实测）
const M2_RELOAD_ITEMS = ['物品数据库', '技能数据库', '怪物数据库', '怪物说话设置', '怪物大血条', '宝箱数据', '数据列表', '地图安全区', '参数设置', '物品掉落规则', 'QManage 登录脚本', 'QFunction 功能脚本', 'QMission 任务脚本', 'QChatbox 聊天框脚本', 'Robot 机器人脚本', '所有NPC', '地图事件触发', '怪物爆率', '摆摊物品最低售价', '出售角色其他信息', '假人列表', '授权RunGate网关IP文件'];
function m2Reload(opts = {}) {
  // opts: { item, action: 'list'|'reload', filter }
  const { item = '', action = 'list', filter = '', root = '' } = opts;
  const { spawnSync } = require('child_process');
  let ps1 = path.join(__dirname, 'm2-reload.ps1');
  if (!fs.existsSync(ps1)) {
    // SEA 单文件：bundle 注入的 ps1 内容写临时文件
    if (global.__M2RELOAD_PS1) {
      const os = require('os');
      ps1 = path.join(os.tmpdir(), 'yge-m2reload-' + process.pid + '.ps1');
      try { fs.writeFileSync(ps1, global.__M2RELOAD_PS1, 'utf8'); }
      catch (e) { return { ok: false, code: 'NO_PS1', msg: '无法写入临时 ps1: ' + e.message }; }
    } else {
      return { ok: false, code: 'NO_PS1', msg: '缺少 m2-reload.ps1（未随包分发）' };
    }
  }
  const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, '-Action', action];
  if (item) args.push('-Item', item);
  if (filter) args.push('-Filter', filter);
  if (root) args.push('-Root', root);
  let r;
  try { r = spawnSync('powershell.exe', args, { timeout: 15000, windowsHide: true }); }
  catch (e) { return { ok: false, code: 'SPAWN_ERR', msg: '调用 PowerShell 失败: ' + e.message }; }
  const dec = (b) => { try { return iconv.decode(b || Buffer.alloc(0), 'gbk'); } catch (e2) { return (b || Buffer.alloc(0)).toString('utf8'); } };
  const out = (dec(r.stdout) + '\n' + dec(r.stderr)).trim();
  const line = out.split(/\r?\n/).find(l => l.startsWith('RESULT:'));
  if (!line) return { ok: false, code: 'NO_OUTPUT', msg: '脚本无输出: ' + out.slice(0, 200) };
  const m = line.match(/^RESULT:([A-Z_]+)\|?(.*)$/);
  const code = m ? m[1] : 'UNKNOWN';
  const msg = m ? m[2] : line;
  return { ok: code === 'OK' || code === 'LIST', code, msg, raw: out };
}


// ============ 登录器配置：换版本一键替换路径前缀（pak/Map/Wav/Wil/Wzl）============
// loginDir: 登录器目录（含 pak.txt 等）；clientDir: 新客户端根（含盘符，如 D:\\17周年）；patchDir: 新补丁目录（可选，空=保留原补丁名）
// 规则：每行路径前缀 [盘符:\\旧客户端根\\第二段\\] → 第二段为标准目录(Data/Map/Graphics等)保留之，否则视为补丁名换为新补丁（或保留）
function replaceLoginCfg(loginDir, opts) {
  const o = opts || {};
  const clientDir = String(o.clientDir || '').trim().replace(/[\\/]+$/, '');
  if (!clientDir) return { ok: false, msg: '未填写新客户端目录' };
  const patchDir = String(o.patchDir || '').trim().replace(/[\\/]+$/, '');
  if (!loginDir || !fs.existsSync(loginDir)) return { ok: false, msg: '登录器目录不存在: ' + loginDir };
  const files = ['pak.txt', 'Map.txt', 'Wav.txt', 'Wil.txt', 'Wzl.txt'];
  const STD = new Set(['data', 'map', 'graphics', 'wav', 'wil', 'wzl', 'gui', 'ui', 'newui', 'newopui', 'lib', 'loginskin', 'config', 'debug', 'sound', 'htm', 'image']);
  // 备份
  const bakDir = path.join(loginDir, '@backup', String(Date.now()));
  try { fs.mkdirSync(bakDir, { recursive: true }); } catch (e) {}
  const stat = [];
  for (const f of files) {
    const fp = path.join(loginDir, f);
    if (!fs.existsSync(fp)) { stat.push(f + ': 无'); continue; }
    const lines = decodeBuf(fs.readFileSync(fp)).split(/\r?\n/);
    let changed = 0;
    const out = lines.map(l => {
      const nl = l.replace(/^([A-Za-z]:\\)([^\\\r\n]+)\\([^\\\r\n]+)\\/, (m, drv, oldRoot, seg2) => {
        const seg2l = seg2.toLowerCase();
        if (STD.has(seg2l)) return clientDir + '\\' + seg2 + '\\';
        const patch = patchDir || seg2;
        return clientDir + '\\' + patch + '\\';
      });
      if (nl !== l) changed++;
      return nl;
    });
    if (changed) {
      const content = out.join('\r\n');
      if (bakDir && fs.existsSync(bakDir)) { try { fs.writeFileSync(path.join(bakDir, f), fs.readFileSync(fp)); } catch (e) {} }
      fs.writeFileSync(fp, encodeStr(content, 'gbk'));
    }
    stat.push(f + ': 改 ' + changed + ' 行' + (changed ? '（备份 ' + bakDir + '）' : ''));
  }
  return { ok: true, msg: '登录器配置替换完成（客户端=' + clientDir + (patchDir ? '，补丁=' + patchDir : '，补丁保留原样') + '）', stat, bakDir };
}

;
global.__lib = {
  replaceLoginCfg,
  MONITEMS_REL,
  MAX_RATE,
  readMonGen,
  serializeSpawn,
  storeCleanScripts,
  parseLine,
  parseFile,
  serializeLine,
  serializeFile,
  monItemsDir,
  monFile,
  readMonFile,
  writeMonFile,
  listMonFiles,
  detectEncoding,
  decodeBuf,
  encodeStr,
  addRates,
  resolveCall,
  scanCallRefs,
  restoreCall,
  delRates,
  groupRates,
  optimizeRates,
  findQManage,
  injectQManageTimer,
  backupMonGen,
  atomicWrite,
  preserveMonGenWrite,
  spawnTable,
  detectDungeonMaps,
  genPersonalSpawn,
  genInstanceSpawn,
  listMaps,
  scanVariables,
  salesTimers,
  normalizeItemName,
  denFromRate,
  rateFromDen,
  applyOp,
  overallOptimize,
  backupMonItems,
  listBackups,
  restoreBackup,
  mapNamesToCodes,
  monstersFromMonGen,
  addRate,
  delRate,
  globalOp,
  monsByMap,
  mapMonsters,
  findItemDrops,
  addAfterItem,
  randRate,
  listMonGen,
  addMonGen,
  delMonGen,
  findCurrency,
  currencyReport,
  searchScripts,
  replaceScripts,
  addExchangeNpc,
  genExchangeScript,
  EXCHANGE_NPC_NAME,
  scanPorts,
  checkPorts,
  checkPortInUse,
  injectScript,
  isInjected,
  extractVars,
  replaceOccupyVars,
  readRobots,
  addRobot,
  delRobot,
  loadSyncConfig,
  saveSyncConfig,
  ftpSync,
  genRecycleScript,
  addRecycleNpc,
  genSalesData,
  genUserId,
  groupItems,
  serverZoneName,
  genCategories,
  genZoneData,
  hookMonItemsDrops,
  unhookMonItemsDrops,
  matchCurrencyCmd,
  genStoreScript,
  storeTimerId,
  adjustMonGen,
  genDynamicSpawn,
  extractCurrencies,
  quickBackup,
  allocFlags,
  listAllFiles,
  CURRENCY_CMDS,
  curCmd,
  listNpcFiles,
  readScriptFile,
  saveScriptFile,
  QUICK_PATHS,
  readMerChant,
  filterNpcs,
  adjustItem,
  adjustRateFile,
  globalAdjust,
  convertRandomFile,
  globalConvert,
  m2Reload,
  M2_RELOAD_ITEMS,
  readPortConfig,
  writePortConfig,
  replacePorts,
  readItemDesc,
  writeItemDesc,
  addItemDesc,
  delItemDesc,
  readUnbindList,
  writeUnbindList,
  addUnbindItem,
  delUnbindItem,
  readShopList,
  readGroupItems,
  readStartPoint,
  writeStartPoint,
  addStartPoint,
  delStartPoint,
  readMapInfo,
  readMiniMap,
  writeMiniMap,
  detectEngine,
  checkServerConfig,
  SETUP_DIR_KEYS,
  SETUP_DIR_MAP,
  scanSetupDirKeys,
  fixSetupDirKeys,
  readSimpleCfg,
  writeSimpleCfg,
  SIMPLE_CFG_FILES,
  readSimpleFile,
  checkPortConsistency,
  savePortPreset,
  listPortPresets,
  applyPortPreset,
  readMapEvent,
  compareDirs,
  compareTextLines,
  healthReport,
  genOpenSite,
  remotePush,
  remoteListen,
  exportDroprateJson,
  exportSiteData,
  SITE_SKINS,
  monGenSnapshot,
  checkMonGenModified,
  findDupRates,
  delDupRates,
  checkInputScript,
  checkRoundTrip,
  setIconv: (m) => { iconv = m; }
};


// 元歌工具箱 — CLI 入口（完整版）
// 用法：
//   rate-tool list <引擎根目录> [怪物名]
//   rate-tool add <引擎根目录> <怪物名|*> <物品> <概率> [数量] [--child] [--delete]
//   rate-tool del <引擎根目录> <怪物名|*> <物品>
//   rate-tool adjust <引擎根目录> <怪物名|*> <倍率> [--min N] [--max N] [--limit N] [--child]
//   rate-tool random <引擎根目录> <怪物名|*> [--min N] [--max N]
//   rate-tool map <引擎根目录> <地图代码>        查看地图刷怪
//   rate-tool find <引擎根目录> <物品名>          查询物品被哪些怪掉落
//   rate-tool backup <引擎根目录>                备份 MonItems
// 怪物名为 * 时表示全服（所有怪物文件）
const lib = global.__lib;
// 加载 GBK 编码支持（node 直接跑时 rate-tool 无 node_modules，需显式指定）
try { lib.setIconv(require('iconv-lite')); } catch (e1) {
  try { lib.setIconv(require('../extracted/node_modules/iconv-lite')); } catch (e2) { /* bundle/SEA 已用 global.__iconvLite */ }
}

function usage() {
  console.log(`元歌工具箱
用法:
  rate-tool list <引擎根> [怪物名]                          查看爆率
  rate-tool add <引擎根> <怪物名|*> <物品> <概率> [数量] [--child] [--after 物品] [--range 开始 结束] [--delete]
  rate-tool del <引擎根> <怪物名|*> <物品>                   删除某物品爆率
  rate-tool adjust <引擎根> <怪物名|*> <倍率> [--min N] [--max N] [--limit N] [--child]   批量调整
  rate-tool random <引擎根> <怪物名|*> [--min N] [--max N]    随机爆率转换
  rate-tool map <引擎根> <地图代码>                          查看地图刷怪
  rate-tool find <引擎根> <物品名>                           查询物品被哪些怪掉落
  rate-tool backup <引擎根>                                 备份 MonItems 目录
  rate-tool mongen list <引擎根> [地图]                       查看刷怪配置
  rate-tool mongen add <引擎根> <地图> <X> <Y> <怪> [数量] [范围] [间隔] [时间] [触发]   追加刷怪行
  rate-tool mongen del <引擎根> <地图> <怪>                   删除刷怪行
  rate-tool currency <引擎根> [--top N] [--drop-qf] [--drop-qm] [--npc]   版本货币消耗分析
  rate-tool grep <根|目录> <搜索> [--replace 内容] [--type .txt] [--nocase] [--nochildren]   脚本搜索替换
  rate-tool exchange <根> <地图> <X> <Y> <NPC名> <消耗货币> <消耗数量> <获得货币> <获得数量> [--count N]   生成货币兑换NPC
  rate-tool ports <引擎根>                                   检测服务端端口占用
  rate-tool inject <根> <名称> <QF|QM|路径> <脚本文件> [--mode append|overwrite|cancel] [--vars]   注入脚本到 QFunction/QManage
  rate-tool robot list <根>                                查看机器人脚本
  rate-tool robot add <根> <名称> <间隔> [--unit SEC|MIN|HOUR] [--type clear|spawn] [--map 地图] [--mon 怪物] [--count N] [--maps 地图1,地图2]   新增定时刷怪/清怪
  rate-tool robot del <根> <名称>                          删除机器人
  rate-tool sync <根> --host x --user x --pass x [--port 21] [--rule 本地=远程]   同步目录到远程 FTP
  rate-tool recycle <根> <地图> <X> <Y> <NPC名> <货币:gold|gamegold|diy> [货币名] --items 物品=价格,物品=价格   生成回收NPC
  rate-tool sales <根> <生成路径> [--name 数据名] [--format new|old] [--group N] [--uid 数字|字母|数字+字母]   存销系统（服务端数据打包）
  rate-tool mg-adjust <根> [--map 地图|--mon 怪] --count 倍 --time 倍 [--exd >=|<= 分钟] [--exm >=|<= 只]   原刷怪调整
  rate-tool dynamic <根> --pro 50 --count 2 --moncount 50 --intervaled 30 --interval 120 [--exmap 地图,地图] [--exmon 怪,怪]   动态刷怪配置
  rate-tool m2reload --list                             列出 M2"控制-重新载入"菜单项（需打开 M2 主窗口）
  rate-tool m2reload --item 怪物爆率 [--filter 关键字]   向 M2 发送重载命令（菜单点击，需打开 M2 主窗口）
例子:
  rate-tool list D:\\MirServer 白野猪
  rate-tool add D:\\MirServer 白野猪 屠龙 100 1           (追加: 1/100 掉 1 屠龙)
  rate-tool add D:\\MirServer * 裁决之杖 500 1             (全服追加)
  rate-tool add D:\\MirServer 白野猪 屠龙 100 2 --child    (追加 #CHILD 1/100 随机爆率)
  rate-tool adjust D:\\MirServer * 0.5 --limit 200         (全服爆率减半，上限 200)
  rate-tool random D:\\MirServer * --min 100 --max 1000    (把 100~1000 的普通爆率转随机)
  rate-tool map D:\\MirServer shuai209                     (地图刷怪)
  rate-tool find D:\\MirServer 屠龙                        (查询屠龙掉落)
`);
}

function parseOpts(args) {
  const o = { positional: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--min') o.min = parseFloat(args[++i]);
    else if (a === '--max') o.max = parseFloat(args[++i]);
    else if (a === '--limit') o.limit = parseFloat(args[++i]);
    else if (a === '--child') o.child = true;
    else if (a === '--after') o.after = args[++i];
    else if (a === '--range') { o.rs = parseFloat(args[++i]); o.re = parseFloat(args[++i]); }
    else if (a === '--delete') o.delete = true;
    else o.positional.push(a);
  }
  return o;
}

function backupDir(engineRoot) {
  const src = lib.monItemsDir(engineRoot);
  if (!fs.existsSync(src)) { console.log('目录不存在: ' + src); return; }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dst = src + '.bak-' + stamp;
  fs.cpSync(src, dst, { recursive: true });
  console.log('已备份: ' + dst);
}

async function main(argv) {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === 'help' || cmd === '-h' || cmd === '--help') return usage();
  if (cmd === 'list') {
    const [root, mon] = rest;
    if (!root) return usage();
    if (mon) {
      const { file, exists, items } = lib.readMonFile(root, mon);
      if (!exists) { console.log('无爆率文件: ' + file); return; }
      console.log('== ' + mon + ' (' + file + ') ==');
      for (const it of items) console.log('  ' + lib.serializeLine(it));
      console.log('共 ' + items.filter(x => x.kind !== 'blank').length + ' 条');
    } else {
      const mons = lib.listMonFiles(root);
      console.log('怪物爆率文件共 ' + mons.length + ' 个:');
      console.log(mons.join('\n'));
    }
    return;
  }
  if (cmd === 'backup') {
    const [root, action] = rest;
    if (!root) return usage();
    if (rest.includes('--list')) {
      const b = lib.listBackups(root);
      console.log(b.list.length ? '备份列表:\n' + b.list.map((x, i) => (i + 1) + '. ' + x).join('\n') : '暂无备份');
      return;
    }
    const ri = rest.indexOf('--restore');
    if (ri >= 0) { const name = rest[ri + 1]; console.log(lib.restoreBackup(root, name).msg); return; }
    const tag = action && !action.startsWith('--') ? action : undefined;
    const r = lib.backupMonItems(root, tag);
    console.log(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg);
    return;
  }
  if (cmd === 'mg-adjust') {
    const [root] = rest;
    if (!root) return usage();
    const mi = rest.indexOf('--map');
    const moi = rest.indexOf('--mon');
    const ci = rest.indexOf('--count');
    const ti = rest.indexOf('--time');
    const edi = rest.indexOf('--exd');
    const emi = rest.indexOf('--exm');
    const opts = {
      type: mi >= 0 ? 'map' : (moi >= 0 ? 'mongen' : 'all'),
      name: mi >= 0 ? rest[mi + 1] : (moi >= 0 ? rest[moi + 1] : ''),
      monCount: ci >= 0 ? rest[ci + 1] : '1',
      monDate: ti >= 0 ? rest[ti + 1] : '1',
      expressionDate: edi >= 0 ? rest[edi + 1] : '>=',
      excludeDateCount: edi >= 0 ? rest[edi + 2] : null,
      expressionMon: emi >= 0 ? rest[emi + 1] : '>=',
      excludeMonCount: emi >= 0 ? rest[emi + 2] : null
    };
    const r = lib.adjustMonGen(root, opts);
    if (!r.ok) { console.log(r.msg); return; }
    console.log('=== 原刷怪调整完成 ===');
    console.log('刷新数量调整 ' + r.changedCount + ' 行 / 刷新时间调整 ' + r.changedDate + ' 行');
    console.log('文件: ' + r.file);
    return;
  }
  if (cmd === 'dynamic') {
    const [root] = rest;
    if (!root) return usage();
    const g = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
    const r = lib.genDynamicSpawn(root, {
      pro: g('--pro'), count: g('--count'), monCount: g('--moncount'),
      intervaled: g('--intervaled'), interval: g('--interval'),
      engine: g('--engine'), triggerCountPercent: g('--tcpct'),
      excludeTimeMin: g('--excl-time-min'), excludeCountMax: g('--excl-count-max'),
      excludeMaps: g('--exmap') ? g('--exmap').split(',').map(x => x.trim()) : [],
      excludeMons: g('--exmon') ? g('--exmon').split(',').map(x => x.trim()) : [],
      injectQmanage: rest.includes('--qm')
    });
    if (!r.ok) { console.log(r.msg); return; }
    console.log('=== 动态刷怪配置生成（' + r.engine + ' 引擎）===');
    console.log('地图 ' + r.maps + ' 个 / 记录 ' + r.records + ' 条（' + r.spawnCmd + ' 补怪）');
    console.log('RobotManage + AutoRunRobot 已写入（不改造原 MonGen）');
    if (r.qm) console.log(r.qm.msg);
    console.log('提示: 动态刷怪数据已经处理成功，请重启M2生效');
    return;
  }
  if (cmd === 'site-remote') {
    const [root, action] = rest;
    if (!root || !action) { console.log('用法: site-remote <引擎根> listen --port 8000 --token 密钥 | push --url http://ip:port --token 密钥 [--query 查询id]'); return; }
    const g = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
    if (action === 'listen') {
      const r = lib.remoteListen(root, { port: g('--port') ? parseInt(g('--port'), 10) : 8000, token: g('--token') });
      console.log(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg);
      if (r.ok) console.log('按 Ctrl+C 停止服务');
      // 保持进程
      setInterval(() => {}, 1 << 30);
      return;
    }
    if (action === 'push') {
      const url = g('--url');
      if (!url) { console.log('请填 --url 远端地址'); return; }
      (async () => {
        const r = await lib.remotePush(root, { url, token: g('--token'), queryId: g('--query') });
        console.log(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg);
      })();
      return;
    }
    console.log('未知操作: ' + action);
    return;
  }
  if (cmd === 'store-gen') {
    const [root] = rest;
    if (!root) return usage();
    const g = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
    const o = {
      featureFolder: g('--folder'), scriptName: g('--script'), methodName: g('--method'),
      categoryFolder: g('--category'), commonFolder: g('--common'), zoneFolder: g('--zone'),
      storeU: g('--u-var'), timerId: g('--timer') ? parseInt(g('--timer'), 10) : undefined,
      interval: g('--interval') ? parseInt(g('--interval'), 10) : undefined,
      teleportCondition: g('--teleport'),
      btn: g('--btn'), rid: g('--rid') ? parseInt(g('--rid'), 10) : undefined,
      qrMethod: g('--qr'), filterTip: g('--filter-tip'), storeTip: g('--store-tip'),
    };
    if (!o.featureFolder || !o.scriptName || !o.methodName) {
      console.log('用法: store-gen <引擎根> --folder 功能文件夹 --script 脚本名 --method 方法名 [--category 分类目录] [--common 通区目录] [--zone 区服文件夹] [--u-var U335] [--timer 定时器id] [--interval 秒] [--teleport 传送条件] [--btn QR触发序号] [--rid 资源编号] [--qr 掉落检测方法名] [--filter-tip 过滤提示] [--store-tip 存储提示]');
      return;
    }
    const r = await lib.genStoreScript(root, o);
    console.log(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg);
    if (r.ok) console.log('定时器: ' + r.timerId + ' | 文件: ' + r.files.join(', '));
    return;
  }
  if (cmd === 'store-clean') {
    const [root] = rest;
    if (!root) return usage();
    const g = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
    const r = await lib.storeCleanScripts(root, { featureFolder: g('--folder') });
    console.log(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg);
    return;
  }
  if (cmd === 'setup-dirs') {
    const [root] = rest;
    if (!root) return usage();
    const fix = rest.includes('--fix');
    const r = fix ? lib.fixSetupDirKeys(root, { dryRun: false }) : lib.scanSetupDirKeys(root);
    if (!fix) {
      console.log('=== 目录键扫描（' + root + '）===');
      for (const k of r.keys) console.log((k.exists ? '✅ ' : '❌ ') + k.key + ' = ' + (k.value || '(缺失)'));
      console.log(r.issues.length ? '\n' + r.issues.join('\n') : '\n全部目录键存在');
      console.log('\n用 --fix 一键校正为当前引擎根路径（自动备份 + 创建目录）');
      return;
    }
    if (!r.ok && !r.fixed) { console.log(r.msg); return; }
    console.log(r.msg);
    for (const c of r.changed || []) console.log('  ' + c.key + ': ' + c.from + ' → ' + c.to);
    return;
  }
  if (cmd === 'varquery') {
    const [root] = rest;
    if (!root) return usage();
    const g = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
    const r = lib.scanVariables(root);
    if (!r.ok) { console.log(r.msg); return; }
    console.log('=== 变量查询（' + r.files + ' 文件 / ' + r.matches + ' 处匹配）===');
    const type = g('--type');
    if (!type) { console.log('类型: ' + r.types.join(' / ')); console.log('用 --type N$ 查看某类型变量，--var 变量名 查看详情'); return; }
    const vars = r.byType[type] || {};
    const keys = Object.keys(vars).filter(k => !k.startsWith('_'));
    if (g('--var')) {
      const d = vars[g('--var')] || [];
      console.log(type + g('--var') + ' 占用 ' + d.length + ' 处:');
      for (const x of d.slice(0, 20)) console.log('  ' + x.file + ':' + x.line + '  ' + x.text);
      return;
    }
    console.log(type + ' 变量 ' + keys.length + ' 个（按使用次数排序）:');
    keys.sort((a, b) => (vars[b] || []).length - (vars[a] || []).length).slice(0, 30).forEach(k => {
      console.log('  ' + k + '（' + (vars[k] || []).length + ' 处）');
    });
    return;
  }
  if (cmd === 'spawntable') {
    const [root] = rest;
    if (!root) return usage();
    const g = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
    const r = lib.spawnTable(root, { map: g('--map'), mon: g('--mon'), limit: g('--limit') });
    if (!r.ok) { console.log(r.msg); return; }
    console.log('=== 刷怪表格（共 ' + r.total + ' 行 / ' + r.maps + ' 张地图）===');
    for (const row of r.rows.slice(0, 30)) {
      console.log(row.map + ' [' + (row.mapName || '') + '] ' + row.x + ',' + row.y + ' ' + row.monster + ' 数量' + row.count + ' 范围' + row.range + ' 间隔' + row.time + '分' + (row.extra ? ' ' + row.extra : ''));
    }
    if (r.rows.length > 30) console.log('... 其余 ' + (r.rows.length - 30) + ' 行（用 --limit 或 --map/--mon 过滤）');
    return;
  }
  if (cmd === 'dungeons') {
    const [root] = rest;
    if (!root) return usage();
    const r = lib.detectDungeonMaps(root);
    if (!r.ok) { console.log(r.msg); return; }
    console.log('=== 副本地图（' + r.count + ' 个实例）===');
    for (const d of r.dungeons.slice(0, 30)) {
      console.log(d.code + ' ← ' + d.main + ' ' + d.name + (d.hasMap ? ' [有地图文件]' : d.mainHasMap ? ' [可复制实例]' : ''));
    }
    if (r.count > 30) console.log('... 其余 ' + (r.count - 30) + ' 个');
    return;
  }
  if (cmd === 'pspawn' || cmd === 'ispawn') {
    const [root] = rest;
    if (!root) return usage();
    const g = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
    const cfg = { map: g('--map'), monster: g('--mon'), count: g('--count'), range: g('--range'), injectQmanage: !rest.includes('--noqm') };
    const r = cmd === 'pspawn' ? lib.genPersonalSpawn(root, cfg) : lib.genInstanceSpawn(root, cfg);
    console.log(r.ok ? r.msg : r.msg);
    return;
  }
  if (cmd === 'spawn') {
    const [sub, root, ...opt] = rest;
    if (sub === 'qm') {
      if (!root) return usage();
      const g = (k) => { const i = opt.indexOf(k); return i >= 0 ? opt[i + 1] : undefined; };
      const r = lib.injectQManageTimer(root, { label: g('--label'), timerId: g('--id') });
      console.log(r.msg);
      return;
    }
    return usage();
  }
  if (cmd === 'cmp') {
    const [dirA, dirB] = rest;
    if (!dirA || !dirB) return usage();
    const mi = rest.indexOf('--max');
    const r = lib.compareDirs(dirA, dirB, { maxLines: mi >= 0 ? parseInt(rest[mi + 1], 10) : 20 });
    console.log('=== 目录对比 ===');
    console.log('A(' + r.aTotal + ') vs B(' + r.bTotal + ') | 仅A ' + r.summary.onlyA + ' / 仅B ' + r.summary.onlyB + ' / 相同 ' + r.summary.same + ' / 不同 ' + r.summary.diff);
    if (r.onlyA.length) { console.log('仅A:'); r.onlyA.slice(0, 10).forEach(x => console.log('  + ' + x)); }
    if (r.onlyB.length) { console.log('仅B:'); r.onlyB.slice(0, 10).forEach(x => console.log('  + ' + x)); }
    if (r.diff.length) {
      console.log('差异文件（前 10）:');
      for (const d of r.diff.slice(0, 10)) {
        console.log('  ~ ' + d.rel + ' (' + d.aSize + '→' + d.bSize + 'B)');
        for (const l of d.lines.slice(0, 3)) console.log('      L' + l.n + ' A: ' + l.a.slice(0, 60) + '\n      L' + l.n + ' B: ' + l.b.slice(0, 60));
      }
    }
    return;
  }
  if (cmd === 'health') {
    const [root] = rest;
    if (!root) return usage();
    const r = lib.healthReport(root);
    console.log('=== 一键服务端体检：' + r.score + '%（' + r.okCount + '/' + r.total + '）===');
    for (const c of r.checks) console.log('  ' + (c.ok ? '✓' : '✗') + ' [' + c.cat + '] ' + c.name + ': ' + c.detail);
    if (r.issues.length) { console.log('发现 ' + r.issues.length + ' 个问题:'); for (const i of r.issues) console.log('  ❌ ' + i); }
    else console.log('✅ 未发现问题');
    return;
  }
  if (cmd === 'site') {
    const [root] = rest;
    if (!root) return usage();
    const g = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
    const o = { title: g('--title'), skin: g('--skin') || 'dark', newZones: g('--new'), fastZones: g('--fast'), soloZones: g('--solo'), output: g('--output'),
      desc: g('--desc'), downloadUrl: g('--dl'), qqGroups: g('--qq'), versions: g('--versions'), announce: g('--announce'), skipDroprate: rest.includes('--skip-drop'),
      maint: rest.includes('--maint'), maintMsg: g('--maint-msg'), admin: rest.includes('--admin'), applyConfig: g('--apply-config') };
    const r = lib.genOpenSite(root, o);
    if (!r.ok) { console.log('❌ ' + r.msg); return; }
    console.log('✅ ' + r.msg);
    console.log('目录: ' + r.dir);
    console.log('爆率: ' + r.monsterCount + ' 只怪 / ' + r.itemCount + ' 种物品');
    console.log('提示: 打开 index.html 预览，droprate.html 为爆率查询页（还原自虾米网站管理）');
    if (r.withAdmin) console.log('后台: admin.html 编辑→导出配置→site --apply-config 发布');
    if (r.maint) console.log('维护: maintenance.html + 首页维护横幅已生成');
    return;
  }
  if (cmd === 'delrates') {
    const [root] = rest;
    if (!root) return usage();
    const g = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
    const r = lib.delRates(root, { content: g('--content') || '', method: g('--method') || 'item', autoBackup: !rest.includes('--no-backup') });
    console.log(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg);
    return;
  }
  if (cmd === 'group') {
    const [root] = rest;
    if (!root) return usage();
    const g = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
    const r = lib.groupRates(root, { groupSize: +g('--size') || 5, autoBackup: !rest.includes('--no-backup') });
    console.log(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg);
    return;
  }
  if (cmd === 'opt') {
    const [root] = rest;
    if (!root) return usage();
    const r = lib.optimizeRates(root, { autoBackup: !rest.includes('--no-backup') });
    console.log(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg);
    return;
  }
  if (cmd === 'addrates') {
    const [root] = rest;
    if (!root) return usage();
    const g = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
    const o = { items: (g('--items') || '').split(/[,，]/).map(x => x.trim()).filter(Boolean),
      rate: +g('--rate') || 1, method: g('--method') || 'all',
      monsters: (g('--monsters') || '').split(/[,，]/).map(x => x.trim()).filter(Boolean),
      count: +g('--count') || 1, autoBackup: !rest.includes('--no-backup') };
    const r = lib.addRates(root, o);
    console.log(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg);
    return;
  }
  if (cmd === 'callrestore') {
    const [root] = rest;
    if (!root) return usage();
    const apply = rest.includes('--apply');
    const r = lib.restoreCall(root, { dryRun: !apply });
    console.log(r.ok ? (apply ? '✅ ' : '🔍 ') + r.msg : '❌ ' + r.msg);
    console.log('提示: --apply 执行展开（默认仅扫描，不修改文件）');
    return;
  }
  if (cmd === 'overall') {
    const [root] = rest;
    if (!root) return usage();
    const g = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
    const o = { method: g('--method') || 'all', autoBackup: !rest.includes('--no-backup'),
      monsters: (g('--monsters') || '').split(/[,，]/).map(x => x.trim()).filter(Boolean),
      maps: (g('--maps') || '').split(/[,，]/).map(x => x.trim()).filter(Boolean),
      items: (g('--items') || '').split(/[,，]/).map(x => x.trim()).filter(Boolean),
      rangeOp: g('--range-op'), rangeValue: g('--range-val') != null ? +g('--range-val') : null,
      op: g('--op') || 'mul', opValue: g('--op-val') != null ? +g('--op-val') : 1 };
    const r = lib.overallOptimize(root, o);
    console.log(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg);
    return;
  }
  if (cmd === 'rates') {
    const sub = rest[0];
    const root = rest[1];
    const mon = rest[2];
    if ((sub === 'dup' || sub === 'deldup') && root && mon) {
      const r = sub === 'dup' ? lib.findDupRates(root, mon) : lib.delDupRates(root, mon);
      if (!r.ok) { console.log(r.msg); return; }
      if (sub === 'dup') {
        console.log('=== ' + mon + ' 重复爆率（' + r.total + ' 条，' + r.dups.length + ' 组重复）===');
        for (const d of r.dups) console.log('  ' + d.item + ' @ ' + d.rate + ' ×' + d.count);
        console.log('提示: 用 rates deldup <根> <怪> 一键删除重复');
      } else console.log('✅ ' + r.msg);
      return;
    }
    return usage();
  }
  if (cmd === 'm2reload') {
    const li = rest.indexOf('--list');
    const ii = rest.indexOf('--item');
    const fi = rest.indexOf('--filter');
    if (li >= 0) {
      const r = lib.m2Reload({ action: 'list', filter: fi >= 0 ? rest[fi + 1] : '' });
      if (r.ok) {
        console.log('M2 重载菜单可用项:');
        console.log(r.msg);
      } else {
        console.log('提示: ' + r.msg);
        console.log('（M2 重载需要先打开 M2 主窗口，从托盘恢复后即可）');
      }
      return;
    }
    const item = ii >= 0 ? rest[ii + 1] : '';
    if (!item) return usage();
    const r = lib.m2Reload({ action: 'reload', item, filter: fi >= 0 ? rest[fi + 1] : '' });
    console.log(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg);
    return;
  }
  if (cmd === 'sales') {
    const [root, outDir] = rest;
    if (!root || !outDir) return usage();
    const ni = rest.indexOf('--name');
    const fi = rest.indexOf('--format');
    const gi = rest.indexOf('--group');
    const ui = rest.indexOf('--uid');
    const r = lib.genSalesData(root, {
      outDir, name: ni >= 0 ? rest[ni + 1] : '数据包',
      format: fi >= 0 ? rest[fi + 1] : 'new',
      groupSize: gi >= 0 ? parseInt(rest[gi + 1], 10) : 100,
      userIdType: ui >= 0 ? rest[ui + 1] : '数字'
    });
    console.log('=== 存销系统生成 ===');
    if (!r.ok) { console.log(r.msg); return; }
    for (const st of r.stages) console.log('  ' + st);
    console.log('输出: ' + r.outBase);
    return;
  }
  if (cmd === 'recycle') {
    // 用法: rate-tool recycle <根> <地图> <X> <Y> <NPC名> <分类JSON>
    // 分类JSON: [{"name":"武器类","tip":"","color":7,"names":["屠龙","裁决之杖"],"extracts":[{"key":"gold","name":"金币","value":100},{"key":"gamegold","name":"元宝","value":1}]}]
    const [root, map, x, y, npc, catsJson] = rest;
    if (!root || !map || !x || !y || !npc || !catsJson) return usage();
    let cats;
    try { cats = JSON.parse(catsJson); } catch (e) { console.log('分类JSON解析失败: ' + e.message); return; }
    if (!Array.isArray(cats) || !cats.length) { console.log('分类列表为空'); return; }
    const r = lib.addRecycleNpc(root, { mapCode: map, x, y, npcName: npc, cats });
    if (!r.ok) { console.log(r.msg); return; }
    console.log('=== 回收 NPC 生成完成（原版风格：勾选界面+总开关+全选反选）===');
    console.log('NPC: ' + r.npc + '（' + cats.length + ' 个分类）');
    console.log('个人标识: [' + r.checks.join(',') + ']');
    console.log('MerChant.txt: ' + r.merchant + (r.updated ? '（已更新）' : '（已追加）'));
    console.log('脚本: ' + r.scriptFile + '（' + r.scriptLines + ' 行）');
    console.log('提示: 重启引擎或 @reloadnpc 重新加载所有NPC生效');
    return;
  }
  if (cmd === 'sync') {
    const [root] = rest;
    if (!root) return usage();
    const hi = rest.indexOf('--host');
    const ui = rest.indexOf('--user');
    const pi = rest.indexOf('--pass');
    const poi = rest.indexOf('--port');
    const ri = rest.indexOf('--rule');
    const cfg = lib.loadSyncConfig();
    if (hi >= 0) cfg.host = rest[hi + 1];
    if (ui >= 0) cfg.user = rest[ui + 1];
    if (pi >= 0) cfg.pass = rest[pi + 1];
    if (poi >= 0) cfg.port = parseInt(rest[poi + 1], 10);
    if (ri >= 0) {
      const [l, r] = rest[ri + 1].split('=');
      if (l) cfg.rules = [{ local: l, remote: r || '/' + l.split('/').pop() }];
    }
    lib.saveSyncConfig(cfg);
    (async () => {
      console.log('=== 目录同步到 ' + cfg.host + ':' + cfg.port + ' ===');
      for (const rule of cfg.rules) console.log('规则: ' + rule.local + ' → ' + rule.remote);
      const r = await lib.ftpSync(root, cfg, m => console.log('  ' + m));
      if (!r.ok) { console.log(r.msg); return; }
      console.log('完成: 上传 ' + r.uploaded + ' / 跳过 ' + r.skipped + ' / 失败 ' + r.failed);
      for (const e of r.errors.slice(0, 5)) console.log('  ✗ ' + e);
    })();
    return;
  }
  if (cmd === 'robot') {
    const sub = rest[0];
    if (sub === 'list') {
      const [root] = rest.slice(1);
      if (!root) return usage();
      const r = lib.readRobots(root);
      if (!r.ok) { console.log(r.msg); return; }
      console.log('=== 机器人脚本（' + r.dir + '）===');
      console.log('AutoRunRobot.txt 定时行 ' + r.robots.length + ' 条：');
      for (const rb of r.robots) {
        console.log('  ' + (rb.enabled ? '✓' : '✗禁用') + ' #AutoRun NPC ' + rb.unit + ' ' + rb.value + ' @' + rb.section);
      }
      console.log('RobotManage.txt 段 ' + r.sections.length + ' 个：');
      for (const sec of r.sections) console.log('  [@' + sec + ']');
      return;
    }
    if (sub === 'add') {
      const [root, name, interval] = rest.slice(1);
      if (!root || !name || !interval) return usage();
      const ui = rest.indexOf('--unit');
      const ti = rest.indexOf('--type');
      const mi = rest.indexOf('--map');
      const moi = rest.indexOf('--mon');
      const ci = rest.indexOf('--count');
      const msi = rest.indexOf('--maps');
      const opts = {
        name, interval: parseInt(interval, 10),
        unit: ui >= 0 ? rest[ui + 1] : 'SEC',
        type: ti >= 0 ? rest[ti + 1] : 'spawn',
        map: mi >= 0 ? rest[mi + 1] : undefined,
        mon: moi >= 0 ? rest[moi + 1] : undefined,
        count: ci >= 0 ? parseInt(rest[ci + 1], 10) : 1,
        maps: msi >= 0 ? rest[msi + 1].split(',').map(x => x.trim()) : undefined
      };
      const a = lib.addRobot(root, opts);
      console.log(a.ok ? '已新增 ' + a.section + '（' + a.runLine + '）' : a.msg);
      return;
    }
    if (sub === 'del') {
      const [root, name] = rest.slice(1);
      if (!root || !name) return usage();
      const d = lib.delRobot(root, name);
      console.log(d.ok ? '已删除 ' + name + '（定时行已注释，段已移除）' : d.msg);
      return;
    }
    return usage();
  }
  if (cmd === 'inject') {
    const [root, name, target, scriptFile] = rest;
    if (!root || !name || !target || !scriptFile) return usage();
    if (!fs.existsSync(scriptFile)) { console.log('脚本文件不存在: ' + scriptFile); return; }
    const modeIdx = rest.indexOf('--mode');
    const content = fs.readFileSync(scriptFile, 'utf8');
    const r = lib.injectScript(root, {
      name, target, content,
      mode: modeIdx >= 0 ? rest[modeIdx + 1] : 'append',
      varReplace: rest.includes('--vars')
    });
    if (!r.ok) { console.log(r.msg); return; }
    console.log('=== 脚本注入完成 ===');
    console.log('名称: ' + r.name + (r.already ? '（检测到已注入，模式=' + r.mode + '）' : ''));
    console.log('文件: ' + r.file);
    return;
  }
  if (cmd === 'ports') {
    const [root] = rest;
    if (!root) return usage();
    (async () => {
      const c = await lib.checkPorts(root);
      console.log('=== 服务端端口占用检测（' + root + '）===');
      console.log('共 ' + c.total + ' 个端口，占用 ' + c.inUseCount + ' 个：');
      console.log('状态\t端口\t用途');
      for (const r of c.results) {
        const labels = r.keys.map(k => k.label + '/' + k.key).join(', ');
        console.log((r.inUse ? '■ 占用' : '□ 空闲') + '\t' + r.port + '\t' + labels);
      }
      if (c.inUseCount > 0) console.log('提示: 有端口被占用，启动服务端前请先释放或修改配置');
    })();
    return;
  }
  if (cmd === 'portcfg') {
    const [root] = rest;
    if (!root) return usage();
    const li = rest.indexOf('--list');
    const fi = rest.indexOf('--file');
    const ki = rest.indexOf('--key');
    const pi = rest.indexOf('--port');
    const ri = rest.indexOf('--replace');
    const ci = rest.indexOf('--check');
    // 端口写操作保护（事故教训 2026-08-08：GatePort1=7001 改坏活动组直接断服）
    // 任何写操作（--file/--key/--port 单键改、--replace 批量替换）都要求 --yes：
    // 主键与带数字后缀键（GatePort/GatePort1...）同值是模板常态，Count=N 决定活动组，键名危险性与端口值无关
    if ((pi >= 0 || ri >= 0) && !rest.includes('--yes')) {
      console.log('⚠️ 端口写操作保护：');
      if (ri >= 0) console.log('  本次将把端口 ' + rest[ri + 1] + ' 批量替换为 ' + rest[ri + 2] + '（全部配置文件）');
      if (pi >= 0) console.log('  本次将修改 ' + (rest[fi + 1] || '?') + ' 的 ' + (rest[ki + 1] || '?') + ' = ' + rest[pi + 1]);
      console.log('⚠️ 带数字后缀的键（GatePort1/ServerPort1/...）由 Count=N 决定是否活动组，主/备组同值是模板常态，误改会导致客户端连不上服务器！');
      console.log('⚠️ 确认要改，请加 --yes（改前会自动备份到 port-backup\\时间戳\\）');
      return;
    }
    if (ci >= 0) {
      (async () => {
        const c = await lib.checkPorts(root);
        console.log('=== 端口占用检测 ===');
        console.log('共 ' + c.total + ' 个端口，占用 ' + c.inUseCount + ' 个：');
        for (const r of c.results) {
          const labels = r.keys.map(k => k.label + '/' + k.key).join(', ');
          console.log((r.inUse ? '■ 占用' : '□ 空闲') + '\t' + r.port + '\t' + labels);
        }
      })();
      return;
    }
    const cdi = rest.indexOf('--check-dup');
    if (cdi >= 0) {
      const r = lib.checkPortConsistency(root);
      console.log('=== 端口一致性检查（' + r.total + ' 个端口，' + r.dups.length + ' 组重复）===');
      for (const d of r.dups) console.log('  ' + d.port + ' ← ' + d.keys.join(', '));
      if (!r.dups.length) console.log('✅ 无重复端口');
      return;
    }
    const psi = rest.indexOf('--preset-save');
    const pli = rest.indexOf('--preset-list');
    const pai = rest.indexOf('--preset-apply');
    if (psi >= 0) { console.log(lib.savePortPreset(root, rest[psi + 1]).msg); return; }
    if (pli >= 0) { const r = lib.listPortPresets(); console.log('已保存的端口预设: ' + (r.presets.join(', ') || '（无）')); return; }
    if (pai >= 0) { console.log(lib.applyPortPreset(root, rest[pai + 1]).msg); return; }
    if (ri >= 0) {
      const from = parseInt(rest[ri + 1], 10);
      const to = parseInt(rest[ri + 2], 10);
      const r = lib.replacePorts(root, from, to);
      console.log(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg);
      return;
    }
    if (fi >= 0 && ki >= 0 && pi >= 0) {
      const r = lib.writePortConfig(root, rest[fi + 1], rest[ki + 1], parseInt(rest[pi + 1], 10));
      console.log(r.ok ? '✅ ' + r.msg : '❌ ' + r.msg);
      return;
    }
    // 默认：列出
    const r = lib.readPortConfig(root);
    console.log('=== 服务端端口配置（共 ' + r.count + ' 个）===');
    for (const f of r.files) {
      console.log('[' + f.label + '] ' + f.file);
      for (const e of f.entries) console.log('  ' + e.key + ' = ' + e.port);
    }
    return;
  }
  if (cmd === 'itemcfg') {
    const [root] = rest;
    if (!root) return usage();
    const top = rest.includes('--top');
    const ai = rest.indexOf('--add');
    const di = rest.indexOf('--del');
    const ci = rest.indexOf('--color');
    const ti = rest.indexOf('--text');
    const ui = rest.indexOf('--unbind');
    const uid = rest.indexOf('--uid');
    const shop = rest.includes('--shop');
    const group = rest.includes('--group');
    const fi = rest.indexOf('--file');
    if (fi >= 0) {
      const fileKey = rest[fi + 1];
      const r0 = lib.readSimpleFile(root, fileKey);
      if (!r0.ok) { console.log(r0.msg); return; }
      if (ai >= 0) {
        const cols = rest[ai + 1].split(/[|,\t]+/).map(x => x.trim()).filter(Boolean);
        r0.items.push({ cols, raw: undefined });
        lib.writeSimpleCfg(root, r0.file, r0.comments, r0.items);
        console.log('✅ 已添加: ' + cols.join(' '));
        return;
      }
      if (di >= 0) {
        const idx = parseInt(rest[di + 1], 10);
        if (idx >= 1 && idx <= r0.items.length) {
          const removed = r0.items.splice(idx - 1, 1)[0];
          lib.writeSimpleCfg(root, r0.file, r0.comments, r0.items);
          console.log('✅ 已删除第 ' + idx + ' 条: ' + removed.cols.join(' '));
        } else { console.log('行号无效（1~' + r0.items.length + '）'); }
        return;
      }
      console.log('=== ' + r0.label + '（' + r0.count + ' 条）===');
      r0.items.forEach((x, i) => console.log('  ' + (i + 1) + '. ' + x.cols.join('\t')));
      console.log('格式: ' + r0.desc);
      return;
    }
    if (ui >= 0) {
      if (ai >= 0) { console.log(lib.addUnbindItem(root, rest[ai + 1], rest.slice(ai + 2).join(' ')).msg); return; }
      if (di >= 0) { console.log(lib.delUnbindItem(root, rest[di + 1]).msg); return; }
      const r = lib.readUnbindList(root);
      console.log('=== 物品解包（' + r.count + ' 条）===');
      for (const x of r.items) console.log('  ' + x.id + '\t' + x.name);
      return;
    }
    if (shop) {
      const r = lib.readShopList(root);
      console.log('=== 系统商铺（' + r.count + ' 条）===');
      for (const x of r.items.slice(0, 30)) console.log('  [' + x.shopType + '] ' + x.name);
      if (r.count > 30) console.log('  ...共 ' + r.count + ' 条');
      return;
    }
    if (group) {
      const r = lib.readGroupItems(root);
      console.log('=== 物品套装（' + r.count + ' 组）===');
      for (const x of r.rows.slice(0, 20)) console.log('  ' + x.group + ' ' + x.trigger + ' → ' + x.members.join('+'));
      if (r.count > 20) console.log('  ...共 ' + r.count + ' 组');
      return;
    }
    if (ai >= 0) { console.log(lib.addItemDesc(root, top, rest[ai + 1], ci >= 0 ? rest[ci + 1] : '243', ti >= 0 ? rest.slice(ti + 1).join(' ') : '').msg); return; }
    if (di >= 0) { console.log(lib.delItemDesc(root, top, rest[di + 1]).msg); return; }
    const r = lib.readItemDesc(root, top);
    console.log('=== 物品备注' + (top ? '（上）' : '（下）') + '（' + r.count + ' 条）===');
    for (const x of r.items.slice(0, 30)) console.log('  ' + x.name + ' = ' + x.segs.map(s => '\\' + s.color + '/' + s.text).join(''));
    if (r.count > 30) console.log('  ...共 ' + r.count + ' 条');
    return;
  }
  if (cmd === 'mapcfg') {
    const [root] = rest;
    if (!root) return usage();
    const si = rest.indexOf('--start');
    const ai = rest.indexOf('--add');
    const di = rest.indexOf('--del');
    const mi = rest.indexOf('--mapinfo');
    const mmi = rest.indexOf('--minimap');
    const mei = rest.indexOf('--mapevent');
    if (mei >= 0) {
      const r = lib.readMapEvent(root);
      console.log('=== 地图事件（' + r.count + ' 条）===');
      for (const x of r.items) console.log('  ' + x.cols.join('\t'));
      return;
    }
    if (mi >= 0) {
      const r = lib.readMapInfo(root);
      console.log('=== 地图配置（' + r.maps.length + ' 地图 + ' + r.links.length + ' 传送门）===');
      const f = rest.indexOf('--filter');
      const kw = f >= 0 ? rest[f + 1] : '';
      const maps = kw ? r.maps.filter(m => m.code.includes(kw) || m.title.includes(kw)) : r.maps.slice(0, 25);
      for (const m of maps.slice(0, 25)) console.log('  [' + m.code + '] ' + m.title + (m.props ? ' ' + m.props.slice(0, 60) : ''));
      if (r.maps.length > 25 && !kw) console.log('  ...共 ' + r.maps.length + ' 地图（用 --filter 搜索）');
      return;
    }
    if (mmi >= 0) {
      const r = lib.readMiniMap(root);
      console.log('=== 小地图配置（' + r.count + ' 条）===');
      for (const x of r.rows.slice(0, 25)) console.log('  ' + x.map + '\t' + x.id);
      if (r.count > 25) console.log('  ...共 ' + r.count + ' 条');
      return;
    }
    if (si >= 0) {
      if (ai >= 0) {
        const [m, x, y, range, type] = rest.slice(ai + 1);
        console.log(lib.addStartPoint(root, m, parseInt(x, 10), parseInt(y, 10), parseInt(range || 0, 10), parseInt(type || 0, 10)).msg);
        return;
      }
      if (di >= 0) {
        const [m, x, y] = rest.slice(di + 1);
        console.log(lib.delStartPoint(root, m, parseInt(x, 10), parseInt(y, 10)).msg);
        return;
      }
      const r = lib.readStartPoint(root);
      console.log('=== 安全区（' + r.count + ' 个）===');
      for (const x of r.rows) console.log('  ' + x.map + '\t' + x.x + ',' + x.y + '\t范围' + x.range + '\t类型' + x.type);
      return;
    }
    return usage();
  }
  if (cmd === 'engineck') {
    const [root] = rest;
    if (!root) return usage();
    const r = lib.checkServerConfig(root);
    console.log('=== 引擎识别 + 服务端健检 ===');
    for (const c of r.checks) console.log('  ' + (c.ok ? '✓' : '✗') + ' ' + c.name + ': ' + c.detail);
    if (r.issues.length) {
      console.log('\n发现 ' + r.issues.length + ' 个问题:');
      for (const i of r.issues) console.log('  ❌ ' + i);
    } else {
      console.log('\n✅ 未发现问题');
    }
    return;
  }
  if (cmd === 'exchange') {
    const [root, map, x, y, npc, fromCur, fromAmt, toCur, toAmt] = rest;
    if (!root || !map || !x || !y || !npc || !fromCur || !fromAmt || !toCur || !toAmt) return usage();
    const cntIdx = rest.indexOf('--count');
    const genOnly = rest.includes('--generate-only');
    const r = lib.addExchangeNpc(root, {
      mapCode: map, x, y, npcName: npc,
      count: cntIdx >= 0 ? parseInt(rest[cntIdx + 1], 10) || 1 : 1,
      generateOnly: genOnly,
      items: [{ from: fromCur, fromName: fromCur, fromAmount: parseInt(fromAmt, 10), to: toCur, toName: toCur, toAmount: parseInt(toAmt, 10) }]
    });
    if (!r.ok) { console.log(r.msg); return; }
    if (genOnly) {
      console.log('=== 兑换脚本内容（未写入文件，还原自虾米"只生成模式"）===');
      console.log(r.script);
      return;
    }
    console.log('=== 货币兑换 NPC 生成完成 ===');
    console.log('NPC: ' + r.npc);
    console.log('MerChant.txt: ' + r.merchant + (r.updated ? '（已更新）' : '（已追加）'));
    console.log('脚本: ' + r.scriptFile + '（' + r.scriptLines + ' 行）');
    console.log('提示: 重启引擎或 @reloadnpc 重新加载所有NPC生效');
    return;
  }
  if (cmd === 'grep') {
    const root = rest[0];
    const search = rest[1];
    if (!root || !search) return usage();
    const opts = {
      isCase: !rest.includes('--nocase'),
      isChildren: !rest.includes('--nochildren'),
      matchMode: (rest[rest.indexOf('--mode') + 1]) || 'contains', // contains|exact|regex|prefix|suffix
      types: [rest[rest.indexOf('--type') + 1] || '.txt']
    };
    const dirIdx = rest.indexOf('--dir');
    opts.dir = dirIdx >= 0 ? rest[dirIdx + 1] : path.join(root, 'Mir200', 'Envir');
    const repIdx = rest.indexOf('--replace');
    if (repIdx >= 0) {
      const replace = rest[repIdx + 1];
      const r = lib.replaceScripts(root, Object.assign({}, opts, { search, replace: replace != null ? replace : '' }));
      if (!r.ok) { console.log(r.msg); return; }
      console.log('=== 替换完成 ===');
      console.log('目录: ' + r.dir);
      console.log('共替换 ' + r.total + ' 处 / ' + r.results.length + ' 个文件:');
      for (const x of r.results.slice(0, 30)) console.log('  ' + x.rel + ': ' + x.replaced + ' 处');
      if (r.results.length > 30) console.log('  ... 共 ' + r.results.length + ' 个文件');
      return;
    }
    const r = lib.searchScripts(root, Object.assign({}, opts, { search }));
    if (!r.ok) { console.log(r.msg); return; }
    console.log('=== 搜索「' + search + '」===');
    console.log('目录: ' + r.dir);
    console.log('共 ' + r.total + ' 处匹配 / ' + r.results.length + ' 个文件:');
    for (const x of r.results.slice(0, 30)) {
      console.log('  ' + x.rel + ' (' + x.count + ' 处): 行 ' + x.lines.slice(0, 10).join(','));
      if (x.lines.length > 10) console.log('     ...');
    }
    if (r.results.length > 30) console.log('  ... 共 ' + r.results.length + ' 个文件');
    return;
  }
  if (cmd === 'currency') {
    const [root] = rest;
    if (!root) return usage();
    const opts = { dropQFunction: rest.includes('--drop-qf'), dropQManage: rest.includes('--drop-qm') };
    const rep = lib.currencyReport(root, opts);
    if (!rep.ok) { console.log(rep.msg); return; }
    console.log('=== 版本货币消耗分析（' + rep.base + '）===');
    console.log('共匹配 ' + rep.total + ' 条货币命令：');
    console.log('');
    console.log('货币\t消耗\t收入\t检查\t次数\t文件数\tNPC数');
    for (const c of rep.currencies) {
      console.log(c.currency + '\t' + c.consume + '\t' + c.income + '\t' + c.check + '\t' + c.count + '\t' + c.fileCount + '\t' + c.npcCount);
    }
    if (rest.includes('--npc')) {
      console.log('');
      console.log('=== NPC 消耗排行（消耗最多前 20）===');
      for (const n of rep.npcs.slice(0, 20)) {
        console.log(n.currency + ' | ' + n.npc + ': 消耗 ' + n.consume + ' / 收入 ' + n.income + '（' + n.count + ' 次）');
      }
    }
    return;
  }
  if (cmd === 'mongen') {
    const sub = rest[0];
    if (sub === 'list') {
      const [root, mapCode] = rest.slice(1);
      if (!root) return usage();
      const l = lib.listMonGen(root, mapCode);
      if (!l.ok) { console.log(l.msg); return; }
      console.log((mapCode ? '地图 ' + mapCode + ' 的刷怪配置' : '全部刷怪配置') + '（共 ' + l.total + ' 行，显示 ' + l.rows.length + ' 条）:');
      console.log('  地图\tX\tY\t怪物名\t数量\t范围\t间隔\t时间\t触发');
      for (const r of l.rows.slice(0, 40)) {
        console.log('  ' + r.map + '\t' + r.x + '\t' + r.y + '\t' + r.mon + '\t' + r.count + '\t' + r.range + '\t' + r.interval + '\t' + r.time + '\t' + r.trigger);
      }
      if (l.rows.length > 40) console.log('  ... 共 ' + l.rows.length + ' 条');
      return;
    }
    if (sub === 'add') {
      const [root, map, x, y, mon, count, range, interval, time, trigger] = rest.slice(1);
      if (!root || !map || !x || !y || !mon) return usage();
      const a = lib.addMonGen(root, { map, x, y, mon, count, range, interval, time, trigger });
      console.log(a.ok ? '已追加: ' + a.line + ' → ' + a.file : a.msg);
      return;
    }
    if (sub === 'del') {
      const [root, map, mon] = rest.slice(1);
      if (!root || !map || !mon) return usage();
      const d = lib.delMonGen(root, map, mon);
      console.log(d.ok ? '已删除 ' + d.removed + ' 条刷怪行 → ' + d.file : d.msg);
      return;
    }
    return usage();
  }
  if (cmd === 'map') {
    const [root, mapCode] = rest;
    if (!root || !mapCode) return usage();
    const mm = lib.mapMonsters(root, mapCode);
    if (mm.length === 0) { console.log('MonGen.txt 中未找到地图 ' + mapCode + '（或该地图无刷怪记录）'); return; }
    console.log('地图 ' + mapCode + ' 共 ' + mm.length + ' 种怪:');
    for (const x of mm) console.log('  ' + x.mon + (x.exists ? '（爆率 ' + x.lines + ' 行）' : '（无爆率文件）'));
    return;
  }
  if (cmd === 'find') {
    const [root, item] = rest;
    if (!root || !item) return usage();
    const drops = lib.findItemDrops(root, item);
    if (drops.length === 0) { console.log('全服未找到「' + item + '」的掉落'); return; }
    console.log('物品「' + item + '」被 ' + drops.length + ' 个怪掉落:');
    for (const d of drops.slice(0, 30)) console.log('  ' + d.mon + ' → ' + d.line);
    if (drops.length > 30) console.log('  ... 共 ' + drops.length + ' 条');
    return;
  }
  if (cmd === 'add' || cmd === 'del') {
    const o = parseOpts(rest);
    const [root, mon, item, rate, count] = o.positional;
    const deleteMode = cmd === 'del' || o.delete;
    if (!root || !mon || !item) return usage();
    const isGlobal = mon === '*';
    const cnt = count ? parseInt(count, 10) : 1;
    if (isGlobal) {
      const r = lib.globalOp(root, deleteMode ? 'del' : 'add', item, rate ? parseInt(rate, 10) : 0, cnt, !deleteMode);
      console.log('全服操作完成: ' + r.total + ' 个怪物文件');
      let ok = 0, err = 0;
      for (const x of r.results) {
        if (x.error) { err++; console.log('  [错误] ' + x.mon + ': ' + x.error); }
        else ok++;
      }
      console.log('成功 ' + ok + ' / 失败 ' + err);
    } else if (o.after) {
      // 加在指定物品后（goods 类型）
      let n = rate ? parseInt(rate, 10) : 0;
      if (o.rs != null && o.re != null) n = lib.randRate(o.rs, o.re);
      const res = lib.addAfterItem(root, o.after, item, n, cnt, o.child || (o.rs != null));
      if (res.length === 0) { console.log('全服未找到物品「' + o.after + '」的掉落，无法追加'); return; }
      console.log('已在 ' + res.length + ' 处「' + o.after + '」后追加' + (o.child || (o.rs != null) ? ' #CHILD 1/' + n : ' ' + item + ' 1/' + n) + ':');
      for (const x of res.slice(0, 15)) console.log('  ✓ ' + x.mon + ' → ' + x.line);
      if (res.length > 15) console.log('  ... 共 ' + res.length + ' 处');
      return;
    } else if (deleteMode) {
      const r = lib.delRate(root, mon, item);
      console.log('删除完成: ' + (r.removed || 0) + ' 条（剩余 ' + r.total + ' 条）→ ' + r.file);
    } else {
      if (o.child || (o.rs != null && o.re != null)) {
        let n = rate ? parseInt(rate, 10) : 0;
        if (o.rs != null && o.re != null) n = lib.randRate(o.rs, o.re);
        const { file, items } = lib.readMonFile(root, mon);
        items.push({ kind: 'child', num: 1, rate: n, flag: 'RANDOM', cond: null, raw: '' });
        lib.writeMonFile(root, mon, items);
        console.log('追加 #CHILD 1/' + n + (cnt > 1 ? ' x' + cnt : '') + ' → ' + file);
      } else {
        const r = lib.addRate(root, mon, item, rate ? parseInt(rate, 10) : 0, cnt, true);
        console.log('追加完成: 共 ' + r.total + ' 条 → ' + r.file);
      }
    }
    return;
  }
  if (cmd === 'adjust' || cmd === 'random') {
    const o = parseOpts(rest);
    const [root, mon, rate] = o.positional;
    if (!root || !mon) return usage();
    const isGlobal = mon === '*';
    const opt = {
      rate: cmd === 'adjust' ? (rate ? parseFloat(rate) : 1) : undefined,
      minRate: o.min != null ? o.min : null,
      maxRate: o.max != null ? o.max : null,
      maxLimit: o.limit != null ? o.limit : null,
      type: o.child ? 'child' : 'normal',
    };
    const fn = cmd === 'adjust'
      ? (m) => lib.adjustRateFile(root, m, opt)
      : (m) => lib.convertRandomFile(root, m, { minRate: opt.minRate, maxRate: opt.maxRate });
    const mons = isGlobal ? lib.listMonFiles(root) : [mon];
    console.log((cmd === 'adjust' ? '批量调整' : '随机转换') + ' (' + mons.length + ' 个文件):');
    let ok = 0, err = 0;
    for (const m of mons) {
      try {
        const r = fn(m);
        ok++;
        console.log('  ✓ ' + m + ': ' + (cmd === 'adjust' ? '调整 ' + r.changed : '转换 ' + r.changed) + ' 条');
      } catch (e) {
        err++;
        console.log('  ✗ ' + m + ': ' + e.message);
      }
    }
    console.log('成功 ' + ok + ' / 失败 ' + err);
    return;
  }
  return usage();
}

main(process.argv.slice(2)).catch(e => { console.error('❌ ' + (e && e.message || e)); process.exit(1); });
