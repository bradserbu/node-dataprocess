#!/usr/bin/env node
'use strict';

// ** Dependencies
const util = require('util');
const DataProcess = require('..').DataProcess;

const USERS = ['brad', 'kyle', 'juan', 'josh'];
const AGES = {
    brad: 34,
    kyle: 35,
    juan: '23',
    josh: 'not that old'
};

function User(username) {
    return {
        username: username
    }
}

/**
 * Returns a random integer between min (included) and max (excluded)
 * Using Math.round() will give you a non-uniform distribution!
 * @param min
 * @param max
 * @returns {*}
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * Check if a user is in his thirties.
 * @param user
 * @returns {boolean}
 */
function isThirty(user) {
    const isThirty = user.age > 30 && user.age < 40;

    if (isThirty)
        console.log(`***** ${user.username} - IS THIRTY *****`);
    else
        console.log(`***** ${user.username} - IS NOT THIRTY *****`);

    return isThirty;
}

// ** Main program
DataProcess('greet-users')
    .map('user', User)
    .delay(() => randomInt(100, 5000))
    .setProperty('age', user => AGES[user.username])
    .setProperty('age', 'age-to-number', user => Number(user.age))
    .filter('age-is-integer', user => Number.isInteger(user.age))
    .reject('thirty-year-olds', user => isThirty(user))
    .setProperty('greeting', user => `Hello, ${user.username}!`)
    .map('select-greeting', user => user.greeting)
    .stringify()
    .exec('say-hello', greeting => console.log(greeting))
    .run(USERS, {
        pipeline: true,
        concurrency: 4
    })
    .complete();
    // .complete()
    // .done(process => console.log(process.stats()));



// .catch(err => console.error(err))
// .done(process => console.log('PROCESS_COMPLETED', process.stats()));