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
            scriptTag.src = '//cdnjs.cloudflare.com/ajax/libs/d3/3.4.8/d3.min.js';
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

    }])
    .controller('PStepParamCtrl',['$scope','$http', function($scope, $http){
        $scope.units = unitList;

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
                                    scope.selectedPSteps.push(getPStep(id));
                                }else{
                                    var pstep = getPStep(scope.selection_edge_id);
                                    if(pstep){
                                        scope.sel_edge_ids = [scope.selection_edge_id];
                                        scope.selectedPSteps.length = 0;
                                        scope.selectedPSteps.push(pstep);
                                        scope.selectedPSamples.length = 0;
                                    }else{
                                        console.log('pstep not found: '+id);
                                    }
                                }
                                scope.render();
                            });
                        });

                        scope.graphZoom = scope.graphZoom || {};
                        var el = $('svg');
                        if(scope.autoZoom.val){
                            scope.graphZoom.scale = getDefaultScale(layout,el.width(),el.height());
                            scope.graphZoom.translate = getDefaultTranslate(layout);
                        }else{
                            scope.graphZoom.scale = scope.graphZoom.scale || getDefaultScale(layout,el.width(),el.height());
                            scope.graphZoom.translate = scope.graphZoom.translate || getDefaultTranslate(layout);
                        }
                        var scale = scope.graphZoom.scale;
                        var translate = scope.graphZoom.translate;

                        // https://github.com/cpettitt/dagre-d3/issues/27#issuecomment-36707912
                        var w = layout.graph().width + 40;
                        var h = layout.graph().height + 40;
                        svg
                           // .attr("width", layout.graph().width + 40)
                           // .attr("height", layout.graph().height + 40)
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
//                        if(nv.length = 1){
//                            scope.graphZoom.scale = 1;
//                            scope.graphZoom.translate = [0,0];
//                        }
                        scope.render();
                    },true);

                    scope.$watch('shrinkNodes.val',function(nv,ov){
                       if(nv == ov) return;
                       scope.render();
                    });

                    scope.autoZoom = {val: true};

                    scope.selectNone = function(){
                        scope.selectedPSamples.length = 0;
                        scope.selectedPSteps.length = 0;
                    };

                    scope.selectDelta = function(delta){
                        var findIndexOfEntity = function(vs,id,isSample){
                            for(var i=0;i<vs.length;i++){
                                if(vs[i].id == id){
                                    if((vs[i].typ && isSample) || (vs[i].params && !isSample))
                                        return i;
                                }
                            }
                            return -1;
                        };
                        var cycle = function(v,from,until){
                          if(v < from) return until - 1;
                          else if(v >= until) return from;
                          else return v;
                        };

                        var sel = scope.selectedEntities[0];
                        sel = sel || scope.item.protocolSamples[0];
                        if(!sel) return;

                        var objs = scope.allEntities;
                        var idx = findIndexOfEntity(objs, sel.id,!!sel.typ);
                        console.log(sel,idx,objs.length);

                        if(idx >= 0){
                            var new_idx = cycle(idx+delta,0,objs.length);
                            var e = objs[new_idx];
                            if(e.typ){
                                scope.selectedPSamples.length = 0;
                                scope.selectedPSteps.length = 0;
                                scope.selectedPSamples.push(e);
                            }else{
                                scope.selectedPSamples.length = 0;
                                scope.selectedPSteps.length = 0;
                                scope.selectedPSteps.push(e);
                            }
                        }
                    };

                    scope.selectNext = function(){
                        scope.selectDelta(1);
                    };
                    scope.selectPrev = function(){
                        scope.selectDelta(-1);
                    };

                    scope.connectNodes = function(){
                        var id = scope.item.id;
                        var name = 'Step ' + (scope.item.protocolSteps.length + 1);
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

                    scope.addNextOrPrevStep = function(which){
                        if(which != 'next' && which != 'prev') return;

                        var eid = scope.item.id;
                        var s = scope.selectedPSamples[0];
                        if(eid && s){
                            var sname = 'Sample ' + (scope.item.protocolSamples.length + 1);
                            $http({url: '/exps/'+eid+'/psamples', method: 'POST', data: $.param({name: sname,type: s.typ.id})}).success(function(r){
                                console.log(r);
                                var obj = {name: 'Step '+(scope.item.protocolSteps.length+1)};
                                if(which == 'next'){
                                    obj.input = s.id; obj.output = r.data.id;
                                }else if(which == 'prev'){
                                    obj.output = s.id; obj.input = r.data.id;
                                }
                                $http({url: '/exps/'+eid+'/psteps', method: 'POST', data: $.param(obj)}).success(function(r2){
                                    scope.item.protocolSamples.push(r.data);
                                    scope.item.protocolSteps.push(r2.data);
                                    scope.selectPSample(scope.getPSample(r.data.id));
                                    scope.render();
                                }).error(function(r2){

                                    });
                            });
                        }
                    };

                    scope.addNextStep = function(){
                        scope.addNextOrPrevStep('next');
                    };

                    scope.addPrevStep = function(){
                        scope.addNextOrPrevStep('prev');
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
                                    scope.showMessage("Failed to delete step.","danger");
                                });
                        });
                    };

                    scope.editingParams = false;





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
                        scope.newInputOrOutput('input');
                    };

                    scope.newOutput = function(){
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

                    scope.addInput = function(){scope.addInputOrOutput('input');};
                    scope.addOutput = function(){scope.addInputOrOutput('output');};

                    scope.addInputOrOutput = function(which) {
                        if(which != 'input' && which != 'output') return;

                        var step = scope.selectedPSteps[0];
                        var samples = scope.selectedPSamples;

                        // From: http://stackoverflow.com/a/17511398/1461206.
                        // This keeps reference of step.input intact, which is important for watching variables.
                        var sids = _.uniq(step[which].concat(_.map(samples,function(s){return s.id;})));
                        Array.prototype.splice.apply(step[which], [0, sids.length].concat(sids));

                        $http({url: '/psteps/'+ step.id, method: 'PUT', data: $.param({input: step.input.join(':'), output: step.output.join(':')})}).success(function(r2){
                            scope.render();
                            console.log(r2);
                        }).error(function(r2){
                                console.log(r2);
                                scope.showMessage('Error occured.','danger');
                            });
                    }

                    scope.clickStepSample = function(sid){
                        scope.selectPSample(scope.getPSample(sid));
                    }

                    scope.getPSample = function(id){
                        return _.findWhere(scope.item.protocolSamples,{id:id});
                    };

                    scope.resetZoom = function(){
                        var el = $('svg');
                        scope.graphZoom.scale = getDefaultScale(scope.layout,el.width(),el.height());
                        scope.graphZoom.translate = getDefaultTranslate(scope.layout);
                        scope.render();
                    };

                    scope.$watchCollection('item.protocolSamples',function(nv,ov){
                        scope.allEntities = scope.item.protocolSamples.concat(scope.item.protocolSteps);
                    });
                    scope.$watchCollection('item.protocolSteps',function(nv,ov){
                        scope.allEntities = scope.item.protocolSamples.concat(scope.item.protocolSteps);
                    });

                    scope.selectedEntities = [];

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

                    scope.$watch('selectedPSteps[0].name',function(nv,ov){
                        if(_.isEqual(nv,ov) || !ov)return;
                        if(_.trim(nv)==''){
                            scope.selectedPSteps[0].name = ov;
                            scope.showMessage('Empty name cannot be used.','warning');
                            return;
                        }
                        var id = scope.selectedPSteps[0].id;
                        $http({url: '/psteps/'+id, method: 'PUT', data: $.param({name: nv})});
                    },true);

                    scope.$watch('sel_ids',function(nv,ov){
                        if(_.isEqual(nv,ov) || !ov)return;
                        console.log(nv);
//                        scope.render();
                    },true);

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
    console.log(layout._nodes);
//    if(layout._nodes.length <= 1){
//        console.log('No node.');
//        return 1;
//    }
    svg_w = svg_w || 300;
    svg_h = svg_h || 500;
    var ranks = _.map(layout._nodes,function(n){return n.value.rank;});
    var orders = _.map(layout._nodes,function(n){return n.value.order;});
    var xs = _.map(layout._nodes,function(n){return n.value.x;});
    var ys = _.map(layout._nodes,function(n){return n.value.y;});
//    console.log(ranks,xs,ys);
    var width = function(vs) {return (vs && vs.length > 0) ? _.max(vs) - _.min(vs) : 0;};
//    var xscale = 300 / width(xs) + 0.1;
//    var yscale = 500 / width(ys) + 0.1;
    var factor_x = svg_w/130, factor_y = svg_h/45;
    console.log(layout,svg_w,svg_h,factor_x,factor_y);
    var scale = Math.min(factor_x*75/(width(xs)+1),factor_y*35/(width(ys)+1));
//    var scale = Math.min(factor_x/(width(orders)+1),factor_y/(width(ranks)+1));
    console.log(scale);
    return Math.max(Math.min(scale,2),0.2);
}

var getDefaultTranslate = function(layout){
    return [30,30];
}

var mkProtocolGraph = function(exp,shrink){
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