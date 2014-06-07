angular.module('expSamplesModule',[])
    .controller('inputSamplesCtrl',['$scope',function($scope){
        $scope.samples = $scope.expSummary.input;
        $scope.$watch('expSummary.input',function(nv,ov){
            $scope.samples = $scope.expSummary.input;
        },true);
    }])
    .controller('outputSamplesCtrl',['$scope',function($scope){
        $scope.samples = $scope.expSummary.output;
        console.log($scope.samples)
        $scope.$watch('expSummary.output',function(nv,ov){
            $scope.samples = $scope.expSummary.output;
        },true);
    }]);

angular.module('editableTitleModule',[])
    .controller('titleController',['$scope','$timeout',function($scope,$timeout){
        $scope.editTitle = function(){
            $scope.oldTitle = $scope.selectedItem.title;
            $scope.editingTitle = true;
        };
        $scope.keyDownTitle = function($event){
           // console.log(self);
            if($event.keyCode == 13){
                $timeout(function () { $event.target.blur() }, 0, false);
            }
        };
        $scope.handleBlur = function($event){
            $scope.editingTitle = false;
        };
    }]).directive('editableTitle',function(){
        return {
            templateUrl: "/public/html/partial/editableTitle.html"
        };
    })
;

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

angular.module('myGraph',[])
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
          scope: {
              exp: '='
          },
          templateUrl: '/assets/html/protocolGraph.html'
        };
    }]);

/*
angular.module('myGraphOld', ['d3'])
    .controller('protocolGraphCtrl',['$scope',function($scope){

        $scope.msg = "From controller.";
    }])
    .directive('protocolGraph', ['d3Service','$http', '$timeout', function(d3Service,$http,$timeout) {
        return {
            restrict: 'EA',
            scope: {
                data: '=' // bi-directional data-binding
                , exp: '=exp'
            },
            link: function(scope, element, attrs) {
                d3Service.d3().then(function(d3) {
                    scope.$watch('exp', function(newVals, oldVals) {
                        console.log("data changed.")
                        return scope.render(newVals);
                    }, true);

                    var margin = parseInt(attrs.margin) || 20,
                        barHeight = parseInt(attrs.barHeight) || 20,
                        barPadding = parseInt(attrs.barPadding) || 5;



// hard-code data

                    scope.render = function(data) {
                        d3.selectAll('svg').remove();
                        var svg = d3.select(element[0])
                            .append("svg")
                            .style({width: '300px', height: '300px'});

                        console.log(data);

                        // If we don't pass any data, return out of the element
                        if (!data || !data.id) return;

//                        // setup variables
//                        var width = 200,
//                        // calculate the height
//                            height = scope.data.length * (barHeight + barPadding),
//                        // Use the category20() scale function for multicolor support
//                            color = d3.scale.category20(),
//                        // our xScale
//                            xScale = d3.scale.linear()
//                                .domain([0, d3.max(data, function(d) {
//                                    return d.score;
//                                })])
//                                .range([0, width]);
//
//                        // set the height based on the calculations above
//                        svg.attr('height', height);
//
//                        //create the rectangles for the bar chart
//                        svg.selectAll('rect')
//                            .data(data).enter()
//                            .append('rect')
//                            .attr('height', barHeight)
//                            .attr('x', Math.round(margin/2))
//                            .attr('y', function(d,i) {
//                                return i * (barHeight + barPadding);
//                            })
//                            .attr('fill', function(d) { return color(d.score); })
//                            .attr('width', function(d) {
//                                return xScale(d.score);
//                            });
                        var g = svg.append('g').attr('class', 'dagre');
                        var graph = scope.mkDagreGraph(data);
                        var renderer = new dagreD3.Renderer();
                        console.log(g,graph);

                        $timeout(function () { renderer.run(graph, g); }, 0, false);
//                        var layout = renderer.run(graph, g);
//                        console.log(layout);

                    };

                    scope.mkDagreGraph = function(data) {
                        console.log(data);
                        var graph = new dagreD3.Digraph();


                        var samples = data.protocolSamples;
                        var edges = []; //getProtocolEdges(eid);

    console.log(samples,edges);

                        //var shrink = Session.get('exp_graph_shrink');
                        var shrink = false;

                        _.each(samples, function (s) {
                            var l;
                            if(shrink){
                                l = "<div style='padding: 8px;font-size: 14px;' class='id_in_graph' data-id='" + s._id + "'></div>";
                            }else{
                                l = "<div style='padding: 8px;font-size: 14px;' class='id_in_graph' data-id='" + s._id + "'>" + s.name + "</div>";
                            }

                            graph.addNode(s.id, {label: "Node", custom_id: s.id});
                        });
                        _.map(edges, function (e) {
                            graph.addEdge(null, e.from._id, e.to._id, {label: "<div style='padding: 5px;font-size: 14px;' class='id_in_edge' data-id='" + e.id + "'>" + e.name + "</div>", custom_id: e.id});
                        });
                        return graph;
                    };

                    scope.render(scope.data);

                });
            }}
    }]);
*/