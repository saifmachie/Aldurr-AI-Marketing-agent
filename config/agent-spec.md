# Al Durr Supplies — Cadence, Platforms & Templates

Companion to `brand-brief.md`. This file holds the parts that describe
*schedule and shape*, not brand rules — those live in brand-brief.md.

**v2 — credibility-first, batch + events.** Supersedes the weekly-loop
cadence. Social is not a sales channel here; it exists so a pharmacy owner
or procurement officer who hears the name finds an active, credible
presence. Consistency is the entire metric — see
`docs/AlDurrSocialSystemv2.md` for the full reasoning.

---

## Platform priority

| Platform | Role | Volume | Why |
|---|---|---|---|
| **Facebook** | Primary | 3/week | Long Arabic copy, link posts, click-to-WhatsApp. |
| **Instagram** | Cross-post | 3/week | Same Meta Page, near-zero extra effort. Typographic cards only — no lifestyle photography exists. |
| **LinkedIn** | Hiring & milestones only | As events occur | Not a customer channel. Dormant otherwise — an empty page beats a padded one. |

## Content model

| Type | Share | Timing | Produced |
|---|---|---|---|
| **Evergreen** | ~60% | Anytime | Batched quarterly |
| **Occasions** | ~25% | Known dates | Batched annually, see `config/occasions-calendar.json` |
| **Announcements** | ~15% | Unpredictable | Event-triggered |

## Cadence — 3 posts/week (Iraqi work week, Sunday–Thursday)

| Day | Slot |
|---|---|
| Sunday | Evergreen — Problem → Solution, or Product Education |
| Tuesday | Evergreen — Trust & Security, or Support |
| Thursday | Flex — occasion if one falls this week, otherwise evergreen |

Announcements displace the nearest evergreen slot rather than adding a
fourth post. Keep the rhythm fixed; only the content varies.

Never repeat a concept used in a prior batch. Rotate angle, never repeat
wording.

## Output format per post

- Date, day, slot type (evergreen | occasion | announcement), pillar
- Arabic caption (Facebook: 60–120 words; Instagram: 30–60). Occasion posts
  are the exception: 2-3 sentences, brief and dignified, no sales pitch —
  see `docs/AlDurrSocialSystemv2.md` §4.
- Hook line (first 8 words — this is what stops the scroll)
- CTA (occasion posts: none)
- Design brief: which template, headline text (max 8 Arabic words),
  supporting line, which app screenshot if any
- 5 Arabic hashtags

## Canva templates (build once, reference by number)

| # | Template | Structure | Used for |
|---|---|---|---|
| 1 | Stat / Quote card | Navy→accent diagonal gradient, white Cairo Bold headline centered, logo bottom-right | Trust pillar, approved stats, occasion posts |
| 2 | Feature explainer | White bg, feature icon in navy circle top-right (RTL), headline + 2-line support | Product Education |
| 3 | App screenshot frame | Phone mockup, headline right-aligned beside it, accent eyebrow label | How-to, walkthroughs |
| 4 | 3-step process | Three numbered rounded cards (01/02/03) reading right-to-left | Onboarding, problem→solution |

See `templates.json` for the machine-readable field map.

## Quarterly batch workflow

1. **PLAN** — strategist drafts ~36 concepts across the 4 pillars, mapped to
   the quarter's actual Sunday/Tuesday/Thursday dates and that quarter's
   occasions, no repeats from prior batches
2. **YOU review concepts only** — one page, ~15 minutes. Reject ideas here;
   it costs one line. Rejecting a finished post costs a rewrite and a
   redesign.
3. **WRITE** — copywriter writes only the approved concepts
4. **AUDIT** — compliance checks the whole batch at once
5. **DESIGN** — Canva render from templates 1-4
6. **YOU review the full batch**, amend
7. **QUEUE** — schedule the whole quarter

## Event handler (announcements)

One flow, many event types: `EVENT → BRIEF → COPY → COMPLIANCE → YOU APPROVE → PUBLISH`.

| Event | Channels | Extra step |
|---|---|---|
| `vacancy.opened` | LinkedIn + Facebook | Create application form first |
| `product.category_added` | Facebook + Instagram | — |
| `promotion.launched` | Facebook + Instagram | No pricing in creative |
| `coverage.expanded` | Facebook + Instagram | — |
| `milestone.reached` | LinkedIn + Facebook | Numbers must be approved first |
| `feature.shipped` | Facebook + Instagram | — |
