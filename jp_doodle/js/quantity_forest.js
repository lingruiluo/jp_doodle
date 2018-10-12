/*

JQuery plugin helper viewing hierarchies of quantities, like sizes of files and directories.

Presumes element has been initialized as a dual canvas.

Structure follows: https://learn.jquery.com/plugins/basic-plugin-creation/

*/

"use strict";

(function($) {
    $.fn.quantity_forest = function (options, element) {
        element = element || this;

        var settings = $.extend({
            width: 600,
            dy: 50,
            dh: 20,
            background: "cornsilk",
            id_click: null,
            top_label: "ROOT"
        }, options);

        element.forest_settings = settings;

        element.reset_roots = function(roots) {
            settings.roots = roots;
            element.draw_forest();
        }

        // tooltip
        let arraytip = $("<div>tooltip here</div>").appendTo(element);
        arraytip.css({
            position: "absolute",
            width: "140px",
            height: "auto",
            background: settings.background,
            font: "12px sans-serif",
            opacity: 0
        });

        let mouseclick = function(event) {
            if (settings.id_click) {
                var info = event.object_info;
                settings.id_click(info.name);
            } else {
                arraytip.html("<div>no click callback defined</div>")
            }
        };

        let mouseover = function(event) {
            var info = event.object_info;
            var pixel_offset = event.pixel_location;
            arraytip.html("<div>" + info.label + "</div>");
            let element_offset = element.offset();
            arraytip.offset({
                left: pixel_offset.x + element_offset.left + 30,
                top: pixel_offset.y + element_offset.top + 30,
            });
            arraytip.css({opacity: 0.8});
        }

        //element.rect({x: 0, y:0, w:settings.width, h:settings.dy, color:"#ddd"});
        //element.rect({x: 0, y:0, w:settings.width, h:settings.dh, color:"#999"});
        //element.text({x: 0, y:-settings.dh, text: settings.top_label});

        element.draw_forest = function () {
            arraytip.css({opacity: 0});
            element.reset_canvas();
            element.text({x: 0, y:-settings.dh, text: settings.top_label});
            let pick_a_color = function () {
                var arr = element.next_pseudocolor();
                return element.array_to_color(arr);
            };
            var initial_group = {
                parent: null,
                members: settings.roots.map(function(root) { return {root: root, parent:null}; }),
            };
            var format_groups = function(groups, level) {
                var next_groups = [];
                var total_size = 0;
                for (var g=0; g<groups.length; g++) {
                    var group = groups[g];
                    var group_size = 0;
                    var members = group.members;
                    for (var m=0; m<members.length; m++) {
                        var member = members[m];
                        group_size += member.root.size;
                    }
                    group.size = group_size;
                    total_size += group_size;
                }
                var level_frame = element.frame_region(
                    0, level * settings.dy, settings.width, (level + 1) * settings.dy,
                    0, 0, settings.width, settings.dy,
                );
                var x_scale = settings.width * 1.0 / total_size;
                var x_cursor = 0;
                //element.print('total size', total_size, " x_scale:", x_scale);
                for (var g=0; g<groups.length; g++) {
                    var group = groups[g];
                    group.x_start = x_cursor;
                    var members = group.members;
                    for (var m=0; m<members.length; m++) {
                        var member = members[m];
                        var root = member.root;
                        if (!root.color) {
                            root.color = pick_a_color();
                        }
                        member.x_start = x_cursor;
                        var scaled_size = x_scale * root.size;
                        //element.print("at", x_cursor, scaled_size, settings.dh)
                        var rect = level_frame.frame_rect({
                            x: x_cursor, y:0, w:scaled_size, h:settings.dh, color:root.color,
                            name: root.id, label: root.label,
                        });
                        rect.on("mousemove", mouseover);
                        rect.on("click", mouseclick);
                        x_cursor += scaled_size;
                        member.x_end = x_cursor;
                        if (member.parent) {
                            //debugger;
                            var points = [
                                [member.x_start, 0],
                                [member.parent.x_start, settings.dh - settings.dy],
                                [member.parent.x_end, settings.dh - settings.dy],
                                [member.x_end, 0],
                            ];
                            level_frame.polygon({points: points, color: member.parent.root.color});
                        }
                        if (settings.degrees) {
                            level_frame.text({
                                degrees: settings.degrees,
                                text: root.label,
                                x: member.x_start,
                                y: 0,
                                background: settings.background,
                            })
                        }
                        if ((root.expanded) && (root.children)) {
                            var children = root.children;
                            if (children.length > 0) {
                                var group = {
                                    parent: member,
                                    members: children.map(
                                        function(root) {
                                            return { root: root, parent: member };
                                        }
                                    ),
                                };
                                next_groups.push(group);
                            }
                        }
                    }
                    group.x_end = x_cursor;
                }
                if (next_groups.length > 0) {
                    format_groups(next_groups, level + 1);
                }
            };
            format_groups([initial_group], 0)
            element.fit(null, 20);
        };

        element.draw_forest();
        //element.fit(null, 20);
    };

    $.fn.quantity_forest.example = function(element) {
        var child1 = {
            id: "first child",
            label: "child1",
            size: 15,
            //color: "green",
            get_children: null,
            expanded:false
        };
        var child2 = {
            id: "second child",
            label: "child2",
            size: 25,
            color: "magenta",
            children: null,
            expanded:false
        };
        var root1 = {
            id: "first root",
            label: "root1",
            size: 35,
            color: "cyan",
            children: null,
            expanded:false
        };
        var root2 = {
            id: "second root",
            label: "root2",
            size: 25,
            color: "blue",
            children: [child1, child2],
            expanded:true
        };

        var canvas_config = {
            width: 600,
            height: 400,
            //translate_scale: {x: x, y:y, w:w, h:h},
        };
        element.dual_canvas_helper(canvas_config);

        var forest_config = {
            roots: [root1, root2],
            width: 600,
            dy: 50,
            dh: 20,
            id_click: function(id) { alert("click on id: " + id); },
            degrees: 30,
        }
        element.quantity_forest(forest_config);
    }
})(jQuery);
