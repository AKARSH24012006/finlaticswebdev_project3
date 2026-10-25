// Step 2 — Text extraction with pdf-parse.
// Import the library file directly: the package's index.js runs a debug
// self-test when it is bundled, which crashes on serverless platforms.
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

async function extractText(buffer) {
  const data = await pdfParse(buffer);
  const text = (data.text || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return {
    text,
    pageCount: data.numpages || 0,
    title: (data.info && data.info.Title) || null,
  };
}

module.exports = { extractText };
