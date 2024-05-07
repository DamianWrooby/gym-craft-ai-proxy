const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const { getCompletion } = require('./app/controllers/completion.controller');

// Middlewares
app.use(cors());
app.use(cookieParser());
app.use(bodyParser.json());

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Server error');
});

app.post('/api/generate-plan', getCompletion);

// Start the server
const port = 3000;
app.listen(port, () => {
    console.log(`App listening on port ${port}`);
});
