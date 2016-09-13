'use strict';

// ** Dependencies
const _ = require('underscore');
const util = require('util');
const Activity = require('./Activity');
const EventEmitter = require('events').EventEmitter;

class Activities extends EventEmitter {
    constructor() {
        super();

        this.activities = {}; // Keep track of all the activities created by the application
    }

    createActivity(name, action, options) {

        // activity(action) -> activity(action.name, action)
        if (arguments.length === 1 && arguments[0])
            return this.createActivity(arguments[0].name, arguments[0]);

        // activity(name, options) -> activity(name, options.action, options)
        if (arguments.length === 2 && util.isObject(arguments[1]))
            return this.createActivity(arguments[0], arguments[1].action, arguments[1]);

        // Argument Defaults
        options = options || {};

        if (this.activities.hasOwnProperty(name))
            throw Error(`An activity named ${name} has already been added.`, 'NAME_ALREADY_ADDDED');

        const activity = Activity(name, action, options);
        this.activities[name] = activity;

        // Emit an event that we have created an activity
        this.emit('create-activity', activity);

        return activity;
    }

    stats() {
        return _.mapObject(this.activities, activity => {
            return activity.stats();
        });
    }
}

function createActivitiesCollection() {
    return new Activities();
}

module.exports = createActivitiesCollection;