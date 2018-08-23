/*

JQuery plugin helper for building widgets that use 2d canvas displays.
This widget uses 2 canvases -- a visible display canvas
and an invisible index canvas used to find objects associated with
mouse events by pseudocolor.

Uses canvas_2d_widget_helper 

Structure follows: https://learn.jquery.com/plugins/basic-plugin-creation/

*/

// xxxx add image primatives,
// eg https://stackoverflow.com/questions/21300921/how-to-convert-byte-array-to-image-in-javascript/21301006#21301006

(function($) {

    $.fn.dual_canvas_helper = function (options) {
        var target = this;
        var settings = $.extend({
            width: 500,
            height: 500,
            lineWidth: 1,
            fillColor: "black",
            strokeStyle: "black",
            translate_scale: {x: 0.0, y:0.0, w:1.0, h:1.0},
            font: "normal 10px Arial",
        }, options);

        for (var key in settings) {
            target["canvas_" + key] = settings[key];
        }

        // Use this flag to temporarily turn off element events
        target.disable_element_events = false;

        target.reset_canvas = function (keep_stats) {
            if (target.canvas_container) {
                target.canvas_container.empty();
            } else {
                target.canvas_container = $("<div/>").appendTo(target);
            }
            var settings_overrides = {};
            for (var key in settings) {
                settings_overrides[key] = target["canvas_" + key];
            }
            // make visible and invisible dual canvases
            target.visible_canvas = $("<div/>").appendTo(target.canvas_container);
            // Invisible canvas for event lookups
            target.invisible_canvas = $("<div/>").appendTo(target.canvas_container);
            target.invisible_canvas.hide();
            // Test canvas for event hit validation.
            target.test_canvas = $("<div/>").appendTo(target.canvas_container);
            target.test_canvas.hide();
            target.visible_canvas.canvas_2d_widget_helper(settings_overrides);
            target.invisible_canvas.canvas_2d_widget_helper(settings_overrides);
            target.test_canvas.canvas_2d_widget_helper(settings_overrides);
            target.clear_canvas(keep_stats);
        }

        target.clear_canvas = function (keep_stats) {
            if (keep_stats) {
                target.visible_canvas.canvas_stats = {};
            }
            // object list for redraws
            target.object_list = [];
            // lookup structures for named objects
            target.name_to_object_info = {};
            target.color_index_to_name = {};
            //target.event_types = {};
            //target.default_event_handlers = {};
            target.reset_events();
            target.visible_canvas.clear_canvas();
            target.invisible_canvas.clear_canvas();
            // no need to clear the test_canvas now
        };

        target.active_region = function (default_to_view_box) {
            // This is only defined if stats have been previously computed
            var result = target.visible_canvas.stats;
            if ((default_to_view_box) && (!result)) {
                result = target.model_view_box();
            }
            return result;
        }

        target.fit = function (stats, margin) {
            // stats if defined should provide min_x, max_x, min_y, max_y
            // Adjust the translate and scale so that the visible objects are centered and visible.
            var vc = target.visible_canvas;
            var x_translate = 0.0;
            var y_translate = 0.0;
            var scale = 1.0;
            // try to use existing stats
            if (!stats) {
                stats = target.active_region();
            }
            if (!stats) {
                // get boundaries for visible objects
                target.set_translate_scale();
                // Redraw and collect stats on visible objects
                vc.canvas_stats = {};
                target.redraw();
                stats = vc.canvas_stats;
            }
            var canvas = vc.canvas[0];
            var cwidth = canvas.width;
            var cheight = canvas.height;
            if (!margin) {
                margin = 0.01 * Math.max(stats.max_x - stats.min_x, stats.max_y - stats.min_y);   // xxxx?
            }
            var width = stats.max_x - stats.min_x + 2 * margin;
            var height = stats.max_y - stats.min_y + 2 * margin;
            // DEBUG: draw limits rectangle
            //target.rect({x: stats.min_x-2, y: stats.min_y-2, h:height+4, w:width+4, color:"yellow", fill:false});
            var wscale = cwidth * 1.0 / width;
            var hscale = cheight * 1.0 / height;
            //var scale = Math.min(wscale, hscale);
            var y_up = vc.canvas_y_up;
            if (hscale < wscale) {
                // fit y and center x
                scale = hscale;
                y_translate = - stats.min_y + margin;
                x_translate = - stats.min_x + 0.5 * (cwidth / scale - width) + margin;
            } else {
                // fit x and center y
                scale = wscale;
                x_translate = - stats.min_x + margin;
                y_translate = - stats.min_y + 0.5 * (cheight / scale - height) + margin;
            }
            var translate_scale = {x: x_translate, y: y_translate, w: scale, h: scale};
            //return;
            target.set_translate_scale(translate_scale);
            // reset the event callbacks
            for (var event_type in target.event_info.event_types) {
                target.visible_canvas.canvas.on(event_type, target.generic_event_handler);
                target.event_info.event_types[event_type] = true;
            }
            target.request_redraw();
            return stats;
        }

        target.set_translate_scale = function (translate_scale) {
            if (!translate_scale) {
                translate_scale = {x: 0.0, y:0.0, w:1.0, h:1.0};
            }
            target.canvas_translate_scale = translate_scale;
            target.visible_canvas.canvas_translate_scale = translate_scale;
            target.invisible_canvas.canvas_translate_scale = translate_scale;
            target.test_canvas.canvas_translate_scale = translate_scale;
            target.visible_canvas.reset_canvas();
            target.invisible_canvas.reset_canvas();
            target.test_canvas.reset_canvas();
        }

        target.redraw = function () {
            target.visible_canvas.clear_canvas();
            target.invisible_canvas.clear_canvas();
            // Don't draw anything on the test canvas now.
            var drawn_objects = [];
            var object_list = target.object_list;
            var name_to_object_info = target.name_to_object_info;
            for (var i=0; i<object_list.length; i++) {
                var object_info = object_list[i];
                if (object_info) {
                    // only draw objects with no name or with known names
                    var name = object_info.name;
                    if ((!name) || (name_to_object_info[name])) {
                        // draw and save
                        target.draw_object_info(object_info);
                        var object_index = drawn_objects.length;
                        object_info.index = object_index;
                        drawn_objects[object_index] = object_info;
                    }
                }
            }
            // keep only the drawn objects
            target.object_list = drawn_objects;
            target.redraw_pending = false;
        }

        target.redraw_pending = false;

        // Call this after modifying the object collection to request an eventual redraw.
        target.request_redraw = function() {
            if (!target.redraw_pending) {
                requestAnimationFrame(target.redraw);
                target.redraw_pending = true;
            }
        }

        target.store_object_info = function(info, draw_on_canvas) {
            var name = info.name;
            var object_list = target.object_list;
            var object_index = object_list.length;
            var object_info = $.extend({
                draw_on_canvas: draw_on_canvas,
            }, info);
            if (name) {
                var pseudocolor_array = null;
                var old_object_info = target.name_to_object_info[name];
                if (old_object_info) {
                    // this prevents saving 2 objects with same name -- xxxx is this what we want?
                    object_index = old_object_info.index; //  -- if you want delete, use delete...?
                    pseudocolor_array = old_object_info.pseudocolor_array;
                    // request a redraw because the object changed
                    target.request_redraw();
                }
                if (!pseudocolor_array) {
                    pseudocolor_array = target.next_pseudocolor();
                }
                // bookkeeping for event look ups.
                object_info.pseudocolor_array = pseudocolor_array;
                object_info.pseudocolor = target.array_to_color(pseudocolor_array);
                var color_index = target.color_array_to_index(pseudocolor_array);
                target.name_to_object_info[name] = object_info;
                target.color_index_to_name[color_index] = name;
            }
            object_info.index = object_index;
            object_list[object_index] = object_info;
            return object_info;
        };

        target.change_element = function (name, opt, no_redraw) {
            var object_info = target.name_to_object_info[name];
            if (object_info) {
                $.extend(object_info, opt);
                if (!no_redraw) {
                    // schedule a redraw automatically
                    target.request_redraw();
                }
            } else {
                console.warn("change_element: no such element with name " + name);
            }
        };
        
        target.forget_objects = function(names) {
            for (var i=0; i<names.length; i++) {
                var name = names[i];
                var object_info = target.name_to_object_info[name];
                if (object_info) {
                    var index = object_info.index;
                    var pseudocolor_array = object_info.pseudocolor_array;
                    var color_index = target.color_array_to_index(pseudocolor_array);
                    target.object_list[index] = null;
                    delete target.name_to_object_info[name];
                    delete target.color_index_to_name[color_index];
                    target.request_redraw();
                }
                // ignore request to forget unknown object
            }
        };

        target.set_visibilities = function (names, visibility) {
            for (var i=0; i<names.length; i++) {
                var name = names[i];
                var object_info = target.name_to_object_info[name];
                if (object_info) {
                    object_info.hide = (!visibility);
                }
                target.request_redraw();
            }
        };

        target.draw_object_info = function(object_info) {
            if (object_info.hide) {
                // do not draw hidden objects
                return;
            }
            var draw_fn = object_info.draw_on_canvas;
            var draw_info = draw_fn(target.visible_canvas, object_info);
            // store additional information attached during the draw operation
            $.extend(object_info, draw_info);
            if (object_info.name) {
                // also draw invisible object using psuedocolor for event lookups
                target.draw_mask(object_info, target.invisible_canvas);
                // Don't draw on the test canvas now.
            }
        };

        target.draw_mask = function(object_info, invisible_canvas) {
            var draw_fn = object_info.draw_on_canvas;
            var info2 = $.extend({}, object_info);
            if (object_info.draw_mask) {
                // convert visible object to invisible mask object (text becomes rectangle, eg)
                draw_fn = object_info.draw_mask;
            }
            info2.color = object_info.pseudocolor;
            draw_fn(invisible_canvas, info2);
        };

        //target.reset_canvas();

        target.garish_pseudocolor_array = function(integer) {
            // Try to choose sequence of colors not likely to interpolate into eachother.
            // Intended to be used to identify objects using pixels drawn for those objects.
            var rgb = [0, 0, 0]
            for (var i=0; i<8; i++) {
                for (var j=0; j<3; j++) {
                    rgb[j] = (rgb[j] << 1) | (integer & 1);
                    integer = (integer >> 1);
                }
            }
            return rgb;
        };

        target.array_to_color = function(rgb) {
            return "rgb(" + rgb.join(",") + ")";
        }

        target.color_counter = 0;

        target.next_pseudocolor = function () {
            // XXX this wraps after about 16M elements.
            target.color_counter++;
            return target.garish_pseudocolor_array(target.color_counter);
        }

        target.color_array_to_index = function(color_array) {
            // convert a color to a mapping key for storage and look ups
            if (color_array.length > 3) {
                // Do not index any color unless alpha channel is 255 (fully opaque)
                if (color_array[3] < 255) {
                    return null;
                }
            }
            return ((color_array[0] << 16) | (color_array[1] << 8) | (color_array[2]));
        };

        var assign_shape_factory = function(shape_name) {
            // refactored common logic for drawing shapes
            target[shape_name] = function(opt, wait) {
                var draw = function(canvas, s) {
                    var method = canvas[shape_name];
                    var info = method(s);
                    // store additional information added during draw operation
                    $.extend(s, info);
                };
                var object_info = target.store_object_info(opt, draw);
                if (!wait) {
                    // draw the object now.
                    target.draw_object_info(object_info);
                }
            };
        };
        assign_shape_factory("circle");
        assign_shape_factory("line");
        assign_shape_factory("text");
        assign_shape_factory("rect");
        assign_shape_factory("polygon");
        assign_shape_factory("named_image");

        target.name_image_url = function(image_name, url, no_redraw) {
            // load an image url
            var the_image = new Image();
            the_image.src = url;
            target.visible_canvas.add_image(image_name, the_image);
            if (!no_redraw) {
                // request a reload when the image arrives
                the_image.onload = function () {
                    target.request_redraw();
                };
            }
        };

        target.converted_location = function (x, y) {
            return target.visible_canvas.converted_location(x, y);
        };

        target.event_pixel_location = function (e) {
            return target.visible_canvas.event_pixel_location(e);
        };

        target.pixel_offset = function(target_x, target_y) {
            return target.visible_canvas.model_to_pixel(target_x, target_y);
        };

        target.watch_event = function(event_type) {
            if (!target.event_info.event_types[event_type]) {
                target.visible_canvas.canvas.on(event_type, target.generic_event_handler);
                target.event_info.event_types[event_type] = true;
                if (!(target.event_info.object_event_handlers[event_type])) {
                    target.event_info.object_event_handlers[event_type] = {};
                }
            }
            // mouseover and mouseout events are emulated using mousemove
            if ((event_type == "mouseover") || (event_type == "mouseout")) {
                target.watch_event("mousemove");
            }
            // ??? no provision for cancelling events on the visible canvas?
        };

        target.on_canvas_event = function(event_type, callback, for_name) {
            if (for_name) {
                var object_info = target.name_to_object_info[for_name];
                if (object_info) {
                    //var key = "on_" + event_type;
                    target.watch_event(event_type);
                    //object_info[key] = callback;
                    target.event_info.object_event_handlers[event_type][for_name] = callback;
                } else {
                    console.warn("in on_canvas_event no object found with name: " + for_name);
                }
            } else {
                // no name means handle event for whole canvas.
                target.watch_event(event_type);
                target.event_info.default_event_handlers[event_type] = callback;
            }
        };

        target.off_canvas_event = function(event_type, for_name) {
            if (for_name) {
                var object_info = target.name_to_object_info[for_name];
                if ((object_info) && (target.event_info.object_event_handlers[event_type])) {
                    //var key = "on_" + event_type;
                    //object_info[key] = null;
                    target.event_info.object_event_handlers[event_type][for_name] = null;
                } else {
                    console.warn("in off_canvas_event no object found with name: " + for_name);
                }
            } else {
                target.event_info.default_event_handlers[event_type] = null;
            }
        };

        target.event_canvas_location = function(e) {
            return target.visible_canvas.event_canvas_location(e);
        };

        target.event_model_location = function(e) {
            return target.visible_canvas.event_model_location(e);
        };

        target.color_index_at = function(canvas, pixel_x, pixel_y) {
            var invisible_color = canvas.color_at(pixel_x, pixel_y).data;
            return target.color_array_to_index(invisible_color);
        };

        target.object_name_at_position = function (event, pixel_x, pixel_y) {
            // Find named object at position and validate it using the test canvas.
            var color_index = target.color_index_at(target.invisible_canvas,
                pixel_x, pixel_y);
            var canvas_name = target.color_index_to_name[color_index];
            var object_info = target.name_to_object_info[canvas_name];
            if ((canvas_name) && (object_info)) {
                // Validate the object hit by drawing on the test canvas.
                var test_canvas = target.test_canvas;
                test_canvas.clear_canvas();
                target.draw_mask(object_info, test_canvas);
                var test_index = target.color_index_at(test_canvas, pixel_x, pixel_y);
                if (test_index != color_index) {
                    // Bogus object hit probably caused by anti-aliasing.
                    canvas_name = null;
                }
            }
            if (canvas_name) {
                event.canvas_name = canvas_name;
                event.color_index = color_index;
                event.object_info = object_info;
            };
            return canvas_name;
        };

        target.generic_event_handler = function(e) {
            var visible = target.visible_canvas;
            e.pixel_location = visible.event_pixel_location(e);
            e.canvas_name = target.object_name_at_position(
                e, e.pixel_location.x, e.pixel_location.y);
            var last_event = target.last_canvas_event;
            var process_event = function(e, no_default) {
                var event_type = e.type;
                var default_handler = null;
                var object_handler = null;
                if (!no_default) {
                    default_handler = target.event_info.default_event_handlers[event_type];
                }
                if ((e.canvas_name) && (!target.disable_element_events)) {
                    e.object_info = target.name_to_object_info[e.canvas_name];
                    if ((e.object_info) && (target.event_info.object_event_handlers[event_type])) {
                        //var key = "on_" + event_type;
                        //object_handler = e.object_info[key];
                        object_handler = target.event_info.object_event_handlers[event_type][e.canvas_name];
                    }
                }
                // No "event bubbling"?
                if (object_handler) {
                    object_handler(e);
                } else if (default_handler) {
                    default_handler(e);
                }
                target.last_canvas_event = e;
            };
            // "normal" event handling
            process_event(e);
            // mouseover and mouseout simulation:
            if ((last_event) && (e.type == "mousemove") && (last_event.canvas_name != e.canvas_name)) {
                //console.log("doing transition emulations " + last_event.canvas_name)
                if (last_event.canvas_name) {
                    //console.log("emulating mouseout");
                    var mouseout_event = $.extend({}, e);
                    mouseout_event.type = "mouseout";
                    mouseout_event.canvas_name = last_event.canvas_name;
                    mouseout_event.object_info = last_event.object_info;
                    // attempt a mouseout with no default
                    process_event(mouseout_event);
                }
                if (e.canvas_name) {
                    var mouseover_event = $.extend({}, e);
                    mouseover_event.type = "mouseover"
                    // attempt a mouseover with no default
                    process_event(mouseover_event, true);
                }
            }
            // do not allow event to propagate
            e.stopPropagation();
        };

        target.reset_events = function() {
            var old_event_info = target.event_info;
            target.event_info = {
                event_types: {},   // Is event enabled? type --> boolean.
                default_event_handlers: {},  // type --> global event handler.
                object_event_handlers: {},  // type --> (name --> handler)
            };
            // turn off object events and defaults
            //target.disable_element_events = true;
            // return event handlers for later possible restoration
            return old_event_info;
        }

        target.restore_events = function(event_info) {
            var old_event_info = target.event_info;
            target.event_info = event_info;
            // turn events back on
            //target.disable_element_events = false;
            return old_event_info;
        };

        target.focus_canvas = function () {
            // set the focus to the visible canvas so the canvas can receive keyboard events.
            target.visible_canvas.canvas.attr("tabindex", "0");
            target.visible_canvas.canvas.focus();
        }

        target.do_lasso = function(names_callback, config, delete_after) {
            // Use a lasso to surround elements.  Return names of elements under lassoed rectangle
            // XXXX Need to change this to choose a color that is not in the original canvas for lasso tool.
            var options = $.extend({
                name: "polygon_lasso",
                color: "red",
                lineWidth: 1,
                fill: false,
                close: false,
                points: [],
            }, config);
            var saved_event_handlers = target.reset_events();
            var points = [];
            var lassoing = false;
            var mouse_down_handler = function(event) {
                lassoing = true;
                var loc = target.event_model_location(event)
                points = [[loc.x, loc.y]];
                options.points = points;
                target.polygon(options);
            };
            target.on_canvas_event("mousedown", mouse_down_handler);
            var mouse_move_handler = function(event) {
                if (!lassoing) {
                    return;
                }
                var loc = target.event_model_location(event);
                points.push([loc.x, loc.y]);
                target.change_element(options.name, {points: points});
            };
            target.on_canvas_event("mousemove", mouse_move_handler);
            var mouse_up_handler = function(event) {
                lassoing = false;
                // determine the names lassoed
                target.change_element(options.name, {fill: true, close: true});
                var name_to_object = target.shaded_objects(options.name);
                // clean up:
                // delete the lasso polygon if requested
                if (delete_after) {
                    target.forget_objects([options.name]);
                } else {
                    // otherwise unfill it
                    target.change_element(options.name, {fill: false});
                }
                target.restore_events(saved_event_handlers);
                // callback with the names found mapped to descriptions
                names_callback(name_to_object);
            }
            target.on_canvas_event("mouseup", mouse_up_handler);
            return options.name;
        }

        target.vector_frame = function(
            x_vector,
            y_vector,
            xy_offset) {
            return target.dual_canvas_helper.reference_frame(
                target,
                x_vector,
                y_vector,
                xy_offset
            );
        };

        target.rframe = function(scale_x, scale_y, translate_x, translate_y) {
            return target.vector_frame(
                {x: scale_x, y:0},
                {x:0, y: scale_y},
                {x: translate_x, y: translate_y}
            );
            // xxxx could add special methods like model_to_pixel.
        };

        target.frame_region = function(minx, miny, maxx, maxy, frame_minx, frame_miny, frame_maxx, frame_maxy) {
            // Convenience: map frame region into the canvas region
            var scale_x = (maxx - minx) * 1.0 / (frame_maxx - frame_minx);
            var scale_y = (maxy - miny) * 1.0 / (frame_maxy - frame_miny);
            var translate_x = minx - frame_minx * scale_x;
            var translate_y = miny - frame_miny * scale_y;
            return target.rframe(scale_x, scale_y, translate_x, translate_y)
        }

        target.callback_with_pixel_color = function(pixel_x, pixel_y, callback, delay) {
            // For testing.  Delay finish to allow widget initialization to stabilize before testing.
            if (!delay) {
                delay = 1000;  // delay for 1 second.
            }
            var finish = function() {
                var color_data = target.visible_canvas.color_at(pixel_x, pixel_y).data;
                var result = [];
                for (var i=0; i<color_data.length; i++) { 
                    result.push(color_data[i]);
                }
                callback(result);
            };
            setTimeout(finish, delay);
        };

        target.shaded_objects = function(shading_name) {
            // determine the names of named objects underneith the shading object "paint".
            // Used for example to implement "lasso" selected objects under a polygon.
            // xxx This could be optimized: it is a brute force scan of the whole canvas 2x right now.
            // xxx This method will not find shaded objects that are obscured by other objects.
            // XXXX need to use the test_canvas here!!!
            var object_info = target.name_to_object_info[shading_name];
            if (!object_info) {
                throw new Error("can't find object with name " + shading_name);
            }
            var pseudocolor = object_info.pseudocolor;
            var shader_hidden_before = object_info.hide
            // get a hidden canvas pixel snapshot with the object hidden
            object_info.hide = true;
            target.redraw();
            var shaded_pixels = target.invisible_canvas.pixels().data;
            // get a hidden canvas pixel snapshot with the object visible
            object_info.hide = false;
            target.redraw();
            var shading_pixels = target.invisible_canvas.pixels().data;
            // scan pixels to find named objects
            var name_to_shaded_objects = {};
            for (var i=0; i<shaded_pixels.length; i += 4) {
                var shading_color_array = shading_pixels.slice(i, i+3);
                // var shading_color_index = target.color_array_to_index(shading_color_array);
                var shading_color = target.array_to_color(shading_color_array);
                if (shading_color == pseudocolor) {
                    // record any named object "under" this shading pixel
                    var shaded_color_array = shaded_pixels.slice(i, i+4);
                    var shaded_color_index = target.color_array_to_index(shaded_color_array);
                    var shaded_object_name = target.color_index_to_name[shaded_color_index];
                    if (shaded_object_name) {
                        var shaded_object_info = target.name_to_object_info[shaded_object_name];
                        if (shaded_object_info) {
                            name_to_shaded_objects[shaded_object_name] = shaded_object_info;
                        }
                    }
                }
            }
            // Restore previous visibility state for shading object and implicitly request a redraw.
            target.set_visibilities([shading_name], !shader_hidden_before)
            return name_to_shaded_objects;
        };

        target.model_view_box = function () {
            return target.visible_canvas.model_view_box();
        };

        target.pixels = function(x, y, h, w) {
            return  target.visible_canvas.pixels(x, y, h, w);
        };

        target.model_location = function(mx, my) {
            // for consistency with reference frames -- model location is unchanged
            return {x: mx, y: my};
        }

        target.canvas_2d_widget_helper.add_vector_ops(target);
        target.dual_canvas_helper.add_axis_logic(target);
        target.reset_canvas();

        return target;
    };

    $.fn.dual_canvas_helper.add_axis_logic = function (target) {

        target.right_axis = function(config) {
            return target.bottom_axis(config, {x: 1, y: 0}, {x: 0, y: 1}, 0, "y")
        };

        target.left_axis = function(config) {
            return target.bottom_axis(config, {x: -1, y: 0}, {x: 0, y: 1}, 0, "y", "right")
        };

        target.top_axis = function(config) {
            return target.bottom_axis(config, {x: 0, y: 1}, {x: 1, y: 0}, 90, "x")
        };

        target.lower_left_axes = function(config) {
            var stats = target.active_region(true); 
            var params = $.extend({
                add_end_points: true,
                skip_anchor: false,
            }, stats, config);
            // choose anchors
            var choose_anchor = function (min_value, max_value, anchor_parameter) {
                // use the parameter if it is given as a number
                if ((typeof anchor_parameter) == "number") {
                    return anchor_parameter;
                }
                // prefer 0 if possible
                var result = 0;
                if ((min_value > result) || (max_value < result)) {
                    // choose an anchor in the center of appropriate tick choices
                    var choices = target.axis_ticklist(min_value, max_value, 10);
                    //var index = Math.floor(0.5 * choices.length);
                    //result = choices[index];
                    result = choices[0];
                }
                return result;
            };
            var x_anchor = choose_anchor(params.min_x, params.max_x, params.x_anchor);
            var y_anchor = choose_anchor(params.min_y, params.max_y, params.y_anchor);
            var bottom_config = $.extend({
                anchor: x_anchor,
                // axis_origin: {x: 0, y: y_anchor},
                axis_origin: {x: 0, y: params.min_y},
                //skip_anchor: true,
                min_value: params.min_x,
                max_value: params.max_x
            }, params);
            target.bottom_axis(bottom_config);
            var left_config = $.extend({
                anchor: y_anchor,
                //axis_origin: {x: x_anchor, y:0},
                axis_origin: {x: params.min_x, y:0},
                //skip_anchor: true,
                min_value: params.min_y,
                max_value: params.max_y,
            }, params);
            target.left_axis(left_config);
        }

        target.bottom_axis = function(config, tick_direction, offset_direction, degrees, coordinate, align) {
            // simplified interface
            var params = $.extend({
                min_value: null,
                max_value: null,
                max_tick_count: 10,
                anchor: null,
                skip_anchor: false,
                add_end_points: false,
            }, config);
            coordinate = coordinate || "x";
            var other_coord = "y";
            if (coordinate == "y") {
                other_coord = "x";
            }
            params.tick_direction = tick_direction || {x: 0, y: -1};
            params.offset_vector = offset_direction || {x: 1, y: 0};
            //degrees = degrees || -90;
            if ((typeof degrees) != "number") {
                degrees = -90;
            }
            params.tick_text_config = $.extend({
                degrees: degrees,
                align: align
            }, params.tick_text_config)
            var stats = target.active_region(true);   // drawn region or model view box
            var min_value = params.min_value || stats["min_" + coordinate];
            var max_value = params.max_value || stats["max_" + coordinate]
            if (!params.ticks) {
                // infer ticks from limits
                params.ticks = target.axis_ticklist(min_value, max_value, params.max_tick_count, params.anchor);
                //params.ticks = ticklist.map(x => {offset: x});
            }
            // convert numeric ticks to mappings
            params.ticks = params.ticks.map(
                function (x) {
                    if ((typeof x) == "number") {
                        return {offset: x};
                    } else {
                        return x;
                    }
                }
            )
            // if add_end_points is specified then include unlabelled end markers if absent
            if (params.add_end_points) {
                if (min_value < params.ticks[0].offset) {
                    var min_tick = {offset: min_value, text: " "};
                    params.ticks.unshift(min_tick);
                }
                if (max_value > params.ticks[params.ticks.length-1].offset) {
                    var max_tick = {offset: max_value, text: " "};
                    params.ticks.push(max_tick);
                }
            }
            if (!params.axis_origin) {
                params.axis_origin = {x: 0, y: 0};
                var other_min = stats["min_" + other_coord];
                var other_max = stats["max_" + other_coord];
                if ((other_min > 0) || (other_max < 0)) {
                    params[other_coord] = 0.5 * (other_min + other_max);
                }
            }
            if ((params.skip_anchor) && (!params.tick_transform) && (params.anchor!=null)) {
                // For double axes skip the label at the origin crossing point.
                params.tick_transform = function(tick) {
                    if (tick == params.anchor) {
                        //return null;  // skip the anchor label and tick mark.
                        return {offset: tick, text: " "}
                    }
                    return tick;
                }
            }
            return target.axis(params);
        };

        target.axis = function(config) {
            // Draw an axis
            var default_tick_format = function(tick) {
                if ((typeof tick.text) != "undefined") {
                    return "" + tick.text;
                }
                var offset = tick.offset;
                var result = "" + offset;
                if (offset != parseInt(offset, 10)) {
                    if (result.length > 6) {
                        result = offset.toPrecision(4);
                    }
                }
                return result;
            }
            var params = $.extend({
                name_prefix: null,
                tick_format: default_tick_format,
                tick_length: 10, // intended in pixels
                label_offset: 15, // intended in pixels
                tick_line_config: {},
                tick_text_config: {},
                tick_direction: {x: 1, y: 0},
                offset_vector: {x: 0, y: 1},
                axis_origin: {x: 0, y: 0},
                connecting_line_config: {},  // connecting line omitted if null config
                // for example purposes only
                ticks: [
                    {offset: 0, text: "0.0", name: "Zero"},
                    {offset: 10, text: "ten", name: "Ten"},
                    {offset: 15, text: "15.0", name: "fifteen"},
                ],
                tick_transform: function(x) { return x; },
            }, config);
            var ticks = params.ticks;
            var max_tick = null;
            var min_tick = null;
            // find the scale factor for convering tick direction vector to pixels
            var tick_direction_length = target.vlength(
                target.vadd(
                    target.converted_location(params.tick_direction.x, params.tick_direction.y),
                    target.vscale(-1, target.converted_location(0, 0))
                )
            );
            var tick_model_conversion = 1.0 / tick_direction_length;
            var tick_shift = target.vscale(params.tick_length * tick_model_conversion, params.tick_direction);
            var label_shift = target.vscale(params.label_offset * tick_model_conversion, params.tick_direction);
            // draw the tick marks and text.
            for (var i=0; i<ticks.length; i++) {
                var line = $.extend({}, params.tick_line_config);
                var tick = params.tick_transform(ticks[i]);
                if (tick == null) {
                    // transformed to "ignore"
                    continue;
                }
                // automatically convert numbers to default mapping
                if ((typeof tick) == "number") {
                    tick = {offset: tick};
                } else {
                    var tick = $.extend({}, tick);  // fresh copy
                }
                tick.start = target.vadd(
                    params.axis_origin,
                    target.vscale(tick.offset, params.offset_vector)
                );
                tick.end = target.vadd(
                    tick.start,
                    tick_shift
                );
                line.x1 = tick.start.x; line.y1 = tick.start.y;
                line.x2 = tick.end.x; line.y2 = tick.end.y;
                // draw the line mark
                target.line(line);
                // set up text values
                var label = $.extend({}, params.tick_text_config);
                label = $.extend(label, tick);
                if (!label.text) {
                    label.text = params.tick_format(label);
                }
                if (!label.name) {
                    if (params.name_prefix) {
                        label.name = params.name_prefix + label.text;
                    }
                }
                label.valign = "center";
                label.offset = target.vadd(
                    tick.start,
                    label_shift
                )
                label.x = label.offset.x;
                label.y = label.offset.y;
                label.valign = "center";
                // draw the text label.
                target.text(label);
                // bookkeeping
                if ((!max_tick) || (max_tick.offset < tick.offset)) {
                    max_tick = tick;
                }
                if ((!min_tick) || (min_tick.offset > tick.offset)) {
                    min_tick = tick;
                }
            }
            // draw the connector if configured
            if ((min_tick) && (params.connecting_line_config)) {
                var connecting_line = $.extend({}, params.tick_line_config, params.connecting_line_config);
                connecting_line.x1 = min_tick.start.x;
                connecting_line.y1 = min_tick.start.y;
                connecting_line.x2 = max_tick.start.x;
                connecting_line.y2 = max_tick.start.y;
                target.line(connecting_line);
            }
        };
        target.axis_ticklist = function(min_offset, max_offset, maxlen, anchor) {
            maxlen = maxlen || 10;
            if (min_offset >= max_offset) {
                throw new Error("bad offsets");
            }
            var anchor_provided = ((typeof anchor) == "number")
            if ((anchor_provided) && ((anchor < min_offset) || (anchor > max_offset))) {
                throw new Error("bad anchor");
            }
            var diff = max_offset - min_offset;
            var tick_length = 1.0;
            var scale = 1.0;
            // adjust tick length down
            while ((diff / tick_length) < maxlen) {
                tick_length = tick_length * 0.1;
                scale = scale * 10;
            }
            // scale tick length up
            while ((diff / tick_length) >= maxlen) {
                tick_length = tick_length * 10;
                scale = scale * 0.1;
            }
            // fix numerical drift
            if (scale >= 1) {
                scale = Math.round(scale);
                tick_length = 1.0/scale;
            } else {
                tick_length = Math.round(tick_length);
                scale = 1.0/tick_length;
            }
            // increase the number of ticks if possible 5x, 4x, or 2x
            var tick5 = tick_length / 5.0;
            if (diff / tick5 <= maxlen) {
                tick_length = tick5;
                scale = scale * 5;
            } else {
                var tick4 = tick_length / 4.0;
                if (diff / tick4 <= maxlen) {
                    tick_length = tick4;
                    scale = scale * 4;
                } else {
                    var tick2 = tick_length / 2.0;
                    if (diff / tick2 <= maxlen) {
                        tick_length = tick2;
                        scale = scale * 2;
                    }
                }
            }
            // pick an anchor if not provided
            var smin = min_offset * scale;
            var smax = max_offset * scale;
            if (!anchor_provided) {
                var M = Math.floor((smin + smax) * 0.5);
                anchor = M / scale;
            }
            // generate the list
            var result = [anchor];
            while ((result[0] - tick_length) >= min_offset) {
                result.unshift((result[0] - tick_length))
            }
            var last = anchor;
            while ((last + tick_length) <= max_offset) {
                last = last + tick_length;
                result.push(last);
            }
            // clean the list -- try to eliminate float drift
            for (var i=0; i < result.length; i++) {
                var r = result[i];
                var rs = r * scale;
                var rrs = Math.round(rs);
                if (Math.abs(rrs - rs) < 0.01) {
                    r = rrs / scale;
                }
                result[i] = r
            }
            return result;
        }
    }

    $.fn.dual_canvas_helper.reference_frame = function(
        parent_canvas, 
        x_vector, 
        y_vector, 
        xy_offset) 
    {
        // View into canvas with shifted and scaled positions.
        // Do not adjust rectangle w/h or orientation, text parameters, or circle radius.
        if (!x_vector) {
            x_vector = {x: 1, y: 0};
        }
        if (!y_vector) {
            y_vector = {x: 0, y: 1};
        }
        if (!xy_offset) {
            xy_offset = {x: 0, y: 0};
        }
        var frame = $.extend({
            parent_canvas: parent_canvas,
            x_vector: x_vector,
            y_vector: y_vector,
            xy_offset: xy_offset,
        }, parent_canvas);

        frame.converted_location = function (x, y) {
            // Convert shared "model" location to "frame" location.
            // "scale" then translate (?)
            var x_scale = frame.vscale(x, frame.x_vector);
            var y_scale = frame.vscale(y, frame.y_vector);
            var xy = frame.vadd(x_scale, y_scale);
            var cvt = frame.vadd(frame.xy_offset, xy);
            // now DON't convert wrt parent
            //return frame.parent_canvas.converted_location(cvt.x, cvt.y);
            return cvt;
        };

        frame.model_location = function(mx, my) {
            // Convert "model" location to "frame" location.
            // untranslate
            var untranslated = {x: mx - frame.xy_offset.x, y: my - frame.xy_offset.y};
            // then "unscale"
            // http://www.mathcentre.ac.uk/resources/uploaded/sigma-matrices7-2009-1.pdf
            var a = frame.x_vector.x;
            var b = frame.y_vector.x;
            var c = frame.x_vector.y;
            var d = frame.y_vector.y;
            var det = a * d - b * c;
            var x_inv = {x: d / det, y: -c / det};
            var y_inv = {x: -b / det, y: a /det};
            var x_unscale = frame.vscale(untranslated.x, x_inv);
            var y_unscale = frame.vscale(untranslated.y, y_inv);
            return frame.vadd(x_unscale, y_unscale);
        };

        frame.pixel_offset = function(frame_x, frame_y) {
            // return the offset from the canvas upper left corner in pixels
            // of the frame location.
            var c = frame.converted_location(frame_x, frame_y);
            return frame.parent_canvas.pixel_offset(c.x, c.y)
        };

        frame.event_model_location = function(e) {
            var parent_location = frame.parent_canvas.event_model_location(e);
            //return frame.converted_location(parent_location.x, parent_location.y);
            return frame.model_location(parent_location.x, parent_location.y);
        }

        var override_positions = function(shape_name) {
            // replace the shape factory:
            // override the location conversion parameter
            frame[shape_name] = function(opt, wait) {
                var s = $.extend({
                    coordinate_conversion: frame.converted_location,
                    frame: frame,
                }, opt)
                var method = frame.parent_canvas[shape_name];
                return method(s, wait);
            }
        };
        override_positions("circle");
        override_positions("line");
        override_positions("text");
        override_positions("rect");
        override_positions("polygon");

        // define axes w.r.t the frame
        parent_canvas.dual_canvas_helper.add_axis_logic(frame);

        return frame;
    }

    $.fn.dual_canvas_helper.example = function(element, x, y, w, h) {
        if (!x) { x = 0; }
        if (!y) { y = 0; }
        if (!w) { w = 1.0; }
        if (!h) { h = 1.0; }
        element.empty();
        element.css("background-color", "cornsilk").width("520px");
        var config = {
            width: 400,
            height: 400,
            translate_scale: {x: x, y:y, w:w, h:h},
            y_up: true,
        }
        element.dual_canvas_helper(config);
        element.polygon({
            name: "polly", 
            points: [[250,100], [400,100], [280,180], [375,60], [370,180]],
            color: "#ffd",
        });
        element.axis({
            name_prefix: "axis",
            axis_origin: {x: 155, y:30},
            tick_line_config: {lineWidth: 2, color: "green"},
            connecting_line_config: {lineWidth: 5, color: "blue"},
            tick_text_config: {color: "red"},
            ticks: [
                5,  //{offset: 5},
                25.5, // {offset: 25.5},
                58, // {offset: 58}
            ]
        });
        element.bottom_axis({axis_origin: {x: 0, y: 220},});
        element.top_axis({axis_origin: {x: 0, y: 120},});
        element.right_axis({axis_origin: {x: 220, y: 0},});
        element.left_axis({axis_origin: {x: 120, y: 0},});
        element.lower_left_axes({
            x_anchor: 300,
            y_anchor: 320,
            tick_line_config: {color: "green"},
            tick_text_config: {color: "blue"},
        });
        element.circle({name: "green circle", x:160, y:70, r:20, color:"green"});
        element.rect({name:"a rect", x:10, y:50, w:10, h:120, color:"salmon", degrees:-15});
        element.text({name:"some text", x:40, y:40, text:"Canvas", color:"#64d", degrees:45,
            font: "bold 20px Arial",});
        element.line({name:"a line", x1:100, y1:100, x2:150, y2:130, color:"brown", lineWidth: 4});
        var info = $("<div>click the circle to pick it up..</div>").appendTo(element);
        var click_handler = function(e) {
            info.html(
                "<div>click at " + e.pixel_location.x +
                " "+e.pixel_location.y +
                " "+e.canvas_name +
                " "+e.invisible_color +
                "</div>");
        }
        var mouse_over_circle_handler = function(e) {
            info.html(
                "<div>rect mouse over at " + e.pixel_location.x +
                " "+e.pixel_location.y +
                " "+e.canvas_name +
                " "+e.invisible_color +
                "</div>");
        }
        element.on_canvas_event("mousemove", mouse_over_circle_handler, "a rect");
        element.on_canvas_event("click", click_handler);
        var put_circle = function(event) {
            var loc = element.event_model_location(event);
            var ploc = event.pixel_location;
            element.change_element("green circle", {"x":loc.x, "y":loc.y});
            info.html(
                "<div> [" + Math.round(loc.x) + ", " + Math.round(loc.y) + "] :: [" 
                + Math.round(ploc.x) + ", " + Math.round(ploc.y) 
                + "] </div>")
            // change_element automatically schedules a redraw
            //element.request_redraw();
        };
        var drop_circle = function(event) {
            info.html("<div>dropping circle</div>");
            element.off_canvas_event("click");
            element.off_canvas_event("mousemove");
            element.on_canvas_event("click", pick_up_circle, "green circle");
            element.on_canvas_event("click", click_handler);
        };
        var pick_up_circle = function(event) {
            info.html("<div>picking up circle</div>");
            element.on_canvas_event("mousemove", put_circle);
            element.on_canvas_event("click", drop_circle);  // automatically override other handler
            element.off_canvas_event("click", "green circle");
        };
        element.on_canvas_event("click", pick_up_circle, "green circle");
        element.fit()
        element.visible_canvas.canvas.css("background-color", "#a7a");
    };

    $.fn.dual_canvas_helper.lasso_example = function(element) {

        element.empty();
        element.css("background-color", "cornsilk").width("520px");
        var config = {
            width: 400,
            height: 400,
            y_up: true,
        }
        element.dual_canvas_helper(config);
        for (var i=20; i<400; i+=20) {
            for (var j=20; j<400; j+=20) {
                element.circle({name: ""+i+":"+j, x:i, y:j, r:4, color:"green"});
            }
        }
        //element.rect({name: "binky", x:-10, y:-10, h:500, w:500, color: "blue"})
        var lasso_callback = function(names_mapping) {
            for (var name in names_mapping) {
                element.change_element(name, {color: "pink"});
            }
        };
        // lasso and delete the lasso polygon afterward
        var delete_it=true;
        element.do_lasso(lasso_callback, {}, delete_it);
        $("<div>Please lasso some circles once to turn them pink.</div>").appendTo(element);
    };

    $.fn.dual_canvas_helper.frame_example = function(element) {
        element.empty();
        element.css("background-color", "cornsilk").width("520px");
        var config = {
            width: 400,
            height: 400,
            y_up: true,
        }
        element.dual_canvas_helper(config);
        element.text({x:70, y:10, text:"Frame Test", color:"#64d", degrees:45, font: "bold 20px Arial",});
        var backward = element.rframe(-2, 2, 200, 200);
        // exercise coordinate conversion
        var x = 11;
        var y = -77;
        var c = backward.converted_location(x, y);
        var ic = backward.model_location(c.x, c.y);
        $("<div>" + x + "," + y + " :: " + c.x + "," + c.y + " :: " + ic.x + "," + ic.y + "</div>").appendTo(element);
        backward.text({
            text: "Backward",
            align: "right",
            x: 20,
            y: 20,
            color: "red"
        });
        var down = element.rframe(-1, -1, 200, 200);
        down.text({
            text: "Down",
            align: "right",
            x: 20,
            y: 20,
            color: "red"
        });
        var forward = element.rframe(1, 1, 200, 200);
        forward.text({
            text: "Forward",
            align: "left",
            x: 20,
            y: 20,
            color: "red"
        });
        var rotate = element.vector_frame(
            {x:1, y:2},
            {x:1, y:-1},
            {x:240, y:160}
        )
        rotate.text({
            text: "Rotate/skew",
            align: "right",
            x: 20,
            y: 20,
            color: "red"
        });
        var frames = [element, backward, forward, down, rotate];
        for (var i=0; i<frames.length; i++) {
            //element.visible_canvas.show_debug_bbox();
            var frame = frames[i];
            for (var x=0; x<101; x+=10) {
                frame.line({
                    x1: x,
                    y1: 0,
                    x2: x,
                    y2: 100,
                    color: "#aa9"
                });
                frame.line({
                    x1: 0,
                    y1: x,
                    x2: 100,
                    y2: x,
                    color: "#aa9"
                });
            }
            var points = [
                [20, 20],
                [40, 20],
                [20, 40],
                [40, 40],
                [40, 60]
            ];
            element.visible_canvas.show_debug_bbox();
            frame.polygon({
                points: points,
                fill: false,
                close: false,
                color: "blue"
            });
            element.visible_canvas.show_debug_bbox();
            frame.circle({
                x: 40, y: 60, r: 10, color: "green"
            });
            frame.rect({
                x: 60, y:80, w:10, h:10, color: "purple"
            })
            if (frame!=element) {
                var x = 30;
                var y = 65;
                var c = frame.converted_location(x, y);
                var ic = frame.model_location(c.x, c.y);
                c = frame.vint(c);
                ic = frame.vint(ic);
                element.circle({
                    x: c.x, y: c.y, r: 7, color: "#449"
                })
                frame.text({
                    text: "" + c.x + "," + c.y + " :: " + ic.x + "," + ic.y,
                    x: x, y: y, color: "#FFD"
                });
            }
        }
        element.fit();
        element.visible_canvas.show_debug_bbox(true);
        element.visible_canvas.canvas.css("background-color", "#a7a");
    }

})(jQuery);
