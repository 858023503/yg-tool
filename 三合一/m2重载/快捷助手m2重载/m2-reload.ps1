param(
  [string]$Item = '',
  [string]$Filter = '',
  [string]$Action = 'list',
  [string]$Root = ''
)
# 元歌工具箱 - M2 重载（三版融合：快捷助手命令表 + 蜗牛按PID枚举 + 虾米进程路径精确匹配/递归菜单）
# 机制：定位 M2Server 进程(Toolhelp32 快照按 exe 路径精确匹配) →
#       枚举 GameCenter/M2Server 的顶层+子窗口找 TfrmMain →
#       递归枚举"控制>重新加载"菜单叶节点 → PostMessage WM_COMMAND(菜单ID)
$src = @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public class M2Reload {
  // 窗口
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lp);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr parent, EnumProc cb, IntPtr lp);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder sb, int max);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder sb, int max);
  [DllImport("user32.dll")] public static extern IntPtr GetMenu(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetMenuItemCount(IntPtr m);
  [DllImport("user32.dll")] public static extern IntPtr GetSubMenu(IntPtr m, int pos);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetMenuString(IntPtr m, uint item, StringBuilder sb, int max, uint flag);
  [DllImport("user32.dll")] public static extern uint GetMenuItemID(IntPtr m, int pos);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint msg, IntPtr wp, IntPtr lp);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  // 进程快照（虾米 Toolhelp32 思路）
  [DllImport("kernel32.dll")] public static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint pid);
  [DllImport("kernel32.dll")] public static extern bool Process32FirstW(IntPtr snap, ref PROCESSENTRY32W entry);
  [DllImport("kernel32.dll")] public static extern bool Process32NextW(IntPtr snap, ref PROCESSENTRY32W entry);
  [DllImport("kernel32.dll")] public static extern bool QueryFullProcessImageNameW(IntPtr hProc, uint flags, StringBuilder sb, ref uint size);
  [DllImport("kernel32.dll")] public static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
  [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct PROCESSENTRY32W {
    public uint dwSize; public uint cntUsage; public uint th32ProcessID; public IntPtr th32DefaultHeapID;
    public uint th32ModuleID; public uint cntThreads; public uint th32ParentProcessID; public int pcPriClassBase;
    public uint dwFlags; [MarshalAs(UnmanagedType.ByValTStr, SizeConst=260)] public string szExeFile;
  }
  public delegate bool EnumProc(IntPtr h, IntPtr lp);
  public static string C(IntPtr h) { var sb = new StringBuilder(256); GetClassName(h, sb, 256); return sb.ToString(); }
  public static string T(IntPtr h) { var sb = new StringBuilder(256); GetWindowText(h, sb, 256); return sb.ToString(); }
  // 按 exe 路径精确找 PID（QueryFullProcessImageNameW 匹配）
  public static System.Collections.Generic.List<uint> FindPidsByExePath(string exePath) {
    var result = new System.Collections.Generic.List<uint>();
    string want = exePath.Replace("/", "\\").ToLowerInvariant();
    if (!want.Contains("\\")) want = "\\" + want;
    var snap = CreateToolhelp32Snapshot(0x2, 0);
    if (snap == IntPtr.Zero) return result;
    var entry = new PROCESSENTRY32W();
    entry.dwSize = (uint)Marshal.SizeOf(typeof(PROCESSENTRY32W));
    bool ok = Process32FirstW(snap, ref entry);
    while (ok) {
      IntPtr hProc = OpenProcess(0x1000, false, entry.th32ProcessID); // PROCESS_QUERY_LIMITED_INFORMATION
      if (hProc != IntPtr.Zero) {
        var sb = new StringBuilder(1024);
        uint sz = 1024;
        if (QueryFullProcessImageNameW(hProc, 0, sb, ref sz)) {
          string full = sb.ToString().Replace("/", "\\").ToLowerInvariant();
          if (full.EndsWith(want)) result.Add(entry.th32ProcessID);
        }
        CloseHandle(hProc);
      }
      ok = Process32NextW(snap, ref entry);
    }
    CloseHandle(snap);
    return result;
  }
}
'@
Add-Type -TypeDefinition $src -Language CSharp
$WM_COMMAND = 0x111
$MF_BYPOSITION = 0x400

