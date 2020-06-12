const fetch = require('node-fetch');

const { onshapeApiUrl, webhookCallbackRootUrl } = require('../config');

module.exports = {
    
    /**
     * Register a new webhook to listen for translation completion.
     * 
     * @param {string} sessionID The ID of the current session.
     * @param {string} userAccessToken The OAuth token to pass to the API.
     * @param {string} documentId The ID if the current document.
     * 
     * @returns {Promise<string,string>} Resolves with the webhook ID, or rejects with error message.
     */
    registerWebhook: (userAccessToken, userID, documentId) => {
        return new Promise(async (resolve, reject) => {
            try {
                const resp = await fetch(`${onshapeApiUrl}/webhooks`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${userAccessToken}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/vnd.onshape.v1+json'
                    },
                    body: JSON.stringify({
                        events: [ 'onshape.model.translation.complete' ],
                        filter: `{$UserId} = '${userID}' && {$DocumentId} = '${documentId}'`,
                        options: { collapseEvents: false },
                        url: `${webhookCallbackRootUrl}/api/event`
                    })
                });
                const respJson = await resp.json();
                if (resp.ok) {
                    resolve(respJson.id);
                } else {
                    reject('Failed to create webhook ' + JSON.stringify(respJson));
                }
            } catch (err) {
                reject(err);
            }
        });
    },
    
    /**
     * Unregister the given webhook.
     * 
     * @param {string} webhookID The ID of the webhook to unregister.
     * @param {string} userAccessToken The OAuth token to pass to the API.
     * 
     * @returns {Promise<Response,string>} resolves with the response, or rejects with error text.
     */
    unregisterWebhook: (webhookID, userAccessToken) => {
        return new Promise(async (resolve, reject) => {
            const resp = await fetch(`${onshapeApiUrl}/webhooks/${webhookID}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${userAccessToken}` }
            });
            if (resp.ok) {
                resolve(resp);
            } else {
                reject(await resp.text());
            }
        });
    }
};
