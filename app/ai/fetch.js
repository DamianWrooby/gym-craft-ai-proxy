const openAIconfig = require('../config/openAI.config');

async function fetchAIChatCompletion(messages, options = {}) {
    const { maxTokens, timeoutMs, seed, model } = options;

    const payload = {
        model: model || openAIconfig.model,
        temperature: openAIconfig.completionTemperature,
        messages,
    };
    if (seed !== undefined) payload.seed = seed;
    // max_completion_tokens, not max_tokens: gpt-5.x models reject max_tokens with a 400.
    if (maxTokens) payload.max_completion_tokens = maxTokens;

    const controller = new AbortController();
    const timeoutId = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
        const response = await fetch(openAIconfig.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.SECRET_OPENAI_KEY}`,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        if (!response.ok) {
            const body = await response.json().catch(() => null);
            const detail = body?.error?.message ? `: ${body.error.message}` : '';
            const err = new Error(`OpenAI API returned status ${response.status}${detail}`);
            err.status = response.status;
            throw err;
        }

        return response.json();
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}

module.exports = fetchAIChatCompletion;
