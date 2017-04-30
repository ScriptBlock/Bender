/*
 * Visualization source
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


var constantRotations = new Object();

//TODO this needs to get fixed 
var highTemp, mediumTemp;

//for model interaction
var raycaster;
var mouse;

var partSprites = new Object();


var crudMode = false;
var crudCommand;




/**
 * Main animation loop
 */
function animate() {
	requestAnimationFrame(animate);
	TWEEN.update();
	rotateObjects();	
	render();
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
			camera.aspect = globalElement.innerWidth()/globalElement.innerHeight();
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
			//"storage/collections/data/scene_models/" + key,
			"/servicesNS/nobody/Bender/storage/collections/data/scene_models/" + key,
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
	TWEEN.removeAll();
	constantRotations = new Object();
}


/**
 * Scene creation for repeatability
 */
function createDefaultScene() {
	scene = new THREE.Scene();
	scene.add( new THREE.GridHelper( 500, 100 ) );
	scene.background = new THREE.Color( 0x505050 );

	return scene;
}

/**
 * Used by formatter/preference based scene selection.  This is 
 * NOT a CRUD function.  The visualization has to have it's 
 * scene preference set in order to show anything at all.  
 * This is just a wrapper.
 */
function loadSceneByName(sceneName) {
	mvcService.request("/servicesNS/nobody/Bender/storage/collections/data/scenes",
		"GET",
		null,
		null,
		null,
		null,
		function(err, response) {
			var tempSceneInfo = _.findWhere(response.data, {"sceneName":sceneName});
			currentSceneName = tempSceneInfo.sceneName;
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
	//mvcService.request("storage/collections/data/scene_models", 
	mvcService.request("/servicesNS/nobody/Bender/storage/collections/data/scene_models", 
		"GET", 
		{"query": searchString},  // i set a REST query/filter here.  Probably easier and more maintainable to use underscore to filter and just pull the whole dataset in this query.
		null,
		null,
		null,	
		function(err, response) {
			//loop through the models and create a hash that contains all of the keys and their positional data directly from the kvstore
			_.each(response.data, function(model) { currentSceneComponents[model._key] = model; });

			//Get all field mappings.  Field mappings contain all of the specific component metdata that is used when drawing and interactive with parts in non-CRUD mode
			//mvcService.request("storage/collections/data/model_component_mapping",
			mvcService.request("/servicesNS/nobody/Bender/storage/collections/data/model_component_mapping",
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
	constantRotations = new Object();
	partSprites = new Object();
	
	rebuildTweens();

	loadSceneModels(currentSceneKey); 

}


/**
 * rotateObjects() is called during the animation frame.  all it does is rotate the part by 
 * whatever increment is set from the data.  it may be helpful to only process every n frames.
 * ideally value would relate to RPMs  or at least relative speed.  right now it's just
 * arbitrary
 */
function rotateObjects() {
	_.each(constantRotations, function(r) {
		var currentRotation = r.part.part.rotation[r.part.mappingData.rotationAxis];
		if(currentRotation == 0 || currentRotation == -0) {
			currentRotation = r.part.part.rotation[r.part.mappingData.rotationAxis] = 1;
		}
		r.part.part.rotation[r.part.mappingData.rotationAxis] += r.speed;
	})
}

/**
 * sets up the increment used in rotateobjects().  
 * would be handy to have a linear scale method in here or some clamping. 
 * because the rotation happens every frame, only very small numbers are useful (.05 -> .2 maybe)
 * 
 */
function constantRotate(partInfo, newValue) {
	var speed = parseFloat(newValue);
	if(constantRotations[partInfo.mappingData._key]) {
		if(speed == 0) {
			delete constantRotations[partInfo.mappingData._key];	
		} else {
			constantRotations[partInfo.mappingData._key].speed = speed;
		}
	} else {
		constantRotations[partInfo.mappingData._key] = new Object();
		constantRotations[partInfo.mappingData._key].part = partInfo;
		constantRotations[partInfo.mappingData._key].speed = speed;
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
	if(newValue == 0) { actualRadians = 0; }
	var rotationTween = new TWEEN.Tween({axis:partInfo.part.rotation[partInfo.mappingData.rotationAxis], obj:partInfo})
								 .to({axis:actualRadians},300)
								 .onUpdate(function() { this.obj.part.rotation[this.obj.mappingData.rotationAxis] = this.axis; })
								 .onComplete(function() { TWEEN.remove(this); }) //removing the tween is important otherwise a huge array gets built and never cleaned up
								 .easing(TWEEN.Easing.Exponential.InOut);

	TWEEN.add(rotationTween.start());

}


function setDoor(partInfo, newValue) {
	if(newValue == "open") {
		rotatePart(partInfo, partInfo.mappingData.rotationOffset);
	} else {
		rotatePart(partInfo, 0);
	}
}


function setPartLight(partInfo, newValue) {
	if(newValue == "on") {
		partInfo.part.intensity = 5;
	} else {
		partInfo.part.intensity = 0;
	}
}


function showMotion(partInfo, newValue) {
	if(newValue == "inactive") {
		partInfo.part.material.emissive.r = 0;
		partInfo.part.material.emissive.g = 0;
		partInfo.part.material.emissive.b = 0;
	} else {
		partInfo.part.material.emissive.r = 1;
		partInfo.part.material.emissive.g = 1;
		partInfo.part.material.emissive.b = 1;		
	}


}

function setPartTemperature(partInfo, newValue) {
	//these are all just hardcoded for the moment

	var temperature = parseFloat(newValue);

	if(temperature) {
		var r = 1;
		var g = 0, b = 0;

		if(newValue < 80) {
			r = 1 ;
			g = 0;
			b = 0.5;
		}


		if(newValue < 70) {
			r=0.5;
			g = 0;
			b = 1;
		}

		if(newValue < 60) {
			r = 0;
			g = 0;
			b = 1;
		} 
		partInfo.part.material.emissive.r = r;
		partInfo.part.material.emissive.g = g;
		partInfo.part.material.emissive.b = b;
	}

}

/**
 * Dictates code based behavior from user-defined part role.  In the long term, there would be a number of actions that would be supported.
 * Some thoughts:
 *    Rotation, constantrotation, temperature, light, door, motion, linear/rail
 */
function processPart(partInfo, newValue) {
	var thePart = partInfo.part;
	var mappingMetaData = partInfo.mappingData;

	if(!_.isUndefined(partSprites[thePart.name])) {
		//console.log("processing change for " + thePart.name);
		//console.log(thePart);

		var newPosition = thePart.getWorldPosition();
		if(_.size(thePart.children) > 0) {
			newPosition = thePart.children[0].getWorldPosition();
		}

		partSprites[thePart.name].position.copy(newPosition);
		//partSprites[thePart.name].position.z += 40;
		partSprites[thePart.name].position.x += 15;

		//partSprites[thePart.name].position.x += (20*partSprites[thePart.name].vizoffset);

		//partSprites[thePart.name].translateOnAxis(camera.position, 20);
		//console.log(thePart.name + ": position: ");
		//console.log(partSprites[thePart.name].position);
		updateTextSprite(partSprites[thePart.name], thePart.name + "|Value:" + newValue);
	}

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
		case "Door":
			setDoor(partInfo, newValue);
			break;
		case "Motion":
			showMotion(partInfo, newValue);
			break;
	}
}


function onDocumentTouchStart( event ) {
	event.preventDefault();
	event.clientX = event.touches[0].clientX;
	event.clientY = event.touches[0].clientY;
	onDocumentMouseDown( event );
}

function onDocumentMouseDown( event ) {
	event.preventDefault();
	
	var rect = renderer.domElement.getBoundingClientRect();

	mouse = new THREE.Vector3( (event.clientX - rect.left)/rect.width*2-1,
							  -(event.clientY - rect.top)/rect.height*2+1,
							  0.5);
	
	raycaster.setFromCamera( mouse, camera );

	var objectsToSearch = _.pluck(currentSceneComponents, 'threeObject');
	var intersects = raycaster.intersectObjects( objectsToSearch, true );
	if ( intersects.length > 0 ) {

		var partName = intersects[0].object.name;
		//this is a little hack to make sure that the parent of the mesh is chosen when the mesh is part of a group of objects
		if(intersects[0].object.parent.type == 'Group') {
			partName = intersects[0].object.parent.name;
		}

		
		if(!_.isUndefined(partSprites[partName])) {
			if(partSprites[partName].visible) {
				partSprites[partName].visible = false;
			} else {
				partSprites[partName].visible = true;
			}

		} else {
			var spritey = createTextSprite(partName);
			//spritey.vizoffset = _.size(partSprites)+1;
			spritey.position.copy(intersects[0].point);
			//spritey.position.z += 20;
			spritey.position.x += 15;
			//spritey.position.x += (20*spritey.vizoffset);

			//spritey.translateOnAxis(camera.position, 20);
			partSprites[partName] = spritey;
			scene.add(partSprites[partName]);
		}
		
	}
	
}


/**
 * This creates the sprite texture using the text provided
 */
function createTextTexture(textContent) {
	var textObjs = textContent.split("|");
	var textLines = _.size(textObjs);
	var maxTextSize = _.max(_.map(textObjs, function(o) { return _.size(o)}));
	var longestTextString = _.find(textObjs, function(o) { return o.length == maxTextSize});


	var textSize = 30;
	var borderSize = 4;
	var canvas = document.createElement('canvas');
	canvas.width=350;

	var context = canvas.getContext('2d');
	context.font = textSize + "px Courier New";

	var metrics = context.measureText(longestTextString);
	var textWidth = metrics.width;
	
	context.fillStyle = "rgba(0,0,0,1)";
	context.fillRect(0,0,textWidth*2+borderSize,textSize*textLines+15+borderSize);

	context.fillStyle = "rgba(255,255,255,1)";
	context.strokeStyle = "rgba(255,255,255,1)";
	context.lineWidth = 1;
	var i = 1;
	_.each(textObjs, function(o) {
		context.fillText(o, 10, (textSize*i++)+5);
	});

	var texture = new THREE.CanvasTexture(canvas);
	return texture;
}

/**
 * Leverages createTextTexture and creates a Sprite material
 */
function createTextMaterial(textContent) {
	var texture = createTextTexture(textContent);
	var spriteMaterial = new THREE.SpriteMaterial({map:texture});
	return spriteMaterial;
}

/**
 * Uses helper methods to create the on screen sprite
 */
function createTextSprite(textContent) {
	var sprite = new THREE.Sprite(createTextMaterial(textContent));
	sprite.scale.set(20,20,0);
	return sprite;
}

/**
 * Updating existing sprites with new text textures
 */
function updateTextSprite(sprite, textContent) {
	var newSpriteTexture = createTextTexture(textContent);
	sprite.material.map = newSpriteTexture;
	sprite.material.map.needsUpdate = true;
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

		    mvcService = mvc.createService({ owner: "nobody"});
			loader = new THREE.ObjectLoader();


			//For model interaction
			renderer.domElement.addEventListener( 'mousedown', onDocumentMouseDown, false );
			raycaster = new THREE.Raycaster();
			mouse = new THREE.Vector3();


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
                outputMode: SplunkVisualizationBase.RAW_OUTPUT_MODE,
                count: 10000
            });
        },

        // Override to respond to re-sizing events
        reflow: function() {
			renderer.setSize( globalElement.innerWidth(), globalElement.innerHeight() );
			camera.aspect = globalElement.innerWidth()/globalElement.innerHeight();
			camera.updateProjectionMatrix();
			render();			
        }
    });
});
