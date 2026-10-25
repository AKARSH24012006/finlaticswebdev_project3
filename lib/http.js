// Small helper so every API route returns the same JSON error shape.
function sendError(res, err) {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || "Something went wrong" });
}

module.exports = { sendError };
