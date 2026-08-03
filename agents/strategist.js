#!/usr/bin/env node
// v2 — Strategist plans a whole quarter's concepts at once (run by hand,
// 4x/year), not weekly. Dates and evergreen/occasion slot assignment are
// computed deterministically by lib/calendar.js — this agent only decides
// *what to say* on each already-fixed slot.
//
// Usage: node agents/strategist.js --quarter 2026-Q3 [--out path.json]
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { complete, parseJSON } = require('../lib/anthropic');
const config = require('../lib/config-loader');
const calendar = require('../lib/calendar');

const MODEL = process.env.STRATEGIST_MODEL || 'claude-opus-5';
const HISTORY_DIR = path.join(__dirname, '..', 'state', 'history');
const HISTORY_LOOKBACK = 4; // quarters

const SYSTEM_PROMPT = `You plan one quarter of social content for Al Durr Supplies.

This is v2's credibility-first model: social is NOT a sales channel here. It
exists so a pharmacy owner or hospital procurement officer who hears the name
can search it and find an active, professional presence worth dealing with.
Optimize for looking legitimate and being recalled when a buying decision
comes up — not reach, virality, or weekly optimization.

The dates and evergreen/occasion assignment for each slot below are already
fixed by deterministic scheduling. Do not change them. For each slot, decide
only the content.

For an "evergreen" slot:
- pillar: one of Product Education & Features, Problem → Solution, Trust &
  Security & Data Privacy, Support & Responsiveness
- concept: one sentence
- approved_fact: copied verbatim from the brand brief's approved facts list
- angle: what makes this different from prior quarters on this pillar
  (check the supplied history — never repeat a concept)
- cta_type: install | whatsapp | none
- template: 1-4

For an "occasion" slot (name and angle are supplied):
- Tone is brief, dignified, no sales pitch — two or three sentences, one
  clean design card. Selling on an occasion post undoes the point of it.
- cta_type is always "none". Template is usually 1 (Stat/Quote card) unless
  another clearly fits better.
- If the occasion is flagged no-commercial/restrained-only (e.g. Ashura),
  the concept must be a minimal, restrained acknowledgement — or set
  "skip": true with a one-line reason if silence is more appropriate.

If any slot would need a fact not on the approved list, set "needs_fact" to
what's missing instead of inventing one.

--- BRAND BRIEF (approved facts, pillars, hard rules) ---
${config.brandBrief()}

--- AGENT SPEC (cadence, content model, platforms) ---
${config.agentSpec()}

Return ONLY a JSON object: { "quarter": "<id>", "concepts": [ ... ] }, one
entry per input slot, same order, each shaped as: date, day, type, pillar,
concept, approved_fact, angle, cta_type, template, occasion_name, rationale,
needs_fact, skip.`;

function loadHistory() {
  if (!fs.existsSync(HISTORY_DIR)) return [];
  const files = fs
    .readdirSync(HISTORY_DIR)
    .filter((f) => f.startsWith('quarter-') && f.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, HISTORY_LOOKBACK);
  return files.map((f) => JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, f), 'utf8')));
}

async function planConcepts(quarterId, outPath, { limit } = {}) {
  const { slots: allSlots, unconfirmedLunarOccasions, unmatchedOccasions } = calendar.buildQuarterSlots(quarterId);
  const slots = limit ? allSlots.slice(0, limit) : allSlots;
  if (limit) {
    console.warn(`--limit ${limit}: testing with ${slots.length}/${allSlots.length} slots, not the full quarter.`);
  }
  const history = loadHistory();

  if (unconfirmedLunarOccasions.length) {
    console.warn(
      `Unconfirmed lunar occasions for ${quarterId} (add this year's date to config/occasions-calendar.json if any fall in this quarter): ${unconfirmedLunarOccasions.join(', ')}`
    );
  }
  if (unmatchedOccasions.length) {
    console.warn(`Occasions with no nearby slot this quarter: ${unmatchedOccasions.map((o) => o.name).join(', ')}`);
  }

  const prompt = `Plan quarter ${quarterId}. Here are the ${slots.length} fixed slots:

${JSON.stringify(slots, null, 2)}

--- LAST ${history.length} QUARTERS OF CONCEPTS (avoid repeating these) ---
${JSON.stringify(history, null, 2)}`;

  const text = await complete({
    model: MODEL,
    system: SYSTEM_PROMPT,
    prompt,
    // A full quarter is ~39 concise concept objects — 4096 truncated that
    // mid-output on testing. 6000 leaves room to finish while still fitting
    // under Groq's free-tier 12k TPM cap alongside this prompt's input size.
    // Real Anthropic usage has no such tension; this is a free-tier-only
    // balancing act.
    maxTokens: 6000,
  });

  const plan = parseJSON(text);
  fs.writeFileSync(outPath, JSON.stringify(plan, null, 2), 'utf8');

  console.log(`Wrote ${plan.concepts.length} concepts for ${plan.quarter} to ${outPath}`);
  for (const c of plan.concepts) {
    if (c.needs_fact) console.warn(`  [${c.date}] NEEDS_FACT: ${c.needs_fact}`);
    if (c.skip) console.warn(`  [${c.date}] recommended SKIP: ${c.rationale || ''}`);
  }
  return plan;
}

function parseArgs(argv) {
  const args = { quarter: null, out: null, limit: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--quarter') args.quarter = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
    else if (argv[i] === '--limit') args.limit = Number(argv[++i]);
  }
  return args;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const quarter = args.quarter || calendar.quarterIdentifier(new Date());
  const outPath = args.out || path.join('output', `quarter-${quarter}-concepts.json`);
  planConcepts(quarter, outPath, { limit: args.limit }).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { planConcepts, SYSTEM_PROMPT, loadHistory };
