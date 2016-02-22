import {
    bindFunction,
    forEachObject,
    getClone,
    isArray,
    isFunction,
    isInstanceOf,
    isObject,
    isString,
    setHidden,
    setReadonly,
    throwError
} from './utils';

const OBJECT_ASSIGN = Object.assign;

/**
 * This is a basic counter in case a namespace is not provided when creating
 * a branch
 */
let namespaceIncrementer = 0;

/**
 * Assigns new result to store, fires listener with new SingulumStore, and returns
 * Promise with new result
 *
 * @param {Object} object
 * @param {string} key
 * @param {*} result
 * @returns {Promise}
 */
const updateStoreValue = (object, result, key) => {
    /**
     * Apply new result value to the store, scoped if the key is provided
     */
    if (key) {
        object.$$store[key] = result;
    } else {
        object.$$store = result;
    }

    /**
     * If there is a watcher, fire it
     */
    if (isFunction(object.$$watcher)) {
        object.$$watcher(object.store);
    }

    return result;
};

/**
 * Creates bound and wrapped function to store new value internally and invoke listener
 * If function is asyncronous, it waits for the promise to be resolved before firing
 *
 * @param {Object} thisArg
 * @param {Function} fn
 * @param {string} key
 * @return {Function}
 */
const createWrapperFunction = function(thisArg, fn, key) {
    return bindFunction(function(...args) {
        const result = fn(...args);

        /**
         * If the result is a Promise, wait for resolution and then return the data
         */
        if (isFunction(result.then)) {
            return result.then((resultValue) => {
                return updateStoreValue(this, resultValue, key);
            });
        }

        /**
         * Otherwise, wrap the return data in a native Promise and return it
         */
        return Promise.resolve(updateStoreValue(this, result, key));
    }, thisArg);
};

/**
 * Creates namespaced Singulum within the object, aka make a branch
 *
 * @param {Object} object
 * @param {string} namespace
 * @param {Object} actions
 * @param {Object} initialValues
 * @returns {Object}
 */
const createNewSingulumNamespace = (object, namespace, actions = {}, initialValues = {}) => {
    /**
     * if no namespace is provided, use the simple counter to create a unique entry
     */
    if (!namespace) {
        namespace = namespaceIncrementer;
        namespaceIncrementer++;
    }

    setReadonly(object, namespace, new Singulum(actions, initialValues));

    object.$$store[namespace] = object[namespace];

    return object[namespace];
};

/**
 * Creates new item in the store, and creates related action with wrapper
 *
 * @param {Object} branch
 * @param {Object} actions
 * @param {Object} initialValues
 */
const createNewSingulumLeaves = (branch, actions = {}, initialValues = {}) => {
    forEachObject(initialValues, (initialValue, storeKey) => {
        /**
         * Create separate clones for initialValues and store, so that references between
         * the two do not exist
         */
        branch.$$initialValues[storeKey] = getClone(initialValue, SingulumStore);
        branch.$$store[storeKey] = getClone(initialValue, SingulumStore);
    });

    forEachObject(actions, (action, actionKey) => {
        /**
         * if action is a function, then it applies to the entire state
         */
        if (isFunction(action)) {
            branch.$$actions[actionKey] = createWrapperFunction(branch, action);
        } else if (isObject(action)) {
            /**
             * if action is a map of functions, it applies to a specific key on the store
             */
            forEachObject(action, (actionFn, actionFnKey) => {
                branch.$$actions[actionFnKey] = createWrapperFunction(branch, actionFn, actionKey);
            });
        }
    });
};

/**
 * Gets clone of value from branch store based on key
 *
 * @param {Object} branch
 * @param {string} key
 * @returns {*}
 */
const getLeaf = (branch, key) => {
    return getClone(branch.$$store[key], SingulumStore);
};

/**
 * Actions class provided with [branchName].actions
 */
class SingulumActions {
    /**
     * Create shallow clone of internal actions, and freeze
     *
     * @param {Object} actions
     * @returns {Object}
     */
    constructor(actions = {}) {
        OBJECT_ASSIGN(this, actions);

        return this;
    }
}

/**
 * Store class provided with [branchName].store
 */
class SingulumStore {
    /**
     * Create shallow clone of store, including stores branched from it, and freeze
     *
     * @param {Object} store
     * @returns {Object}
     */
    constructor(store = {}) {
        forEachObject(store, (value, key) => {
            this[key] = isInstanceOf(value, Singulum) ? value.store : value;
        });

        return this;
    }
}

/**
 * Snapshot class provided with [branchName].snapshot();
 */
class SingulumSnapshot {
    /**
     * Create snapshot clone of store, optionally snapshotting deeply
     *
     * @param {SingulumStore} store
     * @param {Singulum} $$store
     * @param {boolean} snapshotBranches
     * @returns {Object}
     */
    constructor(store = {}, $$store = {}, snapshotBranches) {
        forEachObject(store, (value, key) => {
            const $$value = $$store[key];

            this[key] = isInstanceOf($$value, Singulum) && snapshotBranches ?
                new SingulumSnapshot($$value.store, $$value.$$store, snapshotBranches) :
                getClone($$value, SingulumStore);
        });

        return this;
    }
}

