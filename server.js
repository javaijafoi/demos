const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const csvPath = path.join(__dirname, 'signups.csv');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

function getCount() {
  if (!fs.existsSync(csvPath)) return 0;
  const data = fs.readFileSync(csvPath, 'utf8');
  const lines = data.trim().split(/\r?\n/);
  return lines.filter(l => l).length;
}

app.post('/signup', (req, res) => {
  const email = (req.body.email || '').trim();
  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }
  const entry = `${email},${new Date().toISOString()}\n`;
  fs.appendFile(csvPath, entry, err => {
    if (err) {
      console.error('Failed to save signup:', err);
      return res.status(500).json({ error: 'Failed to save' });
    }
    res.json({ success: true, count: getCount() });
  });
});

app.get('/count', (req, res) => {
  res.json({ count: getCount() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
