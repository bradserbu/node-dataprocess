#!/usr/bin/env node
'use strict';

// ** Dependencies
const Q = require('q');
const Activity = require('../lib/Activity');

const say_hello = Activity('say-hello', name => Q.delay(1000).then(`Hello, ${name}!`), {
    logArguments: true
});

// Run an instance of the say hello activity and then log the stats;
const instance = say_hello('Brad Serbu');

console.log(instance);

Q
    .when(instance.completed)
    .then(instance => console.log(instance));

// console.log('INSTANCE', instance);