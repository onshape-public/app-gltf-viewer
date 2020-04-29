# **app-gltf-viewer**
The GLTF Viewer is a sample application allowing for visualizing GLTF data translated from an Onshape model. It is a Node.JS application that runs as an tab inside an Onshape document. Onshape passes the document context to the viewer, which is used to help generate the GLTF visualization.

This example could also be re-worked to make it a fully separate application, which would communicate with the Onshape API to obtain the document information (as opposed to Onshape providing that context for the application).

## Installation
This section outlines how to deploy and configure the application on Heroku. If you are using another service, some of these steps will not apply to you, and the equivalent steps for the other service should be taken instead.

These instructions assume that the following utilities are installed: git, npm, and [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) (e.g. `brew tap heroku/brew && brew install heroku` on macOS or `sudo snap install --classic heroku` on Linux distributes that support Snap applications).

1. Make a bare clone of the repository: `git clone --bare https://github.com/onshape-public/gltf-viewer.git`.
1. Push to a new mirror repository: `cd gltf-viewer.git && git push --mirror https://github.com/youruser/my-gltf-viewer.git`.
1. Clean up the temporary repository: `cd .. && rm -rf gltf-viewer.git`.
1. Clone your newly mirrored repository: `https://github.com/youruser/my-gltf-viewer.git`.
1. Create a heroku app for your project: `cd my-gltf-viewer && heroku create`. Note the URL provided in the output of this command.
1. Go to the [Onshape Developer Portal](https://dev-portal.onshape.com/), create a new OAuth Application and Store entry with the following settings. Make sure that you copy the Client ID and Client Secret, as these will be needed later, and cannot be shown again.

OAuth Application Setting | Value
------------------------- | -----
Redirect URL | https://url-from-heroku-create.herokuapp.com/oauthRedirect
iframe URL | https://url-from-heroku-create.herokuapp.com/oauthSignin
7. Update the `package.json` file with your new Heroku application URL:
```json
{
  ...
  "repository": {
    "type": "git",
    "url": "https://url-from-heroku-create.herokuapp.com"
  },
  ...
}
```
8. Create a RedisTOGO add-on for you Heroku application: `heroku addons:create redistogo`.
1. Configure the necessary environment variables:
```Shell
heroku config:set API_URL https://cad.onshape.com/api
heroku config:set OAUTH_CALLBACK_URL https://url-from-heroku-create.herokuapp.com/oauthRedirect
heroku config:set OAUTH_CLIENT_ID=client-id-from-created-app-in-dev-portal
heroku config:set OAUTH_CLIENT_SECRET=client-secret-from-created-app-in-dev-portal
heroku config:set OAUTH_URL=https://oauth.onshape.com
heroku config:set WEBHOOK_CALLBACK_ROOT_URL=https://url-from-heroku-create.herokuapp.com
heroku config:set SESSION_SECRET=a-cryptographically-secure-string
```
10. You can confirm your configuration settings by running `heroku config`. You should see all of the above, plus a `REDISTOGO_URL` variable created by the add-on.
1. Commit your (local) configuration changes, and push to Heroku. This will start a build process, after which your application will be up and running.
`git commit -am "Updated configuration." && git push master heroku`. If you would like to watch the log as the build is running you can run `heroku logs --tail`.

## Usage
Once your application is deployed and configured, you can subscribe to it through the [Onshape App Store](https://appstore.onshape.com), and add it to your document. You can then use the dropdown menu at the top to select the element to translate and render, and it will be shown in the page.

Note that if you have a complex model with a lot of parts there are two implications: the dropdown list can be quite long; and translating the model to GLTF can be time consuming. If you think there is an issue loading or rendering your model, you can open the Javascript console of your browser to check for any errors. You may see a series of "404" messages - this is normal while the browser polls the application for the translated GLTF data.

Once the model is rendered, the following controls are available to you:
Control | How to Use
------- | ----------
Zoom | Mouse wheel
Rotate | Left-click and move mouse
Pan | Right-click and move mouse

## References
* [Onshape Developer Portal](https://dev-portal.onshape.com)
    * [Help / Documentation](https://dev-portal.onshape.com/help)
* [Heroku](https://heroku.com)
    * [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
* [GLTF information](https://www.khronos.org/gltf/) from Khronos Group
* [three.js](https://threejs.org/) library to render GLTF