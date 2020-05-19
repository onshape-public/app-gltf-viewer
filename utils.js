const fetch = require('node-fetch');

module.exports = {
    
    /**
     * The URL of the Onshape API. This must be set as an environment variable.
     */
    onshapeApiUrl: process.env.API_URL,
    
    /**
     * Send a request to the Onshape API, and proxy the response back to the caller.
     * 
     * @param {string} apiPath The API path to be called. This can be absolute or a path fragment.
     * @param {Request} req The request being proxied.
     * @param {Response} res The response being proxied.
     */
    forwardRequestToOnshape: async (apiPath, req, res) => {
        try {
            const normalizedUrl = apiPath.indexOf(onshapeApiUrl) === 0 ? apiPath : `${onshapeApiUrl}/${apiPath}`;
            const resp = await fetch(normalizedUrl, { headers: { Authorization: `Bearer ${req.user.accessToken}` }});
            const data = await resp.text();
            const contentType = resp.headers.get('Content-Type');
            console.log(`forwardRequestToOnshape: info: sending ${contentType} data ${data}`);
            res.status(200).contentType(contentType).send(data);
        } catch (err) {
            console.error(`forwardRequestToOnshape: error: ${err}`);
            res.status(500).json({ error: err });
        }
    }
}
