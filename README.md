# Inceptor.js

## Ownership-driven dependency injection for JavaScript

Usually, dependency injection frameworks rely on central container
to retrieve dependencies.

In contrast, this ownership-driven approach spawn __scopes__ when
these dependencies are created.

## Features:

- Very small (5kb minified).
- Does not depend on any other library.
- Works everywhere! Both node.js and browser are supported.
- Re-uses familiar loading mechanisms such as `requirejs` or node's `require`.
- Does not need string names to map objects.
- Code is well-tested.
- Scopes can be tested in isolation without dependency map.
- No global variables or containers!

## How does it work?

This container turns the problem on its head: instead of creating a dependency when your code requests it, __Inceptor.js__ does the reverse.

It runs your code when all dependencies are created.

Let's look at simple example.

Suppose we have a simple __logger__ that logs our messages to multiple __backends__.

In traditional DI, we would inject the __backends__ into the __logger__ constructor.

Here, we do the reverse: we tell the __logger__ to require the __backend__.

Let's see the code for __logger__:

```js
var Logger = inceptor.scope({
    initialize: function() {
        this.backends = [];
    },

    log: function(message) {
        for (var i = 0; i < this.backends.length; i++) {
            this.backends[i].log(message);
        }
    }
});
```

Here, we achieved the abstraction: the __logger__ knows nothing about the __backends__, the only thing it requires is that they implement the `log()` method.

Let's see the code for __backend__:

```js
var Backend = inceptor.scope([Logger], {
    initialize: function(logger) {
        logger.backends.push(this);
    },

    log: function(message) {
        console.log(message);
    }
});
```

Here, the __backend__ receives the __logger__ over the first argument, and adds itself to the list.

Somewhere at the root of the project, we add both the `Logger` and the `Backend` to dependency map:

```js
var deps = inceptor.load(
    Logger,
    Backend,
);
```

And later create the logger using this map:

```js
var logger = deps.create(Logger);
logger.log('Hello!');
```

Receive the `Hello!` in console!

If we later need a different `Backend` implementation, or want to silence the logs, we don't need to touch the __logger__, just modify the backend.

So, we have achieved what is required from the dependency injection.

The big difference here is that lifetime of all objects spawned by logger depend directly on the lifetime of logger. If a new logger is created, the whole tree of dependent objects is created too.

## Usage in frameworks

Intrigued? See how it can be used in your environment:

- [Use Inceptor.js with RequireJs](/) [TODO]
- [Use Inceptor.js in Node.js](/) [TODO]
- [Browse the annotated source.](docs/inceptor.html)

## License

MIT
