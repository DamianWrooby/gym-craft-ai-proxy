// Runs one AiRequest row the main app wrote (gym-craft ADR 0014). The browser sends only
// { session, aiRequestId }; the prompt and model come from the row, so nothing here can be forged.
// Generic on purpose: this handler knows nothing about plans, it carries out the call and writes
// the answer back. Contract: gym-craft .ai/AI_REQUEST_PROXY_SPEC.md.
const db = require('../config/db.connection');
const getUser = require('../db/user');
const fetchAIChatCompletion = require('../ai/fetch');
const openAIconfig = require('../config/openAI.config');

const TAG = 'ai-request';
// Reasoning models can think for a while on a full plan week; Render has no request cap.
const TIMEOUT_MS = 150_000;
const MAX_ERROR_LENGTH = 1000;

function isNonEmptyString(v) {
    return typeof v === 'string' && v.trim().length > 0;
}

// The app chose the model, but the allowlist still guards against a stale or mistyped id.
function resolveModel(model) {
    if (openAIconfig.allowedModels.includes(model)) return model;
    console.warn(`[${TAG}] row asks for unknown model "${model}" — using default ${openAIconfig.defaultModel}`);
    return openAIconfig.defaultModel;
}

async function finish(id, status, fields) {
    await db.none(`UPDATE "AiRequest" SET status = $2, output = $3, error = $4, "updatedAt" = NOW() WHERE id = $1`, [
        id,
        status,
        fields.output ?? null,
        fields.error ? fields.error.slice(0, MAX_ERROR_LENGTH) : null,
    ]);
}

async function claim(id, userId) {
    const row = await db.oneOrNone(
        `UPDATE "AiRequest" SET status = 'RUNNING', "updatedAt" = NOW()
         WHERE id = $1 AND "userId" = $2 AND status = 'PENDING'
         RETURNING model, input`,
        [id, userId],
    );
    if (row) return row;
    const current = await db.oneOrNone(`SELECT status FROM "AiRequest" WHERE id = $1 AND "userId" = $2`, [id, userId]);
    return current ? { status: current.status } : { missing: true };
}

async function runAiRequest(req, res) {
    const start = Date.now();
    const { session, aiRequestId } = req.body || {};
    if (!isNonEmptyString(aiRequestId)) {
        return res.status(400).json({ error: 'aiRequestId must be a non-empty string' });
    }

    let user;
    try {
        user = await getUser(session);
    } catch (err) {
        if (err?.status === 401) return res.status(401).json({ code: err.code, error: err.message });
        console.error(`[${TAG}] user lookup failed:`, err?.message);
        return res.status(500).json({ error: 'Server error' });
    }

    // Claiming PENDING → RUNNING in one statement means two tabs can never pay for the same call.
    let claimed;
    try {
        claimed = await claim(aiRequestId, user.id);
    } catch (err) {
        console.error(`[${TAG}] claim failed:`, err?.message);
        return res.status(500).json({ error: 'Server error' });
    }
    if (claimed.missing) return res.status(404).json({ error: 'AI request not found' });
    if (claimed.status) return res.status(409).json({ status: claimed.status, error: 'AI request is not pending' });

    const input = claimed.input || {};
    if (!isNonEmptyString(input.system) || !isNonEmptyString(input.user)) {
        await finish(aiRequestId, 'FAILED', { error: 'Row input has no system or user prompt' }).catch(() => {});
        return res.status(422).json({ status: 'FAILED', error: 'Invalid request input' });
    }

    const model = resolveModel(claimed.model);
    console.log(`[${new Date().toISOString()}] [${TAG}] ${aiRequestId} running on ${model}`);
    try {
        const completion = await fetchAIChatCompletion(
            [
                { role: 'system', content: input.system },
                { role: 'user', content: input.user },
            ],
            { maxTokens: input.maxTokens, timeoutMs: TIMEOUT_MS, model, json: input.json === true },
        );
        const text = completion?.choices?.[0]?.message?.content?.trim() ?? '';
        if (!text) {
            await finish(aiRequestId, 'FAILED', { error: 'OpenAI returned an empty response' });
            return res.status(502).json({ status: 'FAILED', error: 'Empty response' });
        }
        await finish(aiRequestId, 'DONE', { output: text });
        console.log(`[${TAG}] ${aiRequestId} done in ${Date.now() - start}ms`);
        return res.status(200).json({ status: 'DONE' });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown OpenAI error';
        console.error(`[${TAG}] ${aiRequestId} failed:`, message);
        await finish(aiRequestId, 'FAILED', { error: message }).catch((e) =>
            console.error(`[${TAG}] could not record failure:`, e?.message),
        );
        return res.status(502).json({ status: 'FAILED', error: 'AI call failed' });
    }
}

module.exports = runAiRequest;
