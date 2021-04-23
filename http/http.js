"use strict"; 

const http = require ('http');
const log = require ('../logger.js');
const rqlite = require ('../rqlite/rqlite.js');
const Distribute = require ('../cluster.js');

module.exports = http.createServer (async (request, response) => {
    // check request path
    const requestURL = new URL (request.url, `http://${request.headers.host}`);
    // if request is for ACME challenge
    if (requestURL.pathname && requestURL.pathname.startsWith ('/.well-known/acme-challenge/')) {

        log.debug (`Received certificate challenge request for ${requestURL.hostname}.`);
        const token = requestURL.pathname.replace ('/.well-known/acme-challenge/', '');
        const challengeQuery = await rqlite.dbQuery (`SELECT response, acme_order FROM challenges
            WHERE token = '${token}';`);
        
        if (challengeQuery.results.length > 0) {
            log.debug (`Got challenge response from database in ${challengeQuery.time * 1000} ms.`)
            // write challenge response to request
            response.writeHead (200, {
                'Content-Type': 'text/plain'
            });
            response.write (challengeQuery.results[0].response);
            response.end ();

        } else {
            log.warn (`Could not find challenge response for ${requestURL.hostname}.`);
            return;
        }

    } else {

        // redirect to https
        const redirectLocation = "https://" + request.headers['host'] + request.url;
        response.writeHead(301, {
            "Location": redirectLocation
        });
        response.end();

    };
}).on ('listening', () => {
    log.info ('HTTP server started.');
}).on ('close', () => {
    log.info ('HTTP server stopped.');
});