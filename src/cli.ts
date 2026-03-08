#!/usr/bin/env node
import { Command } from "commander";
import { resolveRoot, resolveCampaignDir } from "./lib/data.js";
import { starsCommand } from "./commands/stars.js";
import { monitorCommand } from "./commands/monitor.js";
import { registerCommand } from "./commands/register.js";
import { checkCommand } from "./commands/check.js";
import { reportCommand } from "./commands/report.js";
import { insightCommand } from "./commands/insight.js";
import { discoverCommand } from "./commands/discover.js";
import { initCommand } from "./commands/init.js";

const program = new Command();

program
  .name("distro")
  .description("Distribution engine for open-source projects")
  .version("0.1.0")
  .option("--root <path>", "Root directory containing campaign folders")
  .option("--campaign <name>", "Campaign name (subfolder under root)");

program
  .command("monitor")
  .description("Search X for reply opportunities")
  .option("--since <period>", "Time window", "3d")
  .option("--min-likes <n>", "Minimum likes threshold", "10")
  .action(async (opts) => {
    const root = resolveRoot(program.opts().root);
    const dir = resolveCampaignDir(root, program.opts().campaign);
    await monitorCommand(dir, opts);
  });

program
  .command("register <url>")
  .description("Register a posted reply in the tracking ledger")
  .option("--strategy <type>", "Reply strategy type")
  .option("--find-in <url>", "Find our reply in an OP thread")
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
  .option("--port <n>", "Server port", "3000")
  .action(async (opts) => {
    const root = resolveRoot(program.opts().root);
    // TODO: implement dashboard (Phase 3)
    console.log(`dashboard: not yet implemented (root: ${root}, port: ${opts.port})`);
  });

program
  .command("init [name]")
  .description("Scaffold a new campaign directory")
  .option("--repo <owner/name>", "GitHub repo")
  .option("--handle <handle>", "X handle")
  .action(async (name, opts) => {
    const root = resolveRoot(program.opts().root);
    await initCommand(root, { name, ...opts });
  });

program.parse();
