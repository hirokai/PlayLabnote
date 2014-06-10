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
        getOne: {method: 'GET', isArray: false, 'url': '/exps/:id.json', params: {full: true}}
    });
}]);

expsApp.factory('ExpDataSvc',['$http', 'listViewSvc', function($http, listViewSvc){
    return {
        hello: function(){
            console.log('hello');
        },
        changeName: function(id, name, callback){
            console.log('changeName');
            $http({url:'/exps/'+id,method: 'PUT', data: $.param({name: name})}).success(function(r){
                 callback(r);
            });
        },
        addExp: function(params,success,error){
            $http({url: '/exps', method: 'POST', data: $.param(params)}).success(function(r){
                    success(r);
                }).error(function(r){
                    error(r);
                });
        }
    };
}]);

expsApp.controller('ExpListCtrl', ['$scope', '$state', '$stateParams', 'listViewSvc', 'ExpData', 'ExpDataSvc', '$http', function ($scope, $state, $stateParams, listViewSvc, ExpData, ExpDataSvc, $http) {
    $scope.exps = listViewSvc.exps;
    $scope.selectedItem = listViewSvc.selectedItem;

    listViewSvc.current.mode = 'exp';
    listViewSvc.current.id = $stateParams.id;

    $scope.sp = $stateParams; // For debug purpose.

    $scope.addExp = function(){
        var name = 'New exp ' + ($scope.exps.length + 1);
        ExpDataSvc.addExp({name: name},function(r){
            $scope.exps.push(r);
        },function(r){
            console.log('Error');
        });
    };

    $scope.isSelectedExp = function (id) {
        return id == $stateParams.id
    };
    $scope.selectItem = function (item) {
        listViewSvc.selectedItem.exp = item;
        console.log($stateParams);
        $state.go('exp_id',{id: item.id});
    };

}]);


expsApp.controller('ExpDetailCtrl', ['$scope', '$http', '$state', '$stateParams', 'listViewSvc', 'ExpData', 'ExpDataSvc', '$timeout',
    function ($scope, $http, $state, $stateParams, listViewSvc, ExpData, ExpDataSvc, $timeout) {
    //   $scope.exps = convertData(data);
    //     console.log(data[0],$scope.exps[0]);

    //These two are decoupled...
    $scope.selectedItem = listViewSvc.selectedItem;
    $scope.item = ExpData.getOne({id: $stateParams.id}, function(){
        $scope.$watch('item.name', function (nv, ov) {
            if($scope.loaded && nv && nv != ov)
                ExpDataSvc.changeName($scope.item.id,nv, function(r){
                    var d = r.data;
                    $scope.item.name = d.name;
                    $scope.selectedItem.exp.name = d.name;
                })
        }, false);
        $scope.loaded = true;
    });

    $scope.showList = listViewSvc.showList;
    $scope.showDetailJson = listViewSvc.showDetailJson;

    $scope.showSection = {note: true, sample: true, protocol: true};


    $scope.deleteExp = function (id) {
        $http({url: '/exps/' + id, method: 'DELETE'}).then(function (r) {
            var res = r.data;
            console.log(res);
            if (res.success) {
                console.log($scope.exps);
                var idx = findIndex(listViewSvc.exps, res.id);
                listViewSvc.exps.splice(idx, 1);
                var exp = listViewSvc.exps[0];
                var id = exp ? exp.id : null;
                console.log(idx, listViewSvc.exps,id);
                if(id){
                    $state.go('exp_id',{id: id});
                }else{
                    $state.go('exps');
                }
            }
        });
    };

    $scope.addPSample = function(id){
        var url = '/exps/' + id + '/psamples'
        var name = 'PSample ' + ($scope.item.protocolSamples.length + 1);
        var typ = 0;
        $http({url: url, method: 'POST',data: $.param({name: name, type: typ})}).success(function(r){
            $scope.item.protocolSamples.push(r.data);
        });
    };

    $scope.deletePSample = function(id){
        var url = '/psamples/' + id
        $http({url: url, method: 'DELETE'}).success(function(r){
            console.log(r);
            if(r.success){
                var idx = findIndex($scope.item.protocolSamples,id);
                if(idx >= 0){
                    $scope.item.protocolSamples.splice(idx,1);
                }
            }
        }).error(function(r){
                console.log(r);
            });
    };

        $scope.clickPSample = function(id){
            $scope.selectedPS[id] = !$scope.selectedPS[id];
        }

    $scope.selectedPS = {};

        $scope.types = flattenTree(listViewSvc.types[0]);

    $scope.selectedPSCount = function(){
        return _.countBy($scope.selectedPS, function(v){
            return v;
        })['true'] || 0;
    };

        $scope.selectedPSample = function(){
            try{
                var r = null;
                _.map($scope.selectedPS,function(v,k){
                   if(v){
                       r = k;
                       throw "found";
                   }
                });
            }catch(e){
                return r;
            }
            return null;
        }

        $scope.onChangeType = function(psid,type){
            console.log(psid,type);
            var url = '/psamples/'+psid;
            $http({url: url, method: 'PUT', data: $.param({type: type.id})}).success(function(r){
                console.log(r);
                console.log($scope.item.protocolSamples,psid);
                var ps = _.findWhere($scope.item.protocolSamples, {id: parseInt(psid)});
                ps.typ = r.data.typ;
            });
        }

    $scope.runSample = function(psample,run){
        var key = run.id + ':' + psample.id;
        return $scope.item.runSamples[key];
    };

    $scope.clickRunSample = function(psample,run,$event){
        if($event.altKey){
            $http({url: '/runsamples/'+run.id+'/'+psample.id, method: 'DELETE'}).success(function(r){
                var k = run.id + ':' + psample.id;
                delete $scope.item.runSamples[k];
            }).error(function(r){

                });
        }
    };

    $scope.addRunSample = function(psample,run){
      var rid = run.id;
      var pid = psample.id;
      $http({url: '/runsamples/'+rid+'/'+pid, method: 'POST', data: $.param({name: 'New sample'})}).success(function(r){
             console.log(r);
             var d = r.data;
             var key = d.run + ':' + d.protocolSample;
          console.log($scope.item.runSamples);
             $scope.item.runSamples[key] = d;
            console.log($scope.item.runSamples);
          $timeout(function(){$scope.$digest();},0);
          }).error(function(r){
              console.log(r);
          });
    };

    $scope.addRun = function(exp) {
        var url = '/exps/' + exp.id  + '/runs';
        var name = 'Run ' + ($scope.item.runs.length + 1);
        $http({url: url, method: 'POST',data: $.param({name: name})}).success(function(r){
            $scope.item.runs.push(r.data);
        });
    };



    $scope.clickRun = function(run,$event) {
      if($event.altKey){
          var url = '/runs/' + run.id;
          $http({url: url, method: 'DELETE'}).success(function(r){
              var idx = findIndex($scope.item.runs,run.id);
              if(idx >= 0){
                  $scope.item.runs.splice(idx,1);
              }
          });
      }
    };

    $scope.isActive = function () {
        return $scope.selectedItem.id || $scope.selectedItem.id == 0;
    }

}]);
