# Al Durr Social Agent — Phase 1

Full design lives in [`docs/AlDurrAgentArchitecture.md`](docs/AlDurrAgentArchitecture.md)
and [`docs/AlDurrSocialAgentSpec.md`](docs/AlDurrSocialAgentSpec.md). This repo
currently implements **Phase 1** of the build order (architecture doc §8):
the Copywriter and Compliance agents, run by hand. No orchestrator, no state
machine, no scheduling, no publishing yet.

Compliance can only reject — it never rewrites copy. You are the one who
edits, and nothing reaches a platform without a human reading it first.

## Setup

```
npm install
cp .env.example .env   # fill in ANTHROPIC_API_KEY
```

## Run

Write copy for a plan (a strategist plan doesn't exist yet in this phase —
edit `input/sample-plan.json` by hand each week, one entry per post):

```
node agents/copywriter.js input/sample-plan.json
```

Audit the copy it produced:

```
node agents/compliance.js output/sample-plan-copy.json
```

Or run both in sequence:

```
node scripts/draft-week.js input/sample-plan.json
```

Exit code is non-zero on a compliance FAIL. Read `output/sample-plan-audit.json`
for the specific rule and quote that failed.

## Config

- `config/brand-brief.md` — audience, voice, hard rules, approved facts.
  Source of truth; rarely changes.
- `config/agent-spec.md` — platform priority, weekly cadence, Canva template
  reference.
- `config/dialect-lexicon.md` — approved Iraqi colloquial terms. Currently
  seeded from the one sample post in the spec; grows as the copywriter flags
  `NEW_TERM` and you clear real usage into this file.

## What's not built yet

Strategist, Designer, Orchestrator, Analyst, Publisher, the state machine,
and the human approval loop — see the architecture doc's build order (§8)
for what phases 2–4 add.
