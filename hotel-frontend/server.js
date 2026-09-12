const express = require('express');
const path = require('path');

const app = express();
const PORT = 5000;

// HTML / CSS / JS
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Frontend Web Server is running on http://localhost:${PORT}`);
});