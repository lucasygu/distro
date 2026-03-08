import type { Reply } from "../../lib/types.js";

export function StrategyBreakdown({ replies }: { replies: Reply[] }) {
  const strategies = new Map<
    string,
    { count: number; totalLikes: number; totalRts: number }
  >();

  for (const r of replies) {
    if (r.snapshots.length === 0) continue;
    const latest = r.snapshots[r.snapshots.length - 1];
    const s = strategies.get(r.strategy) ?? {
      count: 0,
      totalLikes: 0,
      totalRts: 0,
    };
    s.count++;
    s.totalLikes += latest.our_likes;
    s.totalRts += latest.our_rts;
    strategies.set(r.strategy, s);
  }

  const sorted = [...strategies.entries()].sort(
    (a, b) => b[1].totalLikes / b[1].count - a[1].totalLikes / a[1].count,
  );

  return (
    <div>
      <h3 class="text-sm font-semibold text-gray-500 uppercase mb-2">
        Strategy Breakdown
      </h3>
      <div class="space-y-2">
        {sorted.map(([name, s]) => {
          const avgL = (s.totalLikes / s.count).toFixed(1);
          const maxWidth = Math.max(
            ...sorted.map(([, v]) => v.totalLikes / v.count),
          );
          const barWidth =
            maxWidth > 0
              ? Math.round((s.totalLikes / s.count / maxWidth) * 100)
              : 0;

          return (
            <div class="flex items-center gap-3">
              <span class="text-sm w-32 truncate font-mono">{name}</span>
              <div class="flex-1 bg-gray-100 rounded h-5 overflow-hidden">
                <div
                  class="bg-green-400 h-full rounded"
                  style={`width: ${barWidth}%`}
                ></div>
              </div>
              <span class="text-sm text-gray-600 w-20 text-right">
                {avgL}L avg
              </span>
              <span class="text-xs text-gray-400 w-12 text-right">
                n={s.count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
