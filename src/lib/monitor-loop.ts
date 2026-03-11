import { spawn } from "node:child_process";
import { loadCampaign } from "./data.js";
import { getStrategy } from "../strategies/registry.js";

type LoopState = {
  interval: ReturnType<typeof setInterval>;
  intervalMs: number;
  campaignDir: string;
  campaignName: string;
  root: string;
  startedAt: Date;
  lastRunAt: Date | null;
  running: boolean;
};

const loops = new Map<string, LoopState>();

export type LoopInfo = {
  campaignName: string;
  intervalMs: number;
  startedAt: string;
  lastRunAt: string | null;
  running: boolean;
};

export function startLoop(
  campaignName: string,
  campaignDir: string,
  root: string,
  intervalMs: number = 10 * 60 * 1000,
): { started: boolean; reason?: string } {
  if (loops.has(campaignName)) {
    return { started: false, reason: "already running" };
  }

  const interval = setInterval(() => {
    runCycle(campaignName, root);
  }, intervalMs);

  loops.set(campaignName, {
    interval,
    intervalMs,
    campaignDir,
    campaignName,
    root,
    startedAt: new Date(),
    lastRunAt: null,
    running: false,
  });

  // Run first cycle immediately
  runCycle(campaignName, root);

  return { started: true };
}

export function stopLoop(campaignName: string): boolean {
  const state = loops.get(campaignName);
  if (!state) return false;
  clearInterval(state.interval);
  loops.delete(campaignName);
  return true;
}

export function getLoopStatus(campaignName: string): LoopInfo | null {
  const state = loops.get(campaignName);
  if (!state) return null;
  return toInfo(state);
}

export function getAllLoopStatuses(): Record<string, LoopInfo> {
  const result: Record<string, LoopInfo> = {};
  for (const [name, state] of loops) {
    result[name] = toInfo(state);
  }
  return result;
}

function toInfo(state: LoopState): LoopInfo {
  return {
    campaignName: state.campaignName,
    intervalMs: state.intervalMs,
    startedAt: state.startedAt.toISOString(),
    lastRunAt: state.lastRunAt?.toISOString() ?? null,
    running: state.running,
  };
}

async function runCycle(name: string, root: string) {
  const state = loops.get(name);
  if (!state || state.running) return;

  state.running = true;

  // Get commands from strategy (defaults to monitor/stars/check)
  let cmdNames = ["monitor", "stars", "check"];
  try {
    const config = await loadCampaign(state.campaignDir);
    const strategy = getStrategy(config.strategy);
    if (strategy.loopCommands) {
      cmdNames = strategy.loopCommands();
    }
  } catch {
    // fallback to defaults
  }

  const commands = cmdNames.map((cmd) => [
    cmd, "--root", root, "--campaign", name,
  ]);

  runSequential(commands, 0, () => {
    const s = loops.get(name);
    if (s) {
      s.running = false;
      s.lastRunAt = new Date();
    }
  });
}

function runSequential(
  commands: string[][],
  index: number,
  onDone: () => void,
) {
  if (index >= commands.length) {
    onDone();
    return;
  }

  const args = commands[index];
  // Use the same node binary and entry script as the current process
  const child = spawn(process.argv[0], [process.argv[1], ...args], {
    stdio: "ignore",
    env: { ...process.env },
  });

  child.on("close", () => {
    runSequential(commands, index + 1, onDone);
  });

  child.on("error", () => {
    runSequential(commands, index + 1, onDone);
  });
}
