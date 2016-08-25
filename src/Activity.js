'use strict';

// ** Dependencies
const Q = require('bluebird-q');
const _ = require('underscore');
const util = require('util');
const debug = require('debug');
const now = require('microtime').now;
const measured = require('measured');
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
    const completed_on = now();

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
        this.options = options;

        this.action = action;

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
        const self = this;
        // Instance Properties
        const id = self.nextId();
        const started_on = now();
        const logger = debug(`${self.name} [${id}]`);

        const args = _.toArray(arguments);

        // Optionally log arguments
        if (self.options.logArguments)
            logger('RUN', args);
        else
            logger('RUN');

        /**
         * The activity failed
         */
        const FAIL = (err) => {
            // ** Increment the error count
            self._stats.errors.mark();

            // ** Track response time
            const elapsed_ms = elapsed(started_on)[0];
            logger('FAILED', {elapsed_ms: elapsed_ms}, err);

            // Rethrow this error to propigate it
            self.emit('error', err, args);
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

                        self._stats.responses.update(elapsed_ms);

                        self.emit('result', result, args);
                        return result;
                    });
            }
            else {
                const elapsed_ms = elapsed(started_on)[0];
                logger('COMPLETED', {id: id, elapsed_ms: elapsed_ms});

                self._stats.responses.update(elapsed_ms);
                self.emit('response', result, args);

                return Q.resolve(result);
            }
        };

        // Execute the action
        try {
            self._stats.requests.mark();

            if (util.isNullOrUndefined(this.action)) {
                return FAIL(Error(this.name + ': The action is "undefined" or "null."', 'INVALID_ACTION'));
            }

            if (!util.isFunction(this.action.apply)) {
                return FAIL(Error(this.name + ': The action is not a function.', 'INVALID_ACTION'));
            }

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
    if (arguments.length === 2 && util.isObject(arguments[1]))
        return createActivity(arguments[0], arguments[1].action, arguments[1]);

    // Argument Defaults
    options = options || {};

    // Return a new activity object representing the action
    return new Activity(name, action, options);
}

// ** Exports
module.exports = createActivity;
module.exports.Activity = Activity;