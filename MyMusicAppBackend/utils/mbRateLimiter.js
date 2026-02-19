// MyMusicAppBackend/utils/mbRateLimiter.js

const PUBLIC_API_THROTTLE_DELAY = 2000; // 2 seconds per request
let requestQueue = Promise.resolve(); // A promise chain to ensure sequential execution
let lastRequestTime = 0;

const USER_AGENT_STRING = 'MyMusicApp/1.0.0 ( YourEmail@example.com )'; // <<< REPLACE WITH YOUR ACTUAL EMAIL!

/**
 * Executes a function after applying MusicBrainz API rate limit.
 * Ensures requests are sent sequentially with a minimum delay.
 * Rejects the promise if the inner API call fails or returns null,
 * propagating the failure up the chain.
 * @param {Function} apiCallFunction The async function to execute (e.g., fetch, db.query).
 * @returns {Promise<any>} The result of the apiCallFunction, or a rejected promise on failure.
 */
const applyMusicBrainzRateLimit = (apiCallFunction) => {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    let delay = 0;

    if (timeSinceLastRequest < PUBLIC_API_THROTTLE_DELAY) {
        delay = PUBLIC_API_THROTTLE_DELAY - timeSinceLastRequest;
    }

    // Chain the current request onto the previous one, ensuring sequential execution
    requestQueue = requestQueue.then(() => new Promise(async (resolve, reject) => {
        setTimeout(async () => {
            lastRequestTime = Date.now();
            try {
                const result = await apiCallFunction();
                if (result === null) {
                    // If the inner function explicitly returned null, consider it a failure for propagation
                    reject(new Error("API call returned null result after rate limit."));
                } else {
                    resolve(result);
                }
            } catch (error) {
                // Catch any errors from the apiCallFunction itself and reject the promise chain
                console.error("Error executing rate-limited API call:", error);
                reject(error); // Propagate the original error
            }
        }, delay);
    }));

    return requestQueue;
};

module.exports = {
    applyMusicBrainzRateLimit,
    USER_AGENT_STRING,
    MUSICBRAINZ_API_BASE_URL: 'https://musicbrainz.org/ws/2',
};