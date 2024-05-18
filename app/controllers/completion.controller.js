const db = require('../config/db.connection');
const openAIconfig = require('../config/openAI.config');

async function getCompletion(req, res) {
    try {
        const { body } = req;
        const session = body?.user?.session;
        const openAIrequestBody = body?.openAIrequestBody;

        // Check if the session is valid
        if (!session) {
            return res.status(401).send('Unauthorized');
        }

        // Check if the request body is valid
        if (!openAIrequestBody || typeof body !== 'object') {
            return res.status(400).send('Invalid request body');
        }

        // Check if the user is logged in
        const user = await db.one('SELECT * FROM "User" WHERE "userAuthToken" = $1', [session]);
        if (!user) {
            return res.status(401).send('Unauthorized');
        }

        // Get the completion from OpenAI
        const openAIresponse = await fetch(openAIconfig.openAIapiUrl, {
            method: 'POST',
            headers: new Headers({
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.SECRET_OPENAI_KEY}`,
            }),
            body: openAIrequestBody,
        });

        // Check if the response is ok
        if (openAIresponse.status !== 200) {
            return res.status(500).send('External API error');
        }

        const responseJson = await openAIresponse.json();
        const generatedPlan = responseJson?.choices[0]?.message?.content;

        if (!generatedPlan || typeof generatedPlan !== 'string' || generatedPlan.length === 0) {
            return res.status(500).send('External API error - no response text');
        }

        return res.send(JSON.stringify(generatedPlan));
    } catch (e) {
        console.log(e);
        res.status(500).send('Server error');
    }
}

module.exports = {
    getCompletion,
};
