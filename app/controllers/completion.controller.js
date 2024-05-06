const db = require('../config/db.connection');
const openAIconfig = require('../config/openAI.config');

async function getCompletion(req, res) {
    // console.log(req.body);
    const session = req.cookies?.session;
    const body = req.body;

    try {
		// Check if the user is logged in
        const user = await db.one('SELECT * FROM "User" WHERE "userAuthToken" = $1', [session]);
		if (!user) {
			res.status(401).send('Unauthorized');
			return;
		}
        console.log(user);

		res.send(user.username);
    } catch (e) {
        console.log(e);
        res.status(500).send('Server error');
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

        // Check if the response is ok
        if (!response.ok) {
            throw new Error(`Could not connect to OpenAI API`);
        }
        if (!isChatCompletion(json)) {
            throw new Error(`Unexpected response from OpenAI`);
        }

        const responseJson = await response.json();
        console.log(responseJson);
        res.send(responseJson.choices[0].message.content);
    } catch (e) {
        console.log(e);
        res.status(500).send(e.message);
    }
}

const isChatCompletion = (data) =>
    typeof data === 'object' && !!(data).choices?.[0].message?.content;

module.exports = {
    getCompletion,
};
