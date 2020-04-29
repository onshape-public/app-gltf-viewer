const redis = require('redis');

// The Redis client to be used throughout the app.
let redisClient;
if (process.env.REDISTOGO_URL) {
    const url = require('url').parse(process.env.REDISTOGO_URL);
    redisClient = redis.createClient(url.port, url.hostname);
    redisClient.auth(url.auth.split(':')[1]);
} else if (process.env.REDIS_HOST && process.env.REDIS_PORT) {
    redisClient = redis.createClient(process.env.REDIS_PORT, process.env.REDIS_HOST);
} else {
    redisClient = redis.createClient();
}

module.exports = redisClient;
