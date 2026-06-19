/// <reference types="vite/client" />

import type { MultiCodexApi } from "./shared/workspace";

declare global {
  interface Window {
    multiCodex?: MultiCodexApi;
  }
}

export {};
