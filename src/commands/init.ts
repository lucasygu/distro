import { writeFile, mkdir, access } from "node:fs/promises";
import { join, basename } from "node:path";
import type { CampaignConfig } from "../lib/types.js";
import type { StrategyType } from "../strategies/types.js";
import { getStrategy } from "../strategies/registry.js";

type InitOpts = {
  name?: string;
  repo?: string;
  handle?: string;
  strategy?: string;
};

export async function initCommand(
  parentDir: string,
  opts: InitOpts,
): Promise<void> {
  const name = opts.name ?? basename(process.cwd());
  const campaignDir = join(parentDir, name);
  const strategyType = (opts.strategy ?? "reply-to-boost") as StrategyType;

  // Check if campaign.json already exists
  try {
    await access(join(campaignDir, "campaign.json"));
    console.error(`Campaign already exists: ${campaignDir}/campaign.json`);
    process.exit(1);
  } catch {
    // Good — doesn't exist yet
  }

  await mkdir(campaignDir, { recursive: true });

  // Build config based on strategy
  let config: CampaignConfig;

  if (strategyType === "x-post-growth") {
    config = {
      name,
      handle: opts.handle ?? "lucasgu",
      language: "zh",
      strategy: "x-post-growth",
      platform: "x",
      topics: [
        `${name} (tool OR project)`,
      ],
      postFrequency: "daily",
    };
  } else {
    config = {
      name,
      handle: opts.handle ?? "lucasgu",
      language: "zh",
      strategy: "reply-to-boost",
      platform: "x",
      repo: opts.repo ?? `lucasygu/${name}`,
      queries: [
        `${name} (tool OR cli OR 工具)`,
      ],
      minLikes: 10,
      crowdedThreshold: 10,
      replyTactics: ["short-anchored", "peer-sharing"],
      deadReplyTactics: [],
      githubLink: `https://github.com/${opts.repo ?? `lucasygu/${name}`}`,
      since: "3d",
      playbook: "PLAYBOOK.md",
    };
  }

  await writeFile(
    join(campaignDir, "campaign.json"),
    JSON.stringify(config, null, 2) + "\n",
  );

  // Initialize distribution log (shared across strategies)
  await writeFile(
    join(campaignDir, "distribution-log.tsv"),
    "TIMESTAMP\tEVENT\tDETAIL\tDRIVER\n",
  );

  // Strategy-specific init files
  const strategy = getStrategy(strategyType);
  if (strategy.initFiles) {
    await strategy.initFiles(campaignDir);
  } else {
    // Default: reply-to-boost files
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
    await writeFile(join(campaignDir, ".star-history.json"), "[]\n");

    const playbook = [
      `# Reply Playbook — ${name}`,
      "",
      "> Update this file as you learn what works.",
      "",
      "## Targeting Rules",
      "",
      "- OP sweet spot: 100-500L",
      "- Skip crowded threads (10+ replies)",
      "- Reply fresh (within hours)",
      "",
      "## Drafting Rules",
      "",
      "- Under 80 chars + GitHub link",
      "- Short-anchored: echo one OP detail → bridge to your thing",
      "- Match OP language",
      "- No hashtags, no \"Great post!\" energy",
      "",
      "## Top Performers",
      "",
      "| # | OP | Likes | Chars | Strategy |",
      "|---|-----|-------|-------|----------|",
      "| 1 | (pending) | — | — | — |",
      "",
      "## Dead Strategies",
      "",
      "- (none yet)",
      "",
    ].join("\n");
    await writeFile(join(campaignDir, "PLAYBOOK.md"), playbook);
    await mkdir(join(campaignDir, "drafts"), { recursive: true });
    await mkdir(join(campaignDir, "reports"), { recursive: true });
  }

  console.log(`✅ Campaign initialized: ${campaignDir}`);
  console.log(`   Strategy: ${strategy.displayName}`);
  console.log();
  console.log("Next steps:");
  console.log(`  1. Edit ${campaignDir}/campaign.json`);
  console.log(`  2. distro --campaign ${name} monitor`);
}
