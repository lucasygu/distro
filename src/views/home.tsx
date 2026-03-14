import type {
  CampaignConfig,
  ReplyLedger,
  StarSnapshot,
  LogEntry,
} from "../lib/types.js";
import type { LoopInfo } from "../lib/monitor-loop.js";
import { Layout } from "./layout.js";
import { deriveMonitoringHealth } from "../lib/health.js";
import { HealthDot } from "./components/monitoring-status.js";

type CampaignSummary = {
  name: string;
  config: CampaignConfig;
  ledger: ReplyLedger;
  starHistory: StarSnapshot[];
  logEntries: LogEntry[];
};

export function HomeView({
  campaigns,
  loopStatuses,
}: {
  campaigns: CampaignSummary[];
  loopStatuses: Record<string, LoopInfo>;
}) {
  const anyLoopRunning = Object.keys(loopStatuses).length > 0;
  const allRunning =
    campaigns.length > 0 &&
    campaigns.every((c) => loopStatuses[c.name]);

  return (
    <Layout title="Distro Dashboard">
      <div class="flex min-h-screen">
        {/* Sidebar */}
        <nav class="w-52 bg-white border-r border-gray-200 p-4">
          <h1 class="text-lg font-bold mb-4">Distro</h1>
          <ul class="space-y-1">
            {campaigns.map((c) => (
              <li>
                <a
                  href={`/campaign/${c.name}`}
                  class="block px-3 py-2 rounded text-sm text-gray-600 hover:bg-gray-100"
                >
                  {c.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Main */}
        <main class="flex-1 p-6 max-w-4xl">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-bold">All Campaigns</h2>
            <div class="flex gap-2">
              {allRunning ? (
                <button
                  onclick="fetch('/api/monitor/stop-all', { method: 'POST' }).then(() => location.reload())"
                  class="text-xs px-3 py-1.5 rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 font-medium"
                >
                  ■ Stop All
                </button>
              ) : (
                <button
                  onclick="fetch('/api/monitor/start-all', { method: 'POST' }).then(() => location.reload())"
                  class="text-xs px-3 py-1.5 rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 font-medium"
                >
                  ▶ Start All
                </button>
              )}
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4">
            {campaigns.map((c) => {
              const stars =
                c.starHistory.length > 0
                  ? c.starHistory[c.starHistory.length - 1].stars
                  : 0;
              const forks =
                c.starHistory.length > 0
                  ? c.starHistory[c.starHistory.length - 1].forks
                  : 0;
              const replies = c.ledger.replies.length;
              const totalLikes = c.ledger.replies.reduce((sum, r) => {
                if (r.snapshots.length === 0) return sum;
                return (
                  sum + r.snapshots[r.snapshots.length - 1].our_likes
                );
              }, 0);

              const health = deriveMonitoringHealth(c.logEntries);
              const loop = loopStatuses[c.name];

              return (
                <a
                  href={`/campaign/${c.name}`}
                  class="block bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-400 transition-colors"
                >
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="flex items-center gap-2">
                        <HealthDot health={health.overallHealth} />
                        <h3 class="text-lg font-semibold">{c.name}</h3>
                        {loop && (
                          <span class="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 border border-green-100 font-medium">
                            LOOP
                          </span>
                        )}
                      </div>
                      <p class="text-sm text-gray-500 ml-4.5">{c.config.repo}</p>
                    </div>
                    <div class="flex gap-6 text-sm">
                      <div class="text-center">
                        <p class="text-xl font-bold">{stars}</p>
                        <p class="text-gray-400">stars</p>
                      </div>
                      <div class="text-center">
                        <p class="text-xl font-bold">{forks}</p>
                        <p class="text-gray-400">forks</p>
                      </div>
                      <div class="text-center">
                        <p class="text-xl font-bold">{replies}</p>
                        <p class="text-gray-400">replies</p>
                      </div>
                      <div class="text-center">
                        <p class="text-xl font-bold">{totalLikes}</p>
                        <p class="text-gray-400">total likes</p>
                      </div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </main>
      </div>
    </Layout>
  );
}
