import { loadCampaign, loadLedger } from "../lib/data.js";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

type ReportOpts = {
  save?: boolean;
};

type EnrichedReply = {
  id: string;
  op_author: string;
  our_text: string;
  strategy: string;
  char_count: number;
  has_link: boolean;
  op_age_hours: number;
  latest_likes: number;
  latest_rts: number;
  latest_replies: number;
  op_likes: number;
  age_hours: number;
  op_at_reply_likes: number;
  capture_pct: number;
};

export async function reportCommand(
  campaignDir: string,
  opts: ReportOpts,
): Promise<void> {
  const config = await loadCampaign(campaignDir);
  const ledger = await loadLedger(campaignDir);

  if (ledger.replies.length === 0) {
    console.log("No replies in ledger. Run 'distro register' first.");
    return;
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(` Reply Performance Report — ${config.name}`);
  console.log(` ${ledger.replies.length} replies tracked`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log();

  // Enrich replies with latest snapshot data
  const enriched: EnrichedReply[] = ledger.replies
    .filter((r) => r.snapshots.length > 0)
    .map((r) => {
      const latest = r.snapshots[r.snapshots.length - 1];
      const opL = latest.op_likes || r.op_at_reply.likes;
      return {
        id: r.id,
        op_author: r.op_author,
        our_text: r.our_text,
        strategy: r.strategy,
        char_count: r.char_count,
        has_link: r.has_link,
        op_age_hours: r.op_age_hours,
        latest_likes: latest.our_likes,
        latest_rts: latest.our_rts,
        latest_replies: latest.our_replies,
        op_likes: latest.op_likes,
        age_hours: latest.age_hours,
        op_at_reply_likes: r.op_at_reply.likes,
        capture_pct: opL > 0 ? (latest.our_likes / opL) * 100 : 0,
      };
    });

  // === Leaderboard ===
  console.log("═══ LEADERBOARD (by likes) ═══");
  console.log();
  const sorted = [...enriched].sort(
    (a, b) => b.latest_likes - a.latest_likes,
  );

  sorted.forEach((r, i) => {
    const ageStr =
      r.age_hours < 48
        ? `${Math.round(r.age_hours)}h`
        : `${(r.age_hours / 24).toFixed(1)}d`;
    console.log(
      `  ${String(i + 1).padStart(2)}. @${r.op_author.padEnd(18)} ${String(r.latest_likes).padStart(2)}L ${String(r.latest_rts)}RT ${String(r.latest_replies)}R  (${ageStr})  [${r.strategy}]`,
    );
    console.log(
      `     Capture: ${r.capture_pct.toFixed(1)}%  |  OP: ${r.op_likes}L  |  Chars: ${r.char_count}`,
    );
    // Truncate reply text to 80 chars for preview
    const preview =
      r.our_text.length > 80
        ? r.our_text.slice(0, 77) + "..."
        : r.our_text;
    console.log(`     "${preview}"`);
    console.log();
  });

  // === Strategy breakdown ===
  console.log("═══ STRATEGY BREAKDOWN ═══");
  console.log();

  const strategies = new Map<
    string,
    {
      count: number;
      totalLikes: number;
      totalCapture: number;
      bestAuthor: string;
      bestLikes: number;
    }
  >();
  for (const r of enriched) {
    const s = strategies.get(r.strategy) ?? {
      count: 0,
      totalLikes: 0,
      totalCapture: 0,
      bestAuthor: "",
      bestLikes: 0,
    };
    s.count++;
    s.totalLikes += r.latest_likes;
    s.totalCapture += r.capture_pct;
    if (r.latest_likes > s.bestLikes || !s.bestAuthor) {
      s.bestLikes = r.latest_likes;
      s.bestAuthor = r.op_author;
    }
    strategies.set(r.strategy, s);
  }

  const stratHeader = `  ${"Strategy".padEnd(18)} ${"Count".padStart(5)}  ${"Avg L".padStart(6)}  ${"Avg Cap%".padStart(8)}  ${"Best Reply".padStart(10)}`;
  console.log(stratHeader);
  console.log(
    `  ${"─".repeat(18)} ${"─".repeat(5)}  ${"─".repeat(6)}  ${"─".repeat(8)}  ${"─".repeat(25)}`,
  );

  [...strategies.entries()]
    .sort(
      (a, b) => b[1].totalLikes / b[1].count - a[1].totalLikes / a[1].count,
    )
    .forEach(([name, s]) => {
      const avgL = (s.totalLikes / s.count).toFixed(1);
      const avgCap = (s.totalCapture / s.count).toFixed(1);
      console.log(
        `  ${name.padEnd(18)} ${String(s.count).padStart(5)}  ${avgL.padStart(6)}  ${(avgCap + "%").padStart(8)}  @${s.bestAuthor} (${s.bestLikes}L)`,
      );
    });
  console.log();

  // === Correlations (all in one section) ===
  console.log("═══ CORRELATIONS ═══");
  console.log();

  const short = enriched.filter((r) => r.char_count < 80);
  const medium = enriched.filter(
    (r) => r.char_count >= 80 && r.char_count < 120,
  );
  const long = enriched.filter((r) => r.char_count >= 120);

  const avgBucket = (bucket: EnrichedReply[]) =>
    bucket.length > 0
      ? (
          bucket.reduce((s, r) => s + r.latest_likes, 0) / bucket.length
        ).toFixed(1)
      : "—";

  console.log(
    `  Reply length <80 chars:   avg ${avgBucket(short)}L  (n=${short.length})`,
  );
  console.log(
    `  Reply length 80-119:      avg ${avgBucket(medium)}L  (n=${medium.length})`,
  );
  console.log(
    `  Reply length 120+:        avg ${avgBucket(long)}L  (n=${long.length})`,
  );
  console.log();

  const opSmall = enriched.filter((r) => r.op_at_reply_likes < 50);
  const opMid = enriched.filter(
    (r) => r.op_at_reply_likes >= 50 && r.op_at_reply_likes < 200,
  );
  const opBig = enriched.filter((r) => r.op_at_reply_likes >= 200);

  console.log(
    `  OP <50 likes:             avg ${avgBucket(opSmall)}L for us  (n=${opSmall.length})`,
  );
  console.log(
    `  OP 50-199 likes:          avg ${avgBucket(opMid)}L for us  (n=${opMid.length})`,
  );
  console.log(
    `  OP 200+ likes:            avg ${avgBucket(opBig)}L for us  (n=${opBig.length})`,
  );
  console.log();

  const withLink = enriched.filter((r) => r.has_link);
  if (withLink.length > 0) {
    console.log(
      `  With GitHub link:         avg ${avgBucket(withLink)}L  (n=${withLink.length})`,
    );
    console.log();
  }

  const timed = enriched.filter((r) => r.op_age_hours > 0);
  if (timed.length > 0) {
    console.log("  OP age when we replied:");

    const fresh = timed.filter((r) => r.op_age_hours < 6);
    const sameDay = timed.filter(
      (r) => r.op_age_hours >= 6 && r.op_age_hours < 24,
    );
    const stale = timed.filter((r) => r.op_age_hours >= 24);

    console.log(
      `    <6h (fresh):            avg ${avgBucket(fresh)}L  (n=${fresh.length})`,
    );
    console.log(
      `    6-24h (same day):       avg ${avgBucket(sameDay)}L  (n=${sameDay.length})`,
    );
    console.log(
      `    24h+ (stale):           avg ${avgBucket(stale)}L  (n=${stale.length})`,
    );
    console.log();
  }

  // === Key insights ===
  console.log("═══ INSIGHTS ═══");
  console.log();

  // Top reply
  if (sorted.length > 0) {
    const top = sorted[0];
    console.log(
      `  Top reply: @${top.op_author} — ${top.latest_likes}L, ${top.capture_pct.toFixed(1)}% capture`,
    );
    console.log(`    Strategy: ${top.strategy}, ${top.char_count} chars`);
    console.log();
  }

  // Missed opportunities: 100+ OP, 0 likes for us
  const missed = enriched.filter(
    (r) => r.op_at_reply_likes >= 100 && r.latest_likes === 0,
  );
  if (missed.length > 0) {
    console.log(
      `  Missed opportunities: ${missed.length} replies to 100+ like posts got 0 likes:`,
    );
    for (const m of missed) {
      console.log(
        `    @${m.op_author} (${m.op_at_reply_likes}L OP) — ${m.strategy}, ${m.char_count} chars`,
      );
    }
    console.log();
  }

  // Short vs long
  if (short.length > 0 && long.length > 0) {
    console.log(
      `  Short replies (<80 chars) avg ${avgBucket(short)}L vs long (120+) avg ${avgBucket(long)}L`,
    );
  }

  // Zero likes ratio
  const zeroLikes = enriched.filter((r) => r.latest_likes === 0);
  console.log();
  console.log(
    `  ${zeroLikes.length}/${enriched.length} replies got 0 likes (${Math.round((zeroLikes.length / enriched.length) * 100)}%)`,
  );
  console.log();

  // === Recommendations ===
  console.log("═══ RECOMMENDATIONS ═══");
  console.log();

  // Find best strategy
  const bestStrat = [...strategies.entries()].sort(
    (a, b) => b[1].totalLikes / b[1].count - a[1].totalLikes / a[1].count,
  )[0];
  if (bestStrat) {
    console.log(
      `  Best strategy so far: ${bestStrat[0]} (avg ${(bestStrat[1].totalLikes / bestStrat[1].count).toFixed(1)}L)`,
    );
  }

  // Dead strategies
  const dead = [...strategies.entries()].filter(
    ([, s]) => s.totalLikes === 0 && s.count >= 1,
  );
  if (dead.length > 0) {
    console.log(
      `  Dead strategies (0L total): ${dead.map(([n]) => n).join(", ")}`,
    );
  }

  console.log();
  console.log("  Run 'distro check' daily to build time-series data.");
  console.log("  Run 'distro register' after each new reply.");
  console.log();

  // Save if requested — re-run the report logic to a buffer
  if (opts.save) {
    const reportsDir = join(campaignDir, "reports");
    await mkdir(reportsDir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const reportPath = join(reportsDir, `${date}_report.txt`);

    const lines: string[] = [
      `Reply Performance Report — ${config.name}`,
      `${enriched.length} replies tracked | ${date}`,
      "",
      "LEADERBOARD",
      ...sorted.map((r, i) => {
        const ageStr =
          r.age_hours < 48
            ? `${Math.round(r.age_hours)}h`
            : `${(r.age_hours / 24).toFixed(1)}d`;
        return `  ${i + 1}. @${r.op_author} ${r.latest_likes}L ${r.latest_rts}RT (${ageStr}) [${r.strategy}] ${r.char_count}ch cap:${r.capture_pct.toFixed(1)}%`;
      }),
      "",
      "STRATEGY BREAKDOWN",
      ...[...strategies.entries()]
        .sort(
          (a, b) =>
            b[1].totalLikes / b[1].count - a[1].totalLikes / a[1].count,
        )
        .map(
          ([name, s]) =>
            `  ${name}: n=${s.count} avg=${(s.totalLikes / s.count).toFixed(1)}L best=@${s.bestAuthor}(${s.bestLikes}L)`,
        ),
      "",
      "CORRELATIONS",
      `  <80ch: avg ${avgBucket(short)}L (n=${short.length})`,
      `  80-119ch: avg ${avgBucket(medium)}L (n=${medium.length})`,
      `  120+ch: avg ${avgBucket(long)}L (n=${long.length})`,
      `  OP<50L: avg ${avgBucket(opSmall)}L (n=${opSmall.length})`,
      `  OP 50-199L: avg ${avgBucket(opMid)}L (n=${opMid.length})`,
      `  OP 200+L: avg ${avgBucket(opBig)}L (n=${opBig.length})`,
      "",
      `Zero likes: ${zeroLikes.length}/${enriched.length} (${Math.round((zeroLikes.length / enriched.length) * 100)}%)`,
    ];

    await writeFile(reportPath, lines.join("\n") + "\n");
    console.log(`Saved: ${reportPath}`);
  }
}
