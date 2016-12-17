/*
 * Visualization source
 */
define([
            'jquery',
            'underscore',
            'api/SplunkVisualizationBase',
            'api/SplunkVisualizationUtils',
	    	'three',
            'three-math',
            'tween.js',
            'mathjs'
       
            // Add required assets to this list
        ],
        function(
            $,
            _,
            SplunkVisualizationBase,
            vizUtils,
            THREE,
            Math,
            TWEEN,
            mathjs
        ) {

    var hasViz = false;

var armJSONFile = "/en-us/static/app/Bender/scene.json";
//var armDemoJSONFile = "/en-us/static/app/Bender/demo.json";

/*
var simMode = false;
var simCounter = 0;
var simulationData = [{move:"shoulder",rad:1743,axis:"Y"},{move:"base",rad:1976,axis:"Y"},{move:"wrist2",rad:4724,axis:"Y"},{move:"wrist1",rad:1831,axis:"Y"}];
*/


var container;
var OrbitControls = require('three-orbit-controls')(THREE);
var camera, scene, loader, renderer;
var base, shoulder, elbow, wrist1, wrist2, wrist3;
var counter = 0;
var activeTween;
var globalVizBase, globalConfig;
var controls;
var globalElement;
var highTemp, mediumTemp;

function animate() {
	requestAnimationFrame(animate);
	render();
	//controls.update() 
	TWEEN.update();

}

function render() {
	if(camera) {
		//camera.lookAt(scene.position);
		renderer.render(scene, camera);
	} else {
		if(globalElement.innerWidth() != 100 && globalElement.innerHeight() != 100) {
			renderer.setSize( globalElement.innerWidth(), globalElement.innerHeight() );
			camera = new THREE.PerspectiveCamera( 80, globalElement.innerWidth()/globalElement.innerHeight(), 0.1, 1000 );	
			camera.position.y = 55;
			camera.position.z = 45;

			camera.lookAt(scene.position);

			controls = new OrbitControls( camera, renderer.domElement );
			controls.rotateSpeed = 0.4;
			controls.zoomSpeed = 0.4;
			//controls.enableDamping = true;
			controls.dampingFactor = 0.25;
			controls.enablePan = true;
			controls.enableZoom = true;

		}
	}
}


function setJointColor(part, temp) {
	var r,g,b;
	if(temp) {
		r = 0;
		b = 1;
		g = 0;


		if(temp > mediumTemp) {
			r = 0.3;
			b = 0;
			g = 0;
		}

		if(temp > highTemp) {
			r = 0.8;
			b = 0;
			g = 0;
		}
		part.material.color.r = r;
		part.material.color.b = b;
		part.material.color.g = g;
	}
}


/*
fnction simCheck() {
	if(simMode) {
		console.log("simluation dataset size: " + _.size(simulationData));
		var tempData = {};
		tempData.results = new Array();
		tempData.results[0] = {part: simulationData[simCounter]["move"], position: simulationData[simCounter]["rad"]};
		globalVizBase.updateView(tempData, globalConfig);
		if(simCounter++ >= _.size(simulationData)-1) { simCounter = 0; }

		// console.log("TWEEN Size");
		//console.log(_.size(TWEEN.getAll()));
		//console.log(TWEEN.getAll()[0]);
	}
}
*/

    // Extend from SplunkVisualizationBase
    return SplunkVisualizationBase.extend({
  

        initialize: function() {
            SplunkVisualizationBase.prototype.initialize.apply(this, arguments);
            this.$el = $(this.el);
            globalElement = this.$el;
            hasViz = false;
            this.$el.addClass('rotator');
            // Initialization logic goes here


			scene = new THREE.Scene();

			loader = new THREE.ObjectLoader();

			loader.load(armJSONFile, function(obj) {
				scene.add(obj);

			});
			scene.background = new THREE.Color( 0xd3d3d3 );
			//console.log("loading json demo data");
		/*
			$.getJSON(armDemoJSONFile, function(data) {
				console.log("loaded json  demo file");
				simulationData = data;


			}).fail(function(why) { console.log("failed to load json demo data file"); console.log(why); });

		*/

			renderer = new THREE.WebGLRenderer();
			renderer.setPixelRatio( window.devicePixelRatio );
			this.$el.append(renderer.domElement);
			highTemp = 40;
			mediumTemp = 30;
			globalVizBase = this;

			animate();

        },

        // Optionally implement to format data returned from search. 
        // The returned object will be passed to updateView as 'data'
        formatData: function(data) {

            // Format data 

            return data;
        },
  
        // Implement updateView to render a visualization.
        //  'data' will be the data object returned from formatData or from the search
        //  'config' will be the configuration property object
        
        updateView: function(data, config) {
        	globalConfig = config;

        	highTemp = parseInt(config[this.getPropertyNamespaceInfo().propertyNamespace + "highTemp"])
        	mediumTemp = parseInt(config[this.getPropertyNamespaceInfo().propertyNamespace + "medTemp"])
	
			// Check for empty data
			if(_.size(data.results) < 1) { console.log("no data"); return; }
/*
			if(data.results[0]["mode"] == "sim") { simMode = true; }
			if(simMode) {
				console.log("executing sim data");
				window.setTimeout(simCheck, 300);
			}
*/
			//while(!base || !shoulder || !elbow || !wrist1 || !wrist2 || !wrist3) {
			if(!base || !shoulder || !elbow || !wrist1 || !wrist2 || !wrist3) {
				console.log("waiting to enumerate all parts");
				scene.traverse(function(i) {
					switch(i.name) {
						case "Base": base = i; break;
						case "Shoulder": shoulder = i; break; 
						case "Elbow": elbow = i; break;
						case "Wrist1": wrist1 = i; break;
						case "Wrist2": wrist2 = i; break;
						case "Wrist3": wrist3 = i; break;
						case "Joint-Base-Lid": jointBase = i; break;
						case "Joint-Shoulder-Lid": jointShoulder = i; break;
						case "Joint-Elbow-Lid": jointElbow = i; break;
						case "Joint-Wrist1-Lid": jointWrist1 = i; break;
						case "Joint-Wrist2-Lid": jointWrist2 = i; break;
						case "Joint-Wrist3-Lid": jointWrist3 = i; break;
					}
				});
			} else {

				_.each(data.results, function(d) { 

//					console.log("current data");
//					console.log(d);

					var thisPart = d["part"];
					var thisPurpose = d["purpose"];
					var thisValue = d["Value"];


			        //var dataRadians = d["position"] || undefined;
			        //var dataTemperature = d["temperature"] || undefined;
			        var dataRadians = undefined;
			        var dataTemperature = undefined;

			        switch(thisPurpose) {
			        	case "position": dataRadians = thisValue; break;
			        	case "temperature": dataTemperature = thisValue; break;
			        }

					switch(thisPart) {
						case "base":
							if(dataTemperature != undefined) { setJointColor(jointBase, dataTemperature); }
							if(dataRadians != undefined) {
								var actualRadians = THREE.Math.degToRad((dataRadians*mathjs.PI/180)+200);
								TWEEN.add(new TWEEN.Tween({y:base.rotation.y, obj:base, tween:activeTween})
										.to({y:actualRadians}, 300)
										.onUpdate(function() { this.obj.rotation.y = this.y; })
										.onComplete( function() { TWEEN.remove(this); })
										.easing(TWEEN.Easing.Exponential.InOut)
										.start());
							}
							break;
						case "shoulder":
							if(dataTemperature != undefined) { setJointColor(jointShoulder, dataTemperature); }
							if(dataRadians != undefined) {
								var actualRadians = THREE.Math.degToRad((dataRadians*mathjs.PI/180)-50);
								TWEEN.add(new TWEEN.Tween({y:shoulder.rotation.y, obj:shoulder, tween:activeTween})
										.to({y:actualRadians}, 300)
										.onUpdate(function() { this.obj.rotation.y = this.y; })
										.onComplete( function() { TWEEN.remove(this); })
										.easing(TWEEN.Easing.Exponential.InOut)
										.start());
							}
							break;
						case "elbow":
							if(dataTemperature != undefined) { setJointColor(jointElbow, dataTemperature); }
							if(dataRadians != undefined) {
								var actualRadians = THREE.Math.degToRad((dataRadians*mathjs.PI/180)+100);
								TWEEN.add(new TWEEN.Tween({x:elbow.rotation.x, obj:elbow, tween:activeTween})
										.to({x:actualRadians}, 300)
										.onUpdate(function() { this.obj.rotation.x = this.x; })
										.onComplete( function() { TWEEN.remove(this); })
										.easing(TWEEN.Easing.Exponential.InOut)
										.start());
							}
							break;
						case "wrist1":
							if(dataTemperature != undefined) { setJointColor(jointWrist1, dataTemperature); }
							if(dataRadians != undefined) {
								var actualRadians = THREE.Math.degToRad((dataRadians*mathjs.PI/180)-150);
								TWEEN.add(new TWEEN.Tween({y:wrist1.rotation.y, obj:wrist1, tween:activeTween})
										.to({y:actualRadians}, 300)
										.onUpdate(function() { this.obj.rotation.y = this.y; })
										.onComplete( function() { TWEEN.remove(this); })
										.easing(TWEEN.Easing.Exponential.InOut)
										.start());
							}
							break;
						case "wrist2":
							if(dataTemperature != undefined) { setJointColor(jointWrist2, dataTemperature); }
							if(dataRadians != undefined) {
								var actualRadians = THREE.Math.degToRad((dataRadians*mathjs.PI/180)-100);
								TWEEN.add(new TWEEN.Tween({y:wrist2.rotation.y, obj:wrist2, tween:activeTween})
										.to({y:actualRadians}, 300)
										.onUpdate(function() { this.obj.rotation.y = this.y; })
										.onComplete( function() { TWEEN.remove(this); })
										.easing(TWEEN.Easing.Exponential.InOut)
										.start());
							}
							break;
						case "wrist3":
							if(dataTemperature != undefined) { setJointColor(jointWrist3, dataTemperature); }
							if(dataRadians != undefined) {
								var actualRadians = THREE.Math.degToRad((dataRadians*mathjs.PI/180)-100);
								TWEEN.add(new TWEEN.Tween({y:wrist3.rotation.y, obj:wrist3, tween:activeTween})
										.to({y:actualRadians}, 300)
										.onUpdate(function() { this.obj.rotation.y = this.y; })
										.onComplete( function() { TWEEN.remove(this); })
										.easing(TWEEN.Easing.Exponential.InOut)
										.start());
							}
							break;
					}
				});
			}
			
        },

        // Search data params
        getInitialDataParams: function() {
            return ({
                //outputMode: SplunkVisualizationBase.ROW_MAJOR_OUTPUT_MODE,
                outputMode: SplunkVisualizationBase.RAW_OUTPUT_MODE,
                count: 10000
            });
        },

        // Override to respond to re-sizing events
        reflow: function() {
			renderer.setSize( globalElement.innerWidth(), globalElement.innerHeight() );
        }
    });
});
