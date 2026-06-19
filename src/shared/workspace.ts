export type InstanceStatus = "running" | "starting" | "stopped" | "crashed" | "recovering";

export type LayoutMode = "grid" | "split" | "tabs";

export type WorkspaceEventLevel = "info" | "success" | "warning" | "error";

export interface ResourceSnapshot {
  cpuPercent: number;
  memoryMb: number;
}

export interface ManagedInstance {
  id: string;
  name: string;
  adapterId: string;
  pid: number | null;
  status: InstanceStatus;
  workspacePath: string;
  profilePath: string;
  resourceUsage: ResourceSnapshot;
  uptimeSeconds: number;
  autoRecover: boolean;
  isolatedProfile: boolean;
  groupName: string;
  windowHandle: string | null;
  lastEvent: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceEvent {
  id: string;
  instanceId?: string;
  instanceStatus?: InstanceStatus;
  instancePid?: number | null;
  level: WorkspaceEventLevel;
  message: string;
  timestamp: string;
}

export interface WorkspacePreferences {
  restoreOnLaunch: boolean;
  autoTileNewWindows: boolean;
  confirmBeforeKill: boolean;
}

export interface WorkspaceSnapshot {
  id: string;
  name: string;
  layoutMode: LayoutMode;
  selectedInstanceId: string | null;
  instances: ManagedInstance[];
  events: WorkspaceEvent[];
  preferences: WorkspacePreferences;
  updatedAt: string;
}

export interface CreateInstanceRequest {
  adapterId: string;
  name?: string;
  workspacePath?: string;
}

export interface WindowActionResult {
  ok: boolean;
  message: string;
}

export interface MultiCodexApi {
  getSnapshot: () => Promise<WorkspaceSnapshot>;
  createInstance: (request: CreateInstanceRequest) => Promise<ManagedInstance>;
  stopInstance: (instanceId: string) => Promise<ManagedInstance>;
  restartInstance: (instanceId: string) => Promise<ManagedInstance>;
  killInstance: (instanceId: string) => Promise<ManagedInstance>;
  focusInstance: (instanceId: string) => Promise<WindowActionResult>;
  saveSnapshot: (snapshot: WorkspaceSnapshot) => Promise<WorkspaceSnapshot>;
  subscribeEvents: (listener: (event: WorkspaceEvent) => void) => () => void;
}
