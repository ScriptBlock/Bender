# Bender
Splunk app that contains a custom vizualization for moving 3D components based on data from Splunk.

There is a tutorial dashboard under the Search Nav Bar that is worth reviewing.  Some of the tutorial stuff is still out of date.

Some TL;DR key points:
- Models are in appserver/static.
- Models were all made using the three.js editor
- Your models have to have "Group" objects with parts lumped under them.  sorry.  the modeling part kind of sucks.
- there's a bug in there somewhere where the mouseover intersection code breaks and the viz stalls out. reloading the page generally helps.
- you will pretty much always want to add scenelighting.json to your scene to lighten things up, unless your models are paricularly emissive.
- your data should boil down to part, and value fields.  these are mapped up in the component mapping dashboard.
- When mapping components, the x, y, and z angles are a crap-shoot.  It all depends on how you created your models and the relative facing.  sorry.
 
The following models are pre-loaded:
- door.json: A simple door that can be used to swing open and closed.
- grinder.json: a machine thats meant to look like it smashes and grinds things.  
- jetengine.json: a.. jet.. engine.  the center-mass is not actually centered so it spins all jankey.  sorry.  I also don't think this one has part groupings.  sorry.
- scenelighting.json: base scene lighting.  you will want to move it up high and off-center in your scene most likely.
- table.json: a table.
- ur6.json: a robot arm.  the first ( and best ) model available.
- windmill_with_groups.json: a windmill with fields properly groups.

Hovering over parts indicate the capability to map behavior to them.  If you have a data field mapped to that part, clicking on it will set the "clickedpartname" dashboard token. This can be used to make your other dashboard panels react to clicks on the 3d model.  

Credit to three.js guys @ http://threejs.org.  Their code is awesome and I appreciate that I can use it and view the source.  
