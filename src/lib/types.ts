// Data contract — types for all campaign data files.
// JSON files use snake_case to match existing data format.

// === campaign.json ===

export type CampaignConfig = {
  name: string;
  repo: string;
  handle: string;
  language: string;
  queries: string[];
  minLikes: number;
  crowdedThreshold: number;
  strategies: string[];
  deadStrategies: string[];
  githubLink: string;
  since: string;
  platform?: string;
  playbook?: string; // filename of strategy doc (e.g., "PLAYBOOK.md")
};

// === reply-ledger.json ===

export type Snapshot = {
  ts: string;
  age_hours: number;
  our_likes: number;
  our_rts: number;
  our_replies: number;
  op_likes: number;
  op_rts: number;
  op_replies: number;
};

export type Reply = {
  id: string;
  op_id: string;
  op_author: string;
  op_text: string;
  our_text: string;
  posted_at: string;
  strategy: string;
  char_count: number;
  has_link: boolean;
  op_age_hours: number;
  backfilled: boolean;
  op_at_reply: {
    likes: number;
    retweets: number;
    replies: number;
  };
  snapshots: Snapshot[];
};

export type ReplyLedger = {
  version: number;
  campaign: string;
  our_handle: string;
  replies: Reply[];
};

// === distribution-log.tsv ===

export type LogEvent =
  | "REPLY"
  | "MILESTONE"
  | "STARS"
  | "MONITOR"
  | "INSIGHT"
  | "WARNING";

export type LogEntry = {
  timestamp: string;
  event: LogEvent;
  detail: string;
  driver: string;
};

// === .star-history.json ===

export type StarSnapshot = {
  ts: string;
  stars: number;
  forks: number;
};

// === .loops.json (written by skill) ===

export type LoopStatus = {
  name: string;
  schedule: string;
  started_at: string;
  session_id?: string;
};

// === bird CLI output types ===

export type BirdTweet = {
  id: string;
  text: string;
  author: {
    username: string;
    name: string;
  };
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  createdAt: string;
  inReplyToStatusId?: string;
};

export type BirdResult<T = BirdTweet[]> =
  | { ok: true; data: T }
  | { ok: false; data: null; error: string };

// === distro root config (~/.distrorc) ===

export type DistroConfig = {
  root: string;
};
