const createPrompt = require('../ai/prompt');
const fetchAIChatCompletion = require('../ai/fetch');
const convertWorkoutToGarmin = require('../utils/workout-generator');
const getUser = require('../db/user');
const SurveyFormSchema = require('../schema/form-data');

async function getCompletion(req, res) {
    try {
        const { session, formData } = req.body || {};

        // Validate the form data
        if (!formData || typeof formData !== 'object') {
            return res.status(400).send('Invalid request body');
        }
        const formValidation = SurveyFormSchema.safeParse(formData);
        if (!formValidation.success) {
            return res.status(400).send('Invalid form data');
        }

        try {
            await getUser(session);
        } catch (error) {
            return res.status(401).send('Unauthorized');
        }

        // Get the completion from OpenAI
        const prompt = createPrompt(formData);

        const chatCompletion = await fetchAIChatCompletion(prompt);

        const generatedPlan = chatCompletion?.choices[0]?.message?.content;
        if (!generatedPlan || typeof generatedPlan !== 'string' || generatedPlan.length === 0) {
            return res.status(500).send('External API error - no response text');
        }

        const cleanJson = generatedPlan.trim().replace(/^```json\s*|\s*```$/g, '');
        const convertedPlan = JSON.parse(cleanJson);
        convertedPlan.workouts = convertedPlan.workouts.map(convertWorkoutToGarmin);

        return res.json(convertedPlan);
    } catch (error) {
        console.error('Error in getCompletion:', error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = {
    getCompletion,
};
