---
name: distro
description: Distribution engine for open-source projects. Supports multiple strategies — reply-to-boost (reply to viral tweets + track stars) and x-post-growth (build followers through authentic engagement). Monitor X, track performance, run loops, and manage the dashboard.
argument-hint: <monitor | check | report | stars | loop | dashboard | draft <url> | discover | register <url> | insight | init>
allowed-tools: Read, Write, Bash, Glob, Grep, AskUserQuestion
---

# Distro — Distribution Engine Skill

Orchestrate distribution via the `distro` CLI. This skill adds LLM intelligence on top of deterministic CLI commands: drafting replies, generating insights, analyzing patterns, and coordinating monitoring loops.

## Setup

The `distro` CLI must be installed globally:
```bash
cd ~/projects/distro && npm run build && npm link
```

Distribution root: `~/projects/content/content-pipeline/distribution`

All commands use: `distro --root ~/projects/content/content-pipeline/distribution --campaign <name>`

## Strategies

Distro supports multiple distribution strategies. Each campaign has one strategy set in `campaign.json`.

| Strategy | Purpose | Loop Commands | Key Metrics |
|----------|---------|---------------|-------------|
| `reply-to-boost` | Reply to viral tweets → drive traffic to your repo | monitor, stars, check | Reply likes, star growth, capture rate |
| `x-post-growth` | Build followers through authentic topic engagement | monitor, check | Follower growth, post likes, topic performance |

The CLI surface is the same for all strategies — commands delegate to the active strategy automatically.

## Campaign Directory Structure

### reply-to-boost
```
<name>/
  campaign.json          — config (queries, repo, handle, replyTactics, playbook)
  reply-ledger.json      — reply tracking with engagement snapshots
  distribution-log.tsv   — event log (REPLY, MILESTONE, STARS, MONITOR, INSIGHT, WARNING)
  .star-history.json     — GitHub star time series
  PLAYBOOK.md            — reply strategy docs
  drafts/                — reply drafts
  reports/               — saved reports
```

### x-post-growth
```
<name>/
  campaign.json          — config (topics, handle, postFrequency)
  post-ledger.json       — post tracking (originals + replies) with snapshots
  distribution-log.tsv   — event log
  .growth-history.json   — follower count time series
  drafts/                — content drafts
  reports/               — saved reports
```

## Commands

### `/distro monitor` — Find opportunities

```bash
distro --root ~/projects/content/content-pipeline/distribution --campaign <name> monitor
```

**reply-to-boost:** Searches configured queries for high-engagement tweets. Categorizes into Reply Zone (50+ likes) and Watch Zone (10-49). Checks which OPs already have our reply.

After monitor runs:
1. If **unreplied REPLY ZONE targets** exist, draft short-anchored replies for each
2. If **no targets**, just say "No new targets"
3. Show targets and drafts for user approval before posting

**x-post-growth:** Searches configured topics for trending posts to engage with authentically. No product links — just build presence and visibility.

After monitor runs:
1. Show engagement opportunities ranked by likes
2. Suggest `/reply-composer` for top candidates
3. Replies should be authentic, no product promotion

### `/distro check` — Engagement snapshots

```bash
distro --root ~/projects/content/content-pipeline/distribution --campaign <name> check
```

**reply-to-boost:** Fetches current likes/RTs on tracked replies. Detects milestone crossings (5L, 10L, 20L, 50L). Skips if last snapshot < 2h old.

**x-post-growth:** Fetches follower count from profile + engagement snapshots on tracked posts. Appends to growth history.

After checking:
- Alert if any post crossed notable thresholds
- Alert if a reply to a 100+ like OP still has 0 likes after 24h (missed opportunity)
- Otherwise: "Engagement check done, no notable changes"

### `/distro stars` — Star tracking (reply-to-boost only)

```bash
distro --root ~/projects/content/content-pipeline/distribution --campaign <name> stars
```

Fetches GitHub stars/forks via `gh api`. Not available for x-post-growth (no repo).

If there's a star spike (+3 or more), check recent reply milestones to correlate.

### `/distro report` — Performance analysis

```bash
distro --root ~/projects/content/content-pipeline/distribution --campaign <name> report
distro --root ~/projects/content/content-pipeline/distribution --campaign <name> report --save
```

**reply-to-boost:** Leaderboard by likes, reply tactic breakdown, correlations (char count, OP age, links), missed opportunities.

**x-post-growth:** Top posts by likes, topic breakdown, post type comparison (originals vs replies), follower growth trajectory.

After the report, generate an insight if any pattern stands out:
```bash
distro --root ~/projects/content/content-pipeline/distribution --campaign <name> insight "the insight text"
```

### `/distro register <url>` — Track a post

