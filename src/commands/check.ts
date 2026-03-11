import { loadCampaign } from "../lib/data.js";
import { getStrategy } from "../strategies/registry.js";

type CheckOpts = {
  since?: string;
  id?: string;
};

export async function checkCommand(
  campaignDir: string,
  opts: CheckOpts,
): Promise<void> {
  const config = await loadCampaign(campaignDir);
  const strategy = getStrategy(config.strategy);

  if (!strategy.check) {
    console.log(`The "${strategy.displayName}" strategy does not support checking.`);
    return;
  }

  await strategy.check(campaignDir, opts);
}
