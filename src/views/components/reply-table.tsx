import type { Reply } from "../../lib/types.js";

export function ReplyTable({ replies }: { replies: Reply[] }) {
  // Sort by latest likes descending
  const sorted = [...replies]
    .filter((r) => r.snapshots.length > 0)
    .sort((a, b) => {
      const aLikes = a.snapshots[a.snapshots.length - 1].our_likes;
      const bLikes = b.snapshots[b.snapshots.length - 1].our_likes;
      return bLikes - aLikes;
    });

  return (
    <div>
      <h3 class="text-sm font-semibold text-gray-500 uppercase mb-2">
        Reply Leaderboard
      </h3>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-gray-500 border-b">
              <th class="py-2 pr-3">#</th>
              <th class="py-2 pr-3">Author</th>
              <th class="py-2 pr-3 text-right">Likes</th>
              <th class="py-2 pr-3 text-right">RT</th>
              <th class="py-2 pr-3">Strategy</th>
              <th class="py-2 pr-3 text-right">Chars</th>
              <th class="py-2 pr-3 text-right">OP Likes</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const latest = r.snapshots[r.snapshots.length - 1];
              const opLikes = r.op_at_reply.likes;
              const capture =
                opLikes > 0
                  ? ((latest.our_likes / opLikes) * 100).toFixed(1)
                  : "—";
              return (
                <tr
                  class={`border-b border-gray-100 ${latest.our_likes > 0 ? "" : "text-gray-400"}`}
                >
                  <td class="py-2 pr-3 text-gray-400">{i + 1}</td>
                  <td class="py-2 pr-3 font-mono">
                    <a
                      href={`https://x.com/i/status/${r.id}`}
                      target="_blank"
                      class="hover:text-blue-600"
                    >
                      @{r.op_author}
                    </a>
                  </td>
                  <td class="py-2 pr-3 text-right font-semibold">
                    {latest.our_likes}
                  </td>
                  <td class="py-2 pr-3 text-right">{latest.our_rts}</td>
                  <td class="py-2 pr-3">
                    <span
                      class={`px-2 py-0.5 rounded text-xs ${strategyColor(r.strategy)}`}
                    >
                      {r.strategy}
                    </span>
                  </td>
                  <td class="py-2 pr-3 text-right">{r.char_count}</td>
                  <td class="py-2 pr-3 text-right text-gray-500">
                    {opLikes}L ({capture}%)
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function strategyColor(strategy: string): string {
  switch (strategy) {
    case "short-anchored":
      return "bg-green-100 text-green-800";
    case "peer-sharing":
      return "bg-blue-100 text-blue-800";
    case "short-generic":
      return "bg-yellow-100 text-yellow-800";
    case "announcement":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-gray-100 text-gray-600";
  }
}
