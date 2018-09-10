var Web3 = require('web3');
var async = require('async');
var logger = require('./logger');
var config = require('../config');
var ethTx = require('ethereumjs-tx');

var web3 = new Web3(new Web3.providers.HttpProvider(config.web3.http));

async function nonce(address) {
    if (address === undefined) { return Promise.reject({ status: false, error: 'no address provided' }); }
    try {
        var nonce = await web3.eth.getTransactionCount(address);
    } catch (error) {
        return Promise.reject({ status: false, error: error.message || error });
    }
    return parseInt(nonce);
};
async function balance(address) {
    console.log('function balance', address);
    if (address == undefined) { return ({ status: false, error: 'no address provided' }); }
    try {
        var bal = await web3.eth.getBalance(address);
    } catch (e) {
        return ({ status: false, error: e.message || e });
    }
    // .catch (e => { return ({ status: false, error: e.message || e }); });
    console.log('[balance]', bal);
    return (bal.status == null) ? { status: true, balance: bal } : bal;
};

async function broadcast(rawTxn) {
    console.log('[broadcast-REACHING]');
    if (rawTxn == undefined) { return Promise.reject('Deformed RawTXN'); }
    let serTxn = rawTxn.startsWith('0x') ? rawTxn : '0x' + rawTxn;
    try {
        var send = web3.eth.sendSignedTransaction(serTxn)
            .on('receipt', (e) => { console.error('[receipt]', e) })
            .on('transactionHash', function (hash) {
                console.log('[transactionHash]', hash);
            })
        var networkRes = await send;
    } catch (error) {
        return Promise.reject(error.message || error);
    }
    return send;

};

async function type(address) {
    if (address === undefined) {
        return ({ status: false, error: 'no address provided' });

    }
    try {
        web3.eth.getCode(address, function (error, result) {
            if (error) {
                logger.error('[api/balance] error address type local api:', { err: error, res: result });
                return ({ status: false, error: error.message });

            }
            let type = (result === '0x') ? 'account' : 'contract';
            logger.debug('[type]  txn:', { type: type, address: address });
            return ({ status: true, type: type });
        });

    } catch (e) {
        return ({ status: false, error: e.message, type: 'contract' });

    }
};

async function erc20AddressBalance(atAddress, contractAddress) {

    if (contractAddress == undefined || atAddress == undefined) {
        return ({ status: false, error: 'no contract address provided' });

    }
    var erc20Balance = 0;
    try {
        erc20Balance = await (new web3.eth.Contract(config.erc20ABI, contractAddress, { from: atAddress })).methods.balanceOf(atAddress).call();
    } catch (err) {
        erc20Balance = 0;
        return ({ status: false, error: err.message });
    }

    erc20Balance = new web3.utils.BN(erc20Balance);
    return ({ status: true, balance: erc20Balance.gt(0) ? erc20Balance.toString() : 0 });
};

async function createTransaction(tx) {
    try {
        var res = await Promise.all([await nonce(tx.fromAddress), await balance(tx.fromAddress)]);
        let nonceValue = res[0], addressBalance = web3.utils.toBN(res[1].balance);
        if (addressBalance.lte(web3.utils.toBN(tx.amount))) {
            return ({ status: false, error: 'available Balance is less than to transact' });
        }
        if (isNaN(parseInt(nonceValue))) { return ({ status: false, error: 'nonce is NAN' }); }
        const txParams = {
            nonce: nonceValue,
            gasPrice: web3.utils.toBN(web3.utils.fromWei(await web3.eth.getGasPrice(), 'wei')).mul(web3.utils.toBN(4)),
            gasLimit: config.gasLimit,
            to: tx.address,
            value: web3.utils.toBN(tx.amount),
            chainId: (config.net === 'MAINNET') ? 1 : 3
        }
        console.log('txParams', txParams);
        var unsignedTx = new ethTx(txParams).serialize().toString('hex');
    } catch (error) {
        console.log(error)
        return ({ status: false, error: error.message || error });
    }
    console.log('[createTransaction]', unsignedTx);
    return ({ status: true, message: { unsignedHex: unsignedTx } });
};

async function signTransaction(unsignedTx, privateKey) {
    let serializedTxn = '';
    try {
        var txn = new ethTx(unsignedTx);
        txn.sign(new Buffer(privateKey, 'hex'));
        serializedTxn = txn.serialize().toString('hex');
    } catch (error) {
        return ({ status: false, error: error.message || error });
    }
    console.log('[signTransaction]', txn.getBaseFee().toString());
    console.log('[signTransaction]', serializedTxn, txn.getUpfrontCost().toString());
    return ({ status: true, message: { signedHex: serializedTxn } });
};

async function broadcastTransaction(serializedTx) {
    console.log('[broadcastTransaction]', serializedTx);
    let broadcastResponse = null;
    try {
        broadcastResponse = await broadcast(serializedTx);
    } catch (error) {
        return ({ status: false, error: error.message || error });
    }
    return ({ status: true, message: broadcastResponse });
};

async function getTxDetails(txHash) {
    if (txHash == null) { return ({ status: false, error: 'TxHash is null or empty' }); }
    try {
        var details = await web3.eth.getTransactionReceipt(txHash);
    } catch (e) {
        console.error('[getTxDetails]', e);
        return ({ status: false, error: e.message || e });
    }
    if (details == null)
        return ({ status: false, error: 'Not found' });
    console.log('[ethHelper-getTxDetails]', details);
    return ({ status: true, message: details });
}

module.exports = {
    nonce: nonce,
    createTx: createTransaction,
    signTx: signTransaction,
    broadcastTx: broadcastTransaction,
    txDetails: getTxDetails,
    balance: balance,
    erc20AddressBalance: erc20AddressBalance
};
