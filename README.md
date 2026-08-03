# Al Durr Social Agent — v2

Credibility-first, batch + events. Full design lives in
[`docs/AlDurrSocialSystemv2.md`](docs/AlDurrSocialSystemv2.md) (current —
read this first) plus [`docs/AlDurrAgentArchitecture.md`](docs/AlDurrAgentArchitecture.md)
and [`docs/AlDurrSocialAgentSpec.md`](docs/AlDurrSocialAgentSpec.md) for the
brand rules, voice, and templates that still apply unchanged.

**v2 replaces the weekly-loop model.** Social here isn't a sales channel —
it exists so a pharmacy owner or procurement officer who hears the name
finds an active, credible presence. Consistency is the entire metric, which
is why this needs no weekly cadence: 3 posts/week, planned a whole quarter
at a time, plus an event handler for anything unpredictable (a vacancy, a
shipped feature, a milestone).

Compliance can only reject — it never rewrites copy. Nothing reaches a
platform without passing through human approval. No timeout auto-approve.
Ever.

## Setup

```
npm install
cp .env.example .env   # fill in ANTHROPIC_API_KEY, optionally CANVA_ACCESS_TOKEN
                        # and the Meta Graph API credentials
```

## The quarterly batch — two human gates

**1. Plan the quarter.** Computes the actual Sunday/Tuesday/Thursday dates
for the quarter, matches this quarter's occasions from
`config/occasions-calendar.json` to the nearest slot (displacing that
evergreen post rather than adding a fourth), then has the strategist draft
one concept per slot — no full copy yet.

```
node index.js plan-quarter --quarter 2026-Q3
```

Writes `output/quarter-2026-Q3-concepts.md` — a one-page, ~15-minute read.
Delete any block you don't want; edit any field in place.

**2. Approve concepts** — this writes the full copy, renders Canva designs,
and runs compliance (looping back to the copywriter up to twice on a
failure) on only the concepts you kept:

```
node index.js approve-concepts 2026-Q3
```

Halts at `output/quarter-2026-Q3.md` — the full batch, this time with real
copy and design paths. Read it, edit anything, then:

```
node index.js approve-batch 2026-Q3
```

This diffs your edits against the original, classifies each change (dialect
/ tone / length / fact / structure) via Claude Haiku, appends to
`state/amendments.jsonl` — **the point of the whole system**, per
`docs/AlDurrAgentArchitecture.md` §6 — and queues the batch for publishing.

Facebook posts schedule natively for the whole quarter in one go. Instagram
has no native scheduling in Meta's API, so those posts queue to
`state/publish-queue.jsonl` and go out via:

```
node index.js publish-due
```

Run this daily (cron/Task Scheduler) — it publishes whatever's due, nothing
more. Until `FACEBOOK_PAGE_ID` / `FACEBOOK_PAGE_ACCESS_TOKEN` /
`INSTAGRAM_BUSINESS_ACCOUNT_ID` are set, `approve-batch` skips queuing and
tells you to post manually — nothing is silently lost.

## Events — anything unpredictable

```
node index.js event vacancy.opened data.json
```

`data.json` shape depends on the event type — see `config/events.json` for
each type's required fields and channels. Writes copy, runs compliance
(same retry loop), then:

```
node index.js approve-event <event-id>
```

Publishes to whichever channels are wired up (Facebook via Graph API right
now; Instagram needs a rendered design and isn't wired into this path yet;
LinkedIn isn't implemented — post those manually).

## Config

- `config/brand-brief.md` — audience, voice, hard rules, approved facts.
  Source of truth; rarely changes.
- `config/agent-spec.md` — v2 cadence, content model, platforms, Canva
  templates, the quarterly batch and event-handler workflows.
- `config/dialect-lexicon.md` — approved Iraqi colloquial terms. Grows as
  the copywriter flags `NEW_TERM` and you clear real usage into this file.
- `config/templates.json` — Canva brand template IDs and autofill field
  maps.
- `config/occasions-calendar.json` — fixed and lunar occasion dates.
  **Lunar dates must be confirmed every year** against a current Iraqi
  calendar before planning a quarter that contains them — the strategist
  warns on unconfirmed ones rather than guessing.
- `config/events.json` — event types, their channels, and required data
  fields for the event handler.

## Designer and Canva

Unchanged from earlier phases: no image model renders Arabic text
correctly, so all Arabic text is set by Canva's autofill API into a real
Cairo-font template.

- The 4 templates in `config/agent-spec.md` must exist in your Canva
  account first. Brand-template autofill requires Canva Pro/Teams/Enterprise.
- Fill each template's real ID and field names into `config/templates.json`.
- Without a real template ID or `CANVA_ACCESS_TOKEN`, the designer skips
  that post and records why — never halts the batch.
- App screenshots go in `assets/screenshots/`.

## Publisher and Meta Graph API

Free to use, but Meta's App Review process (needed for
`pages_manage_posts` / `instagram_content_publish`) can take days to weeks
and requires a Facebook Business Manager account. Until that's done and
the three env vars above are set, approved batches are logged and ready
but posted manually.

## State

- `state/current-run.json` — the active state machine. Safe to delete to
  force-reset; nothing in it is worth keeping across a reset.
- `state/history/` — past quarters' approved concepts, read by the
  strategist to avoid repeating them.
- `state/amendments.jsonl` — every edit you've ever made during approval,
  classified. Review it every 6-8 weeks; recurring edit types should get
  folded into the copywriter prompt or the dialect lexicon.
- `state/publish-queue.jsonl` — Instagram posts waiting for their publish
  date (Facebook doesn't need this — it's scheduled natively).

## What's not built

Analyst — deliberately cut for now per v2 (three posts a week takes a year
to produce meaningful data, and the goal is presence, not optimization;
revisit at 100+ posts). LinkedIn publishing — events that target LinkedIn
still need to be posted by hand.
