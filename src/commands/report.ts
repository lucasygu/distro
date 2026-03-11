import { loadCampaign } from "../lib/data.js";
import { getStrategy } from "../strategies/registry.js";

type ReportOpts = {
  save?: boolean;
};

export async function reportCommand(
  campaignDir: string,
  opts: ReportOpts,
): Promise<void> {
  const config = await loadCampaign(campaignDir);
  const strategy = getStrategy(config.strategy);

  if (!strategy.report) {
    console.log(`The "${strategy.displayName}" strategy does not support reporting.`);
    return;
  }

  await strategy.report(campaignDir, opts);
}
