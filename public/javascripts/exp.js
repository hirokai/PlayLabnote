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
    $scope.exps = listViewSvc.exps;
    $scope.loaded = false;
    $scope.selectedItem = listViewSvc.selectedItem;

    listViewSvc.current.mode = 'exp';
    listViewSvc.current.id = $stateParams.id;

    console.log('ExpListCtrl loaded.');

    $scope.$watchCollection('exps',function(nv,ov){
       if((!ov || ov.length == 0) && nv && !$scope.loaded)
           $scope.loaded = true;
    });

    if(!$stateParams.id){
        listViewSvc.pageTitle.value = 'List of experiments';
    }

    $scope.addExp = function(){
        var name = 'New exp ' + ($scope.exps.value.length + 1);
        ExpDataSvc.addExp({name: name},function(r){
            $scope.exps.value.push(r);
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
            $scope.selectedRunSampleCells = [];

            $scope.units = unitList;

            console.log('initData()');

            var id = $stateParams.id;
            $http.defaults.headers.common.Authorization = "OAuth2 " +  localStorage['labnote.access_token'];

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
                listViewSvc.showSection.data = true;
                listViewSvc.showSection.protocol = true;
                listViewSvc.showSection.sample = false;
                listViewSvc.showSection.step = false;
            }else if(nv == 'define'){
                listViewSvc.showSection.note = false;
                listViewSvc.showSection.data = false;
                listViewSvc.showSection.protocol = true;
                listViewSvc.showSection.sample = false;
                listViewSvc.showSection.step = false;
            }else if(nv == 'record'){
                listViewSvc.showSection.note = false;
                listViewSvc.showSection.data = true;
                listViewSvc.showSection.protocol = false;
                listViewSvc.showSection.sample = true;
                listViewSvc.showSection.step = true;
            }
        });

        $scope.$watch('showSection.protocol',function(nv,ov){
            if(nv && !ov){
                $timeout(function(){$('#resetZoom').click();},0);
                $timeout(function(){$scope.graphLoaded = true;},50);
            }
        })

        // Action handlers
        $scope.deleteExp = function (id) {
            var msg = 'Are you sure you want to delete the experiment?';
            if(!window.confirm(msg))return;

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

        $scope.saveExp = function (id) {
            $scope.showMessage('Saving to Google Drive. This may take a while...');
            $http.post('/exps/'+id+'/export').success(function(r){
                console.log(r);
                if(r.response.id){
                    var url = "https://docs.google.com/spreadsheets/d/" + r.id;
                    $scope.showMessage('Data was exported to Google Drive')
                //    window.open(url);
                }else{
                    $scope.showMessage('Error occured.','danger');
                }
                if(r.updated_access_token){
                    localStorage['labnote.access_token'] = r.updated_access_token;
                    $http.defaults.headers.common.Authorization = "OAuth2 " +  localStorage['labnote.access_token'];
                }
            }).error(function(r){
                    $scope.showMessage('Error occured.','danger');
                });
        };


        $scope.chooseGDrive = function(){
            chooseGDrive();
        }


        $scope.addPSample = function(){
            var id = $scope.item.id;
            var url = '/exps/' + id + '/psamples'
            var name = 'Sample ' + ($scope.item.protocolSamples.length + 1);
            var typ = $scope.types[0].id;
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

        $scope.assignMulti = function(){
            console.log('assignMulti()', $scope.selectedRunSampleCells);
        }

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

        $scope.addRun = function(exp) {
            var url = '/exps/' + exp.id  + '/runs';
            var name = 'Run ' + ($scope.item.runs.length + 1);
            $http({url: url, method: 'POST',data: $.param({name: name})}).success(function(r){
                $scope.item.runs.push(r.data);
                $scope.item.runSamples[r.data.id] = {};
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

        $scope.selectRunSample = function(sid,adding){
            var sample = $scope.item.samples[sid];
            if(!adding){
                $scope.selectedSamples.length = 0;
            }
            $scope.selectedSamples.push(sid);
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

        $scope.sampleById = function(id) {
          var samples = $scope.item ? $scope.item.samples : null;
          return samples ? $scope.item.samples[id] : null;
        };

        $scope.$watch('item.samples',function(nv,ov){
            if(!nv || !ov || nv == ov) return;
            var diff = diffChangeSamples(nv,ov);
            console.log(nv,ov,diff);
            if(diff.changed){
                _.map(diff.changed,function(chg){
                   var n = chg[0];
                    var o = chg[1];
                    if(n.name != o.name){
                        console.log('Name changed.');
                        $http({url: '/samples/'+n.id, method: 'PUT', data: $.param({name: n.name})});
                    }
                    if(n.typ.id != o.typ.id){
                        console.log('Type changed.');
                    }
                });
            }
        },true);

        $scope.selectPSample = function(s,adding){
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

expsApp.controller('ExpDateCtrl',['$scope', function($scope){
    $scope.today = function() {
        $scope.dt = new Date();
    };
    $scope.today();

    $scope.clear = function () {
        $scope.dt = null;
    };

    // Disable weekend selection
    $scope.disabled = function(date, mode) {
        return ( mode === 'day' && ( date.getDay() === 0 || date.getDay() === 6 ) );
    };

    $scope.toggleMin = function() {
        $scope.minDate = $scope.minDate ? null : new Date();
    };
    $scope.toggleMin();

    $scope.open = function($event) {
        $event.preventDefault();
        $event.stopPropagation();

        $scope.opened = true;
    };

    $scope.dateOptions = {
        formatYear: 'yy',
        startingDay: 1
    };

    $scope.initDate = new Date('2016-15-20');
    $scope.formats = ['M/d/yyyy', 'yyyy/MM/dd', 'dd.MM.yyyy', 'shortDate'];
    $scope.format = $scope.formats[0];

    $scope.dateChanged = function(){
        console.log(moment($scope.dt).valueOf());
    }
}]);

prepareExpData = function(exp){
    var runs = _.map(exp.runs,function(run){return run.id;});
    var psteps = _.map(exp.protocolSteps,function(pstep){return pstep.id;});
    var psamples = _.map(exp.protocolSamples,function(pstep){return pstep.id;});

    console.log(runs,psteps);

    //Run samples
    var samples = {};
    var sampledata = {};
    _.map(runs,function(run){
        var obj = {};
        _.map(psamples,function(psample){
            var o = exp.runSamples[run + ':' + psample];
            if(o){
                obj[psample] = o.id;
                sampledata[o.id] = o;
                sampledata[o.id].typ.title = o.typ.name;
            }
        });
        samples[run] = obj;
    });

    //Run steps
    var steps = {};
    _.map(runs,function(run){
        var obj = {};
        _.map(psteps,function(pstep){
            var o = exp.runSteps[run + ':' + pstep];
            if(o)
                obj[pstep] = o;
        });
        steps[run] = obj;
    });
    exp.runSamples = samples;
    exp.runSteps = steps;
    exp.samples = sampledata;
    console.log(exp);


    //Run params
    _.map(exp.runSteps,function(steps,run){
        _.map(steps,function(step,psample){
            createRunParams(step,parseInt(psample),exp.protocolSteps);
        });
    });

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

var diffChangeSamples = function (vs1, vs2) {
    if(_.isEqual(Object.keys(vs1),Object.keys(vs2))){
        var keys = Object.keys(vs1);
        var changed = [];
        _.map(keys,function(k){
           if(!_.isEqual(vs1[k],vs2[k])){
               changed.push([vs1[k],vs2[k]]);
           }
        });

        return {changed: changed};
    }else{
        return {};  //stub
    }
};
