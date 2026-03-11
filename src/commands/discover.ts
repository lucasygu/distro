import { loadCampaign } from "../lib/data.js";
import { getStrategy } from "../strategies/registry.js";

export async function discoverCommand(campaignDir: string): Promise<void> {
  const config = await loadCampaign(campaignDir);
  const strategy = getStrategy(config.strategy);

  if (!strategy.discover) {
    console.log(`The "${strategy.displayName}" strategy does not support discovery.`);
    return;
  }

  await strategy.discover(campaignDir);
}
