"use strict";

const dolphin = require ('dolphin')();
const docker = require ('dockerode');
const print = require ('./print.js');

// print ('fetching networks...');
// dolphin.networks().then ((networks) => print (networks));

print ('watching events...');
dolphin.events({})
.on ('event', async (event) => {
    // on service things
    if (event.Type == 'service') {
        console.log (`EVENT: ${event}`);
        console.log (`SERVICE: ${await docker.getService(event.Actor.ID).inspect()}`);
    };
})
.on ('error', (error) => {
	console.error ('Error:', error);
});