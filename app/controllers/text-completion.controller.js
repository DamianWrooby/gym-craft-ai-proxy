const fetchAIChatCompletion = require('../ai/fetch');

const TIMEOUT_MS = 45_000;

function isNonEmptyString(v) {
    return typeof v === 'string' && v.trim().length > 0;
}

function createTextCompletionHandler({ tag, maxTokens, responseKey }) {
    return async function handler(req, res) {
        const start = Date.now();
        const { system, user } = req.body || {};

        if (!isNonEmptyString(system) || !isNonEmptyString(user)) {
            return res.status(400).json({ error: 'system and user must be non-empty strings' });
        }

        const sizeBytes = Buffer.byteLength(system, 'utf8') + Buffer.byteLength(user, 'utf8');
        console.log(`[${new Date().toISOString()}] [${tag}] received (${sizeBytes} bytes)`);

        try {
            const openAIStart = Date.now();
            const completion = await fetchAIChatCompletion(
                [
                    { role: 'system', content: system },
                    { role: 'user', content: user },
                ],
                { maxTokens, timeoutMs: TIMEOUT_MS },
            );
            const openAILatency = Date.now() - openAIStart;

            const text = completion?.choices?.[0]?.message?.content?.trim() ?? '';

            if (!text) {
                console.error(`[${tag}] empty completion after ${openAILatency}ms`);
                return res.status(502).json({ error: 'OpenAI returned an empty response' });
            }

            console.log(`[${tag}] success in ${openAILatency}ms (total ${Date.now() - start}ms)`);
            return res.status(200).json({ [responseKey]: text });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown OpenAI error';
            console.error(`[${tag}] OpenAI call failed:`, message);
            if (err?.status === 429) {
                return res.status(503).json({ error: 'OpenAI rate limit reached' });
            }
            return res.status(502).json({ error: message });
        }
    };
}

module.exports = createTextCompletionHandler;
