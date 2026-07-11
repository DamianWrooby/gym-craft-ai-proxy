const fetchAIChatCompletion = require('../ai/fetch');
const openAIconfig = require('../config/openAI.config');

const TIMEOUT_MS = 45_000;

function isNonEmptyString(v) {
    return typeof v === 'string' && v.trim().length > 0;
}

// Optional per-request model override sent by the main app (subscription tier based).
// Only allowlisted ids are honored; anything else falls back to the config default.
function resolveModel(requested, tag) {
    if (requested === undefined) return undefined;
    if (isNonEmptyString(requested) && openAIconfig.allowedModels.includes(requested.trim())) {
        return requested.trim();
    }
    console.warn(`[${tag}] ignoring unknown model "${requested}" — using default ${openAIconfig.defaultModel}`);
    return undefined;
}

function createTextCompletionHandler({ tag, maxTokens, responseKey }) {
    return async function handler(req, res) {
        const start = Date.now();
        const { system, user, model } = req.body || {};

        if (!isNonEmptyString(system) || !isNonEmptyString(user)) {
            return res.status(400).json({ error: 'system and user must be non-empty strings' });
        }

        const resolvedModel = resolveModel(model, tag);
        const sizeBytes = Buffer.byteLength(system, 'utf8') + Buffer.byteLength(user, 'utf8');
        console.log(
            `[${new Date().toISOString()}] [${tag}] received (${sizeBytes} bytes, model ${resolvedModel ?? openAIconfig.defaultModel})`,
        );

        try {
            const openAIStart = Date.now();
            const completion = await fetchAIChatCompletion(
                [
                    { role: 'system', content: system },
                    { role: 'user', content: user },
                ],
                { maxTokens, timeoutMs: TIMEOUT_MS, model: resolvedModel },
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
