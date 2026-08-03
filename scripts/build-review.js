#!/usr/bin/env node
// Assembles output/quarter-<id>.md — the full-batch review file for v2 §6
// step 6 ("YOU review the full batch, amend"). This is the second human
// gate, after concepts were already approved and copy/design/compliance ran
// on the approved batch.
// Usage: node scripts/build-review.js <quarter>
const fs = require('fs');
const path = require('path');

function loadIfExists(p) {
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}

function designLine(designs, date) {
  if (!designs) return '[not rendered — designer did not run]';
  const entry = designs.designs.find((d) => d.date === date);
  if (!entry) return '[no design entry]';
  return entry.status === 'rendered' ? entry.path : `[skipped — ${entry.reason}]`;
}

function postSection(post, copyPost, designs) {
  const title = post.type === 'occasion' ? `occasion (${post.occasion_name || copyPost?.pillar || ''})` : post.pillar;
  const lines = [];
  lines.push(`## ${post.date} — ${post.day} — ${title}`);
  lines.push(`**Hook:** ${copyPost?.hook || '(copywriter did not produce this post)'}`);
  lines.push('**Copy:**');
  lines.push(copyPost?.body || '');
  lines.push(`**CTA:** ${copyPost?.cta || post.cta_type}`);
  lines.push(`**Design:** ${designLine(designs, post.date)} Template ${post.template}`);
  lines.push(`**Why this post:** ${post.rationale}`);
  return lines.join('\n');
}

function build(quarter, plan, copy, audit, designs) {
  const parts = [];
  parts.push(`# Quarter ${quarter} — Full batch draft for review (${plan.posts.length} posts)\n`);

  for (const post of plan.posts) {
    const copyPost = copy?.posts.find((p) => p.date === post.date);
    parts.push(postSection(post, copyPost, designs));
    parts.push('---');
  }

  parts.push(`## Compliance: ${audit ? audit.verdict : 'NOT RUN'}`);
  if (audit && audit.failures && audit.failures.length) {
    for (const f of audit.failures) {
      parts.push(`- [${f.post}] rule ${f.rule}: ${f.reason} — "${f.quote}"`);
    }
  }
  parts.push('\n## Your edits below this line — leave the rest untouched\n');

  return parts.join('\n');
}

function run(quarter) {
  const plan = loadIfExists(path.join('output', `quarter-${quarter}-plan.json`));
  if (!plan) throw new Error(`No approved plan found at output/quarter-${quarter}-plan.json — run scripts/approve-concepts.js first.`);
  const copy = loadIfExists(path.join('output', `quarter-${quarter}-copy.json`));
  const audit = loadIfExists(path.join('output', `quarter-${quarter}-audit.json`));
  const designs = loadIfExists(path.join('output', `quarter-${quarter}-designs.json`));

  const markdown = build(quarter, plan, copy, audit, designs);
  const outPath = path.join('output', `quarter-${quarter}.md`);
  fs.writeFileSync(outPath, markdown, 'utf8');
  console.log(`Wrote review file to ${outPath}`);
  return outPath;
}

if (require.main === module) {
  const quarter = process.argv[2];
  if (!quarter) {
    console.error('Usage: node scripts/build-review.js <quarter>');
    process.exit(1);
  }
  try {
    run(quarter);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = { run, build };
