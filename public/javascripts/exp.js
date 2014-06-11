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

    if(!$stateParams.id){
        listViewSvc.pageTitle.value = 'List of experiments';
    }

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
                        console.log(d);
                        $scope.item.name = d.name;
                        $scope.selectedItem.exp.name = d.name;
                    })
            }, false);
            listViewSvc.pageTitle.value = $scope.item.name + ' - Labnotebook';
            $scope.loaded = true;
        });

        $scope.selectedSample = {};

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
                    var exp = listViewSvc.exps[idx];
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

        $scope.selectedType = 0;

        $scope.clickPSample = function(item){
            $scope.selectPSample(item,false);
        };

        $scope.$watch('selectedPSOne',function(){
            $scope.selectedType = $scope.selectedPSOne ? $scope.selectedPSOne.typ.id : null;
        }, false);


        $scope.selectedPS = {};

        var mkName = function(vs){
            return _.map(vs,function(v){
                v.name = v.title;
                return v;
            });
        }
        if(listViewSvc.types[0]){
            $scope.types = mkName(flattenTree(listViewSvc.types[0]));
        }

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
        };

        $scope.selectedPSampleType = null;
        $scope.selectedPSamples = [];

        $scope.selectedSampleType = null;
        $scope.selectedSamples = [];

//        $scope.onChangePSampleType = function(){
//            var tid = $scope.selectedPSampleType.id
//            var psid = $scope.selectedPSamples[0].id
//            console.log(psid,tid);
//            var url = '/psamples/'+psid;
//            $http({url: url, method: 'PUT', data: $.param({type: tid})}).success(function(r){
//                console.log(r);
//                console.log($scope.item.protocolSamples,psid);
//                var ps = _.findWhere($scope.item.protocolSamples, {id: parseInt(psid)});
//                ps.typ = r.data.typ;
//            });
//        }

        $scope.isSelectedPS = function(ps){
            return _.findWhere($scope.selectedPSamples,{id: ps.id});
        }

//        $scope.onChangeSampleType = function(){
//            var tid = $scope.selectedSampleType.id;
//            var sid = $scope.selectedSamples[0].id;
//            $http({url: '/samples/'+sid,method: 'PUT', data: $.param({type: tid})}).success(function(r){
//                var typ = _.findWhere($scope.types,{id: tid});
//                typ.name = typ.title;
//                console.log(typ);
//                $scope.selectedSamples[0].typ = typ;
//            });
//        }


        $scope.$watch('selectedPSamples[0].typ',function(nv,ov){
            if(ov && nv != ov){
                console.log(nv);
                var sid = $scope.selectedPSamples[0].id;
                $http({url: '/psamples/'+sid, method: 'PUT', data: $.param({type: nv.id})}).success(function(r){
                    console.log(r);
                }).error(function(r){
                        console.log('Error. has to roll back.');
                    });
            }
        });

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

        $scope.selectedType = {};

        $scope.selectPSample = function(s,adding){
            var newt = _.findWhere($scope.types,{id: s.typ.id});
            console.log(s,newt);
            if(newt){
                s.typ = newt;
                if(adding){
                    $scope.selectedPSamples.push(s);
                    s.selected = true;
                }else{
                    _.map($scope.selectedPSamples,function(s){
                        s.selected = false;
                    });
                    $scope.selectedPSamples = [s];
                    s.selected = true;
                }
            }else{

            }
            console.log(s);
        };

        $scope.selectRunSample = function(s,adding){
            console.log(s);
            var newt = _.findWhere($scope.types,{id: s.typ.id});
            if(newt){
                s.typ = newt;
                if(adding){
                    $scope.selectedSamples.push(s);
                    s.selected = true;
                }else{
                    _.map($scope.selectedSamples,function(s){
                        s.selected = false;
                    });
                    $scope.selectedSamples = [s];
                    s.selected = true;
                }
            }else{

            }
        };

        $scope.deselectRunSample = function(s){
            var vs = $scope.selectedSamples;
            for(var idx=0;idx<vs.length;idx++){
                if(vs[idx].psid == s.psid && vs[idx].rid == s.rid){
                    vs.splice(idx,1);
                    break;
                }
            }
        };

        $scope.isActive = function () {
            return $scope.selectedItem.id || $scope.selectedItem.id == 0;
        }

    }]);

expsApp.controller('RunSampleCtrl',['$scope','$http', '$timeout', 'listViewSvc', function($scope,$http,$timeout,listViewSvc){
    console.log('Hoge');

        var key = $scope.run.id + ':' + $scope.psample.id;
        console.log(key,$scope.item.runSamples,$scope.item.runSamples[key]);
    $scope.runSample =  $scope.item.runSamples[key] || {};
    $scope.runSample.rid = $scope.run.id;
    $scope.runSample.psid = $scope.psample.id;

    $scope.typestr = function(){
        var k = $scope.run.id + ':' + $scope.psample.id;
        var s = $scope.runSample($scope.psample.id,$scope.run.id);
        console.log($scope,k,s);
        return s ? s.typ.name : null;

    }

    $scope.clickRunSample = function($event){
        var sample = $scope.runSample;
        console.log(sample);
        if($event.altKey){
            $http({url: '/runsamples/'+sample.rid+'/'+sample.psid, method: 'DELETE'}).success(function(r){
                var k = sample.rid + ':' + sample.psid;
                $scope.runSample = null;
            }).error(function(r){

                });
        }else if($event.metaKey){
            $scope.selectRunSample($scope.runSample,true);
        }else{
            $scope.selectRunSample($scope.runSample,false);
        }
    };

    $scope.$watch('runSample.typ',function(nv,ov){
        if(ov && nv != ov){
            console.log(nv);
            var sid = $scope.runSample.id;
            $http({url: '/samples/'+sid, method: 'PUT', data: $.param({type: nv.id})}).success(function(r){
                console.log(r);
            }).error(function(r){
                   console.log('Error. has to roll back.');
                });
        }
    });

    $scope.$watch('runSample.name',function(nv,ov){
        var sample = $scope.runSample;
        if(nv && ov && nv != ov && sample.id){
            $http({url: '/samples/'+sample.id, method: 'PUT',data: $.param({name: nv})}).success(function(r){
                var idx = findIndex(listViewSvc.samples,sample.id);
//                console.log(idx,listViewSvc.samples);
                if(idx >= 0){
                    listViewSvc.samples[idx] = r.data;
                }
            }).error(function(r){
                  showMessage('Error.')
//                   location.reload();
                });
        }
    });

    $scope.selectedRunSample = function(run,psample){
        var k = run.id + ':' + psample.id;
        var sample = $scope.item.runSamples[k];
        var ss = $scope.selectedSample;
        return ss && sample && (ss.id == sample.id);
    };

    $scope.addRunSample = function(psample,run){
        var rid = run.id;
        var pid = psample.id;
        $http({url: '/runsamples/'+rid+'/'+pid, method: 'POST', data: $.param({name: 'New sample'})}).success(function(r){
            console.log(r);
            var d = r.data;
            var key = d.run + ':' + d.protocolSample;
            console.log(key,$scope.item.runSamples);
            $scope.item.runSamples[key] = d;
            $scope.runSample = d;
            $scope.runSample.rid = rid;
            $scope.runSample.psid = pid;
            console.log($scope.item.runSamples);
//            $timeout(function(){$scope.$digest();},0);
        }).error(function(r){
                console.log(r);
            });
    };
}]);