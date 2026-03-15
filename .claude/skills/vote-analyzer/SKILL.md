---
name: vote-analyzer
description: Analyze production vote data to identify underperforming generators and recommend prompt fixes.
---

# Vote Analyzer

Analyze production vote data to surface the top 3 highest-priority generator improvements backed by clear evidence from voting patterns and metadata.

## Step 1: Fetch Vote Data

```bash
${CLAUDE_SKILL_DIR}/scripts/fetch-votes.sh $ARGUMENTS
```

Default lookback is 60 days. Pass a number to override (e.g., `/vote-analyzer 90`).

The output contains two TSV result sets separated by `---SEPARATOR---`:

1. **Voted content** — individual votes joined with content details and `metadata_selections` JSON
2. **Generator aggregates** — per-generator totals including unvoted content counts

If empty, tell the user no votes were found and stop.

## Step 2: Build Generator Profiles

For each `generator_id`, compute:

- Total generations, vote coverage, upvotes, downvotes, approval rate
- Average validation attempts (high = prompt fights display constraints)

From result set 1, collect per generator:

- Content text samples (upvoted vs downvoted)
- Parsed `metadata_selections` — extract dictionary values (`style`, `theme`, `subject`, `topic`, `approach`, `category`, vibes, and similar keys present in the data)
- `vote_reason` values from downvotes (user-written — treat as ground truth)

**With only 1-2 active users, individual votes are anecdotal. Look for patterns across a generator's full output body, not individual verdicts.**

## Step 3: Pattern Analysis

For each generator with downvotes, check these diagnostic lenses. These are analysis tools, not an output checklist — only carry forward patterns backed by 2+ data points.

- **Metadata Concentration** — Downvotes cluster on specific dictionary values? Namespace underpopulated (3 values vs 15+)?
- **Textual Repetition** — Same structures/vocabulary/formulas across outputs? Prompt too prescriptive or insufficient variability sources.
- **Failure Mode Clustering** — Classify downvotes: repetitive, off-tone, generic, format violation, cringe, confusing, topic exhaustion. One dominant mode = systemic fix. Scattered = better dictionaries.
- **Model Tier Mismatch** — LIGHT tier producing low-quality nuanced content? Quality drops on failover?
- **Validation Struggle** — `avg_validation_attempts` > 1.5 = prompt fights display constraints.
- **Upvote Signals** — Which metadata values correlate with liked content? Amplify what works.

If no generator shows a clear pattern, skip to Step 5 and report no actionable issues.

## Step 4: Check Change History

Before recommending a fix, check whether the generator was already updated since the downvoted content was produced:

```bash
${CLAUDE_SKILL_DIR}/scripts/fetch-generator-history.sh <generator-id>
```

This shows recent commits to the generator's prompt, source, and system prompt with diffs.

**Compare the dates**: If the generator's prompt or source was modified AFTER the most recent downvoted content was generated, the issue may already be fixed. In that case:

- Read the diff to understand what changed
- If the change directly addresses the pattern you found, **drop the recommendation** — note it as "likely already fixed" in your output instead
- If the change is unrelated to the pattern, proceed with the recommendation

This prevents recommending fixes that have already shipped.

## Step 5: Read Relevant Prompts

For generators you'll still recommend changes to, read:

```bash
${CLAUDE_SKILL_DIR}/scripts/fetch-prompts.sh <generator-id>
cat prompts/system/major-update-base.txt
```

For dictionary issues, read the generator source to examine array sizes:

```bash
# Generator sources follow: src/content/generators/ai/<generator-id>-generator.ts
```

## Step 6: Present Results

### Output Rules

- **Maximum 3 recommendations total** — only the highest-impact, best-evidenced issues.
- **Skip generators where the evidence is weak** — a single downvote with no discernible pattern is not actionable.
- **Be terse** — the user ran this skill to get answers, not a research paper.

### High Performers (brief)

One table, no prose per generator:

```
| Generator | Approval | Up/Down | Gens |
|-----------|----------|---------|------|
```

### Top 3 Issues

For each (up to 3), present one compact block:

```
### 1. [Generator Name] — [One-line problem summary]
**Evidence**: [1-2 sentences with specific counts or metadata values. At most one content sample.]
**Root cause**: [Which prompt instruction or dictionary gap causes this]
**Fix**: [One concrete, actionable change]
**Status**: [OPEN — still present in current code | LIKELY FIXED — prompt/source updated on <date>, change addresses this pattern]
```

Only surface patterns that produced findings. Issues marked LIKELY FIXED are informational — don't count toward the 3-recommendation cap.

### Insufficient Data

One line listing generators with <2 total votes. No analysis.

## Step 7: Act on Findings

Ask the user:

> Want me to implement any of these fixes? I'll use `/content-generator-designer` to ensure changes follow content design standards.

If yes, invoke `/content-generator-designer` per generator. Pass the specific evidence and recommended fix. Do NOT edit prompts or generator source directly.

## Constraints

- **Read-only** — modifies nothing unless the user requests changes in Step 6.
- **Metadata is the diagnostic key** — `metadata_selections` reveals which dictionary values were in play. This connects output quality back to variability inputs.
- **Vote reasons outrank your interpretation** — if the user wrote a reason, that's the ground truth.
- **3 recommendations max** — if fewer than 3 issues have strong evidence, present fewer. Never pad.
