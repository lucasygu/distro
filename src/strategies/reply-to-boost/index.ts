import type { Strategy } from "../types.js";
import { replyToBoostMonitor } from "./monitor.js";
import { replyToBoostRegister } from "./register.js";
import { replyToBoostDiscover } from "./discover.js";
import { replyToBoostCheck } from "./check.js";
import { replyToBoostReport } from "./report.js";

export const replyToBoostStrategy: Strategy = {
  type: "reply-to-boost",
  displayName: "Reply to Boost",

  monitor: replyToBoostMonitor,
  register: replyToBoostRegister,
  discover: replyToBoostDiscover,
  check: replyToBoostCheck,
  report: replyToBoostReport,
  loopCommands: () => ["monitor", "stars", "check"],
};
