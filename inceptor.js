(function(global) {
    'use strict';

    var
        // Minimal chunk of underscore.
        _ = {},
        // Custom utils.
        utils = {}
    ;

    // Scopes
    // ------

    // Will generate unique ids for every scope.
    var nextId = 1;

    // Creates new scope.
    global.scope = function() {

        // A scope object which is automatically created when
        // the parent is created.
        var Scope = function() {
            // Scope construction always calls "initialize".
            this.initialize.apply(this, arguments);
        };

        // Use the next id for scope.
        Scope.typeId = nextId;
        nextId += 1;

        // If there are 2 arguments, scope has dependencies.
        var hasDependencies = _.isArray(arguments[0]);
        var dependencies = [];
        var obj;

        // If scope has dependencies, they come from first argument.
        // The last one is scope implementation object.
        if (hasDependencies) {
            obj = arguments[1];
            dependencies = arguments[0];
        } else {
            obj = arguments[0];
        }

        // Scope dependencies are "above" Scope types;
        // They are a "list of things" that need to be created
        // as arguments for actual "new Scope" invocation.
        Scope.dependencies = dependencies;

        // If supplied thing is a function, modify it to become
        // the "initialize" method.
        var implementation = _.isFunction(obj) ? {
            initialize: function() {
                obj.apply(this, arguments);
            }
        } : obj;

        // By default, initialize and ready will do nothing.
        // If an initialize or ready is defined on implementation, they
        // will become part of scope's prototype.
        _.extend(
            Scope.prototype,
            {
                // Initialize will be called as soon as scope is
                // created.
                initialize: function() { },
                // Ready will be called when all scope's children are
                // created.
                ready: function() { }
            },
            implementation
        );

        return Scope;
    };

    // Dependency map
    // --------------

    // Tracks all scopes that are dependent on one another.
    // A scope will not be automatically loaded unless it is
    // added to this dependency map, and this same map is used
    // on parent scope creation.
    function Deps() {
        // Tracks all loaded scopes, so that they are not loaded twice.
        this.loadedList = {};

        // Flag to make sure nothing is loaded after the container objects are created.
        this.loaded = false;

        // Constructors contain a list of functions for each scope type
        // that are invoked when a scope is initialized.
        this.constructors = {};

        // List of new created instances that were not processed for dependencies.
        this.instanceQueue = [];

        // List of inceptions that were started but not finished.
        this.unfinishedInceptions = {};

        // Breaks recursion when creating new instance while creating new instance.
        this.creatingDependencies = false;

        // Load arguments as Scopes.
        this.load(arguments);
    }

    // Expose Deps.
    global.Deps = Deps;

    // Expose a helper to create Deps.
    global.load = function() {
        return utils.construct(Deps, arguments);
    };

    // Loads a scope list and all child scopes into this dependency map.
    Deps.prototype.load = function(list) {
        if (typeof list.typeId !== 'undefined') {
            acceptLoaderList(this, arguments);
        } else {
            acceptLoaderList(this, list);
        }
    };

    // Create new instance of scope together with all loaded Deps.
    Deps.prototype.create = function(Scope, args) {
        var instance = utils.construct(Scope, args);

        this.loaded = true;

        this.instanceQueue.push(instance);
        createDependencies(this);
        return instance;
    };

    // Given a loader list, load all of it and dependent loaders.
    function acceptLoaderList(deps, loadList) {
        var i, j, loader, nextLoadList = [];

        function pushOtherScope(OtherScope) {
            nextLoadList.push(OtherScope);
        }

        // While there is something in load list call `accept` on them.
        //
        // This ensures the loadScope can only be called from loader that was added into loader list.
        while (loadList.length > 0) {
            for (i = 0; i < loadList.length; i++) {
                // take loader item
                loader = loadList[i];

                // if the loader is array, iterate over it and add new loaders from it.
                if (_.isArray(loader)) {
                    for (j = 0; j < loader.length; j++) {
                        nextLoadList.push(loader[j]);
                    }
                    continue;
                }

                loadScope(deps, loader, pushOtherScope);
            }
            loadList = nextLoadList;
            nextLoadList = [];
        }
    }

    // Load scope with all its dependencies into Deps.
    function loadScope(deps, Scope, alsoLoad) {
        var i, inception, ParentScope;

        if (typeof Scope === 'undefined') {
            throw new Error('Trying to load undefined value as Scope.');
        }

        if (!Scope.hasOwnProperty('typeId')) {
            throw new Error('Failed to load Scope - received object with no typeId.');
        }

        if (deps.loaded) {
            throw new Error('Should not load more scopes after any of the loaded scopes were created.');
        }

        // Make sure to not load scope twice
        if (deps.loadedList.hasOwnProperty(Scope.typeId)) {
            return;
        }

        deps.loadedList[Scope.typeId] = true;

        if (Scope.dependencies.length === 0) {

            // no dependencies

        } else if (Scope.dependencies.length === 1) {

            // If scope has single dependency, no inceptor is needed -
            // simply load child as soon as parent loads.

            ParentScope = Scope.dependencies[0];

            // Add constructor that creates child scope with a parent
            // instance as an argument.
            getOrCreateConstructorList(deps, ParentScope)[Scope.typeId]
                = function(instance) {
                    deps.instanceQueue.push(new Scope(instance));
                };

            // Schedule the `load` call on parent scope.
            alsoLoad(ParentScope);

        } else {

            // If scope has multiple dependencies, use inceptor to ensure that it is
            // created when all parents are created.

            inception = new Inceptor(Scope, function(args) {
                deps.instanceQueue.push(utils.construct(Scope, args));
            });

            // When first argument is created we receive `onStart` and can
            // know that inceptor is not finished.
            inception.onStart(function(typeId, inceptor) {
                deps.unfinishedInceptions[typeId] = inceptor;
            });

            // When inceptor is finished we can remove it from unfinished inceptor list.
            inception.onFinish(function(typeId) {
                delete deps.unfinishedInceptions[typeId];
            });

            // Add hooks to notify inceptor about created parent argument instances.
            for (i = 0; i < Scope.dependencies.length; i++) {
                ParentScope = Scope.dependencies[i];

                getOrCreateConstructorList(deps, ParentScope)[Scope.typeId]
                    = inception.createAndPushArgHook(i);

                alsoLoad(ParentScope);
            }
        }
    }

    // Constructor list is a list of functions that should be called
    // when the scope object is created.
    //
    // There is a separate list for each loaded type stored in the
    // `constructors` variable.
    //
    // This function creates it for the specified scope or gets existing.
    function getOrCreateConstructorList(deps, Scope) {
        if (deps.constructors.hasOwnProperty(Scope.typeId)) {
            return deps.constructors[Scope.typeId];
        }

        var constructorList = {};
        deps.constructors[Scope.typeId] = constructorList;

        return constructorList;
    }

    // Consume instance queue and create dependencies for each instance in it.
    function createDependencies(deps) {
        var readyQueue = [],
            i, j,
            instances,
            instance,
            Scope,
            typeId,
            list;

        if (deps.creatingDependencies) {
            return;
        }

        deps.creatingDependencies = true;

        while (deps.instanceQueue.length > 0 || _.size(deps.unfinishedInceptions) > 0) {

            while (deps.instanceQueue.length > 0) {
                instances = deps.instanceQueue;
                deps.instanceQueue = [];

                for (i = 0; i < instances.length; i++) {
                    instance = instances[i];
                    Scope = instance.constructor;
                    typeId = Scope.typeId;

                    readyQueue.push(instance);

                    if (deps.constructors.hasOwnProperty(typeId)) {
                        list = _.keys(deps.constructors[typeId]);
                        for (j = 0; j < list.length; j++) {
                            deps.constructors[typeId][list[j]](instance);
                        }
                    }
                }
            }

            while (_.size(deps.unfinishedInceptions) > 0) {
                list = _.keys(deps.unfinishedInceptions);
                for (i = 0; i < list.length; i++) {
                    deps.unfinishedInceptions[list[i]].finish();
                }
            }
        }

        deps.creatingDependencies = false;

        for (i = 0; i < readyQueue.length; i++) {
            readyQueue[i].ready();
        }
    }

    // Internal Inceptor
    // -----------------

    // Runs a callback when all specified callback hooks are invoked.
    //
    // Used to create an instance when all parent instances are created.
    function Inceptor(Scope, newInstanceCallback) {
        this.Scope = Scope;
        // Target instance identifier.
        this.typeId = Scope.typeId;
        // New instance creation hook, runs when all parents are created.
        this.newInstanceCallback = newInstanceCallback;
        // List of last processed instances used as arguments for new instance.
        this.instances = [];
        // List of new instances for next creation step.
        this.newInstances = [];
        // When all values in this array are true, all instances are available.
        this.created = [];
        // Creation step has started.
        this.started = false;
        // Notify when first instance in creation step is created.
        this.onStartCallback = null;
        // Notify when the inceptor has finished creation step.
        this.onFinishCallback = null;
    }

    // Register new instance creation hook. The number of registered hooks should match
    // the number of arguments that are expected in `newInstanceCallback`.
    //
    // Each hook will notify about creation of parent instance which will be used as argument
    // for specified `index` position.
    Inceptor.prototype.createAndPushArgHook = function(index) {
        this.instances.push(null);
        this.newInstances.push(null);
        this.created.push(false);

        // New instance was created for parent argument `index`.
        return function(instance) {
            this.created[index] = true;
            this.newInstances[index] = instance;

            if (!this.started) {
                if (this.onStartCallback !== null) {
                    this.onStartCallback(this.typeId, this);
                }
                this.started = true;
            }
        }.bind(this);
    };

    // Finish is invoked when some external resolver has resolved all possible parent arguments
    // and there is nothing else to do.
    //
    // In that case the inceptor will use all collected arguments as inputs for new instance,
    // and when new instance creation is possible invoke `newInstanceCallback`.
    Inceptor.prototype.finish = function() {
        var allCreated = true,
            i;

        for (i = 0; i < this.created.length; i++) {
            if (!this.created[i]) {
                allCreated = false;
                break;
            }
        }

        if (allCreated) {
            for (i = 0; i < this.instances.length; i++) {
                if (this.newInstances[i] !== null) {
                    this.instances[i] = this.newInstances[i];
                }
            }

            this.newInstanceCallback(this.instances);
            for (i = 0; i < this.newInstances.length; i++) {
                this.newInstances[i] = null;
            }
        }

        if (this.onFinishCallback !== null) {
            this.onFinishCallback(this.typeId);
        }

        this.started = false;
    };

    // Get notified when first parent argument is created. This means the inceptor is waiting
    // for full list of arguments.
    //
    // When you know that there are no other arguments possible, call `finish`. The inceptor
    // will use all collected arguments ar parameters for new instance.
    Inceptor.prototype.onStart = function(callback) {
        this.onStartCallback = callback;
    };

    // Inceptor is finished and you can forget it.
    Inceptor.prototype.onFinish = function(callback) {
        this.onFinishCallback = callback;
    };

    // Underscore
    // ----------
    //
    // Small this library uses very basic helpers from underscore.js.

    var
        nativeIsArray = Array.isArray,
        nativeKeys = Object.keys;

    // Save bytes in the minified (but not gzipped) version:
    var ObjProto = Object.prototype;

    // Create quick reference variables for speed access to core prototypes.
    var
        toString = ObjProto.toString,
        hasOwnProperty = ObjProto.hasOwnProperty;

    var property = function(key) {
        return function(obj) {
            return obj == null ? void 0 : obj[key];
        };
    };

    // Helper for collection methods to determine whether a collection
    // should be iterated as an array or as an object.
    // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
    // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
    var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
    var getLength = property('length');
    var isArrayLike = function(collection) {
        var length = getLength(collection);
        return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
    };

    // Add some isType methods: isFunction.
    _.isFunction = function(obj) {
        return toString.call(obj) === '[object Function]';
    };

    // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
    // IE 11 (#1621), Safari 8 (#1929), and PhantomJS (#2236).
    var nodelist = typeof document !== 'undefined' && document.childNodes;
    if (typeof /./ != 'function' && typeof Int8Array != 'object' && typeof nodelist != 'function') {
        _.isFunction = function(obj) {
            return typeof obj == 'function' || false;
        };
    }

    // Is a given value an array?
    // Delegates to ECMA5's native Array.isArray
    _.isArray = nativeIsArray || function(obj) {
        return toString.call(obj) === '[object Array]';
    };

    // Is a given variable an object?
    _.isObject = function(obj) {
        var type = typeof obj;
        return type === 'function' || type === 'object' && !!obj;
    };

    // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
    var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
    var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
        'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

    var collectNonEnumProps = function(obj, keys) {
        var nonEnumIdx = nonEnumerableProps.length;
        var constructor = obj.constructor;
        var proto = _.isFunction(constructor) && constructor.prototype || ObjProto;

        // Constructor is a special case.
        var prop = 'constructor';
        if (_.has(obj, prop) && !_.contains(keys, prop)) {
            keys.push(prop);
        }

        while (nonEnumIdx--) {
            prop = nonEnumerableProps[nonEnumIdx];
            if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
                keys.push(prop);
            }
        }
    };

    // Shortcut function for checking if an object has a given property directly
    // on itself (in other words, not on a prototype).
    _.has = function(obj, key) {
        return obj != null && hasOwnProperty.call(obj, key);
    };

    // Retrieve the names of an object's own properties.
    // Delegates to **ECMAScript 5**'s native `Object.keys`
    _.keys = function(obj) {
        if (!_.isObject(obj)) {
            return [];
        }
        if (nativeKeys) {
            return nativeKeys(obj);
        }
        var keys = [];
        for (var key in obj) {
            if (_.has(obj, key)) {
                keys.push(key);
            }
        }
        // Ahem, IE < 9.
        if (hasEnumBug) {
            collectNonEnumProps(obj, keys);
        }
        return keys;
    };

    // Retrieve all the property names of an object.
    _.allKeys = function(obj) {
        if (!_.isObject(obj)) {
            return [];
        }
        var keys = [];
        for (var key in obj) {
            keys.push(key);
        }
        // Ahem, IE < 9.
        if (hasEnumBug) {
            collectNonEnumProps(obj, keys);
        }
        return keys;
    };

    // Return the number of elements in an object.
    _.size = function(obj) {
        if (obj == null) {
            return 0;
        }
        return isArrayLike(obj) ? obj.length : _.keys(obj).length;
    };

    // An internal function for creating assigner functions.
    var createAssigner = function(keysFunc, defaults) {
        return function(obj) {
            var length = arguments.length;
            if (defaults) {
                obj = Object(obj);
            }
            if (length < 2 || obj == null) {
                return obj;
            }
            for (var index = 1; index < length; index++) {
                var source = arguments[index],
                    keys = keysFunc(source),
                    l = keys.length;
                for (var i = 0; i < l; i++) {
                    var key = keys[i];
                    if (!defaults || obj[key] === void 0) {
                        obj[key] = source[key];
                    }
                }
            }
            return obj;
        };
    };

    // Extend a given object with all the properties in passed-in object(s).
    _.extend = createAssigner(_.allKeys);

    // Low Level Helpers
    // -----------------

    // Invokes constructor with array of arguments.
    utils.construct = function(constructor, args) {
        function F() {
            return constructor.apply(this, args);
        }
        F.prototype = constructor.prototype;
        return new F();
    };

    // Define bind if not defined.
    if (typeof Function.prototype.bind !== 'function') {
        Function.prototype.bind = function bind(obj) {
            var args = Array.prototype.slice.call(arguments, 1),
                self = this,
                nop = function() {
                },
                bound = function() {
                    return self.apply(
                        this instanceof nop ? this : (obj || {}), args.concat(
                            Array.prototype.slice.call(arguments)
                        )
                    );
                };
            nop.prototype = this.prototype || {};
            bound.prototype = new nop();
            return bound;
        };
    }

}(
    typeof window === 'object'
        ? window.di = {}
        : this
));
