# Al Durr Supplies — Multi-Agent Social Pipeline
## Technical Specification v1

Companion to `AlDurr-Social-Agent-Spec.md` (brand rules, cadence, templates).
This document covers the system that executes it.

---

## 1. Architecture

```
                    ┌─────────────────────┐
                    │    ORCHESTRATOR     │
                    │  state · routing ·  │
                    │   rule enforcement  │
                    └──────────┬──────────┘
                               │
     ┌──────────┬──────────┬───┴────┬──────────┬──────────┐
     ▼          ▼          ▼        ▼          ▼          ▼
  ANALYST  STRATEGIST  COPYWRITER  DESIGNER  COMPLIANCE  PUBLISHER
  metrics    plan       Arabic     Canva      audit &    schedule
  → insight  skeleton   copy       render     reject     posts
                                                  │
                                    ┌─────────────┴──────┐
                                    │   HUMAN APPROVAL   │
                                    │  review → amend →  │
                                    │      approve       │
                                    └────────────────────┘
```

Sequential, not parallel. Each agent's output is the next one's input. Compliance
runs last and can send the whole batch back.

---

## 2. State machine

The orchestrator persists state between runs. This is what makes it an agent
rather than a script.

| State | Trigger to advance | On failure |
|---|---|---|
| `IDLE` | Cron fires Monday 08:00 Baghdad | — |
| `ANALYZING` | Metrics fetched + analyzed | Retry once, then proceed with no-data flag |
| `PLANNING` | Skeleton produced | Halt, notify |
| `WRITING` | 5 posts drafted | Halt, notify |
| `DESIGNING` | 5 assets rendered | Skip failed asset, flag for manual |
| `AUDITING` | Compliance pass | Return to `WRITING` (max 2 loops, then halt) |
| `AWAITING_APPROVAL` | Human approves | Timeout 48h → notify, hold |
| `AMENDED` | Diff computed and logged | — |
| `SCHEDULING` | Posts queued | Halt, notify — never partial-publish |
| `DONE` | Confirmation sent | — |

**Hard rule:** nothing reaches a platform without passing through
`AWAITING_APPROVAL`. No timeout auto-approve. Ever.

---

## 3. Repo structure

```
aldurr-social-agent/
├── config/
│   ├── brand-brief.md           # source of truth, rarely changes
│   ├── agent-spec.md            # cadence, guardrails, templates
│   ├── dialect-lexicon.md       # approved Iraqi terms — grows weekly
│   ├── templates.json           # Canva template IDs + field maps
│   └── .env                     # API keys — never committed
├── agents/
│   ├── orchestrator.js
│   ├── analyst.js
│   ├── strategist.js
│   ├── copywriter.js
│   ├── designer.js
│   ├── compliance.js
│   └── publisher.js
├── state/
│   ├── current-run.json         # active state machine
│   ├── history/                 # every past week, full artifacts
│   └── amendments.jsonl         # your edits — the learning signal
├── output/
│   └── week-YYYY-WW.md          # the file you review and edit
└── index.js
```

---

## 4. Agents

### 4.1 Orchestrator
**Model:** Claude Sonnet 5 · **Runs:** always

Owns the state machine, calls agents in order, handles retries, sends the
approval request, computes the amendment diff. Holds no creative opinion — it
routes and enforces. Keep it boring; creative logic lives in the sub-agents.

---

### 4.2 Analyst
**Model:** Claude Haiku 4.5 · **Input:** last 14 days of Facebook/Instagram
insights (CSV or Graph API) + last week's plan

```
You are a social media analyst for Al Durr Supplies, a B2B medical procurement
platform in Iraq. You receive raw performance data and the content plan that
produced it.

Report only what the data supports. With fewer than 20 posts of history, say so
and treat all differences as provisional. Never claim a pattern from a single
week.

Output JSON:
{
  "sample_size": <posts analyzed>,
  "confidence": "low" | "medium" | "high",
  "top_performers": [{ "post": "", "pillar": "", "metric": "", "why": "" }],
  "underperformers": [{ "post": "", "pillar": "", "likely_cause": "" }],
  "timing": "what posting times performed best, or INSUFFICIENT_DATA",
  "format": "which template/format performed best, or INSUFFICIENT_DATA",
  "hooks": "what opening lines correlated with higher reach",
  "recommendations": ["max 3, each directly traceable to the data"],
  "caveats": ["what this data cannot tell us"]
}
```

