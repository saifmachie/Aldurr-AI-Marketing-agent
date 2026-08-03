#!/usr/bin/env node
// v2 — much simpler than the weekly-loop orchestrator it replaces (per
// docs/AlDurrSocialSystemv2.md §8: "Keep — much simpler, no weekly state
// machine"). Two human gates per quarter instead of one per week:
//   1. Concepts approval (before any copy is written)
//   2. Full-batch approval (after copy/design/compliance)
// Plus the event handler's own single-post approval, separate from both.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const state = require('../lib/state');
const { notify } = require('../lib/notify');
const { parseReview, diffPosts } = require('../lib/diff-review');
const { complete, parseJSON } = require('../lib/anthropic');
const planQuarterScript = require('../scripts/plan-quarter');
const approveConceptsScript = require('../scripts/approve-concepts');
const copywriter = require('./copywriter');
const compliance = require('./compliance');
const designer = require('./designer');
const publisher = require('./publisher');
const review = require('../scripts/build-review');

const MAX_AUDIT_LOOPS = 2;

function outputPaths(quarter) {
  return {
    concepts: path.join('output', `quarter-${quarter}-concepts.json`),
    conceptsReview: path.join('output', `quarter-${quarter}-concepts.md`),
    plan: path.join('output', `quarter-${quarter}-plan.json`),
    copy: path.join('output', `quarter-${quarter}-copy.json`),
    audit: path.join('output', `quarter-${quarter}-audit.json`),
    designs: path.join('output', `quarter-${quarter}-designs.json`),
    reviewFile: path.join('output', `quarter-${quarter}.md`),
    baseline: path.join('output', `.quarter-${quarter}-baseline.md`),
  };
}

async function planQuarter(quarter, { limit } = {}) {
  state.writeState({ quarter, state: 'PLANNING' });
  const reviewPath = await planQuarterScript.run(quarter, { limit });
  state.writeState({ quarter, state: 'AWAITING_CONCEPT_APPROVAL' });
  notify(`Quarter ${quarter}'s concepts are ready: ${reviewPath}. Review (~15 min), then run "node index.js approve-concepts ${quarter}".`);
  return reviewPath;
}

async function approveConcepts(quarter) {
  const paths = outputPaths(quarter);
  approveConceptsScript.run(quarter); // writes paths.plan from the edited concepts file
  state.writeState({ quarter, state: 'CONCEPTS_APPROVED' });

  let auditLoopCount = 0;
  let audit;
  while (true) {
    state.writeState({ quarter, state: 'WRITING', auditLoopCount });
    console.log(`--- Writing (attempt ${auditLoopCount + 1}) ---`);
    const priorFailures = audit && audit.failures.length ? audit.failures : null;
    await copywriter.run(paths.plan, paths.copy, priorFailures);

    state.writeState({ quarter, state: 'DESIGNING', auditLoopCount });
    console.log('--- Designing ---');
    await designer.run(paths.copy, paths.designs);

    state.writeState({ quarter, state: 'AUDITING', auditLoopCount });
    console.log('--- Auditing ---');
    audit = await compliance.run(paths.copy, paths.audit);

    if (audit.verdict === 'PASS') break;

    auditLoopCount += 1;
    if (auditLoopCount > MAX_AUDIT_LOOPS) {
      notify(`AUDITING failed ${MAX_AUDIT_LOOPS} times for quarter ${quarter} — halting. Review ${paths.audit} by hand.`);
      state.writeState({ quarter, state: 'AUDITING_HALTED', auditLoopCount });
      throw new Error(`Compliance failed after ${MAX_AUDIT_LOOPS} loops.`);
    }
    console.log(`Compliance FAIL — looping back to WRITING (${auditLoopCount}/${MAX_AUDIT_LOOPS}).`);
  }

  review.run(quarter);
  fs.copyFileSync(paths.reviewFile, paths.baseline);

  state.writeState({ quarter, state: 'AWAITING_BATCH_APPROVAL', auditLoopCount });
  notify(`Quarter ${quarter}'s full batch is ready: ${paths.reviewFile}. Edit it by hand, then run "node index.js approve-batch ${quarter}".`);
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

async function approveBatch(quarter) {
  const paths = outputPaths(quarter);
  if (!fs.existsSync(paths.baseline)) {
    throw new Error(`No baseline found for quarter ${quarter} — was it ever put AWAITING_BATCH_APPROVAL?`);
  }
  if (!fs.existsSync(paths.reviewFile)) {
    throw new Error(`No review file found at ${paths.reviewFile}.`);
  }

  const baselinePosts = parseReview(fs.readFileSync(paths.baseline, 'utf8'));
  const editedPosts = parseReview(fs.readFileSync(paths.reviewFile, 'utf8'));
  const diffs = diffPosts(baselinePosts, editedPosts);

  state.writeState({ quarter, state: 'AMENDED' });

  if (diffs.length > 0) {
    console.log(`--- Classifying ${diffs.length} amendment(s) ---`);
    const classified = await classifyAmendments(diffs);
    const amendmentsPath = path.join(__dirname, '..', 'state', 'amendments.jsonl');
    const lines = classified.map((d) => JSON.stringify({ quarter, post: d.post, field: d.field, before: d.before, after: d.after, type: d.type }));
    fs.appendFileSync(amendmentsPath, lines.join('\n') + '\n', 'utf8');
    console.log(`Logged ${classified.length} amendment(s) to state/amendments.jsonl`);
  } else {
    console.log('No edits detected — approved as generated.');
  }

  const concepts = JSON.parse(fs.readFileSync(paths.concepts, 'utf8'));
  const historyPath = path.join(__dirname, '..', 'state', 'history', `quarter-${quarter}.json`);
  fs.writeFileSync(historyPath, JSON.stringify(concepts, null, 2), 'utf8');
  console.log(`Saved concepts to ${historyPath} for future strategist lookback.`);

  state.writeState({ quarter, state: 'QUEUEING' });
  const { queued, skipped } = await publisher.queueBatch(quarter);
  if (skipped) {
    notify(`Quarter ${quarter} approved. Publisher isn't configured (no Facebook/Instagram credentials) — nothing auto-published. Post ${paths.reviewFile}'s content manually.`);
    state.writeState({ quarter, state: 'QUEUE_SKIPPED' });
  } else {
    notify(`Quarter ${quarter} approved and ${queued} posts queued. Facebook is scheduled natively; run "node index.js publish-due" daily (or via cron) to publish Instagram posts as they come due.`);
    state.writeState({ quarter, state: 'QUEUED' });
  }
}

module.exports = { planQuarter, approveConcepts, approveBatch, outputPaths };
