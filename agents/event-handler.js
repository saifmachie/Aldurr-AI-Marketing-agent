#!/usr/bin/env node
// v2 event handler — one flow, many event types:
// EVENT -> BRIEF -> COPY -> COMPLIANCE -> YOU APPROVE -> PUBLISH
// For anything unpredictable (a vacancy, a milestone, a new feature) rather
// than the quarterly evergreen/occasion batch.
//
// Usage: node agents/event-handler.js <event-type> <data.json>
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { complete, parseJSON } = require('../lib/anthropic');
const config = require('../lib/config-loader');
const compliance = require('./compliance');

const MODEL = process.env.COPYWRITER_MODEL || 'claude-sonnet-5';
const EVENTS_CONFIG_PATH = path.join(__dirname, '..', 'config', 'events.json');
const MAX_AUDIT_LOOPS = 2;

function loadEventTypes() {
  return JSON.parse(fs.readFileSync(EVENTS_CONFIG_PATH, 'utf8'));
}

function brief(eventType, eventData) {
  const eventTypes = loadEventTypes();
  const spec = eventTypes[eventType];
  if (!spec) {
    throw new Error(`Unknown event type "${eventType}". Known types: ${Object.keys(eventTypes).join(', ')}`);
  }
  const missing = spec.required_data.filter((field) => !eventData[field]);
  if (missing.length) {
    throw new Error(`Event "${eventType}" is missing required data: ${missing.join(', ')}`);
  }
  if (spec.extra_step) {
    console.warn(`REMINDER: ${spec.extra_step}`);
  }
  return { eventType, channels: spec.channels, data: eventData };
}

const SYSTEM_PROMPT = `You write a single Arabic social post for Al Durr Supplies, triggered by a
real business event (a new hire posting, a shipped feature, an expanded
coverage area, a milestone) rather than the regular evergreen/occasion batch.

DIALECT: Iraqi Arabic as an educated Baghdad professional writes it — MSA
backbone with natural Iraqi colloquial where it reads warmer.

VOICE: direct, practical, serious. Short sentences.

ABSOLUTE: no emoji. No pricing. No traction numbers beyond what's explicitly
approved in the event data. No iOS claims. No named competitors. No named
suppliers. No team members or founder story. No testimonials.

--- BRAND BRIEF (source of truth for approved facts and hard rules) ---
${config.brandBrief()}

--- DIALECT LEXICON (only these colloquial terms are pre-cleared) ---
${config.dialectLexicon()}

Return ONLY JSON:
{
  "hook": "",
  "body": "",
  "cta": "",
  "design_brief": { "template": <1-4>, "headline": "", "supporting_line": "", "screenshot": "" },
  "hashtags": ["", "", "", "", ""]
}`;

async function writeCopy(eventBrief, priorFailures) {
  const failuresBlock = priorFailures && priorFailures.length
    ? `\n\nThe previous draft failed compliance. Fix these specific violations:\n${JSON.stringify(priorFailures, null, 2)}`
    : '';

  const prompt = `Event type: ${eventBrief.eventType}
Channels: ${eventBrief.channels.join(', ')}
Event data:
${JSON.stringify(eventBrief.data, null, 2)}${failuresBlock}`;

  const text = await complete({ model: MODEL, system: SYSTEM_PROMPT, prompt, maxTokens: 2048 });
  return parseJSON(text);
}

async function runEvent(eventType, eventData, eventId) {
  const eventBrief = brief(eventType, eventData);

  let auditLoopCount = 0;
  let audit;
  let post;
  const copyPath = path.join('output', `event-${eventId}-copy.json`);
  const auditPath = path.join('output', `event-${eventId}-audit.json`);

  while (true) {
    const priorFailures = audit && audit.failures.length ? audit.failures : null;
    post = await writeCopy(eventBrief, priorFailures);
    fs.writeFileSync(copyPath, JSON.stringify({ eventId, eventType, posts: [{ date: eventId, ...post }] }, null, 2), 'utf8');

    audit = await compliance.run(copyPath, auditPath);
    if (audit.verdict === 'PASS') break;

    auditLoopCount += 1;
    if (auditLoopCount > MAX_AUDIT_LOOPS) {
      throw new Error(`Compliance failed ${MAX_AUDIT_LOOPS} times for event ${eventId}. Review ${auditPath} by hand.`);
    }
    console.log(`Compliance FAIL — rewriting (${auditLoopCount}/${MAX_AUDIT_LOOPS}).`);
  }

  const briefPath = path.join('output', `event-${eventId}-brief.json`);
  fs.writeFileSync(briefPath, JSON.stringify(eventBrief, null, 2), 'utf8');

  console.log(`Event ${eventId} (${eventType}) passed compliance. Review ${copyPath}, then run "node index.js approve-event ${eventId}" to publish to ${eventBrief.channels.join(' + ')}.`);
  return { eventBrief, post, copyPath, auditPath, briefPath };
}

async function approveEvent(eventId) {
  const copyPath = path.join('output', `event-${eventId}-copy.json`);
  const briefPath = path.join('output', `event-${eventId}-brief.json`);
  if (!fs.existsSync(copyPath) || !fs.existsSync(briefPath)) {
    throw new Error(`No pending event found for "${eventId}" — run runEvent first.`);
  }

  const copy = JSON.parse(fs.readFileSync(copyPath, 'utf8'));
  const eventBrief = JSON.parse(fs.readFileSync(briefPath, 'utf8'));
  const post = copy.posts[0];

  const results = {};
  for (const channel of eventBrief.channels) {
    if (channel === 'facebook' && graphApiConfigured()) {
      results.facebook = await publishFacebookNow(post);
    } else if (channel === 'instagram' && graphApiConfigured()) {
      results.instagram = await publishInstagramNow(post);
    } else {
      console.warn(`  [${channel}] not wired up — post this manually: ${post.hook}`);
      results[channel] = 'manual';
    }
  }
  return results;
}

function graphApiConfigured() {
  return Boolean(process.env.FACEBOOK_PAGE_ID && process.env.FACEBOOK_PAGE_ACCESS_TOKEN);
}

async function publishFacebookNow(post) {
  const graph = require('../lib/graph-api');
  const caption = `${post.hook}\n\n${post.body}\n\n${(post.hashtags || []).join(' ')}`;
  const result = await graph.scheduleFacebookPost({
    pageId: process.env.FACEBOOK_PAGE_ID,
    accessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
    message: caption,
    scheduledUnixTime: Math.floor(Date.now() / 1000) + 60, // ~immediately
    imageBuffer: null,
  });
  console.log(`  [facebook] posted -> ${result.id || result.post_id}`);
  return result;
}

async function publishInstagramNow() {
  console.warn('  [instagram] event posts need a rendered design first (Designer isn\'t wired into the event flow yet) — post manually.');
  return 'manual';
}

if (require.main === module) {
  const [eventType, dataPath] = process.argv.slice(2);
  if (!eventType || !dataPath) {
    console.error('Usage: node agents/event-handler.js <event-type> <data.json>');
    process.exit(1);
  }
  const eventData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const eventId = `${eventType}-${Date.now()}`;
  runEvent(eventType, eventData, eventId).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { brief, writeCopy, runEvent, approveEvent, loadEventTypes };
