#!/usr/bin/env node
// v2 step 1 (PLAN) + the "you review concepts only" file from §6.
// Usage: node scripts/plan-quarter.js [--quarter 2026-Q3]
const fs = require('fs');
const path = require('path');
const strategist = require('../agents/strategist');
const calendar = require('../lib/calendar');
const { buildConceptsReview } = require('../lib/concepts-format');

function parseArgs(argv) {
  const args = { quarter: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--quarter') args.quarter = argv[++i];
  }
  return args;
}

async function run(quarter) {
  const jsonPath = path.join('output', `quarter-${quarter}-concepts.json`);
  const reviewPath = path.join('output', `quarter-${quarter}-concepts.md`);

  const plan = await strategist.planConcepts(quarter, jsonPath);
  const markdown = buildConceptsReview(quarter, plan.concepts);
  fs.writeFileSync(reviewPath, markdown, 'utf8');

  console.log(`\nReview ${reviewPath} (one page, ~15 minutes), then run:\n  node scripts/approve-concepts.js ${quarter}`);
  return reviewPath;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const quarter = args.quarter || calendar.quarterIdentifier(new Date());
  run(quarter).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { run };
