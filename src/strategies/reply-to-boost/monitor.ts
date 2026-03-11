import { loadCampaign } from "../../lib/data.js";
import { callBird } from "../../lib/bird.js";
import { appendLog } from "../../lib/log.js";
import type { BirdTweet } from "../../lib/types.js";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

type MonitorOpts = {
  since?: string;
  minLikes?: string;
  save?: boolean;
};

export async function replyToBoostMonitor(
  campaignDir: string,
  opts: MonitorOpts,
): Promise<void> {
  const config = await loadCampaign(campaignDir);
  const minLikes = parseInt(opts.minLikes ?? String(config.minLikes), 10);

  // Phase 1: Search across all queries
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(` X Monitor — ${config.name}`);
  console.log(` Since: ${config.since} | Min likes: ${minLikes}`);
  console.log(` ${new Date().toISOString().slice(0, 16).replace("T", " ")}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log();

  const seen = new Map<string, BirdTweet>();

  for (let i = 0; i < config.queries.length; i++) {
    const q = config.queries[i];
    console.error(
      `🔍 Query ${i + 1}/${config.queries.length}: ${q}`,
    );
    const result = await callBird(["search", q], campaignDir);
    if (result.ok) {
      for (const tweet of result.data) {
        if (tweet.id && !seen.has(tweet.id)) {
          seen.set(tweet.id, tweet);
        }
      }
    }
    // Small delay between queries
    await sleep(1000);
  }

  console.error();

  // Phase 2: Check which posts we already replied to
  const repliedIds = new Set<string>();
  const postsToCheck = [...seen.values()].filter(
    (t) => t.likeCount >= minLikes && !t.inReplyToStatusId,
  );

  // Also check parent IDs of reply-tweets in results
  for (const t of seen.values()) {
    if (t.inReplyToStatusId && !seen.has(t.inReplyToStatusId)) {
      postsToCheck.push({
        ...t,
        id: t.inReplyToStatusId,
        author: { username: "i", name: "" },
      });
    }
  }

  // Deduplicate check list
  const checkMap = new Map<string, BirdTweet>();
  for (const t of postsToCheck) {
    if (!checkMap.has(t.id)) checkMap.set(t.id, t);
  }

  if (checkMap.size > 0) {
    console.error(
      `🔎 Checking ${checkMap.size} threads for existing replies...`,
    );

    for (const [tid, t] of checkMap) {
      const author = t.author.username;
      const result = await callBird(
        ["replies", `https://x.com/${author}/status/${tid}`],
        campaignDir,
      );
      if (result.ok) {
        const hasOurReply = result.data.some(
          (r) =>
            r.author.username.toLowerCase() ===
            config.handle.toLowerCase(),
        );
        if (hasOurReply) {
          repliedIds.add(tid);
          console.error(`  ✅ Already replied to @${author}`);
        } else {
          console.error(`  ❌ Not replied: @${author}`);
        }
      }
      await sleep(500);
    }
    console.error();
  }

  // Phase 3: Filter, categorize, display
  const filtered = [...seen.values()]
    .filter((t) => t.likeCount >= minLikes)
    .sort((a, b) => b.likeCount - a.likeCount);

  // Filter out sub-thread replies where parent is already replied to
  const parentFiltered = filtered.filter((t) => {
    if (t.inReplyToStatusId && repliedIds.has(t.inReplyToStatusId)) {
      return false;
    }
    return true;
  });

  const skipped = filtered.length - parentFiltered.length;
  if (skipped > 0) {
    console.log(
      `Skipped ${skipped} sub-thread replies (parent already replied to)`,
    );
    console.log();
  }

  const high = parentFiltered.filter((t) => t.likeCount >= 50);
  const medium = parentFiltered.filter(
    (t) => t.likeCount >= 10 && t.likeCount < 50,
  );

  const crowdedThreshold = config.crowdedThreshold ?? 10;

  const unrepliedHigh = high.filter(
    (t) =>
      !repliedIds.has(t.id) &&
      !t.inReplyToStatusId &&
      t.replyCount < crowdedThreshold,
  );
  const unrepliedMed = medium.filter(
    (t) =>
      !repliedIds.has(t.id) &&
      !t.inReplyToStatusId &&
      t.replyCount < crowdedThreshold,
  );
  const crowdedHigh = high.filter(
    (t) =>
      !repliedIds.has(t.id) &&
      !t.inReplyToStatusId &&
      t.replyCount >= crowdedThreshold,
  );

  const crowdedNote = crowdedHigh.length
    ? ` (${crowdedHigh.length} skipped — crowded ${crowdedThreshold}+ replies)`
    : "";

  console.log(
    `Found ${parentFiltered.length} posts (${high.length} reply zone 50+, ${medium.length} watch zone 10-49)`,
  );
  console.log(
    `Unreplied targets: ${unrepliedHigh.length} high, ${unrepliedMed.length} medium${crowdedNote}`,
  );
  console.log(`Total tweets scanned: ${seen.size}`);

  // Log to distribution log
  if (unrepliedHigh.length > 0) {
    const targets = unrepliedHigh
      .map((t) => `@${t.author.username} (${t.likeCount}L)`)
      .join("; ");
    await appendLog(campaignDir, {
      event: "MONITOR",
      detail: `${unrepliedHigh.length} new targets: ${targets}`,
      driver: "",
    });
  } else {
    await appendLog(campaignDir, {
      event: "MONITOR",
      detail: `no new targets (${parentFiltered.length} posts scanned)`,
      driver: "",
    });
  }

  console.log();

  // Display results
  if (high.length > 0) {
    console.log("═══ 🔴 REPLY ZONE (50+ likes) — act on these ═══");
    console.log();
    high.forEach((t, i) => {
      console.log(
        formatTweet(t, i + 1, repliedIds, config.handle, crowdedThreshold),
      );
      console.log();
    });
  }

  if (medium.length > 0) {
    console.log(
      "═══ 🟡 WATCH ZONE (10-49 likes) — skip unless perfect fit ═══",
    );
    console.log();
    medium.forEach((t, i) => {
      console.log(
        formatTweet(t, i + 1, repliedIds, config.handle, crowdedThreshold),
      );
      console.log();
    });
  }

  // Next steps
  console.log("━━━ NEXT STEPS ━━━");
  console.log();
  if (unrepliedHigh.length > 0) {
    const t = unrepliedHigh[0];
    console.log("🎯 Top unreplied target:");
    console.log(
      `  /reply-composer https://x.com/${t.author.username}/status/${t.id}`,
    );
    console.log();
  }
  console.log("To draft a reply:");
  console.log("  /reply-composer https://x.com/author/status/<ID>");
  console.log();

  // Save report if requested
  if (opts.save) {
    const reportsDir = join(campaignDir, "reports");
    await mkdir(reportsDir, { recursive: true });
    const reportPath = join(
      reportsDir,
      `${new Date().toISOString().slice(0, 10)}_x-monitor.md`,
    );
    const lines: string[] = [
      `# X Monitor Report — ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
      "",
      `Queries: ${config.queries.length} | Since: ${config.since} | Min likes: ${minLikes}`,
      `Total scanned: ${seen.size} | Found: ${parentFiltered.length} (${high.length} reply zone, ${medium.length} watch zone)`,
      `Unreplied: ${unrepliedHigh.length} high, ${unrepliedMed.length} medium`,
      "",
    ];
    if (high.length > 0) {
      lines.push("## Reply Zone (50+)");
      lines.push("");
      for (const t of high) {
        const status = repliedIds.has(t.id) ? "REPLIED" : "UNREPLIED";
        lines.push(
          `- **@${t.author.username}** ${t.likeCount}L ${t.retweetCount}RT ${t.replyCount}R [${status}]`,
        );
        lines.push(
          `  ${t.text.replace(/\n/g, " ").slice(0, 120)}`,
        );
        lines.push(
          `  https://x.com/${t.author.username}/status/${t.id}`,
        );
        lines.push("");
      }
    }
    if (medium.length > 0) {
      lines.push("## Watch Zone (10-49)");
      lines.push("");
      for (const t of medium) {
        const status = repliedIds.has(t.id) ? "REPLIED" : "UNREPLIED";
        lines.push(
          `- **@${t.author.username}** ${t.likeCount}L ${t.retweetCount}RT ${t.replyCount}R [${status}]`,
        );
        lines.push(
          `  https://x.com/${t.author.username}/status/${t.id}`,
        );
        lines.push("");
      }
    }
    await writeFile(reportPath, lines.join("\n"));
    console.log(`Saved: ${reportPath}`);
  }
}

