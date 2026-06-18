import { describe, expect, it } from "vitest";
import { compactPath, formatDuration, formatMemory } from "../src/lib/format";

describe("format helpers", () => {
  it("formats short and long durations", () => {
    expect(formatDuration(600)).toBe("10m");
    expect(formatDuration(7380)).toBe("2h 3m");
  });

  it("formats memory in MB and GB", () => {
    expect(formatMemory(640)).toBe("640 MB");
    expect(formatMemory(1536)).toBe("1.5 GB");
  });

  it("compacts long Windows paths", () => {
    expect(compactPath("C:\\Users\\parth\\AppData\\Roaming\\MultiCodex\\profiles\\codex-1")).toBe(
      ".../MultiCodex/profiles/codex-1"
    );
  });
});
