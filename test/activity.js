#!/usr/bin/env node
'use strict';

// ** Dependencies
const Activity = require('..').Activity;

const say_hello = Activity('say-hello', name => console.log(`Hello, ${name}!`));

// Run an instance of the say hello activity and then log the stats;
say_hello
    .run('Brad Serbu')
    .then(() => console.log('STATS', say_hello.stats()));