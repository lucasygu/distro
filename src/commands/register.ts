import { loadCampaign, loadLedger, saveLedger } from "../lib/data.js";
import { callBird } from "../lib/bird.js";
import { appendLog } from "../lib/log.js";
import type { Reply } from "../lib/types.js";

type RegisterOpts = {
  strategy?: string;
  findIn?: string;
};

/**
 * Core registration: fetch reply + OP via bird, add to ledger.
 * Used by both `distro register` and `distro discover`.
 */
export async function registerReply(
  campaignDir: string,
  tweetId: string,
  strategy = "unknown",
): Promise<void> {
  const config = await loadCampaign(campaignDir);
  const ledger = await loadLedger(campaignDir);

  if (ledger.replies.some((r) => r.id === tweetId)) {
    console.log(`⏭  Already in ledger: ${tweetId}`);
    return;
  }

  console.error(`📥 Fetching reply ${tweetId}...`);
  const replyResult = await callBird(
    ["read", `https://x.com/i/status/${tweetId}`],
    campaignDir,
  );
  if (!replyResult.ok) {
    console.error(`❌ Failed to fetch reply ${tweetId}`);
    return;
  }
  const reply = replyResult.data[0];

  let op = null;
  if (reply.inReplyToStatusId) {
    console.error(`📥 Fetching OP ${reply.inReplyToStatusId}...`);
    const opResult = await callBird(
      ["read", `https://x.com/i/status/${reply.inReplyToStatusId}`],
      campaignDir,
    );
    if (opResult.ok) {
      op = opResult.data[0];
    }
  }

  const postedAt = parseCreatedAt(reply.createdAt);
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const ageHours =
    (Date.now() - new Date(postedAt).getTime()) / (1000 * 60 * 60);

  let opAgeHours = 0;
  if (op) {
    const opCreated = new Date(parseCreatedAt(op.createdAt));
    const replyCreated = new Date(postedAt);
    opAgeHours = Math.max(
      0,
      (replyCreated.getTime() - opCreated.getTime()) / (1000 * 60 * 60),
    );
  }

  const entry: Reply = {
    id: reply.id,
    op_id: reply.inReplyToStatusId ?? "",
    op_author: op?.author.username ?? "?",
    op_text: op ? op.text.replace(/\n/g, " ").slice(0, 200) : "",
    our_text: reply.text,
    posted_at: postedAt,
    strategy,
    char_count: reply.text.length,
    has_link:
      reply.text.toLowerCase().includes("github.com") ||
      reply.text.toLowerCase().includes("t.co"),
    op_age_hours: Math.round(opAgeHours * 10) / 10,
    backfilled: true,
    op_at_reply: {
      likes: op?.likeCount ?? 0,
      retweets: op?.retweetCount ?? 0,
      replies: op?.replyCount ?? 0,
    },
    snapshots: [
      {
        ts: now,
        age_hours: Math.round(ageHours * 10) / 10,
        our_likes: reply.likeCount,
        our_rts: reply.retweetCount,
        our_replies: reply.replyCount,
        op_likes: op?.likeCount ?? 0,
        op_rts: op?.retweetCount ?? 0,
        op_replies: op?.replyCount ?? 0,
      },
    ],
  };

  ledger.replies.push(entry);
  if (!ledger.campaign) ledger.campaign = config.name;
  if (!ledger.our_handle) ledger.our_handle = config.handle;
  await saveLedger(campaignDir, ledger);

  await appendLog(campaignDir, {
    event: "REPLY",
    detail: `@${entry.op_author} (${entry.op_at_reply.likes}L OP) ${entry.char_count}ch ${strategy}`,
    driver: `https://x.com/i/status/${entry.id}`,
  });

  console.log(
    `✅ Registered: ${entry.id} → @${entry.op_author} | ${reply.likeCount}L | ${strategy}`,
  );
}

export async function registerCommand(
  campaignDir: string,
  urlOrId: string,
  opts: RegisterOpts,
): Promise<void> {
  const config = await loadCampaign(campaignDir);

  // If --find-in mode, search the OP thread for our reply first
  if (opts.findIn) {
    console.log("━━━ Finding our reply in thread ━━━");
    console.error(`🔍 Fetching replies to: ${opts.findIn}`);
    const result = await callBird(["replies", opts.findIn], campaignDir);
    if (!result.ok) {
      console.error("❌ Failed to fetch thread replies.");
      process.exit(1);
    }
    const ours = result.data.find(
      (t) => t.author.username.toLowerCase() === config.handle.toLowerCase(),
    );
    if (!ours) {
      console.error("❌ Could not find our reply in that thread.");
      process.exit(1);
    }
    console.error(`Found our reply: ${ours.id}`);
    urlOrId = ours.id;
  }

  // Extract tweet ID from URL or raw ID
  const tweetId = extractId(urlOrId);
  if (!tweetId) {
    console.error(`Could not extract tweet ID from: ${urlOrId}`);
    process.exit(1);
  }

  const strategy = opts.strategy ?? "unknown";
  await registerReply(campaignDir, tweetId, strategy);
}

function extractId(input: string): string | null {
  const match = input.match(/\d{15,}/);
  return match ? match[0] : null;
}

function parseCreatedAt(raw: string): string {
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return new Date().toISOString();
    return d.toISOString().replace(/\.\d+Z$/, "Z");
  } catch {
    return new Date().toISOString();
  }
}
