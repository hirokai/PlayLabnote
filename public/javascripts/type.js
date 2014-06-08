expsApp.factory('TypeData',['$resource',function($resource){
    //Just add title.
    var readData = function (str) {
        var obj = JSON.parse(str);
        return [mkTreeData(obj)];
    };

    return $resource('/types.json',{}, {
        getAll: {method: 'GET', params: {}, isArray: true, transformResponse: readData}
    });
}]);

expsApp.factory('TypeDataSvc',['$http', 'listViewSvc', function($http, listViewSvc){
    return {
        hello: function(){
            console.log('hello');
        },
        change: function(nv,ov) {
            console.log('type may have changed.')
            if(ov.id && nv.id == ov.id && !_.isEqual(nv,ov)){
                //This means not selection, but content is changed.

                console.log('item content changed.',nv,ov);
                $http({url: '/types/'+nv.id, method: 'PUT',data: $.param({name: nv.title})}).success(function(r){
                    if(r.success){
                        var ts = flattenTree(listViewSvc.types)
                        var t = findInTree(ts[0][0],r.data.id);
                        t.title = r.data.name;
                    }
                    console.log(r.data);
                });
            }else{
                console.log('item selection changed.',nv);
            }
        }
    };
}]);


var mkTreeData = function (d) {
    return {id: d.node.id, title: d.node.name, nodes: _.map(d.children, function (n) {
        return mkTreeData(n);
    })};
};

var flattenTree = function (t) {
    return [
        t
    ].concat(_.flatten(_.map(t.nodes, flattenTree)));
}

var diffChange = function (newval, oldval) {
    var vs1 = flattenTree(newval);
    var vs2 = flattenTree(oldval);
    var vs1_2 = _.filter(vs1, function (obj) {
        return !_.findWhere(vs2, obj);
    });
    var vs2_1 = _.filter(vs2, function (obj) {
        return !_.findWhere(vs1, obj);
    });
    return {added: vs1_2, removed: vs2_1};
};

var findInTree = function(tree,id){
//    console.log(tree,id);
    if(tree.id == id){
        return tree;
    }else{
        try{
            var res = null;
            _.map(tree.nodes,function(tree){
                res = findInTree(tree,id);
                if(res) throw "Found.";
            });
        }catch(e){
            return res;
        }
        return null;
    }
}