const express = require('express');
require('dotenv').config();
const pgp = require('pg-promise')();
const db = pgp(process.env.DATABASE_URL);
const app = express();
const port = 3000;

app.get('/', (req, res) => {
    res.send('Gym Craft AI Proxy Server');
});

app.listen(port, () => {
    console.log(`App listening on port ${port}`);
});
