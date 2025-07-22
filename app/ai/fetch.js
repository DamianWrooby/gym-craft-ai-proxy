const openAIconfig = require('../config/openAI.config');

async function fetchAIChatCompletion(messages) {
    const body = JSON.stringify({
        model: openAIconfig.model,
        seed: openAIconfig.completionSeed,
        temperature: openAIconfig.completionTemperature,
        messages,
    });

    // Check if the request body is valid
    if (!body || typeof body !== 'string') {
        throw new Error('Invalid request body');
    }

    const response = await fetch(openAIconfig.apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.SECRET_OPENAI_KEY}`,
        },
        body: body,
    });

    if (!response.ok) {
        throw new Error(`OpenAI API returned status ${response.status}`);
    }

    return response.json();
}

module.exports = fetchAIChatCompletion;