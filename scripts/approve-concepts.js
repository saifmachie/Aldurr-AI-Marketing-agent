#!/usr/bin/env node
// v2 step 2->3 bridge: reads your edited concepts file back, drops any
// block you deleted or left as a recommended skip, and writes the approved
// plan the copywriter will actually write full copy for.
// Usage: node scripts/approve-concepts.js <quarter>
const fs = require('fs');
const path = require('path');
const { parseConceptsReview } = require('../lib/concepts-format');

function isSkipRecommended(block) {
  return /^SKIP RECOMMENDED:\s*yes\s*$/im.test(block);
}

function run(quarter) {
  const reviewPath = path.join('output', `quarter-${quarter}-concepts.md`);
  if (!fs.existsSync(reviewPath)) {
    throw new Error(`No concepts review file at ${reviewPath} — run scripts/plan-quarter.js first.`);
  }
  const markdown = fs.readFileSync(reviewPath, 'utf8');
  const blocks = markdown.split(/\n(?=## )/).filter((b) => b.trim().startsWith('## '));

  const concepts = parseConceptsReview(markdown);
  const approved = [];

  concepts.forEach((concept, i) => {
    const block = blocks[i];
    if (isSkipRecommended(block)) {
      console.log(`  [${concept.date}] excluded — left as recommended skip`);
      return;
    }
    if (concept.type !== 'occasion' && !concept.approved_fact) {
      console.warn(`  [${concept.date}] excluded — no approved fact set (was this a NEEDS_FACT you didn't resolve?)`);
      return;
    }
    approved.push(concept);
  });

  const plan = { quarter, posts: approved };
  const outPath = path.join('output', `quarter-${quarter}-plan.json`);
  fs.writeFileSync(outPath, JSON.stringify(plan, null, 2), 'utf8');
  console.log(`Approved ${approved.length}/${concepts.length} concepts -> ${outPath}`);
  return plan;
}

if (require.main === module) {
  const quarter = process.argv[2];
  if (!quarter) {
    console.error('Usage: node scripts/approve-concepts.js <quarter>');
    process.exit(1);
  }
  try {
    run(quarter);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = { run };
