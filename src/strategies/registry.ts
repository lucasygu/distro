import type { Strategy, StrategyType } from "./types.js";

const strategies = new Map<StrategyType, Strategy>();

export function registerStrategy(strategy: Strategy): void {
  strategies.set(strategy.type, strategy);
}

export function getStrategy(type: StrategyType): Strategy {
  const s = strategies.get(type);
  if (!s) {
    throw new Error(
      `Unknown strategy: "${type}". Available: ${[...strategies.keys()].join(", ")}`,
    );
  }
  return s;
}

// Auto-register built-in strategies
import { replyToBoostStrategy } from "./reply-to-boost/index.js";
import { xPostGrowthStrategy } from "./x-post-growth/index.js";
registerStrategy(replyToBoostStrategy);
registerStrategy(xPostGrowthStrategy);
