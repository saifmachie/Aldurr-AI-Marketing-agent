#!/usr/bin/env node
// Phase 2 agent — deterministic, no LLM. Run by hand:
// node agents/designer.js <copy.json> [output.json]
//
// Non-negotiable per the architecture spec: no image model renders Arabic
// text. All Arabic text is set by Canva's autofill API into a real
// Cairo-font template — this script only calls Canva, it never generates
// text or images itself.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const config = require('../lib/config-loader');
const canva = require('../lib/canva');

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'assets', 'screenshots');

function findTemplate(templates, number) {
  return templates[String(number)];
}

async function renderPost(post, templates, designsDir) {
  const template = findTemplate(templates, post.design_brief?.template);
  if (!template) {
    return { day: post.day, status: 'skipped', reason: `No template ${post.design_brief?.template} in config/templates.json` };
  }
  if (!template.canva_brand_template_id || template.canva_brand_template_id.startsWith('REPLACE_')) {
    return { day: post.day, status: 'skipped', reason: `Template "${template.name}" has no real Canva brand template ID yet — build it in Canva first (see config/agent-spec.md).` };
  }
  if (!process.env.CANVA_ACCESS_TOKEN) {
    return { day: post.day, status: 'skipped', reason: 'CANVA_ACCESS_TOKEN not set.' };
  }

  const data = {};
  for (const [key, field] of Object.entries(template.fields)) {
    if (field.type === 'text') {
      const value = key === 'headline' ? post.design_brief.headline : post.design_brief.supporting_line;
      if (value) data[field.canva_field] = { type: 'text', text: value };
    }
    if (field.type === 'image' && post.design_brief.screenshot) {
      const screenshotPath = path.join(SCREENSHOTS_DIR, post.design_brief.screenshot);
      if (!fs.existsSync(screenshotPath)) {
        return { day: post.day, status: 'skipped', reason: `Screenshot "${post.design_brief.screenshot}" not found in assets/screenshots/.` };
      }
      const assetId = await canva.uploadAsset(screenshotPath);
      data[field.canva_field] = { type: 'image', asset_id: assetId };
    }
  }

  try {
    const designId = await canva.autofillDesign(template.canva_brand_template_id, data);
    const destPath = path.join(designsDir, `${post.day.toLowerCase()}.png`);
    await canva.exportDesignPng(designId, destPath);
    return { day: post.day, status: 'rendered', path: destPath, template: template.name };
  } catch (err) {
    return { day: post.day, status: 'skipped', reason: err.message };
  }
}

async function run(copyPath, outPath) {
  const copy = JSON.parse(fs.readFileSync(copyPath, 'utf8'));
  const templates = config.templates();
  const designsDir = path.join('output', 'designs', `week-${copy.week}`);

  const results = [];
  for (const post of copy.posts) {
    const result = await renderPost(post, templates, designsDir);
    results.push(result);
    if (result.status === 'rendered') {
      console.log(`  [${result.day}] rendered -> ${result.path}`);
    } else {
      console.warn(`  [${result.day}] skipped — ${result.reason}`);
    }
  }

  fs.writeFileSync(outPath, JSON.stringify({ week: copy.week, designs: results }, null, 2), 'utf8');
  console.log(`Wrote design results to ${outPath}`);
  return { week: copy.week, designs: results };
}

if (require.main === module) {
  const copyPath = process.argv[2];
  if (!copyPath) {
    console.error('Usage: node agents/designer.js <copy.json> [output.json]');
    process.exit(1);
  }
  const defaultOut = path.join('output', path.basename(copyPath).replace(/\.json$/, '') + '-designs.json');
  const outPath = process.argv[3] || defaultOut;
  run(copyPath, outPath).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { run };
