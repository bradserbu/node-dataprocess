'use strict';

const DEFAULT_CONCURRENCY = 200;

// ** Dependencies
const $ = require('highland');
const Q = require('q');
const _ = require('underscore');
const util = require('util');
const EventEmitter = require('events').EventEmitter;
const Activity = require('./Activity');

/**
 * Return a promise that will complete when the stream is finished.
 * - Does not return results of the stream.
 * @param stream
 * @returns {*}
 */
function complete(value) {

    // Return a promise that completes when the stream completes or produces an error.
    if ($.isStream(value)) {
        return Q.Promise((resolve, reject) =>
            value
                .stopOnError(err => reject(err))
                .done(() => resolve()));
    }

    // Return a promise or wrap a value in a promise
    return Q.when(value);
}

function pipeline(args) {
    return $.pipeline.apply(null, args);
}

function isStream(obj) {
    return obj && util.isFunction(obj.pipe);
}

/**
 * Function to check if an object is a promise or not
 * @type {boolean}
 */
function isPromise(obj) {
    return typeof obj.then == 'function' && typeof obj.catch == 'function';
}

/**
 * Data Process Object
 */
class DataProcess extends EventEmitter {
    constructor(name) {
        super(); // Construct the EventEmitter

        // Properties
        this.name = name;
        this.activities = [];
    }

    addActivity(activity) {
        this.activities.push(activity);
        return this;
    }

    run(source, options) {

        options = options || {};

        // Cap the number of instances for all activities
        // Example: concurrency=1 says only 1 instance of an activity at a time.
        const maxConcurrency = options.concurrency || DEFAULT_CONCURRENCY;

        // Create a stream that represents the results
        let results = $.flatten(source);

        // Apply each activity to the results stream
        for (let lcv = 0; lcv < this.activities.length; lcv++) {
            const activity = this.activities[lcv];
            // Apply the activity to each record
            const type = activity.type;
            const action = activity.action;
            const options = activity.options || {};

            // options:concurrency - Use activity setting or maxConcurrency, whichever is greater
            const concurrency = options.concurrency
                ? options.concurrency
                : maxConcurrency;

            switch (type.toLowerCase()) {
                case 'map':
                    // Run the activity for each record
                    results = results
                        .map(record => $(action(record)));

                    // Merge the results of the promises together
                    results = (concurrency > 0)
                        ? results.mergeWithLimit(concurrency)
                        : results.merge();
                    break;
                case 'filter':
                    // Run the activity for each of the records
                    results = results
                        .map(record =>
                            $(action(record)
                                .then(result => [record, result]))
                        );

                    // Merge the results of the promises together
                    results = (concurrency > 0)
                        ? results.mergeWithLimit(concurrency)
                        : results.merge();

                    // Apply the filter and select the record
                    results = results
                        .filter(t => t[1])
                        .map(t => t[0]);
                    break;
                case 'flatten':
                    results = $.flatten(results);
                    break;
                case 'completed':
                    results = complete(results)
                        .then(() => this); // Return the process as the results of complete
                    break;
                case 'compact':
                    results = results.compact();
                    break;
                case 'errors':
                    results = results
                        .errors(err => action(err));
                    break;
                default:
                    throw Error(`The activity type '${type}' is not supported.`, 'NOT_SUPPORTED');
                    break;
            }
        }

        // Return the results stream
        return results;
    }

    tap(name, action, options) {
        // map(action) -> map(action.name, action)
        if (arguments[0].length === 1)
            return this.tap(arguments[0].name || '', arguments[0]);

        const activity = Activity(name, action, options);
        return this.addActivity({
            name: name,
            type: 'map',
            action: record =>
                activity.run(record)
                    .then(() => record),
            stats: () => activity.stats(),
            options: options || {}
        });
    }

    map(name, action, options) {

        // map(action) -> map(action.name, action)
        if (arguments[0].length === 1)
            return this.map(arguments[0].name, arguments[0]);

        const activity = Activity(name, action, options);

        // Create an activity that backs this data process
        return this.addActivity({
            name: name,
            type: 'map',
            action: record => activity.run(record),
            stats: () => activity.stats(),
            options: options || {}
        });
    }

    setProperty(property, name, action, options) {

        if (arguments.length === 2 && util.isString(arguments[1]))
            return this.setProperty(arguments[0], arguments[1], _.identity);

        // mapProp(property, action) -> mapProp(property, action.name, action)
        if (arguments.length === 2 && util.isFunction(arguments[1]))
            return this.setProperty(arguments[0], arguments[1].name || arguments[0], arguments[1]);

        name = name || `set:${property}`;

        const activity = Activity(name, action, options);
        return this.addActivity({
            name: name,
            type: 'map',
            action: record =>
                activity.run(record)
                    .then(result => {
                        record[property] = result;
                        return record;
                    }),
            stats: () => activity.stats(),
            options: options || {}
        });
    }

    filter(name, action, options) {
        const activity = Activity(name, action);
        return this.addActivity({
            name: name,
            type: 'filter',
            action: record => activity.run(record),
            stats: () => activity.stats(),
            options: options || {}
        });
    }

    reject(name, action, options) {
        const activity = Activity(name, action);
        return this.addActivity({
            name: name,
            type: 'filter',
            action: record =>
                activity.run(record)
                    .then(result => !result),
            stats: () => activity.stats(),
            options: options || {}
        });
    }

    delay(ms, options) {

        const name = 'delay';
        const activity = Activity(name, Q.delay);

        return this.addActivity({
            name: name,
            type: 'map',
            action: record =>
                activity.run(util.isFunction(ms) ? ms() : ms)
                    .then(() => record),
            stats: () => activity.stats(),
            options: options || {}
        });
    }

    stringify(options) {
        const name = 'stringify';
        const activity = Activity(name, record => JSON.stringify(record, options));
        return this.addActivity({
            name: name,
            type: 'map',
            action: record => activity.run(record),
            stats: () => activity.stats()
        });
    }

    exec(name, action, options) {
        const activity = Activity(name, action, options);
        return this.addActivity({
            name: name,
            type: 'map',
            action: record => activity.run(record)
                .then(result => {
                    return {
                        result: result
                    };
                })
                .catch(err => {
                    return {
                        error: err
                    }
                }),
            stats: () => activity.stats(),
        })
    }

    flatten(options) {
        return this.addActivity({
            name: 'flatten',
            type: 'flatten',
            options: options
        });
    }

    compact(options) {
        return this.addActivity({
            name: 'compact',
            type: 'compact',
            options: options
        });
    }

    complete(options) {
        return this.addActivity({
            name: 'completed',
            type: 'completed',
            options: options
        });
    }

    errors(name, action) {
        const activity = Activity(name, action);

        return this.addActivity({
            name: name,
            type: 'errors',
            action: record => activity.run(record),
            stats: activity.stats(),
        });
    }

    stats() {
        const process_stats = {};

        for (let lcv = 0; lcv < this.activities.length; lcv++) {
            const activity = this.activities[lcv];

            if (util.isFunction(activity.stats))
                process_stats[activity.name] = activity.stats();
        }

        return process_stats;
    }
}

/**
 * Create a new data process
 * @param name
 * @param options
 */
function createDataProcess(name, options) {
    // createDataProcess(options) -> createDataProcess(options.name, options)
    if (arguments.length === 1 && util.isObject(arguments[0]))
        return createDataProcess(arguments[0].name, arguments[0]);

    return new DataProcess(name, options);
}

// ** Exports
module.exports = createDataProcess;
module.exports.complete = complete;