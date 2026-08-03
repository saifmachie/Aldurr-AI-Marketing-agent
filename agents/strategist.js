#!/usr/bin/env node
// Phase 2 agent — run by hand: node agents/strategist.js --week 33 [--analyst path.json]
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { complete, parseJSON } = require('../lib/anthropic');
const config = require('../lib/config-loader');

const MODEL = process.env.STRATEGIST_MODEL || 'claude-opus-5';
const HISTORY_DIR = path.join(__dirname, '..', 'state', 'history');
const HISTORY_LOOKBACK = 4;

const SYSTEM_PROMPT = `You plan one week of social content for Al Durr Supplies.

Follow the fixed cadence in the supplied agent spec:
Sunday Problem→Solution · Monday Product Education · Tuesday Trust & Security ·
Wednesday Product Education · Thursday Support & Responsiveness

Never repeat a concept used in the last 4 weeks. Check the supplied history.

Apply the analyst's recommendations only where confidence is medium or high.
On low confidence, hold the cadence steady — do not chase noise.

Goal priority: 1) app installs  2) WhatsApp inquiries  3) awareness

For each of the 5 posts output:
- day, pillar, concept (one sentence)
- approved_fact: the specific approved fact it is built on, copied verbatim
  from the brand brief's approved facts list
- angle: what makes this different from previous posts on this pillar
- cta_type: install | whatsapp | none
- template: 1-4
- rationale: why this post, this week

If any post would need a fact not on the approved list, do not invent one —
set "needs_fact" on that post to a description of what is missing and leave
concept/approved_fact blank.

--- BRAND BRIEF (approved facts, pillars, hard rules) ---
${config.brandBrief()}

--- AGENT SPEC (cadence, platforms, templates) ---
${config.agentSpec()}

Return ONLY a JSON object: { "week": <number>, "posts": [ ... ] } where each
post matches the schema above, in the field order day, pillar, concept,
approved_fact, angle, cta_type, template, rationale, needs_fact.`;

function loadHistory() {
  if (!fs.existsSync(HISTORY_DIR)) return [];
  const files = fs
    .readdirSync(HISTORY_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, HISTORY_LOOKBACK);
  return files.map((f) => JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, f), 'utf8')));
}

function loadAnalyst(analystPath) {
  if (analystPath) {
    return JSON.parse(fs.readFileSync(analystPath, 'utf8'));
  }
  return {
    sample_size: 0,
    confidence: 'low',
    top_performers: [],
    underperformers: [],
    timing: 'INSUFFICIENT_DATA',
    format: 'INSUFFICIENT_DATA',
    hooks: 'INSUFFICIENT_DATA',
    recommendations: [],
    caveats: ['No analyst has run yet — this is a cold start with no performance history.'],
  };
}

async function run(week, analystPath, outPath) {
  const history = loadHistory();
  const analyst = loadAnalyst(analystPath);

  const prompt = `Plan week ${week}.

--- ANALYST FINDINGS ---
${JSON.stringify(analyst, null, 2)}

--- LAST ${history.length} WEEKS OF PLANS (avoid repeating these concepts) ---
${JSON.stringify(history, null, 2)}`;

  const text = await complete({
    model: MODEL,
    system: SYSTEM_PROMPT,
    prompt,
    maxTokens: 4096,
  });

  const plan = parseJSON(text);
  fs.writeFileSync(outPath, JSON.stringify(plan, null, 2), 'utf8');

  console.log(`Wrote plan for week ${plan.week} to ${outPath}`);
  for (const post of plan.posts) {
    if (post.needs_fact) {
      console.warn(`  [${post.day}] NEEDS_FACT: ${post.needs_fact}`);
    }
  }
  return plan;
}

function parseArgs(argv) {
  const args = { week: null, analyst: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--week') args.week = argv[++i];
    else if (argv[i] === '--analyst') args.analyst = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
  }
  return args;
}

function isoWeekIdentifier(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-${String(week).padStart(2, '0')}`;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const week = args.week || isoWeekIdentifier(new Date());
  const outPath = args.out || path.join('output', `week-${week}-plan.json`);
  run(week, args.analyst, outPath).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { run, SYSTEM_PROMPT, loadHistory, isoWeekIdentifier };
