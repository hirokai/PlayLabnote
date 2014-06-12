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
                        var getPStep = function(id){
                            return _.findWhere(scope.item.protocolSteps,{id:id});
                        }
                                                                        //scope.sel_ids = _.map(scope.selection,function(s){return s.id;});
                        var renderer = new dagreD3.Renderer(d3,scope.sel_ids || [],scope.sel_edge_ids || []);
                        console.log('rendering!!',svg,renderer);

                        var graph = mkProtocolGraph(scope.item,scope.shrinkNodes.val);

                      //  svg.selectAll('*').remove();
                        var g = svg.select('g.dagre');
                       // if(g.length == 0)
                        if(!g[0][0])
                            g = svg.append('g').attr('class', 'dagre');
                        var layout = renderer.run(graph, g);
                        svg.selectAll('g.node').on('click',function(id){
                            scope.selection_id = id;
                            scope.$apply(function(){
                                var adding = d3.event.metaKey;
                                if(adding){
                                    scope.sel_ids = scope.sel_ids || [];
                                    scope.sel_ids.push(scope.selection_id);
                                    scope.sel_ids = _.uniq(scope.sel_ids);
                                    scope.$parent.selectedPSamples = _.map(scope.sel_ids,getPSample);
                                }else{
                                    scope.$parent.selectedPSteps = [];
                                    scope.$parent.selectedPSamples = [getPSample(scope.selection_id)];
                                }
                                scope.render();
                            });
                        });
                        svg.selectAll('g.edgeLabel').on('click',function(id){
                            console.log('edge clicked', id);
                            scope.selection_edge_id = id;
                            scope.$apply(function(){
                                var adding = d3.event.metaKey;
                                if(adding){
                                    scope.sel_edge_ids = scope.sel_edge_ids || [];
                                    scope.sel_edge_ids.push(scope.selection_edge_id);
                                    scope.sel_edge_ids = _.uniq(scope.sel_edge_ids);
                                    scope.$parent.selectedPSteps = _.map(scope.sel_edge_ids,getPStep);
                                }else{
                                    scope.sel_edge_ids = [scope.selection_edge_id];
                                    scope.$parent.selectedPSteps = [getPStep(scope.selection_edge_id)];
                                    scope.$parent.selectedPSamples = [];
                                }
                                scope.render();
                            });
                        });
                    };
                    scope.$watch('item.protocolSamples',function(nv,ov){
                        if(_.isEqual(nv,ov))return;
                        scope.render();
                    },true);

                    scope.$watch('shrinkNodes.val',function(nv,ov){
                       scope.render();
                    });

                    scope.selectNone = function(){
                        scope.$parent.selectedPSamples = [];
                        scope.$parent.selectedPSteps = [];
                    }

                    scope.connectNodes = function(){
                        var id = scope.item.id;
                        var name = 'Step 1';
                        var from = scope.selectedPSamples[0].id;
                        var to = scope.selectedPSamples[1].id;
                        var req = {url: '/exps/'+id+'/psteps',method:'POST',data: $.param({name: name, input: from, output: to})};
                        console.log(req);
                      $http(req).success(function(r){
                          console.log(r);
                            scope.render();
                      }).error(function(r){
                              console.log(r);
                          });
                    };
                    scope.$watch('selectedPSamples',function(nv,ov){
                        if(_.isEqual(nv,ov))return;
                        console.log(nv);
                        scope.sel_ids = _.map(nv,function(n){return n.id;});
                        if(scope.selectedPSamples.length == 1 && scope.selectedPSteps.length == 0){
                            scope.selectedPSampleOrPStep = scope.selectedPSamples[0];
                        }else{
                            scope.selectedPSampleOrPStep = null;
                        }
                        scope.render();
                    },true);
                    scope.$watch('selectedPSteps',function(nv,ov){
                        if(_.isEqual(nv,ov))return;
                        console.log(nv);
                        scope.sel_edge_ids = _.map(nv,function(n){return n.id;});
                        if(scope.selectedPSteps.length == 1 && scope.selectedPSamples.length == 0){
                            scope.selectedPSampleOrPStep = scope.selectedPSteps[0];
                        }else{
                            scope.selectedPSampleOrPStep = null;
                        }
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

var isIntermediate = function(ps){
    return _.contains(ps.role,"input") && _.contains(ps.role,"output");
}

var mkProtocolGraph = function(exp,shrink){
    console.log(exp);
    var graph = new dagreD3.Digraph();
    _.map(exp.protocolSamples,function(ps){
        var l = (shrink && isIntermediate(ps)) ? '' : ps.name;
        graph.addNode(ps.id, {label: l, custom_id: ps.id});
    });
    _.map(exp.protocolSteps,function(step){
        var pairs = _.zip(step.input,step.output);
        _.map(pairs,function(p){
            graph.addEdge(step.id, p[0], p[1], {label: step.name, custom_id: step.id});
        })
    });
    return graph;
}