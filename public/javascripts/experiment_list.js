var expsApp = angular.module('expsApp', ['editableTitleModule','expSamplesModule','myGraph','ui.tree','ui.bootstrap','ngRoute']);

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

expsApp.service('listViewSvc',function($http){
    return {
        hello: function(){
            console.log('Hello');
        },
        selectedItem: {
            exp:
                {id: null,
                 title: ''
            },
            type:
            {id: null,
                title: ''
            },
            sample:
            {id: null,
                title: ''
            }
        },
        selectedListTab: {
            name: ''
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
            $http.get('/samples/of_type/'+nodeData.id, {params: {subtypes: true, countOnly: true}}).then(function(r){
                if(r.data.count == 0){
                    $http({url: '/types/'+nodeData.id, method: 'DELETE'}).then(function (r) {
                        var res = r.data;
                        console.log(res);
                    });
                    scope.remove();
                }else{
                      showMessage('Not empty type.')
                }
            });
        },
        convertSampleData: function(ss){
            return _.map(ss,function(s){
                s.title = s.name;
                delete s['name']
                return s;
            });
        }
    }});

expsApp.controller('protocolGraphCtrl',['$scope',function($scope){
        //   $scope.nodes = [{},{},{}]; //$scope.exp;
        console.log($scope);
        $scope.$watch('exp',function(nv,ov){
//            console.log(nv);
            $scope.nodes = [{x: Math.random()*100, y: 100}];
//            console.log($scope.nodes);
        },true);
        $scope.x = function(scope){
            console.log(scope);
            return Math.random()*100;
        }
        $scope.y = function(scope){
            //console.log(scope);
            return Math.random()*100;
        }
    }]);

expsApp.controller('itemListAndDetailCtrl',['$scope','$http','listViewSvc',function($scope,$http,listViewSvc){
    $scope.isSampleTab = function(){
        return  $scope.selectedListTab.name == 'Samples';
    }
    $scope.isExpTab = function(){
        return  $scope.selectedListTab.name == 'Exps';
    }
    $scope.isTypeTab = function(){
        return  $scope.selectedListTab.name == 'Types';
    }
//    $scope.selectedItem = listViewSvc.selectedItem;
    $scope.selectedListTab = listViewSvc.selectedListTab;
}]);

expsApp.controller('typeDetailCtrl', function ($scope, $http,listViewSvc) {
    $scope.$watch('selectedItem',function(nv,ov){
        if(!$scope.selectedItem) return;        //Name changed.
        if(nv && ov && nv.id == ov.id && nv.title != ov.title){
            var id = $scope.selectedItem.id;
            var params = {name: nv.title};
            $.ajax('/types/'+$scope.selectedItem.id,{method: 'PUT',data: $.param(params)});
        }else if(nv && ov && nv.id != ov.id){
            //REeceive info.
            var id = $scope.selectedItem.id;
            $http({url: '/types/'+id+'.json',method: 'GET', params: {full: true}}).success(function(r){
                $scope.detail = r;
            });
        }
    },true);

    $scope.showSubtypes = false;

    $scope.detail = null;
    $scope.selectedItem = listViewSvc.selectedItem.type;
    $scope.selectedListTab = listViewSvc.selectedListTab;
    $scope.hoge = listViewSvc.value;

    $scope.isActive = function(){
        return $scope.selectedItem.id || $scope.selectedItem.id == 0;
    };

    $scope.addSample = function(){
        var typ = $scope.selectedItem.id;
        if(typ || typ == 0){
            $http.post('/samples', $.param({name: $scope.selectedItem.title,type: typ})).success(function(r){
                $scope.detail.samples.push(r.data);
                console.log(r.data,$scope.detail.samples);
            });
        }else{
            console.log('not selected');
        }
    };
    $scope.deleteSample = function(sample){
        $http({url: '/samples/'+sample.id, method: 'DELETE'}).then(function (r) {
            var res = r.data;
            if(res.success){
                var idx = findIndex($scope.detail.samples,sample.id);
                if(idx >= 0){
                    $scope.detail.samples.splice(idx,1);
                }
            }
        });
    }

});

expsApp.controller('sampleDetailCtrl', ['$scope','$http','listViewSvc', function ($scope, $http,listViewSvc) {
    $scope.selectedItem = listViewSvc.selectedItem.sample;

    $scope.isActive = function(){
        return $scope.selectedItem.id || $scope.selectedItem.id == 0;
    };

    $scope.$watch('selectedItem',function(nv,ov){
        if(!$scope.selectedItem) return;
        //  console.log(nv,$scope.selectedListTab);

        //Name changed.
        if(nv && ov && nv.id == ov.id && nv.title != ov.title){
            var id = $scope.selectedItem.id;
            var params = {name: $scope.selectedItem.title};
            $.ajax('/samples/'+$scope.selectedItem.id,{method: 'PUT',data: $.param(params)});
        }else if(nv && ov && nv.id != ov.id){
            //REeceive info.
            var id = $scope.selectedItem.id;
            $http({url: '/samples/'+id+'.json',method: 'GET', params: {full: true}}).success(function(r){
                $scope.exp = r;
                console.log(r);
            });
        }

    },true);
}]);