# 1. 找 M2Server 进程（三路：Root 路径精确匹配 → 进程名 → Toolhelp32 exe 路径）
$pids = @()
# 1a. Root 指定：从根目录定位 M2Server.exe（虾米 _guess_engine_exe_from_root）
$rootExe = ''
if ($Root -ne '') {
  $cands = @(
    (Join-Path $Root 'Mir200\M2Server.exe'),
    (Join-Path $Root 'M2Server.exe'),
    (Join-Path $Root 'Mir200\M2Server\M2Server.exe')
  )
  foreach ($c in $cands) { if (Test-Path $c) { $rootExe = $c; break } }
}
if ($rootExe -ne '') {
  $found = [M2Reload]::FindPidsByExePath($rootExe)
  foreach ($f in $found) { if ($pids -notcontains $f) { $pids += $f } }
  if ($pids.Count -eq 0) {
    $found2 = [M2Reload]::FindPidsByExePath('m2server.exe')
    foreach ($f in $found2) { if ($pids -notcontains $f) { $pids += $f } }
  }
}
if ($pids.Count -eq 0) {
  # 1b. 进程名（M2Server + GameCenter——M2 窗口可能嵌入 GameCenter 控制台）
  $procs = @(Get-Process -Name 'M2Server', 'GameCenter' -ErrorAction SilentlyContinue)
  foreach ($p in $procs) { if ($pids -notcontains $p.Id) { $pids += [uint32]$p.Id } }
}
if ($pids.Count -eq 0) {
  # 1c. Toolhelp32 按 exe 名（虾米 _iter_pids_by_exe_path）
  $found3 = [M2Reload]::FindPidsByExePath('m2server.exe')
  foreach ($f in $found3) { if ($pids -notcontains $f) { $pids += $f } }
}
if ($pids.Count -eq 0) { Write-Output 'RESULT:NO_PROCESS|未找到 M2Server/GameCenter 进程（引擎未启动）'; exit }
$pidsArr = @($pids)

# 2. 枚举这些进程的顶层窗口 + 所有子窗口（含 M2 嵌入 GameCenter 控制台场景）
$windows = @()
$cbTop = {
  param($h, $lp)
  $p = 0
  [M2Reload]::GetWindowThreadProcessId($h, [ref]$p) | Out-Null
  if ($pidsArr -contains $p) {
    $script:windows += $h
    $cbChild = {
      param($ch, $clp)
      $cp = 0
      [M2Reload]::GetWindowThreadProcessId($ch, [ref]$cp) | Out-Null
      if ($pidsArr -contains $cp) { $script:windows += $ch }
      return $true
    }
    [M2Reload]::EnumChildWindows($h, $cbChild, [IntPtr]::Zero) | Out-Null
  }
  return $true
}
[M2Reload]::EnumWindows($cbTop, [IntPtr]::Zero) | Out-Null
if ($windows.Count -eq 0) { Write-Output 'RESULT:NO_WINDOW|未找到引擎窗口'; exit }

# 3. 找带菜单的主窗口（TfrmMain 优先，要求菜单项数>0 排除伪菜单）
$mainHwnd = [IntPtr]::Zero
foreach ($h in $windows) {
  $menu = [M2Reload]::GetMenu($h)
  if ($menu -eq [IntPtr]::Zero) { continue }
  $cnt = [M2Reload]::GetMenuItemCount($menu)
  if ($cnt -le 0) { continue }
  $cls = [M2Reload]::C($h)
  $vis = [M2Reload]::IsWindowVisible($h)
  if ($cls -match 'Main|Form') { if ($vis -or $mainHwnd -eq [IntPtr]::Zero) { $mainHwnd = $h } }
  elseif ($mainHwnd -eq [IntPtr]::Zero -and $vis) { $mainHwnd = $h }
}
if ($mainHwnd -eq [IntPtr]::Zero) {
  foreach ($h in $windows) {
    $m2 = [M2Reload]::GetMenu($h)
    if ($m2 -ne [IntPtr]::Zero -and [M2Reload]::GetMenuItemCount($m2) -gt 0) { $mainHwnd = $h; break }
  }
}
if ($mainHwnd -eq [IntPtr]::Zero) { Write-Output 'RESULT:NO_MENU|未找到 M2 菜单（请确认引擎控制台中 M2 已启动）'; exit }
$hMenu = [M2Reload]::GetMenu($mainHwnd)
$topN = [M2Reload]::GetMenuItemCount($hMenu)

