import type {
  LogEntry,
  LogEvent,
  EventTypeHealth,
  MonitoringHealth,
  HealthStatus,
} from "./types.js";

const TRACKED_EVENTS: LogEvent[] = ["MONITOR", "STARS"];
const STALE_ABSOLUTE_MS = 6 * 60 * 60 * 1000; // 6 hours
const DEFAULT_FREQUENCY_MS = 30 * 60 * 1000; // 30 minutes

export function parseLogTimestamp(ts: string): Date {
  const [datePart, timePart] = ts.split(" ");
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, min] = timePart.split(":").map(Number);
  return new Date(y, m - 1, d, h, min);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function deriveEventHealth(
  entries: LogEntry[],
  eventType: LogEvent,
  now: Date,
): EventTypeHealth | null {
  const filtered = entries
    .filter((e) => e.event === eventType)
    .map((e) => ({ ...e, _ts: parseLogTimestamp(e.timestamp) }))
    .sort((a, b) => a._ts.getTime() - b._ts.getTime());

  if (filtered.length === 0) return null;

  const last = filtered[filtered.length - 1];
  const lastRun = last._ts;
  const gap = now.getTime() - lastRun.getTime();

  // Compute frequency from consecutive gaps
  const gaps: number[] = [];
  for (let i = 1; i < filtered.length; i++) {
    gaps.push(filtered[i]._ts.getTime() - filtered[i - 1]._ts.getTime());
  }
  const inferredFrequencyMs = gaps.length > 0 ? median(gaps) : null;

  // Determine health
  let health: HealthStatus;
  if (gap > STALE_ABSOLUTE_MS) {
    health = "stopped";
  } else if (gap > 2 * (inferredFrequencyMs ?? DEFAULT_FREQUENCY_MS)) {
    health = "stale";
  } else {
    health = "active";
  }

  return {
    eventType,
    lastRun,
    inferredFrequencyMs,
    health,
    eventCount: filtered.length,
    lastDetail: last.detail,
  };
}

export function deriveMonitoringHealth(
  entries: LogEntry[],
  now: Date = new Date(),
): MonitoringHealth {
  const types: EventTypeHealth[] = [];

  for (const eventType of TRACKED_EVENTS) {
    const result = deriveEventHealth(entries, eventType, now);
    if (result) types.push(result);
  }

  const worst: HealthStatus =
    types.some((t) => t.health === "stopped")
      ? "stopped"
      : types.some((t) => t.health === "stale")
        ? "stale"
        : types.length > 0
          ? "active"
          : "stopped";

  return { types, overallHealth: worst };
}

export function formatRelativeTime(date: Date, now: Date): string {
  const ms = now.getTime() - date.getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  const remainMin = minutes % 60;
  if (hours < 24) {
    return remainMin > 0 ? `${hours}h ${remainMin}m ago` : `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  return remainHours > 0 ? `${days}d ${remainHours}h ago` : `${days}d ago`;
}

export function formatFrequency(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `~${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainMin = minutes % 60;
  return remainMin > 0 ? `~${hours}h ${remainMin}m` : `~${hours}h`;
}
