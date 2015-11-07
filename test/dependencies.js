(function() {
    var di = typeof require == 'function' ? require('..') : window.di;

    QUnit.module('Scope Dependencies');

    test('parent scope should create child if it was plugged', function(assert) {
        var childCreated = false,
            P = di.scope(),
            C = di.scope([P], {
                initialize: function() {
                    childCreated = true;
                }
            }),
            deps = di.load(C);

        deps.create(P);

        assert.ok(childCreated);
    });

    test('parent scope should not create child if it was not plugged in deps', function(assert) {
        var childCreated = false,
            P = di.scope(),
            deps;

        di.scope([P], {
            initialize: function() {
                childCreated = true;
            }
        });

        deps = di.load();
        deps.create(P);

        assert.ok(!childCreated);
    });

    test('not create child when only one of parents is created', function(assert) {
        var childCreated = false,
            P1 = di.scope(),
            P2 = di.scope(),
            A = di.scope([P1, P2], {
                initialize: function() {
                    childCreated = true;
                }
            }),
            c = di.load(A);

        c.create(P1);

        assert.ok(!childCreated);
    });

    test('create child when both parents are created', function(assert) {
        var childCreated = false,
            P1 = di.scope(),
            P2 = di.scope(),
            A = di.scope([P1, P2], {
                initialize: function() {
                    childCreated = true;
                }
            }),
            c = di.load(A);

        c.create(P1);
        c.create(P2);

        assert.ok(childCreated);
    });

    test('diamond dependency created once', function(assert) {
        var childCreated = 0,
            P = di.scope(),
            A1 = di.scope([P]),
            A2 = di.scope([P]),
            Diamond = di.scope([A1, A2], function() {
                childCreated += 1;
            }),
            c = di.load(Diamond);

        c.create(P);

        assert.equal(childCreated, 1);
    });

    test('indirect diamond dependency created once', function(assert) {
        var childCreated = 0,
            P = di.scope(),
            A = di.scope([P]),
            B1 = di.scope([P]),
            B2 = di.scope([B1]),
            Diamond = di.scope([A, B2], function() {
                childCreated += 1;
            }),
            c = di.load(Diamond);

        c.create(P);

        assert.equal(childCreated, 1);
    });

    test('indirect diamond dependency created twice', function(assert) {
        var childCreated = 0,
            P = di.scope(),
            A = di.scope([P]),
            B1 = di.scope([P]),
            B2 = di.scope([B1]),
            Diamond = di.scope([A, B2], function() {
                childCreated += 1;
            }),
            c = di.load(Diamond);

        c.create(P);
        c.create(P);

        assert.equal(childCreated, 2);
    });

    test('pass parent instances as arguments to child', function(assert) {
        var A = di.scope(function() { this.value = 'a'; }),
            B = di.scope(function() { this.value = 'b'; }),
            result = null,
            C = di.scope([A, B], function(a, b) {
                result = a.value + b.value;
            }),
            c = di.load(C);

        c.create(A);
        c.create(B);

        assert.ok(result, 'ab');
    });

}());
