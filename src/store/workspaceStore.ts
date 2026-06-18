import { create } from "zustand";
import { createSeedWorkspace } from "../data/seedWorkspace";
import type { ManagedInstance, WorkspaceEvent, WorkspaceSnapshot } from "../shared/workspace";

interface WorkspaceStore {
  snapshot: WorkspaceSnapshot;
  isLaunching: boolean;
  launchCodex: () => Promise<void>;
  closeCodex: (instanceId: string) => Promise<void>;
  hydrateFromHost: () => Promise<void>;
  appendEvent: (event: WorkspaceEvent) => void;
}

const initialSnapshot = createSeedWorkspace();

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `instance-${Date.now()}`;
}

function now(): string {
  return new Date().toISOString();
}

function appendEventToSnapshot(snapshot: WorkspaceSnapshot, event: WorkspaceEvent): WorkspaceSnapshot {
  return {
    ...snapshot,
    events: [event, ...snapshot.events].slice(0, 40),
    updatedAt: now()
  };
}

function localEvent(message: string, level: WorkspaceEvent["level"], instanceId?: string): WorkspaceEvent {
  return {
    id: createId(),
    instanceId,
    level,
    message,
    timestamp: now()
  };
}

function makeLocalInstance(index: number): ManagedInstance {
  const id = createId();

  return {
    id,
    name: `Codex #${index}`,
    adapterId: "codex",
    pid: Math.floor(18000 + Math.random() * 9000),
    status: "starting",
    workspacePath: `C:\\Users\\parth\\Workspaces\\codex-${index}`,
    profilePath: `C:\\Users\\parth\\AppData\\Roaming\\MultiCodex\\profiles\\${id}`,
    resourceUsage: { cpuPercent: 2, memoryMb: 256 },
    uptimeSeconds: 0,
    autoRecover: true,
    isolatedProfile: true,
    groupName: "AI Team",
    windowHandle: null,
    lastEvent: "Creating isolated profile",
    createdAt: now(),
    updatedAt: now()
  };
}

function updateInstance(
  snapshot: WorkspaceSnapshot,
  instanceId: string,
  updater: (instance: ManagedInstance) => ManagedInstance
): WorkspaceSnapshot {
  return {
    ...snapshot,
    instances: snapshot.instances.map((instance) => (instance.id === instanceId ? updater(instance) : instance)),
    updatedAt: now()
  };
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  snapshot: initialSnapshot,
  isLaunching: false,

  launchCodex: async () => {
    const { snapshot } = get();
    const nextIndex = snapshot.instances.length + 1;

    set({ isLaunching: true });

    try {
      const created = await window.multiCodex?.createInstance({ adapterId: "codex", name: `Codex #${nextIndex}` });

      if (created) {
        set(({ snapshot: current }) => ({
          snapshot: appendEventToSnapshot(
            {
              ...current,
              selectedInstanceId: created.id,
              instances: [created, ...current.instances]
            },
            localEvent(`${created.name} launch requested`, "success", created.id)
          ),
          isLaunching: false
        }));
        return;
      }
    } catch {
      // Development browser preview falls back to a local simulated instance.
    }

    const created = makeLocalInstance(nextIndex);
    set(({ snapshot: current }) => ({
      snapshot: appendEventToSnapshot(
        {
          ...current,
          selectedInstanceId: created.id,
          instances: [created, ...current.instances]
        },
        localEvent(`${created.name} launch queued`, "success", created.id)
      ),
      isLaunching: false
    }));

    window.setTimeout(() => {
      set(({ snapshot: current }) => ({
        snapshot: updateInstance(current, created.id, (instance) => ({
          ...instance,
          status: "running",
          lastEvent: "Process heartbeat healthy",
          resourceUsage: { cpuPercent: 8, memoryMb: 420 },
          updatedAt: now()
        }))
      }));
    }, 900);
  },

  closeCodex: async (instanceId) => {
    const instanceName = get().snapshot.instances.find((instance) => instance.id === instanceId)?.name ?? "Codex";

    try {
      await window.multiCodex?.stopInstance(instanceId);
    } catch {
      // Browser preview has no Electron host, but the row can still be removed.
    }

    set(({ snapshot }) => ({
      snapshot: appendEventToSnapshot(
        {
          ...snapshot,
          selectedInstanceId: snapshot.selectedInstanceId === instanceId ? null : snapshot.selectedInstanceId,
          instances: snapshot.instances.filter((instance) => instance.id !== instanceId)
        },
        localEvent(`${instanceName} closed`, "info", instanceId)
      )
    }));
  },

  hydrateFromHost: async () => {
    try {
      const hostSnapshot = await window.multiCodex?.getSnapshot();

      if (!hostSnapshot) {
        return;
      }

      set(({ snapshot }) => ({
        snapshot: hostSnapshot.instances.length > 0 ? hostSnapshot : { ...hostSnapshot, instances: snapshot.instances }
      }));

      window.multiCodex?.subscribeEvents((event) => {
        get().appendEvent(event);
      });
    } catch {
      set(({ snapshot }) => ({
        snapshot: appendEventToSnapshot(snapshot, localEvent("Running without Electron host", "info"))
      }));
    }
  },

  appendEvent: (event) => {
    set(({ snapshot }) => ({
      snapshot: event.instanceId
        ? updateInstance(appendEventToSnapshot(snapshot, event), event.instanceId, (instance) => ({
            ...instance,
            pid: event.instancePid !== undefined ? event.instancePid : instance.pid,
            status: event.instanceStatus ?? (event.level === "error" ? "crashed" : instance.status),
            lastEvent: event.message,
            updatedAt: now()
          }))
        : appendEventToSnapshot(snapshot, event)
    }));
  }
}));
