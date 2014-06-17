

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


expsApp.controller('RunSampleCtrl',['$scope','$http', '$timeout', 'listViewSvc', '$modal', function($scope,$http,$timeout,listViewSvc, $modal){
    var key = $scope.run.id + ':' + $scope.psample.id;
//        console.log(key,$scope.item.runSamples,$scope.item.runSamples[key]);
    var s = $scope.item.runSamples[$scope.run.id][$scope.psample.id];
 //   console.log(s,$scope.item.runSamples,$scope.run.id,$scope.psample.id)
    $scope.id =  s;
    $scope.rid = $scope.run.id;
    $scope.psid = $scope.psample.id;

    $scope.name = function() {
        var obj = _.findWhere($scope.item.samples, {id: $scope.id});
       // console.log($scope.id,obj,$scope.item.runSamples,$scope.item.samples)
        return obj ? obj.name : null;
    }

    $scope.typName = function(){
        var obj = _.findWhere($scope.item.samples, {id: $scope.id});
        return obj ? obj.typ.name : null;
    }

    $scope.isSelectedSample = function(){
        return _.contains($scope.selectedSamples,$scope.id);
    }

    $scope.isSelectedCell = function(){
        var key = $scope.run.id + ':' + $scope.psample.id;
        var r = _.contains($scope.selectedRunSampleCells,key);
        return r;
    }

    $scope.clickRunSample = function($event){
        if($event.altKey){
            $http({url: '/runsamples/'+$scope.run.id+'/'+$scope.psample.id, method: 'DELETE'}).success(function(r){
                $scope.id = null;
            }).error(function(r){

            });
        }else {
            $scope.selectRunSampleCell($scope.run.id,$scope.psample.id,$event.metaKey);
            $scope.selectRunSample($scope.id,$event.metaKey);
        }
    };

    $scope.clickEmptyCell = function($event){
        $scope.selectRunSampleCell($scope.run.id,$scope.psample.id,$event.metaKey);
    };

    $scope.selectRunSampleCell = function(run,psample,adding) {
        var k = run+':'+psample;
        if(!adding){
            $scope.selectedRunSampleCells.length = 0;
        }
        $scope.selectedRunSampleCells.push(k);
        console.log($scope.selectedRunSampleCells);
    };

    $scope.$watch('runSample.typ',function(nv,ov){
        if(nv && ov && nv != ov){
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

    $scope.addRunSample = function(psample,run,$event){
        var rid = run.id;
        var pid = psample.id;
        var name = psample.typ.name + moment().format("-M/D/YY");
        $http({url: '/runsamples/'+rid+'/'+pid, method: 'POST', data: $.param({create: true, name: name})}).success(function(r){
            var d = r.data;
            console.log(r,d);
            var key = d.run + ':' + d.protocolSample;
            console.log(key,$scope.item.runSamples);
            $scope.item.runSamples[rid][pid] = r.data.id;
            $scope.item.samples[d.id] = d;
            listViewSvc.samples.push(d);
            $scope.id = d.id;
            console.log($scope.item.runSamples);
//            $timeout(function(){$scope.$digest();},0);
        }).error(function(r){
                console.log(r);
            });
        $event.stopPropagation()
    };

    $scope.chooseRunSampleToAssign = function(psample,run){
        $modal.open({templateUrl: '/public/html/partials/sampleChooser.html', scope: $scope, controller: 'SampleChooserCtrl'});
    }

}]);

expsApp.controller('SampleChooserCtrl',['$scope', '$http', function($scope,$http){
    var init = function(){
        var typ = $scope.psample.typ.id // $scope.types[0].id;
        $http({url: '/samples/of_type/'+typ, method: 'GET', params: {subtypes: true}}).success(function(r){
            console.log(r);
            $scope.compatibleSamples = r;
        })
    };

    init();

    $scope.chooseSample = function(sample) {
        var rid = $scope.run.id;
        var pid = $scope.psample.id;
        $http({url: '/runsamples/'+rid+'/'+pid, method: 'POST', data: $.param({create: false, id: sample.id})}).success(function(r){
            $scope.$parent.runSample = sample;
            $scope.$parent.rid = rid;
            $scope.$parent.psid = pid;
        });
        $scope.$close();

    };
}]);
