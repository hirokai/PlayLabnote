describe("A suite", function() {

    beforeEach(module('expsApp'));

    it('should have a LoginCtrl controller', function() {
        expect(App.SampleDetailCtrl).toBeDefined();
    });


    it("contains spec with an expectation", function() {
        expect(true).toBe(true);
    });
});