import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { WindowActionResult } from "../../src/shared/workspace";

const execFileAsync = promisify(execFile);

export class PlatformWindowManager {
  async focusProcessWindow(pid: number | null): Promise<WindowActionResult> {
    if (!pid) {
      return { ok: false, message: "No process ID is available for this instance." };
    }

    if (process.platform !== "win32") {
      return {
        ok: false,
        message: "Native window focus is implemented for Windows first."
      };
    }

    const script = `
      Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class NativeWindow {
        [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
        [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
      }
"@
      $process = Get-Process -Id ${pid} -ErrorAction Stop
      $handle = $process.MainWindowHandle
      if ($handle -eq 0) { throw "No main window handle found for PID ${pid}" }
      [NativeWindow]::ShowWindowAsync($handle, 9) | Out-Null
      [NativeWindow]::SetForegroundWindow($handle) | Out-Null
    `;

    try {
      await execFileAsync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
        windowsHide: true
      });

      return { ok: true, message: `Focused native window for PID ${pid}.` };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to focus native window.";
      return { ok: false, message };
    }
  }
}
