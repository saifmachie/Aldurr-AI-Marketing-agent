#!/usr/bin/env node
// Phase 2 full pipeline: Strategist -> Copywriter -> Compliance -> Designer -> review file.
// Still "by hand" — no orchestrator, no state machine, no scheduling.
// Usage: node scripts/draft-week-full.js [--week 2026-33] [--analyst path.json]
const path = require('path');
const strategist = require('../agents/strategist');
const copywriter = require('../agents/copywriter');
const compliance = require('../agents/compliance');
const designer = require('../agents/designer');
const review = require('./build-review');

function parseArgs(argv) {
  const args = { week: null, analyst: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--week') args.week = argv[++i];
    else if (argv[i] === '--analyst') args.analyst = argv[++i];
  }
  return args;
}

async function main() {
  const { week: weekArg, analyst } = parseArgs(process.argv.slice(2));
  const week = weekArg || strategist.isoWeekIdentifier(new Date());

  const planPath = path.join('output', `week-${week}-plan.json`);
  const copyPath = path.join('output', `week-${week}-copy.json`);
  const auditPath = path.join('output', `week-${week}-audit.json`);
  const designsPath = path.join('output', `week-${week}-designs.json`);

  console.log(`--- Strategist (week ${week}) ---`);
  await strategist.run(week, analyst, planPath);

  console.log('\n--- Copywriter ---');
  await copywriter.run(planPath, copyPath);

  console.log('\n--- Compliance ---');
  const audit = await compliance.run(copyPath, auditPath);

  console.log('\n--- Designer ---');
  await designer.run(copyPath, designsPath);

  console.log('\n--- Review file ---');
  const reviewPath = review.run(week);

  if (audit.verdict !== 'PASS') {
    console.log(`\nBatch failed compliance. Review ${reviewPath}, fix the copy by hand, and re-run compliance — it never rewrites.`);
    process.exit(1);
  }

  console.log(`\nReview ${reviewPath} by hand before anything goes near a platform.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
