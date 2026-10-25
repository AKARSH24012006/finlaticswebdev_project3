// Step 3 — Token-based chunking: 500 tokens per chunk, 50 tokens overlap.
// Uses the cl100k_base tokenizer (same family as OpenAI's embedding models),
// so "500 tokens" means 500 real model tokens, not characters.
const { encode, decode } = require("gpt-tokenizer");

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

function chunkText(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  if (overlap >= size) throw new Error("overlap must be smaller than chunk size");
  const tokens = encode(text || "");
  const chunks = [];
  if (tokens.length === 0) return chunks;

  const step = size - overlap; // 450 → each chunk re-uses the last 50 tokens of the previous one
  for (let start = 0; start < tokens.length; start += step) {
    const slice = tokens.slice(start, start + size);
    const content = decode(slice).trim();
    if (content) {
      chunks.push({ index: chunks.length, content, tokenCount: slice.length, startToken: start });
    }
    if (start + size >= tokens.length) break; // last window reached the end
  }
  return chunks;
}

module.exports = { chunkText, CHUNK_SIZE, CHUNK_OVERLAP };
