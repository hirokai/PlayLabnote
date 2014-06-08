expsApp.service('listViewSvc', ['$http', function ($http) {
    return {
        hello: function () {
            console.log('Hello', this.selectedItem);
        },
        selectedItem: {
            exp: {},
            sample: {},
            type: {}
        },
        selectedListTab: {
            name: ''
        },
        tab: {
            value: null
        },
        newSubItem: function (scope) {
            console.log(scope);
            var nodeData = scope.$modelValue;
            var name = nodeData.title + '.' + (nodeData.nodes.length + 1);
            var id = guid(); //nodeData.id * 10 + nodeData.nodes.length
            nodeData.nodes.push({
                id: id,
                title: name,
                nodes: []
            });
            $http({url: '/types', method: 'POST', data: $.param({name: name, parent: nodeData.id})}).then(function (r) {
                var res = r.data;
                console.log(res);
                if (res.success) {
                    var node = _.findWhere(nodeData.nodes, {id: id});
                    node.id = res.data.id;
                }
            });
        },
        deleteTypeItem: function (scope) {
            var nodeData = scope.$modelValue;
            $http.get('/samples/of_type/' + nodeData.id, {params: {subtypes: true, countOnly: true}}).then(function (r) {
                if (r.data.count == 0) {
                    $http({url: '/types/' + nodeData.id, method: 'DELETE'}).then(function (r) {
                        var res = r.data;
                        console.log(res);
                    });
                    scope.remove();
                } else {
                    showMessage('Not empty type.')
                }
            });
        },
        convertSampleData: function (ss) {
            return _.map(ss, function (s) {
                s.title = s.name;
                delete s['name']
                return s;
            });
        },
        showList: {
            value: true
        }
    }
}]);

expsApp.controller('protocolGraphCtrl', ['$scope', function ($scope) {
    console.log($scope);
    $scope.$watch('exp', function (nv, ov) {
        $scope.nodes = [
            {x: Math.random() * 100, y: 100}
        ];
    }, true);
    $scope.x = function (scope) {
        console.log(scope);
        return Math.random() * 100;
    }
    $scope.y = function (scope) {
        return Math.random() * 100;
    }
}]);

//This controller is loaded in the beginning, no matter which tab is open. (Background loading).
expsApp.controller('entireCtrl',
    ['$scope', '$http',
        'listViewSvc',
        'ExpData', 'SampleData', 'TypeData',
        'ExpDataSvc', 'SampleDataSvc', 'TypeDataSvc',
    function ($scope, $http,
              listViewSvc,
              ExpData, SampleData, TypeData,
              ExpDataSvc, SampleDataSvc, TypeDataSvc) {
        var init = function () {
            //Common data store
            listViewSvc.exps = ExpData.getAll();
            listViewSvc.samples = SampleData.getAll();
            listViewSvc.types = TypeData.getAll();

            $scope.mode = 'exp';

            $scope.selectedListTab = listViewSvc.selectedListTab;
            $scope.selectedItem = listViewSvc.selectedItem;
            $scope.showList = listViewSvc.showList;
        };

        init();

        //Selection change or content change
        $scope.$watch('selectedItem.exp', function (nv, ov) {
            ExpDataSvc.change(nv, ov);
        }, true);
        $scope.$watch('selectedItem.sample', function (nv, ov) {
            SampleDataSvc.change(nv, ov);
        }, true);
        $scope.$watch('selectedItem.type', function (nv, ov) {
            TypeDataSvc.change(nv, ov);
        }, true);

        // Helper functions for switching views.
        //

        $scope.isEmptyDetail = function () {
            return ($scope.selectedListTab.name == 'Exps' && $scope.selectedItem.exp.id == null) ||
                ($scope.selectedListTab.name == 'Samples' && $scope.selectedItem.sample.id == null) ||
                ($scope.selectedListTab.name == 'Types' && $scope.selectedItem.type.id == null);
        }
        $scope.isExpTab = function () {
            return $scope.selectedListTab.name == 'Exps';
        }
        $scope.isExpDetail = function () {
            return  $scope.selectedListTab.name == 'Exps' && $scope.selectedItem.exp.id != null;
        }
        $scope.isSampleTab = function () {
            return  $scope.selectedListTab.name == 'Samples';
        }
        $scope.isSampleDetail = function () {
            return  $scope.selectedListTab.name == 'Samples' && $scope.selectedItem.sample.id != null;
        }
        $scope.isTypeTab = function () {
            return  $scope.selectedListTab.name == 'Types';
        }
        $scope.isTypeDetail = function () {
            return  $scope.selectedListTab.name == 'Types' && $scope.selectedItem.type.id != null;
        }

    }]);

