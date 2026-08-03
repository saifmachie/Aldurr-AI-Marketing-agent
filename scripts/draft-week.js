#!/usr/bin/env node
// Convenience wrapper for Phase 1: runs Copywriter then Compliance on one plan.
// Still "by hand" — no orchestrator, no state machine, no scheduling.
// Usage: node scripts/draft-week.js <plan.json>
const path = require('path');
const copywriter = require('../agents/copywriter');
const compliance = require('../agents/compliance');

async function main() {
  const planPath = process.argv[2];
  if (!planPath) {
    console.error('Usage: node scripts/draft-week.js <plan.json>');
    process.exit(1);
  }

  const base = path.basename(planPath).replace(/\.json$/, '');
  const copyPath = path.join('output', `${base}-copy.json`);
  const auditPath = path.join('output', `${base}-audit.json`);

  console.log('--- Copywriter ---');
  await copywriter.run(planPath, copyPath);

  console.log('\n--- Compliance ---');
  const audit = await compliance.run(copyPath, auditPath);

  if (audit.verdict !== 'PASS') {
    console.log('\nBatch failed compliance. Fix the copy and re-run — compliance does not rewrite.');
    process.exit(1);
  }

  console.log(`\nBatch passed. Review ${copyPath} by hand before it goes anywhere near a platform.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
