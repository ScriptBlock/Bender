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
			//'splunkjs/mvc/simpleform/formutils',
    		//'splunkjs/mvc/simplexml/urltokenmodel',
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
	        mvc,
	        utils,
	        TokenUtils,
        	//FormUtils,
        	//UrlTokenModel,
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
var modelPath = "/en-us/static/app/Bender/";



var container;
var OrbitControls = require('three-orbit-controls')(THREE);
var TransformControls = require('../viz_tools/TransformControls');


var camera, scene, loader, renderer;

var currentSceneKey;
var currentSceneComponents = new Object();
var currentSceneName;
var uniqueToPartMapping = new Object();
var sceneComponentCount = 0;
var sceneComponentsCounted = 0;

var	sceneModelsDeferred = $.Deferred();
var	modelMappingDeferred = $.Deferred();



var mvcService;

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

var activeTweens = new Object();

var crudMode = false;
var crudCommand;

//if(true) { console.log("osdijfodisjfiodsfjsdf"); }
/*
var fu;
try {
	console.log("doing stuff before require");
	fu = require('splunkjs/mvc/simpleform/formutils');
	console.log("loaded formutils");
} catch(e) {
	console.log("error requiring formutils");
	console.log(e);
}
*/
//////////////////////////
/*
        var urlTokenModel = new UrlTokenModel();
        mvc.Components.registerInstance('url', urlTokenModel);
        var defaultTokenModel = mvc.Components.getInstance('default', {create: true});
        var submittedTokenModel = mvc.Components.getInstance('submitted', {create: true});
        urlTokenModel.on('url:navigate', function() {
            defaultTokenModel.set(urlTokenModel.toJSON());
            if (!_.isEmpty(urlTokenModel.toJSON()) && !_.all(urlTokenModel.toJSON(), _.isUndefined)) {
                submitTokens();
            } else {
                submittedTokenModel.clear();
            }
        });

        // Initialize tokens
        defaultTokenModel.set(urlTokenModel.toJSON());


        function getToken(name) {
            var retVal = defaultTokenModel.get(name);
            console.log("token value for " + name + " is " + retVal);
            return retVal;

        }

function getToken(name) {
    var retVal = defaultTokenModel.get(name);
    console.log("token value for " + name + " is " + retVal);
    return retVal;

}
*/



function animate() {
	requestAnimationFrame(animate);
	render();
	TWEEN.update();

}

function render() {
	//token testing
	
	//var tokenTemp = getToken("vizbridge_selectmodel");
	//console.log("token temp");
	//console.log(tokenTemp);
	
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


function saveSceneModels() {

	/*

		loop through all "currentscenecomponents"
		use rest to save values for each
	*/

	_.each(currentSceneComponents, function(model) {
		console.log("saving data for mode: " + model.componentUniqueName);
		var key = model._key;
		var sceneKey = model.sceneKey;
		var uniqueName = model.componentUniqueName;
		var modelName = model.modelName;

		var translation = JSON.stringify(model.threeObject.position);
		var scale = JSON.stringify(model.threeObject.scale);

		var rotation = new Object();
		rotation.x = model.threeObject.rotation._x;
		rotation.y = model.threeObject.rotation._y;
		rotation.z = model.threeObject.rotation._z;
		var rotationString = JSON.stringify(rotation);


		console.log("the key is: " + model._key);
		console.log("translation: " + translation);
		console.log("rotation: " + rotationString);
		console.log("scale: " + scale);


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
				console.log("saved data for " + key);
				console.log(result);
			});

	});



}

