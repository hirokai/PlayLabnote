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

            $scope.selectedPSamples = [];
            $scope.selectedPSteps = [];

            $scope.selectedSamples = [];
            console.log('initData()');

            var id = $stateParams.id;
            $http({url: '/exps/'+id+'.json', method: 'GET', params: {full: true}}).success(function(r){
                $scope.item = prepareExpData(r);
                console.log($scope.item);
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
                $scope.item.runSteps[r.data.id] = {};
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

    $scope.runs = $scope.item.runs;

    $scope.runStep = function(run,pstep) {
        if(!run || !pstep) return null;
        var obj = $scope.item.runSteps[run.id];
        return obj ? obj[pstep.id] : null;
    };

    $scope.isSelectedPStep = function(pstep){
        return _.findWhere($scope.selectedPSteps,{id: pstep.id});
    };
    $scope.clickPStep = function(item,$event){
        $scope.selectPStep(item,$event.metaKey);
    }
    var init = function(){
    }
    init();


    $scope.addRunStep = function(run,pstep) {
        var psid = pstep.id;
        $http({url: '/runs/'+run.id+'/steps', method: 'POST', data: $.param({pstep: psid, time: moment().valueOf()})}).success(function(r){
            console.log(r);
            console.log($scope.item);
            var step = createRunParams(r.data,pstep.id,$scope.item.protocolSteps);
            console.log(step,run.id,pstep.id,$scope.item.runSteps);
            $scope.item.runSteps[run.id][pstep.id] = step;
        });
    };

    $scope.time = function(run,pstep){
        var step = $scope.runStep(run,pstep);
        return step ? moment(step.timeAt).format("H:mm") : '';
    };

    $scope.clickTime = function(run,pstep,$event){
        if($event.altKey) {
            $scope.removeTime(run,pstep);
        }
    }

    $scope.removeTime = function(run,pstep){

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
//
//    $scope.$watch('item.runSteps',function(nv,ov){
//        console.log(nv,ov);
//    },true);
//
//    $scope.$watch('item.runs',function(nv,ov){
//        console.log(nv,ov);
//    });

    $scope.clickRunStep = function(run,pstep,$event){
        var step = $scope.runStep(run,pstep);
        if($event.altKey){
            $scope.deleteRunStep(step);
        }
    };

    $scope.deleteRunStep = function(step){
       $http({url: '/steps/'+step.id, method: 'DELETE'}).success(function(r){
           var k = step.run + ':' + step.step;
           delete $scope.item.runSteps[k];

           $scope.showMessage('Step recorded was deleted.');
           console.log(r);
       }).error(function(r){
               $scope.showMessage('Step recorded was not deleted.','danger');
           });
    };


    $scope.addParamInTable = function(pstep,$event) {
        $scope.addParam(pstep);
      $event.stopPropagation();
    };

    $scope.deleteParam = function(param){
        console.log(param);
        $http({url: '/pparams/'+param.id, method: 'DELETE',data: $.param({force: true})}).success(function(r){
            console.log(r);
            var idx = findIndex($scope.pstep.params,param.id);
            if(idx >= 0){
                $scope.pstep.params.splice(idx,1);
            }
            $scope.showMessage('Param deleted.');

        }).error(function(r){
                console.log(r);

            });
    };

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
        var ss = $scope.selectedSamples[0];
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

expsApp.controller('RunStepNoteCtrl',['$scope','$http',function($scope,$http){
    $scope.runstep = $scope.runStep($scope.run,$scope.pstep);
    $scope.$watch('runstep.note',function(nv,ov){
       console.log(nv,ov);
       if(!nv || ov == undefined || nv == ov) return;
       var id = $scope.runstep.id;
       $http({url: '/steps/'+id, method: 'PUT', data: $.param({note: nv})}).success(function(r){
            console.log(r);
       }).error(function(r){
               console.log(r);

           });
    });
}]);

expsApp.controller('ParamCtrl',['$scope','$http',function($scope, $http){

   $scope.runparam = $scope.runStepParam($scope.run,$scope.pstep,$scope.param);

   $scope.$watchGroup(['run','pstep','param'],function(nv,ov){
       $scope.runparam = $scope.runStepParam($scope.run,$scope.pstep,$scope.param);
    //   console.log(nv,ov);
   });

    $scope.$watch('runparam',function(nv,ov){
        if(!nv || !ov || nv == ov) return;
        console.log(nv,ov);
        if(nv.value != ov.value && ov.value == null){
            $http({url: '/pparams/'+nv.protocolParam+'/run/'+$scope.run.id,
                method: 'POST', data: $.param({value: nv.value})}).success(function(r){
                console.log(r);
            }).error(function(r){
                    $scope.showMessage('Error: '+r,'danger');
                    console.log(r);
                });
        }else{
            $http({url: '/pparams/'+nv.protocolParam+'/run/'+$scope.run.id,
                method: 'PUT', data: $.param({value: nv.value})}).success(function(r){
                    console.log(r);
                }).error(function(r){
                    $scope.showMessage('Error: '+r,'danger');
                    console.log(r);
                });        }
    },true);
}]);

function prepareExpData(exp){
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

function createRunParams(step,psid,protocolSteps){
    console.log(step,psid,protocolSteps);
    step.note = step.note || "";
    var params = _.findWhere(protocolSteps,{id: psid}).params;
//    console.log(params);
    _.map(params,function(param){
        if(!_.findWhere(step.params,{id: param.id})){
            step.params.push({protocolParam: param.id, value: null});
        }
    });
    console.log(step,psid,protocolSteps);
    return step;
}