'use strict';

// ** Dependencies
const _ = require('underscore');
const util = require('util');
const debug = require('debug');
const microtime = require('microtime');
const now = require('microtime').now;
const throat = require('throat');
const measured = require('measured');
const Promise = require('q');
const EventEmitter = require('events').EventEmitter;

/**
 * Function to check if an object is a promise or not
 * @type {boolean}
 */
function isPromise(obj) {
    return obj && typeof obj.then == 'function' && typeof obj.catch == 'function';
}

function meter() {
    const m = new measured.Meter();
    m.unref();
    return m;
}

function histogram() {
    return new measured.Histogram();
}

/**
 * Track the elapsed time from a given start time
 * @param started_on
 * @returns {*[]}
 */
function elapsed(started_on) {
    const completed_on = microtime.now();

    // Return a fat-value
    const elapsed_ms = (completed_on - started_on) * 0.001;

    return [elapsed_ms, started_on, completed_on];
}

/**
 * Default generator for the next id
 * @returns {function(): number}
 */
function default_next_id() {
    let id = 0;
    return () => id++;
}

class Activity extends EventEmitter {
    constructor(name, action, options) {
        super();

        this.name = name;
        this.action = action;
        this.options = options ;

        // Generator for instance ids
        this.nextId = options.nextId || default_next_id();

        // Track statistics
        this._stats = {
            errors: meter(),
            requests: meter(),
            responses: histogram()
        };
    }

    run() {
        // Instance Properties
        const id = this.nextId();
        const started_on = now();
        const logger = debug(`${this.name} [${id}]`);

        const args = _.toArray(arguments);
        logger('RUN', args);

        /**
         * The activity failed
         */
        const FAIL = (err) => {
            // ** Increment the error count
            this._stats.errors.mark();

            // ** Track response time
            const elapsed_ms = elapsed(started_on)[0];
            logger('FAILED', {elapsed_ms: elapsed_ms}, err);

            // Rethrow this error to propigate it
            throw err;
        };

        /**
         * The activity completed successfully
         */
        const COMPLETE = result => {
            if (isPromise(result)) {
                // Return a promise that encapsulates this result and returns trace execution context
                return result
                    .catch(err => FAIL(err))
                    .then(result => {
                        const elapsed_ms = elapsed(started_on)[0];
                        logger('COMPLETED', {elapsed_ms: elapsed_ms});

                        this._stats.response_time.update(elapsed_ms);
                        return result;
                    });
            }
            else {
                const elapsed_ms = elapsed(started_on)[0];
                logger('COMPLETED', {id: id, elapsed_ms: elapsed_ms});

                this._stats.responses.update(elapsed_ms);
                return Promise.resolve(result);
            }
        };

        // Execute the action
        try {
            this._stats.requests.mark();
            return COMPLETE(this.action.apply(this, args));
        } catch (err) {
            FAIL(err);
        }
    }

    stats() {
        return _.mapObject(this._stats, value => value.toJSON());
    }
}

/**
 * Creates an activity object that encapsulates an action (function)
 * @param name
 * @param action
 */
function createActivity(name, action, options) {

    // activity(action) -> activity(action.name, action)
    if (arguments.length === 1 && arguments[0])
        return createActivity(arguments[0].name, arguments[0]);

    // activity(name, options) -> activity(name, options.action, options)
    // if (arguments.length === 2 && !util.isObject(arguments[1]))
    //     return createActivity(arguments[0], arguments[1].action, arguments[1]);

    // Argument Defaults
    options = options || {};

    // Return a new activity object representing the action
    return new Activity(name, action, options);
}

// ** Exports
module.exports = createActivity;
module.exports.Activity = Activity;