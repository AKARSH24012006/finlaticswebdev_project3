// GET — list documents (newest first)
import { query, ensureSchema, DOC_COLUMNS } from "../../../lib/db";
import { sendError } from "../../../lib/http";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    await ensureSchema();
    const { rows } = await query(`SELECT ${DOC_COLUMNS} FROM documents ORDER BY created_at DESC LIMIT 100`);
    return res.status(200).json({ documents: rows });
  } catch (err) {
    return sendError(res, err);
  }
}
