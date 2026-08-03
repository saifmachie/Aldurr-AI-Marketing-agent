# Al Durr Supplies — Social System v2
## Credibility-first · Batch + Events

Supersedes the weekly-loop design in v1. Brand rules, voice, guardrails, and
templates in `AlDurr-Social-Agent-Spec.md` still apply unchanged.

---

## 1. What this system is for

Social is **not** a sales channel for Al Durr. It exists so that a pharmacy owner
or hospital procurement officer who hears the name can search it, find an active
professional presence, and conclude this is a real company worth dealing with.

That changes what "working" means:

| Not the goal | The goal |
|---|---|
| Reach, virality, follower growth | Looking legitimate to someone checking |
| Conversions from social | Recall when a buying decision comes up |
| Weekly optimization | Never going silent |

**Consistency is the entire metric.** A page posting three times a week for two
years reads as a real company. A page posting daily for six weeks and then going
quiet reads as abandoned — and that silence is visible to every buyer who looks.
Size the commitment for two years, not for launch enthusiasm.

---

## 2. Content model

Three types. Two are predictable, which is why this needs no weekly loop.

| Type | Share | Timing | Produced |
|---|---|---|---|
| **Evergreen** | ~60% | Anytime | Batched quarterly |
| **Occasions** | ~25% | Known dates | Batched annually |
| **Announcements** | ~15% | Unpredictable | Event-triggered |

---

## 3. Cadence — 3 posts/week

Iraqi work week, Sunday–Thursday.

| Day | Slot |
|---|---|
| **Sunday** | Evergreen — Problem → Solution, or Product Education |
| **Tuesday** | Evergreen — Trust & Security, or Support |
| **Thursday** | Flex — occasion if one falls this week, otherwise evergreen |

Announcements displace the nearest evergreen slot rather than adding a fourth
post. Keep the rhythm fixed; only the content varies.

Cross-post all three to Instagram. LinkedIn stays dormant except vacancies and
milestones.

---

## 4. Occasions calendar

Tone for all occasion posts: brief, dignified, no sales pitch. A supplier
acknowledging its customers' profession — two or three sentences, one clean
design card. Selling on Pharmacists Day undoes the point of posting.

### Fixed dates

| Date | Occasion | Priority | Angle |
|---|---|---|---|
| Jan 1 | New Year | Medium | Thanks to partners, forward-looking |
| Feb 4 | World Cancer Day | Low | Awareness only, no product tie |
| Mar 21 | Mother's Day (Arab world) | Medium | Warm, brief |
| Apr 7 | World Health Day | **High** | Core audience alignment |
| May 1 | Labour Day | Medium | Recognition of workers |
| May 5 | Hand Hygiene Day | Medium | Natural fit for supplies |
| May 12 | International Nurses Day | **High** | Direct customer audience |
| Jun 14 | World Blood Donor Day | Low | Awareness |
| Jul 14 | Republic Day (Iraq) | Medium | National, keep neutral |
| Sep 17 | World Patient Safety Day | Medium | Ties to verified suppliers |
| Sep 25 | **World Pharmacists Day** | **Highest** | Your single most important date |
| Sep 29 | World Heart Day | Low | Awareness |
| Oct 3 | Independence Day (Iraq) | Medium | National, keep neutral |
| Oct 10 | World Mental Health Day | Low | Awareness |
| Nov 14 | World Diabetes Day | Medium | Common pharmacy category |
| Dec 1 | World AIDS Day | Low | Awareness |

### Lunar dates — confirm every year

These shift roughly 11 days earlier annually. **Verify against a current Iraqi
calendar each year when batching; do not carry last year's dates forward.**

| Occasion | Priority | Note |
|---|---|---|
| Start of Ramadan | **High** | Greeting + note on adjusted support hours if any |
| Eid al-Fitr | **Highest** | Multi-day; schedule greeting for eve |
| Eid al-Adha | **High** | Same treatment |
| Islamic New Year | Low | Brief greeting |
| Prophet's Birthday | Medium | Brief greeting |
| Ashura | — | Solemn observance, not a greeting occasion. Post nothing, or a restrained acknowledgement. Never commercial. |

Also confirm locally: **Iraqi Doctors' Day** — observed in Iraq, worth including
once you confirm the date with someone local.

### Skipped, deliberately

