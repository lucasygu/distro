import type {
  CampaignConfig,
  ReplyLedger,
  StarSnapshot,
  LogEntry,
} from "../lib/types.js";
import { Layout } from "./layout.js";
import { StarChart } from "./components/star-chart.js";
import { ReplyTable } from "./components/reply-table.js";
import { EventTimeline } from "./components/event-timeline.js";
import { StrategyBreakdown } from "./components/strategy-breakdown.js";
import { MonitoringStatus } from "./components/monitoring-status.js";
import { deriveMonitoringHealth } from "../lib/health.js";

type CampaignViewProps = {
  config: CampaignConfig;
  ledger: ReplyLedger;
  starHistory: StarSnapshot[];
  logEntries: LogEntry[];
  campaigns: { name: string; active: boolean }[];
};

export function CampaignView({
  config,
  ledger,
  starHistory,
  logEntries,
  campaigns,
}: CampaignViewProps) {
  const currentStars =
    starHistory.length > 0 ? starHistory[starHistory.length - 1].stars : 0;
  const currentForks =
    starHistory.length > 0 ? starHistory[starHistory.length - 1].forks : 0;

  // Today's star delta
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todaySnapshots = starHistory.filter(
    (s) => new Date(s.ts) >= todayStart,
  );
  const starDeltaToday =
    todaySnapshots.length > 0 ? currentStars - todaySnapshots[0].stars : 0;

  // Reply stats
  const totalReplies = ledger.replies.length;
  const withLikes = ledger.replies.filter((r) => {
    if (r.snapshots.length === 0) return false;
    return r.snapshots[r.snapshots.length - 1].our_likes > 0;
  }).length;
  const engagementRate =
    totalReplies > 0
      ? ((withLikes / totalReplies) * 100).toFixed(0)
      : "0";

  return (
    <Layout title={`${config.name} — Distro Dashboard`}>
      <div class="flex min-h-screen">
        {/* Sidebar */}
        <nav class="w-52 bg-white border-r border-gray-200 p-4">
          <h1 class="text-lg font-bold mb-4">Distro</h1>
          <ul class="space-y-1">
            {campaigns.map((c) => (
              <li>
                <a
                  href={`/campaign/${c.name}`}
                  class={`block px-3 py-2 rounded text-sm ${
                    c.active
                      ? "bg-gray-900 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {c.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Main content */}
        <main class="flex-1 p-6 max-w-5xl">
          {/* Header */}
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="text-2xl font-bold">{config.name}</h2>
              <p class="text-gray-500 text-sm">
                <a
                  href={config.githubLink}
                  target="_blank"
                  class="hover:text-blue-600"
                >
                  {config.repo}
                </a>
              </p>
            </div>
            <a
              href={`/campaign/${config.name}`}
              class="text-sm text-gray-400 hover:text-gray-600 border border-gray-200 rounded px-3 py-1"
            >
              Refresh
            </a>
          </div>

          {/* Stats row */}
          <div class="grid grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Stars"
              value={`${currentStars}`}
              delta={
                starDeltaToday !== 0
                  ? `${starDeltaToday > 0 ? "+" : ""}${starDeltaToday} today`
                  : undefined
              }
            />
            <StatCard label="Forks" value={`${currentForks}`} />
            <StatCard label="Replies" value={`${totalReplies}`} />
            <StatCard
              label="Engagement"
              value={`${engagementRate}%`}
              delta={`${withLikes}/${totalReplies} got likes`}
            />
          </div>

          {/* Monitoring status */}
          <div class="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <MonitoringStatus
              health={deriveMonitoringHealth(logEntries)}
              config={config}
              now={new Date()}
            />
          </div>

          {/* Star chart */}
          {starHistory.length > 1 && (
            <div class="bg-white rounded-lg border border-gray-200 p-4 mb-6">
              <StarChart
                history={starHistory}
                canvasId={`star-chart-${config.name}`}
              />
            </div>
          )}

          {/* Two-column layout */}
          <div class="grid grid-cols-2 gap-6 mb-6">
            <div class="bg-white rounded-lg border border-gray-200 p-4">
              <StrategyBreakdown replies={ledger.replies} />
            </div>
            <div class="bg-white rounded-lg border border-gray-200 p-4">
              <EventTimeline entries={logEntries} />
            </div>
          </div>

          {/* Reply leaderboard */}
          <div class="bg-white rounded-lg border border-gray-200 p-4">
            <ReplyTable replies={ledger.replies} />
          </div>
        </main>
      </div>
    </Layout>
  );
}

function StatCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: string;
}) {
  return (
    <div class="bg-white rounded-lg border border-gray-200 p-4">
      <p class="text-sm text-gray-500">{label}</p>
      <p class="text-2xl font-bold mt-1">{value}</p>
      {delta && <p class="text-xs text-gray-400 mt-1">{delta}</p>}
    </div>
  );
}
