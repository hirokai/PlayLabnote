var sampleApp = angular.module('sampleApp', []);


sampleApp.controller('sampleAppCtrl', function ($scope, $http) {

    $scope.sample = data.sample;
    $scope.editTitle = function(){
        $scope.editingTitle = true;
    };
    $scope.keyDownTitle = function($event){
        if($event.keyCode == 13){
            $scope.editingTitle = false;
            var params = {name: $scope.sample.name};
            $.ajax('/samples/'+$scope.sample.id,{method: 'PUT',data: $.param(params)})
        }
    };

    $scope.$watch('selectedItem',function(){
        if(!$scope.selectedItem) return;

        var params = {name: $scope.selectedItem.name};
        $.ajax('/samples/'+$scope.selectedItem.id,{method: 'PUT',data: $.param(params)});
    },true);

    $scope.showOnlyExactType = false;

});
