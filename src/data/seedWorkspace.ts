import type { WorkspaceSnapshot } from "../shared/workspace";

export function createSeedWorkspace(): WorkspaceSnapshot {
  const now = new Date().toISOString();

  return {
    id: "default",
    name: "MultiCodex Launcher",
    layoutMode: "grid",
    selectedInstanceId: null,
    instances: [],
    events: [],
    preferences: {
      restoreOnLaunch: true,
      autoTileNewWindows: true,
      confirmBeforeKill: true
    },
    updatedAt: now
  };
}
