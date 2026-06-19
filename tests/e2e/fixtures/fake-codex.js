const fs = require("node:fs");
const path = require("node:path");

const launchLogDir = process.env.MULTICODEX_TEST_LAUNCH_LOG_DIR;
const instanceId = process.env.MULTICODEX_INSTANCE_ID || `pid-${process.pid}`;

if (launchLogDir) {
  fs.mkdirSync(launchLogDir, { recursive: true });
  fs.writeFileSync(
    path.join(launchLogDir, `${instanceId}.json`),
    JSON.stringify(
      {
        pid: process.pid,
        argv: process.argv.slice(2),
        env: {
          CODEX_HOME: process.env.CODEX_HOME,
          OPENAI_CODEX_HOME: process.env.OPENAI_CODEX_HOME,
          ELECTRON_USER_DATA_DIR: process.env.ELECTRON_USER_DATA_DIR,
          MULTICODEX_INSTANCE_ID: process.env.MULTICODEX_INSTANCE_ID,
          MULTICODEX_PROFILE_PATH: process.env.MULTICODEX_PROFILE_PATH,
          MULTICODEX_WORKSPACE_PATH: process.env.MULTICODEX_WORKSPACE_PATH
        }
      },
      null,
      2
    ),
    "utf8"
  );
}

setTimeout(() => undefined, 10_000);
