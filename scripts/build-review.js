#!/usr/bin/env node
// Assembles output/week-<week>.md — the file a human reviews and edits,
// per the approval loop in AlDurrAgentArchitecture.md §6.
// Usage: node scripts/build-review.js <week>
const fs = require('fs');
const path = require('path');

function loadIfExists(p) {
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}

function analystSection(analyst) {
  if (!analyst) {
    return '## Analyst summary\n- No analyst has run yet — cold start, no performance history.\n';
  }
  const bullets = (analyst.recommendations && analyst.recommendations.length
    ? analyst.recommendations
    : analyst.caveats || []
  )
    .map((line) => `- ${line}`)
    .join('\n');
  return `## Analyst summary\n${bullets}\n- Confidence: ${analyst.confidence}\n`;
}

function designLine(designs, day) {
  if (!designs) return '[not rendered — designer did not run]';
  const entry = designs.designs.find((d) => d.day === day);
  if (!entry) return '[no design entry]';
  return entry.status === 'rendered' ? entry.path : `[skipped — ${entry.reason}]`;
}

function postSection(post, copyPost, designs) {
  const lines = [];
  lines.push(`## ${post.day} — ${post.pillar}`);
  lines.push(`**Hook:** ${copyPost?.hook || '(copywriter did not produce this post)'}`);
  lines.push('**Copy:**');
  lines.push(copyPost?.body || '');
  lines.push(`**CTA:** ${copyPost?.cta || post.cta_type}`);
  lines.push(`**Design:** ${designLine(designs, post.day)} Template ${post.template}`);
  lines.push(`**Why this post:** ${post.rationale}`);
  return lines.join('\n');
}

function build(week, plan, copy, audit, designs) {
  const parts = [];
  parts.push(`# Week ${week} — Draft for review\n`);
  parts.push(analystSection(null));

  for (const post of plan.posts) {
    const copyPost = copy?.posts.find((p) => p.day === post.day);
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

function run(week) {
  const plan = loadIfExists(path.join('output', `week-${week}-plan.json`));
  if (!plan) throw new Error(`No plan found at output/week-${week}-plan.json — run the strategist first.`);
  const copy = loadIfExists(path.join('output', `week-${week}-copy.json`));
  const audit = loadIfExists(path.join('output', `week-${week}-audit.json`));
  const designs = loadIfExists(path.join('output', `week-${week}-designs.json`));

  const markdown = build(week, plan, copy, audit, designs);
  const outPath = path.join('output', `week-${week}.md`);
  fs.writeFileSync(outPath, markdown, 'utf8');
  console.log(`Wrote review file to ${outPath}`);
  return outPath;
}

if (require.main === module) {
  const week = process.argv[2];
  if (!week) {
    console.error('Usage: node scripts/build-review.js <week>');
    process.exit(1);
  }
  try {
    run(week);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = { run, build };
