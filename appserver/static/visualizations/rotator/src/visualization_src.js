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

var camera, scene, loader, renderer;
var base, shoulder, elbow, wrist1, wrist2, wrist3;
var counter = 0;
var activeTween;


function animate() {
	requestAnimationFrame(animate);
	render();
	TWEEN.update();

}

function render() {
	camera.lookAt(scene.position);
	renderer.render(scene, camera);

}


    // Extend from SplunkVisualizationBase
    return SplunkVisualizationBase.extend({
  

        initialize: function() {
            SplunkVisualizationBase.prototype.initialize.apply(this, arguments);
            this.$el = $(this.el);
            hasViz = false;
            this.$el.addClass('rotator');
            // Initialization logic goes here
			camera = new THREE.PerspectiveCamera( 80, window.innerWidth/window.innerHeight, 0.1, 1000 );	

			camera.position.y = 40;
			camera.position.z = 45;


			scene = new THREE.Scene();

			loader = new THREE.ObjectLoader();

			loader.load(armJSONFile, function(obj) {
				scene.add(obj);


			});


			renderer = new THREE.WebGLRenderer();
			renderer.setPixelRatio( window.devicePixelRatio );
			renderer.setSize( window.innerWidth, window.innerHeight );

			this.$el.append(renderer.domElement);

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

		// Check for empty data
		if(data.rows.length < 1) { return; }


			if(!base || !shoulder || !elbow || !wrist1 || !wrist2 || !wrist3) {
				scene.traverse(function(i) {
					if(i.name == "Base") { base = i; }
					if(i.name == "Shoulder") { shoulder = i; }
					if(i.name == "Elbow") { elbow = i; }
					if(i.name == "Wrist1") { wrist1 = i; }
					if(i.name == "Wrist2") { wrist2 = i; }
					if(i.name == "Wrist3") { wrist3 = i; }
				});
			} else {
		        var actualRadians=THREE.Math.degToRad(data.rows[0][1]*mathjs.PI/180);
				switch(data.rows[0][0]) {
					case "base":
						new TWEEN.Tween({y:base.rotation.y, obj:base, tween:activeTween})
								.to({y:actualRadians}, 200)
								.onUpdate(function() { this.obj.rotation.y = this.y; })
								.easing(TWEEN.Easing.Exponential.InOut)
								.start();
						break;
					case "shoulder":
						new TWEEN.Tween({y:shoulder.rotation.y, obj:shoulder, tween:activeTween})
								.to({y:actualRadians}, 200)
								.onUpdate(function() { this.obj.rotation.y = this.y; })
								.easing(TWEEN.Easing.Exponential.InOut)
								.start();
						break;
					case "elbow":
						new TWEEN.Tween({x:elbow.rotation.x, obj:elbow, tween:activeTween})
								.to({x:actualRadians}, 200)
								.onUpdate(function() { this.obj.rotation.x = this.x; })
								.easing(TWEEN.Easing.Exponential.InOut)
								.start();
						break;
					case "wrist1":
						new TWEEN.Tween({y:wrist1.rotation.y, obj:wrist1, tween:activeTween})
								.to({y:actualRadians}, 200)
								.onUpdate(function() { this.obj.rotation.y = this.y; })
								.easing(TWEEN.Easing.Exponential.InOut)
								.start();
						break;
					case "wrist2":
						new TWEEN.Tween({y:wrist2.rotation.y, obj:wrist2, tween:activeTween})
								.to({y:actualRadians}, 200)
								.onUpdate(function() { this.obj.rotation.y = this.y; })
								.easing(TWEEN.Easing.Exponential.InOut)
								.start();
						break;
					case "wrist3":
						new TWEEN.Tween({y:wrist3.rotation.y, obj:wrist3, tween:activeTween})
								.to({y:actualRadians}, 200)
								.onUpdate(function() { this.obj.rotation.y = this.y; })
								.easing(TWEEN.Easing.Exponential.InOut)
								.start();
						break;
				}
			}		
        },

        // Search data params
        getInitialDataParams: function() {
            return ({
                outputMode: SplunkVisualizationBase.ROW_MAJOR_OUTPUT_MODE,
                count: 10000
            });
        },

        // Override to respond to re-sizing events
        reflow: function() {}
    });
});
