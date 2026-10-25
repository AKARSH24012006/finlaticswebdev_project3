// Step 1 + 2 — Receive a PDF (multipart/form-data, field "file") and extract its text.
import { formidable } from "formidable";
import fs from "fs/promises";
import crypto from "crypto";
import { query, ensureSchema, DOC_COLUMNS } from "../../lib/db";
import { extractText } from "../../lib/pdfExtractor";
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
      return res.status(422).json({ error: "Couldn't read this PDF (it may be encrypted or corrupted)." });
    }
    if (!extracted.text || extracted.text.length < 20) {
      return res.status(422).json({
        error: "No selectable text found. This looks like a scanned/image-only PDF, which needs OCR first.",
      });
    }

    const fileName = file.originalFilename || "document.pdf";
    const title = ((extracted.title && extracted.title.trim()) || fileName.replace(/\.pdf$/i, "")).slice(0, 200);

    const { rows } = await query(
      `INSERT INTO documents (id, title, file_name, page_count, char_count, text, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'uploaded')
       RETURNING ${DOC_COLUMNS}`,
      [crypto.randomUUID(), title, fileName, extracted.pageCount, extracted.text.length, extracted.text]
    );
    return res.status(201).json({ document: rows[0] });
  } catch (err) {
    return sendError(res, err);
  }
}
