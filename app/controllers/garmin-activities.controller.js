// Relays a Garmin activity-list request to the Python (curl_cffi) microservice. The browser
// calls this directly so the slow Garmin auth + fetch never sits inside a time-limited
// Netlify function. Pure relay: no DB, no session — the Python service still requires valid
// Garmin credentials, which is the real gate.

const TIMEOUT_MS = 120_000;

function isNonEmptyString(v) {
    return typeof v === 'string' && v.trim().length > 0;
}

async function getGarminActivities(req, res) {
    const start = Date.now();
    const { username, startDate, endDate, password } = req.body || {};

    if (!isNonEmptyString(username) || !isNonEmptyString(startDate)) {
        return res.status(400).json({ error: 'username and startDate must be non-empty strings' });
    }

    const baseUrl = process.env.SECRET_INTERNAL_GARMIN_API_URL;
    if (!baseUrl) {
        console.error('[garmin-activities] SECRET_INTERNAL_GARMIN_API_URL is not configured');
        return res.status(500).json({ error: 'Garmin service URL is not configured' });
    }

    const requestBody = { username, startDate };
    if (isNonEmptyString(endDate)) requestBody.endDate = endDate;
    if (isNonEmptyString(password)) requestBody.password = password;

    console.log(`[${new Date().toISOString()}] [garmin-activities] ${username} ${startDate}..${endDate || ''}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const headers = { 'Content-Type': 'application/json' };
        if (process.env.SECRET_INTERNAL_API_KEY) {
            headers['X-API-Key'] = process.env.SECRET_INTERNAL_API_KEY;
        }

        const upstream = await fetch(`${baseUrl}/activities`, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
            signal: controller.signal,
        });

        const data = await upstream.json().catch(() => ({}));

        if (!upstream.ok) {
            const message = data?.message || 'Garmin service error';
            const code = String(message).includes('No valid token found') ? 'INVALID_TOKEN' : 'GARMIN_SERVICE_ERROR';
            console.error(`[garmin-activities] upstream ${upstream.status}: ${message}`);
            return res.status(upstream.status).json({ code, message });
        }

        const count = Array.isArray(data?.data) ? data.data.length : 0;
        console.log(`[garmin-activities] success: ${count} activities in ${Date.now() - start}ms`);
        return res.status(200).json(data);
    } catch (err) {
        const aborted = err?.name === 'AbortError';
        const message = aborted
            ? 'Garmin service timed out'
            : err instanceof Error
              ? err.message
              : 'Garmin relay failed';
        console.error(`[garmin-activities] ${message}`);
        return res.status(aborted ? 504 : 502).json({ code: 'GARMIN_SERVICE_ERROR', message });
    } finally {
        clearTimeout(timeout);
    }
}

module.exports = { getGarminActivities };
