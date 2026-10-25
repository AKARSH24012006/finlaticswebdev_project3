// Auth placeholder from the starter kit. The app is single-tenant and needs no
// login; this route is kept so the starter's file layout is preserved.
export default function handler(req, res) {
  res.status(200).json({ authenticated: false, message: "Authentication is not enabled for this deployment." });
}
