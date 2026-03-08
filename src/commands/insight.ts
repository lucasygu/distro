import { appendLog } from "../lib/log.js";

export async function insightCommand(
  campaignDir: string,
  message: string,
): Promise<void> {
  await appendLog(campaignDir, {
    event: "INSIGHT",
    detail: message,
    driver: "",
  });
  console.log(`Logged insight: ${message}`);
}
