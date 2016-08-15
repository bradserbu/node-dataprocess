#!/usr/bin/env node
'use strict';

// ** Dependencies
const Q = require('q');
const activities = require('../src/activities');

function sayHello(name) {
    const greeting = `Hello, ${name}!`;
    console.log(greeting);

    return greeting;
}

const say_hello = activities('say-hello', sayHello, {
    logArguments: true
})
    .on('error', (err, args) => console.error('ERROR:', {arguments: args}, err))
    .on('result', (result, args) => console.log('RESULT:', {arguments: args}, result));

// Run say_hello 100 times.
for (let lcv = 0; lcv < 100; lcv++) {
    say_hello.run('Brad Serbu');
}