/**
 * Main class
 */
class Singulum {
    /**
     * Create singulum infrastructure, and populate leaves provided
     *
     * @param {Object} actions
     * @param {Object} initialValues
     * @returns {Singulum}
     */
    constructor(actions = {}, initialValues = {}) {
        setHidden(this, '$$actions', []);
        setHidden(this, '$$initialValues', {});
        setHidden(this, '$$watcher', null);
        setHidden(this, '$$snapshots', {});
        setHidden(this, '$$store', {});

        createNewSingulumLeaves(this, actions, initialValues);

        return this;
    }
}

/**
 * prototype of Singulum class
 *
 * @type {Object}
 */
Singulum.prototype = Object.create({
    /**
     * Get immutable version of actions
     *
     * @returns {SingulumActions}
     */
    get actions() {
        return new SingulumActions(this.$$actions);
    },

    /**
     * Get immutable version of store
     *
     * @returns {SingulumStore}
     */
    get store() {
        return new SingulumStore(this.$$store);
    },

    /**
     * Create namespaced Singulum child
     *
     * @param {Object} actions
     * @param {Object} initialValues
     * @param {string} namespace
     * @returns {Singulum}
     */
    branch(actions = {}, initialValues = {}, namespace) {
        /**
         * if a namespace is provided but it isn't a string value, make it one
         */
        if (namespace && !isString(namespace)) {
            namespace = namespace.toString();
        }

        return createNewSingulumNamespace(this, namespace, actions, initialValues);
    },

    /**
     * Based on key or array of keys, returns values in store associated
     * If leaves is an array, an array of values in the same order as keys passed
     * is returned
     *
     * @param {string|Array} leaves
     * @returns {*}
     */
    pluck(leaves) {
        /**
         * if nothing is passed, just return the store
         */
        if (!leaves) {
            return this.store;
        }

        /**
         * if its a single key, get the leaf
         */
        if (isString(leaves)) {
            return getLeaf(this, leaves);
        }

        /**
         * if its an array of keys, get all the leaves
         */
        if (isArray(leaves)) {
            return leaves.map((leaf) => {
                return getLeaf(this, leaf);
            });
        }
    },

    /**
     * Return singulum to its original state
     *
     * @param {boolean} resetBranches
     * @returns {Singulum}
     */
    reset(resetBranches = false) {
        forEachObject(this.$$store, (value, key) => {
            if (isInstanceOf(value, Singulum) && resetBranches) {
                /**
                 * if snapshot value is a Singulum and you want to reset child branches, then trigger
                 * .reset() on child branch
                 */
                value.reset();
            } else if (!isInstanceOf(value, SingulumSnapshot)) {
                /**
                 * If the snapshot value is a non-Singulum value, re-apply it to the store
                 */
                this.$$store[key] = this.$$initialValues[key];
            }
        });

        /**
         * If there is a watcher, fire it
         */
        if (isFunction(this.$$watcher)) {
            this.$$watcher(this.store);
        }

        return this;
    },

    /**
     * Restore values in store based on snapshot, optionally restored deeply
     *
     * @param {SingulumSnapshot} snapshot
     * @param {boolean} restoreBranches
     * @returns {Singulum}
     */
    restore(snapshot, restoreBranches = false) {
        /**
         * Make sure snapshot passed is a SingulumSnapshot
         */
        if (!isInstanceOf(snapshot, SingulumSnapshot)) {
            throwError('Snapshot used in restore method must be a SingulumSnapshot.');
        }

        forEachObject(snapshot, (value, key) => {
            if (isInstanceOf(value, SingulumSnapshot) && restoreBranches) {
                /**
                 * if the snapshot value is a SingulumSnapshot and you want to reset
                 * child branches, then trigger restore on the child branch passing value
                 * as branch's snapshot
                 */
                this.$$store[key].restore(value, restoreBranches);
            } else if (!isInstanceOf(value, SingulumStore)) {
                /**
                 * If the snapshot value is not a Singulum, re-apply it to the store
                 */
                this.$$store[key] = value;
            }
        });

        /**
         * If there is a watcher, fire it
         */
        if (isFunction(this.$$watcher)) {
            this.$$watcher(this.store);
        }

        return this;
    },

    /**
     * Create snapshot of current store state, optionally snapshot deeply
     *
     * @param {boolean} snapshotBranches
     * @returns {SingulumSnapshot}
     */
    snapshot(snapshotBranches = false) {
        return new SingulumSnapshot(this.store, this.$$store, snapshotBranches);
    },

    /**
     * Clear out callback bound to $$watcher
     *
     * @returns {Singulum}
     */
    unwatch() {
        this.$$watcher = null;

        return this;
    },

    /**
     * Add callback to $$watcher, to be fired whenever store updates
     *
     * @param {Function} callback
     * @returns {Singulum}
     */
    watch(callback) {
        /**
         * Make sure callback is actually a function before setting it
         */
        if (isFunction(callback)) {
            this.$$watcher = callback;
        }

        return this;
    }
});

export default Singulum;