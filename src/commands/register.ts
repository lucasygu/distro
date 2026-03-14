import { loadCampaign } from "../lib/data.js";
import { getStrategy } from "../strategies/registry.js";

type RegisterOpts = {
  strategy?: string;
  findIn?: string;
  topic?: string;
};

export async function registerCommand(
  campaignDir: string,
  url: string,
  opts: RegisterOpts,
): Promise<void> {
  const config = await loadCampaign(campaignDir);
  const strategy = getStrategy(config.strategy);

  if (!strategy.register) {
    console.log(`The "${strategy.displayName}" strategy does not support registration.`);
    return;
  }

  await strategy.register(campaignDir, url, opts);
}

// Re-export for discover command backward compat
export { registerReply } from "../strategies/reply-to-boost/register.js";
