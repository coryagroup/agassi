"use strict";

const log = require ('./logger.js');

const Docker = require('./docker.js');
const ip = require ('ip');

const { spawn } = require ('child_process');

const Discovery = require ('./discovery.js');
const Redis = require ('ioredis');
const KeyDB = new Redis ();

// process instances
const ActiveChildren = new Map ();

// fetch all networks
Docker.API.listNetworks ().then (function main (networks) {
    // determine which is the relevent overlay
    const overlayNetwork = networks.find ((network) => {
        return network.Labels && network.Labels[Config.networkLabelKey] == Config.networkLabelValue;
    });
    // get the subnet and address parameters for the cluster
    const subnet = overlayNetwork.IPAM.Config[0].Subnet;
    const address = require ('@emmsdan/network-address').v4.find ((address) => {
        return ip.cidrSubnet (subnet).contains (address);
    });

    // start the local redis/keydb server
    ActiveChildren.set ('keydb-server', spawn ('keydb-server', [
        '--bind', '127.0.0.1', address, 
        '--active-replica', 'yes',
        '--databases', '1'
    ], { stdio: ['ignore', 'inherit', 'inherit'] }));

    
    ActiveChildren.set ('caddy-server', spawn ('caddy', [
        'docker-proxy',
        '-caddyfile-path', string,
        '-controller-network', subnet,
        '-mode', 'server'
    ], { stdio: ['ignore', 'inherit', 'inherit'] }));

    // start discovery
    Discovery.start ({
        broadcast: ip.cidrSubnet (subnet).broadcastAddress,
        port: 6379,
        address: address
    })
    // sync keydb on discovery.add and run caddy server
    .on ('added', async (peer) => {
        await KeyDB.replicaof (peer.address, peer.port);
    })
    // run controller and server on discovery.master
    .on ('promotion', async () => {
        await KeyDB.replicaof ('NO', 'ONE');
        ActiveChildren.set ('caddy-controller', spawn ('caddy', [
            'docker-proxy',
            '-caddyfile-path', string,
            '-controller-network', subnet,
            '-mode', 'controller'
        ], { stdio: ['ignore', 'inherit', 'inherit'] })
        .on ('exit', function exitCaddyController () {
            ActiveChildren.delete ('caddy-controller');
        }));
    })
    // stop controller on non-master instances
    .on ('demotion', () => {
        if (ActiveChildren.has ('caddy-controller')) {
            ActiveChildren.get ('caddy-controller').kill ();
        }
    });
});

process.on ('SIGINT', () => {
    log.info ('SIGINT ignored, use SIGTERM to exit.');
});

process.on ('SIGTERM', () => {
    log.info ('SIGTERM received, exiting...');
    Discovery.stop ();
    for (let p of ActiveChildren.values ()) {
        p.kill ();
    }
});