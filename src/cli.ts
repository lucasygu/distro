#!/usr/bin/env node
import { Command } from "commander";
import {
  resolveRoot,
  resolveCampaignDir,
  discoverCampaigns,
} from "./lib/data.js";
import { starsCommand } from "./commands/stars.js";
import { monitorCommand } from "./commands/monitor.js";
import { registerCommand } from "./commands/register.js";
import { checkCommand } from "./commands/check.js";
import { reportCommand } from "./commands/report.js";
import { insightCommand } from "./commands/insight.js";
import { discoverCommand } from "./commands/discover.js";
import { initCommand } from "./commands/init.js";
import { dashboardCommand } from "./commands/dashboard.js";

const program = new Command();

program
  .name("distro")
  .description("Distribution engine for open-source projects")
  .version("0.1.0")
  .option("--root <path>", "Root directory containing campaign folders")
  .option("--campaign <name>", "Campaign name (subfolder under root)")
  .option("--all", "Run across all campaigns");

async function forEachCampaign(
  fn: (dir: string, name: string) => Promise<void>,
): Promise<void> {
  const root = resolveRoot(program.opts().root);
  const campaigns = await discoverCampaigns(root);
  if (campaigns.length === 0) {
    console.log("No campaigns found.");
    return;
  }
  for (const camp of campaigns) {
    console.log();
    console.log(`╔══ ${camp.name} ${"═".repeat(Math.max(0, 44 - camp.name.length))}╗`);
    await fn(camp.dir, camp.name);
    console.log(`╚${"═".repeat(48)}╝`);
  }
}

program
  .command("monitor")
  .description("Search X for reply opportunities")
  .option("--since <period>", "Time window", "3d")
  .option("--min-likes <n>", "Minimum likes threshold", "10")
  .option("--save", "Save report to reports/ directory")
  .action(async (opts) => {
    if (program.opts().all) {
      await forEachCampaign((dir) => monitorCommand(dir, opts));
      return;
    }
    const root = resolveRoot(program.opts().root);
    const dir = resolveCampaignDir(root, program.opts().campaign);
    await monitorCommand(dir, opts);
  });

program
  .command("register <url>")
  .description("Register a posted reply in the tracking ledger")
  .option("--strategy <type>", "Reply strategy type")
  .option("--find-in <url>", "Find our reply in an OP thread")
  .option("--topic <topic>", "Topic tag (x-post-growth)")
  .action(async (url, opts) => {
    const root = resolveRoot(program.opts().root);
    const dir = resolveCampaignDir(root, program.opts().campaign);
    await registerCommand(dir, url, opts);
  });

program
  .command("discover")
  .description("Find untracked replies and register them")
  .action(async () => {
    const root = resolveRoot(program.opts().root);
    const dir = resolveCampaignDir(root, program.opts().campaign);
    await discoverCommand(dir);
  });

program
  .command("check")
  .description("Fetch engagement snapshots for tracked replies")
  .option("--since <period>", "Only check replies posted within this window")
  .option("--id <id>", "Check a specific reply by tweet ID")
  .action(async (opts) => {
    if (program.opts().all) {
      await forEachCampaign((dir) => checkCommand(dir, opts));
      return;
    }
    const root = resolveRoot(program.opts().root);
    const dir = resolveCampaignDir(root, program.opts().campaign);
    await checkCommand(dir, opts);
  });

program
  .command("report")
  .description("Analyze reply performance")
  .option("--save", "Save report to reports/ directory")
  .action(async (opts) => {
    const root = resolveRoot(program.opts().root);
    const dir = resolveCampaignDir(root, program.opts().campaign);
    await reportCommand(dir, opts);
  });

program
  .command("stars")
  .description("Track GitHub stars and forks")
  .action(async () => {
    if (program.opts().all) {
      await forEachCampaign((dir) => starsCommand(dir));
      return;
    }
    const root = resolveRoot(program.opts().root);
    const dir = resolveCampaignDir(root, program.opts().campaign);
    await starsCommand(dir);
  });

program
  .command("insight <message>")
  .description("Log an insight to the distribution log")
  .action(async (message) => {
    const root = resolveRoot(program.opts().root);
    const dir = resolveCampaignDir(root, program.opts().campaign);
    await insightCommand(dir, message);
  });

program
  .command("dashboard")
  .description("Start the local dashboard server")
  .action(async () => {
    const root = resolveRoot(program.opts().root);
    await dashboardCommand(root);
  });

program
  .command("init [name]")
  .description("Scaffold a new campaign directory")
  .option("--repo <owner/name>", "GitHub repo")
  .option("--handle <handle>", "X handle")
  .option("--strategy <type>", "Strategy type (reply-to-boost, x-post-growth)", "reply-to-boost")
  .action(async (name, opts) => {
    const root = resolveRoot(program.opts().root);
    await initCommand(root, { name, ...opts });
  });

program.parse();
