import { existsSync } from "node:fs";
import path from "node:path";

export interface AppAdapter {
  id: string;
  name: string;
  command: string;
  args: string[];
  defaultGroupName: string;
  profileEnvKey: string;
}

function splitArgs(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((part) => part.replace(/^"|"$/g, "")) ?? [];
}

function resolveCodexCommand(): string {
  if (process.env.MULTICODEX_CODEX_COMMAND) {
    return process.env.MULTICODEX_CODEX_COMMAND;
  }

  if (process.platform === "win32") {
    const candidates = [
      process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Programs", "Codex", "Codex.exe") : null,
      process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Programs", "codex", "Codex.exe") : null,
      process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Codex", "Codex.exe") : null,
      process.env.ProgramFiles ? path.join(process.env.ProgramFiles, "Codex", "Codex.exe") : null,
      process.env["ProgramFiles(x86)"] ? path.join(process.env["ProgramFiles(x86)"], "Codex", "Codex.exe") : null
    ];

    const match = candidates.find((candidate): candidate is string => Boolean(candidate && existsSync(candidate)));

    if (match) {
      return match;
    }
  }

  return "codex";
}

export class AdapterRegistry {
  private readonly adapters = new Map<string, AppAdapter>();

  constructor() {
    this.register({
      id: "codex",
      name: "Codex",
      command: resolveCodexCommand(),
      args: splitArgs(process.env.MULTICODEX_CODEX_ARGS),
      defaultGroupName: "AI Team",
      profileEnvKey: "CODEX_HOME"
    });
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