```bash
# reply-to-boost: register a reply with strategy tag
distro --root ~/projects/content/content-pipeline/distribution --campaign <name> register <url> --strategy short-anchored

# x-post-growth: register a post with topic tag
distro --root ~/projects/content/content-pipeline/distribution --campaign <name> register <url> --topic ai-tools
```

**reply-to-boost:** Fetches reply + OP, computes OP age, creates initial snapshot in reply-ledger.

**x-post-growth:** Fetches tweet, determines if original/reply, creates entry in post-ledger with topic tag.

### `/distro discover` — Find untracked posts (reply-to-boost)

```bash
distro --root ~/projects/content/content-pipeline/distribution --campaign <name> discover
```

Searches `from:<handle>` via bird, finds replies not yet in the ledger, registers them automatically.

### `/distro draft <url>` — Draft a reply

Given an X post URL, draft reply variations following the campaign's playbook or style.

1. Fetch the post via `bird read <url> --cookie-source chrome --json`
2. Read the campaign config and any playbook
3. Draft variations:
   - **reply-to-boost:** Short-anchored (echo one OP detail → bridge to product, <80 chars, include GitHub link)
   - **x-post-growth:** Authentic engagement (add value to the conversation, no product links)
4. Present for user to choose, copy to clipboard

### `/distro insight <message>` — Log an insight

```bash
distro --root ~/projects/content/content-pipeline/distribution --campaign <name> insight "short replies <80ch outperform by 7x"
```

### `/distro init <name>` — Scaffold a new campaign

```bash
# reply-to-boost (default)
distro --root ~/projects/content/content-pipeline/distribution init my-project --repo lucasygu/my-project --handle lucasgu

# x-post-growth
distro --root ~/projects/content/content-pipeline/distribution init my-brand --handle lucasgu --strategy x-post-growth
```

Creates the full campaign directory with strategy-specific files.

### `/distro dashboard` — Local dashboard

Managed by the dashboard skill. Open via:
```bash
cd ~/.claude/skills/dashboard && bun run dashboard.ts open distro
```

URL: `http://distro.localhost:1355` (via Portless). Shows all campaigns with strategy-appropriate views.

Dashboard monitoring controls: start/stop monitoring loops per campaign via the UI.

### `/distro loop` — Set up automated monitoring

Two options for monitoring loops:

**Option A: Dashboard-managed (recommended)**
Open the dashboard, click "Start Monitoring" per campaign or "Start All". The dashboard runs strategy-appropriate commands on a 10-minute interval.

**Option B: Claude `/loop` (manual)**
```bash
# Monitor all campaigns
distro --root ~/projects/content/content-pipeline/distribution --all monitor

# Engagement check all campaigns
distro --root ~/projects/content/content-pipeline/distribution --all check

# Stars all campaigns (reply-to-boost only)
distro --root ~/projects/content/content-pipeline/distribution --all stars
```

Both can run simultaneously without conflict — commands are idempotent.

## Reply Drafting Rules (reply-to-boost)

Validated from 18 replies across the redbook-cli campaign:

### What works (short-anchored, avg 6.3L):
- Echo one OP detail → bridge to your thing in half a sentence
- Under 80 chars of Chinese text + GitHub link
- Reply to OPs with 100-500 likes (sweet spot)
- Reply fresh (within 6h of OP posting)
- Skip threads with 10+ replies (crowded)

### What doesn't work (0L average):
- `complementary` — "your tool + my tool" framing
- `long-detailed` — 120+ chars reads like an ad
- Replying to OPs with <50 likes
- Replying to stale posts (24h+)

### Example good reply:
```
@huangyun_122 纯文字万赞太猛了。搞了个 cli 专门拉小红书笔记数据分析爆款结构
https://github.com/lucasygu/redbook
```
Result: 22 likes, 10.3% capture rate

## Engagement Rules (x-post-growth)

- NO product links in replies — this is about building authentic presence
- Add genuine value: share experience, ask questions, offer insights
- Match the tone and language of the community
- Focus on topics where you have real expertise
- Track which topics drive the most follower growth

## Multi-Campaign Support

Run across all campaigns with `--all`:
```bash
distro --root ~/projects/content/content-pipeline/distribution --all monitor
distro --root ~/projects/content/content-pipeline/distribution --all check
```

Or target a single campaign with `--campaign`:
```bash
distro --root ~/projects/content/content-pipeline/distribution --campaign ttc-cli monitor
```

## Known Limitations

- **Blocked accounts are invisible.** Bird uses Chrome cookies for X access. If a user blocks you, their posts won't appear in search or read.
- **x-post-growth follower tracking** depends on bird being able to read profile data. May not always return follower count.
