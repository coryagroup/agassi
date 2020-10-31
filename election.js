"use strict";

const Etcd2 = require ('node-etcd');
const etcdLeader = require ('etcd-leader');
const os = require('os');
const DateFormat = require ('fast-date-format');


const dateFormat = new DateFormat('YYYY[-]MM[-]DD HH[:]mm[:]ss');

console.log (`[${dateFormat.format(new Date())}] starting process...`);


console.log (`[${dateFormat.format(new Date())}] connecting to etcd...`);
const etcd2 = new Etcd2 (['192.168.1.10:2379', 'http://192.168.1.12:2379', 'http://192.168.1.13:2379']);

// elect and monitor proxy leader
console.log (`[${dateFormat.format(new Date())}] determining leader...`);
const election = etcdLeader(etcd2, "/master", os.hostname(), 5).start();
var isMaster = false;
election.on ('elected', () => {
    console.log (`[${dateFormat.format(new Date())}] this node elected as leader`);
    isMaster = true;
});
election.on ('unelected', function() {
    console.log (`[${dateFormat.format(new Date())}] this node is no longer leader`);
    isMaster = false;
});
election.on ('leader', (node) => {
    console.log (`[${dateFormat.format(new Date())}] node ${node} elected as leader`);
});
