'use strict';

const DEFAULT_PORT = 3000;

// ** Dependencies
const http = require('http');
const util = require('util');
const Activity = require('dataprocess').Activity;

function createServer(port, requestHandler) {

    // Argument Defaults
    port = port || DEFAULT_PORT;

    // Activity to handle the request
    const request_handler = Activity(`http-server:${port}`, requestHandler);

    // Create an Http Server instance
    const server = http.createServer((req, res) => {
        res.setHeader('Content-Type', 'application/json');

        request_handler
            .run(req, res)
            .catch(err => res.writeHead(400))
            .then(() => res.writeHead(200))
            .finally(() => {
                res.end();
            });
    });

    // Close the socket on client error
    server.on('clientError', (err, socket) => {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    });

    // Start listening on a port
    server.listen(port);

    return server;
}

function createHealthCheck(port, getStatus) {

    port = port || DEFAULT_PORT;

    const get_status = Activity(`healthcheck:${port}:get-status`, getStatus);

    // REST endpoint
    const server = createServer(port, (req, res) => {
        return get_status
            .run()
            .then(status => util.isString(status)
                ? status
                : util.isNullOrUndefined(status)
                ? ''
                : JSON.stringify(status)
            )
            .then(body => res.write(body));
    });

    return server;
}

module.exports = (port, getStatus) => createHealthCheck(port, getStatus);