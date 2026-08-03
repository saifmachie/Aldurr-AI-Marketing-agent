const fs = require('fs');
const path = require('path');

const API_BASE = 'https://api.canva.com/rest/v1';

function authHeaders() {
  const token = process.env.CANVA_ACCESS_TOKEN;
  if (!token) {
    throw new Error('CANVA_ACCESS_TOKEN is not set.');
  }
  return { Authorization: `Bearer ${token}` };
}

async function apiRequest(method, endpoint, body) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: {
      ...authHeaders(),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Canva API ${method} ${endpoint} failed: ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

async function poll(fetchStatus, { intervalMs = 2000, timeoutMs = 60000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await fetchStatus();
    if (result.status === 'success') return result;
    if (result.status === 'failed') {
      throw new Error(`Canva job failed: ${JSON.stringify(result.error || result)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('Canva job timed out.');
}

async function uploadAsset(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const name = path.basename(filePath);
  const res = await fetch(`${API_BASE}/asset-uploads`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/octet-stream',
      'Asset-Upload-Metadata': JSON.stringify({ name_base64: Buffer.from(name).toString('base64') }),
    },
    body: fileBuffer,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Canva asset upload failed: ${res.status} ${JSON.stringify(data)}`);
  }
  const jobId = data.job.id;
  const job = await poll(async () => {
    const status = await apiRequest('GET', `/asset-uploads/${jobId}`);
    return status.job;
  });
  return job.asset.id;
}

async function autofillDesign(brandTemplateId, data) {
  const created = await apiRequest('POST', '/autofills', {
    brand_template_id: brandTemplateId,
    title: `Al Durr — ${new Date().toISOString()}`,
    data,
  });
  const jobId = created.job.id;
  const job = await poll(async () => {
    const status = await apiRequest('GET', `/autofills/${jobId}`);
    return status.job;
  });
  return job.result.design.id;
}

async function exportDesignPng(designId, destPath) {
  const created = await apiRequest('POST', '/exports', {
    design_id: designId,
    format: { type: 'png' },
  });
  const jobId = created.job.id;
  const job = await poll(async () => {
    const status = await apiRequest('GET', `/exports/${jobId}`);
    return status.job;
  });
  const url = job.urls[0];
  const res = await fetch(url);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buffer);
  return destPath;
}

module.exports = { uploadAsset, autofillDesign, exportDesignPng };