function updateFromDom() {

	if($("vizbridge_crudmode").text() != "") { 
		if(crudMode != $("#vizbridge_crudmode").text()) {
			console.log("current crudMode: [" + crudMode + "] doesn't match " + $("#vizbridge_crudmode").text());
			crudMode = $("#vizbridge_crudmode").text();
			console.log("changed crudmode to " + crudMode);
		}
	}

	var tempCommand = $("#vizbridge_crudcommand").text();
	if(tempCommand != "") {
		crudCommand = $("#vizbridge_crudcommand").text();
		console.log("received dom based viz command: " + crudCommand);

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
function selectComponent(componentKey) {
	console.log("selecting component: " + componentKey);
	transformControl.detach();

	transformControl.attach(currentSceneComponents[componentKey].threeObject);
	//component key needs to be added to model during loading.
	//perhaps maintain a hash during scene load so that selecting components 
	//isn't an enumeration of all scene objects

//	event.preventDefault();
/*

	//refactor this stuff out.  no need for raycasting since we are picking components
	//from the list in the GUI
	if(transformControlState) {

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
				console.log(theParent);
				if(transformControlState) {
					transformControl.attach(currentTransformObject);
				}
			}

		} 
	}
*/

}



/*
//this will need to be refactored for CRUD
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
*/

function rebuildTweens() {
	_.each(activeTweens, function(tween) {
		tween.stop();
		TWEEN.remove(tween);
	});

	activeTweens = new Object();
}

function createDefaultScene() {
	console.log("creating a new scene.");
	scene = new THREE.Scene();
	scene.add( new THREE.GridHelper( 500, 100 ) );
	scene.background = new THREE.Color( 0x000000 );

	return scene;
}

function loadSceneByName(sceneName) {
	console.log("loading scene by name: " + sceneName);
	mvcService.request("storage/collections/data/scenes",
		"GET",
		null,
		null,
		null,
		null,
		function(err, response) {
			var tempSceneInfo = _.findWhere(response.data, {"sceneName":sceneName});
			console.log("found a scene for that name");
			console.log(tempSceneInfo);
			console.log("calling loadScene(" + tempSceneInfo._key + ")");
			currentSceneName = tempSceneInfo.sceneName;
			loadScene(tempSceneInfo._key);
		});
}

function loadScene(sceneKey) {
	console.log("loading scene for " + sceneKey);

	if(transformControl) {
		transformControl.detach();
	}

	console.log("re/setting scenecomponent vars")
	currentSceneKey = sceneKey;
	currentSceneComponents = new Object();

	console.log("creating a new scene.");
	scene = createDefaultScene();
	scene.add(transformControl);

	sceneModelsDeferred = $.Deferred();
	modelMappingDeferred = $.Deferred();

	rebuildTweens();

	
	

	//KV lookup
	loadSceneModels(sceneKey);

}


function loadSceneModels(sceneKey) {
	console.log("loading scene models");
	//fields_list = _key, sceneKey, componentUniqueName, modelName, rotation, translation, scale

//?query={"id": {"$gt": 24}}
	var searchString = '{"sceneKey": "' + sceneKey + '"}';
	var mappingData;


	mvcService.request("storage/collections/data/scene_models", 
		"GET", 
		{"query": searchString},
		null,
		null,
		null,	
		function(err, response) {
			_.each(response.data, function(model) {
				currentSceneComponents[model._key] = model;
				//console.log(model);
			});

			console.log("here's the currentSceneComponents object after scene model loading");
			console.log(currentSceneComponents);

			console.log("mapping up field data");
			mvcService.request("storage/collections/data/model_component_mapping",
				"GET",
				null, //no query, just get them all
				null,
				null,
				null,
				function(err, response) {

					mappingData = response.data;
					console.log("all mapping data: " );
					console.log(mappingData);


					_.each(currentSceneComponents, function(model) {
						console.log("setting mappingdata field for model: " + model._key)
						var thisGuysMappingData = _.where(mappingData, {"modelKey":model._key});
						console.log(thisGuysMappingData);
						model.mappingData = thisGuysMappingData;

					});
					sceneModelsDeferred.resolve(currentSceneComponents);

				}
			);
		});

	console.log("calling $.when");
	$.when(sceneModelsDeferred).done(function() {
		console.log("inside $.when block");
		console.log(currentSceneComponents);
		//actually create the model and apply translations and field mapping and unique identified to it.

		_.each(currentSceneComponents, function(model) {
			loader.load(modelPath + model.modelName, function(obj) {
				console.log("loaded object: " + model.componentUniqueName);
				//set object properties recursively to add _key
				obj.kvkey = model._key;

				var xyz = JSON.parse(model.translation);

				obj.position.x = xyz.x;
				obj.position.y = xyz.y;
				obj.position.z = xyz.z;

				xyz = JSON.parse(model.scale);
				console.log("model.scale = " + model.scale);
				obj.scale.set(xyz.x,xyz.y,xyz.z);

				xyz = JSON.parse(model.rotation);
				console.log("model.rotation = " + model.rotation);
				obj.rotateX(xyz.x);
				obj.rotateY(xyz.y);
				obj.rotateZ(xyz.z);



				currentSceneComponents[model._key].threeObject = obj;
				_.each(model.mappingData, function(mapping) {
					//this creates a lookup for fast tweening later on.  each key is the unique data field name.  this has a reference to the part itself as well as the mapping data which contains axis info, etc
					//need to also incude offsets during tweening so this will be useful there as well.
					uniqueToPartMapping[mapping.dataFieldName] = new Object();
					uniqueToPartMapping[mapping.dataFieldName].part = currentSceneComponents[model._key].threeObject.getObjectByName(mapping.modelComponentName);
					uniqueToPartMapping[mapping.dataFieldName].mappingData = mapping;



				});

				scene.add(currentSceneComponents[model._key].threeObject);
				
			});			
		});

		console.log("unique part mapping");
		console.log(uniqueToPartMapping);


		console.log("current scene components with three object loaded");
		console.log(currentSceneComponents);


	});


}

function reloadSceneModels() {
	console.log("reloading scene models");

	sceneModelsDeferred = $.Deferred();
	modelMappingDeferred = $.Deferred();

	if(transformControl) {
		transformControl.detach();
	}

	_.each(currentSceneComponents, function(model) {
		console.log("removing " + model.componentUniqueName);
		scene.remove(model.threeObject);
	});

	currentSceneComponents = new Object();
	uniqueToPartMapping = new Object();
	
	rebuildTweens();

	
	loadSceneModels(currentSceneKey); //then reload them

}

function constantRotate(partInfo, newValue) {
	var existingTween = activeTweens[partInfo.mappingData._key];
	newValue = parseInt(newValue);


	if(existingTween) {
		//update the delay


	} else {
		console.log("starting a constant rotation on : " + partInfo.part.name);

		console.log("current axis [" + partInfo.mappingData.rotationAxis + "]  rotation is: " + partInfo.part.rotation[partInfo.mappingData.rotationAxis]);
		console.log("new value is " + newValue);

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
							 				console.log(this.obj.part.rotation[this.obj.mappingData.rotationAxis])
							 				this.obj.part.rotation[this.obj.mappingData.rotationAxis] = this.axis; 
							 			})
							 .onComplete(function() { 
							 				console.log("finished rotation tween.");
							 				console.log("finished axis value: " + this.axis);
							 				console.log("rotation at end: " + this.obj.part.rotation[this.obj.mappingData.rotationAxis]);

							 			})
							 .repeat(Infinity);


		activeTweens[partInfo.mappingData._key] = newTween.start();
		console.log(activeTweens);
		*/

	}



}

