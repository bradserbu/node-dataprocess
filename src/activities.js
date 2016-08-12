`use strict`;

// ** Dependencies
const Activity = require('../lib/Activity');

class Activities extends EventEmitter {
    constructor(name, options) {
        super();

        // Hashmap of activities by name
        this.activities = {};
    }

    add(activity) {
        if (this.activities.hasOwnProperty(activity.name))
            throw Error(`An activity already exists with this name.  name=${activity.name}`);

        this.activities[activity.name] = activity;
        this.emit('add', activity);
    }

    create(name, action, options) {
        const activity = Activity(name, action, options);

        this.add(activity);
        this.emit('create', activity);
    }

    stats() {

    }
}

/**
 * Create a collection of activities.
 */
function createCollection(name, options) {
    const activities = new Activities(name, options);

    return activities;
}

// ** Exports
module.exports = (name, options) => createCollection(name, options);
module.exports.Activities = Activities;