'use strict';
var async = require('async');
var log = require('./logger');
var bitcoin = require('bitcoin');
var config = require('../config');
var Web3 = require('web3');
var web3Handler = new Web3(new Web3.providers.WebsocketProvider('wss://mainnet.infura.io/ws'));
var client;


function rpchelper() {
    client = new bitcoin.Client(config.clientConfig);
    log.info('Connecting to wallet');
}

rpchelper.prototype.getTransaction = function (hash, callback) {
    if (hash === '0000000000000000000000000000000000000000000000000000000000000000') {
        callback(null, 'coinbase');
        return;
    }
    async.retry({ times: 3, interval: 200 }, async.apply(getTransaction, hash), function (err, info) {
        if (err) {
            log.error(hash, err);
            callback(err, null);
        } else {
            callback(null, info);
        }
    });
};

function getTransaction(hash, callback) {
    if (hash === '0000000000000000000000000000000000000000000000000000000000000000') {
        callback(null, 'coinbase');
        return;
    }
    client.cmd('getrawtransaction', hash, 0, function (err, info, resHeaders) {
        if (err) {
            //   log.error(hash, err);
            callback(err, null);
        } else {
            callback(null, info);
        }
    });
};

rpchelper.prototype.getProgress = function (callback) {
    console.log('reaching')

    client.cmd('getblockchaininfo', function (err, info) {
        if (err) {
            console.log('reaching', err, info)
            callback(err, null);
            return;
        }
        console.log('reaching', err, info)
        callback(null, info.verificationprogress);
        return;
    });
};

rpchelper.prototype.getLatestBlockHeight = function (callback) {
    client.cmd('getinfo', function (err, info) {
        if (err) {
            callback(err, null);
            return;
        }
        callback(null, info.blocks);
        return;
    });
};


//module.exports = rpchelper;

// k.getProgress(() => { })
