// Step 6 + 7 — Embed the question, cosine-search top 5 chunks, stream the answer over SSE.
// POST { docId, question, history? }  →  text/event-stream
//   event: sources  data: [{ n, id, index, similarity, content }]
//   event: token    data: { text }
//   event: done     data: { provider, model }
//   event: error    data: { error }
import { query, ensureSchema } from "../../lib/db";
import { embed } from "../../lib/embedder";
import { search, TOP_K, MIN_SIMILARITY } from "../../lib/vectorSearch";
import { streamAnswer, activeProvider, selectWithinBudget } from "../../lib/claudeRAG";

const NO_MATCH_MESSAGE =
  "I couldn't find anything in this document that's relevant enough to answer that " +
  `(no passage scored above ${MIN_SIMILARITY} cosine similarity). Try rephrasing, or ask about a topic the document covers.`;
import { sendError } from "../../lib/http";

export const config = { maxDuration: 60 };

function send(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { docId, question, history } = req.body || {};
  const q = typeof question === "string" ? question.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(String(docId || "")) || !q) return res.status(400).json({ error: "docId and question are required" });
  if (q.length > 2000) return res.status(400).json({ error: "Question is too long (max 2000 characters)." });

  let chunks;
  try {
    await ensureSchema();
    const doc = (await query("SELECT id, status FROM documents WHERE id = $1", [String(docId)])).rows[0];
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (doc.status !== "ready") return res.status(409).json({ error: `Document is not ready yet (status: ${doc.status}).` });

    const qVec = await embed(q); // embed question with the same model as the chunks
    const hits = await search(qVec, doc.id, TOP_K); // cosine similarity, top 5, above threshold
    chunks = selectWithinBudget(hits).picked; // token budget guard
  } catch (err) {
    return sendError(res, err);
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders && res.flushHeaders();

  send(
    res,
    "sources",
    chunks.map((c, i) => ({ n: i + 1, id: c.id, index: c.index, similarity: c.similarity, content: c.content }))
  );

  let aborted = false;
  req.on("close", () => {
    aborted = true;
  });

  if (chunks.length === 0) {
    // Nothing relevant enough: answer honestly instead of sending weak context to the LLM.
    send(res, "token", { text: NO_MATCH_MESSAGE });
    send(res, "done", { ...activeProvider(), noMatch: true });
    return res.end();
  }

  try {
    for await (const text of streamAnswer(q, chunks, Array.isArray(history) ? history : [])) {
      if (aborted) break;
      send(res, "token", { text });
    }
    send(res, "done", activeProvider());
  } catch (err) {
    console.error(err);
    send(res, "error", { error: err.message || "Generation failed" });
  }
  res.end();
}
