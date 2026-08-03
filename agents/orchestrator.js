#!/usr/bin/env node
// Phase 3 — Orchestrator. Owns the state machine, calls agents in order,
// enforces the hard rule: nothing reaches a platform without passing
// through AWAITING_APPROVAL. No timeout auto-approve. Ever.
//
// Meant to be invoked by an external scheduler (cron / Windows Task
// Scheduler), not to run as a daemon itself — see README for the schedule.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const state = require('../lib/state');
const { notify } = require('../lib/notify');
const { parseReview, diffPosts } = require('../lib/diff-review');
const { complete, parseJSON } = require('../lib/anthropic');
const strategist = require('./strategist');
const copywriter = require('./copywriter');
const compliance = require('./compliance');
const designer = require('./designer');
const review = require('../scripts/build-review');

const MAX_AUDIT_LOOPS = 2;
const APPROVAL_TIMEOUT_HOURS = 48;
const UNRESOLVED_STATES = ['AWAITING_APPROVAL', 'AMENDED'];

function outputPaths(week) {
  return {
    plan: path.join('output', `week-${week}-plan.json`),
    copy: path.join('output', `week-${week}-copy.json`),
    audit: path.join('output', `week-${week}-audit.json`),
    designs: path.join('output', `week-${week}-designs.json`),
    reviewFile: path.join('output', `week-${week}.md`),
    baseline: path.join('output', `.week-${week}-baseline.md`),
  };
}

function checkNoUnresolvedRun(week) {
  const current = state.readState();
  if (!current) return;
  if (current.week === week) return; // resuming the same week is fine
  if (!UNRESOLVED_STATES.includes(current.state)) return;

  const ageHours = (Date.now() - new Date(current.updatedAt).getTime()) / 3600000;
  const overdue = ageHours > APPROVAL_TIMEOUT_HOURS ? ` — OVERDUE by ${(ageHours - APPROVAL_TIMEOUT_HOURS).toFixed(1)}h` : '';
  throw new Error(
    `Week ${current.week} is still ${current.state}, unresolved${overdue}. Run "node index.js approve ${current.week}" first, or resolve it by hand before starting week ${week}. Per the hard rule, this never auto-advances.`
  );
}

async function runWeek(week, { analystPath } = {}) {
  checkNoUnresolvedRun(week);
  const paths = outputPaths(week);

  state.writeState({ week, state: 'ANALYZING', auditLoopCount: 0 });
  // No analyst agent exists yet (Phase 4) — proceed with the no-data flag
  // the table specifies, rather than retrying something that can't run.
  console.log('--- Analyzing (no analyst agent yet — proceeding with no-data flag) ---');

  state.writeState({ week, state: 'PLANNING', auditLoopCount: 0 });
  console.log(`--- Planning (week ${week}) ---`);
  try {
    await strategist.run(week, analystPath, paths.plan);
  } catch (err) {
    notify(`PLANNING failed for week ${week}: ${err.message}`);
    state.writeState({ week, state: 'PLANNING_FAILED', auditLoopCount: 0 });
    throw err;
  }

  let auditLoopCount = 0;
  let audit;
  while (true) {
    state.writeState({ week, state: 'WRITING', auditLoopCount });
    console.log(`--- Writing (attempt ${auditLoopCount + 1}) ---`);
    try {
      const priorFailures = audit && audit.failures.length ? audit.failures : null;
      await copywriter.run(paths.plan, paths.copy, priorFailures);
    } catch (err) {
      notify(`WRITING failed for week ${week}: ${err.message}`);
      state.writeState({ week, state: 'WRITING_FAILED', auditLoopCount });
      throw err;
    }

    state.writeState({ week, state: 'DESIGNING', auditLoopCount });
    console.log('--- Designing ---');
    await designer.run(paths.copy, paths.designs);

    state.writeState({ week, state: 'AUDITING', auditLoopCount });
    console.log('--- Auditing ---');
    audit = await compliance.run(paths.copy, paths.audit);

    if (audit.verdict === 'PASS') break;

    auditLoopCount += 1;
    if (auditLoopCount > MAX_AUDIT_LOOPS) {
      notify(`AUDITING failed ${MAX_AUDIT_LOOPS} times for week ${week} — halting. Review ${paths.audit} by hand.`);
      state.writeState({ week, state: 'AUDITING_HALTED', auditLoopCount });
      throw new Error(`Compliance failed after ${MAX_AUDIT_LOOPS} loops.`);
    }
    console.log(`Compliance FAIL — looping back to WRITING (${auditLoopCount}/${MAX_AUDIT_LOOPS}).`);
  }

  review.run(week);
  fs.copyFileSync(paths.reviewFile, paths.baseline);

  state.writeState({ week, state: 'AWAITING_APPROVAL', auditLoopCount });
  notify(`Week ${week} is ready for review: ${paths.reviewFile}. Edit it by hand, then run "node index.js approve ${week}".`);
}

