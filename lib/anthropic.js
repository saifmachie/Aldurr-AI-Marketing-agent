// Despite the filename (kept for import stability across the agents),
// this now supports a provider switch — LLM_PROVIDER=gemini routes every
// agent through Google's free tier instead of Claude, for testing the
// pipeline's mechanics without spending API credits. Dialect quality on
// Gemini won't match Claude — see docs/AlDurrAgentArchitecture.md §5's own
// bake-off requirement — treat it as a plumbing test, not a copy preview.
const Anthropic = require('@anthropic-ai/sdk');

function anthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Copy .env.example to .env and fill it in.'
    );
  }
  return new Anthropic({ apiKey });
}

async function completeAnthropic({ model, system, prompt, maxTokens }) {
  const anthropic = anthropicClient();
  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

async function completeGemini({ system, prompt, maxTokens }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set (required when LLM_PROVIDER=gemini). Get one free at ai.google.dev.');
  }
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.status} ${JSON.stringify(data)}`);
  }
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('\n');
  if (!text) {
    throw new Error(`Gemini returned no usable text: ${JSON.stringify(data)}`);
  }
  return text;
}

async function complete({ model, system, prompt, maxTokens = 4096 }) {
  const provider = process.env.LLM_PROVIDER || 'anthropic';
  if (provider === 'gemini') {
    return completeGemini({ system, prompt, maxTokens });
  }
  return completeAnthropic({ model, system, prompt, maxTokens });
}

function parseJSON(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  return JSON.parse(raw.trim());
}

module.exports = { complete, parseJSON };
