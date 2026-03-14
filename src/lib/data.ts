import { readFile, writeFile, readdir, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import type {
  CampaignConfig,
  ReplyLedger,
  StarSnapshot,
  PostLedger,
  GrowthSnapshot,
  DistroConfig,
} from "./types.js";

// === Root resolution ===

export function resolveRoot(flagRoot?: string): string {
  // Priority: --root flag > DISTRO_ROOT env > ~/.distrorc > cwd
  if (flagRoot) return resolve(flagRoot);
  if (process.env.DISTRO_ROOT) return resolve(process.env.DISTRO_ROOT);

  try {
    const rc = join(homedir(), ".distrorc");
    // Synchronous read for startup — only runs once
    const fs = require("node:fs");
    const config: DistroConfig = JSON.parse(fs.readFileSync(rc, "utf-8"));
    if (config.root) return resolve(config.root);
  } catch {
    // No .distrorc
  }

  return process.cwd();
}

// === Campaign resolution ===

export function resolveCampaignDir(
  root: string,
  campaignName?: string,
): string {
  if (campaignName) return join(root, campaignName);
  return root; // cwd mode — user is inside a campaign dir
}

export async function loadCampaign(
  campaignDir: string,
): Promise<CampaignConfig> {
  const configPath = join(campaignDir, "campaign.json");
  const raw = await readFile(configPath, "utf-8");
  const parsed = JSON.parse(raw);

  // Backward compatibility: default strategy, rename fields
  if (!parsed.strategy) parsed.strategy = "reply-to-boost";
  if (!parsed.replyTactics && parsed.strategies) {
    parsed.replyTactics = parsed.strategies;
  }
  if (!parsed.deadReplyTactics && parsed.deadStrategies) {
    parsed.deadReplyTactics = parsed.deadStrategies;
  }

  return parsed as CampaignConfig;
}

// === Campaign discovery (for dashboard) ===

export async function discoverCampaigns(
  root: string,
): Promise<{ name: string; dir: string; config: CampaignConfig }[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const campaigns: { name: string; dir: string; config: CampaignConfig }[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = join(root, entry.name);
    const configPath = join(dir, "campaign.json");
    try {
      await access(configPath);
      const config = await loadCampaign(dir);
      campaigns.push({ name: entry.name, dir, config });
    } catch {
      // Not a campaign directory
    }
  }

  return campaigns;
}

// === Reply ledger ===

export async function loadLedger(campaignDir: string): Promise<ReplyLedger> {
  const ledgerPath = join(campaignDir, "reply-ledger.json");
  try {
    const raw = await readFile(ledgerPath, "utf-8");
    return JSON.parse(raw) as ReplyLedger;
  } catch {
    return { version: 1, campaign: "", our_handle: "", replies: [] };
  }
}

export async function saveLedger(
  campaignDir: string,
  ledger: ReplyLedger,
): Promise<void> {
  const ledgerPath = join(campaignDir, "reply-ledger.json");
  await writeFile(ledgerPath, JSON.stringify(ledger, null, 2) + "\n");
}

// === Star history ===

export async function loadStarHistory(
  campaignDir: string,
): Promise<StarSnapshot[]> {
  const historyPath = join(campaignDir, ".star-history.json");
  try {
    const raw = await readFile(historyPath, "utf-8");
    return JSON.parse(raw) as StarSnapshot[];
  } catch {
    return [];
  }
}

export async function appendStarSnapshot(
  campaignDir: string,
  snapshot: StarSnapshot,
): Promise<void> {
  const history = await loadStarHistory(campaignDir);
  history.push(snapshot);
  const historyPath = join(campaignDir, ".star-history.json");
  await writeFile(historyPath, JSON.stringify(history, null, 2) + "\n");
}

// === Post ledger (audience-growth) ===

export async function loadPostLedger(
  campaignDir: string,
): Promise<PostLedger> {
  const path = join(campaignDir, "post-ledger.json");
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as PostLedger;
  } catch {
    return { version: 1, campaign: "", handle: "", posts: [] };
  }
}

export async function savePostLedger(
  campaignDir: string,
  ledger: PostLedger,
): Promise<void> {
  const path = join(campaignDir, "post-ledger.json");
  await writeFile(path, JSON.stringify(ledger, null, 2) + "\n");
}

// === Growth history (audience-growth) ===

export async function loadGrowthHistory(
  campaignDir: string,
): Promise<GrowthSnapshot[]> {
  const path = join(campaignDir, ".growth-history.json");
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as GrowthSnapshot[];
  } catch {
    return [];
  }
}

export async function appendGrowthSnapshot(
  campaignDir: string,
  snapshot: GrowthSnapshot,
): Promise<void> {
  const history = await loadGrowthHistory(campaignDir);
  history.push(snapshot);
  const path = join(campaignDir, ".growth-history.json");
  await writeFile(path, JSON.stringify(history, null, 2) + "\n");
}