expsApp.controller('expDetailCtrl', function ($scope, $http,listViewSvc) {
 //   $scope.exps = convertData(data);
    //     console.log(data[0],$scope.exps[0]);

    $scope.d3Data = [
        {name: "Greg", score: 500},
        {name: "Ari", score: 0},
        {name: 'Q', score: 75},
        {name: "Loser", score: 48}
    ];

    $scope.showSection = {note: true, sample: true, protocol: true};

    $scope.deleteExp = function(scope){
        var id = $scope.selectedItem.id;
        $http({url: '/exps/'+id, method: 'DELETE'}).then(function (r) {
            var res = r.data;
            console.log(res);
            if(res.success){
                console.log($scope.exps);
                var idx = findIndex($scope.exps,res.id);
                $scope.exps.splice(idx,1);
                console.log(idx,$scope.exps);
                $scope.selectedItem = $scope.exps[idx-1];
            }
        });
    }

    $scope.expSummary = {};

    $scope.$watch('selectedItem',function(nv,ov){
        if(!$scope.selectedItem) return;
      //  console.log(nv,$scope.selectedListTab);

            //Name changed.
            if(nv && ov && nv.id == ov.id && nv.title != ov.title){
                var id = $scope.selectedItem.id;
                var params = {name: $scope.selectedItem.title};
                $.ajax('/exps/'+$scope.selectedItem.id,{method: 'PUT',data: $.param(params)});
            }else if(nv && ov && nv.id != ov.id){
                //REeceive info.
                var id = $scope.selectedItem.id;
                $http({url: '/exps/'+id+'.json',method: 'GET', params: {full: true}}).success(function(r){
                    $scope.exp = r;
                    console.log(r);
                });
            }

    },true);
    $scope.selectedItem = listViewSvc.selectedItem.exp;

    $scope.isActive = function(){
        return $scope.selectedItem.id || $scope.selectedItem.id == 0;
    }

});

expsApp.controller('itemListCtrl', ['$scope','$http', 'listViewSvc', function ($scope, $http, listViewSvc) {

    $http.get('/types.json').success(function(r){
        $scope.treedata = [mkTreeData(r)];
    });

    $http.get('/exps.json').success(function(r){
        $scope.exps = convertData(r);
    });

    $http.get('/samples.json').success(function(r){
        $scope.samples = listViewSvc.convertSampleData(r);
    });

    $scope.clickList = function(scope,$event){
        console.log(scope,$event);
        var k = {"Samples": 'sample', "Exps": 'exp', "Types": 'type'}[$scope.selectedListTab.name];
        $scope.selectedItem[k].id = scope.id;
        $scope.selectedItem[k].title = scope.title;
    };

    $scope.clickTree = function(scope){
        var k = {"Samples": 'sample', "Exps": 'exp', "Types": 'type'}[$scope.selectedListTab.name];
        $scope.selectedItem[k].id = scope.$modelValue.id // {id: scope.$modelValue.id, name: scope.$modelValue.title};
        $scope.selectedItem[k].title = scope.$modelValue.title // {id: scope.$modelValue.id, name: scope.$modelValue.title};
    }

    $scope.tabs = [{title: 'Samples'},
        {title: 'Exps', active: true},
        {title: 'Types'}];

    $scope.$watch('tabs',function(nv,ov){
        var v = _.findWhere(nv,{active: true}).title;
        $scope.selectedListTab.name = v;
//            console.log($scope.selectedListTab,$scope);
    },true);


    $scope.selectedListTab = listViewSvc.selectedListTab;
    var k = {"Samples": 'sample', "Exps": 'exp', "Types": 'type'}[$scope.selectedListTab.name];
    $scope.selectedItem = listViewSvc.selectedItem;
//    $scope.$watch('selectedListTab',function(nv){
//        var k = {"Samples": 'sample', "Exps": 'exp', "Types": 'type'}[$scope.selectedListTab.name];
//        $scope.selectedItem = listViewSvc.selectedItem[k];
//    },true);

    $scope.addExp = function(){
        $.ajax('/exps', {method: 'POST', data: $.param({name: 'New exp'}), success: function(r){
            console.log(r);
            if(r){
                $scope.$apply(function(){
                    $scope.exps.push({id: r.id, title: r.name});
                });
                console.log($scope.exps);
            }
        }});
    };
    $scope.newSubItem = listViewSvc.newSubItem;
    $scope.deleteTypeItem = listViewSvc.deleteTypeItem;

}]);

expsApp.filter('typeFilter', function() {
    return function( items, tid, showSubtypes) {
        var filtered = [];
        angular.forEach(items, function(sample) {
            if(showSubtypes || sample.typ.id == tid) {
                filtered.push(sample);
            }
        });
        return filtered;
    };
});


expsApp.config(['$routeProvider','$locationProvider',function($routeProvider,$locationProvider){
    $routeProvider.
        when('/phones', {
            templateUrl: "/assets/html/editableTitle.html",
            controller: 'titleController'
        }).
        when('/phones/:phoneId', {
            templateUrl: "/assets/html/editableTitle.html",
            controller: 'titleController'
        }).
        otherwise({
            redirectTo: '/phones'
        });
    $locationProvider.html5Mode(true);
    $locationProvider.hashPrefix('!');
}]);



mkTreeData = function (d) {
    return {id: d.node.id, title: d.node.name, nodes: _.map(d.children, function (n) {
        return mkTreeData(n);
    })};
};


//Just changes name to title.
var convertData = function(es){
    return _.map(es,function(e){
        return {id: e.id, title: e.name, owner: e.owner, note: e.note, protocolSamples: e.protocolSamples, runSamples: e.runSamples, runs: e.runs};
    })
}

function findIndex(vs,id){
    var len = vs.length;
    for(var i=0;i<len;i++){
        if(vs[i].id==id)
        return i;
    }
    return -1;
}

function showMessage(msg){
    console.log(msg);
}