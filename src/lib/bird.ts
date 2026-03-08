import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import type { BirdResult, BirdTweet } from "./types.js";
import { appendLog } from "./log.js";

const execFile = promisify(execFileCb);

/**
 * Call the bird CLI and parse JSON output.
 * On failure: logs a WARNING event, returns { ok: false }.
 */
export async function callBird(
  args: string[],
  campaignDir: string,
): Promise<BirdResult> {
  try {
    const { stdout } = await execFile(
      "bird",
      [...args, "--cookie-source", "chrome", "--json"],
      { maxBuffer: 10 * 1024 * 1024 },
    );
    const data = JSON.parse(stdout);
    const tweets: BirdTweet[] = Array.isArray(data) ? data : [data];
    return { ok: true, data: tweets };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await appendLog(campaignDir, {
      event: "WARNING",
      detail: `bird ${args[0]} failed: ${message.slice(0, 200)}`,
      driver: "",
    });
    return { ok: false, data: null, error: message };
  }
}
