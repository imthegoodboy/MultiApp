import { EventEmitter } from "node:events";
import type { InstanceStatus, WorkspaceEvent, WorkspaceEventLevel } from "../../src/shared/workspace";

interface WorkspaceEventPatch {
  instanceStatus?: InstanceStatus;
  instancePid?: number | null;
}

export class WorkspaceEventBus {
  private readonly emitter = new EventEmitter();

  publish(level: WorkspaceEventLevel, message: string, instanceId?: string, patch: WorkspaceEventPatch = {}): WorkspaceEvent {
    const event: WorkspaceEvent = {
      id: crypto.randomUUID(),
      instanceId,
      ...patch,
      level,
      message,
      timestamp: new Date().toISOString()
    };

    this.emitter.emit("event", event);
    return event;
  }

  onEvent(listener: (event: WorkspaceEvent) => void): () => void {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }
}
