
const fetch = require('node-fetch');

const { onshapeApiUrl } = require('../utils');

const redisClient = require('../redis-client');

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
    registerWebhook: (sessionID, userAccessToken, documentId) => {
        return new Promise((resolve, reject) => {
            redisClient.get(sessionID, (err, data) => {
                if (err) {
                    reject('Failed to read data from Redis ' + err);
                } else if (!data) {
                    reject('No session data found');
                } else {
                    const jsonData =  JSON.parse(data);
                    fetch(`${onshapeApiUrl}/webhooks`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${userAccessToken}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/vnd.onshape.v1+json'
                        },
                        body: JSON.stringify({
                            events: [ 'onshape.model.translation.complete' ],
                            filter: `{$UserId} = '${jsonData.userID}' && {$DocumentId} = '${documentId}'`,
                            options: { collapseEvents: false },
                            url: `${process.env.WEBHOOK_CALLBACK_ROOT_URL}/api/event`
                        })
                    }).then((resp) => {
                        resp.json().then((json) => {
                            if (resp.ok) {
                                resolve(json.id);
                            } else {
                                reject('Failed to create webhook ' + JSON.stringify(json));
                            }
                        }).catch((err) => reject('Unexpected remote response: ' + err));
                    }).catch((err) => reject('Unexpected remote response: ' + err));
                }
            });
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
        return new Promise((resolve, reject) => {
            fetch(`${onshapeApiUrl}/webhooks/${webhookID}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${userAccessToken}` }
            }).then((resp) => {
                if (resp.ok) {
                    resolve(resp);
                } else {
                    resp.text().then((text) => reject(text));
                }
            }).catch((err) => reject(err));
        });
    }
};
