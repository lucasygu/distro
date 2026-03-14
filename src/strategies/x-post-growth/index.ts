import type { Strategy } from "../types.js";
import { xPostGrowthMonitor } from "./monitor.js";
import { xPostGrowthRegister } from "./register.js";
import { xPostGrowthCheck } from "./check.js";
import { xPostGrowthReport } from "./report.js";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export const xPostGrowthStrategy: Strategy = {
  type: "x-post-growth",
  displayName: "X Post Growth",

  monitor: xPostGrowthMonitor,
  register: xPostGrowthRegister,
  check: xPostGrowthCheck,
  report: xPostGrowthReport,
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
