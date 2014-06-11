expsApp.factory('TypeDataSvc',['$http', 'listViewSvc', function($http, listViewSvc){
    return {
        hello: function(){
            console.log('hello');
        },
        change: function(nv,ov) {
            console.log('type may have changed.')
            if(ov && nv & ov.id && nv.id == ov.id && !_.isEqual(nv,ov)){
                //This means not selection, but content is changed.

                console.log('item content changed.',nv,ov);
                $http({url: '/types/'+nv.id, method: 'PUT',data: $.param({name: nv.name})}).success(function(r){
                    if(r.success){
                        var ts = flattenTree(listViewSvc.types)
                        var t = findInTree(ts[0][0],r.data.id);
                        t.title = r.data.name;
                    }
                    console.log(r.data);
                }).error(function(r){
                        console.log('TypeDataSvc.change() error',r);
                    });
            }else{
                console.log('item selection changed.',nv);
            }
        }
    };
}]);


expsApp.controller('TypeListCtrl', ['$scope', '$state', '$stateParams', 'listViewSvc', function ($scope, $state, $stateParams, listViewSvc) {
    $scope.treedata = listViewSvc.types;
    $scope.selectedItem = listViewSvc.selectedItem;

    listViewSvc.current.mode = 'type';
    listViewSvc.current.id = $stateParams.id;
    if(!$stateParams.id){
        listViewSvc.pageTitle.value = 'List of types - Labnotebook';
    }


    $scope.isSelectedType = function (id) {
        return id == $stateParams.id
    };
    $scope.selectItem = function (item) {
        listViewSvc.selectedItem.type = item;
        console.log(item);
        $state.go('type_id',{id: item.id});
    };
}]);


expsApp.controller('TypeDetailCtrl', ['$scope', '$http', '$stateParams', 'listViewSvc', 'TypeDataSvc',
    function ($scope, $http, $stateParams, listViewSvc, TypeDataSvc) {
    var init = function () {
        $scope.showSubtypes = false;

        $scope.showDetailJson = listViewSvc.showDetailJson;

        $scope.selectedItem = listViewSvc.selectedItem;
        var id = $stateParams.id;
        if(!id)return;
        $http({url: '/types/'+id+'.json', method: 'GET'}).success(function(r){
            $scope.item = r;
            listViewSvc.pageTitle.value = $scope.item.name + ' - Labnotebook';
            $scope.loaded = true;
        });

        $scope.$watch('item', function (nv, ov) {
            TypeDataSvc.change(nv, ov);
        }, true);

        $scope.showList = listViewSvc.showList;
        $scope.types = listViewSvc.types;

        $scope.id = $stateParams.id;
        if($scope.id){
            $http.get('/samples/of_type/'+$scope.id, {params: {subtypes: true}}).then(function(r){
                $scope.samples = r.data;
                console.log(r);
            });
        }else{
            $scope.samples = [];
        }
    }

    init();

    //Selected type changed. (NOT type content change)
    $scope.$watch('selectedItem.type', function () {
        //Stub: Load samples of type
    });

    $scope.isActive = function () {
        return $scope.selectedItem.id || $scope.selectedItem.id == 0;
    };

    $scope.addSample = function () {
        var typ = $scope.id;
        console.log(typ, $scope);
        if (typ || typ == 0) {
            var name = $scope.selectedItem.type.title || 'New sample';

            $http.post('/samples', $.param({name: name, type: typ})).success(function (r) {
                console.log(r);
                $scope.samples.push(r.data);
                console.log(r.data, $scope.samples);
            });
        } else {
            console.log('not selected');
        }
    };

    $scope.deleteSample = function (sample) {
        $http({url: '/samples/' + sample.id, method: 'DELETE'}).then(function (r) {
            var res = r.data;
            if (res.success) {
                var idx = findIndex($scope.samples, sample.id);
                if (idx >= 0) {
                    $scope.samples.splice(idx, 1);
                }
            }
        });
    }

}]);


var mkTreeData = function (d) {
    return {id: d.node.id, title: d.node.name, nodes: _.map(d.children, function (n) {
        return mkTreeData(n);
    })};
};

flattenTree = function (t) {
    return [
        {id: t.id, title: t.title}
    ].concat(_.flatten(_.map(t.nodes, flattenTree)));
}

var diffChange = function (newval, oldval) {
    var vs1 = flattenTree(newval);
    var vs2 = flattenTree(oldval);
    var vs1_2 = _.filter(vs1, function (obj) {
        return !_.findWhere(vs2, obj);
    });
    var vs2_1 = _.filter(vs2, function (obj) {
        return !_.findWhere(vs1, obj);
    });
    return {added: vs1_2, removed: vs2_1};
};

var findInTree = function(tree,id){
//    console.log(tree,id);
    if(tree.id == id){
        return tree;
    }else{
        try{
            var res = null;
            _.map(tree.nodes,function(tree){
                res = findInTree(tree,id);
                if(res) throw "Found.";
            });
        }catch(e){
            return res;
        }
        return null;
    }
}