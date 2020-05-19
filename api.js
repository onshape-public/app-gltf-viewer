const fetch = require('node-fetch');

const WebhookService = require('./services/webhook-service');
const TranslationService = require('./services/translation-service');
const { onshapeApiUrl, forwardRequestToOnshape } = require('./utils');
const redisClient = require('./redis-client');
    
const apiRouter = require('express').Router();

/**
 * Get the Elements of the current document/workspace.
 * 
 * GET /api/elements
 *      -> 200, [ ...elements ]
 *      -or-
 *      -> 500, { error: '...' }
 */
apiRouter.get('/elements', (req, res) => {
    forwardRequestToOnshape(`${onshapeApiUrl}/documents/d/${req.query.documentId}/w/${req.query.workspaceId}/elements`, req, res);
});

/**
 * Get the Parts of the current document/workspace.
 * 
 * GET /api/parts
 *      -> 200, [ ...parts ]
 *      -or-
 *      -> 500, { error: '...' }
 */
apiRouter.get('/parts', (req, res) => {
    forwardRequestToOnshape(`${onshapeApiUrl}/parts/d/${req.query.documentId}/w/${req.query.workspaceId}`, req, res);
});

/**
 * Trigger translation to GLTF from the given element.
 * 
 * GET /api/gltf?documentId=...&workspaceId=...&gltfElementId=...
 *      -> 200, { ..., id: '...' }
 *      -or-
 *      -> 500, { error: '...' }
 */
apiRouter.get('/gltf', async (req, res) => {
    // Extract the necessary IDs from the querystring
    const did = req.query.documentId,
        wid = req.query.workspaceId,
        gltfElemId = req.query.gltfElementId,
        partId = req.query.partId;
    
    WebhookService.registerWebhook(req.sessionID, req.user.accessToken, did);
    
    const translationParams = {
        documentId: did,
        workspaceId: wid,
        resolution: 'medium',
        distanceTolerance: 0.00012,
        angularTolerance: 0.1090830782496456,
        maximumChordLength: 10
    };
    try {
        const resp = await (partId ? TranslationService.translatePart(req.user.accessToken, gltfElemId, partId, translationParams)
            : TranslationService.translateElement(req.user.accessToken, gltfElemId, translationParams));
        res.status(200).contentType(resp.contentType).send(resp.data);
    } catch (err) {
        console.log(`GET /gltf: error: ${err}`);
        res.status(500).json({ error: err });
    }
});

/**
 * Retrieve the translated GLTF data.
 * 
 * GET /api/gltf/:tid
 *      -> 200, { ...gltf_data }
 *      -or-
 *      -> 500, { error: '...' }
 *      -or-
 *      -> 404 (which may mean that the translation is still being processed)
 */
apiRouter.get('/gltf/:tid', async (req, res) => {
    redisClient.get(req.params.tid, async (redisErr, results) => {
        console.log(`GET /gltf/${req.params.tid}: redis results: ${results}`);
        if (redisErr) {
            res.status(500).json({ error: redisErr });
        } else if (!results) {
            res.status(404).end();
        } else {
            // GLTF data is ready
            const transResp = await fetch(`${onshapeApiUrl}/translations/${req.params.tid}`, { headers: { 'Authorization': `Bearer ${req.user.accessToken}` } });
            const transJson = await transResp.json();
            if (transJson.requestState === 'FAILED') {
                res.status(500).json({ error: transJson.failureReason});
            } else {
                forwardRequestToOnshape(`${onshapeApiUrl}/documents/d/${transJson.documentId}/externaldata/${transJson.resultExternalDataIds[0]}`, req);
            }
            const webhookID = results;
            WebhookService.unregisterWebhook(webhookID, req.user.accessToken)
                .then(() => console.log(`Webhook ${webhookID} unregistered successfully`))
                .catch((err) => console.error(`Failed to unregister webhook ${webhookID}: ${JSON.stringify(err)}`));
        }
    });
});

/**
 * Receive a webhook event.
 * 
 * POST /api/event
 *      -> 200
 */
apiRouter.post('/event', (req, res) => {
    if (req.body.event === 'onshape.model.translation.complete') {
        // Save in Redis so we can return to client later (& unregister the webhook).
        console.log('POST /event: received notification that translation is complete');
        redisClient.set(req.body.translationId, req.body.webhookId);
    }
    res.status(200).send();
});

module.exports = apiRouter;
