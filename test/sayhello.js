#!/usr/bin/env node
'use strict';

// ** Dependencies
const Activity = require('../src/Activity');

let id = 0;

function sayHello(name) {
    const greeting = `Hello, ${name}!`;
    console.log(greeting);

    if (id++ % 10 === 0)
        throw Error('TEST_ERROR');

    return greeting;
}

const say_hello = Activity('say-hello', sayHello, {
    logArguments: true
})
    .on('error', (err, args) => console.error('ERROR:', {arguments: args}, err))
    .on('result', (result, args) => console.log('RESULT:', {arguments: args}, result));

// Run say_hello 100 times.
for (let lcv = 0; lcv < 100; lcv++) {
    say_hello.run('Brad Serbu');
}