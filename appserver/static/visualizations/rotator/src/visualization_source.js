/*
 * Visualization source
 *
 * TODO - refactor code for scene selection & multiple models
 * TODO - refactor code for CRUD integration and Splunk KVStore
 *
 *
 */

define([
			'splunkjs/mvc',
			'splunkjs/mvc/utils',
			'splunkjs/mvc/tokenutils',
            'jquery',
            'underscore',
            'api/SplunkVisualizationBase',
            'api/SplunkVisualizationUtils',
	    	'three',
            'three-math',
            'tween.js',
            'mathjs'
        ],
        function(
	        mvc,
	        utils,
	        TokenUtils,
            $,
            _,
            SplunkVisualizationBase,
            vizUtils,
            THREE,
            Math,
            TWEEN,
            mathjs
        ) {


var modelPath = "/en-us/static/app/Bender/";

var container;
var OrbitControls = require('three-orbit-controls')(THREE);
var TransformControls = require('../viz_tools/TransformControls');

var camera, scene, loader, renderer;
var mvcService;

var currentSceneKey;
var currentSceneComponents = new Object();
var currentSceneName;
var uniqueToPartMapping = new Object();
var sceneComponentCount = 0;
var sceneComponentsCounted = 0;

var	sceneModelsDeferred = $.Deferred();
var	modelMappingDeferred = $.Deferred();


var globalVizBase, globalConfig, globalNamespace, globalElement;
var orbitControls, transformControl;

//TODO this needs to get fixed 
var highTemp, mediumTemp;

//Saved for later
//var raycaster;
//var mouse;


var crudMode = false;
var crudCommand;


/**
 * Main animation loop
 */
function animate() {
	requestAnimationFrame(animate);
	render();
	TWEEN.update();

}

/**
 * Main render loop
 */
function render() {
	
	updateFromDom();

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


//TODO get this redone 
/*
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
*/


/**
 * This just iterates through all of the components in the scene and writes their positional data to the kvstore.
 * Used in CRUD mode only
 */
function saveSceneModels() {

	_.each(currentSceneComponents, function(model) {
		var key = model._key;
		var sceneKey = model.sceneKey;
		var uniqueName = model.componentUniqueName;
		var modelName = model.modelName;

		var translation = JSON.stringify(model.threeObject.position);
		var scale = JSON.stringify(model.threeObject.scale);

		/**
		 * Rotation using euler not quaternion 
 		 */
		var rotation = new Object();
		rotation.x = model.threeObject.rotation._x;
		rotation.y = model.threeObject.rotation._y;
		rotation.z = model.threeObject.rotation._z;
		var rotationString = JSON.stringify(rotation);


		var record = {
			"sceneKey": sceneKey,
			"componentUniqueName": uniqueName,
			"modelName": modelName,
			"translation": translation,
			"scale": scale,
			"rotation": rotationString
		}

		mvcService.request(
			"storage/collections/data/scene_models/" + key,
			"POST",
			null,
			null,
			JSON.stringify(record),
			{"Content-Type": "application/json"},
			null).done(function (result) {
				//TODO add some feedback that the save was successful
			});

	});



}

/**
 * This is called every frame.  I don't really know how to call methods
 * on the custom viz from a dashboard, but I use them to support CRUD
 * interactivity.  So I just watch a DOM element for commands.  The view
 * uses button presses to set these DIVs and then this method picks up 
 * the text and acts on it.  There's probably many and better ways to
 * do this. 
 */

function updateFromDom() {

	//This is like a constant declated in the CRUD screens.
	if($("vizbridge_crudmode").text() != "") { 
		if(crudMode != $("#vizbridge_crudmode").text()) {
			crudMode = $("#vizbridge_crudmode").text();
		}
	}

	var tempCommand = $("#vizbridge_crudcommand").text();
	if(tempCommand != "") {
		crudCommand = $("#vizbridge_crudcommand").text();

		$("#vizbridge_crudcommand").text("");

		if(crudCommand == "save") {
			saveSceneModels();
		}

		if(crudCommand == "reloadSceneModels") {
			reloadSceneModels();

		}

		if(/switchscene:/.test(crudCommand)) {
			var sceneKey = /switchscene:(.*)$/.exec(crudCommand)[1];

			loadScene(sceneKey);

		}

		if(/selectcomponent:/.test(crudCommand)) {
			var componentKey = /selectcomponent:(.*)$/.exec(crudCommand)[1];
			selectComponent(componentKey);
		}


		if(/switchxform:/.test(crudCommand)) {
			var xformType = /switchxform:(.*)$/.exec(crudCommand)[1];
			switch(xformType) {
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

}

/*
//this is not needed anymore but going to keep it around for future reference
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
*/

/**
 * Called as a CRUD command.  Sets the transform to whatever component is clicked.
 */
function selectComponent(componentKey) {
	transformControl.detach();
	transformControl.attach(currentSceneComponents[componentKey].threeObject);

}


/**
 * TWEEN tracker basically.  Probably going to remove this.
 * Just an artifact from trying to get constant rotation working
 */
function rebuildTweens() {
	_.each(activeTweens, function(tween) {
		tween.stop();
		TWEEN.remove(tween);
	});

	activeTweens = new Object();
}


/**
 * Scene creation for repeatability
 */
function createDefaultScene() {
	scene = new THREE.Scene();
	scene.add( new THREE.GridHelper( 500, 100 ) );
	scene.background = new THREE.Color( 0x000000 );

	return scene;
}

/**
 * Used by formatter/preference based scene selection.  This is 
 * NOT a CRUD function.  The visualization has to have it's 
 * scene preference set in order to show anything at all.  
 * This is just a wrapper.
 */
function loadSceneByName(sceneName) {
	//console.log("loading scene by name: " + sceneName);
	mvcService.request("storage/collections/data/scenes",
		"GET",
		null,
		null,
		null,
		null,
		function(err, response) {
			var tempSceneInfo = _.findWhere(response.data, {"sceneName":sceneName});
			currentSceneName = tempSceneInfo.sceneName;
			//Call the real scene loader.
			loadScene(tempSceneInfo._key);
		});
}

/**
 * Sets up scene loading.  Might need some extra checks to make sure the viz/DOM is all clean
 */
function loadScene(sceneKey) {
	if(transformControl) {
		transformControl.detach();
	}

	currentSceneKey = sceneKey;
	currentSceneComponents = new Object();

	scene = createDefaultScene();
	scene.add(transformControl);

	sceneModelsDeferred = $.Deferred();
	modelMappingDeferred = $.Deferred();


	//TODO review whether we need to do this long-term
	rebuildTweens();

	loadSceneModels(sceneKey);

}

/**
 * Primary scene loading method.  Does a bunch of data mapping for standard (non-CRUD) use.
 * See comments in code
 */

function loadSceneModels(sceneKey) {
	var searchString = '{"sceneKey": "' + sceneKey + '"}';
	var mappingData;

	//Get all of the models that belong in the scene
	mvcService.request("storage/collections/data/scene_models", 
		"GET", 
		{"query": searchString},  // i set a REST query/filter here.  Probably easier and more maintainable to use underscore to filter and just pull the whole dataset in this query.
		null,
		null,
		null,	
		function(err, response) {
			//loop through the models and create a hash that contains all of the keys and their positional data directly from the kvstore
			_.each(response.data, function(model) { currentSceneComponents[model._key] = model; });

			//Get all field mappings.  Field mappings contain all of the specific component metdata that is used when drawing and interactive with parts in non-CRUD mode
			mvcService.request("storage/collections/data/model_component_mapping",
				"GET",
				null, //no query, just get them all.  filter later
				null,
				null,
				null,
				function(err, response) {
					mappingData = response.data;

					//loop through all of the scene components and bind the mapping data to each record
					//note that the currentSceneComponents object for each model contains the entire set of mapping data.
					//this is used further down.  
					_.each(currentSceneComponents, function(model) {
						var thisGuysMappingData = _.where(mappingData, {"modelKey":model._key});
						model.mappingData = thisGuysMappingData;

					});

					//indicate that the scene is loaded.
					sceneModelsDeferred.resolve(currentSceneComponents);

				}
			);
		});

	//since the queries above can take a little bit, we wait here for the data to populate before creating the actual scene models.
	//here is where we are actually building the three.js objects
	$.when(sceneModelsDeferred).done(function() {

		_.each(currentSceneComponents, function(model) {

			//use the provided model name to load the object from static or whatever
			loader.load(modelPath + model.modelName, function(obj) {
				obj.kvkey = model._key;

				//move the object xyz based on kvstore data (this is set during scene building)
				var xyz = JSON.parse(model.translation);
				obj.position.x = xyz.x;
				obj.position.y = xyz.y;
				obj.position.z = xyz.z;

				//scale the object xyz based on kvstore data.. again, set during scene building...
				xyz = JSON.parse(model.scale);
				obj.scale.set(xyz.x,xyz.y,xyz.z);

				//we have eueler angles stored.  we might be able to do obj.rotation.x but docs say I should use rotateXYX
				xyz = JSON.parse(model.rotation);
				obj.rotateX(xyz.x);
				obj.rotateY(xyz.y);
				obj.rotateZ(xyz.z);


				//put this object into the currentSceneComponents for later reference
				currentSceneComponents[model._key].threeObject = obj;

				//this creates a lookup for fast tweening later on.  each key is the unique data field name.  this has a reference to the part itself as well as the mapping data which contains axis info, etc
				//need to also incude offsets during tweening so this will be useful there as well.
				//loop through this model's mapping data (set above).  Loop through each mapped field and build the hash.  the hash contains the specific mapping metdata but also a reference
				//to the part itself.  this let's us call property changes/methods right on the object without having to look things up or traverse any more than necessary.
				_.each(model.mappingData, function(mapping) {	
					uniqueToPartMapping[mapping.dataFieldName] = new Object();
					uniqueToPartMapping[mapping.dataFieldName].part = currentSceneComponents[model._key].threeObject.getObjectByName(mapping.modelComponentName);
					uniqueToPartMapping[mapping.dataFieldName].mappingData = mapping;
				});

				scene.add(currentSceneComponents[model._key].threeObject);
				
			});			
		});

	});


}

/**
 * Tear things down and rebuild.
 */
function reloadSceneModels() {

	sceneModelsDeferred = $.Deferred();
	modelMappingDeferred = $.Deferred();

	if(transformControl) {
		transformControl.detach();
	}

	_.each(currentSceneComponents, function(model) {
		scene.remove(model.threeObject);
	});

	currentSceneComponents = new Object();
	uniqueToPartMapping = new Object();
	
	rebuildTweens();

	loadSceneModels(currentSceneKey); 

}

/**
 * Function to set up a constantly spinning joint.  Consider a windmill or something else that is constantly spins with variable speed.
 * Not sure if tweening or just looping is the right ay to do this.  This method is also broken is a big way right now.
 */
function constantRotate(partInfo, newValue) {
	var existingTween = activeTweens[partInfo.mappingData._key];
	newValue = parseInt(newValue);


	if(existingTween) {
		//update the delay


	} else {
		//console.log("starting a constant rotation on : " + partInfo.part.name);

		//console.log("current axis [" + partInfo.mappingData.rotationAxis + "]  rotation is: " + partInfo.part.rotation[partInfo.mappingData.rotationAxis]);
		//console.log("new value is " + newValue);

		var current = {axis:partInfo.part.rotation[partInfo.mappingData.rotationAxis]};
		var target = {axis: current + newValue};



		var newTween = new TWEEN.Tween(current)
								.to(target, 200)
								.onUpdate(function() { partInfo.part.rotation[partInfo.mappingData.rotationAxis] = this.axis })
								.onComplete(function() {
									TWEEN.remove(this);
									current = {axis:partInfo.part.rotation[partInfo.mappingData.rotationAxis]};
									target = {axis: current + newValue};
									//need to callback to self here TODO
								})
								.start();

/*
		var newTween = new TWEEN.Tween({axis:partInfo.part.rotation[partInfo.mappingData.rotationAxis], obj:partInfo})
							 .to({axis:360}, newValue) //TODO this 50 is arbitrate and needs to be updateable
							 .onUpdate(function() { 
							 				//console.log(this.obj.part.rotation[this.obj.mappingData.rotationAxis])
							 				this.obj.part.rotation[this.obj.mappingData.rotationAxis] = this.axis; 
							 			})
							 .onComplete(function() { 
							 				//console.log("finished rotation tween.");
							 				//console.log("finished axis value: " + this.axis);
							 				//console.log("rotation at end: " + this.obj.part.rotation[this.obj.mappingData.rotationAxis]);

							 			})
							 .repeat(Infinity);


		activeTweens[partInfo.mappingData._key] = newTween.start();
		//console.log(activeTweens);
		*/

	}



}


/**
 * Rotates any part on any axis to any angle.  there's the capability to offset the radians to work
 * around mismatched part starting angles.  The better the model work, the less of this that needs to be done
 */
function rotatePart(partInfo, newValue) {
	var tempOffset = 0;
	if(partInfo.mappingData.rotationOffset && partInfo.mappingData.rotationOffset != "") {
		tempOffset = parseInt(partInfo.mappingData.rotationOffset);
	}
	var actualRadians = THREE.Math.degToRad((newValue*mathjs.PI/180)+tempOffset);
	var rotationTween = new TWEEN.Tween({axis:partInfo.part.rotation[partInfo.mappingData.rotationAxis], obj:partInfo})
								 .to({axis:actualRadians},300)
								 .onUpdate(function() { this.obj.part.rotation[this.obj.mappingData.rotationAxis] = this.axis; })
								 .onComplete(function() { TWEEN.remove(this); }) //removing the tween is important otherwise a huge array gets built and never cleaned up
								 .easing(TWEEN.Easing.Exponential.InOut);

	TWEEN.add(rotationTween.start());

}


/**
 * Dictates code based behavior from user-defined part role.  In the long term, there would be a number of actions that would be supported.
 * Some thoughts:
 *    Rotation, constantrotation, temperature, light, door, motion, linear/rail
 */
function processPart(partInfo, newValue) {
	var thePart = partInfo.part;
	var mappingMetaData = partInfo.mappingData;


	switch(mappingMetaData.componentPurpose) {
		case "Rotation": 
			rotatePart(partInfo, newValue);
			break;
		case "ConstantRotation":
			constantRotate(partInfo, newValue);
			break;
		case "Temperature":
			setPartTemperature(partInfo, newValue);
			break;
		case "Light":
			setPartLight(partInfo, newValue);
			break;
	}


}

    // Extend from SplunkVisualizationBase
    return SplunkVisualizationBase.extend({
  

        initialize: function() {

        	//just some viz setup stuff
            SplunkVisualizationBase.prototype.initialize.apply(this, arguments);
            this.$el = $(this.el);
            globalElement = this.$el;

            this.$el.addClass('bender');

            //build up the base scane
			scene = createDefaultScene();


			//build up the viz renderer
			renderer = new THREE.WebGLRenderer();
			renderer.setPixelRatio( window.devicePixelRatio );
			this.$el.append(renderer.domElement);


			//set up some variables.  hightemp and mediumtemp can probably be moved somewhere better
			highTemp = 40;
			mediumTemp = 30;
			globalVizBase = this;

			//these guys were used to selecting objects through clicking on the scene.  keeping around because i'm sure i'll use them again sometime
			//raycaster = new THREE.Raycaster();
			//mouse = new THREE.Vector2();

		    mvcService = mvc.createService({ owner: "nobody"});
			loader = new THREE.ObjectLoader();

			animate();

        },

        formatData: function(data) {
        	//no data formatting
            return data;
        },
  
        
        updateView: function(data,config) {
        	globalConfig = config;
        	globalNamespace = this.getPropertyNamespaceInfo().propertyNamespace;
			var preferenceBasedSceneName = config[globalNamespace + "sceneName"];


        	updateFromDom(); //basically used for CRUDmode.  passing commands back and forth.  There's probably 10 better ways to do this.  this is how i did it.  

        	if(preferenceBasedSceneName && preferenceBasedSceneName != "") { //something real 
       			if(preferenceBasedSceneName != currentSceneName) { 
       				//switch to the new scene
       				//console.log("the preference based scene selection does not match the current scene name.  setting to " + preferenceBasedSceneName);
       				loadSceneByName(preferenceBasedSceneName); 
       			}
        	}

			// Check for empty data
			if(_.size(data.results) < 1) { console.log("no data"); return; }


			var dataRows = data.results;
			_.each(dataRows, function(data) {

				//super simple action on data...
				if(data["part"] && data["value"]) {
					var thisUniquePartName = data["part"];
					var thisUniquePartValue = data["value"];

					//since we set up the lookup table with the part unique name, we can take the native part data and link it up with the proper action based on the value in the data.
					if(uniqueToPartMapping[thisUniquePartName]) {
						processPart(uniqueToPartMapping[thisUniquePartName], thisUniquePartValue);
					} else {
						//there's no defined detail for the current part.  ignore
					}
				}

			});


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
