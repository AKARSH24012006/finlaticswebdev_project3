// Step 2 — Text extraction with pdf-parse (v2, built on a current pdf.js).
// The pdf.js worker is passed inline (getData) so serverless bundles don't
// need to locate a separate worker file at runtime.
const { PDFParse } = require("pdf-parse");
const { getData } = require("pdf-parse/worker");

let workerSet = false;

async function extractText(buffer) {
  if (!workerSet) {
    PDFParse.setWorker(getData());
    workerSet = true;
  }
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const textResult = await parser.getText();
    const info = await parser.getInfo().catch(() => null);
    const text = (textResult.text || "")
      .replace(/\r\n/g, "\n")
      .replace(/^-- \d+ of \d+ --$/gm, "") // page separators added by pdf-parse
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    const pageCount = textResult.total || (info && info.total) || 0;
    const title = info && info.info && typeof info.info.Title === "string" ? info.info.Title : null;
    return { text, pageCount, title };
  } finally {
    await parser.destroy().catch(() => {});
  }
}

// Scanned / image-only PDFs have pages but (almost) no selectable text.
const MIN_TOTAL_CHARS = 100;
const MIN_CHARS_PER_PAGE = 25;

function checkExtractable({ text, pageCount }) {
  const chars = (text || "").replace(/\s+/g, "").length;
  if (chars < MIN_TOTAL_CHARS || (pageCount > 0 && chars / pageCount < MIN_CHARS_PER_PAGE)) {
    return {
      ok: false,
      error:
        `Only ${chars} characters of text were found across ${pageCount || "?"} page(s). ` +
        "This looks like a scanned or image-only PDF — run it through OCR first (e.g. Adobe Scan, Google Drive “Open with Docs”) and upload the result.",
    };
  }
  return { ok: true };
}

module.exports = { extractText, checkExtractable, MIN_TOTAL_CHARS };
