import { expect, test } from "@playwright/test";
import { _electron as electron } from "playwright";
import { mkdirSync } from "node:fs";

test("launches a Codex desktop process from the plus button", async ({}, testInfo) => {
  const userDataDir = testInfo.outputPath("user-data");
  mkdirSync(userDataDir, { recursive: true });

  const electronApp = await electron.launch({
    args: ["."],
    env: {
      ...process.env,
      E2E: "1",
      MULTICODEX_RENDERER: "dist",
      MULTICODEX_USER_DATA_DIR: userDataDir,
      MULTICODEX_CODEX_COMMAND: process.execPath,
      MULTICODEX_CODEX_ARGS: '-e "setTimeout(() => {}, 250)"'
    }
  });

  try {
    const appWindow = await electronApp.firstWindow();

    await expect(appWindow.getByRole("heading", { name: "MultiCodex" })).toBeVisible();
    await expect(appWindow.getByText("No Codex windows launched yet")).toBeVisible();

    await appWindow.getByRole("button", { name: "Launch Codex" }).click();
    await expect(appWindow.getByText("1 Codex window launched")).toBeVisible();
    await expect(appWindow.getByText("Codex #1", { exact: true })).toBeVisible();

    await appWindow.getByRole("button", { name: "Launch Codex" }).click();
    await expect(appWindow.getByText("2 Codex windows launched")).toBeVisible();
    await expect(appWindow.getByText("Codex #2", { exact: true })).toBeVisible();
  } finally {
    await Promise.race([
      electronApp.close(),
      new Promise((_, reject) => {
        globalThis.setTimeout(() => reject(new Error("Timed out closing Electron")), 5_000);
      })
    ]).catch(() => {
      electronApp.process().kill();
    });
  }
});
