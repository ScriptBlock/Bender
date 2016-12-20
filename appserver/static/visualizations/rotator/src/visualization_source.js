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



var container;
var OrbitControls = require('three-orbit-controls')(THREE);
var TransformControls = require('../viz_tools/TransformControls');


var camera, scene, loader, renderer;
var base, shoulder, elbow, wrist1, wrist2, wrist3; //this needs to be refactored into multiple models
var counter = 0;
var activeTween;
var globalVizBase, globalConfig, globalNamespace;
var orbitControls, transformControl;
var globalElement;
var highTemp, mediumTemp;

var raycaster;
var mouse;
var currentTransformObject;
var transformControlState = false;


function animate() {
	requestAnimationFrame(animate);
	render();
	TWEEN.update();

}

function render() {
	//this is a safety check.  if you try to set the camera angles and scene size before
	//the dom element and camera is initialized it doesn't work.  once the camera and dom
	//element is built, you can get the screen size and your model won't be skewed
	if(camera) {
		renderer.render(scene, camera);
	} else {

		//100 is the default bogus value for some reason.  this code is a little henky, but works.
		if(globalElement.innerWidth() != 100 && globalElement.innerHeight() != 100) {
			renderer.setSize( globalElement.innerWidth(), globalElement.innerHeight() );
			camera = new THREE.PerspectiveCamera( 80, globalElement.innerWidth()/globalElement.innerHeight(), 0.1, 1000 );	
			camera.position.y = 55;
			camera.position.z = 45;
			camera.lookAt(scene.position);


			//build up pan/zoom/scroll controls for the whole viz.  
			//could probably put these options in the formatter as well but these values work
			//pretty well.
			orbitControls = new OrbitControls( camera, renderer.domElement );
			orbitControls.rotateSpeed = 0.4;
			orbitControls.zoomSpeed = 0.4;
			orbitControls.dampingFactor = 0.25;
			orbitControls.enablePan = true;
			orbitControls.enableZoom = true;


			//build up a transform control to be used whenever a model is clicked
			//and the formatter api indicates that the transform control is "on"
			transformControl = new THREE.TransformControls( camera, renderer.domElement );
			scene.add(transformControl);
			transformControl.addEventListener( 'change', render );

		}
	}
}


//this needs a whole lotta work.  kind of just a first go at it.
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


//this is a recursive function to get the whole model when clicked instead of just a 
//specific part.  Scene is hardcoded here assuming that every model that is loaded is
//an imported scene.
function getParentUntil(obj) { 
	if(!obj.parent) { return null; }

	//recursive
	if(obj.parent && obj.parent.name != "Scene") { return getParentUntil(obj.parent); } 

	if(obj.parent.name == "Scene") {
		return obj.parent;
	} else {
		return null;
	}


}

//this selects the entire model and reflects the wishes of the formatter api settings
//currently just supports transforms.
function onSceneMouseDown(event) {
	event.preventDefault();

	//standard raycaster object selection code
	var mv = new THREE.Vector3();
	mv.x = ( event.offsetX / globalElement.innerWidth() ) * 2 - 1;
	mv.y = - ( event.offsetY / globalElement.innerHeight() ) * 2 + 1;
	raycaster.setFromCamera(mv.clone(), camera);
	var intersects = raycaster.intersectObjects( scene.children,true );


	if ( intersects.length > 0 ) {
		var theParent = getParentUntil(intersects[0].object);
		if(theParent) {
			currentTransformObject = theParent;
			if(transformControlState) {
				transformControl.attach(currentTransformObject);
			}
		}

	} 


}

function onSceneKeyDown(event) {
	//nadda right now.  probably deprecated
}


function addModelToScene() {
	console.log("Clicked addModelToScene")
	console.log("Will try to add matching mode: " + globalConfig[globalNamespace + "modelName"]);
}


//called on every data update or
function updateControls() {
	var transformState;
	var transformMode;

	switch(globalConfig[globalNamespace + "transformState"]) {
		case "on":
			transformControlState = true;
			break;
		case "off": 
			transformControlState = false;
			transformControl.detach();
			break;
	}

	//just a little control logic to make sure that we're not creating new events 
	//unnecessarily.  every time you call setmode the transformcontrols code dispatches a 
	//change event.  this would get called every time new data comes in.  we don't want that.
	if(transformControl.getMode != globalConfig[globalNamespace + "transformMode"]) {
		switch(globalConfig[globalNamespace + "transformMode"]) {
			case "translate":
				transformControl.setMode("translate");
				break;
			case "scale": 
				transformControl.setMode("scale");
				break;
			case "rotate": 
				transformControl.setMode("rotate");
				break;
		}
	}


}

    // Extend from SplunkVisualizationBase
    return SplunkVisualizationBase.extend({
  

        initialize: function() {

        	//just some viz setup stuff
            SplunkVisualizationBase.prototype.initialize.apply(this, arguments);
            this.$el = $(this.el);
            globalElement = this.$el;
            hasViz = false;
            this.$el.addClass('rotator');


            //build up the base scane
			scene = new THREE.Scene();
			scene.add( new THREE.GridHelper( 500, 100 ) );
			//needs to be customizable for formatter api
			scene.background = new THREE.Color( 0x000000 );


			//build up the viz renderer
			renderer = new THREE.WebGLRenderer();
			renderer.setPixelRatio( window.devicePixelRatio );
			this.$el.append(renderer.domElement);


			//set up some variables.  hightemp and mediumtemp can probably be moved somewhere better
			highTemp = 40;
			mediumTemp = 30;
			globalVizBase = this;
			raycaster = new THREE.Raycaster();
			mouse = new THREE.Vector2();



			//this needs to be refactored into a save file and/or multiple models
			loader = new THREE.ObjectLoader();
			loader.load(armJSONFile, function(obj) {
				scene.add(obj);

			});
			

			//mouse-down for model selection.  this is used with transform tools
			renderer.domElement.addEventListener('mousedown', onSceneMouseDown);

			//hooking keyboard events isn't working well..  probably not going to use this in lieu of
			//formatter api and maybe some on-screen buttons
			//window.addEventListener('keydown', onSceneKeyDown);

			animate();

        },

        formatData: function(data) {
        	//no data formatting
            return data;
        },
  
        
        updateView: function(data, config) {
        	globalConfig = config;
        	globalNamespace = this.getPropertyNamespaceInfo().propertyNamespace;

        	highTemp = parseInt(config[globalNamespace + "highTemp"])
        	mediumTemp = parseInt(config[globalNamespace + "medTemp"])

        	updateControls();


	
			// Check for empty data
			if(_.size(data.results) < 1) { console.log("no data"); return; }


			//needs to be refactored for multiple models.  This just creates
			//some variables for tweening/manipulation
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

					//this whole section needs to be fixed for logic reuse (the tween code sucks)
					//also needs to support multiple models
					var thisPart = d["part"];
					var thisPurpose = d["purpose"];
					var thisValue = d["Value"];


			        var dataRadians = undefined;
			        var dataTemperature = undefined;

			        switch(thisPurpose) {
			        	case "position": dataRadians = thisValue; break;
			        	case "temperature": dataTemperature = thisValue; break;
			        }

			        //tween the various parts for whatever angle is passed in
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
