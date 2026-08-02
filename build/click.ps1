param(
  [int]$X,
  [int]$Y,
  [switch]$Right
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MouseSim {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, IntPtr dwExtraInfo);
  public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
  public const uint MOUSEEVENTF_LEFTUP = 0x0004;
  public const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
  public const uint MOUSEEVENTF_RIGHTUP = 0x0010;
}
"@

[MouseSim]::SetCursorPos($X, $Y) | Out-Null
Start-Sleep -Milliseconds 150
if ($Right) {
  [MouseSim]::mouse_event([MouseSim]::MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, [IntPtr]::Zero)
  Start-Sleep -Milliseconds 60
  [MouseSim]::mouse_event([MouseSim]::MOUSEEVENTF_RIGHTUP, 0, 0, 0, [IntPtr]::Zero)
} else {
  [MouseSim]::mouse_event([MouseSim]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [IntPtr]::Zero)
  Start-Sleep -Milliseconds 60
  [MouseSim]::mouse_event([MouseSim]::MOUSEEVENTF_LEFTUP, 0, 0, 0, [IntPtr]::Zero)
}
Write-Output "clicked $X,$Y right=$Right"
