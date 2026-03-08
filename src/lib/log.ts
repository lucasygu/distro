import { appendFile, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import type { LogEntry, LogEvent } from "./types.js";

const LOG_FILE = "distribution-log.tsv";
const HEADER = "TIMESTAMP\tEVENT\tDETAIL\tDRIVER\n";

function now(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export async function appendLog(
  campaignDir: string,
  entry: { event: LogEvent; detail: string; driver: string },
): Promise<void> {
  const logPath = join(campaignDir, LOG_FILE);

  try {
    await access(logPath);
  } catch {
    await appendFile(logPath, HEADER);
  }

  const line = `${now()}\t${entry.event}\t${entry.detail}\t${entry.driver}\n`;
  await appendFile(logPath, line);
}

export async function readLog(campaignDir: string): Promise<LogEntry[]> {
  const logPath = join(campaignDir, LOG_FILE);
  try {
    const content = await readFile(logPath, "utf-8");
    const lines = content.trim().split("\n");
    // Skip header
    return lines.slice(1).map((line) => {
      const [timestamp, event, detail, driver] = line.split("\t");
      return {
        timestamp: timestamp ?? "",
        event: (event ?? "MONITOR") as LogEvent,
        detail: detail ?? "",
        driver: driver ?? "",
      };
    });
  } catch {
    return [];
  }
}
