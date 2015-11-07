(function() {
    var di = typeof require == 'function' ? require('..') : window.di;

    QUnit.module('Scope Lifetimes');

    test('new instances created for every new root scope', function(assert) {
        var childCreated = 0,
            A = di.scope(),
            B = di.scope(),
            C = di.scope([A, B], function() {
                childCreated += 1;
            }),
            c = di.load(C);

        c.create(A);
        c.create(B);

        // new instance
        c.create(A);

        // new instance
        c.create(B);

        assert.equal(childCreated, 3);
    });

    test('ready function called', function(assert) {
        var readyCalls = 0,
            A = di.scope({
                ready: function() {
                    readyCalls += 1;
                }
            }),
            c = di.load(A);

        c.create(A);

        assert.equal(readyCalls, 1);
    });

    test('ready function called after parent ready function is called', function(assert) {
        var readyCalls = [],
            impl = function(title) {
                return {
                    ready: function() {
                        readyCalls.push(title);
                    }
                };
            },
            R = di.scope(impl('R')),
            A = di.scope([R], impl('A')),
            c = di.load(A);

        c.create(R);

        assert.deepEqual(readyCalls, ['R', 'A']);
    });

    test('ready functions called in the same sequence as initialize calls', function(assert) {
        var initializeCalls = [],
            readyCalls = [],
            impl = function(title) {
                return {
                    initialize: function() {
                        initializeCalls.push(title);
                    },
                    ready: function() {
                        readyCalls.push(title);
                    }
                };
            },
            R = di.scope(impl('R')),
            P = di.scope(impl('P')),

            A = di.scope([R], impl('A')),
            B = di.scope([R, A], impl('B')),
            C = di.scope([A, P], impl('C')),

            c = di.load(A, B, C);

        c.create(R);
        c.create(P);

        assert.deepEqual(readyCalls, initializeCalls);
    });

}());
