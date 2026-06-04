const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const { getCompletion } = require('./app/controllers/completion.controller');
const createTextCompletionHandler = require('./app/controllers/text-completion.controller');
const { getGarminActivities } = require('./app/controllers/garmin-activities.controller');

// Middlewares
// Allowlist the app origins. The Garmin relay forwards live Garmin credentials on the
// re-auth path, so an open relay is a meaningfully bigger abuse surface than the AI endpoints.
const allowedOrigins = ['http://localhost:5173', 'https://gymcraft.damianwroblewski.com'];
app.use(cors({ origin: allowedOrigins }));
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
app.post('/api/garmin-activities', getGarminActivities);

// Start the server
const port = 3000;
app.listen(process.env.PORT || port, () => {
    console.log(`App listening on port ${port}`);
});
