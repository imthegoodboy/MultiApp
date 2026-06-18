import { contextBridge, ipcRenderer } from "electron";
import type {
  CreateInstanceRequest,
  ManagedInstance,
  MultiCodexApi,
  WindowActionResult,
  WorkspaceEvent,
  WorkspaceSnapshot
} from "../src/shared/workspace";

const api: MultiCodexApi = {
  getSnapshot: () => ipcRenderer.invoke("workspace:get-snapshot") as Promise<WorkspaceSnapshot>,
  createInstance: (request: CreateInstanceRequest) =>
    ipcRenderer.invoke("instances:create", request) as Promise<ManagedInstance>,
  stopInstance: (instanceId: string) => ipcRenderer.invoke("instances:stop", instanceId) as Promise<ManagedInstance>,
  restartInstance: (instanceId: string) =>
    ipcRenderer.invoke("instances:restart", instanceId) as Promise<ManagedInstance>,
  killInstance: (instanceId: string) => ipcRenderer.invoke("instances:kill", instanceId) as Promise<ManagedInstance>,
  focusInstance: (instanceId: string) =>
    ipcRenderer.invoke("instances:focus", instanceId) as Promise<WindowActionResult>,
  saveSnapshot: (snapshot: WorkspaceSnapshot) =>
    ipcRenderer.invoke("workspace:save-snapshot", snapshot) as Promise<WorkspaceSnapshot>,
  subscribeEvents: (listener: (event: WorkspaceEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: WorkspaceEvent) => listener(payload);
    ipcRenderer.on("workspace:event", handler);
    return () => ipcRenderer.off("workspace:event", handler);
  }
};

contextBridge.exposeInMainWorld("multiCodex", api);
