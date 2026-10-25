// Sanity test for the 500-token / 50-overlap sliding window.  Run: npm test
const assert = require("assert");
const { encode } = require("gpt-tokenizer");
const { chunkText } = require("../lib/chunker");

const text = Array.from({ length: 400 }, (_, i) => `Sentence number ${i} talks about retrieval augmented generation.`).join(" ");
const total = encode(text).length;
const chunks = chunkText(text);

assert(chunks.length > 1, "expected multiple chunks");
chunks.slice(0, -1).forEach((c) => assert.strictEqual(c.tokenCount, 500, "full chunks must be 500 tokens"));
chunks.forEach((c, i) => i > 0 && assert.strictEqual(c.startToken - chunks[i - 1].startToken, 450, "step must be 450 (50 overlap)"));
const last = chunks[chunks.length - 1];
assert.strictEqual(last.startToken + last.tokenCount, total, "last chunk must reach the end");
assert.deepStrictEqual(chunkText(""), []);

console.log(`ok — ${total} tokens → ${chunks.length} chunks of ≤500 tokens with 50-token overlap`);
