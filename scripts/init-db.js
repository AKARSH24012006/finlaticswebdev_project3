// Creates the pgvector extension, tables and indexes.  Run: npm run db:init
// (Optional — the app also does this automatically on first request.)
const fs = require("fs");
const path = require("path");
try { require("fs").readFileSync(path.join(__dirname, "..", ".env"), "utf8").split("\n").forEach((l) => { const m = /^\s*([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/.exec(l); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }); } catch (_) {}
const { ensureSchema, getPool } = require("../lib/db");

ensureSchema()
  .then(() => { console.log("Database ready: vector extension, documents, chunks, HNSW cosine index."); return getPool().end(); })
  .catch((e) => { console.error(e.message); process.exit(1); });
