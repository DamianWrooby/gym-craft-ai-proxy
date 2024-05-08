const db = require('../config/db.connection');
const openAIconfig = require('../config/openAI.config');

async function getCompletion(req, res) {
    const session = req.cookies?.session;
    const body = req.body;

    // Check if the user is logged in
    try {
        const user = await db.one('SELECT * FROM "User" WHERE "userAuthToken" = $1', [session]);
		if (!user) {
			res.status(401).send('Unauthorized');
			return;
		}
    } catch (e) {
        console.log(e);
        res.status(500).send('Server error');
    }

    // Check if the request body is valid
    if (!body || typeof body !== 'object') {
        res.status(400).send('Invalid request body');
        return;
    }

    try {
        // Get the completion from OpenAI
        const response = await fetch(openAIconfig.openAIapiUrl, {
            method: 'POST',
            headers: new Headers({
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.SECRET_OPENAI_KEY}`,
            }),
            body,
        });

        console.log({response});
        // Check if the response is ok
        if (!response.ok) {
            res.status(500).send('Server error');
            return;
        }


        const responseJson = await response.json();
        res.send(responseJson);
    } catch (e) {
        console.log(e);
        res.status(500).send(e.message);
    }
}

module.exports = {
    getCompletion,
};
