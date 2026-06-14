// Relays a Garmin activity-list request to the Python (curl_cffi) microservice. The browser
// calls this directly so the slow Garmin auth + fetch never sits inside a time-limited
// Netlify function. Pure relay: no DB, no session — the Python service still requires valid
// Garmin credentials, which is the real gate.

const TIMEOUT_MS = 120_000;

// Render free-tier services spin down after ~15 min idle. A request to a sleeping instance is
// answered by Render's Cloudflare edge with a 429 ("Too Many Requests") instead of being held
// until the instance boots — so simply retrying /activities does not work. Instead we first poll
// a cheap unauthenticated /health endpoint: each probe triggers the wake AND tests readiness.
// Once it returns 200 the instance is up and the real request will reach Flask.
const WAKE_TOTAL_BUDGET_MS = 60_000; // give Render up to ~60s to cold-start (boot is ~20-40s)
const WAKE_PROBE_TIMEOUT_MS = 25_000; // per-probe cap (Render may hold a cold-start probe open)
const WAKE_POLL_INTERVAL_MS = 4_000; // gap between probes; spaced out so we don't trip the edge

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Returns true once /health responds 200, false if the budget is exhausted first.
async function ensureServiceAwake(baseUrl, reqId) {
    const deadline = Date.now() + WAKE_TOTAL_BUDGET_MS;
    let attempt = 0;
    while (Date.now() < deadline) {
        attempt += 1;
        const probe = new AbortController();
        const probeTimeout = setTimeout(() => probe.abort(), WAKE_PROBE_TIMEOUT_MS);
        try {
            const res = await fetch(`${baseUrl}/health`, { method: 'GET', signal: probe.signal });
            if (res.ok) {
                if (attempt > 1) console.log(`[garmin-activities][#${reqId}] wake: ready after ${attempt} probe(s)`);
                return true;
            }
            console.log(
                `[garmin-activities][#${reqId}] wake: probe ${attempt} -> ${res.status} ` +
                    `(server=${res.headers.get('server') || '-'}), waiting…`,
            );
        } catch (err) {
            console.log(`[garmin-activities][#${reqId}] wake: probe ${attempt} failed (${err?.name || 'error'}), waiting…`);
        } finally {
            clearTimeout(probeTimeout);
        }
        await sleep(WAKE_POLL_INTERVAL_MS);
    }
    return false;
}

// Monotonic per-process counter. It resets on every Render restart/deploy, which is fine and
// even useful: sequential ids make a burst of proxy->Flask calls trivial to spot, and a gap
// across a restart is a visible marker. Forwarded to Flask as X-Request-Id so the same id can
// be grepped end-to-end (proxy log line <-> Flask inbound log line).
let requestSeq = 0;

function isNonEmptyString(v) {
    return typeof v === 'string' && v.trim().length > 0;
}

// Never log raw credentials. The email is masked to local-part-initials + domain so logs stay
// correlatable per user without storing PII in plaintext.
function maskEmail(email) {
    if (typeof email !== 'string' || !email.includes('@')) return '***';
    const [local, domain] = email.split('@');
    return `${local.slice(0, 2)}***@${domain}`;
}

