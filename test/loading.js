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

}());