function formatTweet(
  t: BirdTweet,
  idx: number,
  repliedIds: Set<string>,
  ourHandle: string,
  crowdedThreshold: number,
): string {
  const isReply = Boolean(t.inReplyToStatusId);
  const isOurs =
    t.author.username.toLowerCase() === ourHandle.toLowerCase();
  const weReplied = repliedIds.has(t.id);
  const crowded =
    t.replyCount >= crowdedThreshold && !weReplied ? " ⚠️ CROWDED" : "";
  const status = weReplied ? " ✅ REPLIED" : "";

  const priority = t.likeCount >= 50 ? "🔴 REPLY" : "🟡 WATCH";
  const text = t.text.replace(/\n/g, " ").slice(0, 200);

  // Age
  let ageStr = "";
  try {
    const created = new Date(t.createdAt);
    const ageH =
      (Date.now() - created.getTime()) / (1000 * 60 * 60);
    ageStr =
      ageH < 24
        ? ` (${Math.round(ageH)}h ago)`
        : ` (${(ageH / 24).toFixed(1)}d ago)`;
  } catch {
    // skip
  }

  const lines = [
    `  ${idx}. ${priority} | ${t.likeCount}L ${t.retweetCount}RT ${t.replyCount}R | @${t.author.username} (${t.author.name})${ageStr}${status}${crowded}`,
    `     ${isReply ? "[REPLY] " : ""}${isOurs ? "[OUR POST] " : ""}${text}`,
    `     → https://x.com/${t.author.username}/status/${t.id}`,
  ];

  return lines.join("\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
