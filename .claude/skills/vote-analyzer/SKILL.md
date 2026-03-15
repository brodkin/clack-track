---
name: vote-analyzer
description: Analyze recent content votes from production to identify fan-favorite generators and diagnose underperforming prompts. Use when the user wants to review content quality, analyze voting patterns, or improve generator prompts based on audience feedback.
---

# Vote Analyzer

Analyze production vote data to identify high-performing generators and diagnose systemic issues in low-performing ones through pattern analysis across their full body of work.

## Step 1: Fetch Vote Data

Run the bundled fetch script to pull vote data from the production database. The argument is number of days to look back (default: 60).

```bash
${CLAUDE_SKILL_DIR}/scripts/fetch-votes.sh $ARGUMENTS
```

**If the script fails:**

- Verify `.env.production` exists at the project root
- Check that `DOCKER_HOST` is reachable (`set -a; source .env.production; set +a && docker info`)
- Ensure the `clack-track_clack-network` Docker network exists

The output contains two TSV result sets separated by `---SEPARATOR---`:

1. **Voted content** — individual vote records joined with content details and `metadata_json`
2. **Generator aggregates** — per-generator totals including unvoted content counts

Save both for analysis. If the result set is empty, inform the user that no votes were found in the specified period and stop.

## Step 2: Build Generator Profiles

For each `generator_id` in the aggregate data, build a profile:

- **Total generations** in period (from result set 2)
- **Vote coverage** — what percentage of this generator's content was voted on at all
- **Upvotes / Downvotes / Approval rate**
- **Average validation attempts** — high averages suggest the prompt struggles with display constraints

From result set 1, collect for each generator:

- All **content text** samples (upvoted and downvoted separately)
- All **metadata_json** values — parse these to extract dictionary/dimension selections (e.g. `style`, `theme`, `subject`, `topic`, `approach`, `category`, `mood`, `vibe`)
- All **vote_reason** values from downvotes

**IMPORTANT**: With only 1-2 active users, most individual content pieces will have at most one vote. Do NOT treat individual votes as statistically significant. Instead, look for **patterns across the generator's full output body**.

## Step 3: Pattern Analysis (The Core of This Skill)

For each generator with downvotes, perform the following pattern analyses. These are the lenses through which you should examine the data — not all will apply to every generator, but check each one.

### Pattern 1: Metadata Concentration

Parse `metadata_json` for every generation (voted and context from aggregates). Look for:

- **Overrepresented values** — Is one dictionary value appearing far more than expected? If a generator has 20 themes but "penguins" shows up in 30% of downvoted content, the dictionary may be unbalanced or that value may be a poor fit.
- **Underrepresented namespaces** — If a dictionary category has only 3 values while others have 15+, random selection will oversample those 3. This causes repetition even when the generator "looks" varied.
- **Correlation between metadata and downvotes** — Do downvotes cluster around specific dictionary values (e.g., a specific `style` or `category`)? That value may be producing weak content.

### Pattern 2: Textual Repetition

Across ALL content samples for the generator (not just voted ones — use the content text from result set 1):

- **Structural templates** — Does the generator keep producing the same sentence structure? (e.g., always "DID YOU KNOW..." or always ending with a punchline question)
- **Vocabulary convergence** — Are the same unusual words or phrases appearing across multiple outputs?
- **Opening/closing formulas** — Does every output start or end the same way?

This often indicates the prompt is too prescriptive about format or the variability sources are insufficient.

### Pattern 3: Failure Mode Clustering

Classify each downvoted piece using these failure modes, then look for which modes dominate:

| Failure Mode         | Signal                                            | Root Cause                                                                 |
| -------------------- | ------------------------------------------------- | -------------------------------------------------------------------------- |
| **Repetitive**       | Multiple outputs feel interchangeable             | Insufficient variability injection; dictionary too small; prompt too rigid |
| **Off-tone**         | Doesn't match Houseboy persona or expected humor  | Prompt doesn't reinforce voice; model tier mismatch                        |
| **Too generic**      | Lacks specificity, surprise, or edge              | Prompt asks for open-ended creativity without constraints                  |
| **Format violation** | Truncated text, wasted space, awkward line breaks | Prompt doesn't emphasize display constraints; high validation attempts     |
| **Cringe/unfunny**   | Attempts humor that falls flat                    | Dictionary values that don't pair well; forced joke structure              |
| **Confusing**        | Content doesn't make sense without context        | Generator assumes context the viewer doesn't have                          |
| **Topic exhaustion** | Dictionary value is inherently limiting           | Certain subjects don't have enough comedic surface area                    |

