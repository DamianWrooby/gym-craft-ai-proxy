const createPrompt = require('../ai/prompt');
const fetchAIChatCompletion = require('../ai/fetch');
const convertWorkoutToGarmin = require('../utils/workout-generator');
const getUser = require('../db/user');
const SurveyFormSchema = require('../schema/form-data');

async function getCompletion(req, res) {
    const start = Date.now();
    console.log(`[${new Date().toISOString()}] Start getCompletion`);

    try {
        const { session, formData } = req.body || {};

        console.log('Validating form data...');
        const formValidation = SurveyFormSchema.safeParse(formData);
        if (!formValidation.success) {
            console.log('Invalid form data');
            return res.status(400).send('Invalid form data');
        }

        console.log('Checking user session...');
        await getUser(session);

        console.log('Creating prompt...');
        const prompt = createPrompt(formData);

        console.log('Calling OpenAI API...');
        const openAIStart = Date.now();
        const chatCompletion = await fetchAIChatCompletion(prompt);
        console.log(`OpenAI API response took ${Date.now() - openAIStart}ms`);

        const generatedPlan = chatCompletion?.choices[0]?.message?.content;
        if (!generatedPlan || typeof generatedPlan !== 'string') {
            return res.status(500).send('Invalid response from OpenAI');
        }

        console.log('Parsing and converting plan...');
        const cleanJson = generatedPlan.trim().replace(/^```json\s*|\s*```$/g, '');
        const convertedPlan = JSON.parse(cleanJson);
        convertedPlan.workouts = convertedPlan.workouts.map(convertWorkoutToGarmin);

        console.log(`[${new Date().toISOString()}] Finished in ${Date.now() - start}ms`);
        return res.json(convertedPlan);
    } catch (error) {
        console.error('Error in getCompletion:', error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = {
    getCompletion,
};
