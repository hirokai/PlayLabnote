expsApp.factory('SampleDataSvc',['$http', 'listViewSvc', function($http, listViewSvc){
    return {
        hello: function(){
            console.log('hello');
        },
        change: function(nv,ov) {
            if(ov && nv && ov.id && nv.id == ov.id && !_.isEqual(nv,ov)){
                //This means not selection, but content is changed.

                console.log('item content changed.',nv,ov);
                $http({url: '/samples/'+nv.id, method: 'PUT',data: $.param({name: nv.name})}).success(function(r){
                    if(r.success){
                        var e = _.findWhere(listViewSvc.samples,{id: r.data.id});
                        e.name = r.data.name;
                        e.title = r.data.name;
                    }
                    console.log(r.data);
                });
            }else{
                console.log('item selection changed.',nv);
            }
        }
    };
}]);


expsApp.controller('SampleListCtrl', ['$scope', '$state', '$stateParams', 'listViewSvc', function ($scope, $state, $stateParams, listViewSvc) {
    $scope.samples = listViewSvc.samples;
    $scope.selectedItem = listViewSvc.selectedItem;

    console.log('SampleListCtrl loaded.');

    listViewSvc.current.mode = 'sample';
    listViewSvc.current.id = $stateParams.id;
    if(!$stateParams.id){
        listViewSvc.pageTitle.value = 'List of samples - Labnotebook';
    }

    $scope.isSelectedSample = function (id) {
        return id == $stateParams.id
    };
    $scope.selectItem = function (item) {
        listViewSvc.selectedItem.sample = item;
        $state.go('sample_id',{id: item.id});
    };
}]);

expsApp.controller('SampleDetailCtrl', ['$scope', '$http', '$state', '$stateParams', 'listViewSvc', 'SampleDataSvc', function ($scope, $http, $state, $stateParams, listViewSvc, SampleDataSvc) {
    $scope.selectedItem = listViewSvc.selectedItem;

    var id = $stateParams.id;
    if(!id)return;

    console.log('SampleDetailCtrl loaded.');


    $http({url: '/samples/'+id+'.json', method: 'GET'}).success(function(r){
        $scope.item = r;
        console.log($scope.item);
        $scope.loaded = true;
        $http({url: '/samples/'+id+'/exps', method: 'GET'}).success(function(r){
            console.log(r);
            $scope.exps = r.data;
        });

        $scope.loadDataInfo();
        listViewSvc.pageTitle.value = $scope.item.name + ' - Labnotebook';

    });
    $scope.showList = listViewSvc.showList;
    $scope.showDetailJson = listViewSvc.showDetailJson;


    $scope.$watch('item', function (nv, ov) {
        SampleDataSvc.change(nv, ov);
    }, true);

    $scope.isActive = function () {
        return $scope.selectedItem.id || $scope.selectedItem.id == 0;
    }

    $scope.deleteSample = function() {
        var id = $scope.item.id;
        if(id){
            $http({url: '/samples/'+id, method: 'DELETE'}).success(function(r){
                console.log(r);
                if(r.success){
                    var id = r.data.id;
                    var idx = findIndex(listViewSvc.samples, id);
                    console.log(idx, listViewSvc.samples, id);
                    if(idx >= 0){
                        listViewSvc.samples.splice(idx, 1);
                        var samples = listViewSvc.samples[idx];
                        var id = samples ? samples.id : null;
                        $state.go('sample_id',{id: id});
                    }
                }else{
                    $scope.showMessage('Cannot delete sample.');
                }
            });
        }
    };

    $scope.getWhere = function(data) {
      var t = data.typ;
      if(t == 'gdrive'){
          return 'Google Drive';
      }else{
          return t;
      }
    };

    $scope.loadDataInfo = function(){

    }

    $scope.deleteData = function(data){
        $http({url: '/sampledata/'+data.id, method: 'DELETE'}).success(function(r){
            var idx = findIndex($scope.item.data, data.id);
            if(idx >= 0){
                $scope.item.data.splice(idx, 1);
            }
        });
    };

    $scope.addData = function(){
        gapi.load('picker', {'callback': createPicker});

        function createPicker(){
            var view = new google.picker.View(google.picker.ViewId.DOCS);
            //   view.setMimeTypes("image/png,image/jpeg,image/jpg");
            var picker = new google.picker.PickerBuilder()
                .enableFeature(google.picker.Feature.NAV_HIDDEN)
                .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
                .setAppId(clientId)
                .setOAuthToken(localStorage['labnote.access_token'])
                .addView(view)
                .addView(new google.picker.DocsUploadView())
                .setDeveloperKey(developerKey)
                .setCallback(pickerCallback)
                .build();
            picker.setVisible(true);
        }

        function pickerCallback(data) {
            if (data.action == google.picker.Action.PICKED) {
                var fileId = data.docs[0].id;
                _.map(data.docs,function(doc){
                   console.log(doc);
                    var obj = {url: doc.url, name: doc.name, icon: doc.iconUrl, original_id: doc.id};
                    console.log($scope.item);
                   $http({url: '/samples/'+$scope.item.id+'/data', method: 'POST',
                       data: $.param(obj)}).success(function(r){
                           $scope.item.data.push(r.data);
                       });
                });
            }
        }

    }

}]);

