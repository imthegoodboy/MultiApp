import { mkdir } from "node:fs/promises";
import path from "node:path";

export class ProfileManager {
  constructor(private readonly rootPath: string) {}

  async createProfile(instanceId: string): Promise<{ profilePath: string; workspacePath: string }> {
    const profilePath = path.join(this.rootPath, "profiles", instanceId);
    const workspacePath = path.join(this.rootPath, "workspaces", instanceId);

    await Promise.all([
      mkdir(profilePath, { recursive: true }),
      mkdir(workspacePath, { recursive: true })
    ]);

    return { profilePath, workspacePath };
  }
}
