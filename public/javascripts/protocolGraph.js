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
    .controller('PStepParamCtrl',['$scope','$http', function($scope, $http){
        $scope.units = [
            {value: 'text', name: 'Text', typ: 'text', unit: '-'},
            {value: 'L', name: 'Volume/L', typ: 'volume', unit: 'L'},
            {value: 'mL', name: 'Volume/mL', typ: 'volume', unit: 'mL'},
            {value: 'uL', name: 'Volume/uL', typ: 'volume', unit: 'uL'},
            {value: 'g', name: 'Mass/g', typ: 'mass', unit: 'g'},
            {value: 'mg', name: 'Mass/mg', typ: 'mass', unit: 'mg'},
            {value: 'ug', name: 'Mass/ug', typ: 'mass', unit: 'ug'},
            {value: 'degC', name: 'Temperature/C', typ: 'temperature', unit: 'degC'}
        ];

        $scope.getParamUnitName = function(type_unit){
            return _.findWhere($scope.units,{value: type_unit}).name;
        }
        var unit = $scope.param.unit == '' ? '-' : $scope.param.unit;
        var obj = _.findWhere($scope.units,{typ: $scope.param.typ, unit: unit});
        $scope.param.type_unit = obj ? obj.value : null;

        $scope.$watch('param.type_unit',function(nv,ov){
            console.log(nv);
            if(nv && ov && nv != ov){
                var v = _.findWhere($scope.units,{value: nv});
                if(v){
                    $scope.param.typ = v.typ;
                    $scope.param.unit = v.unit;
                    $http({url: '/pparams/'+$scope.param.id, method: 'PUT', data: $.param({type: v.typ, unit: v.unit})}).success(function(r){
                        console.log(r);
                    })
                }else{
                    console.log('Mapping missing.');
                }
            }
        });
        $scope.$watch('param.name',function(nv,ov){
            console.log(nv);
            if(nv && ov && nv != ov){
                $http({url: '/pparams/'+$scope.param.id, method: 'PUT', data: $.param({name: nv})}).success(function(r){
                    console.log(r);
                }).success(function(r){
                        console.log(r);
                    });
            }
        });
    }])
    .directive('protocolGraph', ['d3Service', '$http', '$timeout', '$q', function(d3Service,$http,$timeout,$q) {
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

                       console.log('rendering');

                        var graph = mkProtocolGraph(scope.item,scope.shrinkNodes.val);

                      //  svg.selectAll('*').remove();
                        var g = svg.select('g.dagre');
                       // if(g.length == 0)
                        if(!g[0][0])
                            g = svg.append('g').attr('class', 'dagre');
                        var layout = renderer.run(graph, g);
                        scope.layout = layout;
                        svg.selectAll('g.node').on('click',function(id){
                            scope.selection_id = id;
                            scope.$apply(function(){
                                var adding = d3.event.metaKey;
                                scope.selectPSample(getPSample(id),adding);
//                                if(adding){
//                                    scope.sel_ids = scope.sel_ids || [];
//                                    scope.sel_ids.push(scope.selection_id);
//                                    scope.sel_ids = _.uniq(scope.sel_ids);
//                                    scope.$parent.selectedPSamples = _.map(scope.sel_ids,getPSample);
//                                }else{
//                                    scope.$parent.selectedPSteps = [];
//                                    scope.$parent.selectedPSamples = [getPSample(id)];
//                                }
                                scope.render();
                            });
                        });
                        svg.selectAll('g.edgeLabel').on('click',function(idstr){
                            var id = parseInt(idstr.split(":")[0]);
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
                                    var pstep = getPStep(scope.selection_edge_id);
                                    if(pstep){
                                        scope.sel_edge_ids = [scope.selection_edge_id];
                                        scope.$parent.selectedPSteps = [pstep];
                                        scope.$parent.selectedPSamples = [];
                                    }else{
                                        console.log('pstep not found: '+id);
                                    }
                                }
                                scope.render();
                            });
                        });

                        scope.graphZoom = scope.graphZoom || {};
                        var el = $('svg');
                        scope.graphZoom.scale = scope.graphZoom.scale || getDefaultScale(layout,el.width(),el.height());
                        scope.graphZoom.translate = scope.graphZoom.translate || getDefaultTranslate(layout);
                        var scale = scope.graphZoom.scale;
                        var translate = scope.graphZoom.translate;

                        // https://github.com/cpettitt/dagre-d3/issues/27#issuecomment-36707912
                        svg.attr("width", layout.graph().width + 40)
                            .attr("height", layout.graph().height + 40)
                            .call(d3.behavior.zoom().scaleExtent([0.2, 2]).scale(scale).translate(translate).on("zoom", function() {
                                var ev = d3.event;
                                scope.graphZoom.scale = ev.scale;
                                scope.graphZoom.translate = ev.translate;
                                svg.select("g")
                                    .attr("transform", "translate(" + ev.translate + ") scale(" + ev.scale + ")");
                            }));
                        svg.select('g').attr("transform","translate("+translate+") scale("+scale+")");
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
                          scope.item.protocolSteps.push(r.data);
                          scope.render();
                      }).error(function(r){
                          console.log(r);
                      });
                    };

                    scope.addNextStep = function(){
                        var eid = scope.item.id;
                        var s = scope.selectedPSamples[0];
                        if(eid && s){
                            $http({url: '/exps/'+eid+'/psamples', method: 'POST', data: $.param({name: 'Sample',type: s.typ.id})}).success(function(r){
                                console.log(r);
                                $http({url: '/exps/'+eid+'/psteps', method: 'POST', data: $.param({name: 'Step',input: s.id, output: r.data.id})}).success(function(r2){
                                    scope.item.protocolSamples.push(r.data);
                                    scope.item.protocolSteps.push(r2.data);
                                    scope.selectedPSamples.length = 0;
                                    scope.selectedPSamples.push(r.data);
                                    scope.render();
                                }).error(function(r2){

                                    });
                            });
                        }
                    };

                    scope.addPrevStep = function(){
                        var eid = scope.item.id;
                        var s = scope.selectedPSamples[0];
                        if(eid && s){
                            $http({url: '/exps/'+eid+'/psamples', method: 'POST', data: $.param({name: 'Sample',type: s.typ.id})}).success(function(r){
                                console.log(r);
                                $http({url: '/exps/'+eid+'/psteps', method: 'POST', data: $.param({name: 'Step',output: s.id, input: r.data.id})}).success(function(r2){
                                    scope.item.protocolSamples.push(r.data);
                                    scope.item.protocolSteps.push(r2.data);
                                    scope.selectedPSamples.length = 0;
                                    scope.selectedPSamples.push(r.data);
                                    scope.render();
                                }).error(function(r2){

                                    });
                            });
                        }
                    };

                    scope.deletePSamples = function(){
                        var ids = _.map(scope.selectedPSamples,function(s){return s.id;});
                        var promises = _.map(ids,function(id){
                            return $http({url: '/psamples/'+id,method: 'DELETE'});
                        });
                        console.log(promises);
                        $q.all(promises).then(function(rs){
                                var count = _.countBy(rs,function(r){return r.data.success ? 'success' : 'error';});
                                var ids = _.map(_.filter(rs,function(r){return r.data.success;}),function(r){return r.data.id;});
                                console.log(rs,count,ids);
                            _.map(ids,function(id){
                                var idx = findIndex(scope.item.protocolSamples,id);
                                if(idx>=0){
                                    console.log(scope.item);
                                    scope.item.protocolSamples.splice(idx,1);
                                    var steps = scope.item.protocolSteps;
                                    for(var i=steps.length-1;i>=0; i--){
                                        if(steps[i] && _.contains(steps[i].input,id) || _.contains(steps[i].output,id))
                                            steps.splice(i,1);
                                    }
                                }
                            });
                            if(!count.error){
                                scope.showMessage(""+count.success+" sample"+(ids.length > 1 ? 's' : '')+" deleted.");
                            }else if(count.success > 0){
                                scope.showMessage(""+count.success+" sample"+(ids.length > 1 ? 's' : '')+" deleted. " +
                                    count.error+" sample"+(count.error > 1 ? 's were' : ' was')+" not deleted due to error.",'warning');
                            }else{
                                scope.showMessage("Sample"+(count.error > 1 ? 's were' : ' was')+" not deleted.",'danger');
                            }
                            scope.render();
                        });
                    };

                    scope.deleteStep = function(){
                        var ids = _.map(scope.selectedPSteps,function(s){return s.id;});
                        _.map(ids,function(id){
                            $http({url: '/psteps/'+id,method: 'DELETE'}).success(function(r){
                                console.log(r);
                                var idx = findIndex(scope.item.protocolSteps,id);
                                if(idx>=0){
                                    scope.item.protocolSteps.splice(idx,1);

                                }
                                scope.showMessage("Step deleted.");
                                scope.render()
                            }).error(function(r){
                                    console.log(r);
                                });
                        });
                    };

                    scope.editingParams = false;

                    scope.addParam = function(){
                        var id = scope.selectedPSteps[0].id;
                        var name = 'Param';
                        $http({url: '/psteps/'+id+'/params', method: 'POST', data: $.param({name: name, type: 'text'})}).success(function(r){
                            console.log(r);
                            scope.selectedPSteps[0].params.push(r.data);
                            scope.showMessage("Param deleted.");
                        }).error(function(r){
                                console.log(r);
                            });
                    };

                    scope.deleteParam = function(param){
                        var id = param.id;
                        var name = 'Param';
                        $http({url: '/pparams/'+id, method: 'DELETE'}).success(function(r){
                            console.log(r);
                            var params = scope.selectedPSteps[0].params;
                            console.log(params);
                            var idx = findIndex(params,id);
                            if(idx>=0){
                                params.splice(idx,1);
                            }
                            scope.showMessage("Param deleted.");
                        }).error(function(r){
                                console.log(r);
                            });
                    };

                    scope.newInput = function(){
                        console.log('newInput');
                        scope.newInputOrOutput('input');
                    };

                    scope.newOutput = function(){
                        console.log('newOutput');
                        scope.newInputOrOutput('output');
                    };

                    scope.newInputOrOutput = function(which){
                        if(which != 'input' && which != 'output')return;

                        var which_not = which == 'input' ? 'output' : 'input';
                        var eid = scope.item.id;
                        var s = scope.selectedPSteps[0];
                        if(eid && s){
                            console.log(s);
                            var typ = _.findWhere(scope.item.protocolSamples,{id: s[which_not][0]}).typ.id;
                            $http({url: '/exps/'+ eid + '/psamples', method: 'POST', data: $.param({name: 'Sample',type: typ})}).success(function(r){
                                scope.item.protocolSamples.push(r.data);
                                s[which].push(r.id);
                                console.log(r,s);
                                $http({url: '/psteps/'+ s.id, method: 'PUT', data: $.param({input: s.input.join(':'), output: s.output.join(':')})}).success(function(r2){
                                      scope.render();
                                    console.log(r2);
                                }).error(function(r2){
                                        console.log(r2);
                                        scope.showMessage('Error occured.','danger');
                                    });
                            }).error(function(r){
                                    console.log(r);
                                    scope.showMessage('Error occured.','danger');
                                });
                        }
                    };

                    scope.resetZoom = function(){
                        var el = $('svg');
                        scope.graphZoom.scale = getDefaultScale(scope.layout,el.width(),el.height());
                        scope.graphZoom.translate = getDefaultTranslate(scope.layout);
                        scope.render();
                    };

                    scope.$watch('selectedPSamples',function(nv,ov){
                        if(_.isEqual(nv,ov))return;
                        console.log(nv);
                        scope.sel_ids = _.map(nv,function(n){return n.id;});
                        scope.selectedEntities = scope.selectedPSamples.concat(scope.selectedPSteps);
                        scope.render();
                    },true);
                    scope.$watch('selectedPSteps',function(nv,ov){
                        if(_.isEqual(nv,ov))return;
                        console.log(nv);
                        scope.sel_edge_ids = _.map(nv,function(n){return n.id;});
                        scope.selectedEntities = scope.selectedPSamples.concat(scope.selectedPSteps);
                        scope.render();
                    },true);

                    scope.$watch('selectedPSteps[0].params',function(nv,ov){
                        if(_.isEqual(nv,ov))return;
                        console.log(nv);
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

var getDefaultScale = function(layout,svg_w,svg_h){
    svg_w = svg_w || 300;
    svg_h = svg_h || 500;
    var ranks = _.map(layout._nodes,function(n){return n.value.rank;});
    var orders = _.map(layout._nodes,function(n){return n.value.order;});
//    var xs = _.map(layout._nodes,function(n){return n.value.x;});
//    var ys = _.map(layout._nodes,function(n){return n.value.y;});
//    console.log(ranks,xs,ys);
    var width = function(vs) {return _.max(vs) - _.min(vs) + 0.1;};  // + 0.1 to avoid NaN.
//    var xscale = 300 / width(xs) + 0.1;
//    var yscale = 500 / width(ys) + 0.1;
    var factor_x = svg_w/130, factor_y = svg_h/45;
    console.log(layout,svg_w,svg_h,factor_x,factor_y);
    var scale = Math.min(factor_x/(width(orders)+1),factor_y/(width(ranks)+1));
    return Math.max(Math.min(scale,2),0.2);
}

var getDefaultTranslate = function(layout){
    return [0,0];
}

var mkProtocolGraph = function(exp,shrink){
    console.log(exp);
    var graph = new dagreD3.Digraph();
    _.map(exp.protocolSamples,function(ps){
        var l = (shrink && isIntermediate(ps)) ? ' ' : ps.name;
        graph.addNode(ps.id, {label: l, custom_id: ps.id});
    });
    var count = {};
    _.map(exp.protocolSteps,function(step){
        var pairs = directProduct(step.input,step.output);
        _.map(pairs,function(p){
            try{
                if(!count[step.id]) count[step.id] = 0;
                graph.addEdge(step.id+":"+count[step.id], p[0], p[1], {label: step.name, custom_id: step.id});
                count[step.id] += 1;
            }catch(e){
                console.log(e);
            }
        })
    });
    return graph;
}

var directProduct = function(xs,ys){
  return _.flatten(_.map(xs,function(x){
     return _.map(ys,function(y){
        return [x,y];
     });
  }),true);
};