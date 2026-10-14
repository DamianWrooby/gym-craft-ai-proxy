// Relays Garmin activity-list and activity-detail requests to the Python (curl_cffi) microservice. The browser
// calls this directly so the slow Garmin auth + fetch never sits inside a time-limited
// Netlify function. Pure relay: no DB, no session — identity is the opaque Bearer session token
// the browser forwards, which the Python service validates. No credentials pass through here.

const TIMEOUT_MS = 120_000;

// Monotonic per-process counter. It resets on every Render restart/deploy, which is fine and
// even useful: sequential ids make a burst of proxy->Flask calls trivial to spot, and a gap
// across a restart is a visible marker. Forwarded to Flask as X-Request-Id so the same id can
// be grepped end-to-end (proxy log line <-> Flask inbound log line).
let requestSeq = 0;

function isNonEmptyString(v) {
    return typeof v === 'string' && v.trim().length > 0;
}

// Pulls the opaque session token from the incoming Authorization: Bearer header (the browser
// forwards it). Never logged — it's a credential.
function extractBearer(req) {
    const auth = req.headers['authorization'] || '';
    return auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : '';
}

/**
 * Relays one POST to the Python service. `validate` returns `{ error }` or `{ body, describe }`;
 * `summarize` turns a 200 payload into a log fragment. Shared by every Garmin relay endpoint.
 */
async function relay(req, res, { tag, path, validate, summarize }) {
    const reqId = ++requestSeq;
    const start = Date.now();
    const bearer = extractBearer(req);

    if (!bearer) {
        console.warn(`[${tag}][#${reqId}] 401: missing Bearer session token`);
        return res.status(401).json({ code: 'INVALID_TOKEN', message: 'Missing Garmin session token' });
    }
    const checked = validate(req.body || {});
    if (checked.error) {
        console.warn(`[${tag}][#${reqId}] 400: ${checked.error}`);
        return res.status(400).json({ error: checked.error });
    }

    const baseUrl = process.env.SECRET_INTERNAL_GARMIN_API_URL;
    if (!baseUrl) {
        console.error(`[${tag}][#${reqId}] SECRET_INTERNAL_GARMIN_API_URL is not configured`);
        return res.status(500).json({ error: 'Garmin service URL is not configured' });
    }

    const targetUrl = `${baseUrl}${path}`;

    // Log BEFORE the fetch so a request that hangs or times out is still visible, and so the
    // exact moment each proxy->Flask call leaves is timestamped.
    console.log(`[${new Date().toISOString()}] [${tag}][#${reqId}] -> POST ${targetUrl} ${checked.describe}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const headers = {
            'Content-Type': 'application/json',
            'X-Request-Id': String(reqId),
            Authorization: `Bearer ${bearer}`,
        };
        if (process.env.SECRET_INTERNAL_API_KEY) {
            headers['X-API-Key'] = process.env.SECRET_INTERNAL_API_KEY;
        }

        const upstream = await fetch(targetUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(checked.body),
            signal: controller.signal,
        });

        // Read the raw text first so we can log it when the body is not JSON.
        const rawBody = await upstream.text();
        const ms = Date.now() - start;

        let data = {};
        try {
            data = rawBody ? JSON.parse(rawBody) : {};
        } catch {
            data = {};
        }

        if (!upstream.ok) {
            const message = data?.message || 'Garmin service error';
            // A 401 from Flask means the session token is missing/invalid/expired → the browser
            // should prompt for a Garmin login and re-authenticate. Older "No valid token found"
            // bodies are kept for backwards compatibility.
            const isTokenInvalid = upstream.status === 401 || String(message).includes('No valid token found');
            const code = isTokenInvalid ? 'INVALID_TOKEN' : 'GARMIN_SERVICE_ERROR';
            const status = isTokenInvalid ? 401 : upstream.status;

            // On failure, log the forensics that localize the source: a text/plain Cloudflare body
            // (server=cloudflare, cf-ray set) is a Render-edge throttle that never reached Flask,
            // whereas a JSON bodys came from Flask itself. bodySnippet captures non-JSON bodies.
            console.error(
                `[${tag}][#${reqId}] upstream ${upstream.status} in ${ms}ms: ${message} ` +
                    `server=${upstream.headers.get('server') || '-'} cfRay=${upstream.headers.get('cf-ray') || '-'} ` +
                    `ct=${upstream.headers.get('content-type') || '-'} retryAfter=${upstream.headers.get('retry-after') || '-'} ` +
                    `bodySnippet=${JSON.stringify(rawBody.slice(0, 300))}`,
            );
            return res.status(status).json({ code, message });
        }

        console.log(`[${tag}][#${reqId}] <- 200 ${ms}ms, ${summarize(data)}`);
        return res.status(200).json(data);
    } catch (err) {
        const aborted = err?.name === 'AbortError';
        const message = aborted
            ? 'Garmin service timed out'
            : err instanceof Error
              ? err.message
              : 'Garmin relay failed';
        console.error(`[${tag}][#${reqId}] ${message} after ${Date.now() - start}ms`);
        return res.status(aborted ? 504 : 502).json({ code: 'GARMIN_SERVICE_ERROR', message });
    } finally {
        clearTimeout(timeout);
    }
}

function getGarminActivities(req, res) {
    return relay(req, res, {
        tag: 'garmin-activities',
        path: '/activities',
        validate: ({ startDate, endDate }) => {
            if (!isNonEmptyString(startDate)) return { error: 'startDate must be a non-empty string' };
            const body = { startDate };
            if (isNonEmptyString(endDate)) body.endDate = endDate;
            return { body, describe: `window=${startDate}..${endDate || ''}` };
        },
        summarize: (data) => `${Array.isArray(data?.data) ? data.data.length : 0} activities`,
    });
}

// One activity's splits + downsampled samples. The browser fetches these after a sync so the app
// can score each new run against the athlete's own HR zones without a Garmin call inside Netlify.
function getGarminActivityDetail(req, res) {
    return relay(req, res, {
        tag: 'garmin-activity-detail',
        path: '/activity/detail',
        validate: ({ activityId }) => {
            if (!Number.isSafeInteger(activityId) || activityId <= 0) {
                return { error: 'activityId must be a positive integer' };
            }
            return { body: { activityId }, describe: `activityId=${activityId}` };
        },
        summarize: (data) => `${Array.isArray(data?.data?.samples) ? data.data.samples.length : 0} samples`,
    });
}

module.exports = { getGarminActivities, getGarminActivityDetail };
