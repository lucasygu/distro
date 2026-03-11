// Strategy abstraction — each distribution strategy implements this interface.
// Commands delegate to the active strategy; the CLI surface stays the same.

export type StrategyType = "reply-to-boost" | "audience-growth";

export interface Strategy {
  readonly type: StrategyType;
  readonly displayName: string;

  /** Monitor environment for opportunities */
  monitor?(campaignDir: string, opts: Record<string, any>): Promise<void>;

  /** Register a tracked action (reply, post, etc.) */
  register?(
    campaignDir: string,
    urlOrId: string,
    opts: Record<string, any>,
  ): Promise<void>;

  /** Discover untracked actions retroactively */
  discover?(campaignDir: string): Promise<void>;

  /** Snapshot current metrics on tracked actions */
  check?(campaignDir: string, opts: Record<string, any>): Promise<void>;

  /** Generate a performance report */
  report?(campaignDir: string, opts: Record<string, any>): Promise<void>;

  /** Initialize strategy-specific files for a new campaign */
  initFiles?(campaignDir: string): Promise<void>;

  /** Commands to run in a monitoring loop cycle */
  loopCommands?(): string[];
}
