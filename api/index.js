const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'Warung QA API' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Warung QA API jalan di http://localhost:${PORT}`);
});