#!/usr/bin/env node
// v2 entry point — quarterly batch workflow + event handler.
// See README for the full command reference.
const fs = require('fs');
const orchestrator = require('./agents/orchestrator');
const eventHandler = require('./agents/event-handler');
const publisher = require('./agents/publisher');
const calendar = require('./lib/calendar');

// Every command below writes into output/ — ensure it exists even on a
// fresh clone, since git doesn't track empty directories.
fs.mkdirSync('output', { recursive: true });

const USAGE = `Usage:
  node index.js plan-quarter [--quarter 2026-Q3]
  node index.js approve-concepts <quarter>
  node index.js approve-batch <quarter>
  node index.js event <event-type> <data.json>
  node index.js approve-event <event-id>
  node index.js publish-due`;

function parseArgs(argv) {
  const args = { quarter: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--quarter') args.quarter = argv[++i];
  }
  return args;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  if (command === 'plan-quarter') {
    const args = parseArgs(rest);
    const quarter = args.quarter || calendar.quarterIdentifier(new Date());
    await orchestrator.planQuarter(quarter);
    return;
  }

  if (command === 'approve-concepts') {
    const quarter = rest[0];
    if (!quarter) return void console.error(USAGE) || process.exit(1);
    await orchestrator.approveConcepts(quarter);
    return;
  }

  if (command === 'approve-batch') {
    const quarter = rest[0];
    if (!quarter) return void console.error(USAGE) || process.exit(1);
    await orchestrator.approveBatch(quarter);
    return;
  }

  if (command === 'event') {
    const [eventType, dataPath] = rest;
    if (!eventType || !dataPath) return void console.error(USAGE) || process.exit(1);
    const eventData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const eventId = `${eventType}-${Date.now()}`;
    await eventHandler.runEvent(eventType, eventData, eventId);
    console.log(`Event ID: ${eventId}`);
    return;
  }

  if (command === 'approve-event') {
    const eventId = rest[0];
    if (!eventId) return void console.error(USAGE) || process.exit(1);
    await eventHandler.approveEvent(eventId);
    return;
  }

  if (command === 'publish-due') {
    await publisher.publishDueInstagramPosts();
    return;
  }

  console.error(USAGE);
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
