const db = require('../config/db.connection');

async function getUser(session) {
	const query = {
		text: 'SELECT * FROM "User" WHERE "userAuthToken" = $1',
		values: [session],
	};
	const user = await db.one(query);

	if (!user) {
		throw Error('Unauthorized');
	}

	return user;
}

module.exports = getUser;