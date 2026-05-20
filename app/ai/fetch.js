const openAIconfig = require('../config/openAI.config');

async function fetchAIChatCompletion(messages, options = {}) {
    const { maxTokens, timeoutMs, seed } = options;

    const payload = {
        model: openAIconfig.model,
        temperature: openAIconfig.completionTemperature,
        messages,
    };
    if (seed !== undefined) payload.seed = seed;
    if (maxTokens) payload.max_tokens = maxTokens;

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
            const err = new Error(`OpenAI API returned status ${response.status}`);
            err.status = response.status;
            throw err;
        }

        return response.json();
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}

module.exports = fetchAIChatCompletion;
