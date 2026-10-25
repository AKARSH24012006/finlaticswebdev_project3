import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Layout from "../../components/Layout";
import ChatMessage from "../../components/ChatMessage";
import { streamSSE } from "../../lib/sseClient";

const SUGGESTIONS = ["Summarise this document in 5 bullet points", "What are the key findings or conclusions?", "List any important numbers, dates or definitions"];

let nextId = 1;
const mkId = () => `m${Date.now().toString(36)}${nextId++}`;

export default function ChatDocPage() {
  const router = useRouter();
  const { docId } = router.query;
  const [doc, setDoc] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const taRef = useRef(null);

  useEffect(() => {
    if (!docId) return;
    fetch(`/api/documents/${docId}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) throw new Error(j.error || "Document not found");
        setDoc(j.document);
      })
      .catch((e) => setLoadError(e.message));
  }, [docId]);

  useEffect(() => {
    endRef.current && endRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function patch(id, fn) {
    setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, ...fn(m) } : m)));
  }

  async function ask(text) {
    const q = (text || "").trim();
    if (!q || busy || !doc) return;
    setInput("");
    const history = messages.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content }));
    const userMsg = { id: mkId(), role: "user", content: q };
    const botId = mkId();
    setMessages((ms) => [...ms, userMsg, { id: botId, role: "assistant", content: "", sources: [], streaming: true }]);
    setBusy(true);
    try {
      await streamSSE(
        "/api/chat",
        { docId: doc.id, question: q, history },
        {
          onEvent(event, data) {
            if (event === "sources") patch(botId, () => ({ sources: data }));
            else if (event === "token") patch(botId, (m) => ({ content: m.content + data.text }));
            else if (event === "error") patch(botId, () => ({ error: data.error, streaming: false }));
            else if (event === "done") patch(botId, () => ({ streaming: false, meta: data }));
          },
        }
      );
    } catch (e) {
      patch(botId, () => ({ error: e.message }));
    } finally {
      patch(botId, () => ({ streaming: false }));
      setBusy(false);
      taRef.current && taRef.current.focus();
    }
  }

  function onKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask(input);
    }
  }

  if (loadError) {
    return (
      <Layout title="Not found">
        <div className="wrap hero">
          <h1 className="display" style={{ fontSize: 36 }}>Document not found</h1>
          <p className="lede">{loadError}</p>
          <Link href="/documents" className="btn">Back to library</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={doc ? doc.title : "Chat"} footer={false}>
      <div className="wrap chat-layout">
        <div className="chat-head">
          <p className="eyebrow" style={{ marginBottom: 6 }}>
            <Link href="/documents" style={{ textDecoration: "none" }}>← Library</Link>
          </p>
          <h1>{doc ? doc.title : "Loading…"}</h1>
          {doc && (
            <div className="mono muted" style={{ fontSize: 12 }}>
              {doc.pageCount} pages · {doc.chunkCount} chunks · top-5 cosine retrieval
            </div>
          )}
          {doc && doc.status !== "ready" && (
            <div className="alert warn">This document is {doc.status}. {doc.error || "Re-upload it from the home page."}</div>
          )}
        </div>

        <div className="thread">
          {messages.length === 0 && doc && (
            <div className="muted" style={{ paddingTop: 10 }}>
              Ask a question about <strong style={{ color: "var(--ink)" }}>{doc.title}</strong>. Answers cite the chunks they use — click a number to see the source.
            </div>
          )}
          {messages.map((m) => <ChatMessage key={m.id} message={m} />)}
          <div ref={endRef} />
        </div>
      </div>

      <div className="composer-wrap">
        <div className="wrap">
          {messages.length === 0 && doc && doc.status === "ready" && (
            <div className="suggest">
              {SUGGESTIONS.map((s) => <button key={s} className="chip" onClick={() => ask(s)}>{s}</button>)}
            </div>
          )}
          <div className="card composer">
            <textarea
              ref={taRef}
              rows={1}
              value={input}
              placeholder={doc && doc.status === "ready" ? "Ask about this document…" : "Waiting for document…"}
              disabled={!doc || doc.status !== "ready"}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
              }}
              onKeyDown={onKey}
            />
            <button className="btn" disabled={busy || !input.trim() || !doc || doc.status !== "ready"} onClick={() => ask(input)}>
              {busy ? "…" : "Ask"}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
