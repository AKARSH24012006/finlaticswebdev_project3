// Step 7 — Answer generation: Claude + retrieved context, streamed token by token.
// Uses Anthropic Claude when ANTHROPIC_API_KEY is set; otherwise falls back to
// an OpenAI chat model so the app still works with a single OpenAI key.
const Anthropic = require("@anthropic-ai/sdk");
const { getOpenAI } = require("./embedder");

const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

const SYSTEM_PROMPT = `You are a careful research assistant answering questions about ONE uploaded PDF.
Rules:
- Answer ONLY from the numbered context excerpts provided. Do not use outside knowledge.
- Cite every claim with the excerpt number in square brackets, e.g. [1] or [2][4].
- If the excerpts do not contain the answer, say so plainly ("The document doesn't say…") and suggest what to ask instead.
- Be concise and well structured. Use short paragraphs or bullet points where it helps.`;

function buildContext(chunks) {
  return chunks
    .map((c, i) => `[${i + 1}] (chunk #${c.index + 1}, similarity ${c.similarity.toFixed(3)})\n${c.content}`)
    .join("\n\n---\n\n");
}

function buildMessages(question, chunks, history = []) {
  const prior = history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
    .slice(-6)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
  const userTurn = `Context excerpts from the document:\n\n${buildContext(chunks)}\n\n---\n\nQuestion: ${question}`;
  return [...prior, { role: "user", content: userTurn }];
}

function activeProvider() {
  if (process.env.ANTHROPIC_API_KEY) return { provider: "anthropic", model: CLAUDE_MODEL };
  if (process.env.OPENAI_API_KEY) return { provider: "openai", model: OPENAI_CHAT_MODEL };
  return { provider: null, model: null };
}

// Async generator yielding text deltas.
async function* streamAnswer(question, chunks, history = []) {
  const messages = buildMessages(question, chunks, history);
  const { provider, model } = activeProvider();

  if (provider === "anthropic") {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const stream = anthropic.messages.stream({ model, max_tokens: 1024, system: SYSTEM_PROMPT, messages });
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
    return;
  }

  if (provider === "openai") {
    const openai = getOpenAI();
    const stream = await openai.chat.completions.create({
      model,
      stream: true,
      temperature: 0.2,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    });
    for await (const part of stream) {
      const delta = part.choices && part.choices[0] && part.choices[0].delta && part.choices[0].delta.content;
      if (delta) yield delta;
    }
    return;
  }

  const err = new Error("No LLM key configured. Set ANTHROPIC_API_KEY (Claude) or OPENAI_API_KEY.");
  err.status = 503;
  throw err;
}

// Kept for backwards compatibility with the starter kit's signature.
async function getAnswer(query, chunks) {
  let text = "";
  for await (const t of streamAnswer(query, chunks)) text += t;
  return text;
}

module.exports = { streamAnswer, getAnswer, activeProvider, SYSTEM_PROMPT };
