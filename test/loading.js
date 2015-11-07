(function() {
    var di = typeof require == 'function' ? require('..') : window.di;

    QUnit.module('Scope Loading');

    test('load from arrays', function(assert) {
        var a,
            A = di.scope(),
            B = di.scope([A], function(p) { p.b = true; }),
            C = di.scope([A], function(p) { p.c = true; }),

            deps = di.load([B, C]);

        a = deps.create(A);

        assert.ok(a.b);
        assert.ok(a.c);
    });

    test('load from arrays in arrays', function(assert) {
        var a,
            A = di.scope(),
            B = di.scope([A], function(p) { p.b = true; }),
            C = di.scope([A], function(p) { p.c = true; }),

            deps = di.load([B, [C]]);

        a = deps.create(A);

        assert.ok(a.b);
        assert.ok(a.c);
    });

    test('create new scope from initialize', function(assert) {
        var a, b, d,
            result = null,
            deps,
            A = di.scope(function() { this.value = 'a'; }),
            B = di.scope(function() { this.value = 'b'; }),
            D = di.scope(function() { this.value = 'd'; }),
            C = di.scope([A, B], function(parentA, parentB) {
                result = parentA.value + parentB.value;
                d = deps.create(D);
            });

        deps = di.load(A, B, C, D);

        a = deps.create(A);
        b = deps.create(B);

        assert.equal(a.value, 'a');
        assert.equal(b.value, 'b');
        assert.equal(result, 'ab');
        assert.equal(d.value, 'd');
    });

    test('create new scope from ready', function(assert) {
        var a, b, d,
            cReadyCalled = false,
            dReadyCalled = false,
            deps,
            A = di.scope(function() { this.value = 'a'; }),
            B = di.scope(function() { this.value = 'b'; }),
            D = di.scope({
                initialize: function() { this.value = 'd'; },
                ready: function() { dReadyCalled = true; }
            }),
            C = di.scope([A, B], {
                ready: function() {
                    cReadyCalled = true;
                    d = deps.create(D);
                }
            });

        deps = di.load(A, B, C, D);

        a = deps.create(A);
        b = deps.create(B);

        assert.equal(a.value, 'a');
        assert.equal(b.value, 'b');
        assert.ok(cReadyCalled);
        assert.equal(d.value, 'd');
        assert.ok(dReadyCalled);
    });

    test('throws when loading undefined', function(assert) {
        assert.raises(
            function() {
                /*eslint no-undefined: 0*/
                di.load(undefined);
            },
            'Error: Trying to load undefined value as Scope.',
            'expected that loading with undefined scope raises error'
        );
    });

    test('throws when loading non-scope', function(assert) {
        assert.raises(
            function() {
                di.load(function() {});
            },
            'Error: Failed to load Scope - received object with no typeId.',
            'expected that loading non-scope raises error'
        );
    });

    test('throws when loading trying to load dependencies into already used dependency map', function(assert) {
        assert.raises(
            function() {
                var A = di.scope(),
                    B = di.scope(),
                    deps = di.load(A);

                deps.create(A);
                deps.load(B);
            },
            'Error: Should not load more scopes after any of the loaded scopes were created.',
            'expected that used dependency map becomes immutable'
        );
    });

}());
