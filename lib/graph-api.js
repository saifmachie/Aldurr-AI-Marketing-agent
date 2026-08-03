// Meta Graph API helpers. Facebook Page posts support true native
// scheduling (schedule once, Meta's servers hold it) — Instagram's Content
// Publishing API does NOT support scheduled_publish_time; a container must
// be published immediately once created. That's a real platform limit, not
// a gap in this code: Instagram posts have to be triggered at/near their
// actual publish time, which is what publishDueInstagramPosts() is for.
const API_BASE = 'https://graph.facebook.com/v19.0';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

async function apiRequest(method, endpoint, body) {
  const url = `${API_BASE}${endpoint}`;
  const options = { method };
  if (body instanceof FormData) {
    options.body = body;
  } else if (body) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Graph API ${method} ${endpoint} failed: ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

// Schedules a Facebook Page post natively (up to ~6 months ahead in one
// call) — this is genuine "queue and forget," matching v2's bulk scheduling.
async function scheduleFacebookPost({ pageId, accessToken, message, scheduledUnixTime, imageBuffer }) {
  if (imageBuffer) {
    const form = new FormData();
    form.append('message', message);
    form.append('published', 'false');
    form.append('scheduled_publish_time', String(scheduledUnixTime));
    form.append('source', new Blob([imageBuffer]), 'post.png');
    form.append('access_token', accessToken);
    return apiRequest('POST', `/${pageId}/photos`, form);
  }
  return apiRequest('POST', `/${pageId}/feed`, {
    message,
    published: false,
    scheduled_publish_time: scheduledUnixTime,
    access_token: accessToken,
  });
}

// Publishes to Instagram NOW. Must be called at/near the post's actual
// scheduled time — see the comment at the top of this file.
async function publishInstagramPost({ igUserId, accessToken, imageUrl, caption }) {
  const container = await apiRequest('POST', `/${igUserId}/media`, {
    image_url: imageUrl,
    caption,
    access_token: accessToken,
  });
  return apiRequest('POST', `/${igUserId}/media_publish`, {
    creation_id: container.id,
    access_token: accessToken,
  });
}

module.exports = { scheduleFacebookPost, publishInstagramPost, requireEnv };
