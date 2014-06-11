var expsApp = angular.module('expsApp', ['editableTitleModule', 'ui.bootstrap', 'ui.tree','ngResource','ui.router']);

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

expsApp.config(['$stateProvider', '$urlRouterProvider', function($stateProvider, $urlRouterProvider){
    $urlRouterProvider.otherwise("/exps");

    $stateProvider
        .state('exps', {
            url: "/exps",
            views: {
                list: {
                    templateUrl: "/public/html/partials/exp_list.html",
                    controller: 'ExpListCtrl'
                },
                detail: {
                    templateUrl: "/public/html/partials/empty_detail.html",
                    controller: 'EmptyDetailCtrl'
                }
            }
        })
        .state('exp_id', {
            url: "/exps/:id",
            views: {
                list: {
                    templateUrl: "/public/html/partials/exp_list.html",
                    controller: 'ExpListCtrl'
                },
                detail: {
                    templateUrl: "/public/html/partials/exp_detail.html",
                    controller: 'ExpDetailCtrl'
                }
            }
        })
        .state('samples', {
            url: "/samples",
            views: {
                list: {
                    templateUrl: "/public/html/partials/sample_list.html",
                    controller: 'SampleListCtrl'
                },
                detail: {
                    templateUrl: "/public/html/partials/empty_detail.html",
                    controller: 'EmptyDetailCtrl'
                }
            }
        })
        .state('sample_id', {
            url: "/samples/:id",
            views: {
                list: {
                    templateUrl: "/public/html/partials/sample_list.html",
                    controller: 'SampleListCtrl'
                },
                detail: {
                    templateUrl: "/public/html/partials/sample_detail.html",
                    controller: 'SampleDetailCtrl'
                }
            }
        })
        .state('types', {
            url: "/types",
            views: {
                list: {
                    templateUrl: "/public/html/partials/type_list.html",
                    controller: 'TypeListCtrl'
                },
                detail: {
                    templateUrl: "/public/html/partials/empty_detail.html",
                    controller: 'EmptyDetailCtrl'
                }
            }
        })
        .state('type_id', {
            url: "/types/:id",
            views: {
                list: {
                    templateUrl: "/public/html/partials/type_list.html",
                    controller: 'TypeListCtrl'
                },
                detail: {
                    templateUrl: "/public/html/partials/type_detail.html",
                    controller: 'TypeDetailCtrl'
                }
            }
        });
}]);

guid = function () {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }

    return function () {
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
            s4() + '-' + s4() + s4() + s4();
    }
};