async function getGarminActivities(req, res) {
    const reqId = ++requestSeq;
    const start = Date.now();
    const { username, startDate, endDate, password } = req.body || {};

    if (!isNonEmptyString(username) || !isNonEmptyString(startDate)) {
        console.warn(`[garmin-activities][#${reqId}] 400: username/startDate missing`);
        return res.status(400).json({ error: 'username and startDate must be non-empty strings' });
    }

    const baseUrl = process.env.SECRET_INTERNAL_GARMIN_API_URL;
    if (!baseUrl) {
        console.error(`[garmin-activities][#${reqId}] SECRET_INTERNAL_GARMIN_API_URL is not configured`);
        return res.status(500).json({ error: 'Garmin service URL is not configured' });
    }

    const requestBody = { username, startDate };
    if (isNonEmptyString(endDate)) requestBody.endDate = endDate;
    if (isNonEmptyString(password)) requestBody.password = password;

    const targetUrl = `${baseUrl}/activities`;

    // Log BEFORE the fetch so a request that hangs or times out is still visible, and so the
    // exact moment each proxy->Flask call leaves is timestamped. forwardingPassword=true marks
    // the cold-login path (Flask falls back to a Garmin password login when it has no token).
    console.log(
        `[${new Date().toISOString()}] [garmin-activities][#${reqId}] -> POST ${targetUrl} ` +
            `user=${maskEmail(username)} window=${startDate}..${endDate || ''} ` +
            `forwardingPassword=${isNonEmptyString(password)}`,
    );

    // Wake the (possibly spun-down) Flask instance before sending the real request. When the
    // service is already warm this is a single fast 200 and adds negligible latency.
    const awake = await ensureServiceAwake(baseUrl, reqId);
    if (!awake) {
        console.error(`[garmin-activities][#${reqId}] wake: service not ready within ${WAKE_TOTAL_BUDGET_MS}ms`);
        return res.status(503).json({
            code: 'GARMIN_SERVICE_WAKING',
            message: 'Garmin service is starting up. Please try again in a moment.',
        });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const headers = { 'Content-Type': 'application/json', 'X-Request-Id': String(reqId) };
        if (process.env.SECRET_INTERNAL_API_KEY) {
            headers['X-API-Key'] = process.env.SECRET_INTERNAL_API_KEY;
        }

        const upstream = await fetch(targetUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
            signal: controller.signal,
        });

        // Read the raw text first so we can log it when the body is not JSON.
        const rawBody = await upstream.text();
        const ms = Date.now() - start;

        // Response line for EVERY response, not just errors. The server / cf-ray / content-type
        // headers are what distinguish the two 429 sources: Flask's own throttle returns JSON
        // (server=gunicorn-ish, no cf-ray), whereas a Render-edge throttle returns a text/plain
        // Cloudflare body (server=cloudflare, cf-ray set) and never reaches Flask at all.
        console.log(
            `[garmin-activities][#${reqId}] <- ${upstream.status} ${ms}ms ` +
                `server=${upstream.headers.get('server') || '-'} ` +
                `cfRay=${upstream.headers.get('cf-ray') || '-'} ` +
                `ct=${upstream.headers.get('content-type') || '-'} ` +
                `retryAfter=${upstream.headers.get('retry-after') || '-'} ` +
                `bytes=${rawBody.length}`,
        );

        let data = {};
        try {
            data = rawBody ? JSON.parse(rawBody) : {};
        } catch {
            data = {};
        }

        if (!upstream.ok) {
            const message = data?.message || 'Garmin service error';
            const code = String(message).includes('No valid token found') ? 'INVALID_TOKEN' : 'GARMIN_SERVICE_ERROR';
            // bodySnippet localizes the failure: a non-JSON body means an intermediary, not Flask.
            console.error(
                `[garmin-activities][#${reqId}] upstream ${upstream.status}: ${message} ` +
                    `bodySnippet=${JSON.stringify(rawBody.slice(0, 300))}`,
            );
            return res.status(upstream.status).json({ code, message });
        }

        const count = Array.isArray(data?.data) ? data.data.length : 0;
        console.log(`[garmin-activities][#${reqId}] success: ${count} activities in ${ms}ms`);
        return res.status(200).json(data);
    } catch (err) {
        const aborted = err?.name === 'AbortError';
        const message = aborted
            ? 'Garmin service timed out'
            : err instanceof Error
              ? err.message
              : 'Garmin relay failed';
        console.error(`[garmin-activities][#${reqId}] ${message} after ${Date.now() - start}ms`);
        return res.status(aborted ? 504 : 502).json({ code: 'GARMIN_SERVICE_ERROR', message });
    } finally {
        clearTimeout(timeout);
    }
}

module.exports = { getGarminActivities };
