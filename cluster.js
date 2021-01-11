"use strict";

const log = require ('./logger.js');

const Discover = require ('node-discover');
const { sleep } = require ('sleepjs');
const EventEmitter = require ('events');
const iprange = require ('iprange');

const rqlite = require ('./rqlite/rqlite.js');
const rqlited = require ('./rqlite/rqlited.js');

// default options
const options = {
    hostname: rqlited.uuid,
    port: 4002,
    nodeTimeout: 10 * 1000
};

// maintain a list of Peers external to node-discover nodes
const Peers = new Set ();

// which node is master
var isMaster = false;

// callback on discover creation
async function initialize (error) {

    if (error) { 
        process.exitCode = 1;
        throw error;
    }

    // looking for Peers
    log.debug ('Looking for peers...');
    const retries = 3; let attempt = 1;
    while ((Peers.size < 1) && (attempt <= retries)) {
        // backoff
        await sleep ( attempt * 20 * 1000);
        if (Peers.size < 1) {
            log.debug (`No peers found. Retrying (${attempt}/${retries})...`);
            attempt++;
        }
    }

    if (Peers.size == 0) { 
        log.warn ('Could not find any peers.'); 
    }

    // indicates completion status and joinHost
    // if this cluster node is master, "const joinAddress"
    // will be undefined here
    const joinAddress = Array.from (Peers.values ()).find ((node) => { return node.isMaster; });
    discovery.emit ('complete', options.address, joinAddress);
};

const discovery = new EventEmitter ()
.once ('complete', function spawnRqlited (listenAddress, joinAddress) {
    rqlited.spawn (listenAddress, joinAddress);
});

const RemovalTimeouts = new Map ();

// async function removeNode (nodeID) {
//     // if this node is master, remove the lost node
//     if (RemovalTimeouts.has (nodeID)) {
//         log.debug (`Removing node ${nodeID}...`);
//         await rqlite.cluster.remove (nodeID);
//     }
// }

module.exports = {
    
    start: (address, subnet, standalone) => {
        // start rqlited in standalone mode
        if (standalone === true) {
            log.debug ('Starting rqlited in standalone mode...');
            rqlited.spawn (andress, null, standalone);
            return;
        }
        // start automatic discovery
        log.debug ('Starting automatic discovery...');
        options.address = address;
        options.unicast = iprange (subnet);

    this.discover = new Discover (options, initialize)
        .on ('promotion', async () => {
            isMaster = true;
        })
        .on ('demotion', () => {
            isMaster = false;
        })
        .on ('added', (node) => {
            log.debug (`Found cluster discover node at ${node.address}.`);
            Peers.add (node.address);
            RemovalTimeouts.delete (node.address);
            // node added to cluster
            if (node.advertisement == 'ready' || node.advertisement == 'reconnected') {
                // initialize new node in existing cluster
                discovery.emit ('complete', address, node.address);
            }
        })
        .on ('removed', (node) => {
            log.debug (`Lost node ${node.hostName} at ${node.address}.`);
            Peers.delete (node.address);
        });
    },

    advertise: (advertisement) => {
        if (module.exports.discover && module.exports.discover instanceof Discover) {
            module.exports.discover.advertise (advertisement);
            log.debug (`Set cluster discover advertisement to ${advertisement}.`);
        }
    },

    isMaster: () => {
        return isMaster;
    },

    stop: () => {
        if (this.discover && this.discover instanceof Discover) {
            log.debug ('Stopping cluster auto-discovery...');
            this.discover.stop ();
        }
        rqlited.kill ();
    }
}