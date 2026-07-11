// Model selection — who decides what:
//
// - Gym-plan generation (/api/generate-plan): always uses `defaultModel` below.
//   To change the plan-generation model, edit `defaultModel` — nothing else.
// - Weekly report + explain-run (/api/weekly-report, /api/explain-run): the main app
//   sends a `model` field per subscription tier (TIER_LIMITS in gym-craft's
//   src/constants/subscription.constants.ts — FREE: gpt-5.4-mini, SUPPORTER: gpt-5.4).
//   To change those models, edit TIER_LIMITS in the main app AND keep the id listed
//   in `allowedModels` here; unknown/missing ids fall back to `defaultModel`.
//
// Note: gpt-5.x models reject `max_tokens` (use max_completion_tokens — handled in ai/fetch.js).
const openAIconfig = {
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-5.4-mini',
    allowedModels: ['gpt-5.4-mini', 'gpt-5.4'],
    completionSeed: 1,
    completionTemperature: 0.2,
};

module.exports = openAIconfig;
