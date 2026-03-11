import { loadCampaign } from "../lib/data.js";
import { getStrategy } from "../strategies/registry.js";

type MonitorOpts = {
  since?: string;
  minLikes?: string;
  save?: boolean;
};

export async function monitorCommand(
  campaignDir: string,
  opts: MonitorOpts,
): Promise<void> {
  const config = await loadCampaign(campaignDir);
  const strategy = getStrategy(config.strategy);

  if (!strategy.monitor) {
    console.log(`The "${strategy.displayName}" strategy does not support monitoring.`);
    return;
  }

  await strategy.monitor(campaignDir, opts);
}
