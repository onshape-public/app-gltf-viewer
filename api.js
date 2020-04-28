const fetch = require('node-fetch');

const WebhookService = require('../services/webhook-service');
const TranslationService = require('../services/translation-service');
const { onshapeApiUrl } = require('../utils');
const redisClient = require('../redis-client');
    
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
    fetch(`${onshapeApiUrl}/documents/d/${req.query.documentId}/w/${req.query.workspaceId}/elements`, {
        headers: { 'Authorization': `Bearer ${req.user.accessToken}` }
    })
        .then((resp) => resp.text())
        .then((data) => res.status(200).send(data))
        .catch((err) => res.status(500).json({ error: err }));
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
    fetch(`${onshapeApiUrl}/parts/d/${req.query.documentId}/w/${req.query.workspaceId}`, {
        headers: { 'Authorization': `Bearer ${req.user.accessToken}` }
    })
        .then((resp) => resp.text())
        .then((data) => res.send(data))
        .catch((err) => res.status(500).json({ error: err }));
});

/**
 * Trigger translation to GLTF from the given element.
 * 
 * GET /api/gltf?documentId=...&workspaceId=...&gltfElementId=...
 *      -> 200, { ..., id: '...' }
 *      -or-
 *      -> 500, { error: '...' }
 */
apiRouter.get('/gltf', (req, res) => {
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
    (partId ? TranslationService.translatePart(req.user.accessToken, gltfElemId, partId, translationParams)
        : TranslationService.translateElement(req.user.accessToken, gltfElemId, translationParams))
            .then((json) => {
                if (json.contentType.indexOf('json') > -1) {
                    res.status(200).json(JSON.parse(json.data));
                } else {
                    res.status(200).contentType(json.contentType).send(json.data);
                }
            }).catch((err) => res.status(500).json({ error: err.data }));
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
apiRouter.get('/gltf/:tid', (req, res) => {
    redisClient.get(req.params.tid, (redisErr, results) => {
        if (redisErr) {
            res.status(500).json({ error: redisErr });
        } else if (!results) {
            res.status(404).end();
        } else {
            // GLTF data is ready
            fetch(`${onshapeApiUrl}/translations/${req.params.tid}`, { headers: { 'Authorization': `Bearer ${req.user.accessToken}` } })
                .then((transResp) => transResp.json())
                .then((transJson) => {
                    if (transJson.requestState === 'FAILED') {
                        res.status(500).json({ error: transJson.failureReason});
                    } else {
                        fetch(`${onshapeApiUrl}/documents/d/${transJson.documentId}/externaldata/${transJson.resultExternalDataIds[0]}`, { headers: { 'Authorization': `Bearer ${req.user.accessToken}` } })
                            .then((extDataResp) => {
                                extDataResp.text()
                                    .then((extDataBody) => res.status(extDataResp.status).contentType(extDataResp.headers.get('Content-Type')).send(extDataBody))
                                    .catch((err) => res.status(500).json({ error: err }));
                            }).catch((err) => res.status(500).json({ error: err }));
                    }
                }).catch((err) => res.status(500).json({ error: err }))
                .finally(() => {
                    const webhookID = results;
                    WebhookService.unregisterWebhook(webhookID, req.user.accessToken)
                        .then(() => console.log(`Webhook ${webhookID} unregistered successfully`))
                        .catch((err) => console.error(`Failed to unregister webhook ${webhookID}: ${JSON.stringify(err)}`));
                });
        }
    });
});

/**
 * Recieve a webhook event.
 * 
 * POST /api/event
 *      -> 200
 */
apiRouter.post('/event', (req, res) => {
    if (req.body.event === 'onshape.model.translation.complete') {
        // Save in Redis so we can return to client later (& unregister the webhook).
        redisClient.set(req.body.translationId, req.body.webhookId);
    }
    res.status(200).send();
});

module.exports = apiRouter;
