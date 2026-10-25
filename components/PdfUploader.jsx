import React, { useRef, useState } from "react";

const STEPS = [
  { key: "upload", label: "Uploading PDF & extracting text (pdf-parse)" },
  { key: "process", label: "Chunking 500 tokens · embedding · storing in pgvector" },
  { key: "ready", label: "Ready to chat" },
];

const MAX_BYTES = 4 * 1024 * 1024;

export default function PdfUploader({ onReady }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  const [stage, setStage] = useState(null); // null | upload | process | ready
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");

  async function handleFile(file) {
    setError("");
    if (!file) return;
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) return setError("Please choose a PDF file.");
    if (file.size > MAX_BYTES) return setError("That PDF is over 4 MB. Try a smaller one.");

    setFileName(file.name);
    try {
      setStage("upload");
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      const upJson = await up.json().catch(() => ({}));
      if (!up.ok) throw new Error(upJson.error || `Upload failed (${up.status})`);

      setStage("process");
      const pr = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: upJson.document.id }),
      });
      const prJson = await pr.json().catch(() => ({}));
      if (!pr.ok) throw new Error(prJson.error || `Processing failed (${pr.status})`);

      setStage("ready");
      onReady && onReady({ ...upJson.document, ...prJson.document });
    } catch (e) {
      setError(e.message);
      setStage(null);
    }
  }

  const busy = stage === "upload" || stage === "process";
  const idx = STEPS.findIndex((s) => s.key === stage);

  return (
    <div
      className={`drop ${over ? "over" : ""}`}
      onDragOver={(e) => { e.preventDefault(); if (!busy) setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!busy) handleFile(e.dataTransfer.files[0]); }}
    >
      <div className="mono muted" style={{ fontSize: 12 }}>PDF · up to 4 MB · selectable text</div>
      <h3>{busy ? fileName : "Drop a PDF here"}</h3>
      <p>{busy ? "Hang tight — this usually takes a few seconds." : "or pick one from your computer"}</p>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => { handleFile(e.target.files[0]); e.target.value = ""; }}
      />
      <button className="btn" disabled={busy} onClick={() => input.current && input.current.click()}>
        {busy ? "Working…" : "Choose PDF"}
      </button>

      {stage && (
        <div className="progress" aria-live="polite">
          {STEPS.map((s, i) => {
            const state = i < idx || stage === "ready" ? "done" : i === idx ? "active" : "";
            return (
              <div key={s.key} className={`step ${state}`}>
                <span className="dot">{state === "done" ? "✓" : ""}</span>
                {s.label}
              </div>
            );
          })}
        </div>
      )}
      {error && <div className="alert bad">{error}</div>}
    </div>
  );
}
