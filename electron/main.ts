import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import pino from "pino";
import type { CreateInstanceRequest, WorkspaceSnapshot } from "../src/shared/workspace";
import { AdapterRegistry } from "./services/adapterRegistry";
import { WorkspaceEventBus } from "./services/eventBus";
import { ProfileManager } from "./services/profileManager";
import { ProcessSupervisor } from "./services/processSupervisor";
import { createWorkspaceRepository, type WorkspaceRepository } from "./services/workspaceRepository";
import { PlatformWindowManager } from "./services/windowManager";

const logger = pino({ name: "multicodex-main" });

let mainWindow: BrowserWindow | null = null;
let repository: WorkspaceRepository;
let supervisor: ProcessSupervisor;

if (process.env.MULTICODEX_USER_DATA_DIR) {
  app.setPath("userData", process.env.MULTICODEX_USER_DATA_DIR);
}

function createDefaultSnapshot(): WorkspaceSnapshot {
  return {
    id: "default",
    name: "AI Team Workspace",
    layoutMode: "grid",
    selectedInstanceId: null,
    instances: [],
    events: [],
    preferences: {
      restoreOnLaunch: true,
      autoTileNewWindows: true,
      confirmBeforeKill: true
    },
    updatedAt: new Date().toISOString()
  };
}

async function createMainWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1120,
    minHeight: 760,
    show: false,
    title: "MultiCodex Workspace",
    backgroundColor: "#EEF2F6",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  const shouldLoadBuiltRenderer = app.isPackaged || process.env.MULTICODEX_RENDERER === "dist";

  if (shouldLoadBuiltRenderer) {
    await mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  } else {
    await mainWindow.loadURL("http://127.0.0.1:5173");
    if (process.env.E2E !== "1") {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  }
}

async function bootstrap(): Promise<void> {
  const userDataPath = app.getPath("userData");
  const eventBus = new WorkspaceEventBus();
  const adapters = new AdapterRegistry();
  const profiles = new ProfileManager(userDataPath);
  const windows = new PlatformWindowManager();

  repository = await createWorkspaceRepository(userDataPath, logger);
  supervisor = new ProcessSupervisor(adapters, profiles, windows, eventBus, logger);

  eventBus.onEvent((event) => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) {
      return;
    }

    mainWindow.webContents.send("workspace:event", event);
  });

  ipcMain.handle("workspace:get-snapshot", async () => {
    const stored = await repository.loadSnapshot();
    const activeInstances = supervisor.list();

    if (!stored) {
      return { ...createDefaultSnapshot(), instances: activeInstances };
    }

    return {
      ...stored,
      instances: activeInstances.length > 0 ? activeInstances : stored.instances
    };
  });

  ipcMain.handle("workspace:save-snapshot", async (_event, snapshot: WorkspaceSnapshot) => {
    const nextSnapshot = {
      ...snapshot,
      updatedAt: new Date().toISOString()
    };
    return repository.saveSnapshot(nextSnapshot);
  });

  ipcMain.handle("instances:create", async (_event, request: CreateInstanceRequest) => {
    return supervisor.create(request);
  });

  ipcMain.handle("instances:stop", async (_event, instanceId: string) => {
    return supervisor.stop(instanceId);
  });

  ipcMain.handle("instances:restart", async (_event, instanceId: string) => {
    return supervisor.restart(instanceId);
  });

  ipcMain.handle("instances:kill", async (_event, instanceId: string) => {
    return supervisor.kill(instanceId);
  });

  ipcMain.handle("instances:focus", async (_event, instanceId: string) => {
    return supervisor.focus(instanceId);
  });

  await createMainWindow();
}

app.whenReady().then(bootstrap).catch((error) => {
  logger.error({ error }, "Unable to bootstrap MultiCodex");
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createMainWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  supervisor?.dispose();
});
