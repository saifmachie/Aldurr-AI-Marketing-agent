#!/usr/bin/env node
// Run by hand: node agents/compliance.js <copy.json> [output.json]
// This agent can only reject. It never rewrites.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { complete, parseJSON } = require('../lib/anthropic');
const config = require('../lib/config-loader');

const MODEL = process.env.COMPLIANCE_MODEL || 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `You audit social content for Al Durr Supplies before human review. You do not
rewrite. You return pass or fail with reasons.

Check every post against all rules. Fail the whole batch if any single item
fails. Identify each post by its "date" field in the "post" output field —
day names repeat across a quarter, dates don't.

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

--- BRAND BRIEF (approved facts list is authoritative for rule 12) ---
${config.brandBrief()}

Output ONLY JSON: { "verdict": "PASS"|"FAIL", "failures": [{ "post": "", "rule": <n>,
"quote": "", "reason": "" }] }`;

async function run(copyPath, outPath) {
  const copy = JSON.parse(fs.readFileSync(copyPath, 'utf8'));

  const prompt = `Audit this batch of posts and design briefs:

${JSON.stringify(copy, null, 2)}`;

  const text = await complete({
    model: MODEL,
    system: SYSTEM_PROMPT,
    prompt,
    // Output is just a verdict + short failure list — 2048 covers even a
    // batch with several failures. Kept low since compliance's input scales
    // with batch size (all 39 posts' full copy), pushing free-tier TPM caps
    // like Groq's. Real Anthropic usage has no such tension.
    maxTokens: 2048,
  });

  const audit = parseJSON(text);
  fs.writeFileSync(outPath, JSON.stringify(audit, null, 2), 'utf8');

  console.log(`Verdict: ${audit.verdict}`);
  for (const failure of audit.failures || []) {
    console.log(`  [${failure.post}] rule ${failure.rule}: ${failure.reason} — "${failure.quote}"`);
  }

  return audit;
}

if (require.main === module) {
  const copyPath = process.argv[2];
  if (!copyPath) {
    console.error('Usage: node agents/compliance.js <copy.json> [output.json]');
    process.exit(1);
  }
  const defaultOut = path.join(
    'output',
    path.basename(copyPath).replace(/\.json$/, '') + '-audit.json'
  );
  const outPath = process.argv[3] || defaultOut;
  run(copyPath, outPath)
    .then((audit) => process.exit(audit.verdict === 'PASS' ? 0 : 1))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}

module.exports = { run, SYSTEM_PROMPT };
