import type {
  MonitoringHealth,
  HealthStatus,
  CampaignConfig,
} from "../../lib/types.js";
import type { LoopInfo } from "../../lib/monitor-loop.js";
import {
  formatRelativeTime,
  formatFrequency,
} from "../../lib/health.js";

function healthColor(status: HealthStatus): string {
  switch (status) {
    case "active":
      return "bg-green-500";
    case "stale":
      return "bg-yellow-500";
    case "stopped":
      return "bg-red-500";
  }
}

export function HealthDot({ health }: { health: HealthStatus }) {
  return (
    <span
      class={`inline-block w-2.5 h-2.5 rounded-full ${healthColor(health)}`}
      title={health}
    />
  );
}

export function MonitoringStatus({
  health,
  config,
  now,
  loopStatus,
}: {
  health: MonitoringHealth;
  config: CampaignConfig;
  now: Date;
  loopStatus?: LoopInfo | null;
}) {
  if (health.types.length === 0 && !loopStatus) {
    return (
      <div>
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-semibold text-gray-500 uppercase">
            Monitoring Status
          </h3>
          <button
            onclick={`fetch('/api/campaign/${config.name}/monitor/start', { method: 'POST' }).then(() => location.reload())`}
            class="text-xs px-3 py-1.5 rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 font-medium"
          >
            ▶ Start Monitoring
          </button>
        </div>
        <p class="text-sm text-gray-400">No monitoring data yet.</p>
      </div>
    );
  }

  return (
    <div>
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-gray-500 uppercase">
          Monitoring Status
        </h3>
        {loopStatus ? (
          <button
            onclick={`fetch('/api/campaign/${config.name}/monitor/stop', { method: 'POST' }).then(() => location.reload())`}
            class="text-xs px-3 py-1.5 rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 font-medium"
          >
            ■ Stop Monitoring
          </button>
        ) : (
          <button
            onclick={`fetch('/api/campaign/${config.name}/monitor/start', { method: 'POST' }).then(() => location.reload())`}
            class="text-xs px-3 py-1.5 rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 font-medium"
          >
            ▶ Start Monitoring
          </button>
        )}
      </div>

      {/* Dashboard loop status bar */}
      {loopStatus && (
        <div class="flex items-center gap-2 text-xs bg-green-50 text-green-700 rounded px-3 py-2 mb-3 border border-green-100">
          <span class="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span>
            Dashboard loop: every {Math.round(loopStatus.intervalMs / 60000)}m
            {loopStatus.running ? " · running now" : ""}
            {loopStatus.lastRunAt
              ? ` · last: ${formatRelativeTime(new Date(loopStatus.lastRunAt), now)}`
              : " · waiting for first run"}
          </span>
        </div>
      )}

      <div class="space-y-2">
        {health.types.map((t) => (
          <div class="flex items-center gap-3 text-sm">
            <HealthDot health={t.health} />
            <span class="font-mono text-xs w-16">{t.eventType}</span>
            <span class="text-gray-600 w-28">
              {t.lastRun ? formatRelativeTime(t.lastRun, now) : "never"}
            </span>
            <span class="text-gray-400 w-16">
              {t.inferredFrequencyMs
                ? formatFrequency(t.inferredFrequencyMs)
                : "—"}
            </span>
            <span class="text-gray-400 truncate flex-1 text-xs">
              {t.lastDetail}
            </span>
          </div>
        ))}
      </div>
      <div class="mt-3 pt-2 border-t border-gray-100 text-xs text-gray-400">
        {(config.queries ?? []).length} queries | since {config.since ?? "—"} | min {config.minLikes ?? "—"} likes
      </div>
    </div>
  );
}
