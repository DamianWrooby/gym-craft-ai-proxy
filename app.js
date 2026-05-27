const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const { getCompletion } = require('./app/controllers/completion.controller');
const createTextCompletionHandler = require('./app/controllers/text-completion.controller');

// Middlewares
app.use(cors());
app.use(cookieParser());
app.use(bodyParser.json({ limit: '2mb' }));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Server error');
});

app.post('/api/generate-plan', getCompletion);
app.post(
    '/api/weekly-report',
    createTextCompletionHandler({ tag: 'weekly-report', maxTokens: 1200, responseKey: 'summary' }),
);
app.post(
    '/api/explain-run',
    createTextCompletionHandler({ tag: 'explain-run', maxTokens: 700, responseKey: 'analysis' }),
);

// Start the server
const port = 3000;
app.listen(process.env.PORT || port, () => {
    console.log(`App listening on port ${port}`);
});
