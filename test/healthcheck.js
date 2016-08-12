#!/usr/bin/env node
'use strict';

// ** Dependencies
const healthcheck = require('../src/healthcheck');

// ** Create a healthcheck server instance
healthcheck(8080, () => {
    return {
        message: `Hello World!`
    }
});