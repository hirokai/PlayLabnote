

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
