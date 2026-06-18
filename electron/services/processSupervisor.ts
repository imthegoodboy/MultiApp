import { spawn, type ChildProcess } from "node:child_process";
import type { Logger } from "pino";
import { createMachine } from "xstate";
import type { ManagedInstance } from "../../src/shared/workspace";
import { AdapterRegistry, type AppAdapter } from "./adapterRegistry";
import { WorkspaceEventBus } from "./eventBus";
import { ProfileManager } from "./profileManager";
import { PlatformWindowManager } from "./windowManager";

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
    return [...this.instances.values()];
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
    this.eventBus.publish("info", `Created profile for ${instance.name}`, id);

    try {
      this.launchInstance(instance, adapter);
    } catch (error) {
      instance.status = "crashed";
      instance.lastEvent = error instanceof Error ? error.message : "Unable to start process";
      instance.updatedAt = new Date().toISOString();
      this.logger.warn({ error, adapter }, "Failed to launch adapter process");
      this.eventBus.publish("error", instance.lastEvent, id);
    }

    return { ...instance };
  }

  async stop(instanceId: string): Promise<ManagedInstance> {
    const instance = this.requireInstance(instanceId);
    const child = this.children.get(instanceId);

    if (child) {
      child.kill();
      this.children.delete(instanceId);
    }

    instance.status = "stopped";
    instance.pid = null;
    instance.lastEvent = "Stop requested";
    instance.updatedAt = new Date().toISOString();
    this.eventBus.publish("info", `${instance.name} stopped`, instanceId);

    return { ...instance };
  }

  async kill(instanceId: string): Promise<ManagedInstance> {
    const instance = this.requireInstance(instanceId);
    const child = this.children.get(instanceId);

    if (child) {
      child.kill("SIGKILL");
      this.children.delete(instanceId);
    }

    instance.status = "stopped";
    instance.pid = null;
    instance.lastEvent = "Kill requested";
    instance.updatedAt = new Date().toISOString();
    this.eventBus.publish("warning", `${instance.name} was killed`, instanceId);

    return { ...instance };
  }

  async restart(instanceId: string): Promise<ManagedInstance> {
    const instance = this.requireInstance(instanceId);
    const adapter = this.adapters.get(instance.adapterId);
    const child = this.children.get(instanceId);

    if (child) {
      child.kill();
      this.children.delete(instanceId);
    }

    instance.status = "recovering";
    instance.pid = null;
    instance.lastEvent = "Restart queued";
    instance.updatedAt = new Date().toISOString();
    this.eventBus.publish("info", `${instance.name} restart queued`, instanceId);

    this.launchInstance(instance, adapter);
    return { ...instance };
  }

  async focus(instanceId: string) {
    const instance = this.requireInstance(instanceId);
    return this.windows.focusProcessWindow(instance.pid);
  }

  dispose(): void {
    for (const child of this.children.values()) {
      child.kill();
    }

    this.children.clear();
  }

  private launchInstance(instance: ManagedInstance, adapter: AppAdapter): void {
    const useShell = process.platform === "win32" && !/\.(exe|com)$/i.test(adapter.command);
    const child = spawn(adapter.command, adapter.args, {
      cwd: instance.workspacePath,
      env: {
        ...process.env,
        [adapter.profileEnvKey]: instance.profilePath,
        MULTICODEX_INSTANCE_ID: instance.id,
        MULTICODEX_WORKSPACE_PATH: instance.workspacePath
      },
      shell: useShell,
      windowsHide: false,
      stdio: "ignore"
    });
    child.unref();

    instance.pid = child.pid ?? null;
    instance.status = "running";
    instance.lastEvent = `Started ${adapter.command}`;
    instance.updatedAt = new Date().toISOString();
    this.children.set(instance.id, child);
    this.eventBus.publish("success", `${instance.name} started with PID ${instance.pid ?? "unknown"}`, instance.id);

    child.on("error", (error) => {
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
      this.eventBus.publish("error", error.message, instance.id);
    });

    child.on("exit", (code) => {
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
      this.eventBus.publish(current.status === "stopped" ? "info" : "error", current.lastEvent, instance.id);
    });
  }

  private requireInstance(instanceId: string): ManagedInstance {
    const instance = this.instances.get(instanceId);

    if (!instance) {
      throw new Error(`Unknown managed instance: ${instanceId}`);
    }

    return instance;
  }
}
