var expApp = angular.module('expApp', []);


expApp.controller('expAppCtrl', function ($scope, $http) {
    $scope.exp = data;

    $scope.init = function(){
      console.log('Hey');
      $http.get('/exps/'+$scope.exp.id+'.json').then(function(r){
          console.log(r);
          $scope.exp = r.data;
          console.log($scope.exp);
      });
    }

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
    };


    $scope.assignRunSample = function(rid,pid){
        var name = "Sample";
        $scope.exp.runSamples[rid+':'+pid] = {name: name, id: guid()};
        $.post('/exps/'+$scope.exp.id+'/runsamples',{run: rid, protocolSample: pid, name: name},function(r){
            $scope.exp.runSamples[rid+':'+pid] = r.data;
       //     console.log(r)
//            location.reload();
        }).fail(function(r){
            console.log('failed');
            $scope.exp.runSamples[rid+':'+pid] = null;
        });
    };

    $scope.runSample = function (rid,psid) {
        var r = $scope.exp.runSamples[rid+':'+psid];
      //  console.log(rid,psid,r);
        return r;
    }
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
