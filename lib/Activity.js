'use strict';

// ** Dependencies
const _ = require('underscore');
const debug = require('debug');
const microtime = require('microtime');
const throat = require('throat');
const measured = require('measured');
const Promise = require('q');

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
 * Creates an activity object that encapsulates an action (function)
 * @param name
 * @param action
 */
function createActivity(name, options, action) {

    // activity(action) -> activity(action.name, null, action)
    if (arguments.length === 1 && arguments[0])
        return createActivity(arguments[0].name, null, arguments[0]);

    // activity(name, action) -> activity(name, null, action)
    if (arguments.length === 2)
        return createActivity(arguments[0], null, arguments[1]);

    // Create an Instance ID for each execution of this activity
    let id = 0;
    const next_id = () => id++;

    // Track Activity Statistics
    const errors = meter();
    const response_time = histogram();

    // Function to execute the the underlying action one time
    let EXEC = function () {

        // Instance Properties
        const id = next_id();
        const started_on = microtime.now();
        const logger = debug(`${name} [${id}]`);

        const args = _.toArray(arguments);
        logger('RUN', args);

        /**
         * The activity failed
         */
        const FAIL = (err) => {
            // ** Increment the error count
            errors.mark();

            // ** Track response time
            const elapsed_ms = elapsed(started_on)[0];
            logger('FAILED', {elapsed_ms: elapsed_ms}, err);

            // Rethrow this error to propigate it
            throw err;
        };

        /**
         * The activity completed successfully
         */
        const COMPLETE = (result) => {
            if (isPromise(result)) {
                // Return a promise that encapsulates this result and returns trace execution context
                return result
                    .catch(err => FAIL(err))
                    .then(result => {
                        const elapsed_ms = elapsed(started_on)[0];
                        logger('COMPLETED', {elapsed_ms: elapsed_ms});

                        response_time.update(elapsed_ms);
                        return result;
                    });
            }
            else {
                const elapsed_ms = elapsed(started_on)[0];
                logger('COMPLETED', {id: id, elapsed_ms: elapsed_ms});

                response_time.update(elapsed_ms);
                return Promise.resolve(result);
            }
        };

        // Execute the action
        try {
            return COMPLETE(action.apply(this, args));
        } catch (err) {
            FAIL(err);
        }
    };

    const activity = function runActivity() {
        return EXEC.apply(this, arguments);
    };

    // Activity Methods
    activity.stats = () => {
        return {
            errors: errors.toJSON(),
            response_time: response_time.toJSON()
        };
    };

    // Activity Transformations
    activity.parallel = concurrency => {
        EXEC = throat(EXEC, concurrency);
        return activity;
    };

    return activity;
}

// ** Exports
module.exports = createActivity;