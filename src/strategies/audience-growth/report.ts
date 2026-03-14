import {
  loadCampaign,
  loadPostLedger,
  loadGrowthHistory,
} from "../../lib/data.js";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

type ReportOpts = {
  save?: boolean;
};

/**
 * Audience-growth report: summarize growth trajectory,
 * top-performing posts, and what topics/formats work.
 */
export async function audienceGrowthReport(
  campaignDir: string,
  opts: ReportOpts,
): Promise<void> {
  const config = await loadCampaign(campaignDir);
  const ledger = await loadPostLedger(campaignDir);
  const growth = await loadGrowthHistory(campaignDir);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(` Audience Growth Report — ${config.name}`);
  console.log(` ${ledger.posts.length} posts tracked | ${growth.length} growth snapshots`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log();

  // === Follower Growth ===
  if (growth.length >= 2) {
    const first = growth[0];
    const latest = growth[growth.length - 1];
    const totalGrowth = latest.followers - first.followers;
    const days =
      (new Date(latest.ts).getTime() - new Date(first.ts).getTime()) /
      (1000 * 60 * 60 * 24);
    const dailyRate = days > 0 ? totalGrowth / days : 0;

    console.log("═══ FOLLOWER GROWTH ═══");
    console.log();
    console.log(`  Current: ${latest.followers}`);
    console.log(`  Started: ${first.followers} (${first.ts.slice(0, 10)})`);
    console.log(`  Growth:  +${totalGrowth} over ${Math.round(days)}d (${dailyRate.toFixed(1)}/day)`);

    // Last 7 days if enough data
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weekSnaps = growth.filter((g) => new Date(g.ts).getTime() >= weekAgo);
    if (weekSnaps.length >= 2) {
      const weekGrowth = latest.followers - weekSnaps[0].followers;
      console.log(`  Last 7d: +${weekGrowth}`);
    }
    console.log();
  } else if (growth.length === 1) {
    console.log("═══ FOLLOWER GROWTH ═══");
    console.log();
    console.log(`  Current: ${growth[0].followers}`);
    console.log("  Need more snapshots for trend data. Run 'distro check' daily.");
    console.log();
  } else {
    console.log("No follower data yet. Run 'distro check' to start tracking.");
    console.log();
  }

  // === Post Performance ===
  const withSnaps = ledger.posts.filter((p) => p.snapshots.length > 0);

  if (withSnaps.length === 0) {
    console.log("No post performance data. Register posts and run 'distro check'.");
    return;
  }

  console.log("═══ TOP POSTS (by likes) ═══");
  console.log();

  const sorted = [...withSnaps]
    .map((p) => {
      const latest = p.snapshots[p.snapshots.length - 1];
      return { ...p, likes: latest.likes, rts: latest.retweets, replies: latest.replies };
    })
    .sort((a, b) => b.likes - a.likes);

  sorted.slice(0, 10).forEach((p, i) => {
    const preview = p.text.replace(/\n/g, " ").slice(0, 80);
    const ageStr = formatAge(p.posted_at);
    console.log(
      `  ${String(i + 1).padStart(2)}. ${String(p.likes).padStart(3)}L ${String(p.rts)}RT ${String(p.replies)}R  [${p.type}]  (${ageStr})`,
    );
    console.log(`     Topic: ${p.topic}`);
    console.log(`     "${preview}"`);
    console.log();
  });

  // === Topic Breakdown ===
  const topicMap = new Map<string, { count: number; totalLikes: number; best: number }>();
  for (const p of sorted) {
    const t = topicMap.get(p.topic) ?? { count: 0, totalLikes: 0, best: 0 };
    t.count++;
    t.totalLikes += p.likes;
    if (p.likes > t.best) t.best = p.likes;
    topicMap.set(p.topic, t);
  }

  if (topicMap.size > 1) {
    console.log("═══ TOPIC BREAKDOWN ═══");
    console.log();

    [...topicMap.entries()]
      .sort((a, b) => b[1].totalLikes / b[1].count - a[1].totalLikes / a[1].count)
      .forEach(([topic, stats]) => {
        const avg = (stats.totalLikes / stats.count).toFixed(1);
        console.log(
          `  ${topic.padEnd(20)} n=${stats.count}  avg=${avg}L  best=${stats.best}L`,
        );
      });
    console.log();
  }

  // === Post Type Breakdown ===
  const typeMap = new Map<string, { count: number; totalLikes: number }>();
  for (const p of sorted) {
    const t = typeMap.get(p.type) ?? { count: 0, totalLikes: 0 };
    t.count++;
    t.totalLikes += p.likes;
    typeMap.set(p.type, t);
  }

  if (typeMap.size > 1) {
    console.log("═══ POST TYPE BREAKDOWN ═══");
    console.log();
    for (const [type, stats] of typeMap) {
      const avg = (stats.totalLikes / stats.count).toFixed(1);
      console.log(`  ${type.padEnd(12)} n=${stats.count}  avg=${avg}L`);
    }
    console.log();
  }

  // === Insights ===
  console.log("═══ INSIGHTS ═══");
  console.log();

  const originals = sorted.filter((p) => p.type === "original");
  const replies = sorted.filter((p) => p.type === "reply");

  if (originals.length > 0 && replies.length > 0) {
    const avgOrig = originals.reduce((s, p) => s + p.likes, 0) / originals.length;
    const avgReply = replies.reduce((s, p) => s + p.likes, 0) / replies.length;
    console.log(
      `  Original posts avg ${avgOrig.toFixed(1)}L vs replies avg ${avgReply.toFixed(1)}L`,
    );
  }

  const zeroLikes = sorted.filter((p) => p.likes === 0);
  if (zeroLikes.length > 0) {
    console.log(
      `  ${zeroLikes.length}/${sorted.length} posts got 0 likes (${Math.round((zeroLikes.length / sorted.length) * 100)}%)`,
    );
  }

  if (sorted.length > 0) {
    const best = sorted[0];
    console.log(`  Best post: ${best.likes}L on topic "${best.topic}" [${best.type}]`);
  }

  console.log();

  // Save if requested
  if (opts.save) {
    const reportsDir = join(campaignDir, "reports");
    await mkdir(reportsDir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const reportPath = join(reportsDir, `${date}_growth-report.txt`);

    const lines: string[] = [
      `Audience Growth Report — ${config.name}`,
      `${sorted.length} posts tracked | ${date}`,
      "",
    ];

    if (growth.length >= 2) {
      const first = growth[0];
      const latest = growth[growth.length - 1];
      lines.push(`Followers: ${latest.followers} (+${latest.followers - first.followers} since ${first.ts.slice(0, 10)})`);
      lines.push("");
    }

    lines.push("TOP POSTS");
    sorted.slice(0, 10).forEach((p, i) => {
      lines.push(`  ${i + 1}. ${p.likes}L ${p.rts}RT [${p.type}] topic:${p.topic}`);
      lines.push(`     "${p.text.replace(/\n/g, " ").slice(0, 100)}"`);
    });

    await writeFile(reportPath, lines.join("\n") + "\n");
    console.log(`Saved: ${reportPath}`);
  }
}

function formatAge(isoDate: string): string {
  const ageH = (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60);
  return ageH < 48 ? `${Math.round(ageH)}h` : `${(ageH / 24).toFixed(1)}d`;
}
