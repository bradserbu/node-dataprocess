'use strict';

// ** Dependencies
const Q = require('q');
const debug = require('debug');
const now = require('microtime').now;

function toArray(obj) {
    return Array.prototype.slice.call(arguments);
}

function elapsed(started_on) {
    const completed_on = now();

    return (completed_on - started_on) / 1000;
}

class Activity {
    constructor(name, action, options) {
        this.name = name;
        this.action = action;
        this.options = options;
        this.logger = debug(`${name}`);

        let id = 0;
        this.nextId = () => id++;
    }

    run(args) {

        const id = this.nextId();
        const started_on = now();

        if (!!this.options.logArguments)
            this.logger(`RUN [${id}]`, args);
        else
            this.logger(`RUN [${id}]`);

        // Create an entry that represents this instance
        const instance = {
            id: id,
            args: args,
            started_on: started_on
        };

        // Execute the action
        instance.completed = Q.Promise((resolve, reject) => {
            try {
                const result = this.action.apply(null, args);

                if ()

                instance.result = result;
                instance.elapsed_ms = elapsed(started_on);
                this.logger(`COMPLETED [${id}]`, {elapsed_ms: instance.elapsed_ms});
            } catch (err) {

                instance.elapsed_ms = elapsed(started_on);
                instance.error = err;
                this.logger(`FAILED [${id}]`, {elapsed_ms: instance.elapsed_ms, error: err});
            } finally {
                resolve(instance);
            }
        });

        return instance;
    }

    stats() {

    }
}

module.exports = (name, action, options) => {
    const activity = new Activity(name, action, options);

    return function() {
        const instance = activity.run(arguments);

        return instance;
    }
};