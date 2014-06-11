expsApp.factory('SampleData',['$resource',function($resource){
    //Just add title.
    var readData = function (str) {
        var es = JSON.parse(str);
        return _.map(es, function (e) {
            e.title = e.name;
            return e;
        });
    };

    return $resource('/samples.json',{}, {
        getAll: {method: 'GET', params: {}, isArray: true, transformResponse: readData},
        getOne: {method: 'GET', 'url': '/samples/:id.json'}
    });
}]);

expsApp.factory('SampleDataSvc',['$http', 'listViewSvc', function($http, listViewSvc){
    return {
        hello: function(){
            console.log('hello');
        },
        change: function(nv,ov) {
            if(ov.id && nv.id == ov.id && !_.isEqual(nv,ov)){
                //This means not selection, but content is changed.

                console.log('item content changed.',nv,ov);
                $http({url: '/samples/'+nv.id, method: 'PUT',data: $.param({name: nv.name})}).success(function(r){
                    if(r.success){
                        var e = _.findWhere(listViewSvc.samples,{id: r.data.id});
                        e.name = r.data.name;
                        e.title = r.data.name;
                    }
                    console.log(r.data);
                });
            }else{
                console.log('item selection changed.',nv);
            }
        }
    };
}]);


expsApp.controller('SampleListCtrl', ['$scope', '$state', '$stateParams', 'listViewSvc', function ($scope, $state, $stateParams, listViewSvc) {
    $scope.samples = listViewSvc.samples;
    $scope.selectedItem = listViewSvc.selectedItem;

    listViewSvc.current.mode = 'sample';
    listViewSvc.current.id = $stateParams.id;
    if(!$stateParams.id){
        listViewSvc.pageTitle.value = 'List of samples - Labnotebook';
    }

    $scope.isSelectedSample = function (id) {
        return id == $stateParams.id
    };
    $scope.selectItem = function (item) {
        listViewSvc.selectedItem.sample = item;
        $state.go('sample_id',{id: item.id});
    };
}]);

expsApp.controller('SampleDetailCtrl', ['$scope', '$http', '$state', '$stateParams', 'listViewSvc', 'SampleData', 'SampleDataSvc', function ($scope, $http, $state, $stateParams, listViewSvc, SampleData, SampleDataSvc) {
    $scope.selectedItem = listViewSvc.selectedItem;
    $scope.item = SampleData.getOne({id: $stateParams.id}, function(){
        $scope.loaded = true;
        var id = $scope.item.id;
        $http({url: '/samples/'+id+'/exps', method: 'GET'}).success(function(r){
            console.log(r);
            $scope.exps = r.data;
        });
        listViewSvc.pageTitle.value = $scope.item.name + ' - Labnotebook';
    });
    $scope.showList = listViewSvc.showList;
    $scope.showDetailJson = listViewSvc.showDetailJson;


    $scope.$watch('item', function (nv, ov) {
        SampleDataSvc.change(nv, ov);
    }, true);

    $scope.isActive = function () {
        return $scope.selectedItem.id || $scope.selectedItem.id == 0;
    }

    $scope.deleteSample = function() {
        var id = $scope.item.id;
        if(id){
            $http({url: '/samples/'+id, method: 'DELETE'}).success(function(r){
                console.log(r);
                if(r.success){
                    var id = r.data.id;
                    var idx = findIndex(listViewSvc.samples, id);
                    console.log(idx, listViewSvc.samples, id);
                    if(idx >= 0){
                        listViewSvc.samples.splice(idx, 1);
                        var samples = listViewSvc.samples[idx];
                        var id = samples ? samples.id : null;
                        $state.go('sample_id',{id: id});
                    }
                }else{
                    $scope.showMessage('Cannot delete sample.');
                }
            });
        }
    };

}]);