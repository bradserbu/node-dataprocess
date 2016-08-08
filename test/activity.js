#!/usr/bin/env node
'use strict';

// ** Dependencies
const activity = require('..').Activity;

/**
 * Say hello to a user
 */
const helloworld = activity('helloworld', name => console.log(`Hello, ${name}!`));

// ** Exports
helloworld('Brad Serbu');