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

module.exports = { extractText };
