import { writeFile, mkdir, access } from "node:fs/promises";
import { join, basename } from "node:path";
import type { CampaignConfig } from "../lib/types.js";

type InitOpts = {
  name?: string;
  repo?: string;
  handle?: string;
};

export async function initCommand(
  parentDir: string,
  opts: InitOpts,
): Promise<void> {
  const name = opts.name ?? basename(process.cwd());
  const campaignDir = join(parentDir, name);

  // Check if campaign.json already exists
  try {
    await access(join(campaignDir, "campaign.json"));
    console.error(`Campaign already exists: ${campaignDir}/campaign.json`);
    process.exit(1);
  } catch {
    // Good — doesn't exist yet
  }

  await mkdir(campaignDir, { recursive: true });

  const config: CampaignConfig = {
    name,
    repo: opts.repo ?? `lucasygu/${name}`,
    handle: opts.handle ?? "lucasgu",
    language: "zh",
    queries: [
      `${name} (tool OR cli OR 工具)`,
    ],
    minLikes: 10,
    crowdedThreshold: 10,
    strategies: ["short-anchored", "peer-sharing"],
    deadStrategies: [],
    githubLink: `https://github.com/${opts.repo ?? `lucasygu/${name}`}`,
    since: "3d",
    platform: "x",
  };

  await writeFile(
    join(campaignDir, "campaign.json"),
    JSON.stringify(config, null, 2) + "\n",
  );

  // Initialize empty ledger
  const ledger = {
    version: 1,
    campaign: name,
    our_handle: config.handle,
    replies: [],
  };
  await writeFile(
    join(campaignDir, "reply-ledger.json"),
    JSON.stringify(ledger, null, 2) + "\n",
  );

  // Initialize distribution log
  await writeFile(
    join(campaignDir, "distribution-log.tsv"),
    "TIMESTAMP\tEVENT\tDETAIL\tDRIVER\n",
  );

  // Initialize star history
  await writeFile(join(campaignDir, ".star-history.json"), "[]\n");

  // Create directories
  await mkdir(join(campaignDir, "drafts"), { recursive: true });
  await mkdir(join(campaignDir, "reports"), { recursive: true });

  console.log(`✅ Campaign initialized: ${campaignDir}`);
  console.log();
  console.log("Created:");
  console.log(`  campaign.json         — edit queries, repo, handle`);
  console.log(`  reply-ledger.json     — reply tracking (empty)`);
  console.log(`  distribution-log.tsv  — event log (empty)`);
  console.log(`  .star-history.json    — star tracking (empty)`);
  console.log(`  drafts/               — reply drafts`);
  console.log(`  reports/              — saved reports`);
  console.log();
  console.log("Next steps:");
  console.log(`  1. Edit ${campaignDir}/campaign.json — set repo, handle, queries`);
  console.log(`  2. distro --campaign ${name} monitor`);
  console.log(`  3. distro --campaign ${name} stars`);
}
