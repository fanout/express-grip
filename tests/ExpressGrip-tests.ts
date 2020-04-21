import assert from "assert";

import ExpressGrip from "../src/ExpressGrip";

describe('ExpssrGrip', function() {
    describe('#constructr', function() {
        it('test case', function() {
            const expressGrip = new ExpressGrip({
                gripProxies: [{
                    control_uri: "http://localhost:5561/",
                }],
            });
            assert.deepEqual(expressGrip.gripProxies, [{
                control_uri: "http://localhost:5561/",
            }]);
            assert.equal(typeof expressGrip.preGrip, 'function');
            assert.equal(typeof expressGrip.postGrip, 'function');
        });
    });
});