function rotatePart(partInfo, newValue) {
	console.log("inside rotatepart");
/*

var actualRadians = THREE.Math.degToRad((dataRadians*mathjs.PI/180)+200);
TWEEN.add(new TWEEN.Tween({y:base.rotation.y, obj:base, tween:activeTween})
		.to({y:actualRadians}, 300)
		.onUpdate(function() { this.obj.rotation.y = this.y; })
		.onComplete( function() { TWEEN.remove(this); })
		.easing(TWEEN.Easing.Exponential.InOut)
		.start());
}
*/
	console.log("value from data: " + newValue);

	var tempOffset = 0;
	if(partInfo.mappingData.rotationOffset && partInfo.mappingData.rotationOffset != "") {
		tempOffset = parseInt(partInfo.mappingData.rotationOffset);
	}
	var actualRadians = THREE.Math.degToRad((newValue*mathjs.PI/180)+tempOffset);
	
	//console.log("rotation axis for this tween")

	console.log("starting value for tween: " + partInfo.part.rotation[partInfo.mappingData.rotationAxis] );
	console.log("translated to actual radians with offset [" + partInfo.mappingData.rotationOffset + "] = " + actualRadians);

	var rotationTween = new TWEEN.Tween({axis:partInfo.part.rotation[partInfo.mappingData.rotationAxis], obj:partInfo})
								 .to({axis:actualRadians},300)
								 .onUpdate(function() { this.obj.part.rotation[this.obj.mappingData.rotationAxis] = this.axis; })
								 //.onUpdate(function() { 
								 				//console.log("setting new rotation to: " + this.axis); 
								 				//partInfo.part.rotation[this.obj.mappingData.rotationAxis] = this.axis; 
								 //			})
								 .onComplete(function() { TWEEN.remove(this); })
								 .easing(TWEEN.Easing.Exponential.InOut);

	console.log("created rotationtween");
	console.log(rotationTween);

	console.log("starting tween");
	TWEEN.add(rotationTween.start());
}

