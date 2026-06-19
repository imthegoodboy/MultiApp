import { execFile, spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { Logger } from "pino";
import { createMachine } from "xstate";
import type { ManagedInstance } from "../../src/shared/workspace";
import { AdapterRegistry, type AppAdapter } from "./adapterRegistry";
import { WorkspaceEventBus } from "./eventBus";
import { ProfileManager } from "./profileManager";
import { PlatformWindowManager } from "./windowManager";

const execFileAsync = promisify(execFile);

const instanceLifecycleMachine = createMachine({
  id: "instanceLifecycle",
  initial: "stopped",
  states: {
    stopped: { on: { START: "starting" } },
    starting: { on: { READY: "running", FAIL: "crashed", STOP: "stopped" } },
    running: { on: { STOP: "stopped", CRASH: "crashed", RESTART: "recovering" } },
    crashed: { on: { RECOVER: "recovering", START: "starting" } },
    recovering: { on: { READY: "running", FAIL: "crashed", STOP: "stopped" } }
  }
});

export class ProcessSupervisor {
  private readonly children = new Map<string, ChildProcess>();
  private readonly instances = new Map<string, ManagedInstance>();
  private readonly killChildrenOnDispose = process.env.MULTICODEX_KILL_CHILDREN_ON_EXIT === "1";

  constructor(
    private readonly adapters: AdapterRegistry,
    private readonly profiles: ProfileManager,
    private readonly windows: PlatformWindowManager,
    private readonly eventBus: WorkspaceEventBus,
    private readonly logger: Logger
  ) {
    void instanceLifecycleMachine;
  }

  list(): ManagedInstance[] {
    return [...this.instances.values()].filter((instance) => instance.status !== "stopped");
  }

  async create(request: { adapterId: string; name?: string; workspacePath?: string }): Promise<ManagedInstance> {
    const adapter = this.adapters.get(request.adapterId);
    const id = crypto.randomUUID();
    const profile = await this.profiles.createProfile(id);
    const instance: ManagedInstance = {
      id,
      name: request.name ?? `${adapter.name} ${this.instances.size + 1}`,
      adapterId: adapter.id,
      pid: null,
      status: "starting",
      workspacePath: request.workspacePath ?? profile.workspacePath,
      profilePath: profile.profilePath,
      resourceUsage: { cpuPercent: 0, memoryMb: 0 },
      uptimeSeconds: 0,
      autoRecover: true,
      isolatedProfile: true,
      groupName: adapter.defaultGroupName,
      windowHandle: null,
      lastEvent: "Creating isolated profile",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.instances.set(id, instance);
    this.eventBus.publish("info", `Created isolated profile for ${instance.name}`, id, {
      instanceStatus: "starting",
      instancePid: null
    });

    try {
      this.launchInstance(instance, adapter);
    } catch (error) {
      instance.pid = null;
      instance.status = "crashed";
      instance.lastEvent = error instanceof Error ? error.message : "Unable to start process";
      instance.updatedAt = new Date().toISOString();
      this.logger.warn({ error, adapter }, "Failed to launch adapter process");
      this.eventBus.publish("error", instance.lastEvent, id, {
        instanceStatus: "crashed",
        instancePid: null
      });
    }

    return { ...instance };
  }

  async stop(instanceId: string): Promise<ManagedInstance> {
    const instance = this.requireInstance(instanceId);
    const child = this.children.get(instanceId);

    if (child) {
      await this.terminateChild(child, false);
      this.children.delete(instanceId);
    }

    instance.status = "stopped";
    instance.pid = null;
    instance.lastEvent = "Stop requested";
    instance.updatedAt = new Date().toISOString();
    this.eventBus.publish("info", `${instance.name} stopped`, instanceId, {
      instanceStatus: "stopped",
      instancePid: null
    });

    return { ...instance };
  }

  async kill(instanceId: string): Promise<ManagedInstance> {
    const instance = this.requireInstance(instanceId);
    const child = this.children.get(instanceId);

    if (child) {
      await this.terminateChild(child, true);
      this.children.delete(instanceId);
    }

    instance.status = "stopped";
    instance.pid = null;
    instance.lastEvent = "Kill requested";
    instance.updatedAt = new Date().toISOString();
    this.eventBus.publish("warning", `${instance.name} was killed`, instanceId, {
      instanceStatus: "stopped",
      instancePid: null
    });

    return { ...instance };
  }

  async restart(instanceId: string): Promise<ManagedInstance> {
    const instance = this.requireInstance(instanceId);
    const adapter = this.adapters.get(instance.adapterId);
    const child = this.children.get(instanceId);

    if (child) {
      await this.terminateChild(child, false);
      this.children.delete(instanceId);
    }

    instance.status = "recovering";
    instance.pid = null;
    instance.lastEvent = "Restart queued";
    instance.updatedAt = new Date().toISOString();
    this.eventBus.publish("info", `${instance.name} restart queued`, instanceId, {
      instanceStatus: "recovering",
      instancePid: null
    });

    this.launchInstance(instance, adapter);
    return { ...instance };
  }

  async focus(instanceId: string) {
    const instance = this.requireInstance(instanceId);
    return this.windows.focusProcessWindow(instance.pid);
  }

  dispose(): void {
    if (!this.killChildrenOnDispose) {
      return;
    }

    for (const child of this.children.values()) {
      void this.terminateChild(child, true);
    }

    this.children.clear();
  }

  private launchInstance(instance: ManagedInstance, adapter: AppAdapter): void {
    const useShell = process.platform === "win32" && !/\.(exe|com)$/i.test(adapter.command);
    const launchArgs = this.buildLaunchArgs(instance, adapter);
    const child = spawn(adapter.command, launchArgs, {
      cwd: instance.workspacePath,
      env: {
        ...process.env,
        [adapter.profileEnvKey]: instance.profilePath,
        CODEX_HOME: instance.profilePath,
        OPENAI_CODEX_HOME: instance.profilePath,
        ELECTRON_USER_DATA_DIR: path.join(instance.profilePath, "electron-user-data"),
        MULTICODEX_INSTANCE_ID: instance.id,
        MULTICODEX_PROFILE_PATH: instance.profilePath,
        MULTICODEX_WORKSPACE_PATH: instance.workspacePath
      },
      shell: useShell,
      windowsHide: false,
      stdio: "ignore",
      detached: !this.killChildrenOnDispose
    });

    if (!this.killChildrenOnDispose) {
      child.unref();
    }

    instance.pid = child.pid ?? null;
    instance.status = "starting";
    instance.lastEvent = `Launching ${adapter.name} from ${adapter.sourceDescription}`;
    instance.updatedAt = new Date().toISOString();
    this.children.set(instance.id, child);
    this.eventBus.publish("info", `${instance.name} launch requested`, instance.id, {
      instanceStatus: "starting",
      instancePid: instance.pid
    });

    const readyTimer = setTimeout(() => {
      const current = this.instances.get(instance.id);

      if (!current || !this.children.has(instance.id) || current.status !== "starting") {
        return;
      }

      current.status = "running";
      current.lastEvent = `${adapter.name} is running with isolated profile`;
      current.updatedAt = new Date().toISOString();
      this.eventBus.publish("success", `${current.name} running with PID ${current.pid ?? "unknown"}`, current.id, {
        instanceStatus: "running",
        instancePid: current.pid
      });
    }, 900);

    child.on("error", (error) => {
      clearTimeout(readyTimer);
      const current = this.instances.get(instance.id);

      if (!current) {
        return;
      }

      current.pid = null;
      current.status = "crashed";
      current.lastEvent = error.message;
      current.updatedAt = new Date().toISOString();
      this.children.delete(instance.id);
      this.logger.warn({ error, adapter }, "Adapter process emitted error");
      this.eventBus.publish("error", error.message, instance.id, {
        instanceStatus: "crashed",
        instancePid: null
      });
    });

    child.on("exit", (code) => {
      clearTimeout(readyTimer);
      const current = this.instances.get(instance.id);

      if (!current) {
        return;
      }

      const wasStopped = current.status === "stopped";
      current.pid = null;
      current.status = wasStopped || code === 0 ? "stopped" : "crashed";
      current.lastEvent = wasStopped || code === 0 ? "Process exited cleanly" : `Process exited with code ${code}`;
      current.updatedAt = new Date().toISOString();
      this.children.delete(instance.id);
      this.eventBus.publish(current.status === "stopped" ? "info" : "error", current.lastEvent, instance.id, {
        instanceStatus: current.status,
        instancePid: null
      });
    });
  }

  private buildLaunchArgs(instance: ManagedInstance, adapter: AppAdapter): string[] {
    const launchArgs = [...adapter.args];

    if (adapter.supportsUserDataDirArg) {
      launchArgs.push(`--user-data-dir=${path.join(instance.profilePath, "electron-user-data")}`);
    }

    return launchArgs;
  }

  private async terminateChild(child: ChildProcess, force: boolean): Promise<void> {
    if (process.platform === "win32" && child.pid) {
      const args = ["/PID", String(child.pid), "/T"];

      if (force) {
        args.push("/F");
      }

      try {
        await execFileAsync("taskkill.exe", args, { windowsHide: true });
        return;
      } catch (error) {
        this.logger.debug({ error, pid: child.pid }, "taskkill failed, falling back to child.kill");
      }
    }

    child.kill(force ? "SIGKILL" : undefined);
  }

  private requireInstance(instanceId: string): ManagedInstance {
    const instance = this.instances.get(instanceId);

    if (!instance) {
      throw new Error(`Unknown managed instance: ${instanceId}`);
    }

    return instance;
  }
}
