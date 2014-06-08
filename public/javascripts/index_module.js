var expsApp = angular.module('expsApp', ['editableTitleModule', 'ui.bootstrap', 'ui.tree','ngResource','ngRoute']);

expsApp.factory('helper',function(){
    return {
        guid: (function () {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }

        return function () {
            return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
                s4() + '-' + s4() + s4() + s4();
        };
    })()
    }
});

expsApp.filter('typeFilter', function () {
    return function (items, tid, showSubtypes) {
        var filtered = [];
        angular.forEach(items, function (sample) {
            if (showSubtypes || sample.typ.id == tid) {
                filtered.push(sample);
            }
        });
        return filtered;
    };
});

expsApp.config(['$routeProvider','$locationProvider', function($routeProvider,$locationProvider){
    $routeProvider.
        when('/:mode/:id?', {
           templateUrl: '/public/html/partials/entire_view.html',
            controller: 'entireCtrl'
        }).
        otherwise({
            redirectTo: '/exps'
        });

//    $locationProvider.html5Mode(true);
}]);
