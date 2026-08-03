// Despite the filename (kept for import stability across the agents),
// this now supports a provider switch — LLM_PROVIDER=gemini or groq routes
// every agent through a free tier instead of Claude, for testing the
// pipeline's mechanics without spending API credits. Dialect quality on
// either won't match Claude — see docs/AlDurrAgentArchitecture.md §5's own
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

async function completeGroq({ system, prompt, maxTokens }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not set (required when LLM_PROVIDER=groq). Get one free at console.groq.com/keys.');
  }
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      max_tokens: maxTokens,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Groq API error: ${res.status} ${JSON.stringify(data)}`);
  }
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error(`Groq returned no usable text: ${JSON.stringify(data)}`);
  }
  return text;
}

async function complete({ model, system, prompt, maxTokens = 4096 }) {
  const provider = process.env.LLM_PROVIDER || 'anthropic';
  if (provider === 'gemini') {
    return completeGemini({ system, prompt, maxTokens });
  }
  if (provider === 'groq') {
    return completeGroq({ system, prompt, maxTokens });
  }
  return completeAnthropic({ model, system, prompt, maxTokens });
}

function parseJSON(text) {
  const trimmed = text.trim();

  // Fast path: models that actually follow "return ONLY JSON" (Claude
  // reliably does).
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through
  }

  // A complete ```json ... ``` fence.
  const closed = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (closed) {
    try {
      return JSON.parse(closed[1].trim());
    } catch {
      // fall through — e.g. a closing fence for a nested example, not the
      // real payload
    }
  }

  // Cut off before a closing fence (hit a token-limit ceiling mid-output).
  const openOnly = trimmed.match(/^```(?:json)?\s*([\s\S]*)$/);
  if (openOnly) {
    try {
      return JSON.parse(openOnly[1].trim());
    } catch {
      // fall through
    }
  }

  // Smaller/open models often prepend prose ("Here are the posts...")
  // despite being told not to. Slice out the first bracket-to-last-matching-
  // bracket span and try that.
  const firstBracket = trimmed.search(/[[{]/);
  const lastBracket = Math.max(trimmed.lastIndexOf(']'), trimmed.lastIndexOf('}'));
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    return JSON.parse(trimmed.slice(firstBracket, lastBracket + 1));
  }

  // Nothing worked — surface the clearest possible error rather than a
  // confusing "Unexpected token" pointed at stray prose.
  throw new Error(`Could not find valid JSON in model response: ${trimmed.slice(0, 200)}...`);
}

module.exports = { complete, parseJSON };
