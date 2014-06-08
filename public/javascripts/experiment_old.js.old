var expApp = angular.module('expApp', []);


expApp.controller('expDetailCtrl2', function ($scope, $http) {

    var expId = data.id;

    var init = function(){
        $http.get('/types').success(function(data){
            console.log(data);
            $scope.types = data;
        });
        $scope.exp = data.exp;
//        $http({url: '/exps/'+expId+'.json',method: 'GET', params: {full: true}}).success(function(data){
//            $scope.exp = data;
//            console.log(data);
//        });

        $scope.selectedSample = {id: null, name: null, typ: {}}
    }

    init();


    $scope.editTitle = function(){
        $scope.editingTitle = true;
    };

    $scope.keyDownTitle = function($event){
        if($event.keyCode == 13){
            $scope.editingTitle = false;
            var params = {name: $scope.exp.name};
            $.ajax('/exps/'+$scope.exp.id,{method: 'PUT',data: encodeParams(params)})
        }
    };

//    $scope.$watch('exp.name', function(nv,ov){
//        console.log(nv,ov);
//    });

    $scope.addRun = function () {
        var n = $scope.exp.runs.length + 1;
        var name = 'Run ' + n;
            var id = guid();
            $scope.exp.runs.push({name: name, id: id});
        $.post('/exps/' + $scope.exp.id + '/runs', {name: name}, function (res) {
            var r = _.findWhere($scope.exp.runs,{id:id});
            r.id = res.id;
        });
    };

    $scope.addPSample = function () {
        var n = $scope.exp.protocolSamples.length + 1;
        var name = 'Sample ' + n;
        var id = guid();
        $scope.exp.protocolSamples.push({name: name, typ: {name: 'Any', id: 0}, id: id});
        $.post('/exps/'+$scope.exp.id+'/psamples', {name: name}, function (res) {
            var ps = _.findWhere($scope.exp.protocolSamples,{id: id});
            ps.id = res.id;
        });
    };

    $scope.clickRun = function (run, $event) {
        if ($event.altKey) {
            $.ajax('/runs/' + run.id, {method: 'DELETE', success: function (res) {
                location.reload();
            }});
        }
    };

    $scope.clickRunSample = function (rid, psid, $event) {
        console.log($scope.exp.runSamples[rid+':'+psid]);
        if($event.altKey){
            $.ajax('/runsamples/'+rid+'/'+psid, {method: 'DELETE', success: function(r){
                console.log(r);
                if(r.success){
                    $scope.$apply(function(){
                        $scope.exp.runSamples[rid+':'+psid] = null;
                    });
                }
            }});
        }else{
            $scope.selectedSample = $scope.exp.runSamples[rid+':'+psid];
            $scope.selectedType = $scope.exp.runSamples[rid+':'+psid].typ;
            console.log($scope.selectedSample);
        }
    };


    $scope.assignRunSample = function(rid,pid){
        var name = "Sample";
        var ps = _.findWhere($scope.exp.protocolSamples,{id: pid});
        var tid = ps.typ.id;
        $scope.exp.runSamples[rid+':'+pid] = {name: name, id: guid(), typ: ps.typ};
        $.post('/runsamples/'+rid+'/'+pid, {name: name, type: tid},function(r){
            $scope.$apply(function(){
                console.log(r.data);
                $scope.exp.runSamples[rid+':'+pid] = r.data;
            });
        }).fail(function(r){
            console.log('failed');
                $scope.$apply(function(){
                    $scope.exp.runSamples[rid+':'+pid] = null;
                });
            });
    };

    $scope.runSample = function (rid,psid) {
        var r = $scope.exp.runSamples[rid+':'+psid];
      //  console.log(rid,psid,r);
        return r;
    }

    $scope.cellClass = function(rid,psid) {
        var rs = $scope.runSample(rid,psid);
        return $scope.selectedSample.id == (rs ? (rs.id ? 'selected' : "") : '');
    };

    $scope.changeType = function(typ){
        if($scope.selectedSample){
            var sid = $scope.selectedSample.id;
//            var types = $scope.types
            console.log('changed',typ,sid);
            $scope.selectedSample.typ = typ; //_.findWhere($scope.types,{id: typ});
            $scope.selectedType = typ; //_.findWhere($scope.types,{id: typ});
            $http({url: '/samples/'+sid, method: 'PUT', data: $.param({type: typ.id})}).then(function(r){
                console.log(r.data.data);

            });
        }
    };

//    $scope.$watch('exp.runSamples',function(nv,ov){console.log(nv,ov);},true);
});

expApp.directive('sampleInspector', function() {
    return {
        restrict: 'E',
        scope: {
            sampleInfo: '=sample',
            allTypes: '=types',
            sampleType: '=type'
        },
        templateUrl: '/assets/html/sample_inspector.html',
        link: function (scope, element, attributes, parentController) {
            element.on("change", function(e) {
                scope.$parent.selectedType.id = scope.sampleType.id;
//                parentController.act(this.innerHTML);
            });
        }
    };
});

var guid = (function() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
               .toString(16)
               .substring(1);
  }
  return function() {
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
           s4() + '-' + s4() + s4() + s4();
  };
})();

var encodeParams = function(obj){
    return (_.map(obj,function(v,k){
       return k + '=' + v;
    })).join('&');
};