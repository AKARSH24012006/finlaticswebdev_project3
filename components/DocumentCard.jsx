import React from "react";
import Link from "next/link";

function when(d) {
  try {
    return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch (_) {
    return "";
  }
}

export default function DocumentCard({ doc, onDelete }) {
  const ready = doc.status === "ready";
  const inner = (
    <>
      <span className={`badge ${doc.status}`}>{doc.status}</span>
      <h3>{doc.title}</h3>
      <div className="meta">
        <span>{doc.pageCount} pages</span>
        <span>{doc.chunkCount} chunks</span>
        <span>{when(doc.createdAt)}</span>
      </div>
      {doc.status === "failed" && doc.error && <div className="alert bad" style={{ marginTop: 4 }}>{doc.error}</div>}
      {onDelete && (
        <div>
          <button
            className="btn ghost small"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(doc); }}
          >
            Delete
          </button>
        </div>
      )}
    </>
  );
  return ready ? (
    <Link href={`/chat/${doc.id}`} className="card doc">{inner}</Link>
  ) : (
    <div className="card doc">{inner}</div>
  );
}
