// Format error yang konsisten: { "error": { "code", "message", "fields"? } }
function sendError(res, status, code, message, fields) {
  const error = { code, message };
  if (fields) error.fields = fields;
  return res.status(status).json({ error });
}

// Mengirim hasil dari service ({ status, body }) ke client
function sendResult(res, result) {
  if (result.status === 204) return res.status(204).end();
  return res.status(result.status).json(result.body);
}

module.exports = { sendError, sendResult };
