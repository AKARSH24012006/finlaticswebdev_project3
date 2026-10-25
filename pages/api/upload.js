// Step 1 + 2 — Receive a PDF (multipart/form-data, field "file") and extract its text.
import { formidable } from "formidable";
import fs from "fs/promises";
import crypto from "crypto";
import { query, ensureSchema, DOC_COLUMNS } from "../../lib/db";
import { extractText, checkExtractable } from "../../lib/pdfExtractor";
import { sendError } from "../../lib/http";

export const config = { api: { bodyParser: false }, maxDuration: 60 };

const MAX_BYTES = 4 * 1024 * 1024; // Vercel serverless request bodies are capped at ~4.5 MB

function parseForm(req) {
  const form = formidable({ maxFiles: 1, maxFileSize: MAX_BYTES, allowEmptyFiles: false });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) {
        err.status = err.httpCode || 400;
        if (/maxFileSize/i.test(err.message)) err.message = "PDF is larger than 4 MB.";
        return reject(err);
      }
      resolve({ fields, files });
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    await ensureSchema();
    const { files } = await parseForm(req);
    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) return res.status(400).json({ error: "No file uploaded (expected field 'file')." });

    const buffer = await fs.readFile(file.filepath);
    await fs.unlink(file.filepath).catch(() => {});
    if (buffer.subarray(0, 5).toString() !== "%PDF-") return res.status(400).json({ error: "That file isn't a PDF." });

    let extracted;
    try {
      extracted = await extractText(buffer);
    } catch (e) {
      console.error("pdf-parse failed:", e);
      return res.status(422).json({
        error: "Couldn't read this PDF (it may be encrypted or corrupted).",
        detail: String((e && e.message) || e).slice(0, 300),
      });
    }
    const check = checkExtractable(extracted); // scanned / image-only PDF guard
    if (!check.ok) return res.status(422).json({ error: check.error, code: "NO_TEXT" });

    // Embedding cache: identical text → reuse the already-embedded document.
    const contentHash = crypto.createHash("sha256").update(extracted.text).digest("hex");
    const existing = await query(
      `SELECT ${DOC_COLUMNS} FROM documents WHERE content_hash = $1 AND status = 'ready' ORDER BY created_at LIMIT 1`,
      [contentHash]
    );
    if (existing.rows[0]) return res.status(200).json({ document: existing.rows[0], deduplicated: true });

    const fileName = file.originalFilename || "document.pdf";
    const title = ((extracted.title && extracted.title.trim()) || fileName.replace(/\.pdf$/i, "")).slice(0, 200);

    const { rows } = await query(
      `INSERT INTO documents (id, title, file_name, page_count, char_count, text, content_hash, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'uploaded')
       RETURNING ${DOC_COLUMNS}`,
      [crypto.randomUUID(), title, fileName, extracted.pageCount, extracted.text.length, extracted.text, contentHash]
    );
    return res.status(201).json({ document: rows[0], deduplicated: false });
  } catch (err) {
    return sendError(res, err);
  }
}
