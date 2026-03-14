import { loadCampaign, loadPostLedger, savePostLedger } from "../../lib/data.js";
import { callBird } from "../../lib/bird.js";
import { appendLog } from "../../lib/log.js";
import type { PostEntry } from "../../lib/types.js";

type RegisterOpts = {
  topic?: string;
};

/**
 * Register a post (original or reply) in the audience-growth ledger.
 * Fetches tweet data from bird CLI to populate the entry.
 */
export async function audienceGrowthRegister(
  campaignDir: string,
  urlOrId: string,
  opts: RegisterOpts,
): Promise<void> {
  const config = await loadCampaign(campaignDir);
  const ledger = await loadPostLedger(campaignDir);

  // Extract tweet ID from URL or use raw ID
  const tweetId = urlOrId.includes("/status/")
    ? urlOrId.split("/status/")[1]?.split("?")[0] ?? urlOrId
    : urlOrId;

  // Check if already registered
  if (ledger.posts.some((p) => p.id === tweetId)) {
    console.log(`Already registered: ${tweetId}`);
    return;
  }

  // Fetch tweet data
  const url = urlOrId.startsWith("http")
    ? urlOrId
    : `https://x.com/i/status/${tweetId}`;

  console.error("📥 Fetching tweet data...");
  const result = await callBird(["read", url], campaignDir);

  if (!result.ok || result.data.length === 0) {
    console.error(`Failed to fetch tweet: ${result.ok ? "no data" : result.error}`);
    return;
  }

  const tweet = result.data[0];

  // Determine post type
  const isReply = Boolean(tweet.inReplyToStatusId);
  const postType = isReply ? "reply" as const : "original" as const;
  const topic = opts.topic ?? "general";

  const entry: PostEntry = {
    id: tweetId,
    type: postType,
    text: tweet.text,
    posted_at: tweet.createdAt,
    topic,
    ...(isReply && tweet.inReplyToStatusId
      ? { in_reply_to: tweet.inReplyToStatusId }
      : {}),
    snapshots: [
      {
        ts: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
        age_hours:
          Math.round(
            ((Date.now() - new Date(tweet.createdAt).getTime()) /
              (1000 * 60 * 60)) *
              10,
          ) / 10,
        likes: tweet.likeCount,
        retweets: tweet.retweetCount,
        replies: tweet.replyCount,
      },
    ],
  };

  // Update ledger metadata if needed
  if (!ledger.campaign) ledger.campaign = config.name;
  if (!ledger.handle) ledger.handle = config.handle;

  ledger.posts.push(entry);
  await savePostLedger(campaignDir, ledger);

  await appendLog(campaignDir, {
    event: "REPLY", // reuse REPLY event for post tracking
    detail: `registered ${postType}: ${tweet.text.replace(/\n/g, " ").slice(0, 80)}`,
    driver: url,
  });

  console.log();
  console.log(`✅ Registered ${postType} (${tweetId.slice(-6)})`);
  console.log(`   ${tweet.likeCount}L ${tweet.retweetCount}RT ${tweet.replyCount}R`);
  console.log(`   Topic: ${topic}`);
  console.log(`   "${tweet.text.replace(/\n/g, " ").slice(0, 120)}"`);
  console.log();
  console.log(`Total posts tracked: ${ledger.posts.length}`);
}