expsApp.controller('ExpDetailCtrl', ['$scope', '$http', 'listViewSvc', 'ExpData', 'ExpDataSvc', function ($scope, $http, listViewSvc, ExpData, ExpDataSvc) {
    //   $scope.exps = convertData(data);
    //     console.log(data[0],$scope.exps[0]);

    $scope.selectedItem = listViewSvc.selectedItem;
    $scope.item = listViewSvc.selectedItem.exp;
    $scope.showList = listViewSvc.showList;

    console.log($scope.item);

    $scope.showSection = {note: true, sample: true, protocol: true};

    $scope.deleteExp = function (scope) {
        var id = $scope.item.id;
        $http({url: '/exps/' + id, method: 'DELETE'}).then(function (r) {
            var res = r.data;
            console.log(res);
            if (res.success) {
                console.log($scope.exps);
                var idx = findIndex($scope.exps, res.id);
                $scope.exps.splice(idx, 1);
                console.log(idx, $scope.exps);
                $scope.selectedItem = $scope.exps[idx - 1];
            }
        });
    };

    $scope.isActive = function () {
        return $scope.selectedItem.id || $scope.selectedItem.id == 0;
    }

}]);

expsApp.controller('SampleDetailCtrl', ['$scope', '$http', 'listViewSvc', 'SampleData', function ($scope, $http, listViewSvc, SampleData) {
    $scope.selectedItem = listViewSvc.selectedItem;
    $scope.item = listViewSvc.selectedItem.sample;
    $scope.showList = listViewSvc.showList;


    $scope.isActive = function () {
        return $scope.selectedItem.id || $scope.selectedItem.id == 0;
    };

}]);

expsApp.controller('TypeDetailCtrl', ['$scope', '$http', 'listViewSvc', 'TypeData', function ($scope, $http, listViewSvc, TypeData) {
    var init = function () {
        $scope.showSubtypes = false;

        $scope.selectedItem = listViewSvc.selectedItem;
        $scope.item = listViewSvc.selectedItem.type;
        $scope.showList = listViewSvc.showList;
        $scope.types = TypeData.getAll();
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
        var typ = $scope.selectedItem.type.id;
        console.log($scope);
        if (typ || typ == 0) {
            $http.post('/samples', $.param({name: $scope.selectedItem.title, type: typ})).success(function (r) {
                $scope.detail.samples.push(r.data);
                console.log(r.data, $scope.detail.samples);
            });
        } else {
            console.log('not selected');
        }
    };

    $scope.deleteSample = function (sample) {
        $http({url: '/samples/' + sample.id, method: 'DELETE'}).then(function (r) {
            var res = r.data;
            if (res.success) {
                var idx = findIndex($scope.detail.samples, sample.id);
                if (idx >= 0) {
                    $scope.detail.samples.splice(idx, 1);
                }
            }
        });
    }

}]);

expsApp.controller('ExpListCtrl', ['$scope', '$state', '$stateParams', 'listViewSvc', function ($scope, $state, $stateParams, listViewSvc) {
    $scope.selectedItem = listViewSvc.selectedItem;
    $scope.sp = $stateParams
    $scope.exps = listViewSvc.exps;
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

expsApp.controller('SampleListCtrl', ['$scope', '$state', '$stateParams', 'listViewSvc', function ($scope, $state, $stateParams, listViewSvc) {
    $scope.samples = listViewSvc.samples;
    $scope.selectedItem = listViewSvc.selectedItem;
    $scope.isSelectedSample = function (id) {
        return id == $stateParams.id
    };
    $scope.selectItem = function (item) {
        listViewSvc.selectedItem.sample = item;
        $state.go('sample_id',{id: item.id});
    };
}]);

expsApp.controller('TypeListCtrl', ['$scope', '$state', '$stateParams', 'listViewSvc', function ($scope, $state, $stateParams, listViewSvc) {
    $scope.treedata = listViewSvc.types;
    $scope.selectedItem = listViewSvc.selectedItem;
    $scope.isSelectedType = function (id) {
        return id == $stateParams.id
    };
    $scope.selectItem = function (item) {
        listViewSvc.selectedItem.type = item;
        console.log(item);
        $state.go('type_id',{id: item.id});
    };
}]);

expsApp.controller('itemListCtrl', ['$scope', '$http', 'listViewSvc', 'ExpData', function ($scope, $http, listViewSvc, ExpData) {
    $scope.selectItem = function (item) {
        var k = {"Samples": 'sample', "Exps": 'exp', "Types": 'type'}[$scope.selectedListTab.name];
        listViewSvc.selectedItem[k] = item;
    };

    $scope.tabs = [
        {value: 'exp', title: 'Exps'},
        {value: 'sample', title: 'Samples'},
        {value: 'type', title: 'Types'}
    ];

    $scope.showList = listViewSvc.showList;

    var k = {"Samples": 'sample', "Exps": 'exp', "Types": 'type'}[$scope.selectedListTab.name];
    $scope.selectedItem = listViewSvc.selectedItem;

    $scope.addExp = function () {
        $.ajax('/exps', {method: 'POST', data: $.param({name: 'New exp'}), success: function (r) {
            console.log(r);
            if (r) {
                $scope.$apply(function () {
                    $scope.exps.push({id: r.id, title: r.name});
                });
                console.log($scope.exps);
            }
        }});
    };
    $scope.newSubItem = listViewSvc.newSubItem;
    $scope.deleteTypeItem = listViewSvc.deleteTypeItem;

}]);

function findIndex(vs, id) {
    var len = vs.length;
    for (var i = 0; i < len; i++) {
        if (vs[i].id == id)
            return i;
    }
    return -1;
}

function showMessage(msg) {
    console.log(msg);
}
