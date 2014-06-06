var samplesApp = angular.module('samplesApp', ['ui.tree','editableTitleModule']);


samplesApp.controller('samplesAppCtrl', function ($scope, $http) {

    $scope.samples = convertData(data.samples);

    $scope.addType = function () {
        $.post('/types', {name: 'New type'}, function (res) {
//           console.log(res);
            location.reload();
        });
    };

    $scope.removeItem = function (scope) {
        var nodeData = scope.$modelValue;
        $http.get('/samples/of_type/'+nodeData.id, {params: {subtypes: true, countOnly: true}}).then(function(r){
            if(r.data.count == 0){
                $http({url: '/types/'+nodeData.id, method: 'DELETE'}).then(function (r) {
                    var res = r.data;
                    console.log(res);
                });
                scope.remove();
            }
        });
    };

    $scope.selectSample = function(scope) {
        console.log(scope);
        $scope.selectedItem = scope.sample;
    }

    $scope.selectedItem = {id: data.id};

    $scope.dblClickTree = function(scope){
        console.log(scope);
    }

    $scope.clickTree = function(scope){
        //location.href='/types/'+scope.$modelValue.id
        $scope.selectedItem = scope.$modelValue // {id: scope.$modelValue.id, name: scope.$modelValue.title};
//            console.log($scope.selectedItem);
    }

    $scope.toggle = function(scope) {
        console.log(scope);
        scope.toggle();
    };

    $scope.newSubItem = function (scope) {
        var nodeData = scope.$modelValue;
        console.log(nodeData, scope.$parent.$modelValue);
        var name = nodeData.title + '.' + (nodeData.nodes.length + 1);
        var id = guid(); //nodeData.id * 10 + nodeData.nodes.length
        nodeData.nodes.push({
            id: id,
            title: name,
            nodes: []
        });
        $http({url: '/types', method: 'POST', data: $.param({name: name, parent: nodeData.id})}).then(function (r) {
            var res = r.data;
            if (res.success) {
                var node = _.findWhere(nodeData.nodes, {id: id});
                node.id = res.data.id;
            }
        });
    };

    $scope.$watch('selectedItem',function(nv,ov){
//        if(nv.id || nv.id == 0){
//            $http.get('/samples/of_type/'+nv.id,{params: {subtypes: true}}).then(function(r){
//                $scope.samples = r.data;
//            });
//        }
    });

    $scope.$watch('selectedItem.title',function(nv,ov){
        console.log(nv,ov);
        if(nv){
            var url = '/samples/'+$scope.selectedItem.id;
            console.log(nv,url);
            $http({url: url, method: 'PUT', data: $.param({name: nv})}).then(function(r){
                $scope.selectedItem.title = r.data.data.name;
            });
        }
    },true);

    $scope.showSubtypes = true;

    $scope.typeFilter = function(sample){
        return $scope.showSubtypes || sample.typ.id == $scope.selectedItem.id;
    }

//        $scope.$watch('treedata',function(nv,ov){
//           var diff = diffChange(nv[0],ov[0]);
//            _.map(diff.added,function(t){
//                $http({url: '/types', method: 'POST',data: $.param({name: t.name})}).then(function(r){
//
//                });
//            })
//        },true);

});




var guid = (function () {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }

    return function () {
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
            s4() + '-' + s4() + s4() + s4();
    };
})();

//Just changes name to title.
var convertData = function(es){
    return _.map(es,function(e){
        return {id: e.id, title: e.name, owner: e.owner, note: e.note, protocolSamples: e.protocolSamples, runSamples: e.runSamples, runs: e.runs};
    })
}


angular.module('typeFilters', []).filter('typeFilter', function() {
    return function(r){
        console.log(r);
        return r;
    }
});