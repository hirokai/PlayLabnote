expsApp.service('listViewSvc', ['$http', function ($http) {
    return {
        hello: function () {
            console.log('Hello', this.selectedItem);
        },
        selectedItem: {
            exp: {},
            sample: {},
            type: {}
        },
        current: {
            mode: null,
            id: null
        },
        alert: {
            msg: null
        },
        showDetailJson: {
            value: false
        },
        pageTitle: {
            value: 'Labnotebook'
        },
        exps: {
            value: []
        },
        samples: {
            value: []
        },
        types: {
            value: []
        },
        showSection: {note: true, sample: true, protocol: true},
        shrinkNodes: {val: false},
        expViewMode: {val: 'record'},
        newSubItem: function (scope) {
            console.log(scope);
            var nodeData = scope.$modelValue;
            var name = nodeData.title + '.' + (nodeData.nodes.length + 1);
            var id = guid(); //nodeData.id * 10 + nodeData.nodes.length
            nodeData.nodes.push({
                id: id,
                title: name,
                nodes: []
            });
            $http({url: '/types', method: 'POST', data: $.param({name: name, parent: nodeData.id})}).then(function (r) {
                var res = r.data;
                console.log(res);
                if (res.success) {
                    var node = _.findWhere(nodeData.nodes, {id: id});
                    node.id = res.data.id;
                }
            });
        },
        deleteTypeItem: function (scope) {
            var nodeData = scope.$modelValue;
            $http.get('/samples/of_type/' + nodeData.id, {params: {subtypes: true, countOnly: true}}).then(function (r) {
                if (r.data.count == 0) {
                    $http({url: '/types/' + nodeData.id, method: 'DELETE'}).then(function (r) {
                        var res = r.data;
                        console.log(res);
                    });
                    scope.remove();
                } else {
                    showMessage('Not empty type.')
                }
            });
        },
        convertSampleData: function (ss) {
            return _.map(ss, function (s) {
                s.title = s.name;
                delete s['name']
                return s;
            });
        },
        showList: {
            value: true
        }
    }
}]);

expsApp.controller('protocolGraphCtrl', ['$scope', function ($scope) {
    console.log($scope);
    $scope.$watch('exp', function (nv, ov) {
        $scope.nodes = [
            {x: Math.random() * 100, y: 100}
        ];
    }, true);
    $scope.x = function (scope) {
        console.log(scope);
        return Math.random() * 100;
    }
    $scope.y = function (scope) {
        return Math.random() * 100;
    }
}]);

