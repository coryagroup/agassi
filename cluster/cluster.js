"use strict";

const http = require ('http');
const phin = require ('phin');
const rr = require ('rr');
const os = require ('os');
const ip = require ('ip');

// share listening server and automatic discovery
const discovery = require ('./discovery.js');
const share = require ('./share.js');

share.on ('listening', function startDiscovery () {
    // share.address ();
    let netinfo = Object.values (os.networkInterfaces ()).find (interface => {
        return share.address ().family == interface.family && 
               share.address ().address == interface.address;
    });
    discovery.start ({
        address: netinfo.address,
        port: parseInt (process.env.PORT),
        broadcast: ip.cidrSubnet (netinfo.cidr).broadcastAddress
    })
});

share.on ('close', function stopDiscovery () {
    discovery.stop ();
});


// client agent for sharing certs (and challenges)
const shareAgent = new http.Agent ({
    keepAlive: true
});

/*
    synchronization steps:
    1. get list of certs from all peers
    2. create a set of all needed certs by combining peer cert lists
    3. starting with the peer with the most certs
        a. pull all the certs from that peer
        b. remove pulled certs from the needed set
    4. pull remaining certs from each peer until the needed set is empty
*/
async function sync () {
    // preserve order
    let peers = discovery.peers ();
    // get an array of arrays of all the hashes on each peer
    let hashes = await Promise.all (peers.map (peer => {
        (phin ({
            method: 'GET',
            url: `http://${peer.address}:${peer.port}/certs/list`,
            parse: 'json',
            timeout: 2000,
            core: {
                agent: shareAgent
            }
        })).body;
    }));
}

function createCertQuery (hashes) {
    let query = '';
    hashes.forEach (hash => query += `q=${hash}&`);
    return query;
}

async function push (hash, certificate) {
    return await Promise.all (discovery.peers ().map (peer => {
        phin ({
            method: 'POST',
            url: `http://${peer.address}:${peer.port}/`,
            timeout: 5000,
            data: JSON.stringify ({
                [hash]: certificate
            }),
            core: {
                agent: shareAgent
            }
        })
    }))
}

async function pullCerts (certHashes, chunkSize) {
    let query = '';
    for (let hash of certHashes) {
        query += 'q=' + hash;
    }
    try {
        return await phin ({
            url: `http://${rr (discover.peers ()).address}:${process.env.PORT}/certs?${query}`,
            parse: 'json',
            timeout: 1000
        });
    } catch {
        return Promise.any (discovery.peers ().map (peer => {
            phin ({
                url: `http://${peer.address}:${process.env.PORT}/certs?${query}`,
                parse: 'json',
                timeout: 2000
            });
        }));
    }
}

module.exports = {
    discovery,
    share
};