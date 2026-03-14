import { loadCampaign, loadPostLedger } from "../../lib/data.js";
import { callBird } from "../../lib/bird.js";
import { appendLog } from "../../lib/log.js";
import type { BirdTweet } from "../../lib/types.js";

type MonitorOpts = {
  since?: string;
  minLikes?: string;
  save?: boolean;
};

/**
 * X-post-growth monitor: find trending posts in your topics
 * to engage with authentically. No product links — just build presence.
 */
export async function xPostGrowthMonitor(
  campaignDir: string,
  opts: MonitorOpts,
): Promise<void> {
  const config = await loadCampaign(campaignDir);
  const topics = config.topics ?? [];
  const minLikes = parseInt(opts.minLikes ?? "50", 10);

  if (topics.length === 0) {
    console.log("No topics configured. Add topics to campaign.json.");
    return;
  }

  const postLedger = await loadPostLedger(campaignDir);
  const repliedIds = new Set(
    postLedger.posts
      .filter((p) => p.in_reply_to)
      .map((p) => p.in_reply_to),
  );

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(` X Post Growth — ${config.name}`);
  console.log(` Topics: ${topics.length} | Min likes: ${minLikes}`);
  console.log(` ${new Date().toISOString().slice(0, 16).replace("T", " ")}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log();

  const seen = new Map<string, BirdTweet>();

  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    console.error(`🔍 Topic ${i + 1}/${topics.length}: ${topic}`);
    const result = await callBird(["search", topic], campaignDir);
    if (result.ok) {
      for (const tweet of result.data) {
        if (tweet.id && !seen.has(tweet.id)) {
          seen.set(tweet.id, tweet);
        }
      }
    }
    await sleep(1000);
  }

  console.error();

  // Filter: high engagement, not our own, not already replied to
  const candidates = [...seen.values()]
    .filter((t) => t.likeCount >= minLikes)
    .filter((t) => t.author.username.toLowerCase() !== config.handle.toLowerCase())
    .filter((t) => !t.inReplyToStatusId) // originals only
    .filter((t) => !repliedIds.has(t.id))
    .sort((a, b) => b.likeCount - a.likeCount);

  // Log event
  if (candidates.length > 0) {
    const top = candidates
      .slice(0, 5)
      .map((t) => `@${t.author.username} (${t.likeCount}L)`)
      .join("; ");
    await appendLog(campaignDir, {
      event: "MONITOR",
      detail: `${candidates.length} engagement targets: ${top}`,
      driver: "",
    });
  } else {
    await appendLog(campaignDir, {
      event: "MONITOR",
      detail: `no engagement targets (${seen.size} posts scanned)`,
      driver: "",
    });
  }

  console.log(`Scanned ${seen.size} posts, found ${candidates.length} engagement opportunities`);
  console.log();

  if (candidates.length === 0) {
    console.log("No trending posts found matching your topics. Try different search terms.");
    return;
  }

  // Display
  console.log("═══ ENGAGEMENT OPPORTUNITIES ═══");
  console.log();

  candidates.slice(0, 15).forEach((t, i) => {
    console.log(formatCandidate(t, i + 1));
    console.log();
  });

  // Next steps
  console.log("━━━ NEXT STEPS ━━━");
  console.log();
  console.log("Reply authentically (no product links). Build visibility.");
  const top = candidates[0];
  console.log(`  /reply-composer https://x.com/${top.author.username}/status/${top.id}`);
  console.log();
}

function formatCandidate(t: BirdTweet, idx: number): string {
  let ageStr = "";
  try {
    const created = new Date(t.createdAt);
    const ageH = (Date.now() - created.getTime()) / (1000 * 60 * 60);
    ageStr = ageH < 24
      ? ` (${Math.round(ageH)}h ago)`
      : ` (${(ageH / 24).toFixed(1)}d ago)`;
  } catch {
    // skip
  }

  const text = t.text.replace(/\n/g, " ").slice(0, 200);
  const lines = [
    `  ${idx}. ${t.likeCount}L ${t.retweetCount}RT ${t.replyCount}R | @${t.author.username} (${t.author.name})${ageStr}`,
    `     ${text}`,
    `     → https://x.com/${t.author.username}/status/${t.id}`,
  ];
  return lines.join("\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