The `INSUFFICIENT_DATA` and `caveats` fields matter. Without them the analyst
invents patterns from noise, and the strategist then plans around fiction.

---

### 4.3 Strategist
**Model:** Claude Opus 5 · **Input:** analyst JSON + agent-spec.md + last 4 weeks
of plans (to avoid repetition)

```
You plan one week of social content for Al Durr Supplies.

Follow the fixed cadence in agent-spec.md:
Sunday Problem→Solution · Monday Product Education · Tuesday Trust & Security ·
Wednesday Product Education · Thursday Support & Responsiveness

Never repeat a concept used in the last 4 weeks. Check the supplied history.

Apply the analyst's recommendations only where confidence is medium or high.
On low confidence, hold the cadence steady — do not chase noise.

Goal priority: 1) app installs  2) WhatsApp inquiries  3) awareness

For each of the 5 posts output:
- day, pillar, concept (one sentence)
- the specific approved fact it is built on (from agent-spec.md §4)
- angle: what makes this different from previous posts on this pillar
- CTA type: install | whatsapp | none
- template: 1-4
- rationale: why this post, this week

If any post would need a fact not on the approved list, output NEEDS_FACT with
a description of what is missing.
```

---

### 4.4 Copywriter
**Model:** run a bake-off first (see §5) · **Input:** strategist plan +
dialect-lexicon.md + brand voice section

```
You write Arabic social copy for Al Durr Supplies.

DIALECT: Iraqi Arabic as an educated Baghdad professional writes it — MSA
backbone with natural Iraqi colloquial where it reads warmer. Not Egyptian, not
Levantine, not Gulf. Not formal literary MSA. Use only terms from the supplied
lexicon; if you need a word that is not there, flag it as NEW_TERM so it can be
reviewed before use.

VOICE: direct, practical, serious, speed-specific. Short sentences. Model the
rhythm of "اطلب. تابع. استلم."

ABSOLUTE: no emoji. No pricing. No traction numbers. No iOS claims. No named
competitors. No named suppliers. No team members or founder story. No
testimonials. Only the approved facts list.

For each post:
- hook: first 8 words, must work alone as the truncated preview
- body: 60-120 words Facebook, 30-60 Instagram
- cta: matching the assigned CTA type
- design_brief: headline (max 8 Arabic words), supporting line (max 15),
  which app screenshot if any
- hashtags: 5, Arabic
```

---

### 4.5 Designer
**Model:** none for text · **Input:** design briefs + templates.json

**Non-negotiable:** no image model renders Arabic text. Arabic requires
contextual letter-joining and RTL flow that diffusion models mangle — the output
looks plausible to a non-reader and is nonsense to your customers.

The split:
| Element | Produced by |
|---|---|
| All Arabic text | Canva, real Cairo font, in-template |
| Layout, brand colors, logo | Canva templates |
| Backgrounds, textures, abstract visuals | Optional image model (Nano Banana / DALL·E) |
| App screenshots | Real captures, stored in a fixed asset folder |

Flow: `Canva Connect API → autofill template with Arabic text fields → export PNG
→ store path in run state`. Optionally: image model generates a background,
uploaded to Canva as an asset first, text layered on top there.

Verify every export renders RTL correctly before it reaches you. A silent font
fallback that breaks Arabic joining is the most likely failure in this pipeline.

---

### 4.6 Compliance
**Model:** Claude Haiku 4.5 · **Input:** all copy + design briefs

This agent can only **reject**. It never rewrites — a critic with no authorship
stake catches what the author defends.

```
You audit social content for Al Durr Supplies before human review. You do not
rewrite. You return pass or fail with reasons.

Check every post against all rules. Fail the whole batch if any single item
fails.

1.  Any emoji anywhere?
2.  Any price, commission rate, discount, or fee?
3.  Any user count, order volume, revenue, or growth figure other than
    "1,000+ products" and "24/7 support"?
4.  Any claim or implication that the app is on iOS / the App Store?
5.  Any named team member, founder, or personal story?
6.  Any named competitor company?
7.  Any named supplier or product brand presented as a partner?
8.  Any customer testimonial, quote, review, or case study?
9.  Anything implying data is sold, shared for advertising, or used for ad
    targeting?
10. Any content aimed at individual consumers rather than businesses and
    healthcare professionals, or at anyone under 18?
11. Any third-party logo or trademark in a design brief?
12. Any factual claim not on the approved facts list?

Output: { "verdict": "PASS"|"FAIL", "failures": [{ "post": "", "rule": <n>,
"quote": "", "reason": "" }] }
```

