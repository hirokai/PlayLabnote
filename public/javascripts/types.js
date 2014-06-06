var typesApp = angular.module('typesApp', ['ui.tree','typeFilters','editableTitleModule']);


typesApp.controller('typesAppCtrl', function ($scope, $http) {

        $scope.types = data.tree;

        $scope.addType = function () {
            $.post('/types', {name: 'New type'}, function (res) {
//           console.log(res);
                location.reload();
            });
        };

        $scope.treedata = [mkTreeData(data.tree)];

        $scope.removeItem = function (scope) {
            var nodeData = scope.$modelValue;
            $http.get('/samples/of_type/'+nodeData.id, {params: {subtypes: true, countOnly: true}}).then(function(r){
                if(r.data.count == 0){
                    $http({url: '/types/'+nodeData.id, method: 'DELETE'}).then(function (r) {
                        var res = r.data;
                        console.log(res);
                    });
                    scope.remove();
                }
            });
        };

        $scope.selectedItem = {id: data.id};

        $scope.dblClickTree = function(scope){
            console.log(scope);
        }

        $scope.clickTree = function(scope){
            //location.href='/types/'+scope.$modelValue.id
            $scope.selectedItem = scope.$modelValue // {id: scope.$modelValue.id, name: scope.$modelValue.title};
//            console.log($scope.selectedItem);
        }

        $scope.toggle = function(scope) {
            console.log(scope);
            scope.toggle();
        };

        $scope.newSubItem = function (scope) {
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
                if (res.success) {
                    var node = _.findWhere(nodeData.nodes, {id: id});
                    node.id = res.data.id;
                }
            });
        };

        $scope.$watch('selectedItem',function(nv,ov){
            if(nv.id || nv.id == 0){
                $http.get('/samples/of_type/'+nv.id,{params: {subtypes: true}}).then(function(r){
                    $scope.samples = r.data;
                });
            }
            if(nv && nv.id == ov.id && nv.title != ov.title){
                var id = $scope.selectedItem.id;
                $scope.selectedItem.oldTitle = ov.title;
                var url = '/types/'+id;
                $http({url: url, method: 'PUT', data: $.param({name: nv.title})}).then(function(r){
                    if(r.data.success){
                        var t = $scope.selectedItem;
                        t.title = r.data.data.name;
                        t.oldTitle = t.title;
                    }else{
                  //      var t = _.findWhere($scope.types,{id:id});
                  //      t.title = t.oldTitle;
                        location.reload();
                    }
                });
            }
        },true);

  //      $scope.showSubtypes = true;

        $scope.addSample = function(){
            var typ = $scope.selectedItem.id;
            if(typ || typ == 0){
                $http.post('/samples', $.param({name: 'New sample',type: typ})).success(function(r){
                    $scope.samples.push(r.data);
                    console.log($scope.samples);
                });
            }else{
                console.log('not selected');
            }
        };

        $scope.typeFilter = function(sample){
            return $scope.showSubtypes || sample.typ.id == $scope.selectedItem.id;
        }

//        $scope.$watch('treedata',function(nv,ov){
//           var diff = diffChange(nv[0],ov[0]);
//            _.map(diff.added,function(t){
//                $http({url: '/types', method: 'POST',data: $.param({name: t.name})}).then(function(r){
//
//                });
//            })
//        },true);

    });

mkTreeData = function (d) {
    return {id: d.node.id, title: d.node.name, nodes: _.map(d.children, function (n) {
        return mkTreeData(n);
    })};
};

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

var flattenTree = function (t) {
    return [
        {id: t.id, title: t.title}
    ].concat(_.flatten(_.map(t.nodes, flattenTree)));
}

var guid = (function () {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }

    return function () {
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
            s4() + '-' + s4() + s4() + s4();
    };
})();


