import { loadCampaign, loadLedger } from "../lib/data.js";
import { callBird } from "../lib/bird.js";
import { registerReply } from "./register.js";
import type { BirdTweet } from "../lib/types.js";

export async function discoverCommand(campaignDir: string): Promise<void> {
  const config = await loadCampaign(campaignDir);
  const ledger = await loadLedger(campaignDir);
  const existingIds = new Set(ledger.replies.map((r) => r.id));

  console.log("━━━ Discovering untracked replies ━━━");
  console.log();

  // Search for our recent tweets
  const searches = [
    `from:${config.handle}`,
    `from:${config.handle} github.com/${config.repo.split("/")[1]}`,
  ];

  const seen = new Map<string, BirdTweet>();

  for (const q of searches) {
    console.error(`🔍 Searching: ${q}`);
    const result = await callBird(["search", q], campaignDir);
    if (result.ok) {
      for (const tweet of result.data) {
        if (tweet.id && !seen.has(tweet.id)) {
          seen.set(tweet.id, tweet);
        }
      }
    }
    await sleep(1000);
  }

  // Filter: only replies from us, not already tracked
  const newReplies: BirdTweet[] = [];
  for (const [, tweet] of seen) {
    if (tweet.author.username.toLowerCase() !== config.handle.toLowerCase())
      continue;
    if (!tweet.inReplyToStatusId) continue; // skip original posts
    if (existingIds.has(tweet.id)) continue;
    newReplies.push(tweet);
  }

  if (newReplies.length === 0) {
    console.log("No new untracked replies found.");
    return;
  }

  console.log(`Found ${newReplies.length} untracked replies:`);
  console.log();
  for (const t of newReplies) {
    const text = t.text.replace(/\n/g, " ").slice(0, 100);
    console.log(`  ${t.id} | ${t.likeCount}L | ${text}`);
  }
  console.log();

  // Register each one
  console.log("Registering...");
  for (const t of newReplies) {
    try {
      await registerReply(campaignDir, t.id);
    } catch {
      console.error(`  Failed to register ${t.id}`);
    }
    await sleep(500);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
