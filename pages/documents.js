import React, { useEffect, useState } from "react";
import Link from "next/link";
import Layout from "../components/Layout";
import DocumentCard from "../components/DocumentCard";

export default function DocumentsPage() {
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState("");

  function load() {
    fetch("/api/documents")
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) throw new Error(j.error || "Couldn't load documents");
        setDocs(j.documents);
      })
      .catch((e) => { setError(e.message); setDocs([]); });
  }
  useEffect(load, []);

  async function remove(doc) {
    if (!window.confirm(`Delete "${doc.title}" and its embeddings?`)) return;
    await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    setDocs((d) => d.filter((x) => x.id !== doc.id));
  }

  return (
    <Layout title="Library">
      <div className="wrap">
        <section className="hero" style={{ paddingBottom: 18 }}>
          <p className="eyebrow">Library</p>
          <h1 className="display" style={{ fontSize: 40 }}>Your documents</h1>
          <p className="lede" style={{ marginBottom: 0 }}>Open a ready document to start a conversation with it.</p>
        </section>
        <section className="block">
          {error && <div className="alert bad">{error}</div>}
          {docs === null ? (
            <p className="muted">Loading…</p>
          ) : docs.length === 0 ? (
            <div className="card empty">
              No documents yet. <Link href="/">Upload a PDF →</Link>
            </div>
          ) : (
            <div className="doclist">{docs.map((d) => <DocumentCard key={d.id} doc={d} onDelete={remove} />)}</div>
          )}
        </section>
      </div>
    </Layout>
  );
}
