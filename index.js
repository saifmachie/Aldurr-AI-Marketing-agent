#!/usr/bin/env node
// Phase 3 entry point. Invoke this from an external scheduler (cron /
// Windows Task Scheduler) — see README for the Monday 08:00 Baghdad setup.
//
// Usage:
//   node index.js run [--week 2026-33] [--analyst path.json]
//   node index.js approve <week>
const orchestrator = require('./agents/orchestrator');
const strategist = require('./agents/strategist');

function parseArgs(argv) {
  const args = { week: null, analyst: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--week') args.week = argv[++i];
    else if (argv[i] === '--analyst') args.analyst = argv[++i];
  }
  return args;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  if (command === 'run') {
    const args = parseArgs(rest);
    const week = args.week || strategist.isoWeekIdentifier(new Date());
    await orchestrator.runWeek(week, { analystPath: args.analyst });
    return;
  }

  if (command === 'approve') {
    const week = rest[0];
    if (!week) {
      console.error('Usage: node index.js approve <week>');
      process.exit(1);
    }
    await orchestrator.approve(week);
    return;
  }

  console.error('Usage:\n  node index.js run [--week 2026-33] [--analyst path.json]\n  node index.js approve <week>');
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