**Valentine's Day.** Commercially off-brand for a B2B medical supplier and an
uncertain fit with a conservative professional audience. Nothing gained,
something risked.

**Ashura as content.** Acknowledge or stay silent. Never a branded card.

---

## 5. Do this before any posting

For your stated goal, these outrank every post you will ever publish. A buyer
checking credibility looks here first.

- [ ] Facebook Page complete: category, real address, phone, hours, website
- [ ] About section in Arabic, one clear sentence on what Al Durr does
- [ ] Working Play Store link, prominent
- [ ] Click-to-WhatsApp button configured
- [ ] "Typically replies instantly" badge — earned by fast Messenger response
- [ ] Pinned post: what Al Durr is, who it serves, how to start
- [ ] Instagram linked to the same Page, Professional account
- [ ] Profile and cover images at correct resolution, logo legible at 40px
- [ ] Page verification submitted

A complete profile with 20 posts beats a thin profile with 200.

---

## 6. Quarterly batch — the main workflow

Four sessions a year. Each produces ~36 evergreen posts plus that quarter's
occasions.

```
1. PLAN      Claude drafts 36 concepts across 4 pillars, no repeats,
             mapped to the calendar
2. YOU       Review the concept list only — one page, 15 minutes
3. WRITE     Claude writes approved concepts, Iraqi dialect
4. AUDIT     Compliance agent checks all 36 against the 10 hard rules
5. DESIGN    Canva render from templates 1-4
6. YOU       Review the full batch, amend
7. QUEUE     Schedule the whole quarter
```

Reviewing concepts *before* copy is the time-saver: rejecting an idea costs one
line, rejecting a finished post costs a rewrite and a redesign.

Budget: half a day per quarter. Two days a year total.

---

## 7. Event handler

For anything unpredictable. One flow, many event types.

```
EVENT → BRIEF → COPY → COMPLIANCE → YOU APPROVE → PUBLISH
```

| Event | Channels | Extra step |
|---|---|---|
| `vacancy.opened` | LinkedIn + Facebook | Create application form first |
| `product.category_added` | Facebook + Instagram | — |
| `promotion.launched` | Facebook + Instagram | No pricing in creative |
| `coverage.expanded` | Facebook + Instagram | — |
| `milestone.reached` | LinkedIn + Facebook | Numbers must be approved first |
| `feature.shipped` | Facebook + Instagram | — |

Build `vacancy.opened` first — it is your stated need and the only one that
touches an external system (the website form). The rest are the same flow with
a different brief.

---

## 8. Architecture — what's left

Cutting the weekly loop removes most of v1's complexity.

| v1 agent | v2 status |
|---|---|
| Orchestrator | **Keep** — much simpler, no weekly state machine |
| Analyst | **Cut for now.** Three posts a week takes a year to produce meaningful data, and the goal isn't optimization. Revisit at 100+ posts. |
| Strategist | **Keep**, runs 4×/year instead of weekly |
| Copywriter | **Keep** — unchanged, still the core |
| Designer | **Keep** — unchanged, Canva only for Arabic text |
| Compliance | **Keep** — now more valuable, auditing 36 posts at once |
| Publisher | **Keep** — bulk scheduling instead of weekly |

Two agents to build first: **Copywriter** and **Compliance**. They carry the
quality. Everything else is scheduling.

---

## 9. Measurement

Light, because the goal is presence, not performance.

Check quarterly, not weekly:
- Posts published vs. planned — the only number that really matters
- Page follower count, direction only
- WhatsApp inquiries mentioning social, counted manually
- Page response rate badge status

Do not optimize post-to-post. At three posts a week, week-to-week variation is
noise, and chasing it will pull the content toward whatever gets engagement
rather than whatever makes you look credible.

---

## 10. The first 90 days

| Week | Do |
|---|---|
| 1 | Section 5 checklist — page fundamentals |
| 1 | Publish 6 posts manually to fill the feed before anyone looks |
| 2 | First quarterly batch: 36 posts + Q3/Q4 occasions |
| 2 | Schedule the whole quarter |
| 3–12 | Nothing. It runs. Handle events as they occur. |
| 13 | Second batch, with amendments folded into the prompts |

Nothing in weeks 3–12 is the point. If the system requires your attention
during those ten weeks, it has failed at the thing it was built for.
