
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


    $scope.clickRunStep = function(run,pstep,$event){
        var step = $scope.runStep(run,pstep);
        if($event.altKey){
            $scope.deleteRunStep(step);
        }
    };

    $scope.deleteRunStep = function(step){
        $http({url: '/steps/'+step.id, method: 'DELETE'}).success(function(r){
            var k = step.run + ':' + step.step;
            delete $scope.item.runSteps[step.run][step.step];

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

expsApp.controller('RunStepNoteCtrl',['$scope','$http',function($scope,$http){
    $scope.runstep = $scope.runStep($scope.run,$scope.pstep);
    $scope.$watch('runstep.note',function(nv,ov){
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
