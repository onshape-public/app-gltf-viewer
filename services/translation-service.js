const fetch = require('node-fetch');

const { onshapeApiUrl } = require('../config');

/**
 * The default body contents for translation requests. Request-specific
 * information is appended to a copy of this and submitted as the body
 * for that particular request.
 */
const defaultBody = Object.freeze({
    includeExportIds: false,
    formatName: "GLTF",
    flattenAssemblies: false,
    yAxisIsUp: false,
    triggerAutoDownload: false,
    storeInDocument: false,
    connectionId: '',
    versionString: '',
    grouping: true,
    destinationName: '',
    configuration: 'default',
    cloudStorageAccountId: null,
    emailLink: false,
    emailTo: null,
    emailSubject: null,
    emailMessage: null,
    sendCopyToMe: null,
    passwordRequired: null,
    password: null,
    validForDays: null,
    fromUserId: null
});

/**
 * Trigger the translation of the given element or part to GLTF.
 * 
 * @param {string} userAccessToken The OAuth token to pass to the API.
 * @param {string} url The URL to be requested.
 * @param {object} jsonBodyToAdd The parameters to be added to the default parameters to pass to the translation engine.
 *      @param {string} jsonBodyToAdd.workspaceId The ID of the current workspace.
 *      @param {string} jsonBodyToAdd.gltfElementId The ID of the element/part to be translated.
 *      @param {string} jsonBodyToAdd.partId The ID of the part to be translated.
 *      @param {string} jsonBodyToAdd.resolution The resolution of the translation.
 *      @param {string} jsonBodyToAdd.distanceTolerance The distance tolerance of the translation.
 *      @param {string} jsonBodyToAdd.angularTolerance The angular tolerance of the translation.
 *      @param {string} jsonBodyToAdd.maximumChordLength The max chord length of the translation.
 * 
 * @returns {Promise<object,string>} Resolves with an object with properties `contentType` (string)
 *      and `data` (string), containing the Content-Type and response body of the translation trigger,
 *      or rejects with a string error message.
 */
const startTranslation = (userAccessToken, url, jsonBodyToAdd) => {
    const body = Object.assign(Object.assign({}, defaultBody), jsonBodyToAdd);
    return new Promise(async (resolve, reject) => {
        try {
            const resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${userAccessToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(body)
            });
            const text = await resp.text();
            if (resp.ok) {
                resolve({ contentType: resp.headers.get('Content-Type'), data: text });
            } else {
                reject(text);
            }
        } catch (err) {
            reject(err);
        }
    });
};

module.exports = {
    
    /**
     * Trigger the translation of the given element to GLTF.
     * 
     * @param {string} userAccessToken The OAuth token to pass to the API.
     * @param {string} elementId The ID of the element to be translated.
     * @param {object} translationParams The parameters to pass to the translation engine.
     *      @param {string} translationParams.workspaceId The ID of the current workspace.
     *      @param {string} translationParams.resolution The resolution of the translation.
     *      @param {string} translationParams.distanceTolerance The distance tolerance of the translation.
     *      @param {string} translationParams.angularTolerance The angular tolerance of the translation.
     *      @param {string} translationParams.maximumChordLength The max chord length of the translation.
     * 
     * @returns {Promise<object,object>} Resolves or rejects with an object with properties `contentType` (string)
     *      and `data` (string), containing the Content-Type and response body of the translation trigger
     */
    translateElement: (userAccessToken, elementId, translationParams) => {
        const transUrl = `${onshapeApiUrl}/assemblies/d/${translationParams.documentId}/w/${translationParams.workspaceId}/e/${elementId}/translations`;
        const bodyAdditions = {
            linkDocumentWorkspaceId: translationParams.workspaceId,
            elementId: elementId,
            resolution: translationParams.resolution,
            distanceTolerance: translationParams.distanceTolerance,
            angularTolerance: translationParams.angularTolerance,
            maximumChordLength: translationParams.maximumChordLength
        }
        return startTranslation(userAccessToken, transUrl, bodyAdditions);
    },
    
    /**
     * Trigger the translation of the given part to GLTF.
     * 
     * @param {string} userAccessToken The OAuth token to pass to the API.
     * @param {string} elementId The ID of the element.
     * @param {string} partId The ID of the part to be translated.
     * @param {object} translationParams The parameters to pass to the translation engine.
     *      @param {string} translationParams.workspaceId The ID of the current workspace.
     *      @param {string} translationParams.resolution The resolution of the translation.
     *      @param {string} translationParams.distanceTolerance The distance tolerance of the translation.
     *      @param {string} translationParams.angularTolerance The angular tolerance of the translation.
     *      @param {string} translationParams.maximumChordLength The max chord length of the translation.
     * 
     * @returns {Promise<object,object>} Resolves or rejects with an object with properties `contentType` (string)
     *      and `data` (string), containing the Content-Type and response body of the translation trigger
     */
    translatePart: (userAccessToken, elementId, partId, translationParams) => {
        const transUrl = `${onshapeApiUrl}/partstudios/d/${translationParams.documentId}/w/${translationParams.workspaceId}/e/${elementId}/translations`
        const bodyAdditions = {
            linkDocumentWorkspaceId: translationParams.workspaceId,
            partIds: partId,
            resolution: translationParams.resolution,
            distanceTolerance: translationParams.distanceTolerance,
            angularTolerance: translationParams.angularTolerance,
            maximumChordLength: translationParams.maximumChordLength
        };
        return startTranslation(userAccessToken, transUrl, bodyAdditions);
    }
}
