// GET — one document's metadata · DELETE — remove it (its chunks cascade)
import { query, ensureSchema, DOC_COLUMNS } from "../../../lib/db";
import { sendError } from "../../../lib/http";

export default async function handler(req, res) {
  const id = String(req.query.id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(404).json({ error: "Document not found" });
  try {
    await ensureSchema();
    if (req.method === "GET") {
      const { rows } = await query(`SELECT ${DOC_COLUMNS} FROM documents WHERE id = $1`, [id]);
      if (!rows[0]) return res.status(404).json({ error: "Document not found" });
      return res.status(200).json({ document: rows[0] });
    }
    if (req.method === "DELETE") {
      await query("DELETE FROM documents WHERE id = $1", [id]);
      return res.status(204).end();
    }
    res.setHeader("Allow", "GET, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return sendError(res, err);
  }
}
