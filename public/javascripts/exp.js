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

expsApp.controller('ExpListCtrl', ['$scope', '$state', '$stateParams', 'listViewSvc', 'ExpDataSvc', '$http', function ($scope, $state, $stateParams, listViewSvc, ExpDataSvc, $http) {
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
        ExpDataSvc.addExp({name: name},function(r){
            $scope.exps.push(r);
            $state.go('exp_id',{id: r.id});
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


expsApp.controller('ExpDetailCtrl', ['$scope', '$http', '$state', '$stateParams', 'listViewSvc', 'ExpDataSvc', '$timeout',
    function ($scope, $http, $state, $stateParams, listViewSvc, ExpDataSvc, $timeout) {
        var initData = function(){
            $scope.pageTitle = listViewSvc.pageTitle;
            $scope.selectedItem = listViewSvc.selectedItem;
//            $scope.selectedType = 0;
//            $scope.selectedPS = {};
            $scope.selectedSample = {};
//            $scope.selectedPSampleType = null;
            $scope.selectedPSamples = [];
            $scope.selectedPSteps = [];

//            $scope.selectedSampleType = null;
            $scope.selectedSamples = [];
            console.log('initData()');

            var id = $stateParams.id;
            $http({url: '/exps/'+id+'.json', method: 'GET', params: {full: true}}).success(function(r){
                console.log(r);
                $scope.item = createRunParams(r);
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
        }

        initData();

        // View configs
        $scope.showSection = listViewSvc.showSection;
        $scope.shrinkNodes = listViewSvc.shrinkNodes;
        $scope.expViewMode = listViewSvc.expViewMode;
        $scope.showList = listViewSvc.showList;
        $scope.showDetailJson = listViewSvc.showDetailJson;

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


//        $scope.$watch('selectedPSOne',function(){
//            $scope.selectedType = $scope.selectedPSOne ? $scope.selectedPSOne.typ.id : null;
//        }, false);

        // Action handlers
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
            var typ = 0;
            $http({url: url, method: 'POST',data: $.param({name: name, type: typ})}).success(function(r){
                $scope.item.protocolSamples.push(r.data);
            });
        };

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

//        $scope.selectedPSample = function(){
//            try{
//                var r = null;
//                _.map($scope.selectedPS,function(v,k){
//                    if(v){
//                        r = k;
//                        throw "found";
//                    }
//                });
//            }catch(e){
//                return r;
//            }
//            return null;
//        };



        $scope.addRun = function(exp) {
            var url = '/exps/' + exp.id  + '/runs';
            var name = 'Run ' + ($scope.item.runs.length + 1);
            $http({url: url, method: 'POST',data: $.param({name: name})}).success(function(r){
                $scope.item.runs.push(r.data);
            });
        };



        $scope.clickRun = function(run,$event) {
            if($event.altKey){
                $scope.deleteRun(run.id);
            }
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
                    $scope.selectedPSamples = [s];
                    $scope.selectedPSteps = [];
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


    }]);


expsApp.controller('ProtocolSampleCtrl',['$scope','$http', function($scope, $http){
    $scope.isSelectedPSample = function(ps){
        return _.findWhere($scope.selectedPSamples,{id: ps.id});
    };

    $scope.clickPSample = function(item,$event){
        $scope.selectPSample(item,$event.metaKey);
    };
    $scope.deletePSample = function(id){
        var url = '/psamples/' + id;
        if(_.filter(Object.keys($scope.item.runSamples),function(k){return k.split(':')[1] == ""+id}).length > 0){
            $scope.showMessage('Cannot delete. run samples still exist.','warning');
            return;
        }
        $http({url: url, method: 'DELETE'}).success(function(r){
            console.log(r);
            if(r.success){
                var idx = findIndex($scope.item.protocolSamples,id);
                if(idx >= 0){
                    $scope.item.protocolSamples.splice(idx,1);
                }
                $scope.showMessage('Sample deleted.')
            }else{
                $scope.showMessage('Could not delete sample: '+ r.message,'danger');
            }
        }).error(function(r){
                console.log(r);
                $scope.showMessage('Could not delete sample: '+ r.message,'danger');
            });
    };
    $scope.$watch('psample',function(nv,ov){
        if(!nv || !ov || nv.id != ov.id || nv == ov)return;
        console.log('PSample changed',nv,ov);

        var obj = {};
        if(nv.name != ov.name){
            obj.name = nv.name;
        }
        if(nv.typ.id != ov.typ.id){
            obj.type = nv.typ.id;
        }
        console.log(obj);
        if(Object.keys(obj).length == 0){
            console.log('Something has changed on psample('+nv.id+'), but nothing has changed for update.')
            return;
        }
        $http({url: '/psamples/'+nv.id, method: 'PUT', data: $.param(obj)}).success(function(r){
            console.log(r);
        }).error(function(){
                console.log(r);
            });

    },true);
}]);

expsApp.controller('ProtocolStepCtrl',['$scope', '$http', function($scope, $http){
    $scope.isSelectedPStep = function(pstep){
        return _.findWhere($scope.selectedPSteps,{id: pstep.id});
    };
    $scope.clickPStep = function(item,$event){
        $scope.selectPStep(item,$event.metaKey);
    }
    var init = function(){
        $scope.runSteps = {};
        var pid = $scope.pstep.id;
        _.map($scope.item.runs,function(run){
            var k = run.id + ':' + pid;
            $scope.runSteps[run.id] = $scope.item.runSteps[k];
        });
        console.log($scope.runSteps);
    }
    init();

    $scope.runs = $scope.item.runs;

    $scope.runStep = function(run,pstep) {
        var k = run.id + ':' + pstep.id;
//        console.log(k,$scope.item.runSteps[k]);
        return $scope.item.runSteps[k];
    };

    $scope.addRunStep = function(run,pstep) {
        var psid = pstep.id;
        $http({url: '/runs/'+run.id+'/steps', method: 'POST', data: $.param({pstep: psid, time: moment().valueOf()})}).success(function(r){
            console.log(r);
            var k = run.id + ':' + pstep.id;
            $scope.item.runSteps[k] = r.data;
        });
    };

    $scope.time = function(run,pstep){
        var step = $scope.runStep(run,pstep);
        return step ? moment(step.timeAt).format("h:m") : '';
    };

    $scope.unit = function(param){
        //       console.log(param,unitList);
        var u = param.unit == "" ? '-' : param.unit;
        var p = _.findWhere(unitList, {typ: param.typ, unit: u});
        return p ? p.name : '';
    }

    $scope.runStepParam = function(run,pstep,param){
        var runstep = $scope.runStep(run,pstep);
        if(runstep){
            return _.findWhere(runstep.params,{protocolParam: param.id});
        }else{
            return null;
        }
        //    console.log(runstep,param);
    };

    $scope.inputType = function(param){
//        console.log(param);
        if(param.typ == 'volume'){
            return 'number';
        }else{
            return 'text';
        }
    }

    $scope.$watch('',function(){

    },true);

}]);

expsApp.controller('RunSampleCtrl',['$scope','$http', '$timeout', 'listViewSvc', function($scope,$http,$timeout,listViewSvc){
    var key = $scope.run.id + ':' + $scope.psample.id;
//        console.log(key,$scope.item.runSamples,$scope.item.runSamples[key]);
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
        var name = psample.typ.name + moment().format("-M/D/YY");
        $http({url: '/runsamples/'+rid+'/'+pid, method: 'POST', data: $.param({name: name})}).success(function(r){
            var d = r.data;
            console.log(r,d);
            var key = d.run + ':' + d.protocolSample;
            console.log(key,$scope.item.runSamples);
            $scope.item.runSamples[key] = d;
            listViewSvc.samples.push(d);
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

expsApp.controller('RunStepCtrl',['$scope','$http', 'listViewSvc', function($scope, $http, listViewSvc){



}]);


function createRunParams(exp){
    _.map(exp.runSteps,function(step,k){
        var psid = parseInt(k.split(':')[1]);
        var params = _.findWhere(exp.protocolSteps,{id: psid}).params;
        _.map(params,function(param){
            if(!_.findWhere(step.params,{id: param.id})){
                step.params.push({protocolParam: param.id, value: null});
            }
        })
    });
    return exp;
}