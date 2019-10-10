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
                    min_threshold_color: "#aaa",
                    max_threshold_color: "#bbb",
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

            display_all(force_layout) {
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
                if ((force_layout) || (!positioned)) {
                    context.layout();
                }
                this.display_context(context);
            };

            display_context(context) {
                this.undo_stack.push(context);
                while (this.undo_stack.length > this.settings.undo_limit) {
                    this.undo_stack.shift()
                }
                this.inform(
                    "Displaying " + hash_length(context.active_positions) + " nodes and " +
                    hash_length(context.active_key_to_edge) + " edges."
                );
                context.display();
            };

            current_context () {
                var st = this.undo_stack;
                return st[st.length - 1];
            };

            redisplay_top_context() {
                var context = this.current_context();
                if (context) {
                    context.display();
                }
            };

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
            };

            trim() {
                // create a new context with nodes having no visible descendants removed.
                this.clear_information();
                this.inform("Trim: removing nodes that don't point to other nodes.")
                var context = this.current_context();
                var nleaves = hash_length(context.leaves);
                if (nleaves <= 0) {
                    this.inform("No leaves to remove.");
                    return;
                }
                this.inform("Removed " + nleaves + " leaves.")
                this.display_context(context.trim());
            };

            connected() {
                // create a new context with nodes with no visible connections removed.
                this.clear_information();
                this.inform("Connected: removing nodes not linked to other nodes.")
                var context = this.current_context();
                var nleaves = hash_length(context.isolated);
                if (nleaves <= 0) {
                    this.inform("No isolated nodes to remove.");
                    return;
                }
                this.display_context(context.connected());
                this.inform("Removed " + nleaves + " isolated nodes.")
            };

            undo() {
                // return to previous context (or reset)
                this.clear_information();
                this.inform("Undo!")
                var st = this.undo_stack;
                st.pop();
                if (st.length > 0) {
                    this.inform("Restoring previous context.");
                    this.redisplay_top_context();
                } else {
                    // display all nodes and recompute layout
                    this.inform("Redisplaying all nodes and edges.");
                    this.display_all(true);
                }
            };

            reset() {
                // reinitialize data structures.
                this.clear_information();
                this.inform("Resetting graph and undo stack.");
                this.undo_stack = [];
                this.display_all(true);
            };

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
                that.canvas_div.css({"background-color": "white"});
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
                that.add_button("Match glob patterns:", that.match_div, function() {that.match_pattern();});
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
                that.add_button("<em>reset</em>", sb, function() { that.reset(); });
                that.add_button("trim leaves", sb, function() { that.trim(); });
                that.add_button("connected", sb, function() { that.connected(); });
                that.add_button("expand", sb, function() { that.expand(); });
                that.add_button("points at", sb, function() { that.points_at(); });
                that.add_button("indicated by", sb, function() { that.indicated_by(); });
                that.add_button("sources only", sb, function() { that.sources_only(); });
                that.add_button("<em>undo</em>", sb, function() { that.undo(); });
                // create lassos
                var sl = that.side_lassos;
                that.add_button("focus", sl, function() { that.lasso_focus(); });
                that.add_button("ignore", sl, function() { that.lasso_ignore(); });
                // create layout actions
                var ly = that.side_layout;
                that.add_button("relax (slow)", ly, function() { that.relax_layout(); });
                that.add_button("skeleton (faster)", ly, function() { that.skeleton_layout(); });
                that.add_button("grid (fastest)", ly, function() { that.grid_layout(); });
                that.add_button("redraw", ly, function() { that.redisplay_top_context(); });
                that.add_button("<em>wiggle</em>", ly, function() { that.wiggle(); });
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
                    that.canvas_size_display.html("side=" + s.canvas_size);
                };
                update_slider();
                that.canvas_slider.on( "slidechange", update_slider );
                this.clear_information();

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
                return button;
            };

            set_title(text) {
                this.title_div.html(text);
            };

            glob_matcher(pattern) {
                // expose glob matcher for testing.
                return new SimpleGlobMatcher(pattern);
            };

            match_pattern () {
                // match the pattern in this.match_input text area
            };

            clear_information() {
                // erase anything in the information area.
                this.info_display.empty();
            };

            inform(html_text) {
                // add information to the information area.
                $("<div>" + html_text + "</div>").appendTo(this.info_display);
            };

        };

        // convenience
        var hash_length = function(hash) {
            // https://stackoverflow.com/questions/8702219/how-to-get-javascript-hash-table-count
            return Object.keys(hash).length;
        };

        class SimpleGlobMatcher {
            "Match glob strings only supporting * wildcard.  Case insensitive."
            // I got annoyed with regular expressions....
            constructor(pattern) {
                pattern = pattern.toUpperCase();
                while (pattern.includes("**")) {
                    pattern = pattern.replace("**", "*");
                }
                this.substrings = pattern.split("*");
            };
            whole_string_match(string) {
                string = "" + string;
                string = string.toUpperCase();
                return this.recursive_match(0, 0, string);
            };
            recursive_match(substring_index, string_index, string) {
                var substrings = this.substrings;
                var nsubstrings = substrings.length;
                var lstring = string.length;
                if ((substring_index >= nsubstrings) && (string_index >= lstring)) {
                    // base case:
                    return true;  // all patterns match
                }
                if ((substring_index < nsubstrings) && (string_index <= lstring)) {
                    var substring = substrings[substring_index];
                    var nsubstring = substring.length;
                    if ((string_index + nsubstring) <= lstring) {
                        var test_match = string.substr(string_index, nsubstring);
                        if (test_match == substring) {
                            var next_substring_index = substring_index + 1;
                            var next_string_index = string_index + nsubstring;
                            // try to match all tails
                            for (var start=next_string_index; start <= lstring; start++) {
                                if (this.recursive_match(next_substring_index, start, string)) {
                                    return true;
                                }
                            }
                        }
                    }
                }
                return false;
            };
        }

        class NetworkDisplayContext {
            // container for selected nodes with positions and active edges
            constructor(for_visualization, from_graph, active_positions, active_key_to_edge) {
                this.for_visualization = for_visualization;
                this.from_graph = from_graph;
                this.active_positions = active_positions;
                this.active_key_to_edge = active_key_to_edge;
                this.to_graph = this.undirected_graph();
                // compute statistics
                this.sources = {};  // visible as source (others may be source in graph)
                this.destinations = {};   //  visible as destination
                this.isolated = {};  // no visible connections.
                this.leaves = {};
                for (var k in active_key_to_edge) {
                    var e = active_key_to_edge[k];
                    this.sources[e.source_name] = e;
                    this.destinations[e.destination_name] = e;
                }
                for (var name in this.destinations) {
                    if (!this.sources[name]) {
                        this.leaves[name] = this.destinations[name] || true;
                    }
                }
                for (var name in active_positions) {
                    if ((!this.sources[name]) && (!this.destinations[name])) {
                        this.isolated[name] = active_positions[name] || true;
                        this.leaves[name] = active_positions[name] || true;
                    }
                }
            };
            restriction(include_node_map, exclude_node_map) {
                // context with included nodes but not excluded nodes
                exclude_node_map = exclude_node_map || {};
                var pos = this.update_positions();
                var keep_pos = {};
                var k2e = this.active_key_to_edge;
                var keep_k2e = {};
                for (var name in pos) {
                    if ((include_node_map[name]) && (!exclude_node_map[name])) {
                        keep_pos[name] = pos[name];
                    }
                }
                for (var k in k2e) {
                    var e = k2e[k];
                    if ((keep_pos[e.destination_name]) && (keep_pos[e.source_name])) {
                        keep_k2e[k] = e;
                    }
                }
                return new NetworkDisplayContext(
                    this.for_visualization, this.from_graph, keep_pos, keep_k2e
                );
            };
            trim() {
                return this.restriction(this.active_positions, this.leaves);
            };
            connected() {
                return this.restriction(this.active_positions, this.isolated);
            };
            display() {
                // show this context in the visualization.
                var that = this;
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
                // get color interpolators
                this.low_interpolator = canvas_element.color_interpolator(vs.min_color, vs.min_threshold_color);
                this.high_interpolator = canvas_element.color_interpolator(vs.max_threshold_color, vs.max_color);
                var illustration = this.to_graph.illustrate(canvas_element, {
                    size: size,
                    animation_milliseconds: 10000,
                    autoRelax: false,
                    node_background: "#dff",
                    display_edge: function(e, i, u) { that.draw_edge(e, i, u); },
                })
                illustration.draw_in_region();
                //illustration.animate_until(20 * 1000);
                illustration.enable_dragging();
                v.current_illustrations = illustration;
                // update thresholding
                var from_graph = this.from_graph;
                var min_weight = this.from_graph.min_weight;
                var max_weight = this.from_graph.max_weight;
                if (min_weight < max_weight) {
                    var step = (max_weight - min_weight) * 0.02;
                    var values = v.threshold_slider.slider("values");
                    if (values[0] <= min_weight) {
                        values[0] = -step;
                    }
                    if (values[1] >= max_weight) {
                        values[1] = step;
                    }
                    v.threshold_slider.slider({
                        min: min_weight,
                        max: max_weight,
                        step: step,
                        values: values,
                    });
                }
            };
            draw_edge(edge, illustration, update) {
                var that = this;
                var params = {}
                params.color = edge.settings.color || illustration.settings.edge_color || "blue";
                params.lineWidth = edge.settings.lineWidth || illustration.settings.edgeLineWidth || 1;
                params.lineDash = edge.settings.lineDash || illustration.settings.edgeLineDash;
                var graph = edge.in_graph;
                var from_graph = this.from_graph;
                var node1 = graph.get_node(edge.nodename1);
                var node2 = graph.get_node(edge.nodename2);
                params.x1 = node1.position.x;
                params.y1 = node1.position.y;
                params.x2 = node2.position.x;
                params.y2 = node2.position.y;
                params.line_offset = 0.0;
                var forward_weight = edge.forward.weight;
                var backward_weight = edge.backward.weight;
                params.forward = (forward_weight != 0);
                params.backward = (backward_weight != 0);
                var head_angle = function(w) {
                    if (w < 0) {
                        return 90;
                    }
                    return 45;
                };
                var interpolated_color = function(interpolator, value, minimum, maximum) {
                    if ((minimum >= maximum) || (value > maximum)) {
                        return interpolator(1.0);
                    }
                    if (value < minimum) {
                        return interpolator(0);
                    }
                    var lambda = (value - minimum) * (1.0 / (maximum - minimum));
                    return interpolator(lambda);
                };
                var get_color = function(value) {
                    if (value < 0) {
                        return interpolated_color(that.low_interpolator, value, from_graph.min_weight, 0);
                    }
                    return interpolated_color(that.high_interpolator, value, 0, from_graph.max_weight);
                }
                if (params.forward) {
                    // configure forward link
                    params.color = get_color(forward_weight);
                    params.head_angle = head_angle(forward_weight);
                }
                if (params.backward) {
                    // configure backward link
                    params.back_color =get_color(backward_weight);
                    params.back_angle = head_angle(backward_weight);
                }
                var tick = illustration.radius * 0.005;
                params.head_length = tick * 5;
                params.head_offset = tick * 10;
                if (params.forward && params.backward) {
                    params.line_offset = tick;
                }
                var in_frame = illustration.frame;
                if (update) {
                    edge.settings.glyph.change(params);
                } else {
                    params.name = true;
                    params.graph_edge = edge;
                    edge.settings.glyph = in_frame.double_arrow(params);
                }
            };
            layout(mode) {
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
                return this.update_positions();
            };
            update_positions() {
                // update positions
                var to_graph = this.to_graph;
                var positions = {};
                for (var name in this.active_positions) {
                    positions[name] = to_graph.get_node(name).position;
                }
                this.active_positions = positions;
                return positions;
            };
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
                this.min_weight = 0;
                this.max_weight = 0;
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
                this.min_weight = Math.min(this.min_weight, weight);
                this.max_weight = Math.max(this.max_weight, weight);
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
        var N = element.directed_network({
            default_layout: "relax",
        });
        N.set_title("A Very Interesting Network.")
        
        N.node(0);
        N.edge(0, 1);
        N.edge(1, 0);
        N.edge(1, 2);
        N.edge(2, 3);

        for (var i=4; i<16; i++) {
            N.edge(i, i+1, 0.1);
            N.edge(i+1, i, -0.25);
            N.edge(0, i, 1.23, {color: "green"});
            N.edge(i+600, i+603, 2);
            N.edge(i+600, 555, 2);
        }
        
        N.edge(100, 101, -0.1);
        N.edge(101, 100, +0.1);
        N.edge(200, 201, +1);
        N.edge(201, 200, -1);
        N.node(5000);

        N.display_all();
    };

})(jQuery);