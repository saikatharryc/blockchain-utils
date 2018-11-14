let sysUtils = require('util');
let config = require('../config');
let zcash = require('bitgo-utxo-lib');
let Insight = require('bitcore-explorers').Insight;
let currentChain = config.network.ZEC.current || 'test';
let zecConfig = config.network.ZEC
const CURRENT_NETWORK = zcash.networks[zecConfig[zecConfig.current]];
let zecHandler = new Insight(zecConfig.insightProvider[currentChain], CURRENT_NETWORK);

Object.defineProperty(Array.prototype, 'flat', {
    value: function (depth = 1) {
        return this.reduce(function (flat, toFlatten) {
            return flat.concat((Array.isArray(toFlatten) && (depth - 1)) ? toFlatten.flat(depth - 1) : toFlatten);
        }, []);
    }
});

Number.prototype.toSatoshi = function () {
    if (isNaN(this))
        return NaN;
    if (this === 0)
        return 0;
    var str = this.toString();
    var sign = (str.indexOf('-') === 0) ? "-" : "";
    str = str.replace(/^-/, '');
    if (str.indexOf('e') >= 0) {
        return parseInt(sign + str.replace(".", "").replace(/e-8/, "").replace(/e-7/, "0"), 10);
    } else {
        if (!(/\./).test(str))
            str += ".0";
        var parts = str.split(".");
        str = parts[0] + "." + parts[1].slice(0, 8);
        while (!(/\.[0-9]{8}/).test(str)) {
            str += "0";
        }
        return parseInt(sign + str.replace(".", "").replace(/^0+/, ""), 10);
    }
};
/**
 * 
 * @param {*} addresses 
 */
