// The one-page concept review file — v2 §6 step 2: "review the concept
// list only, 15 minutes." Deliberately terse (no full copy yet) so
// rejecting an idea costs one deleted block, not a rewrite.
function buildConceptsReview(quarter, concepts) {
  const lines = [];
  lines.push(`# Quarter ${quarter} — Concepts for review (${concepts.length} slots)\n`);
  lines.push('Delete any block you don\'t want posted. Edit any field in place.');
  lines.push(`Then run: node scripts/approve-concepts.js ${quarter}\n`);

  for (const c of concepts) {
    const title = c.type === 'occasion' ? `occasion (${c.occasion_name || 'unnamed'})` : c.type;
    lines.push(`## ${c.date} — ${c.day} — ${title}`);
    if (c.type !== 'occasion') lines.push(`Pillar: ${c.pillar || ''}`);
    lines.push(`Concept: ${c.concept || ''}`);
    if (c.needs_fact) lines.push(`NEEDS_FACT: ${c.needs_fact}`);
    else lines.push(`Fact: ${c.approved_fact || ''}`);
    lines.push(`Angle: ${c.angle || ''}`);
    lines.push(`CTA: ${c.cta_type || 'none'}`);
    lines.push(`Template: ${c.template || ''}`);
    lines.push(`Rationale: ${c.rationale || ''}`);
    if (c.skip) lines.push(`SKIP RECOMMENDED: yes`);
    lines.push('');
  }

  return lines.join('\n');
}

function field(block, name) {
  const match = block.match(new RegExp(`^${name}:[ \\t]*(.*)$`, 'm'));
  return match ? match[1].trim() : '';
}

function parseConceptsReview(markdown) {
  const blocks = markdown.split(/\n(?=## )/).filter((b) => b.trim().startsWith('## '));
  const concepts = [];

  for (const block of blocks) {
    const header = block.match(/^## (\S+) — (\S+) — (.+)$/m);
    if (!header) continue;
    const [, date, day, titleRaw] = header;
    const occasionMatch = titleRaw.match(/^occasion \((.+)\)$/);
    const type = occasionMatch ? 'occasion' : titleRaw.trim();

    concepts.push({
      date,
      day,
      type,
      occasion_name: occasionMatch ? occasionMatch[1] : null,
      pillar: field(block, 'Pillar'),
      concept: field(block, 'Concept'),
      approved_fact: field(block, 'Fact'),
      angle: field(block, 'Angle'),
      cta_type: field(block, 'CTA') || 'none',
      template: Number(field(block, 'Template')) || null,
      rationale: field(block, 'Rationale'),
    });
  }

  return concepts;
}

module.exports = { buildConceptsReview, parseConceptsReview };
