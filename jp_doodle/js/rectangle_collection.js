/*

JQuery plugin helper for drawing pseudo-3d bar charts

Assumes the element has been initialized using dual_canvas_helper.

Structure follows: https://learn.jquery.com/plugins/basic-plugin-creation/

*/

(function($) {

    $.fn.rectangle_collection = function (target, options) {
        var settings = $.extend({
            u: {x:1, y:0},
            v: {x:0.33, y:0.33},
            width_fraction: 0.75,
            u_label: "horizontal",
            v_label: "depth",
            max_rgb: {r: 255, g: 0, b:0},
            min_rgb: {r: 0, g:255, b: 255},
            transparency: 0.2,
            name_separator: "|",
        }, options);
        for (var key in settings) {
            target["bar_" + key] = settings[key];
        }

        // build some data structures.
        var make_index = function(list) {
            result = {};
            for (var i=0; i<list.length; i++) {
                result[list[i]] = i;
            }
            return result;
        };
        target.u_index = make_index(settings.u_anchors);
        target.v_index = make_index(settings.v_anchors);
        // utility calculations
        var vscale = function(scalar, vector) {
            result = {};
            for (slot in vector){
                result[slot] = vector[slot] * scalar;
            }
            return result;
        };
        var vadd = function(v1, v2) {
            result = {};
            for (slot in v1){
                result[slot] = v1[slot] + v2[slot];
            }
            return result;
        };
        var vint = function(vector) {
            result = {};
            for (slot in vector){
                result[slot] = Math.floor(vector[slot]);
            }
            return result;
        };
        target.interpolate_color = function(lmbda) {
            lmbda = lmbda % 1.0;
            vcolor = vint(vadd(vscale(lmbda, target.bar_max_rgb), vscale(1.0-lmbda, target.bar_min_rgb)));
            return "rgb(" + vcolor.r + "," + vcolor.g + "," + vcolor.b +")";
        }
        target.segment_offset = function(direction, count, fraction, maximum) {
            var factor = maximum * 1.0 / count;
            var offset = vscale(factor, direction);
            var width = fraction * factor;
            return {factor: factor, width: width, offset: offset};
        }

        // copy and extend the bars
        var bars = [];
        var heights = [];
        for (var i=0; i<settings.bars.length; i++) {
            var bar = $.extend({}, settings.bars[i]);
            heights.push(bar.height);
            bar.u_index = target.u_index[bar.u_anchor];
            bar.v_index = target.v_index[bar.v_anchor];
            bars.push(bar);
        }
        target.bars = bars;
        target.minheight = Math.min(...heights);
        target.maxheight = Math.max(...heights);

        target.focus_u_anchor = function(u_anchor) {
            var bars = target.bars;
            // make all other bars
            for (var i=0; i<bars.length; i++) {
                var bar = bars[i];
                if (bar.u_anchor == u_anchor) {
                    // reinstall visible
                    target.rect(bar);
                } else {
                    target.forget_objects([bar.name]);
                }
            }
        };

        target.focus_v_anchor = function(v_anchor) {
            var bars = target.bars;
            // make all other bars
            for (var i=0; i<bars.length; i++) {
                var bar = bars[i];
                if (bar.v_anchor == v_anchor) {
                    // reinstall visible
                    target.rect(bar);
                } else {
                    target.forget_objects([bar.name]);
                }
            }
        };

        target.draw_bars = function() {
            if (!target.reset_canvas) {
                throw new Error("rectangle_collection requires target configured by dual_canvas_helper");
            }
            target.reset_canvas();
            var bars = target.bars;
            var separator = target.bar_name_separator;
            var fraction = target.bar_width_fraction;
            var u = target.bar_u;
            var v = target.bar_v;
            var x = target.bar_x;
            var y = target.bar_y;
            var u_offset = target.segment_offset(u, target.bar_u_anchors.length, fraction, target.bar_max_width);
            var du = u_offset.offset;
            var width = u_offset.width;
            var dv = target.segment_offset(v, target.bar_v_anchors.length, fraction, target.bar_max_depth).offset;
            var interval = target.maxheight - target.minheight;
            var max_vertical = target.bar_max_vertical;
            var height_factor = max_vertical * 1.0 / interval;
            for (var i=0; i<bars.length; i++) {
                var bar = bars[i];
                var position = vadd(vscale(bar.u_index, du), vscale(bar.v_index, dv));
                bar.name = bar.u_anchor + separator + bar.v_anchor;
                bar.x = position.x + x;
                bar.y = position.y + y;
                bar.w = width;
                bar.h = bar.height * height_factor;
                bar.color = target.interpolate_color(bar.height / interval);
            }
            // sort the larger indices earlier
            bars.sort(function(bar_a, bar_b) {
                var diff = (bar_b.v_index - bar_a.v_index);
                if (diff) {
                    return diff;
                } else {
                    return bar_b.u_index - bar_a.u_index;
                }
            })
            // draw the bars
            for (var i=0; i<bars.length; i++) {
                var bar = bars[i];
                bar.fill = true;
                target.rect(bar);
                // outline it
                outline = $.extend({}, bar)
                outline.name = null;
                outline.color = "black"
                outline.fill = false;
                target.rect(outline);
            } 
            // draw anchor texts and markers
            var put_mark = function(x, y, name, action) {
                target.circle({name: name, x: x, y: y, r:width/2.0, color:"yellow"});
                target.circle({x: x, y: y, r:width/2.0, color:"#888", fill:false});
                target.on_canvas_event("click", action, name);
            }
            var u_anchors = target.bar_u_anchors;
            for (var i=0; i<u_anchors.length; i++) {
                let u_anchor = u_anchors[i];
                let position = vscale(i, du);
                //target.circle({name: u_anchor + "_u_marker", x: position.x + x, y: position.y + y - width, r:width/2.0, color:"yellow"})
                put_mark(position.x + x + width/2.0, position.y + y - width, u_anchor + "_u_marker", function() {target.focus_u_anchor(u_anchor)});
                target.text({text: u_anchor, x: position.x + x, y: position.y + y - 2 * width, degrees: -90, color:"black"})
            }
            var v_anchors = target.bar_v_anchors;
            for (var i=0; i<v_anchors.length; i++) {
                let v_anchor = v_anchors[i];
                let position = vscale(i, dv);
                put_mark(position.x + x + 1.5 * width, position.y + y + width/2, v_anchor + "_v_marker", function() {target.focus_v_anchor(v_anchor)});
                //target.circle({name: v_anchor + "_v_marker", x: position.x + x + width, y: position.y + y, r:width/2.0, color:"yellow"})
                target.text({text: v_anchor, x: position.x + x + 2 * width, y: position.y + y, degrees: 0, color:"black"})
            }
            // click background for a redraw
            target.on_canvas_event("click", function() {target.draw_bars();});
            target.fit();
        }; 
    };

    $.fn.rectangle_collection.example = function(element) {
        var bar_config = {
            u: {x:-1, y:0},
            v: {x:0.8, y:0.3},
            x: 20,
            y: 280,
            u_label: "person type",
            u_anchors: "men women children".split(" "),
            v_label: "State",
            v_anchors: "Pennsylvania New_Jersey New_York Delaware".split(" "),
            max_vertical: 200,
            max_depth: 200,
            max_width: 50,
        };
        var rectangles = [];
        for (var i=0; i<bar_config.u_anchors.length; i++) {
            u_anchor = bar_config.u_anchors[i];
            for (var j=0; j<bar_config.v_anchors.length; j++) {
                var v_anchor = bar_config.v_anchors[j];
                var height = (Math.sin(i+j)+1) * 50;
                var rectangle = {
                    u_anchor: u_anchor,
                    v_anchor: v_anchor,
                    height: height,
                }
                rectangles.push(rectangle);
            }
        }
        bar_config.bars = rectangles;
        element.empty();
        var canvas_config = {
            width: 300,
            height: 300,
            //translate_scale: {x: x, y:y, w:w, h:h},
        };
        element.dual_canvas_helper(element, canvas_config);
        element.rectangle_collection(element, bar_config);
        element.render = function () {
            debugger;
            var seconds = (new Date()).getTime() * 0.001
            //element.bar_v = {x: Math.sin(seconds), y: Math.cos(seconds)};
            element.draw_bars();
            //window.requestAnimationFrame(element.render);
            //setInterval(element.render, 100);
        };
        element.render();
    };

})(jQuery);