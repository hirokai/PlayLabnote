angular.module('d3', [])
    .factory('d3Service', ['$document', '$q', '$rootScope',
        function($document, $q, $rootScope) {
            var d = $q.defer();
            function onScriptLoad() {
                // Load client in the browser
                $rootScope.$apply(function() { d.resolve(window.d3); });
            }
            // Create a script tag with d3 as the source
            // and call our onScriptLoad callback when it
            // has been loaded
            var scriptTag = $document[0].createElement('script');
            scriptTag.type = 'text/javascript';
            scriptTag.async = true;
            scriptTag.src = 'http://d3js.org/d3.v3.min.js';
            scriptTag.onreadystatechange = function () {
                if (this.readyState == 'complete') onScriptLoad();
            }
            scriptTag.onload = onScriptLoad;

            var s = $document[0].getElementsByTagName('body')[0];
            s.appendChild(scriptTag);

            return {
                d3: function() { return d.promise; }
            };
        }]);


angular.module('myGraph',['d3'])
    .controller('protocolGraphCtrl',['$scope',function($scope){
        //   $scope.nodes = [{},{},{}]; //$scope.exp;
        //   console.log($scope);
        $scope.$watch('exp',function(nv,ov){
            console.log(nv);
            $scope.nodes = [{x: Math.random()*100, y: 100}];
        },true);
        $scope.x = function(scope){
            console.log(scope);
            return Math.random()*100;
        }
        $scope.y = function(scope){
            //console.log(scope);
            return Math.random()*100;
        }
    }])
    .directive('protocolGraph', ['d3Service', '$http', '$timeout', function(d3Service,$http,$timeout) {
        return {
            restrict: 'EA',
            templateUrl: '/public/html/partials/protocolGraph.html',
            link: function(scope,element,attrs){
                d3Service.d3().then(function(d3) {
                    var svg = d3.select('svg');
                    scope.render = function(data) {

                        var getPSample = function(id){
                            return _.findWhere(scope.item.protocolSamples,{id:id});
                        }
                        svg.append('rect').attr({x: 100,y:100,width: 100,height: 100,fill:'black'});
                        //scope.sel_ids = _.map(scope.selection,function(s){return s.id;});
                        var renderer = new dagreD3.Renderer(d3,scope.sel_ids || []);
                        console.log('rendering!!',svg,renderer);

                        var graph = mkProtocolGraph(scope.item);

                        svg.selectAll('*').remove();
                        var g = svg.append('g').attr('class', 'dagre');
                        var layout = renderer.run(graph, g);
                        svg.selectAll('g.node').on('click',function(id){
                            scope.selection_id = id;
                            scope.$apply(function(){
                                var adding = d3.event.metaKey;
                                if(adding){
                                    console.log(scope.sel_ids,scope);
                                    scope.sel_ids = scope.sel_ids || [];
                                    scope.sel_ids.push(scope.selection_id);
                                    console.log(scope.sel_ids,scope);
                                    scope.$parent.selectedPSamples = _.map(scope.sel_ids,getPSample);
                                }else{
                                    scope.$parent.selectedPSamples = [getPSample(scope.selection_id)];
                                }
                                scope.render();
                            });
                        });
                    };
                    scope.$watch('item.protocolSamples',function(nv,ov){
                        if(_.isEqual(nv,ov))return;
                        scope.render();
                    },true);
                    scope.$watchCollection('selectedPSamples',function(nv,ov){
                        if(_.isEqual(nv,ov))return;
                        console.log(nv);
                        scope.sel_ids = _.map(nv,function(n){return n.id;});
                        scope.render();
                    },true);
                    scope.$watch('sel_ids',function(nv,ov){
                        if(_.isEqual(nv,ov) || !ov)return;
                        console.log(nv);
//                        scope.render();
                    },true);
                    scope.$watch('exp',function(nv){
                        console.log(nv);
                        scope.render();
                    });
                    scope.render();
                });
            }
        };
    }])
    .directive('nodeselect',function(){

    });

var mkProtocolGraph = function(exp){
    console.log(exp);
    var graph = new dagreD3.Digraph();
    _.map(exp.protocolSamples,function(ps){
        graph.addNode(ps.id, {label: ps.name, custom_id: ps.id});
    });
    return graph;
}