# 4. 找"控制"→"重新加载"子菜单（虾米基准路径 '控制>重新加载'）
# 预热：Delphi 菜单懒加载，先发 WM_INITMENU 让菜单初始化（还原自虾米 _try_warm_up_menu_path）
$WM_INITMENU = 0x116
$WM_INITMENUPOPUP = 0x117
[M2Reload]::PostMessage($mainHwnd, $WM_INITMENU, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
Start-Sleep -Milliseconds 80
$hMenu = [M2Reload]::GetMenu($mainHwnd)
$topN = [M2Reload]::GetMenuItemCount($hMenu)

function Get-SubMenuByText($menu, $text) {
  $n = [M2Reload]::GetMenuItemCount($menu)
  for ($i = 0; $i -lt $n; $i++) {
    $sb = New-Object System.Text.StringBuilder 256
    [M2Reload]::GetMenuString($menu, $i, $sb, 256, $MF_BYPOSITION) | Out-Null
    $t = $sb.ToString().Trim()
    if ($t.Contains($text)) {
      $sub = [M2Reload]::GetSubMenu($menu, $i)
      if ($sub -eq [IntPtr]::Zero -or [M2Reload]::GetMenuItemCount($sub) -le 0) {
        # 懒加载预热：子菜单未初始化时发 WM_INITMENUPOPUP 后重试
        [M2Reload]::PostMessage($mainHwnd, $WM_INITMENUPOPUP, $sub, [IntPtr]$i) | Out-Null
        Start-Sleep -Milliseconds 80
        $sub = [M2Reload]::GetSubMenu($menu, $i)
      }
      if ($sub -ne [IntPtr]::Zero -and [M2Reload]::GetMenuItemCount($sub) -gt 0) { return $sub }
    }
  }
  return [IntPtr]::Zero
}
$ctrlMenu = Get-SubMenuByText $hMenu '控制'
if ($ctrlMenu -eq [IntPtr]::Zero) { Write-Output 'RESULT:NO_RELOAD_MENU|未找到"控制"菜单'; exit }
$reloadMenu = Get-SubMenuByText $ctrlMenu '重新加载'
if ($reloadMenu -eq [IntPtr]::Zero) { Write-Output 'RESULT:NO_RELOAD_MENU|未找到"控制-重新加载"菜单'; exit }

# 5. 递归枚举叶节点（虾米 _enumerate_leaf_menu_items，路径用 > 拼接，任意深度）
$leaves = @()  # 每项: @{ Path; Id }
function Enumerate-Leaves($menu, $basePath) {
  $n = [M2Reload]::GetMenuItemCount($menu)
  for ($k = 0; $k -lt $n; $k++) {
    $sb = New-Object System.Text.StringBuilder 256
    [M2Reload]::GetMenuString($menu, $k, $sb, 256, $MF_BYPOSITION) | Out-Null
    $t = $sb.ToString().Trim()
    if ($t -eq '') { continue }
    $sub = [M2Reload]::GetSubMenu($menu, $k)
    if ($sub -ne [IntPtr]::Zero -and [M2Reload]::GetMenuItemCount($sub) -gt 0) {
      Enumerate-Leaves $sub ($basePath + '>' + $t)
    } else {
      $id = [M2Reload]::GetMenuItemID($menu, $k)
      $script:leaves += @{ Path = ($basePath + '>' + $t).TrimStart('>'); Id = $id; Text = $t }
    }
  }
}
Enumerate-Leaves $reloadMenu '重新加载'

# 6. 列出或执行
function Norm([string]$s) {
  return $s.Replace('&', '').Replace('（', '').Replace('）', '').Replace('(', '').Replace(')', '').Replace(' ', '').Replace('　', '')
}
if ($Action -eq 'list') {
  $items = @($leaves | ForEach-Object { $_.Text })
  Write-Output ("RESULT:LIST|找到 M2 窗口: " + [M2Reload]::T($mainHwnd) + " | 重载项: " + ($items -join ' / '))
  exit
}

# 执行：匹配（去 & 空格括号精确/包含 → 关键词）
$norm = (Norm $Item)
$found = $false
foreach ($leaf in $leaves) {
  $tNorm = (Norm $leaf.Text)
  if ($tNorm -eq $norm -or $tNorm.Contains($norm) -or $norm.Contains($tNorm)) {
    $ok = [M2Reload]::PostMessage($mainHwnd, $WM_COMMAND, [IntPtr]$leaf.Id, [IntPtr]::Zero)
    Write-Output ("RESULT:OK|已发送重载命令: " + $leaf.Text + " (菜单ID=" + $leaf.Id + ", PostMessage=" + $ok + ")")
    $found = $true
    break
  }
}
if (-not $found) {
  $kw = @('怪物爆率', '物品数据库', '怪物数据库', '技能数据库', 'NPC', '机器人', 'QManage', 'QFunction', 'QMission', 'QChatbox', '怪物说话', '宝箱', '安全区', '参数设置', '物品掉落', '数据列表', '地图事件', '摆摊', '出售', '假人', 'RunGate', '授权')
  foreach ($k in $kw) {
    if ($norm.Contains($k)) {
      foreach ($leaf in $leaves) {
        if ($leaf.Text.Contains($k)) {
          $ok = [M2Reload]::PostMessage($mainHwnd, $WM_COMMAND, [IntPtr]$leaf.Id, [IntPtr]::Zero)
          Write-Output ("RESULT:OK|已发送重载命令(关键词): " + $leaf.Text + " (菜单ID=" + $leaf.Id + ", PostMessage=" + $ok + ")")
          $found = $true
          break
        }
      }
    }
    if ($found) { break }
  }
}
if (-not $found) { Write-Output ("RESULT:NOT_FOUND|未找到匹配菜单项: " + $Item) }
