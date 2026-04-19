---
name: vote-analyzer
description: Analyze production vote data to identify underperforming generators and recommend prompt fixes.
---

# Vote Analyzer

Surface up to 3 high-impact generator fixes, each backed by user-written reasons, metadata diversity, or body-of-work patterns. Present as a single glanceable report.

## Step 1: Fetch Data

```bash
${CLAUDE_SKILL_DIR}/scripts/fetch-votes.sh $ARGUMENTS
```

Default: 60-day window, 15 samples per generator. Override: `/vote-analyzer 90 20`.

Four TSV result sets, separated by `---SEPARATOR---`:

1. **Voted content** — verdicts joined with content + `metadata_selections`
2. **Aggregates** — per-generator totals, including `downvotes_on_failover` / `failover_generations`
3. **Samples** — up to N most-recent content rows per generator, voted or not. This is the body-of-work view; pattern analysis runs on this, not on the votes alone.
4. **Reasons** — downvotes with non-empty user-written reasons, newest first. Ground truth.

If all four sets are empty, tell the user nothing was found and stop.

## Step 2: Build the Numbers

From set 2:

- `approval = upvotes / (upvotes + downvotes)` per generator
- `median_approval` across generators that have ≥2 votes
- `failover_rate = downvotes_on_failover / downvotes`

From set 3 (samples):

- For each generator, parse `metadata_selections` JSON. Count distinct values per top-level key (`topic`, `theme`, `style`, `subject`, `angle`, `vibe`, etc. — whatever the generator emits).
- First-token frequency: tally the opening word/phrase of each output.
- Exact-duplicate detection across the sample.

From set 4:

- Group verbatim reasons by generator_id.

## Step 3: Diagnose

Apply lenses in order. A generator is a fix candidate only if **≥2 lenses hit**.

1. **User reasons (set 4)** — what did users literally say? These outrank everything below.
2. **Metadata concentration (set 3 vs generator source)** — distinct values used ÷ dictionary size from the TS source. Below 40% over 10+ gens → collapsed pool.
3. **Textual repetition (set 3)** — same opener in >30% of samples, or any exact duplicates → over-prescriptive prompt or undersized dictionary.
4. **Failover correlation (set 2)** — `failover_rate > 40%` → the alt provider is the bug, not the prompt.
5. **Validation struggle (set 2)** — `avg_validation_attempts > 1.5` → prompt fights display constraints.
6. **Tier mismatch** — LIGHT tier producing nuanced content that consistently gets downvoted.

If no generator hits ≥2 lenses, skip to Step 6 and report no actionable issues.

## Step 4: Prioritize

For each candidate:

```
priority = downvotes + |approval − median| × voted_generations
```

Rank descending. Take the top 3. If fewer have ≥2 lenses hitting, present fewer. **Never pad.**

## Step 5: Verify & Read Prompts

For each of the top 3, run in parallel:

```bash
${CLAUDE_SKILL_DIR}/scripts/fetch-generator-history.sh <generator-id>
${CLAUDE_SKILL_DIR}/scripts/fetch-prompts.sh <generator-id>
```

`fetch-prompts.sh` returns user prompt, system prompt, generator source, dictionaries file (if any), and the `register-core.ts` block — everything needed to compute dict coverage and write a fix.

If the prompt or source was modified **after** the most recent downvoted content in the evidence, read the diff. If the change directly addresses the pattern, mark the fix `LIKELY FIXED` with the date and drop it from the 3-cap (informational only).

## Step 6: Present Results

Use exactly this format. No emoji, no bold for decoration, no raw priority scores, no "status: OPEN".

```
VOTE ANALYZER · <Nd> · <V> votes (<U>↑ <D>↓) · median <M>%


REASONS

  "<verbatim reason>"
      <generator-id> · <MM-DD>

  (up to 5 reasons, newest first. Omit this block entirely if set 4 is empty.)


HEALTH

  <glyph> <generator-id>   <bar> <pct>%    <N> gens    <dict hint>

  glyph: ▲ if approval > median+10pp, ▼ if < median−10pp, ─ otherwise
  bar: 10 chars, filled = round(pct/10), use █ and ░
  show: every generator below median, plus top 2 above
  dict hint: "<used>/<total> <key>" for the most-concentrated key; omit if even


<N> · <generator-id> — <one-line problem>

      (optional histogram when the evidence is distributional)
      <value>   <bar>  <count>
      ...                     <used> of <total> <key> used

  "<user reason if any>"

  <root cause in one sentence>
  Fix: <single concrete action>
  <file:line>


(repeat up to 3 times. For LIKELY FIXED add a line:
  already fixed on <YYYY-MM-DD>: <brief>
and do not count against the cap.)


no data: <gen> · <gen> · <gen>   (0 votes AND <5 gens in window)

ship 1 · 2 · 3 · or 1,3 →
```

**Output discipline**

- One fewer fix is better than three padded ones.
- Omit the REASONS block when there are no user-written reasons.
- `no data:` line goes away if every generator has ≥5 gens or ≥1 vote.

## Step 7: Act

Wait for the user's reply (`1`, `1,3`, `all`, `none`). For each selected fix, invoke `/content-generator-designer` with:

- generator id
- the evidence block (counts, verbatim reason, dict-coverage numbers)
- the recommended fix

Do NOT edit prompts or generator source directly from this skill.

## Constraints

- Read-only until the user ships.
- User reasons (set 4) outrank interpretation.
- 3 fixes max; fewer is fine.
- Pattern across the body of work beats a single-vote anecdote.
