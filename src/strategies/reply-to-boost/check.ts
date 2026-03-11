import { loadCampaign, loadLedger, saveLedger } from "../../lib/data.js";
import { callBird } from "../../lib/bird.js";
import { appendLog } from "../../lib/log.js";

type CheckOpts = {
  since?: string;
  id?: string;
};

export async function replyToBoostCheck(
  campaignDir: string,
  opts: CheckOpts,
): Promise<void> {
  await loadCampaign(campaignDir); // validate campaign exists
  const ledger = await loadLedger(campaignDir);

  if (ledger.replies.length === 0) {
    console.log("No replies in ledger. Run 'distro register' first.");
    return;
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(" Reply Performance Check");
  console.log(
    ` ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
  );
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log();

  const now = Date.now();
  const maxAge = parseDuration(opts.since);
  const updates: UpdateInfo[] = [];

  for (const reply of ledger.replies) {
    if (!reply.id) continue;

    // Filter by specific ID
    if (opts.id && reply.id !== opts.id) continue;

    // Filter by --since
    if (maxAge) {
      const posted = new Date(reply.posted_at).getTime();
      if (now - posted > maxAge) continue;
    }

    // Skip if last snapshot was <2h ago
    if (reply.snapshots.length > 0) {
      const last = reply.snapshots[reply.snapshots.length - 1];
      const posted = new Date(reply.posted_at).getTime();
      const currentAgeH = (now - posted) / (1000 * 60 * 60);
      if (Math.abs(currentAgeH - last.age_hours) < 2) continue;
    }

    console.error(`  📥 ${reply.id.slice(-6)}...`);

    // Fetch our reply
    const oursResult = await callBird(
      ["read", `https://x.com/i/status/${reply.id}`],
      campaignDir,
    );
    const ours = oursResult.ok ? oursResult.data[0] : null;

    // Fetch OP
    let op = null;
    if (reply.op_id) {
      const opResult = await callBird(
        ["read", `https://x.com/i/status/${reply.op_id}`],
        campaignDir,
      );
      op = opResult.ok ? opResult.data[0] : null;
    }

    const posted = new Date(reply.posted_at).getTime();
    const ageHours = Math.round(((now - posted) / (1000 * 60 * 60)) * 10) / 10;
    const ourLikes = ours?.likeCount ?? 0;
    const ourRts = ours?.retweetCount ?? 0;
    const ourReplies = ours?.replyCount ?? 0;

    // Check milestones
    const prevLikes =
      reply.snapshots.length > 0
        ? reply.snapshots[reply.snapshots.length - 1].our_likes
        : 0;
    const milestones: number[] = [];
    for (const threshold of [5, 10, 20, 50]) {
      if (prevLikes < threshold && ourLikes >= threshold) {
        milestones.push(threshold);
      }
    }

    reply.snapshots.push({
      ts: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
      age_hours: ageHours,
      our_likes: ourLikes,
      our_rts: ourRts,
      our_replies: ourReplies,
      op_likes: op?.likeCount ?? 0,
      op_rts: op?.retweetCount ?? 0,
      op_replies: op?.replyCount ?? 0,
    });

    updates.push({
      id: reply.id.slice(-6),
      fullId: reply.id,
      age: ageHours,
      ourLikes,
      ourRts,
      ourReplies,
      opLikes: op?.likeCount ?? 0,
      strategy: reply.strategy,
      opAuthor: reply.op_author,
      milestones,
    });

    await sleep(500);
  }

  console.error();

  // Save updated ledger
  await saveLedger(campaignDir, ledger);

  // Log milestones
  for (const u of updates) {
    for (const m of u.milestones) {
      await appendLog(campaignDir, {
        event: "MILESTONE",
        detail: `@${u.opAuthor} crossed ${m}L (now ${u.ourLikes}L) ${u.strategy}`,
        driver: `https://x.com/i/status/${u.fullId}`,
      });
    }
  }

  if (updates.length === 0) {
    console.log("No replies need checking (all snapshots are recent).");
    return;
  }

  // Display table
  console.log(`Updated ${updates.length} replies:`);
  console.log();

  const header = `  ${"ID".padStart(8)}  ${"Age".padStart(6)}  ${"OurL".padStart(5)}  ${"OurRT".padStart(5)}  ${"OurR".padStart(5)}  ${"OP_L".padStart(6)}  ${"Strategy".padEnd(16)}  @Author`;
  console.log(header);
  console.log(
    `  ${"─".repeat(8)}  ${"─".repeat(6)}  ${"─".repeat(5)}  ${"─".repeat(5)}  ${"─".repeat(5)}  ${"─".repeat(6)}  ${"─".repeat(16)}  ${"─".repeat(15)}`,
  );

  updates
    .sort((a, b) => b.ourLikes - a.ourLikes)
    .forEach((u) => {
      const ageStr =
        u.age < 48
          ? `${Math.round(u.age)}h`
          : `${(u.age / 24).toFixed(1)}d`;
      console.log(
        `  ...${u.id.padStart(6)}  ${ageStr.padStart(6)}  ${String(u.ourLikes).padStart(5)}  ${String(u.ourRts).padStart(5)}  ${String(u.ourReplies).padStart(5)}  ${String(u.opLikes).padStart(6)}  ${u.strategy.padEnd(16)}  @${u.opAuthor}`,
      );
    });

  console.log();
}

type UpdateInfo = {
  id: string;
  fullId: string;
  age: number;
  ourLikes: number;
  ourRts: number;
  ourReplies: number;
  opLikes: number;
  strategy: string;
  opAuthor: string;
  milestones: number[];
};

function parseDuration(s?: string): number | null {
  if (!s) return null;
  const match = s.match(/^(\d+)(h|d)$/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  const unit = match[2];
  return unit === "h" ? n * 60 * 60 * 1000 : n * 24 * 60 * 60 * 1000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
