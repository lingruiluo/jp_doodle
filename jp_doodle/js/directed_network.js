/*

JQuery plugin helper for directed network layout.

Requires gd_graph and requirements to be loaded.

Structure follows: https://learn.jquery.com/plugins/basic-plugin-creation/

*/
"use strict";

(function($) {

    const LAYOUT_RELAX = "relax";
    const LAYOUT_SKELETON = "skeleton";
    const LAYOUT_GRID = "grid";

    $.fn.directed_network = function (options, element) {

        element = element || this;

        class NetworkVisualization {
            // Control logic for displaying a directed network visualization.

            constructor(options, element) {
                this.settings = $.extend({
                    canvas_size: 700,
                    info_height:150,
                    selector_size: 90,
                    sidebar_size: 150,
                    gap: 10,
                    min_color: "#00f",
                    min_threshold_color: "#555",
                    max_threshold_color: "#666",
                    max_color: "orange",
                    default_layout: LAYOUT_SKELETON,
                    separator_radius: 6,
                    link_radius: 1,
                    min_change: 1,
                    undo_limit: 10,
                }, options);
                this.element = element;
                this.data_graph = new DirectedGraph();
                this.undo_stack = [];
                this.full_context = null;
                this.make_scaffolding();
                this.current_illustrations = null;
            };

            display_all() {
                // show all nodes and edges in the data graph
                var dg = this.data_graph;
                var k2e = $.extend({}, dg.key_to_edge);
                var p = {};
                var n2n = dg.name_to_node
                var positioned = true;
                for (var name in dg.name_to_node) {
                    var position = n2n[name].settings.position;
                    positioned = ((positioned) && (position))
                    p[name] = position;
                }
                var context = new NetworkDisplayContext(this, dg, p, k2e);
                if (!positioned) {
                    context.layout();
                }
                this.display_context(context);
            };

            display_context(context) {
                this.undo_stack.push(context);
                while (this.undo_stack.length > this.settings.undo_limit) {
                    this.undo_stack.shift()
                }
                context.display();
            };

            redisplay_top_context() {
                var st = this.undo_stack;
                var ln = st.length;
                if (ln > 0) {
                    var context = st[ln - 1];
                    context.display();
                }
            }

            node(name, options) {
                this.data_graph.node(name, options);
            };

            edge(source_name, destination_name, weight, options) {
                weight = weight || 1;
                this.data_graph.edge(source_name, destination_name, weight, options);
            };

            wiggle() {
                // run animation
                this.current_illustrations.animate_until(20000);
            }

            set_element_size() {
                var s = this.settings;
                var width = s.canvas_size + s.sidebar_size + 3 * s.gap;
                var height = s.canvas_size + s.selector_size + s.info_height + 5 * s.gap;
                this.element.width(width).height(height);
                this.canvas_div.width(s.canvas_size);
                this.canvas_div.height(s.canvas_size);
                this.redisplay_top_context();
            };

            make_scaffolding() {
                var that = this;
                that.element.empty();
                //that.set_element_size();
                var container = $("<div/>").appendTo(that.element);
                var s = that.settings;
                container.css({
                    //"background-color": "#eed",
                    "display": "grid",
                    //"grid-template-columns": `150px ${s.canvas_size}px`,
                    "grid-template-columns": `${s.sidebar_size}px auto`,
                    "grid-template-rows": `auto ${s.info_height}px`,
                    "grid-gap": `${s.gap}`,
                });
                // misc controls on the left
                that.side_controls = $("<div/>").appendTo(container);
                that.side_controls.css({
                    "background-color": "#dfd",
                    "grid-column": "1",
                    "grid-row": "1",
                    "display": "grid",
                    "grid-template-columns": `auto`,
                    "grid-template-rows": `50px auto auto auto auto`,
                    "grid-gap": `${s.gap}`,
                });
                that.side_sliders = $("<div/>").appendTo(that.side_controls);
                //that.side_sliders.html("Size slider");
                that.side_buttons = $("<div/>").appendTo(that.side_controls);
                //that.side_buttons.html("buttons here.")
                that.side_lassos = $("<div/>").appendTo(that.side_controls);
                that.side_lassos.html("Lasso")
                that.side_layout = $("<div/>").appendTo(that.side_controls);
                that.side_layout.html("Layout")
                that.side_lists = $("<div/>").appendTo(that.side_controls);
                that.side_lists.html("List")
                // title and canvas upper right
                that.right_display = $("<div/>").appendTo(container);
                that.right_display.css({
                    "background-color": "#ffd",
                    "grid-column": "2",
                    "grid-row": "1",
                    "display": "grid",
                    "grid-template-columns": `auto`,
                    //"grid-template-rows": `auto ${s.canvas_size}px auto`,
                    "grid-template-rows": `auto auto ${s.selector_size}px `,
                    "grid-gap": `${s.gap}`,
                });
                that.title_div = $("<div/>").appendTo(that.right_display);
                that.title_div.css({
                    "background-color": "#ddd",
                })
                that.title_div.html("title here.");
                that.canvas_div = $("<div/>").appendTo(that.right_display);
                that.canvas_div.width(s.canvas_size);
                that.canvas_div.height(s.canvas_size);
                that.canvas_div.css({"background-color": "#eee"});
                that.canvas_div.html("canvas here.");
                // selection area: threshold, color swatches, match
                that.selection_div = $("<div/>").appendTo(that.right_display);
                //that.selection_div.html("selections here.");
                //that.selection_div.css({"background-color": "yellow"})
                var selector_row_height = s.selector_size * 0.3 - s.gap;
                that.selection_div.css({
                    "background-color": "#dee",
                    "grid-column": "1",
                    "grid-row": "3",
                    "display": "grid",
                    "grid-template-columns": `auto`,
                    //"grid-template-rows": `auto ${s.canvas_size}px auto`,
                    "grid-template-rows": `${selector_row_height} ${selector_row_height} ${selector_row_height} `,
                    "grid-gap": `${s.gap}`,
                });
                that.threshold_div = $("<div/>").appendTo(that.selection_div);
                //that.threshold_div.html("threshold slider here.");
                that.threshold_div.css({
                    "background-color": "#ded",
                    "grid-column": "1",
                    "grid-row": "1",
                    "display": "grid",
                    "grid-template-columns": `40px auto 40px`,
                    //"grid-template-rows": `auto ${s.canvas_size}px auto`,
                    "grid-template-rows": `auto `,
                    "grid-gap": `${s.gap}`,
                });
                // threshhold
                that.threshold_min_display = $("<div>???</div>").appendTo(that.threshold_div)
                that.threshold_slider = $("<div/>").appendTo(that.threshold_div)
                that.threshold_slider.slider({
                    range: true,
                    min: -10,
                    max: +10,
                    values: [-1, 5],
                    step: 0.1,
                    //slide: function() { that.apply_displayed_threshhold(); },
                })
                that.threshold_slider.on("slidechange", function() { that.apply_displayed_threshhold(); })
                that.threshold_max_display = $("<div>???</div>").appendTo(that.threshold_div)
                that.apply_displayed_threshhold();
                // swatches
                that.swatch_div = $("<div/>").appendTo(that.selection_div);
                that.swatch_div.css({
                    "background-color": "#ded",
                    "grid-column": "1",
                    "grid-row": "2",
                    "display": "grid",
                    "grid-template-columns": `auto auto auto auto`,
                    //"grid-template-rows": `auto ${s.canvas_size}px auto`,
                    "grid-template-rows": `auto `,
                    "grid-gap": `${s.gap}`,
                });
                //that.swatch_div.html("swatches here.");
                that.min_swatch = $("<div/>").appendTo(that.swatch_div);
                that.min_swatch.html("Minimum");
                that.min_swatch.css({"background-color": s.min_color, color:"white"});
                
                that.min_threshold_swatch = $("<div/>").appendTo(that.swatch_div);
                that.min_threshold_swatch.html("Low Threshold");
                that.min_threshold_swatch.css({"background-color": s.min_threshold_color, color:"white"});
                
                that.max_threshold_swatch = $("<div/>").appendTo(that.swatch_div);
                that.max_threshold_swatch.html("High Threshold");
                that.max_threshold_swatch.css({"background-color": s.max_threshold_color, color:"white"});
                
                that.max_swatch = $("<div/>").appendTo(that.swatch_div);
                that.max_swatch.html("Maximum");
                that.max_swatch.css({"background-color": s.max_color, color:"white"});
                
                // match area
                that.match_div = $("<div/>").appendTo(that.selection_div);
                that.match_div.css({
                    "background-color": "#ded",
                    "grid-column": "1",
                    "grid-row": "3",
                    "display": "grid",
                    "grid-template-columns": `150px auto`,
                    //"grid-template-rows": `auto ${s.canvas_size}px auto`,
                    "grid-template-rows": `auto `,
                    "grid-gap": `${s.gap}`,
                });
                //that.match_div.html("match input here");
                that.add_button("Match pattern:", that.match_div, function() {that.match_pattern();});
                var match_input_div = $("<div/>").appendTo(that.match_div);
                this.match_input = $('<input type="text" value="*" size="70"/>').appendTo(match_input_div);
                // misc info at the bottom.
                that.info_container = $("<div/>").appendTo(container);
                that.info_container.css({
                    "background-color": "#dff",
                    "grid-column": "1/3",
                    //"grid-column": "2",
                    "grid-row": "2",
                    "grid-template-columns": `auto`,
                    "grid-template-rows": `${s.info_height}`,
                    "grid-gap": `${s.gap}`,
                });
                that.info_display = $("<div/>").appendTo(that.info_container);
                that.info_display.html("Information provided here.")
                that.info_display.css({"overflow": "scroll"})
                that.info_display.height(s.info_height);
                // create side buttons
                var sb = that.side_buttons;
                that.add_button("reset", sb, function() { that.reset(); });
                that.add_button("expand", sb, function() { that.expand(); });
                that.add_button("points at", sb, function() { that.points_at(); });
                that.add_button("indicated by", sb, function() { that.indicated_by(); });
                that.add_button("sources only", sb, function() { that.sources_only(); });
                that.add_button("connected", sb, function() { that.connected(); });
                that.add_button("wiggle", sb, function() { that.wiggle(); });
                that.add_button("undo", sb, function() { that.undo(); });
                // create lassos
                var sl = that.side_lassos;
                that.add_button("focus", sl, function() { that.lasso_focus(); });
                that.add_button("ignore", sl, function() { that.lasso_ignore(); });
                // create layout actions
                var ly = that.side_layout;
                that.add_button("relax (slow)", ly, function() { that.relax_layout(); });
                that.add_button("skeleton (faster)", ly, function() { that.skeleton_layout(); });
                that.add_button("grid (fastest)", ly, function() { that.grid_layout(); });
                // create list actions
                var ls = that.side_lists
                that.add_button("nodes", ls, function() { that.list_nodes(); });
                that.add_button("edges", ls, function() { that.list_edges(); });
                // create sliders
                that.canvas_slider = $("<div/>").appendTo(that.side_sliders);
                that.canvas_slider.slider({
                    min: s.canvas_size * 0.2,
                    max: s.canvas_size * 5,
                    value: s.canvas_size,
                });
                that.canvas_size_display = $("<div/>").appendTo(that.side_sliders);
                that.canvas_size_display.html("?size?");
                var update_slider = function () {
                    s.canvas_size = that.canvas_slider.slider( "value" );
                    that.set_element_size()
                    that.canvas_size_display.html("" + s.canvas_size);
                };
                update_slider();
                that.canvas_slider.on( "slidechange", update_slider );
                // create canvas
                // create selections

                that.set_element_size();
            };

            apply_displayed_threshhold(){
                var that = this;
                var sl = that.threshold_slider;
                var mm = that.threshold_min_display;
                var MM = that.threshold_max_display;
                var values = sl.slider("values");
                mm.html("" + values[0]);
                MM.html("" + values[1]);
                // XXX not finished!
            };

            add_button(text, container, click_callback) {
                var button_div = $("<div/>").appendTo(container);
                var button = $('<a href="#">' + text + "</a>").appendTo(button_div);
                button.click(click_callback);
            };

            set_title(text) {
                this.title_div.html(text);
            }

        };

        class NetworkDisplayContext {
            // container for selected nodes with positions and active edges
            constructor(for_visualization, from_graph, active_positions, active_key_to_edge) {
                this.for_visualization = for_visualization;
                this.from_graph = from_graph;
                this.active_positions = active_positions;
                this.active_key_to_edge = active_key_to_edge;
                this.to_graph = this.undirected_graph();
            };
            display() {
                // show this context in the visualization.
                debugger;
                var v = this.for_visualization;
                var vs = v.settings;
                var canvas_container = v.canvas_div;
                var size = vs.canvas_size;
                canvas_container.empty();
                canvas_container.height(size).width(size);
                var canvas_element = $("<div/>").appendTo(canvas_container);
                canvas_element.height(size).width(size);
                var config = {
                    width: size,
                    height: size,
                };
                canvas_element.dual_canvas_helper(config);
                var illustration = this.to_graph.illustrate(canvas_element, {
                    size: size,
                    animation_milliseconds: 10000,
                    autoRelax: false,
                })
                illustration.draw_in_region();
                //illustration.animate_until(20 * 1000);
                illustration.enable_dragging();
                v.current_illustrations = illustration;
            };
            layout(mode) {
                debugger;
                mode = mode || this.for_visualization.settings.default_layout;
                if (mode == LAYOUT_RELAX) {
                    this.to_graph.layout_spokes();
                }
                else if (mode == LAYOUT_SKELETON) {
                    this.to_graph.layout_skeleton(1);
                }
                else if (mode == LAYOUT_GRID) {
                    this.to_graph.rectangular_layout();
                }
                else {
                    throw new Error("bad layout mode: " + layout);
                }
            }
            undirected_graph() {
                // make an undirected graph representing the selected nodes and edges.
                var vs = this.for_visualization.settings;
                var g = jQuery.fn.gd_graph({
                    separator_radius: vs.separator_radius, 
                    link_radius: vs.link_radius, 
                    min_change: vs.min_change,
                });
                for (var node_name in this.active_positions) {
                    var position = this.active_positions[node_name];
                    var node = this.from_graph.name_to_node[node_name];
                    var dnode = g.add_node(node_name);
                    if (position) {
                        dnode.set_position(position);
                    }
                    dnode.settings = $.extend(dnode.settings, node.settings);
                }
                for (var edge_key in this.active_key_to_edge) {
                    var edge = this.from_graph.key_to_edge[edge_key];
                    // 0 weight, allow duplicates
                    var dedge = g.add_edge(edge.source_name, edge.destination_name, 0, true);
                    dedge.arrow(edge.source_name, edge.destination_name, edge.weight, edge.settings);
                }
                return g;
            };
        };
        class DirectedGraph {
            // encapsulation of data for a directed graph.
            constructor(options) {
                this.settings = $.extend({}, options);
                this.name_to_node = {};
                this.key_to_edge = {};
            };
            node(name, options) {
                var n = new DirectedNode(name, options);
                var n2 = this.name_to_node[name];
                if (n2) {
                    n.settings = $.extend(n.settings, n2.settings);
                }
                this.name_to_node[name] = n;
            }
            edge(source_name, destination_name, weight, options) {
                this.node(source_name);
                this.node(destination_name);
                var e = new DirectedEdge(source_name, destination_name, weight, options);
                var k = e.key();
                var e2 = this.key_to_edge[k];
                if (e2) {
                    e.settings = $.extend(e.settings, e2.settings);
                };
                this.key_to_edge[k] = e;
            };
         };
         class DirectedNode {
             // container for node information.
             constructor(name, options) {
                 this.name = name;
                 this.settings = $.extend({}, options);
             };
         };
         class DirectedEdge {
             // container for edge information.
             constructor(source_name, destination_name, weight, options) {
                this.source_name = source_name;
                this.destination_name = destination_name;
                this.weight = weight;
                this.settings = $.extend({}, options);
             };
             key() {
                 return "E" + this.source_name + ":" + this.destination_name;
             };
         };

        return new NetworkVisualization(options, element);
    };

    $.fn.directed_network.example = function(element) {
        var N = element.directed_network();
        N.set_title("A Very Interesting Network.")
        N.node(0);
        N.edge(0, 1);
        N.edge(1, 0);
        N.edge(1, 2);
        N.edge(2, 3);
        for (var i=4; i<16; i++) {
            N.edge(i, i+1, 0.5);
            N.edge(i+1, i, +1.5);
            N.edge(0, i, 1.23, {color: "green"})
        }
        N.display_all();
    };

})(jQuery);