//This controller is loaded in the beginning, no matter which tab is open. (Background loading).
expsApp.controller('entireCtrl',
    ['$scope', '$http', '$timeout', '$interval', '$window', '$sce', '$modal',
        'listViewSvc',
        'ExpDataSvc', 'SampleDataSvc', 'TypeDataSvc',
    function ($scope, $http, $timeout, $interval, $window, $sce, $modal,
              listViewSvc,
              ExpDataSvc, SampleDataSvc, TypeDataSvc) {
        var init = function () {
            //Common data store. This enables background loading.
            console.log('entireCtrl: init()');

            $scope.mode = 'exp';

            $scope.selectedListTab = listViewSvc.selectedListTab;
            $scope.selectedItem = listViewSvc.selectedItem;
            $scope.showList = listViewSvc.showList;

            $scope.alertmsghtml =

            $scope.account_email = localStorage['labnote.email'];
            $scope.loggedIn = !!localStorage['labnote.email'];

            $http.defaults.headers.common.Authorization = "OAuth2 " +  localStorage['labnote.access_token'];
//            $scope.checkLogin();

            $http({url: '/exps.json', method: 'GET'}).success(function(r){
                listViewSvc.exps.value = r;
                console.log($scope.exps);
            });

            $http({url: '/samples.json', method: 'GET'}).success(function(r){
                listViewSvc.samples.value = r;
            });

            $http({url: '/types.json', method: 'GET'}).success(function(r){
                listViewSvc.types.value = [mkTreeData(r)];
            });

        };

        $scope.googleLogin = function(){
            var redirectUri = 'https://localhost/google_oauth2callback';
            var params = {response_type: 'code', client_id: clientId, redirect_uri: redirectUri,
                scope: 'email https://www.googleapis.com/auth/drive.file', state: 'Hoge', access_type: 'offline', approval_prompt: 'auto',
                include_granted_scopes: false
            }
            var url = 'https://accounts.google.com/o/oauth2/auth?' + $.param(params);
            window.open(url, 'Login with Google', 'width=500,height=500;')
        };

        $scope.logout = function(){
            // https://developers.google.com/+/web/signin/#revoking_access_tokens_and_disconnecting_the_app
            // http://stackoverflow.com/questions/12809339/how-to-revoke-an-authentication-token-client-side-against-the-google-api
            var token = localStorage['labnote.access_token'];
            delete localStorage['labnote.email'];
            delete localStorage['labnote.access_token'];
            $scope.account_email = null;
            $scope.loggedIn = false;
            $http.defaults.headers.common.Authorization = "";

//            $http.jsonp('https://accounts.google.com/o/oauth2/revoke?token='+token).success(function(r){
//                console.log(r);
//            })
            $http.get('/account/logout',{params: {access_token: token}}).success(function(r){
                console.log(r);
            });
        };

        $scope.backupDB = function(){
            $modal.open({templateUrl: '/public/html/partials/dbBackup.html', scope: $scope, controller: 'DBBackupCtrl'});
        };


        angular.element($window).bind('storage',function(e){
            console.log('storage',e,localStorage);
            $scope.$apply(function(){
                $scope.account_email = localStorage['labnote.email'];
                $scope.loggedIn = !!localStorage['labnote.email'];
                location.reload();
            });

        });

        $scope.$watch('loggedIn',function(nv,ov){
            if(!nv && ov) {
          //      location.reload();
            }
        });

//        var count = 0;
//        var timer = $interval(function(){
//            count += 1;
//            checkLogin();
//        },5000);

        $scope.checkLogin = function(){
            $http.defaults.headers.common.Authorization = "OAuth2 " +  localStorage['labnote.access_token'];
            $http({url: '/account/loginStatus',method:'GET'}).success(function(r){
                console.log(r);
                if(r.logged_in){
                    $scope.account_email = r.email;
                    $scope.loggedIn = true;
                }else{
                    $scope.account_email = null;
                    $scope.loggedIn = false;
                }
            });
        };

        //Selection change or content change

        $scope.$watch('selectedItem.sample', function (nv, ov) {
            SampleDataSvc.change(nv, ov);
        }, true);
        $scope.$watch('selectedItem.type', function (nv, ov) {
            TypeDataSvc.change(nv, ov);
        }, true);

        $scope.alert = listViewSvc.alert;
        $scope.messageHistory = [];
        $scope.showMessage = function(msg,type) {
            type = type || "success";
            $scope.messageHistory.push({message: msg, type: type});
            $scope.alert.shown = true;
            $scope.alert.type = type
            $scope.alert.msg = msg;
            $timeout.cancel($scope.alertId);
            $scope.alertId = $timeout(function(){
                $scope.alert.shown = false;
                $scope.alert.msg = '';
            },3000);
        };
        $scope.pageTitle = listViewSvc.pageTitle;

        $scope.pageTitle.value = 'Labnotebook';

        init();


    }]);

expsApp.controller('MainMenuCtrl', ['$scope', '$http', 'listViewSvc', function ($scope, $http, listViewSvc) {
    $scope.items = [
        'The first choice!',
        'And another choice for you.',
        'but wait! A third!'
    ];

    $scope.status = {
        isopen: false
    };

    $scope.toggled = function(open) {
        console.log('Dropdown is now: ', open);
    };

    $scope.toggleDropdown = function($event) {
        $event.preventDefault();
        $event.stopPropagation();
        $scope.status.isopen = !$scope.status.isopen;
    };
}]);

expsApp.controller('DBBackupCtrl',['$scope', '$http', function($scope,$http){
    var init = function(){

    };

    init();


    $scope.downloadDB = function(){
        $scope.$close();
        window.open('/account/database?access_token='+localStorage['labnote.access_token']);
    };
    $scope.exportDB = function(){
        $scope.$close();
        $http.get('/account/export_database');
    };
    $scope.emailDB = function(){
        $scope.$close();
        $http.get('/account/email_database');
    };
}]);



expsApp.controller('itemListCtrl', ['$scope', '$http', 'listViewSvc', function ($scope, $http, listViewSvc) {


    $scope.showList = listViewSvc.showList;
    $scope.selectedItem = listViewSvc.selectedItem;

    $scope.addExp = function () {
        $.ajax('/exps', {method: 'POST', data: $.param({name: 'New exp'}), success: function (r) {
            console.log(r);
            if (r) {
                $scope.$apply(function () {
                    $scope.exps.push({id: r.id, title: r.name});
                });
                console.log($scope.exps);
            }
        }});
    };
    $scope.newSubItem = listViewSvc.newSubItem;
    $scope.deleteTypeItem = listViewSvc.deleteTypeItem;

}]);

expsApp.controller('EmptyDetailCtrl', [function () {
}]);

findIndex = function(vs, id) {
    var len = vs.length;
    for (var i = 0; i < len; i++) {
        if (vs[i].id == id)
            return i;
    }
    return -1;
}

showGet = function(url){
    $.get(url,function(r){console.log(r);});
    return null;
}