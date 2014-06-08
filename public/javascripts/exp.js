expsApp.factory('ExpData',['$resource',function($resource){
    //Just add title.
    var readData = function (str) {
        var es = JSON.parse(str);
        return _.map(es, function (e) {
            e.title = e.name;
            return e;
        });
    };

    return $resource('/exps.json',{}, {
        getAll: {method: 'GET', params: {}, isArray: true, transformResponse: readData},
        getOne: {method: 'GET', isArray: false, 'url': '/exps/:id.json'}
    });
}]);

expsApp.factory('ExpDataSvc',['$http', 'listViewSvc', function($http, listViewSvc){
    return {
        hello: function(){
            console.log('hello');
        },
        change: function(nv,ov) {
            if(ov.id && nv.id == ov.id && !_.isEqual(nv,ov)){
                //This means not selection, but content is changed.
                console.log('item content changed.',nv,ov);
                $http({url: '/exps/'+nv.id, method: 'PUT',data: $.param({name: nv.name})}).success(function(r){
                    console.log(r);
                    if(r.success){
                        var e = _.findWhere(listViewSvc.exps,{id: r.data.id});
                        e.name = r.data.name;
                        e.title = r.data.name;
                    }
                }).error(function(r){
                        console.log("Error!",r);
                    });
            }else{
                console.log('item selection changed.',nv);
            }
        }
    };
}]);

expsApp.controller('ExpListCtrl', ['$scope', '$state', '$stateParams', 'listViewSvc', 'ExpData', function ($scope, $state, $stateParams, listViewSvc, ExpData) {
    $scope.exps = listViewSvc.exps;
    $scope.selectedItem = listViewSvc.selectedItem;

    listViewSvc.current.mode = 'exp';
    listViewSvc.current.id = $stateParams.id;

    $scope.sp = $stateParams; // For debug purpose.
//    if($stateParams.id){
//        $scope.selectedItem.exp.id = $stateParams.id;
//    }

    $scope.isSelectedExp = function (id) {
        return id == $stateParams.id
    };
    $scope.selectItem = function (item) {
        listViewSvc.selectedItem.exp = item;
        console.log($stateParams);
        $state.go('exp_id',{id: item.id});
    };

}]);


expsApp.controller('ExpDetailCtrl', ['$scope', '$http', '$state', '$stateParams', 'listViewSvc', 'ExpData', 'ExpDataSvc', function ($scope, $http, $state, $stateParams, listViewSvc, ExpData, ExpDataSvc) {
    //   $scope.exps = convertData(data);
    //     console.log(data[0],$scope.exps[0]);

    //These two are decoupled...
    $scope.selectedItem = listViewSvc.selectedItem;
    $scope.item = ExpData.getOne({id: $stateParams.id}, function(){
        $scope.loaded = true;
    });

    $scope.showList = listViewSvc.showList;
    $scope.showDetailJson = listViewSvc.showDetailJson;

    $scope.$watch('item', function (nv, ov) {
        ExpDataSvc.change(nv, ov);
    }, true);

    $scope.showSection = {note: true, sample: true, protocol: true};

    $scope.deleteExp = function (scope) {
        var id = $scope.item.id;
        $http({url: '/exps/' + id, method: 'DELETE'}).then(function (r) {
            var res = r.data;
            console.log(res);
            if (res.success) {
                console.log($scope.exps);
                var idx = findIndex(listViewSvc.exps, res.id);
                listViewSvc.exps.splice(idx, 1);
                console.log(idx, listViewSvc.exps);
                $state.go('exps');
            }
        });
    };

    $scope.isActive = function () {
        return $scope.selectedItem.id || $scope.selectedItem.id == 0;
    }

}]);
