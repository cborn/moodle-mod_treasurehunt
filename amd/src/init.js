/* global require */

// Standard license block omitted.
/*
 * @package    block_overview
 * @copyright  2015 Someone cool
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * @module block_overview/helloworld
 */
require.config({
    baseUrl: 'js',
    shim: {
        openlayers: {
            exports: 'OpenLayers'
        },
    },
    paths: {
        openlayers: 'openlayers/ol-debug',
        geocoderjs: 'geocoder/geocoder',
        selectpart: 'openlayers/selectpart',
        turf: 'turf/turf'
    }
});


define(['jquery', 'core/notification', 'core/str', 'openlayers', 'jqueryui', 'core/ajax'], function($, notification, str, ol, jqui, ajax) {


    var init = {
        init: function(idModule, idStage) {


            //Lo primero recojo todas las cadenas que voy a necesitar con una llamada ajax
            var ajaxStrings = [{
                key: 'insert_riddle',
                component: 'scavengerhunt'
            }, {
                key: 'insert_road',
                component: 'scavengerhunt'
            }, {
                key: 'empty_ridle',
                component: 'scavengerhunt'
            }];
            str.get_strings(ajaxStrings).done(function(data) {
                /** Global var ***************************************************************
                 */
                var stage;
                var dirtyStage = new ol.source.Vector({
                    projection: 'EPSG:3857'
                });
                var originalStage = new ol.source.Vector({
                    projection: 'EPSG:3857'
                });
                var dirty = false;
                var numRiddle;
                var idRoad = -1;
                var idRiddle = -1;
                var selectedFeatures;
                var selectedRiddleFeatures = new Object();
                var idNewFeature = 1;
                var Strings = getKeyValue(ajaxStrings, data);


                /**Initialize stage and selectedRiddleFeatures******************************************************
                 */
                stage = {
                    "roads": {
                        "-1": {
                            id: -1,
                            name: Strings.insert_road
                        }
                    }
                };


                function getKeyValue(key, value) {
                    var object = new Object();
                    for (var i = 0, j = key.length; i < j; i++) {
                        object[key[i].key] = value[i];
                    }
                    return object;
                }
                /**Load the control pane, riddle and road list ***************************************************
                 */
                //$("#controlPanel").addClass('ui-widget-header ui-corner-all');
                $('<span id="edition"/>').appendTo($("#controlPanel"));
                $('<input type="radio" name="controlPanel" id="radio1" value="add" checked>').appendTo($("#edition"));
                $("<label>").attr('for', "radio1").text('Añadir').appendTo($("#edition"));
                $('<input type="radio" name="controlPanel" id="radio2" value="modify">').appendTo($("#edition"));
                $("<label>").attr('for', "radio2").text('Modificar').appendTo($("#edition"));
                $('<button id="removeFeature"/>').attr('disabled', true).text('Eliminar').appendTo($("#controlPanel"));
                $('<button id="saveRiddle"/>').attr('disabled', true).text('Guardar cambios').appendTo($("#controlPanel"));
                $('<button id="addRiddle"/>').text('Riddle').prependTo($("#controlPanel"));
                $("#radio1").button({
                   text: false,
                    icons: {
                        primary: "ui-icon-plusthick"
                    }
                });
                $("#radio2").button({
                    text: false,
                    icons: {
                        primary: "ui-icon-pencil"
                    }
                });
                $("#removeFeature").button({
                    text: false,
                    icons: {
                        primary: "ui-icon-trash"
                    }
                });
                $("#saveRiddle").button({
                    text: false,
                    icons: {
                        primary: "ui-icon-disk"
                    }
                });
                $("#addRiddle").button({
                    icons: {
                        primary: " ui-icon-circle-plus"
                    },
                });
                //Lo cargo como un buttonset
                $("#edition").buttonset();
                //Creo el riddleListPanel
                $('<span/>').text('Has seleccionado').appendTo($("#controlPanel"));
                $('<span id="select_result"/>').text(' nada').appendTo($("#controlPanel"));
                $('<ul id="riddleList"/>').appendTo($("#riddleListPanel"));
            
                //Lo cargo como un sortable
                $("#riddleList").sortable({
                    handle: ".handle",
                    revert: true,
                    cursor: "move",
                    axis: 'y',
                    start: function(event, ui) {
                        var idRoad = ui.item.attr('idRoad');
                        var start_pos = ui.item.index('li[idRoad="' + idRoad + '"]');
                        ui.item.data('start_pos', start_pos);
                    },
                    update: function(event, ui) {
                        var start_pos = ui.item.data('start_pos');
                        var idRoad = ui.item.attr('idRoad');
                        var end_pos = ui.item.index('li[idRoad="' + idRoad + '"]');
                        var $listitems = $(this).children('li[idRoad="' + idRoad + '"]');
                        var $listlength = $($listitems).length;
                        if (start_pos === end_pos) {
                            return;
                        }
                        if (start_pos < end_pos) {
                            for (var i = start_pos; i <= end_pos; i++) {
                                relocateRiddleList($listitems, $listlength, i, dirtyStage, originalStage, stage["roads"][idRoad].vector);
                            }
                        } else{
                            for (var i = end_pos; i <= start_pos; i++) {
                                relocateRiddleList($listitems, $listlength, i, dirtyStage, originalStage, stage["roads"][idRoad].vector);
                            }
                        }
                        $('#saveRiddle').button("option", "disabled", false);
                    }
                });

                function relocateRiddleList($listitems, $listlength, i, dirtyStage, originalStage, vector) {
                    var newVal;
                    var $item = $($listitems).get([i]);
                    var idRoad = $($item).attr('idRoad');
                    newVal = Math.abs($($item).index('li[idRoad="' + idRoad + '"]') - $listlength) - 1;
                    $($item).attr('numRiddle', newVal);
                    $($item).find('.sortable-number').text(newVal);
                    //Si esta seleccionado cambiamos el valor de numRiddle
                    if ($($item).hasClass("ui-selected")) {
                        numRiddle = newVal;
                    }
                    relocateNumRiddle(parseInt($($item).attr('idRiddle')), newVal, parseInt($($item).attr('idRoad')), dirtyStage, originalStage, vector);
                }

                //Creo el roadListPanel
                $('<ul id="roadList"/>').appendTo($("#roadListPanel"));




                /** Get style, vectors, map and interactions ***************************************************************
                 */
                var defaultRiddleStyle = new ol.style.Style({
                    fill: new ol.style.Fill({
                        color: 'rgba(0, 0, 0, 0.1)'
                    }),
                    stroke: new ol.style.Stroke({
                        color: '#6C0492',
                        width: 2
                    }),
                    image: new ol.style.Circle({
                        radius: 5,
                        fill: new ol.style.Fill({
                            color: '#ffcc33'
                        }),
                        stroke: new ol.style.Stroke({
                            color: '#000000',
                            width: 2
                        })
                    }),
                    text: new ol.style.Text({
                        textAlign: 'center',
                        scale: 1.3,
                        fill: new ol.style.Fill({
                            color: '#fff'
                        }),
                        stroke: new ol.style.Stroke({
                            color: '#6C0492',
                            width: 3.5
                        })
                    }),
                });
                //Estilo pista seleccionada
                var selectedRiddleStyle = new ol.style.Style({
                    fill: new ol.style.Fill({
                        color: 'rgba(0, 0, 0, 0.05)'
                    }),
                    stroke: new ol.style.Stroke({
                        color: '#FAC30B',
                        width: 2
                    }),
                    image: new ol.style.Circle({
                        radius: 5,
                        fill: new ol.style.Fill({
                            color: '#ffcc33'
                        }),
                        stroke: new ol.style.Stroke({
                            color: '#000000',
                            width: 2
                        })
                    }),
                    text: new ol.style.Text({
                        textAlign: 'center',
                        scale: 1.3,
                        fill: new ol.style.Fill({
                            color: '#fff'
                        }),
                        stroke: new ol.style.Stroke({
                            color: '#ffcc33',
                            width: 3.5
                        })
                    }),
                    zIndex: 'Infinity'
                });
                var vectorDraw = new ol.layer.Vector({
                    source: new ol.source.Vector({
                        projection: 'EPSG:3857'
                    }),
                    visible: false
                });

                var map = new ol.Map({
                    layers: [
                    new ol.layer.Tile({
                        source: new ol.source.OSM()
                    }), vectorDraw],
                    renderer: 'canvas',
                    target: 'map',
                    view: new ol.View({
                        center: new ol.proj.transform([-4.715354, 41.654618], 'EPSG:4326', 'EPSG:3857'),
                        zoom: 12,
                        minZoom: 2
                    })
                });

                var Modify = {
                    init: function() {
                        this.select = new ol.interaction.Select();
                        map.addInteraction(this.select);

                        this.modify = new ol.interaction.Modify({
                            features: this.select.getFeatures(),
                            style: new ol.style.Style({
                                image: new ol.style.Circle({
                                    radius: 5,
                                    fill: new ol.style.Fill({
                                        color: '#3399CC'
                                    }),
                                    stroke: new ol.style.Stroke({
                                        color: '#000000',
                                        width: 2
                                    })
                                })
                            }),
                            deleteCondition: function(event) {
                                return ol.events.condition.shiftKeyOnly(event) && ol.events.condition.singleClick(event);
                            }
                        });
                        map.addInteraction(this.modify);
                        this.setEvents();
                    },
                    setEvents: function() {
                        //Elimino la seleccion de features cuando cambia a off
                        selectedFeatures = this.select.getFeatures();
                        this.select.on('change:active', function() {
                            if (!this.getActive()) {
                                selectedFeatures.clear();
                            }
                        });
                        //Activo o desactivo el boton de borrar segun tenga una feature seleccionada o no
                        this.select.on('select', function() {
                            setActivateRemoveBotton(selectedFeatures);
                        });
                        //Activo el boton de guardar segun se haya modificado algo o no
                        this.modify.on('modifyend', function(e) {
                            $('#saveRiddle').button("option", "disabled", false);
                            debugger;
                            modifyFeatureToDirtySource(e.features, originalStage, dirtyStage, stage["roads"][idRoad].vector);
                            dirty = true;
                        });
                    },
                    setActive: function(active) {
                        this.select.setActive(active);
                        this.modify.setActive(active);
                    }
                };
                Modify.init();


                var Draw = {
                    init: function() {
                        map.addInteraction(this.Polygon);
                        this.Polygon.setActive(false);
                        this.setEvents();
                    },
                    Polygon: new ol.interaction.Draw({
                        source: vectorDraw.getSource(),
                        type: /** @type {ol.geom.GeometryType} */
                        ('Polygon'),
                        style: new ol.style.Style({
                            fill: new ol.style.Fill({
                                color: 'rgba(0, 0, 0, 0.05)'
                            }),
                            stroke: new ol.style.Stroke({
                                color: '#FAC30B',
                                width: 2
                            }),
                            image: new ol.style.Circle({
                                radius: 5,
                                fill: new ol.style.Fill({
                                    color: '#ffcc33'
                                }),
                                stroke: new ol.style.Stroke({
                                    color: '#000000',
                                    width: 2
                                })
                            }),
                            zIndex: 'Infinity'
                        })
                    }),
                    setEvents: function() {
                        //Fijo el riddle al que pertenecen y activo el boton de guardar 
                        //segun se haya modificado algo o no
                        this.Polygon.on('drawend', function(e) {

                            e.feature.setProperties({
                                'idRoad': idRoad,
                                'idRiddle': idRiddle,
                                'numRiddle': numRiddle
                            });
                            selectedRiddleFeatures[idNewFeature] = true;
                            e.feature.setId(idNewFeature);
                            idNewFeature++;
                            //Agrego la nueva feature a su correspondiente vector de poligonos
                            stage["roads"][idRoad].vector.getSource().addFeature(e.feature);
                            //Agrego la feature a la coleccion de multipoligonos sucios
                            addNewFeatureToDirtySource(e.feature, originalStage, dirtyStage);

                            //Limpio el vector de dibujo
                            vectorDraw.getSource().clear();
                            $('#saveRiddle').button("option", "disabled", false);
                            dirty = true;
                        });
                    },
                    getActive: function() {
                        return this.activeType ? this[this.activeType].getActive() : false;
                    },
                    setActive: function(active) {
                        if (active) {
                            this.activeType && this[this.activeType].setActive(false);
                            this.Polygon.setActive(true);
                            this.activeType = 'Polygon';
                        } else {
                            this.activeType && this[this.activeType].setActive(false);
                            this.activeType = null;
                        }
                    }
                };
                $(document).keyup(function(e) {
                    //Si pulso la tecla esc dejo de dibujar
                    if (e.keyCode === 27) // esc
                    {
                        Draw.Polygon.abortDrawing_();
                    }
                });

                Draw.init();
                Draw.setActive(true);
                Modify.setActive(false);

                // The snap interaction must be added after the Modify and Draw interactions
                // in order for its map browser event handlers to be fired first. Its handlers
                // are responsible of doing the snapping.
                var snap = new ol.interaction.Snap({
                    source: vectorDraw.getSource()
                });
                map.addInteraction(snap);


                //Cargo las features
                fetchFeatures();


                function addNewFeatureToDirtySource(dirtyFeature, originalSource, dirtySource) {
                    var idRiddle = dirtyFeature.get('idRiddle');
                    var feature = dirtySource.getFeatureById(idRiddle);
                    if (feature) {
                        feature.getGeometry().appendPolygon(dirtyFeature.getGeometry());
                        if (feature.get('idFeaturesPolygons') === 'empty') {
                            feature.setProperties({
                                'idFeaturesPolygons': ''+ dirtyFeature.getId()
                            });
                        } else {
                            feature.setProperties({
                                'idFeaturesPolygons': feature.get('idFeaturesPolygons') + ',' + dirtyFeature.getId()
                            });
                        }
                    } else {
                        if (idRiddle !== -1) {
                            feature = originalSource.getFeatureById(idRiddle).clone();
                            feature.setProperties({
                                'idFeaturesPolygons': feature.get('idFeaturesPolygons') + ',' + dirtyFeature.getId()
                            });
                            feature.setId(idRiddle);
                            //Desactivo la creacion de nuevas pistas en el resto de caminos
                        } else {
                            feature = new ol.Feature(new ol.geom.MultiPolygon());
                            feature.setProperties({
                                'idFeaturesPolygons': '' + dirtyFeature.getId(),
                                'idRoad': dirtyFeature.get('idRoad'),
                                'numRiddle': dirtyFeature.get('numRiddle')
                            });
                            //Si ya he instartado un -1 no deberia dejar insertar mas en otros caminos
                        }
                        feature.getGeometry().appendPolygon(dirtyFeature.getGeometry());
                        feature.setId(idRiddle);
                        dirtySource.addFeature(feature);
                    }
                }

                function modifyFeatureToDirtySource(dirtyFeatures, originalSource, dirtySource, vector) {

                    dirtyFeatures.forEach(function(dirtyFeature) {
                        debugger;
                        var idRiddle = dirtyFeature.get('idRiddle');
                        var feature = dirtySource.getFeatureById(idRiddle);
                        var idFeaturesPolygons;
                        var polygons = new ol.Collection();
                        if (!feature) {
                            feature = originalSource.getFeatureById(idRiddle).clone();
                            feature.setId(idRiddle);
                            dirtySource.addFeature(feature);
                        }
                        var multipolygon = feature.getGeometry();
                        //Get those multipolygons of vector layer 
                        idFeaturesPolygons = feature.get('idFeaturesPolygons').split(",");
                        for (var i = 0, j = idFeaturesPolygons.length; i < j; i++) {
                            polygons.push(vector.getSource().getFeatureById(idFeaturesPolygons[i]).getGeometry().clone());
                        }
                        multipolygon.setPolygons(polygons.getArray());
                    });
                }

                function removeFeatureToDirtySource(dirtyFeatures, originalSource, dirtySource, vector) {

                    dirtyFeatures.forEach(function(dirtyFeature) {
                        debugger;
                        var idRiddle = dirtyFeature.get('idRiddle');
                        var feature = dirtySource.getFeatureById(idRiddle);
                        var idFeaturesPolygons;
                        var polygons = new ol.Collection();
                        var remove;
                        if (!feature) {
                            feature = originalSource.getFeatureById(idRiddle).clone();
                            feature.setId(idRiddle);
                            dirtySource.addFeature(feature);
                        }
                        var multipolygon = feature.getGeometry();
                        //Get those multipolygons of vector layer which idRiddle isn't id of dirtyFeature
                        idFeaturesPolygons = feature.get('idFeaturesPolygons').split(",");
                        for (var i = 0, j = idFeaturesPolygons.length; i < j; i++) {
                            if (idFeaturesPolygons[i] != dirtyFeature.getId()) {
                                polygons.push(vector.getSource().getFeatureById(idFeaturesPolygons[i]).getGeometry().clone());
                            } else {
                                remove = i;
                            }
                        }
                        multipolygon.setPolygons(polygons.getArray());
                        if (multipolygon.getPolygons().length) {
                            idFeaturesPolygons.splice(remove, 1);
                            feature.setProperties({
                                'idFeaturesPolygons': idFeaturesPolygons.join()
                            });
                        } else {
                            feature.setProperties({
                                'idFeaturesPolygons': 'empty'
                            });
                        }

                    });
                }

                function styleFunction(feature) {
                    // get the incomeLevel from the feature properties
                    var numRiddle = feature.get('numRiddle');
                    if (!isNaN(numRiddle)) {
                        selectedRiddleStyle.getText().setText('' + numRiddle);
                        defaultRiddleStyle.getText().setText('' + numRiddle);
                    }
                    // if there is no level or its one we don't recognize,
                    // return the default style (in an array!)
                    if (selectedRiddleFeatures[feature.getId()]) {
                        return [selectedRiddleStyle];
                    }
                    // check the cache and create a new style for the income
                    // level if its not been created before.
                    // at this point, the style for the current level is in the cache
                    // so return it (as an array!)
                    return [defaultRiddleStyle];
                }





                function fetchFeatures() {
                    var geojson = ajax.call([{
                        methodname: 'mod_scavengerhunt_fetchstage',
                        args: {
                            idStage: idStage
                        }
                    }]);
                    geojson[0].done(function(response) {
                        console.log('json: ' + response);
                        var vector;
                        var geoJSON = new ol.format.GeoJSON();
                        var roads = JSON.parse(response[1]);
                        if (roads.constructor !== Array) {
                            $.extend(stage["roads"], roads);
                        }
                        //agrego los vectores a cada camino
                        for (var road in stage["roads"]) {
                            if (stage["roads"].hasOwnProperty(road)) {
                                makeRoadLisPanel(stage["roads"][road].id, stage["roads"][road].name);
                                vector = new ol.layer.Vector({
                                    source: new ol.source.Vector({
                                        projection: 'EPSG:3857'
                                    }),
                                    updateWhileAnimating: true,
                                    style: styleFunction
                                });
                                stage["roads"][road].vector = vector;
                                map.addLayer(vector);
                            }
                        }
                        //Add stage features to source originalStage
                        originalStage.addFeatures(geoJSON.readFeatures(response[0], {
                            'dataProjection': "EPSG:4326",
                            'featureProjection': "EPSG:3857"
                        }));
                        numRiddle = originalStage.getFeatures().length;
                        originalStage.forEachFeature(function(feature) {
                            var polygons = feature.getGeometry().getPolygons();
                            var idNewFeatures;
                            var idRiddle = feature.getId();
                            var idRoad = feature.get('idRoad');
                            var numRiddle = feature.get('numRiddle');
                            var name = feature.get('name');
                            for (var i = 0; i < polygons.length; i++) {
                                var newFeature = new ol.Feature(feature.getProperties());
                                newFeature.setProperties({
                                    'idRiddle': idRiddle
                                });
                                var polygon = polygons[i];
                                newFeature.setGeometry(polygon);
                                newFeature.setId(idNewFeature);
                                if (i === 0) {
                                    idNewFeatures = idNewFeature;
                                } else {
                                    idNewFeatures = idNewFeatures + ',' + idNewFeature;
                                }
                                idNewFeature++;
                                stage["roads"][idRoad].vector.getSource().addFeature(newFeature);
                            }
                            feature.setProperties({
                                idFeaturesPolygons: '' + idNewFeatures
                            });
                            makeRiddleListPanel(idRiddle, idRoad, numRiddle, name);
                        });
                        //agrego las pistas iniciales a cada camino con su numRiddle correspondiente
                        for (var road in stage["roads"]) {
                            if (stage["roads"].hasOwnProperty(road)) {
                                makeRiddleListPanel(-1, road, null, Strings.insert_riddle);
                            }
                        }
                        //Selecciono el primer camino y recojo el numRiddle 
                        for (var road in stage["roads"]) {
                            if (stage["roads"].hasOwnProperty(road)) {
                                idRoad = road;
                                selectRoad(road, stage["roads"][road].vector, map, selectedFeatures);
                                break;
                            }
                        }
                        /*selectRoad(stage[1].id, vector);
                         idRoad = stage[1].id;*/

                    }).fail(function(ex) {
                        console.log(ex);
                    });
                }


                /** Panel functions ***************************************************************
                 */
                function removeFeatures(selectedFeatures, vector) {
                    selectedFeatures.forEach(function(feature) {
                        vector.getSource().removeFeature(feature);
                    });
                    selectedFeatures.clear();

                }

                function makeRiddleListPanel(idRiddle, idRoad, numRiddle, name) {

                    
                    if (idRiddle !== -1) {
                        $('<li idRiddle="' + idRiddle + '" idRoad="' + idRoad + '" numRiddle="' + numRiddle + '"/>').text(name).appendTo($("#riddleList")).addClass("ui-corner-all").prepend("<div class='handle'><span class='ui-icon ui-icon-arrowthick-2-n-s'></span><span class='sortable-number'>" + numRiddle + "</span></div>").append("<div class='modifyRiddle'><span class='ui-icon ui-icon-trash'></span><span class='ui-icon ui-icon-pencil'></span></div>");
                    } else {
                        numRiddle = $('#riddleList li[idRoad="' + idRoad + '"]').length;
                        $('<li idRiddle="' + idRiddle + '" idRoad="' + idRoad + '" numRiddle="' + numRiddle + '"/>').text(name).prependTo($("#riddleList")).addClass("ui-corner-all").prepend("<div class='handle'><span class='ui-icon ui-icon-arrowthick-2-n-s'></span><span class='sortable-number'>" + numRiddle + "</span></div>");
                    }

                }

                function makeRoadLisPanel(idRoad, name) {
                    //Si no existe lo agrego
                    if ($('#roadList li[idRoad="' + idRoad + '"]').length < 1) {
                        $('<li idRoad="' + idRoad + '"/>').text(name).appendTo($("#roadList")).addClass("ui-corner-all").append("<div class='modifyRiddle'><span class='ui-icon ui-icon-trash'></span><span class='ui-icon ui-icon-pencil'></span></div>");;
                    }
                }
                //Activo o desactivo el boton de borrar segun tenga una feature seleccionada o no
                function setActivateRemoveBotton(selectedFeatures) {
                    if (selectedFeatures.getLength() > 0) {
                        $('#removeFeature').button("option", "disabled", false);

                    } else {
                        $('#removeFeature').button("option", "disabled", true);
                    }
                }

                function deactivateEdition() {
                    var radioButton = $("#edition").find("input:radio");
                    radioButton.attr('checked', false).button("refresh");
                    radioButton.button("option", "disabled", true);
                    Draw.setActive(false);
                    Modify.setActive(false);
                }

                function activateEdition() {
                    $("#edition").find("input:radio").button("option", "disabled", false);
                }

                function flyTo(map, vectorSelected) {
                    var duration = 500;
                    var view = map.getView();
                    var extent = vectorSelected.getSource().getExtent();
                    var size = map.getSize();
                    var pan = ol.animation.pan({
                        duration: duration,
                        source: /** @type {ol.Coordinate} */
                        (view.getCenter()),
                    });
                    var zoom = ol.animation.zoom({
                        duration: duration,
                        resolution: view.getResolution(),
                    });

                    map.beforeRender(pan, zoom);
                    view.fit(extent, size);
                }

                function selectRoad(idRoad, vectorOfPolygons, map, selectedFeatures) {

                    //Limpio todas las features seleccionadas,oculto todos los li y solo muestro los que tengan el idRoad 
                    //selectRiddleFeatures(vectorOfPolygons, null, selectedFeatures);
                    $("#riddleList li").removeClass("ui-selected").hide();
                    $("#riddleList li[idRoad='" + idRoad + "']").show();
                    //Si no esta marcado el li road lo marco
                    $("#roadList li[idRoad='" + idRoad + "']").addClass("ui-selected");
                    //Dejo visible solo el vector con el idRoad
                    map.getLayers().forEach(function(layer) {
                        if (layer instanceof ol.layer.Vector) {
                            layer.setVisible(false);
                        }
                    });
                    vectorOfPolygons.setVisible(true);
                    if (vectorOfPolygons.getSource().getFeatures().length > 0) {
                        flyTo(map, vectorOfPolygons);
                    }
                }

                //Revisar funcion por si se puede mejorar, tipo coger los ids de originalStage o dirtyStage y marcarlos como selected
                function selectRiddleFeatures(vectorOfPolygons, selected, selectedFeatures, dirtySource, originalSource) {
                    var vectorSelected = new ol.layer.Vector({
                        source: new ol.source.Vector({
                            projection: 'EPSG:3857'
                        })
                    });
                    selectedRiddleFeatures = new Object();
                    var feature = dirtySource.getFeatureById(selected);
                    if (!feature) {
                        feature = originalSource.getFeatureById(selected);
                        if (!feature) {
                            //Incremento la version para que se recargue el mapa y se deseleccione la marcada anteriormente
                            vectorOfPolygons.changed();
                            return;
                        }
                    } else {
                        if (feature.get('idFeaturesPolygons') === 'empty') {
                            //Incremento la version para que se recargue el mapa y se deseleccione la marcada anteriormente
                            vectorOfPolygons.changed();
                            return;
                        }
                    }
                    //Agrego a mi objecto que almacena los poligonos seleccionados y tambien agrego al vector al que se le aplica la animacion
                    var idFeaturesPolygons = feature.get('idFeaturesPolygons').split(",");
                    for (var i = 0, j = idFeaturesPolygons.length; i < j; i++) {
                        vectorSelected.getSource().addFeature(vectorOfPolygons.getSource().getFeatureById(idFeaturesPolygons[i]).clone());
                        selectedRiddleFeatures[idFeaturesPolygons[i]] = true;
                    }
                    //Deselecciono cualquier feature anterior
                    selectedFeatures.clear();
                    //Coloco el mapa en la posicion de las pistas seleccionadas si la pista contiene alguna feature y 
                    //postergando el tiempo para que seleccione la nueva feature.
                    if (vectorSelected.getSource().getFeatures().length) {
                        flyTo(map, vectorSelected);
                    }
                }


                function relocateNumRiddle(idRiddle, numRiddle, idRoad, dirtySource, originalSource, vector) {
                    var feature = dirtySource.getFeatureById(idRiddle);
                    var idFeaturesPolygons;
                    if (!feature) {
                        //Si he movido una nueva pista vacía la creo y la dejo como vacía
                        if (idRiddle === -1) {
                            feature = new ol.Feature(new ol.geom.MultiPolygon(new Array()));
                            feature.setProperties({
                                'idFeaturesPolygons': 'empty',
                                'idRoad': idRoad
                            });
                        } else {
                            feature = originalSource.getFeatureById(idRiddle).clone();
                        }
                        feature.setId(idRiddle);
                        dirtySource.addFeature(feature);
                    }
                    feature.setProperties({
                        'numRiddle': numRiddle
                    });
                    if (feature.get('idFeaturesPolygons') !== 'empty') {
                        idFeaturesPolygons = feature.get('idFeaturesPolygons').split(",");
                        for (var i = 0, j = idFeaturesPolygons.length; i < j; i++) {
                            vector.getSource().getFeatureById(idFeaturesPolygons[i]).setProperties({
                                'numRiddle': numRiddle
                            });

                        }
                    }
                }


                function editFormEntry(idRiddle) {
                    var url = 'save_riddle.php?cmid=' + idModule + '&id=' + idRiddle;
                    window.location.href = url;
                }

                function deleteRiddles(idRiddles) {
                    var json = ajax.call([{
                        methodname: 'mod_scavengerhunt_deletestage',
                        args: {
                            idRiddles: idRiddles
                        }
                    }]);
                    json[0].done(function(response) {
                        console.log(response);
                    }).fail(function(ex) {
                        console.log(ex);
                    });
                }

                $("#removeFeature").on('click', function() {
                    notification.confirm('Ã‚Â¿Estas seguro?', 'Si la eliminas ya no podras recuperarla', 'Confirmar', 'Cancelar', function() {
                        removeFeatureToDirtySource(selectedFeatures, originalStage, dirtyStage, stage["roads"][idRoad].vector);
                        removeFeatures(selectedFeatures, stage["roads"][idRoad].vector);
                    });
                    //Desactivo el boton de borrar y activo el de guardar cambios
                    $('#removeFeature').button("option", "disabled", true);
                    $('#saveRiddle').button("option", "disabled", false);
                    dirty = true;
                });
                $("#saveRiddle").on('click', function() {
                    debugger;
                    var result = $("#select_result").empty();
                    var geoJSON = new ol.format.GeoJSON();
                    var mygeoJSON = geoJSON.writeFeatures(dirtyStage.getFeatures(), {
                        'dataProjection': "EPSG:4326",
                        'featureProjection': "EPSG:3857"
                    });
                    result.append(mygeoJSON);
                    //Comprobar si hay alguna pista sin geometria
                    dirtyStage.forEachFeature(function(feature) {
                        if (feature.get('idFeaturesPolygons') !== 'empty') {

                        }

                    });
                    //Recoloco las features 

                    //Si existe una nueva pista redirecciono para hacer el formulario
                    if (dirtyStage.getFeatureById(-1)) {
                        var url = "save_riddle.php?cmid=" + idModule;
                        $('<form id=myform method="POST"/>').attr('action', url).appendTo('#controlPanel');
                        $('<input type="hidden" name="json"/>').val(mygeoJSON).appendTo('#myform');
                        $("#myform").submit();
                    } //Si no existe envio un json con un ajax para actualizar los datos.
                    else {
                        //Funcion que comprueba si en el orden está incrustada Insert new riddle
                    }

                });
                $("#riddleList").on('click', '.ui-icon-trash', function() {
                    var idRiddle = parseInt($(this).parents('li').attr('idRiddle'));
                    notification.confirm('Estas seguro?', 'Si la eliminas ya no podras recuperarla', 'Confirmar', 'Cancelar', function() {
                        var idRiddles = [{
                            idRiddle: idRiddle
                        }];
                        deleteRiddles(idRiddles);
                    });
                });
                $("#riddleList").on('click', '.ui-icon-pencil', function() {
                    //Busco el idRiddle del li que contiene la papelera seleccionada
                    var idRiddle = parseInt($(this).parents('li').attr('idRiddle'));
                    debugger;
                    if (dirty) {
                        notification.confirm('Desea continuar?', 'Hay cambios sin guardar, si continua se perderan', 'Confirmar', 'Cancelar', function() {
                            debugger;
                            editFormEntry(idRiddle);

                        });
                    } else {
                        editFormEntry(idRiddle);
                    }
                });
                $("input[name=controlPanel]:radio").on('change', function() {
                    var selected = $("input[type='radio'][name='controlPanel']:checked");
                    var value = selected.val();
                    if (value === 'add') {
                        Draw.setActive(true);
                        Modify.setActive(false);
                    } else if (value === 'modify') {
                        Draw.setActive(false);
                        Modify.setActive(true);
                    } else {
                        Draw.setActive(false);
                        Modify.setActive(false);
                    }
                });
                $("#riddleList").on('click', 'li', function(e) {
                    if ($(e.target).is('.handle , .ui-icon , .sortable-number')) {
                        e.preventDefault();
                        return;
                    }
                    $(this).addClass("ui-selected").siblings().removeClass("ui-selected");
                    //Selecciono el idRiddle de mi atributo custom
                    var result = $("#select_result").empty();
                    numRiddle = parseInt($(this).attr('numriddle'));
                    idRiddle = parseInt($(this).attr('idriddle'));
                    result.append(" #" + idRiddle);
                    //Borro la anterior seleccion de features y busco las del mismo tipo
                    selectRiddleFeatures(stage["roads"][idRoad].vector, idRiddle, selectedFeatures, dirtyStage, originalStage);
                    activateEdition();
                    //Paro de dibujar si cambio de pista
                    Draw.Polygon.abortDrawing_();
                });


                $("#roadList").on('click', 'li', function(e) {
                    if ($(e.target).is('.handle , .ui-icon')) {
                        e.preventDefault();
                        return;
                    }
                    $(this).addClass("ui-selected").siblings().removeClass("ui-selected");
                    //Selecciono el idRiddle de mi atributo custom
                    var result = $("#select_result").empty();
                    //Borro las pistas seleccionadas
                    selectedRiddleFeatures = new Object();
                    //Paro de dibujar si cambio de camino
                    Draw.Polygon.abortDrawing_();
                    //Si estoy dentro del camino no desativo la edición
                    idRoad = $(this).attr('idRoad');
                    selectRoad(idRoad, stage["roads"][idRoad].vector, map, selectedFeatures);
                    deactivateEdition();

                    result.append(" #" + idRoad);
                });
                //Utilizada para guardar el valor original del nombre del camino
                var oriVal;
                var cache;
                $("#roadList").on('click', '.ui-icon-pencil', function() {
                    debugger;
                    var $li = $(this).parents("li");
                    oriVal = $li.text();
                    cache = $li.children();
                    $li.text("");
                    $("<input type='text'>").val(oriVal).appendTo($li).focus();
                });
                $("#roadList").on('focusout', 'li > input', function() {
                    var $this = $(this);
                    $this.parent().text($this.val() || oriVal).append(cache);
                    $this.remove();
                });
            }).fail(function(e) {
                console.log(e);
            });




        } // End of function init
    }; // End of init var
    return init;

});