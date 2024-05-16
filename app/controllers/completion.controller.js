const db = require('../config/db.connection');
const openAIconfig = require('../config/openAI.config');

async function getCompletion(req, res) {
    const body = req.body;
    const session = body?.user?.session;
    const openAIrequestBody = body?.openAIrequestBody;

    // Check if the session is valid
    if (!session) {
        return res.status(401).send('Unauthorized');
    }

    // Check if the request body is valid
    if (!body?.openAIrequestBody || typeof body !== 'object') {
        return res.status(400).send('Invalid request body');
    }

    // Check if the user is logged in
    try {
        const user = await db.one('SELECT * FROM "User" WHERE "userAuthToken" = $1', [session]);
		if (!user) {
			return res.status(401).send('Unauthorized');
		}
    } catch (e) {
        console.log(e);
        return res.status(500).send('Server error');
    }

    try {
        // Get the completion from OpenAI
        const response = await fetch(openAIconfig.openAIapiUrl, {
            method: 'POST',
            headers: new Headers({
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.SECRET_OPENAI_KEY}`,
            }),
            body: openAIrequestBody,
        });

        console.log({response});
        // Check if the response is ok
        if (response.status !== 200) {
            return res.status(500).send('External API error');
        }

        const responseJson = await response.json();
        return res.send(responseJson);
    } catch (e) {
        console.log(e);
        res.status(500).send(e.message);
    }
}

module.exports = {
    getCompletion,
};
