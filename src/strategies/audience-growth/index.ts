import type { Strategy } from "../types.js";
import { audienceGrowthMonitor } from "./monitor.js";
import { audienceGrowthRegister } from "./register.js";
import { audienceGrowthCheck } from "./check.js";
import { audienceGrowthReport } from "./report.js";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export const audienceGrowthStrategy: Strategy = {
  type: "audience-growth",
  displayName: "Twitter Audience Growth",

  monitor: audienceGrowthMonitor,
  register: audienceGrowthRegister,
  check: audienceGrowthCheck,
  report: audienceGrowthReport,
  loopCommands: () => ["monitor", "check"],

  async initFiles(campaignDir: string) {
    // Post ledger
    await writeFile(
      join(campaignDir, "post-ledger.json"),
      JSON.stringify(
        { version: 1, campaign: "", handle: "", posts: [] },
        null,
        2,
      ) + "\n",
    );

    // Growth history
    await writeFile(join(campaignDir, ".growth-history.json"), "[]\n");

    // Directories
    await mkdir(join(campaignDir, "drafts"), { recursive: true });
    await mkdir(join(campaignDir, "reports"), { recursive: true });
  },
};
