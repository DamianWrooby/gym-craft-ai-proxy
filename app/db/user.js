const db = require('../config/db.connection');

// An unknown/expired session is an expected outcome, not a server fault: the main app has to be
// able to tell it apart from a real failure so it can send the user back to the login page.
// Callers detect it via `error.status === 401` and relay `code` to the browser.
function unauthorized(message) {
    const error = new Error(message);
    error.status = 401;
    error.code = 'INVALID_SESSION';
    return error;
}

async function getUser(session) {
    if (typeof session !== 'string' || session.trim().length === 0) {
        throw unauthorized('Missing session token');
    }

    const query = {
        text: 'SELECT * FROM "User" WHERE "userAuthToken" = $1',
        values: [session],
    };
    // oneOrNone, not one: `one` rejects on zero rows, which would surface a logged-out user as a
    // generic 500 and give the app nothing to act on.
    const user = await db.oneOrNone(query);

    if (!user) {
        throw unauthorized('Session expired or invalid — log in again');
    }

    return user;
}

module.exports = getUser;
