require('dotenv').config({ quiet: true });

const express = require('express');
const cors = require('cors');
const authRoutes = require('./src/routes/auth');
const productRoutes = require('./src/routes/products');
const storeRoutes = require('./src/routes/store');
const { spec, swaggerHtml } = require('./src/openapi');
const { sendError } = require('./src/http');
const { MESSAGES } = require('./src/config');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'Warung QA API' });
});

// Dokumentasi API interaktif (Swagger UI) + file OpenAPI untuk di-import ke Postman
app.get('/api-docs/openapi.json', (req, res) => {
  res.json(spec);
});

app.get(['/api-docs', '/api-docs/'], (req, res) => {
  res.type('html').send(swaggerHtml);
});

app.use('/api/v1', authRoutes);
app.use('/api/v1', productRoutes);
app.use('/api/v1', storeRoutes);

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
  if (err.type === 'entity.too.large') {
    const message = req.path.endsWith('/image') ? 'Ukuran gambar maksimal 2 MB' : 'Body terlalu besar';
    return sendError(res, 413, 'PAYLOAD_TOO_LARGE', message);
  }
  console.error(err);
  return sendError(res, 500, 'INTERNAL_ERROR', MESSAGES.serverError);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Warung QA API jalan di http://localhost:${PORT}`);
});
