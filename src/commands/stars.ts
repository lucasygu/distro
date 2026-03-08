import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import {
  loadCampaign,
  loadStarHistory,
  appendStarSnapshot,
} from "../lib/data.js";
import { appendLog } from "../lib/log.js";

const execFile = promisify(execFileCb);

export async function starsCommand(campaignDir: string): Promise<void> {
  const config = await loadCampaign(campaignDir);

  // Fetch current stats via gh CLI
  let stars: number;
  let forks: number;
  try {
    const { stdout } = await execFile("gh", [
      "api",
      `repos/${config.repo}`,
      "--jq",
      ".stargazers_count,.forks_count",
    ]);
    const lines = stdout.trim().split("\n");
    stars = parseInt(lines[0], 10);
    forks = parseInt(lines[1], 10);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to fetch GitHub stats: ${message}`);
    await appendLog(campaignDir, {
      event: "WARNING",
      detail: `gh api failed: ${message.slice(0, 200)}`,
      driver: "",
    });
    return;
  }

  // Compare with previous
  const history = await loadStarHistory(campaignDir);
  const previous = history.length > 0 ? history[history.length - 1] : null;
  const prevStars = previous?.stars ?? stars;
  const delta = stars - prevStars;

  // Append to history
  const snapshot = { ts: new Date().toISOString(), stars, forks };
  await appendStarSnapshot(campaignDir, snapshot);

  // Log to distribution log
  const detail =
    delta !== 0
      ? `${prevStars}→${stars} (${delta > 0 ? "+" : ""}${delta}) forks:${forks}`
      : `${stars} (no change) forks:${forks}`;
  await appendLog(campaignDir, { event: "STARS", detail, driver: "" });

  // Output
  console.log(`⭐ ${stars} stars | 🍴 ${forks} forks`);
  if (delta > 0) {
    console.log(`   +${delta} since last check`);
  } else if (delta < 0) {
    console.log(`   ${delta} since last check`);
  } else if (previous) {
    console.log(`   No change since last check`);
  }
}
