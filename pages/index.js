import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import PdfUploader from "../components/PdfUploader";
import DocumentCard from "../components/DocumentCard";

const PIPELINE = [
  ["PDF uploaded", "formidable"],
  ["Text extracted", "pdf-parse"],
  ["Chunked", "500 tok · 50 overlap"],
  ["Embedded", "text-embedding-3"],
  ["Stored", "pgvector"],
  ["Searched", "cosine · top 5"],
  ["Answered", "LLM + context · SSE"],
];

const FEATURES = [
  ["PDF upload", "Drag-and-drop or multipart form upload, text extracted with pdf-parse"],
  ["Text chunking", "500-token chunks with 50-token overlap"],
  ["OpenAI embeddings", "text-embedding-3-small, 1536 dimensions, batched"],
  ["Vector similarity search", "pgvector cosine similarity, top 5 chunks, HNSW index"],
  ["Claude RAG integration", "Retrieved chunks sent to Claude (or GPT-4o-mini fallback) as grounded context"],
  ["Streaming chat", "Answers stream token by token over Server-Sent Events (SSE)"],
  ["Source citations", "Every answer cites [n] chunks; click to see the source passage and its similarity score"],
];

export default function HomePage() {
  const router = useRouter();
  const [docs, setDocs] = useState(null);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    fetch("/api/documents").then((r) => r.json()).then((j) => setDocs(j.documents || [])).catch(() => setDocs([]));
    fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => {});
  }, []);

  const configIssue =
    health && (health.database !== "ok" ? `Database: ${health.database}` : !health.answers.provider ? "No LLM API key configured." : /missing/.test(health.embeddings) ? "OPENAI_API_KEY is missing — embeddings won't work." : "");

  return (
    <Layout>
      <div className="wrap">
        <section className="hero">
          <p className="eyebrow">Retrieval-augmented generation</p>
          <h1 className="display">Ask your PDF anything.<br /><em>Get answers with receipts.</em></h1>
          <p className="lede">
            Upload a document and chat with it. Every answer is built only from the passages that match your
            question, and each claim links back to the exact chunk it came from.
          </p>
          {configIssue && <div className="alert warn" style={{ marginBottom: 16 }}>Setup needed — {configIssue}</div>}
          <PdfUploader onReady={(doc) => router.push(`/chat/${doc.id}`)} />
        </section>

        <section className="block">
          <h2 className="section">How it works</h2>
          <div className="pipeline">
            {PIPELINE.map(([b, s], i) => (
              <div className="card pipe" key={b}>
                <div className="n">0{i + 1}</div>
                <b>{b}</b>
                <span>{s}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="block" id="features">
          <h2 className="section">Features</h2>
          <div className="features">
            {FEATURES.map(([b, s]) => (
              <div className="card feature" key={b}>
                <span className="tick">✓</span>
                <div><b>{b}</b><span>{s}</span></div>
              </div>
            ))}
          </div>
        </section>

        <section className="block">
          <h2 className="section">Recent documents</h2>
          {docs === null ? (
            <p className="muted">Loading…</p>
          ) : docs.length === 0 ? (
            <div className="card empty">Nothing here yet — upload your first PDF above.</div>
          ) : (
            <div className="doclist">{docs.slice(0, 6).map((d) => <DocumentCard key={d.id} doc={d} />)}</div>
          )}
        </section>
      </div>
    </Layout>
  );
}