async function classifyAmendments(diffs) {
  if (diffs.length === 0) return diffs;
  const prompt = `Classify each edit below as one of: dialect, tone, length, fact, structure.
Return ONLY a JSON array of labels, same order and length as the input, no explanation.

${JSON.stringify(diffs.map(({ post, field, before, after }) => ({ post, field, before, after })), null, 2)}`;

  const text = await complete({
    model: process.env.COMPLIANCE_MODEL || 'claude-haiku-4-5-20251001',
    system: 'You classify copy edits for a content amendment log. Answer with only the JSON array requested.',
    prompt,
    maxTokens: 512,
  });
  const labels = parseJSON(text);
  return diffs.map((diff, i) => ({ ...diff, type: labels[i] || 'unclassified' }));
}

async function approve(week) {
  const paths = outputPaths(week);
  if (!fs.existsSync(paths.baseline)) {
    throw new Error(`No baseline found for week ${week} — was it ever put AWAITING_APPROVAL?`);
  }
  if (!fs.existsSync(paths.reviewFile)) {
    throw new Error(`No review file found at ${paths.reviewFile}.`);
  }

  const baselinePosts = parseReview(fs.readFileSync(paths.baseline, 'utf8'));
  const editedPosts = parseReview(fs.readFileSync(paths.reviewFile, 'utf8'));
  const diffs = diffPosts(baselinePosts, editedPosts);

  state.writeState({ week, state: 'AMENDED', auditLoopCount: 0 });

  if (diffs.length > 0) {
    console.log(`--- Classifying ${diffs.length} amendment(s) ---`);
    const classified = await classifyAmendments(diffs);
    const amendmentsPath = path.join(__dirname, '..', 'state', 'amendments.jsonl');
    const lines = classified.map((d) => JSON.stringify({ week, post: d.post, field: d.field, before: d.before, after: d.after, type: d.type }));
    fs.appendFileSync(amendmentsPath, lines.join('\n') + '\n', 'utf8');
    console.log(`Logged ${classified.length} amendment(s) to state/amendments.jsonl`);
  } else {
    console.log('No edits detected — approved as generated.');
  }

  const plan = JSON.parse(fs.readFileSync(paths.plan, 'utf8'));
  const historyPath = path.join(__dirname, '..', 'state', 'history', `week-${week}.json`);
  fs.writeFileSync(historyPath, JSON.stringify(plan, null, 2), 'utf8');
  console.log(`Saved plan to ${historyPath} for future strategist lookback.`);

  state.writeState({ week, state: 'SCHEDULING', auditLoopCount: 0 });
  notify(
    `Week ${week} approved. SCHEDULING halted — Publisher isn't built yet (Phase 4). Nothing has been auto-published. Post ${paths.reviewFile}'s content manually, or finish the Publisher agent to close this loop.`
  );
  state.writeState({ week, state: 'SCHEDULING_HALTED', auditLoopCount: 0 });
}

module.exports = { runWeek, approve, outputPaths };