If one failure mode dominates, the fix is likely systemic (prompt or architecture). If failures are scattered, the generator may just need larger/better dictionaries.

### Pattern 4: Model Tier Mismatch

Check the `model_tier` and `ai_model` fields:

- Generators using LIGHT tier that produce low-quality nuanced content may need MEDIUM
- Generators using MEDIUM tier for simple output may be wasting capacity
- If `ai_provider` varies (failover), check if quality drops with the alternate provider

### Pattern 5: Validation Struggle

If `avg_validation_attempts` is high (>1.5) for a generator:

- The prompt may be producing content that consistently violates display constraints
- Cross-reference with format violation failures
- The prompt may need explicit character/line count reminders or shorter-form instructions

### Pattern 6: Upvote Signals (What Works)

For generators with upvotes, identify what the good content has in common:

- Which metadata values correlate with upvotes?
- What structural patterns appear in liked content?
- Is there a "sweet spot" in content length or density?

These positive patterns should inform the improvement recommendations — amplify what works.

## Step 4: Read Relevant Prompts

For each low-performing generator, read the actual prompt files to connect the analysis to specific prompt instructions:

```bash
${CLAUDE_SKILL_DIR}/scripts/fetch-prompts.sh <generator-id>
```

Also read the system prompt once for context:

```bash
cat prompts/system/major-update-base.txt
```

For generators with dictionary/dimension issues, also read the generator's TypeScript source to examine the dictionary arrays:

```bash
# Generator source files follow this pattern
ls src/content/generators/ai/<generator-id>-generator.ts
```

Look for the dictionary arrays (e.g., `TOPICS`, `STYLES`, `THEMES`, `SUBJECTS`) and their sizes.

## Step 5: Present Results

### High Performers Table

Brief summary of generators that are working well:

```
| Generator | Approval | Up/Down | Generations | What's Working |
|-----------|----------|---------|-------------|----------------|
```

1-2 sentences per generator noting the pattern that makes them effective. Reference specific metadata values that correlate with upvotes if applicable.

### Low Performers — Deep Analysis

For each underperforming generator, present a structured analysis block:

```
### [Generator Name] (generator-id)
**Approval: X% | Votes: Y up / Z down | Generations: N | Avg Validation: X.X**

#### Pattern Analysis
[Which of the 6 patterns above were detected, with specific evidence from the data.
Reference actual content samples, metadata values, and vote reasons.]

#### Root Cause
[The specific prompt instructions, dictionary gaps, or architectural issues causing the patterns.
Reference exact lines/sections of the prompt or dictionary arrays.]

#### Recommended Changes
[Concrete, actionable fixes ordered by expected impact:
1. Dictionary changes (add/remove/rebalance values)
2. Prompt wording changes (with before/after)
3. Architecture changes (model tier, format options)
Include the reasoning for each recommendation.]
```

### Insufficient Data

List generators with <2 total votes as "insufficient data — no conclusions drawn."

## Step 6: Prompt Improvement Workflow

After presenting all analysis, ask the user:

> Would you like me to implement any of these prompt improvements? I'll use `/content-generator-designer` for each generator update to ensure changes follow the project's content design standards.

If the user agrees, invoke `/content-generator-designer` for each generator they want to update. Pass the specific diagnosis, pattern evidence, and recommended changes as context to that skill. Do NOT edit prompt files or generator source directly — the content-generator-designer skill has the domain knowledge for Vestaboard content constraints, tone guidelines, and quality validation.

## Important Notes

- **Read-only by default** — this skill only reads prod data and local files. It modifies nothing unless the user explicitly requests updates in Step 6.
- **Patterns over individual votes** — with 1-2 users, individual votes are anecdotal. The power is in aggregate patterns across a generator's full output body.
- **Vote reasons are gold** — the `vote_reason` field contains user-written explanations. Weight these heavily but look for themes across multiple reasons, not single complaints.
- **Metadata is the diagnostic key** — the `metadata_json` column reveals which dictionary values were in play for each generation. This connects output quality back to specific variability inputs.
- **Context matters** — content is displayed on a 6x22 character Vestaboard. What looks fine as text may look wrong on the physical display.
- **Minor updates and failed content are excluded** — the query only pulls successful major updates.