---

### 4.7 Publisher
**Model:** none — deterministic code · **Runs:** only after explicit approval

Facebook Page + Instagram via Graph API (container → publish), or Buffer API if
you skip Meta app review. Schedules at the times in the plan. Never publishes
immediately. Logs post IDs to run history so the analyst can retrieve metrics
next week — this closes the loop.

---

## 5. Model selection

Do not pick on reputation. Run a bake-off before writing any orchestration code:

1. Take one strategist plan
2. Generate all 5 posts with Claude, Gemini, and GPT — identical prompt
3. Strip labels, judge them yourself on dialect authenticity
4. Have a second Iraqi reader judge blind if possible

Suggested assignments, subject to the bake-off:

| Agent | Model | Why |
|---|---|---|
| Orchestrator | Claude Sonnet 5 | Tool use, state handling |
| Analyst | Claude Haiku 4.5 | Structured extraction, cheap |
| Strategist | Claude Opus 5 | Judgment, avoiding repetition |
| Copywriter | **bake-off winner** | Dialect quality is the whole product |
| Compliance | Claude Haiku 4.5 | Deterministic checking, cheap, runs often |

Multi-provider is fine but adds auth, error handling, and rate-limit surface.
Only split providers if the bake-off shows a clear dialect winner that isn't
your orchestrator's provider.

---

## 6. Approval loop

The orchestrator writes `output/week-YYYY-WW.md`:

```markdown
# Week 32 — Draft for review

## Analyst summary
[3 bullets + confidence level]

## Sunday — Problem → Solution
**Hook:** ...
**Copy:**
...
**CTA:** ...
**Design:** [image preview] Template 2
**Why this post:** ...

---
[× 5]

## Compliance: PASS
## Your edits below this line — leave the rest untouched
```

You edit the file directly and reply `approved`. The orchestrator diffs your
version against its own and appends every change to `state/amendments.jsonl`:

```json
{"week":32,"post":"sunday","field":"hook","before":"...","after":"...",
 "type":"dialect|tone|length|fact|structure"}
```

**This log is the point of the whole system.** Every 6–8 weeks, review it:
recurring edits of the same type get folded into the copywriter prompt or the
dialect lexicon. Amendments should trend down. If they don't after three
cycles, the prompt is wrong in a way you haven't named yet — read the log
rather than adding more instructions.

---

## 7. Running cost

| Item | Monthly |
|---|---|
| Claude API (all agents, 4 runs) | $3–10 |
| Canva | $0 — Edu subscription |
| Image model (optional, backgrounds only) | $0–5 |
| Publishing | $0 via Graph API, ~$12 via Buffer |
| **Total** | **$5–25** |

Token cost is dominated by the strategist reading 4 weeks of history. Cache the
brand brief and agent spec — they never change between runs.

---

## 8. Build order

Do not build all seven agents first. Each phase is usable on its own.

| Phase | Build | You get |
|---|---|---|
| **0** | Nothing — run it manually in Cowork for 4 weeks | Proven prompts, real amendment data, a working lexicon |
| **1** | Copywriter + Compliance, run by hand | The two hardest agents validated cheaply |
| **2** | + Strategist + Designer, output the review file | Full draft generation, manual scheduling |
| **3** | + Orchestrator + state machine + cron | Automatic Monday runs, you just approve |
| **4** | + Analyst + Publisher | The closed loop |

Phase 0 is not a warm-up. It produces the lexicon and amendment log that every
later phase depends on, and it costs nothing to change your mind during.

---

## 9. Known risks

| Risk | Mitigation |
|---|---|
| Arabic renders broken in exported designs | Visual check every export in phase 1–2; never trust a silent font fallback |
| Dialect drifts toward MSA or another dialect over time | Lexicon file + spot-check monthly |
| Analyst finds patterns in noise | Confidence gating; ignore low-confidence recommendations |
| Compliance passes something it shouldn't | You are the final gate — it never publishes without you |
| Meta app review rejection | Use Buffer as fallback publishing layer |
| Concepts repeat and the feed goes stale | 4-week lookback in strategist; expand pillars as real facts arrive |

The largest risk is not technical. It is building all of this before confirming
that your buyers respond to social content at all. Phase 0 answers that for the
cost of four Monday mornings.
