var expsApp = angular.module('expsApp', ['editableTitleModule', 'ui.bootstrap', 'ui.tree', 'ui.router','myGraph']);

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

expsApp.run(['$window',function($window){

}]);

expsApp.config(['$stateProvider', '$urlRouterProvider', '$httpProvider', function($stateProvider, $urlRouterProvider,$httpProvider){
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
//                    template: $templateCache.get('public/html/partials/exp_detail.html'),
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

    $httpProvider.defaults.headers.common.Authorization = "OAuth2 " +  localStorage['labnote.access_token'];

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

_.mixin(_.str.exports());


unitList = [
    {value: 'text', name: 'Text', typ: 'text', unit: '-'},
    {value: 'L', name: 'Volume/L', typ: 'volume', unit: 'L'},
    {value: 'mL', name: 'Volume/mL', typ: 'volume', unit: 'mL'},
    {value: 'uL', name: 'Volume/uL', typ: 'volume', unit: 'uL'},
    {value: 'g', name: 'Mass/g', typ: 'mass', unit: 'g'},
    {value: 'mg', name: 'Mass/mg', typ: 'mass', unit: 'mg'},
    {value: 'ug', name: 'Mass/ug', typ: 'mass', unit: 'ug'},
    {value: 'degC', name: 'Temperature/C', typ: 'temperature', unit: 'degC'}
];



//
// Google Drive
//

// https://developers.google.com/accounts/docs/OAuth2UserAgent?hl=ja#handlingtheresponse

var clientId = '599783734738-c8a62sjqes2a2j1sai58a7akn7e1j55h.apps.googleusercontent.com';

chooseGDrive = function(){
    var scopes = 'https://www.googleapis.com/auth/drive.file openid';
    gapi.auth.authorize({client_id: clientId, scope: scopes, immediate: false}, loadPicker);
}

var access_token;

loadPicker = function(auth) {
    console.log(auth);
    access_token = auth.access_token;
    var url = 'https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + access_token;
    $.post(url).success(function(r){
        console.log(r);
        if(r.audience == clientId){
            console.log('Token verified.');
            gapi.load('picker', {'callback': createPicker});
        }else{
            console.log('token is invalid!!!');
        }
    })

}

// Use your own API developer key.
var developerKey = 'AIzaSyBWQOGSOkQfRiqoaFz41MG7N1TtY1EJUHI';

// Create and render a Picker object for searching images.
function createPicker() {
    var view = new google.picker.View(google.picker.ViewId.DOCS);
 //   view.setMimeTypes("image/png,image/jpeg,image/jpg");
    var picker = new google.picker.PickerBuilder()
        .enableFeature(google.picker.Feature.NAV_HIDDEN)
        .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
        .setAppId('599783734738-c8a62sjqes2a2j1sai58a7akn7e1j55h.apps.googleusercontent.com')
        .setOAuthToken(access_token)
        .addView(view)
        .addView(new google.picker.DocsUploadView())
        .setDeveloperKey(developerKey)
        .setCallback(pickerCallback)
        .build();
    picker.setVisible(true);
}

// A simple callback implementation.
function pickerCallback(data) {
    if (data.action == google.picker.Action.PICKED) {
        var fileId = data.docs[0].id;
        alert('The user selected: ' + fileId);
    }
}