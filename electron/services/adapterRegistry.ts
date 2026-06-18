import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

export interface AppAdapter {
  id: string;
  name: string;
  command: string;
  args: string[];
  defaultGroupName: string;
  profileEnvKey: string;
  sourceDescription: string;
  supportsUserDataDirArg: boolean;
}

function splitArgs(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((part) => part.replace(/^"|"$/g, "")) ?? [];
}

function resolveCodexCommand(): string {
  return resolveCodexAdapter().command;
}

function isExecutablePath(command: string): boolean {
  return /\.(exe|com)$/i.test(command);
}

function shouldUseUserDataArg(command: string): boolean {
  if (process.env.MULTICODEX_FORCE_USER_DATA_ARG === "1") {
    return true;
  }

  if (process.env.MULTICODEX_DISABLE_USER_DATA_ARG === "1") {
    return false;
  }

  return isExecutablePath(command);
}

function commonWindowsCodexExecutables(): string[] {
  return [
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Programs", "Codex", "Codex.exe") : null,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Programs", "codex", "Codex.exe") : null,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Codex", "Codex.exe") : null,
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, "Codex", "Codex.exe") : null,
    process.env["ProgramFiles(x86)"] ? path.join(process.env["ProgramFiles(x86)"], "Codex", "Codex.exe") : null
  ].filter((candidate): candidate is string => Boolean(candidate));
}

function resolvePackagedWindowsCodexExecutable(): string | null {
  if (process.platform !== "win32" || process.env.MULTICODEX_DISABLE_APPX_DISCOVERY === "1") {
    return null;
  }

  const script = [
    "$pkg = Get-AppxPackage OpenAI.Codex -ErrorAction SilentlyContinue | Select-Object -First 1",
    "if ($pkg) {",
    "  $exe = Join-Path $pkg.InstallLocation 'app\\Codex.exe'",
    "  if (Test-Path -LiteralPath $exe) { [Console]::Out.Write($exe) }",
    "}"
  ].join("; ");

  try {
    const output = execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
      encoding: "utf8",
      timeout: 5_000,
      windowsHide: true
    }).trim();

    return output && existsSync(output) ? output : null;
  } catch {
    return null;
  }
}

function resolveCodexAdapter(): AppAdapter {
  const envCommand = process.env.MULTICODEX_CODEX_COMMAND;

  if (envCommand) {
    return {
      id: "codex",
      name: "Codex",
      command: envCommand,
      args: splitArgs(process.env.MULTICODEX_CODEX_ARGS),
      defaultGroupName: "Codex",
      profileEnvKey: "CODEX_HOME",
      sourceDescription: "MULTICODEX_CODEX_COMMAND",
      supportsUserDataDirArg: shouldUseUserDataArg(envCommand)
    };
  }

  const packagedExecutable = resolvePackagedWindowsCodexExecutable();

  if (packagedExecutable) {
    return {
      id: "codex",
      name: "Codex",
      command: packagedExecutable,
      args: splitArgs(process.env.MULTICODEX_CODEX_ARGS),
      defaultGroupName: "Codex",
      profileEnvKey: "CODEX_HOME",
      sourceDescription: "Windows OpenAI.Codex package",
      supportsUserDataDirArg: true
    };
  }

  const installedExecutable = commonWindowsCodexExecutables().find((candidate) => existsSync(candidate));

  if (installedExecutable) {
    return {
      id: "codex",
      name: "Codex",
      command: installedExecutable,
      args: splitArgs(process.env.MULTICODEX_CODEX_ARGS),
      defaultGroupName: "Codex",
      profileEnvKey: "CODEX_HOME",
      sourceDescription: "installed Codex.exe",
      supportsUserDataDirArg: true
    };
  }

  return {
    id: "codex",
    name: "Codex",
    command: "codex",
    args: splitArgs(process.env.MULTICODEX_CODEX_ARGS),
    defaultGroupName: "Codex",
    profileEnvKey: "CODEX_HOME",
    sourceDescription: "codex on PATH",
    supportsUserDataDirArg: false
  };
}

export class AdapterRegistry {
  private readonly adapters = new Map<string, AppAdapter>();

  constructor() {
    this.register(resolveCodexAdapter());
  }

  register(adapter: AppAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  get(adapterId: string): AppAdapter {
    const adapter = this.adapters.get(adapterId);

    if (!adapter) {
      throw new Error(`Unknown app adapter: ${adapterId}`);
    }

    return adapter;
  }
}
