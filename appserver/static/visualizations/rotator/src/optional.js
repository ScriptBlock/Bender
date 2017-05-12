define("optional", [], {
    load : function (moduleName, parentRequire, onload, config){

        var onLoadSuccess = function(moduleInstance){
            onload(moduleInstance);
        }

        var onLoadFailure = function(err){
            var failedId = err.requireModules && err.requireModules[0];
            console.warn("Could not load optional module: " + failedId);
            requirejs.undef(failedId);
            define(failedId, [], function(){return {};});
            parentRequire([failedId], onLoadSuccess);
        }

        parentRequire([moduleName], onLoadSuccess, onLoadFailure);
    }
});

