# Al Durr Social Agent — Phase 3

Full design lives in [`docs/AlDurrAgentArchitecture.md`](docs/AlDurrAgentArchitecture.md)
and [`docs/AlDurrSocialAgentSpec.md`](docs/AlDurrSocialAgentSpec.md). This repo
implements through **Phase 3** of the build order (architecture doc §8): the
Orchestrator and state machine on top of Strategist, Copywriter, Compliance,
and Designer. Cron fires it weekly; you just approve. No Analyst, no
Publisher yet — see "What's not built yet" below.

Compliance can only reject — it never rewrites copy. Nothing reaches a
platform without passing through human approval. No timeout auto-approve.
Ever.

## Setup

```
npm install
cp .env.example .env   # fill in ANTHROPIC_API_KEY, optionally CANVA_ACCESS_TOKEN
```

## The weekly cycle

```
node index.js run
```

This is the orchestrator. It walks the state machine end to end — Analyzing
(no-op; no analyst agent yet) → Planning → Writing → Designing → Auditing →
**Awaiting Approval** — persisting progress to `state/current-run.json` at
every step, and halting with a loud `NOTIFY:` message if anything fails.

- If Compliance fails, it loops back to Writing automatically (feeding the
  specific failures back to the copywriter so it doesn't repeat them), up to
  2 times, then halts for a human to look at `output/week-<id>-audit.json`.
- It refuses to start a new week while a previous one is still
  `AWAITING_APPROVAL` or `AMENDED` — you have to resolve that one first. This
  is the hard rule from the architecture doc, enforced in code, not just
  policy.

Once it halts at `AWAITING_APPROVAL`, open `output/week-<id>.md` in any text
editor, read it, edit anything you want changed, then run:

```
node index.js approve <id>
```

This diffs your edited file against what the orchestrator originally
generated, classifies each change (dialect / tone / length / fact /
structure) using Claude Haiku, and appends every one to
`state/amendments.jsonl` — **this log is the point of the whole system**.
Every 6-8 weeks, read it: recurring edits of the same type should get folded
into the copywriter prompt or the dialect lexicon.

Approving also saves that week's plan into `state/history/` so the next
run's strategist won't repeat its concepts, and moves the state machine to
`SCHEDULING_HALTED` — publishing itself isn't built yet (Phase 4), so
nothing gets auto-posted. You post the approved content by hand for now.

Pass `--week 2026-33` to target a specific week, or `--analyst
path/to/analyst.json` once an analyst agent exists (Phase 4).

## Scheduling it (cron)

The orchestrator is invoked, not a daemon — point an external scheduler at
`node index.js run` for **Monday 08:00 Baghdad (UTC+3, no DST)**, i.e.
**05:00 UTC**:

**Linux/macOS cron** (`crontab -e`):
```
0 5 * * 1 cd /path/to/aldurr-social-agent && /usr/bin/node index.js run >> logs/run.log 2>&1
```

**Windows Task Scheduler**: create a task triggered weekly on Monday at
05:00 UTC (convert to your local time zone in the scheduler UI), action
"Start a program": `node.exe` with argument `index.js` `run` and "Start in"
set to the repo folder.

## Run agents individually (unchanged from earlier phases)

```
node agents/strategist.js --week 2026-33          # -> output/week-2026-33-plan.json
node agents/copywriter.js output/week-2026-33-plan.json output/week-2026-33-copy.json
node agents/compliance.js output/week-2026-33-copy.json output/week-2026-33-audit.json
node agents/designer.js output/week-2026-33-copy.json output/week-2026-33-designs.json
node scripts/build-review.js 2026-33
```

Phase 2's chained-but-stateless flow (`node scripts/draft-week-full.js`) and
Phase 1's hand-written-plan flow (`node scripts/draft-week.js
input/sample-plan.json`) both still work — neither touches
`state/current-run.json`, so they're safe to use for one-off testing without
the orchestrator's unresolved-run guard getting in the way.

## Designer and Canva

The designer never generates text or images itself — Arabic requires
contextual letter-joining that diffusion models mangle, so all Arabic text
is set by Canva's autofill API into a real Cairo-font template. This means:

- The 4 templates in `config/agent-spec.md`'s Canva templates table must
  exist in your Canva account first. Brand-template autofill requires a
  Canva Pro/Teams/Enterprise plan.
- Fill each template's real ID and field names into `config/templates.json`
  once built (`REPLACE_WITH_CANVA_TEMPLATE_ID` placeholders are there now).
- Without a real template ID or `CANVA_ACCESS_TOKEN`, the designer skips
  that post's asset and records why in `output/week-<id>-designs.json` —
  per the architecture doc's own failure handling: skip and flag for
  manual, never halt the batch.
- App screenshots go in `assets/screenshots/`; reference the filename in a
  post's `design_brief.screenshot`.

## Config

- `config/brand-brief.md` — audience, voice, hard rules, approved facts.
  Source of truth; rarely changes.
- `config/agent-spec.md` — platform priority, weekly cadence, Canva template
  reference.
- `config/dialect-lexicon.md` — approved Iraqi colloquial terms. Currently
  seeded from the one sample post in the spec; grows as the copywriter flags
  `NEW_TERM` and you clear real usage into this file.
- `config/templates.json` — Canva brand template IDs and autofill field
  maps, one entry per template number.

## State

- `state/current-run.json` — the active state machine. Read by `index.js
  run` to enforce the unresolved-run guard; safe to delete if you need to
  force-reset (there's nothing in it you'd want to keep).
- `state/history/` — past weeks' approved plans, read by the strategist to
  avoid repeating concepts within a 4-week window.
- `state/amendments.jsonl` — every edit you've ever made during approval,
  with a classified type. The learning signal for the whole system.

## What's not built yet

Analyst and Publisher — see the architecture doc's build order (§8) for
Phase 4. Until Publisher exists, approval ends at `SCHEDULING_HALTED`:
content is reviewed and logged, but you post it manually.
