import {
  loadCampaign,
  loadPostLedger,
  savePostLedger,
  appendGrowthSnapshot,
  loadGrowthHistory,
} from "../../lib/data.js";
import { callBird } from "../../lib/bird.js";
import { appendLog } from "../../lib/log.js";

type CheckOpts = {
  id?: string;
};

/**
 * Audience-growth check: snapshot follower count and
 * engagement metrics on tracked posts.
 */
export async function audienceGrowthCheck(
  campaignDir: string,
  opts: CheckOpts,
): Promise<void> {
  const config = await loadCampaign(campaignDir);
  const ledger = await loadPostLedger(campaignDir);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(` Audience Growth Check — ${config.name}`);
  console.log(` ${new Date().toISOString().slice(0, 16).replace("T", " ")}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log();

  // Check follower count via profile lookup
  console.error("📊 Fetching profile metrics...");
  const profileResult = await callBird(
    ["read", `https://x.com/${config.handle}`],
    campaignDir,
  );

  if (profileResult.ok && profileResult.data.length > 0) {
    // bird returns profile info in the author field
    const profile = profileResult.data[0];
    const now = new Date().toISOString();

    // Load previous snapshot for comparison
    const history = await loadGrowthHistory(campaignDir);
    const prev = history.length > 0 ? history[history.length - 1] : null;

    // bird's read on a profile URL may return follower data
    // If not available, we still track what we can
    const snapshot = {
      ts: now,
      followers: (profile as any).followerCount ?? 0,
      following: (profile as any).followingCount ?? 0,
    };

    if (snapshot.followers > 0) {
      await appendGrowthSnapshot(campaignDir, snapshot);
      const delta = prev ? snapshot.followers - prev.followers : 0;
      const sign = delta >= 0 ? "+" : "";
      console.log(`  Followers: ${snapshot.followers} (${sign}${delta})`);
      console.log(`  Following: ${snapshot.following}`);

      await appendLog(campaignDir, {
        event: "STARS", // reuse STARS event type for follower tracking
        detail: `followers: ${snapshot.followers} (${sign}${delta})`,
        driver: "",
      });
    } else {
      console.log("  Could not fetch follower count from profile.");
    }
    console.log();
  }

  // Check post performance
  if (ledger.posts.length === 0) {
    console.log("No posts tracked yet. Register posts with 'distro register <url>'.");
    return;
  }

  const now = Date.now();
  let updated = 0;

  for (const post of ledger.posts) {
    if (opts.id && post.id !== opts.id) continue;

    // Skip if last snapshot was <2h ago
    if (post.snapshots.length > 0) {
      const last = post.snapshots[post.snapshots.length - 1];
      const posted = new Date(post.posted_at).getTime();
      const currentAgeH = (now - posted) / (1000 * 60 * 60);
      if (Math.abs(currentAgeH - last.age_hours) < 2) continue;
    }

    console.error(`  📥 ${post.id.slice(-6)}...`);

    const result = await callBird(
      ["read", `https://x.com/i/status/${post.id}`],
      campaignDir,
    );

    if (result.ok && result.data.length > 0) {
      const tweet = result.data[0];
      const posted = new Date(post.posted_at).getTime();
      const ageHours = Math.round(((now - posted) / (1000 * 60 * 60)) * 10) / 10;

      post.snapshots.push({
        ts: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
        age_hours: ageHours,
        likes: tweet.likeCount,
        retweets: tweet.retweetCount,
        replies: tweet.replyCount,
      });
      updated++;
    }

    await sleep(500);
  }

  console.error();

  await savePostLedger(campaignDir, ledger);

  if (updated === 0) {
    console.log("All post snapshots are recent (checked within last 2h).");
    return;
  }

  // Display table
  console.log(`Updated ${updated} posts:`);
  console.log();

  const header = `  ${"ID".padStart(8)}  ${"Age".padStart(6)}  ${"Likes".padStart(5)}  ${"RT".padStart(4)}  ${"Replies".padStart(7)}  ${"Type".padEnd(8)}  Topic`;
  console.log(header);
  console.log(
    `  ${"─".repeat(8)}  ${"─".repeat(6)}  ${"─".repeat(5)}  ${"─".repeat(4)}  ${"─".repeat(7)}  ${"─".repeat(8)}  ${"─".repeat(15)}`,
  );

  const sorted = [...ledger.posts]
    .filter((p) => p.snapshots.length > 0)
    .sort((a, b) => {
      const aL = a.snapshots[a.snapshots.length - 1].likes;
      const bL = b.snapshots[b.snapshots.length - 1].likes;
      return bL - aL;
    });

  for (const post of sorted) {
    const latest = post.snapshots[post.snapshots.length - 1];
    const ageStr = latest.age_hours < 48
      ? `${Math.round(latest.age_hours)}h`
      : `${(latest.age_hours / 24).toFixed(1)}d`;
    console.log(
      `  ...${post.id.slice(-6).padStart(6)}  ${ageStr.padStart(6)}  ${String(latest.likes).padStart(5)}  ${String(latest.retweets).padStart(4)}  ${String(latest.replies).padStart(7)}  ${post.type.padEnd(8)}  ${post.topic}`,
    );
  }

  console.log();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
