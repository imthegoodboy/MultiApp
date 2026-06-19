import { expect, test } from "@playwright/test";
import { _electron as electron } from "playwright";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

test("launches a Codex desktop process from the plus button", async ({}, testInfo) => {
  const userDataDir = testInfo.outputPath("user-data");
  const launchLogDir = testInfo.outputPath("launch-logs");
  const fakeCodexPath = path.resolve("tests/e2e/fixtures/fake-codex.js");
  rmSync(userDataDir, { recursive: true, force: true });
  rmSync(launchLogDir, { recursive: true, force: true });
  mkdirSync(userDataDir, { recursive: true });
  mkdirSync(launchLogDir, { recursive: true });

  const electronApp = await electron.launch({
    args: ["."],
    env: {
      ...process.env,
      E2E: "1",
      MULTICODEX_RENDERER: "dist",
      MULTICODEX_USER_DATA_DIR: userDataDir,
      MULTICODEX_KILL_CHILDREN_ON_EXIT: "1",
      MULTICODEX_CODEX_COMMAND: process.execPath,
      MULTICODEX_CODEX_ARGS: fakeCodexPath,
      MULTICODEX_FORCE_USER_DATA_ARG: "1",
      MULTICODEX_TEST_LAUNCH_LOG_DIR: launchLogDir
    }
  });

  try {
    const appWindow = await electronApp.firstWindow();

    await expect(appWindow.getByRole("heading", { name: "MultiCodex" })).toBeVisible();
    await expect(appWindow.getByText("No Codex windows open yet")).toBeVisible();

    const launchButton = appWindow.getByRole("button", { name: "Launch Codex" });
    await launchButton.click();
    await launchButton.click();

    await expect(appWindow.getByText("2 Codex windows open")).toBeVisible();
    await expect(appWindow.getByText("Codex #1", { exact: true })).toBeVisible();
    await expect(appWindow.getByText("Codex #2", { exact: true })).toBeVisible();

    await expect
      .poll(() => readdirSync(launchLogDir).filter((fileName) => fileName.endsWith(".json")).length)
      .toBe(2);

    const launches = readdirSync(launchLogDir)
      .filter((fileName) => fileName.endsWith(".json"))
      .map((fileName) => JSON.parse(readFileSync(path.join(launchLogDir, fileName), "utf8")) as {
        argv: string[];
        env: Record<string, string>;
      });

    const profilePaths = new Set(launches.map((launch) => launch.env.MULTICODEX_PROFILE_PATH));
    const userDataArgs = launches.map((launch) => launch.argv.find((arg) => arg.startsWith("--user-data-dir=")));

    expect(profilePaths.size).toBe(2);
    expect(userDataArgs.every(Boolean)).toBe(true);
    expect(new Set(userDataArgs).size).toBe(2);
    expect(launches.every((launch) => existsSync(launch.env.MULTICODEX_PROFILE_PATH))).toBe(true);

    await appWindow.getByRole("button", { name: "Close Codex #1" }).click();
    await expect(appWindow.getByText("1 Codex window open")).toBeVisible();
    await expect(appWindow.getByText("Codex #1", { exact: true })).toBeHidden();
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
