import { Hono } from "hono";
import { serve } from "@hono/node-server";
import {
  discoverCampaigns,
  loadCampaign,
  loadLedger,
  loadStarHistory,
} from "../lib/data.js";
import { readLog } from "../lib/log.js";
import {
  startLoop,
  stopLoop,
  getLoopStatus,
  getAllLoopStatuses,
} from "../lib/monitor-loop.js";
import { CampaignView } from "../views/campaign.js";
import { HomeView } from "../views/home.js";

export async function dashboardCommand(root: string): Promise<void> {
  const port = parseInt(process.env.PORT || "3000");
  const app = new Hono();

  // Home — list all campaigns
  app.get("/", async (c) => {
    const campaigns = await discoverCampaigns(root);
    const summaries = await Promise.all(
      campaigns.map(async (camp) => ({
        name: camp.name,
        config: camp.config,
        ledger: await loadLedger(camp.dir),
        starHistory: await loadStarHistory(camp.dir),
        logEntries: await readLog(camp.dir),
      })),
    );
    return c.html(
      (<HomeView campaigns={summaries} loopStatuses={getAllLoopStatuses()} />) as any,
    );
  });

  // Campaign detail
  app.get("/campaign/:name", async (c) => {
    const name = c.req.param("name");
    const campaigns = await discoverCampaigns(root);
    const campaign = campaigns.find((camp) => camp.name === name);

    if (!campaign) {
      return c.text(`Campaign not found: ${name}`, 404);
    }

    const [ledger, starHistory, logEntries] = await Promise.all([
      loadLedger(campaign.dir),
      loadStarHistory(campaign.dir),
      readLog(campaign.dir),
    ]);

    const campaignList = campaigns.map((camp) => ({
      name: camp.name,
      active: camp.name === name,
    }));

    return c.html(
      (
        <CampaignView
          config={campaign.config}
          ledger={ledger}
          starHistory={starHistory}
          logEntries={logEntries}
          campaigns={campaignList}
          loopStatus={getLoopStatus(name)}
        />
      ) as any,
    );
  });

  // API endpoints (for future use / AJAX refresh)
  app.get("/api/campaigns", async (c) => {
    const campaigns = await discoverCampaigns(root);
    return c.json(campaigns.map((camp) => camp.config));
  });

  app.get("/api/campaign/:name/ledger", async (c) => {
    const name = c.req.param("name");
    const campaigns = await discoverCampaigns(root);
    const campaign = campaigns.find((camp) => camp.name === name);
    if (!campaign) return c.json({ error: "not found" }, 404);
    const ledger = await loadLedger(campaign.dir);
    return c.json(ledger);
  });

  app.get("/api/campaign/:name/stars", async (c) => {
    const name = c.req.param("name");
    const campaigns = await discoverCampaigns(root);
    const campaign = campaigns.find((camp) => camp.name === name);
    if (!campaign) return c.json({ error: "not found" }, 404);
    const history = await loadStarHistory(campaign.dir);
    return c.json(history);
  });

  app.get("/api/campaign/:name/log", async (c) => {
    const name = c.req.param("name");
    const campaigns = await discoverCampaigns(root);
    const campaign = campaigns.find((camp) => camp.name === name);
    if (!campaign) return c.json({ error: "not found" }, 404);
    const entries = await readLog(campaign.dir);
    return c.json(entries);
  });

  // Monitor control API
  app.post("/api/campaign/:name/monitor/start", async (c) => {
    const name = c.req.param("name");
    const campaigns = await discoverCampaigns(root);
    const campaign = campaigns.find((camp) => camp.name === name);
    if (!campaign) return c.json({ ok: false, reason: "not found" }, 404);
    const intervalMin = parseInt(c.req.query("interval") || "10");
    const result = startLoop(name, campaign.dir, root, intervalMin * 60 * 1000);
    return c.json({ ok: result.started, reason: result.reason });
  });

  app.post("/api/campaign/:name/monitor/stop", async (c) => {
    const name = c.req.param("name");
    const stopped = stopLoop(name);
    return c.json({ ok: stopped, reason: stopped ? undefined : "not running" });
  });

  app.post("/api/monitor/start-all", async (c) => {
    const campaigns = await discoverCampaigns(root);
    const intervalMin = parseInt(c.req.query("interval") || "10");
    const results: Record<string, boolean> = {};
    for (const camp of campaigns) {
      const r = startLoop(camp.name, camp.dir, root, intervalMin * 60 * 1000);
      results[camp.name] = r.started;
    }
    return c.json({ ok: true, results });
  });

  app.post("/api/monitor/stop-all", async (c) => {
    const campaigns = await discoverCampaigns(root);
    for (const camp of campaigns) {
      stopLoop(camp.name);
    }
    return c.json({ ok: true });
  });

  app.get("/api/monitor/status", async (c) => {
    return c.json(getAllLoopStatuses());
  });

  console.log(`Distro Dashboard running on port ${port}`);
  console.log(`Root: ${root}`);
  const campaigns = await discoverCampaigns(root);
  console.log(
    `Campaigns: ${campaigns.map((c) => c.name).join(", ") || "(none found)"}`,
  );
  console.log();

  serve({ fetch: app.fetch, port });
}
