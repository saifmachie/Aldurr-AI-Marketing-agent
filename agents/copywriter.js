#!/usr/bin/env node
// Phase 1 agent — run by hand: node agents/copywriter.js <plan.json> [output.json]
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { complete, parseJSON } = require('../lib/anthropic');
const config = require('../lib/config-loader');

const MODEL = process.env.COPYWRITER_MODEL || 'claude-sonnet-5';

const SYSTEM_PROMPT = `You write Arabic social copy for Al Durr Supplies.

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

--- BRAND BRIEF (source of truth for approved facts and hard rules) ---
${config.brandBrief()}

--- DIALECT LEXICON (only these colloquial terms are pre-cleared) ---
${config.dialectLexicon()}

Return ONLY a JSON array, one object per post, each shaped as:
{
  "day": "",
  "pillar": "",
  "hook": "",
  "body": "",
  "cta": "",
  "design_brief": { "template": <1-4>, "headline": "", "supporting_line": "", "screenshot": "" },
  "hashtags": ["", "", "", "", ""],
  "new_terms": [],
  "needs_approved_fact": null
}
If a post would require a fact not on the approved list, set "needs_approved_fact"
to a short description of what is missing and leave hook/body empty rather than
inventing one.`;

async function run(planPath, outPath) {
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));

  const prompt = `Write copy for this week's plan. Each entry is one post from the strategist:

${JSON.stringify(plan, null, 2)}`;

  const text = await complete({
    model: MODEL,
    system: SYSTEM_PROMPT,
    prompt,
    maxTokens: 8192,
  });

  const posts = parseJSON(text);

  const result = { week: plan.week, generated_at: new Date().toISOString(), posts };
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');

  console.log(`Wrote ${posts.length} posts to ${outPath}`);
  for (const post of posts) {
    if (post.needs_approved_fact) {
      console.warn(`  [${post.day}] NEEDS_APPROVED_FACT: ${post.needs_approved_fact}`);
    }
    if (post.new_terms && post.new_terms.length) {
      console.warn(`  [${post.day}] NEW_TERM flagged: ${post.new_terms.join(', ')}`);
    }
  }
}

if (require.main === module) {
  const planPath = process.argv[2];
  if (!planPath) {
    console.error('Usage: node agents/copywriter.js <plan.json> [output.json]');
    process.exit(1);
  }
  const defaultOut = path.join(
    'output',
    path.basename(planPath).replace(/\.json$/, '') + '-copy.json'
  );
  const outPath = process.argv[3] || defaultOut;
  run(planPath, outPath).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { run, SYSTEM_PROMPT };
