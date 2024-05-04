const db = require('../config/db.connection');
const openAIconfig = require('../config/openAI.config');

async function getCompletion(req, res) {
    const session = req.cookies?.session;
    try {
		// Check if the user is logged in
        const user = await db.one('SELECT * FROM "User" WHERE "userAuthToken" = $1', [session]);
		if (!user) {
			res.status(401).send('Unauthorized');
			return;
		}
        console.log(user);

		// Get the completion from OpenAI

		res.send(user.username);
    } catch (e) {
        console.log(e);
    }
}

module.exports = {
    getCompletion,
};
