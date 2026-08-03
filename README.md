# Al Durr Social Agent — Phase 2

Full design lives in [`docs/AlDurrAgentArchitecture.md`](docs/AlDurrAgentArchitecture.md)
and [`docs/AlDurrSocialAgentSpec.md`](docs/AlDurrSocialAgentSpec.md). This repo
implements through **Phase 2** of the build order (architecture doc §8):
Strategist, Copywriter, Compliance, and Designer, run by hand, producing a
full weekly review file. No orchestrator, no state machine, no scheduling,
no publishing yet — everything here is manual scheduling.

Compliance can only reject — it never rewrites copy. You are the one who
edits, and nothing reaches a platform without a human reading it first.

## Setup

```
npm install
cp .env.example .env   # fill in ANTHROPIC_API_KEY, optionally CANVA_ACCESS_TOKEN
```

## Run the full pipeline

```
node scripts/draft-week-full.js
```

This runs, in order: Strategist (plans the week) → Copywriter (writes the
Arabic copy) → Compliance (audits it) → Designer (renders Canva assets) →
assembles `output/week-<id>.md`, the file you actually read and edit per the
approval loop in the architecture doc §6.

Pass `--week 2026-33` to target a specific week identifier, or `--analyst
path/to/analyst.json` once an analyst agent exists (Phase 4). Without
`--analyst`, the strategist runs cold — confidence `low`, cadence held
steady, per its own guardrail against chasing noise on no data.

Exit code is non-zero on a compliance FAIL. The review file still gets
written either way, with the failure reasons inline.

## Run agents individually

```
node agents/strategist.js --week 2026-33          # -> output/week-2026-33-plan.json
node agents/copywriter.js output/week-2026-33-plan.json output/week-2026-33-copy.json
node agents/compliance.js output/week-2026-33-copy.json output/week-2026-33-audit.json
node agents/designer.js output/week-2026-33-copy.json output/week-2026-33-designs.json
node scripts/build-review.js 2026-33
```

Phase 1's original manual flow (hand-written plan, no strategist) still
works if you'd rather write a plan yourself:

```
node scripts/draft-week.js input/sample-plan.json
```

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

- `state/history/` — past weeks' plans, read by the strategist to avoid
  repeating concepts within a 4-week window. Empty until you manually copy
  an approved week's plan in (Phase 3's orchestrator automates this).

## What's not built yet

Orchestrator, Analyst, Publisher, the state machine, and automatic
amendment logging — see the architecture doc's build order (§8) for what
phases 3–4 add.
