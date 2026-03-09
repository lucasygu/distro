import type {
  MonitoringHealth,
  HealthStatus,
  CampaignConfig,
} from "../../lib/types.js";
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
}: {
  health: MonitoringHealth;
  config: CampaignConfig;
  now: Date;
}) {
  if (health.types.length === 0) {
    return (
      <div>
        <h3 class="text-sm font-semibold text-gray-500 uppercase mb-2">
          Monitoring Status
        </h3>
        <p class="text-sm text-gray-400">No monitoring data yet.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 class="text-sm font-semibold text-gray-500 uppercase mb-3">
        Monitoring Status
      </h3>
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
        {config.queries.length} queries | since {config.since} | min {config.minLikes} likes
      </div>
    </div>
  );
}
