const openAIconfig = {
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    // Models the main app may request via the optional `model` body field
    // (subscription tier based: gpt-5.4-mini for free users, gpt-5.4 for supporters).
    // Anything else falls back to the default `model` above.
    allowedModels: ['gpt-5.4-mini', 'gpt-5.4', 'gpt-4o-mini'],
    completionSeed: 1,
    completionTemperature: 0.2,
};

module.exports = openAIconfig;
