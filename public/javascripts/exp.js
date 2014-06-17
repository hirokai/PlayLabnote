expsApp.controller('ExpListCtrl', ['$scope', '$state', '$stateParams', 'listViewSvc', '$http', function ($scope, $state, $stateParams, listViewSvc, $http) {
    $scope.exps = listViewSvc.exps.value;
    $scope.loaded = false;
    $scope.selectedItem = listViewSvc.selectedItem;

    listViewSvc.current.mode = 'exp';
    listViewSvc.current.id = $stateParams.id;

    $scope.$watchCollection('exps',function(nv,ov){
       if((!ov || ov.length == 0) && nv && !$scope.loaded)
           $scope.loaded = true;
    });

    if(!$stateParams.id){
        listViewSvc.pageTitle.value = 'List of experiments';
    }

    $scope.addExp = function(){
        var name = 'New exp ' + ($scope.exps.length + 1);
        $http({url: '/exps', method: 'POST', data: $.param({name: name})}).success(function(r){
            $scope.exps.push(r);
            $state.go('exp_id',{id: r.id});
        }).error(function(r){
                error(r);
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


expsApp.controller('ExpDetailCtrl', ['$scope', '$http', '$state', '$stateParams', 'listViewSvc', '$timeout',
    function ($scope, $http, $state, $stateParams, listViewSvc, $timeout) {
        var initData = function(){
            $scope.pageTitle = listViewSvc.pageTitle;
            $scope.selectedItem = listViewSvc.selectedItem;

            $scope.selectedPSamples = [];
            $scope.selectedPSteps = [];

            $scope.selectedSamples = [];
            console.log('initData()');

            var id = $stateParams.id;
            $http.defaults.headers.common.Authorization = "OAuth2 " +  localStorage['labnote.apiKey'];

            $http({url: '/exps/'+id+'.json', method: 'GET', params: {full: true}}).success(function(r){
                $scope.item = prepareExpData(r);
                console.log($scope.item);
                $scope.$watch('item.name', function (nv, ov) {
                    if($scope.loaded && nv && nv != ov){
                        $http({url:'/exps/'+$scope.item.id, method: 'PUT', data: $.param({name: nv})}).success(function(r){
                            var d = r.data;
                            console.log(d);
                            $scope.item.name = d.name;
                            $scope.selectedItem.exp.name = d.name;
                        });
                    }
                }, false);
                listViewSvc.pageTitle.value = $scope.item.name + ' - Labnotebook';
                $scope.loaded = true;
            }).error(function(r){
                    $state.go('exps');
                });


            var mkName = function(vs){
                return _.map(vs,function(v){
                    v.name = v.title;
                    return v;
                });
            }

            if(listViewSvc.types && listViewSvc.types[0]){
                $scope.types = mkName(flattenTree(listViewSvc.types[0]));
            }else{
                $http({url: '/types.json', method: 'GET'}).success(function(r){
                    listViewSvc.types = [mkTreeData(r)];
                    $scope.types = mkName(flattenTree(listViewSvc.types[0]));
                });
            }

        }

        initData();

        // View configs
        $scope.showSection = listViewSvc.showSection;
        $scope.shrinkNodes = listViewSvc.shrinkNodes;
        $scope.expViewMode = listViewSvc.expViewMode;
        $scope.showList = listViewSvc.showList;
        $scope.showDetailJson = listViewSvc.showDetailJson;
        $scope.editingPSteps = listViewSvc.editingPSteps;

        // View helpers


        // Set up observers
        $scope.$watch('expViewMode.val',function(nv){
            if(nv == 'summary'){
                listViewSvc.showSection.note = true;
                listViewSvc.showSection.protocol = true;
                listViewSvc.showSection.sample = false;
                listViewSvc.showSection.step = false;
            }else if(nv == 'define'){
                listViewSvc.showSection.note = false;
                listViewSvc.showSection.protocol = true;
                listViewSvc.showSection.sample = false;
                listViewSvc.showSection.step = false;
            }else if(nv == 'record'){
                listViewSvc.showSection.note = false;
                listViewSvc.showSection.protocol = false;
                listViewSvc.showSection.sample = true;
                listViewSvc.showSection.step = true;
            }
        });

        // Data manipulation
        $scope.deleteExp = function (id) {
            $http({url: '/exps/' + id, method: 'DELETE'}).then(function (r) {
                var res = r.data;
                console.log(res);
                if (res.success) {
                    $scope.showMessage('Exp deleted.');
                    console.log($scope.exps);
                    var idx = findIndex(listViewSvc.exps.value, res.id);
                    listViewSvc.exps.value.splice(idx, 1);
                    var exp = listViewSvc.exps.value[idx];
                    var id = exp ? exp.id : null;
                    if(id){
                        $state.go('exp_id',{id: id});
                    }else{
                        $state.go('exps');
                    }
                }else{
                    $scope.showMessage('Delete failed.','danger');
                }
            });
        };

        $scope.addPSample = function(){
            var id = $scope.item.id;
            var url = '/exps/' + id + '/psamples'
            var name = 'Sample ' + ($scope.item.protocolSamples.length + 1);
            var typ = listViewSvc.types[0].id;
            $http({url: url, method: 'POST',data: $.param({name: name, type: typ})}).success(function(r){
                $scope.item.protocolSamples.push(r.data);
                $scope.showMessage('Sample added.')
            });
        };

        $scope.addParam = function(pstep){
            var id = pstep.id;
            var name = 'Param ' + (pstep.params.length+1);
            $http({url: '/psteps/'+id+'/params', method: 'POST', data: $.param({name: name, type: 'text'})}).success(function(r){
                console.log(r);
                pstep.params.push(r.data);
                $scope.showMessage("Param added.");
            }).error(function(r){
                    console.log(r);
                });
        };


        $scope.addRun = function(exp) {
            var url = '/exps/' + exp.id  + '/runs';
            var name = 'Run ' + ($scope.item.runs.length + 1);
            $http({url: url, method: 'POST',data: $.param({name: name})}).success(function(r){
                $scope.item.runs.push(r.data);
                $scope.item.runSteps[r.data.id] = {};
            });
        };

        $scope.deleteRun = function(rid) {
            var url = '/runs/' + rid;
            $http({url: url, method: 'DELETE'}).success(function(r){
                var idx = findIndex($scope.item.runs,rid);
                if(idx >= 0){
                    $scope.item.runs.splice(idx,1);
                }
            }).error(function(r){
                    $scope.showMessage('Run was not deleted: '+ r, 'danger')
                });
        }

        $scope.selectRunSample = function(s,adding){
            var newt = _.findWhere($scope.types,{id: s.typ.id});
            if(newt){
                s.typ = newt;
                if(adding){
                    $scope.selectedSamples.push(s);
                    s.selected = true;
                }else{
                    $scope.selectedSamples.length = 0;
                    $scope.selectedSamples.push(s);
                    s.selected = true;
                }
                console.log($scope.selectedSamples);
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

        $scope.selectPSample = function(s,adding){
            console.log(s);
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
                    $scope.selectedPSamples.length = 0;
                    $scope.selectedPSamples.push(s);
                    $scope.selectedPSteps.length = 0;
                    s.selected = true;
                }
            }else{

            }
            console.log(s);
        };

        $scope.selectPStep = function(s,adding){
            if(adding){
                $scope.selectedPSteps.push(s);
                s.selected = true;
            }else{
                _.map($scope.selectedPSteps,function(s){
                    s.selected = false;
                });
                $scope.selectedPSteps.length = 0;
                $scope.selectedPSteps.push(s);
                $scope.selectedPSamples.length = 0;
                s.selected = true;
            }
        };

        // Event handlers
        $scope.clickRun = function(run,$event) {
            if($event.altKey){
                $scope.deleteRun(run.id);
            }
        };


    }]);



expsApp.controller('SampleChooserCtrl',['$scope','$http',function($scope,$http){
    $scope.chooseSample = function(s){
        console.log($scope.runSample);
        var psid = $scope.runSample.psid;
        var rid = $scope.runSample.rid;
        $http({url: '/runsamples/'+rid+'/'+psid, method: 'POST', data: $.param({create: false, id: s.id})}).success(function(r){
            $scope.$parent.runSample = s;
            $scope.$parent.runSample.rid = rid;
            $scope.$parent.runSample.psid = psid;
            console.log($scope);
            $scope.$close();
        }).error(function(r){
               console.log(r);
            });
    };
}]);


prepareExpData = function(exp){
    _.map(exp.runSteps,function(step,k){
        createRunParams(step,parseInt(k.split(':')[1]),exp.protocolSteps);
    });
    var keys = _.zip.apply(null,_.map(Object.keys(exp.runSteps),function(k){return k.split(':');}));
    var runs = _.map(exp.runs,function(run){return run.id;});
    var psteps = _.map(exp.protocolSteps,function(pstep){return pstep.id;});
    var res = {};
    _.map(runs,function(run){
        var obj = {};
        _.map(psteps,function(pstep){
            var o = exp.runSteps[run + ':' + pstep];
            if(o)
                obj[pstep] = o;
        });
        res[run] = obj;
    });
    exp.runSteps = res;
    return exp;
}

createRunParams = function(step,psid,protocolSteps){
    step.note = step.note || "";
    var params = _.findWhere(protocolSteps,{id: psid}).params;
//    console.log(params);
    _.map(params,function(param){
        if(!_.findWhere(step.params,{id: param.id})){
            step.params.push({protocolParam: param.id, value: null});
        }
    });
    return step;
}