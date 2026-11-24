require('dotenv').config({ quiet: true });

const express = require('express');
const cors = require('cors');
const authRoutes = require('./src/routes/auth');
const { sendError } = require('./src/http');
const { MESSAGES } = require('./src/config');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'Warung QA API' });
});

app.use('/api/v1', authRoutes);

// Endpoint yang tidak dikenal
app.use((req, res) => {
  sendError(res, 404, 'NOT_FOUND', 'Endpoint tidak ditemukan');
});

// Penanganan error terakhir: body JSON rusak atau error tak terduga
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Body harus berupa JSON yang valid');
  }
  console.error(err);
  return sendError(res, 500, 'INTERNAL_ERROR', MESSAGES.serverError);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Warung QA API jalan di http://localhost:${PORT}`);
});
