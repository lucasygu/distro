import { loadCampaign, loadLedger } from "../lib/data.js";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

type ReportOpts = {
  save?: boolean;
};

type EnrichedReply = {
  id: string;
  op_author: string;
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
      return {
        id: r.id,
        op_author: r.op_author,
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
      };
    });

  // === Leaderboard ===
  console.log("═══ LEADERBOARD ═══");
  console.log();
  const sorted = [...enriched].sort(
    (a, b) => b.latest_likes - a.latest_likes,
  );

  const lbHeader = `  ${"#".padStart(3)}  ${"Likes".padStart(5)}  ${"RT".padStart(4)}  ${"Strategy".padEnd(16)}  ${"Chars".padStart(5)}  ${"OP_L".padStart(6)}  @Author`;
  console.log(lbHeader);
  console.log(
    `  ${"─".repeat(3)}  ${"─".repeat(5)}  ${"─".repeat(4)}  ${"─".repeat(16)}  ${"─".repeat(5)}  ${"─".repeat(6)}  ${"─".repeat(15)}`,
  );

  sorted.forEach((r, i) => {
    console.log(
      `  ${String(i + 1).padStart(3)}  ${String(r.latest_likes).padStart(5)}  ${String(r.latest_rts).padStart(4)}  ${r.strategy.padEnd(16)}  ${String(r.char_count).padStart(5)}  ${String(r.op_likes).padStart(6)}  @${r.op_author}`,
    );
  });
  console.log();

  // === Strategy breakdown ===
  console.log("═══ STRATEGY BREAKDOWN ═══");
  console.log();

  const strategies = new Map<
    string,
    { count: number; totalLikes: number; totalRts: number }
  >();
  for (const r of enriched) {
    const s = strategies.get(r.strategy) ?? {
      count: 0,
      totalLikes: 0,
      totalRts: 0,
    };
    s.count++;
    s.totalLikes += r.latest_likes;
    s.totalRts += r.latest_rts;
    strategies.set(r.strategy, s);
  }

  const stratHeader = `  ${"Strategy".padEnd(18)}  ${"Count".padStart(5)}  ${"Avg L".padStart(6)}  ${"Avg RT".padStart(6)}  ${"Total L".padStart(7)}`;
  console.log(stratHeader);
  console.log(
    `  ${"─".repeat(18)}  ${"─".repeat(5)}  ${"─".repeat(6)}  ${"─".repeat(6)}  ${"─".repeat(7)}`,
  );

  [...strategies.entries()]
    .sort((a, b) => b[1].totalLikes / b[1].count - a[1].totalLikes / a[1].count)
    .forEach(([name, s]) => {
      const avgL = (s.totalLikes / s.count).toFixed(1);
      const avgRt = (s.totalRts / s.count).toFixed(1);
      console.log(
        `  ${name.padEnd(18)}  ${String(s.count).padStart(5)}  ${avgL.padStart(6)}  ${avgRt.padStart(6)}  ${String(s.totalLikes).padStart(7)}`,
      );
    });
  console.log();

  // === Length correlation ===
  console.log("═══ LENGTH CORRELATION ═══");
  console.log();

  const short = enriched.filter((r) => r.char_count < 80);
  const long = enriched.filter((r) => r.char_count >= 120);

  const avgShort =
    short.length > 0
      ? (short.reduce((s, r) => s + r.latest_likes, 0) / short.length).toFixed(
          1,
        )
      : "—";
  const avgLong =
    long.length > 0
      ? (long.reduce((s, r) => s + r.latest_likes, 0) / long.length).toFixed(1)
      : "—";

  console.log(`  <80 chars:  ${short.length} replies, avg ${avgShort}L`);
  console.log(`  120+ chars: ${long.length} replies, avg ${avgLong}L`);
  console.log();

  // === OP timing correlation ===
  const timed = enriched.filter((r) => r.op_age_hours > 0);
  if (timed.length > 0) {
    console.log("═══ OP TIMING CORRELATION ═══");
    console.log();

    const fresh = timed.filter((r) => r.op_age_hours < 6);
    const sameDay = timed.filter(
      (r) => r.op_age_hours >= 6 && r.op_age_hours < 24,
    );
    const stale = timed.filter((r) => r.op_age_hours >= 24);

    const avgFresh =
      fresh.length > 0
        ? (
            fresh.reduce((s, r) => s + r.latest_likes, 0) / fresh.length
          ).toFixed(1)
        : "—";
    const avgSameDay =
      sameDay.length > 0
        ? (
            sameDay.reduce((s, r) => s + r.latest_likes, 0) / sameDay.length
          ).toFixed(1)
        : "—";
    const avgStale =
      stale.length > 0
        ? (
            stale.reduce((s, r) => s + r.latest_likes, 0) / stale.length
          ).toFixed(1)
        : "—";

    console.log(`  Fresh (<6h):    ${fresh.length} replies, avg ${avgFresh}L`);
    console.log(
      `  Same-day (6-24h): ${sameDay.length} replies, avg ${avgSameDay}L`,
    );
    console.log(`  Stale (24h+):   ${stale.length} replies, avg ${avgStale}L`);
    console.log();
  }

  // === OP size correlation ===
  console.log("═══ OP SIZE SWEET SPOT ═══");
  console.log();

  const withOp = enriched.filter((r) => r.op_at_reply_likes > 0);
  const small = withOp.filter((r) => r.op_at_reply_likes < 100);
  const sweet = withOp.filter(
    (r) => r.op_at_reply_likes >= 100 && r.op_at_reply_likes <= 500,
  );
  const big = withOp.filter((r) => r.op_at_reply_likes > 500);

  const avgSmall =
    small.length > 0
      ? (
          small.reduce((s, r) => s + r.latest_likes, 0) / small.length
        ).toFixed(1)
      : "—";
  const avgSweet =
    sweet.length > 0
      ? (
          sweet.reduce((s, r) => s + r.latest_likes, 0) / sweet.length
        ).toFixed(1)
      : "—";
  const avgBig =
    big.length > 0
      ? (big.reduce((s, r) => s + r.latest_likes, 0) / big.length).toFixed(1)
      : "—";

  console.log(`  OP <100L:     ${small.length} replies, avg ${avgSmall}L`);
  console.log(`  OP 100-500L:  ${sweet.length} replies, avg ${avgSweet}L`);
  console.log(`  OP >500L:     ${big.length} replies, avg ${avgBig}L`);
  console.log();

  // === Key insights ===
  console.log("═══ INSIGHTS ═══");
  console.log();

  const zeroLikes = enriched.filter((r) => r.latest_likes === 0);
  console.log(
    `  ${zeroLikes.length}/${enriched.length} replies (${Math.round((zeroLikes.length / enriched.length) * 100)}%) got 0 likes — targeting matters more than drafting`,
  );

  if (short.length > 0 && long.length > 0) {
    console.log(
      `  Short (<80ch) avg ${avgShort}L vs Long (120+ch) avg ${avgLong}L — ${Number(avgShort) > Number(avgLong) ? "short wins" : "long wins"}`,
    );
  }

  const freshAll = enriched.filter(
    (r) => r.op_age_hours > 0 && r.op_age_hours < 6,
  );
  const staleAll = enriched.filter((r) => r.op_age_hours >= 24);
  if (freshAll.length > 0 && staleAll.length > 0) {
    const fAvg = (
      freshAll.reduce((s, r) => s + r.latest_likes, 0) / freshAll.length
    ).toFixed(1);
    const sAvg = (
      staleAll.reduce((s, r) => s + r.latest_likes, 0) / staleAll.length
    ).toFixed(1);
    console.log(`  Fresh replies avg ${fAvg}L vs Stale avg ${sAvg}L`);
  }

  console.log();

  // Save if requested
  if (opts.save) {
    const reportsDir = join(campaignDir, "reports");
    await mkdir(reportsDir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const reportPath = join(reportsDir, `${date}_report.txt`);
    // TODO: capture output and write to file
    console.log(`Report directory: ${reportsDir}`);
  }
}
