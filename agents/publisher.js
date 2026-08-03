#!/usr/bin/env node
// Deterministic, no LLM. Runs only after explicit human approval — never
// publishes immediately on its own, per the architecture doc's hard rule.
//
// Facebook Page posts schedule natively (queue once, done). Instagram's
// Graph API has no native scheduling, so Instagram posts are queued to
// state/publish-queue.jsonl and published when due by a separate command
// meant to run daily — much lighter than a full state machine, per v2's
// own note that the orchestrator gets simpler, not more complex.
//
// Usage:
//   node agents/publisher.js queue <quarter>
//   node agents/publisher.js publish-due
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const graph = require('../lib/graph-api');
const canva = require('../lib/canva');

const QUEUE_PATH = path.join(__dirname, '..', 'state', 'publish-queue.jsonl');
const PUBLISH_HOUR_UTC = 6; // 09:00 Baghdad (UTC+3, no DST)

function loadIfExists(p) {
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}

function readQueue() {
  if (!fs.existsSync(QUEUE_PATH)) return [];
  return fs
    .readFileSync(QUEUE_PATH, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function writeQueue(entries) {
  fs.mkdirSync(path.dirname(QUEUE_PATH), { recursive: true });
  fs.writeFileSync(QUEUE_PATH, entries.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');
}

function scheduledUnixTime(dateStr) {
  return Math.floor(new Date(`${dateStr}T${String(PUBLISH_HOUR_UTC).padStart(2, '0')}:00:00Z`).getTime() / 1000);
}

function configured() {
  return Boolean(
    process.env.FACEBOOK_PAGE_ID &&
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN &&
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID
  );
}

async function queueBatch(quarter) {
  if (!configured()) {
    console.warn(
      'FACEBOOK_PAGE_ID / FACEBOOK_PAGE_ACCESS_TOKEN / INSTAGRAM_BUSINESS_ACCOUNT_ID not set — nothing queued. Post this batch manually until the Meta app is set up.'
    );
    return { queued: 0, skipped: true };
  }

  const plan = loadIfExists(path.join('output', `quarter-${quarter}-plan.json`));
  const copy = loadIfExists(path.join('output', `quarter-${quarter}-copy.json`));
  const designs = loadIfExists(path.join('output', `quarter-${quarter}-designs.json`));
  if (!plan || !copy) throw new Error(`Missing plan/copy for quarter ${quarter} — run the full pipeline first.`);

  const pageId = process.env.FACEBOOK_PAGE_ID;
  const pageToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

  const queue = readQueue();
  let queuedCount = 0;

  for (const post of plan.posts) {
    const copyPost = copy.posts.find((p) => p.date === post.date);
    if (!copyPost || !copyPost.hook) continue; // skipped by copywriter (e.g. needs_approved_fact)

    const design = designs?.designs.find((d) => d.date === post.date);
    const caption = `${copyPost.hook}\n\n${copyPost.body}\n\n${(copyPost.hashtags || []).join(' ')}`;
    const scheduledTime = scheduledUnixTime(post.date);

    let imageBuffer = null;
    if (design?.status === 'rendered' && fs.existsSync(design.path)) {
      imageBuffer = fs.readFileSync(design.path);
    }

    const fbResult = await graph.scheduleFacebookPost({
      pageId,
      accessToken: pageToken,
      message: caption,
      scheduledUnixTime: scheduledTime,
      imageBuffer,
    });
    console.log(`  [${post.date}] Facebook scheduled -> ${fbResult.id || fbResult.post_id}`);

    queue.push({
      date: post.date,
      quarter,
      platform: 'instagram',
      igUserId,
      accessToken: pageToken,
      canvaDesignId: design?.canvaDesignId || null,
      caption,
      status: 'queued',
    });
    queuedCount += 1;
  }

  writeQueue(queue);
  console.log(`Queued ${queuedCount} posts. Facebook is scheduled natively; Instagram will publish via "publish-due" on or after each post's date.`);
  return { queued: queuedCount, skipped: false };
}

async function publishDueInstagramPosts(now = new Date()) {
  if (!configured()) {
    console.warn('Instagram publishing not configured — nothing to do.');
    return { published: 0 };
  }

  const queue = readQueue();
  const today = now.toISOString().slice(0, 10);
  let publishedCount = 0;

  for (const entry of queue) {
    if (entry.status !== 'queued' || entry.date > today) continue;
    try {
      const imageUrl = await canva.getExportUrl(entry.canvaDesignId);
      const result = await graph.publishInstagramPost({
        igUserId: entry.igUserId,
        accessToken: entry.accessToken,
        imageUrl,
        caption: entry.caption,
      });
      entry.status = 'published';
      entry.publishedPostId = result.id;
      console.log(`  [${entry.date}] Instagram published -> ${result.id}`);
      publishedCount += 1;
    } catch (err) {
      entry.status = 'failed';
      entry.error = err.message;
      console.error(`  [${entry.date}] Instagram publish FAILED: ${err.message}`);
    }
  }

  writeQueue(queue);
  console.log(`Published ${publishedCount} due Instagram post(s).`);
  return { published: publishedCount };
}

if (require.main === module) {
  const [command, arg] = process.argv.slice(2);
  const run = async () => {
    if (command === 'queue') {
      if (!arg) throw new Error('Usage: node agents/publisher.js queue <quarter>');
      await queueBatch(arg);
    } else if (command === 'publish-due') {
      await publishDueInstagramPosts();
    } else {
      throw new Error('Usage:\n  node agents/publisher.js queue <quarter>\n  node agents/publisher.js publish-due');
    }
  };
  run().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { queueBatch, publishDueInstagramPosts, configured };
