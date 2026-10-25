import React, { useState } from "react";

function Source({ src, id }) {
  const [open, setOpen] = useState(false);
  const long = src.content.length > 320;
  const text = open || !long ? src.content : src.content.slice(0, 320) + "…";
  const pct = Math.max(0, Math.min(1, src.similarity)) * 100;
  return (
    <div className="card src" id={id}>
      <div className="row">
        <span className="num">[{src.n}]</span>
        <span>chunk #{src.index + 1}</span>
        <span className="bar" title={`cosine similarity ${src.similarity.toFixed(3)}`}><i style={{ width: `${pct}%` }} /></span>
        <span>{src.similarity.toFixed(3)}</span>
      </div>
      <p>{text}</p>
      {long && <button className="more" onClick={() => setOpen(!open)}>{open ? "Show less" : "Show full chunk"}</button>}
    </div>
  );
}

// "Evidence ledger": the top-5 chunks retrieved for an answer.
export default function ChunkSourceList({ sources, msgId, defaultOpen = false }) {
  if (!sources || !sources.length) return null;
  return (
    <details className="ledger" open={defaultOpen}>
      <summary>Sources · {sources.length} chunks · cosine similarity</summary>
      <div className="sources">
        {sources.map((s) => (
          <Source key={s.id} src={s} id={`src-${msgId}-${s.n}`} />
        ))}
      </div>
    </details>
  );
}