function processPart(partInfo, newValue) {
	console.log("inside process part");
	var thePart = partInfo.part;
	var mappingMetaData = partInfo.mappingData;


	switch(mappingMetaData.componentPurpose) {
		case "Rotation": 
			console.log("componentpurpose is rotation.  calling rotatepart");
			rotatePart(partInfo, newValue);
			break;
		case "ConstantRotation":
			console.log("component purpose is constantrotation");
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
            hasViz = false;
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
			raycaster = new THREE.Raycaster();
			mouse = new THREE.Vector2();

		    mvcService = mvc.createService({ owner: "nobody"});



			//this needs to be refactored into a save file and/or multiple models
			//need to implement KVStore code similar to home automation code
			//provide a CRUD interface to add component and dynamically load
			//scene based on KV elements.
			//KVSTORE
			//   model root (scene.json for example)
			//   model name - will be used to give unique joint/poisition names
			//   Vector3 for scene placement (translation)
			//	 Vector3 for rotational placement 
			//	 Vector3 for scale 
			//   These vector3's will be stored in the KV store but not user editable
			//   movement within the scene will save the resulting data off to KVstore
			//	 
			//   


			loader = new THREE.ObjectLoader();
			/* deprecated for true loading of unique models
			loader.load(armJSONFile, function(obj) {
				scene.add(obj);

			});
			*/
			

			//mouse-down for model selection.  this is used with transform tools
			//renderer.domElement.addEventListener('mousedown', onSceneMouseDown);

			//hooking keyboard events isn't working well..  probably not going to use this in lieu of
			//formatter api and maybe some on-screen buttons
			//window.addEventListener('keydown', onSceneKeyDown);

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
       				console.log("the preference based scene selection does not match the current scene name.  setting to " + preferenceBasedSceneName);
       				loadSceneByName(preferenceBasedSceneName); 
       			}
        	}

			// Check for empty data
			if(_.size(data.results) < 1) { console.log("no data"); return; }


			var dataRows = data.results;
			_.each(dataRows, function(data) {

				if(data["part"] && data["value"]) {
					var thisUniquePartName = data["part"];
					var thisUniquePartValue = data["value"];

					console.log("new data row, processing part");
					console.log("thisUniquePartName: " + thisUniquePartName);
					console.log("thisUniquePartValue: " + thisUniquePartValue);

					if(uniqueToPartMapping[thisUniquePartName]) {
						console.log("found part mapping for this guy.. process");
						processPart(uniqueToPartMapping[thisUniquePartName], thisUniquePartValue);
					} else {
						console.log("there is no part mapping for this");
					}
				}

			});


        },


        updateViewOld: function(data, config) {
        	globalConfig = config;
        	globalNamespace = this.getPropertyNamespaceInfo().propertyNamespace;

        	highTemp = parseInt(config[globalNamespace + "highTemp"])
        	mediumTemp = parseInt(config[globalNamespace + "medTemp"])

        	updateFromDom();

	
			// Check for empty data
			if(_.size(data.results) < 1) { console.log("no data"); return; }


			var dataRows = data.results;

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
