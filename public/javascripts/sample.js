expsApp.factory('SampleData',['$resource',function($resource){
    //Just add title.
    var readData = function (str) {
        var es = JSON.parse(str);
        return _.map(es, function (e) {
            e.title = e.name;
            return e;
        });
    };

    return $resource('/samples.json',{}, {
        getAll: {method: 'GET', params: {}, isArray: true, transformResponse: readData}
    });
}]);

expsApp.factory('SampleDataSvc',['$http', 'listViewSvc', function($http, listViewSvc){
    return {
        hello: function(){
            console.log('hello');
        },
        change: function(nv,ov) {
            if(ov.id && nv.id == ov.id && !_.isEqual(nv,ov)){
                //This means not selection, but content is changed.

                console.log('item content changed.',nv,ov);
                $http({url: '/samples/'+nv.id, method: 'PUT',data: $.param({name: nv.title})}).success(function(r){
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