// getUtxos(['t27RQiQajxJWqAyowqguKaxrMhof4m9hCJ8'])
// createTransaction(['t2P5qnbTJL6dZvXUTRRdbtR4qHipPbB7zhk'], 't2P5qnbTJL6dZvXUTRRdbtR4qHipPbB7zhk', 1000000)
async function getUtxos(addresses = []) {
    zecHandler.requestPost = sysUtils.promisify(zecHandler.requestPost);
    let utxoArray = await zecHandler.requestPost('/api/addrs/utxo', {
        addrs: addresses.map((address) => {
            return address.toString();
        }).join(',')
    });

    if (utxoArray.length < 1) throw new Error(' [getUtxos] Found ' + utxoArray.length + ' utxos');
    let resultArray = utxoArray.body.map((utxo, i) => {
        try { zcash.address.fromBase58Check(utxo.address); } catch (e) { throw new Error(e); }
        //change below when rpc
        return ({
            address: utxo.address,
            txid: utxo.txid,
            amountInSatoshi: utxo.amount.toSatoshi(),
            voutIndex: parseInt(utxo.vout),
            script: Buffer.from(utxo.scriptPubKey)
        });
    });
    // console.log(utxoArray.body)
    return resultArray;
}
async function createTransaction(addresses = [], toAddress, sendAmount, fees = 10000, sequenceId = 0) {
    if (addresses.length < 1 || toAddress == null || sendAmount == null) { return ({ status: false, error: 'transaction params not provided' }); }
    try {
        sendAmount = isNaN(parseInt(sendAmount)) ? 0 : parseInt(sendAmount);
        zcash.address.fromBase58Check(toAddress);
        let utxos = await getUtxos(addresses);
        let txBuilder = new zcash.TransactionBuilder(CURRENT_NETWORK);
        let sum = 0, isDone = false, vinOrder = [];
        // utxos.forEach((utxo) => { sum += utxo.amountInSatoshi || 0 });
        txBuilder.setVersion(zcash.Transaction.ZCASH_SAPLING_VERSION);
        txBuilder.setVersionGroupId(parseInt('0x892F2085', 16));

        utxos.map((utxo, i) => {
            // console.log(utxo)
            sum += utxo.amountInSatoshi;
            if (!isDone) {
                if (sum >= (sendAmount + fees)) {
                    txBuilder.addInput(utxo.txid, utxo.voutIndex/* , sequenceId, utxo.script */);
                    txBuilder.addOutput(utxo.address, (sum - (sendAmount + fees)));
                    vinOrder.push(utxo.address);
                    isDone = true;
                    return;
                }
                if (sum <= (sendAmount + fees)) {
                    txBuilder.addInput(utxo.txid, utxo.voutIndex/* , sequenceId, utxo.script */);
                    vinOrder.push(utxo.address);
                }
            }
        });
        if (!isDone)
            return ({ status: false, error: 'Not enough balance, Please provide more UTXOs' });
        txBuilder.addOutput(toAddress, sendAmount);
        return ({
            status: true,
            unsignedHex: txBuilder.buildIncomplete().toHex(),
            vinOrder: vinOrder
        });
    } catch (error) {
        return ({ status: false, error: error.message || error });
    }

};
async function signTransaction(tx, privateKeys = [], redeemScriptHex) {
    if (privateKeys == null || tx == null) { return ({ status: false, error: '[signTransaction] Txn params not provided' }); }
    try {
        let utxoSet = await getUtxos(config.HOTWALLET.ZEC.from);
        const hashType = zcash.Transaction.SIGHASH_ALL;
        let txObject = zcash.Transaction.fromHex(tx.unsignedHex, CURRENT_NETWORK);
        let redeemScript = Buffer.from(redeemScriptHex, 'hex');
        var unsignedTx = zcash.TransactionBuilder.fromTransaction(txObject, CURRENT_NETWORK);
        unsignedTx.tx.ins.forEach((vin, i) => {
            let inputValueToSign = 0;
            for (let key in unsignedTx.prevTxMap) {
                let txid = key.split(':')[0];
                txid = Buffer.from(txid, 'hex').reverse().toString('hex');
                let prevTxId = Buffer.from(vin.hash).reverse().toString('hex');
                utxoSet.forEach(utxo => {
                    if ((utxo.txid == prevTxId) && (utxo.txid == txid) && utxo.voutIndex == vin.index)
                        inputValueToSign = utxo.amountInSatoshi;
                });
            }
            unsignedTx.sign(i, zcash.ECPair.fromWIF(privateKeys[0], CURRENT_NETWORK), redeemScript, hashType, inputValueToSign);
            unsignedTx.sign(i, zcash.ECPair.fromWIF(privateKeys[1], CURRENT_NETWORK), redeemScript, hashType, inputValueToSign);
        });
    } catch (error) {
        console.error(error); return ({ status: false, error: error.message || error });
    }
    console.log('signedTx', unsignedTx.build().toHex());
    return {
        status: true,
        signedHex: unsignedTx.build().toHex()
    };
}
async function broadcastTransaction(serializedTx) {
    zecHandler.broadcast = sysUtils.promisify(zecHandler.broadcast);
    try {
        var broadcastedTxn = await zecHandler.broadcast(serializedTx);
        console.log('[broadcastedTxn]', broadcastedTxn)
        return ({ status: true, transactionHash: broadcastedTxn });
    } catch (error) {
        console.log(error)
        return ({ status: false, error: error.message || error });
    }
}
async function getTxDetails(txHash) {
    if (txHash == null) { return ({ status: false, error: 'TxHash is null or empty' }); }
    zecHandler.requestGet = sysUtils.promisify(zecHandler.requestGet);
    try {
        var details = await zecHandler.requestGet('/api/tx/' + txHash);
        if (details.statusCode != 200) throw new Error(details.body);
    } catch (e) {
        console.error('[getTxDetails]', e);
        return ({ status: false, error: e.message || e });
    }
    // console.log(details.body);
    if (details == null || details.body == null || details.body == 'Not found')
        return ({ status: false, error: 'Not found' });
    console.log('[zecHelper-getTxDetails]', JSON.parse(details.body));
    return ({ status: true, message: (details.body) });
}
async function balance(address) {
    if (address == undefined) { return ({ status: false, error: 'no address provided' }); }
    zecHandler.requestGet = sysUtils.promisify(zecHandler.requestGet);
    try {
        let bal = await zecHandler.requestGet('/api/addr/' + address)
            .catch(e => { return ({ status: false, error: e.message || e }); });
        return (bal.body == null) ? { status: true, balance: bal.body } : bal;
    } catch (error) {
        console.log({ method: 'balance', error: error.message || error })
        return ({ status: false, error: error.message || error });
    }
};

module.exports = {
    getUTXO: getUtxos,
    createTx: createTransaction,
    signTx: signTransaction,
    broadcastTx: broadcastTransaction,
    txDetails: getTxDetails,
    balance: balance
}
