// GET — which parts of the pipeline are configured (no secrets are returned)
import { ensureSchema } from "../../lib/db";
import { activeProvider } from "../../lib/claudeRAG";
import { EMBEDDING_MODEL } from "../../lib/embedder";
import { CHUNK_SIZE, CHUNK_OVERLAP } from "../../lib/chunker";
import { TOP_K } from "../../lib/vectorSearch";

export default async function handler(req, res) {
  let database = "ok";
  try {
    await ensureSchema();
  } catch (e) {
    database = e.message;
  }
  res.status(200).json({
    database,
    embeddings: process.env.OPENAI_API_KEY ? EMBEDDING_MODEL : "missing OPENAI_API_KEY",
    answers: activeProvider(),
    pipeline: { chunkSize: CHUNK_SIZE, chunkOverlap: CHUNK_OVERLAP, topK: TOP_K, similarity: "cosine (pgvector <=>)", streaming: "SSE" },
  });
}
