// Step 4 — Embeddings with OpenAI text-embedding-3-small (1536 dimensions).
const OpenAI = require("openai");

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;
const BATCH_SIZE = 96;

let client;
function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    const err = new Error("OPENAI_API_KEY is not set.");
    err.status = 503;
    throw err;
  }
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

// Embed many texts, batched to stay well inside the API's request limits.
async function embedMany(texts) {
  const openai = getOpenAI();
  const out = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const res = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: batch, encoding_format: "float" });
    res.data.sort((a, b) => a.index - b.index).forEach((d) => out.push(d.embedding));
  }
  return out;
}

async function embed(text) {
  const [vector] = await embedMany([text]);
  return vector;
}

// pgvector literal: '[0.1,0.2,...]'
function toVectorLiteral(vector) {
  return `[${vector.join(",")}]`;
}

module.exports = { embed, embedMany, toVectorLiteral, getOpenAI, EMBEDDING_MODEL, EMBEDDING_DIMS };
