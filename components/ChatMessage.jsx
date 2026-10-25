import React from "react";
import ChunkSourceList from "./ChunkSourceList";

// Turn inline text into nodes: **bold** and [n] citation chips.
function inline(text, onCite, keyBase) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[\d+\])/g);
  return parts.map((p, i) => {
    const k = `${keyBase}-${i}`;
    const cite = /^\[(\d+)\]$/.exec(p);
    if (cite) {
      const n = Number(cite[1]);
      return <button key={k} className="cite" onClick={() => onCite(n)} title={`Jump to source ${n}`}>{n}</button>;
    }
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={k}>{p.slice(2, -2)}</strong>;
    return <React.Fragment key={k}>{p}</React.Fragment>;
  });
}

// Minimal, safe markdown: paragraphs, bullet and numbered lists, bold, citations.
function renderBody(text, onCite) {
  const blocks = text.split(/\n{2,}/);
  return blocks.map((block, bi) => {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    if (lines.length && lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
      return <ul key={bi}>{lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*[-*•]\s+/, ""), onCite, `${bi}-${li}`)}</li>)}</ul>;
    }
    if (lines.length && lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
      return <ol key={bi}>{lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*\d+[.)]\s+/, ""), onCite, `${bi}-${li}`)}</li>)}</ol>;
    }
    const cleaned = block.replace(/^#{1,6}\s+/gm, "");
    return (
      <p key={bi}>
        {cleaned.split("\n").map((l, li, arr) => (
          <React.Fragment key={li}>
            {inline(l, onCite, `${bi}-${li}`)}
            {li < arr.length - 1 && <br />}
          </React.Fragment>
        ))}
      </p>
    );
  });
}

export default function ChatMessage({ message }) {
  const { id, role, content, sources, streaming, error } = message;

  if (role === "user") return <div className="msg user">{content}</div>;

  function onCite(n) {
    const el = document.getElementById(`src-${id}-${n}`);
    if (!el) return;
    const details = el.closest("details");
    if (details) details.open = true;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("flash");
    setTimeout(() => el.classList.remove("flash"), 1200);
  }

  return (
    <div className="msg assistant">
      <div className="body">
        {content ? renderBody(content, onCite) : !error && <p className="muted">Searching the document…</p>}
        {streaming && <span className="caret" />}
      </div>
      {error && <div className="alert bad">{error}</div>}
      <ChunkSourceList sources={sources} msgId={id} />
    </div>
  );
}
