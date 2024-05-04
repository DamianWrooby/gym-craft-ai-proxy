const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const app = express();
const { getCompletion } = require('./app/controllers/completion.controller');

// Middleware
app.use(cors());
app.use(cookieParser());

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

app.get('/', getCompletion);


// Start the server
const port = 3000;
app.listen(port, () => {
    console.log(`App listening on port ${port}`);
});
