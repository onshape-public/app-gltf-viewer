
const path = require('path');
const uuid = require('uuid');

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');

const RedisStore = require('connect-redis')(session);
const passport = require('passport');
const OnshapeStrategy = require('passport-onshape');
const fetch = require('node-fetch');

const redisClient = require('./redis-client');

const { onshapeApiUrl } = require('./utils');

const app = express();

/*app.set('views', path.join(__dirname, 'views'));
app.engine('html', require('hbs').__express);
app.set('view engine', 'html');*/

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'dist')));
app.use(bodyParser.json());

app.use(session({
    store: new RedisStore({
        client: redisClient
    }),
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    resave: false
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new OnshapeStrategy({
        clientID: process.env.OAUTH_CLIENT_ID,
        clientSecret: process.env.OAUTH_CLIENT_SECRET,
        callbackURL: process.env.OAUTH_CALLBACK_URL,
        authorizationURL: `${process.env.OAUTH_URL}/oauth/authorize`,
        tokenURL: `${process.env.OAUTH_URL}/oauth/token`,
        userProfileURL: `${process.env.OAUTH_URL}/api/users/sessioninfo`
    },
    (accessToken, refreshToken, profile, done) => {
        profile.accessToken = accessToken;
        profile.refreshToken = refreshToken;
        return done(null, profile);
    }
));
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

app.use('/oauthSignin', (req, res) => {
    const state = {
        docId: req.query.documentId,
        workId: req.query.workspaceId,
        elId: req.query.elementId
    };
    redisClient.set(req.sessionID, JSON.stringify(state));
    return passport.authenticate('onshape', { state: uuid.v4(state) })(req, res);
}, (req, res) => { /* unused */ });

app.use('/oauthRedirect', passport.authenticate('onshape', { failureRedirect: '/grantDenied' }), (req, res) => {
    redisClient.get(req.sessionID, (err, results) => {
        if (err) {
            res.status(500).json({ error: err });
        } else if (results != null) {
            const state = JSON.parse(results);
            fetch(`${onshapeApiUrl}/users/sessioninfo`, {
                headers: {
                    'Authorization': `Bearer ${req.user.accessToken}`,
                    'Accept': 'application/vnd.onshape.v1+json'
                }})
                    .then((sessioninfoResp) => sessioninfoResp.json())
                    .then((sessioninfoRespJson) => sessioninfoRespJson.id)
                    .then((userID) => {
                        state.userID = userID;
                        redisClient.set(req.sessionID, JSON.stringify(state));
                });
            res.redirect(`/?documentId=${state.docId}&workspaceId=${state.workId}&elementId=${state.elId}`);
        } else {
            res.status(500).json({ error: 'No session found.' });
        }
    });
});

app.get('/grantDenied', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'html', 'grantDenied.html'));
})

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'html', 'index.html'));
});

app.use('/api', require('./routes/api'));

module.exports = app;
