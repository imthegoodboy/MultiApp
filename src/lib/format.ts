export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

export function formatMemory(valueMb: number): string {
  if (valueMb >= 1024) {
    return `${(valueMb / 1024).toFixed(1)} GB`;
  }

  return `${Math.round(valueMb)} MB`;
}

export function compactPath(value: string): string {
  const normalized = value.replaceAll("\\", "/");
  const parts = normalized.split("/").filter(Boolean);

  if (parts.length <= 3) {
    return value;
  }

  return `.../${parts.slice(-3).join("/")}`;
}
