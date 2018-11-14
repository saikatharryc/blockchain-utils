var sysUtils = require('util');
var config = require('../config');
var bitcoin = require('bitcoinjs-lib');
var Insight = require('bitcore-explorers').Insight;
var btcHandler = new Insight(config.insightProvider[config.current]);
const CURRENT_NETWORK = bitcoin.networks[config.network.BTC[config.current]];
const DEFAULT_FEES = 50000;

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
async function getUtxos(addresses = []) {
    btcHandler.getUnspentUtxos = sysUtils.promisify(btcHandler.getUnspentUtxos);
    let utxoArray = await btcHandler.getUnspentUtxos(addresses);
    if (utxoArray.length < 1) throw new Error(' [getUtxos] Found ' + utxoArray.length + ' utxos');
    let resultArray = utxoArray.map((utxo, i) => {
        utxo = utxo.toObject();
        try { bitcoin.address.fromBase58Check(utxo.address); } catch (e) { throw new Error(e); }
        //change below when rpc
        return ({
            address: utxo.address,
            txid: utxo.txid,
            amountInSatoshi: utxo.amount.toSatoshi(),
            voutIndex: parseInt(utxo.vout),
            script: Buffer.from(utxo.scriptPubKey)
        });
    });

    return resultArray;
}

async function createTransaction(addresses = [], toAddress, sendAmount, fees = 10000, sequenceId = 0) {
    if (addresses.length < 1 || toAddress == null || sendAmount == null) { return ({ status: false, error: 'transaction params not provided' }); }
    try {
        sendAmount = isNaN(parseInt(sendAmount)) ? 0 : parseInt(sendAmount);
        bitcoin.address.fromBase58Check(toAddress);
        let utxos = await getUtxos(addresses);
        let txBuilder = new bitcoin.TransactionBuilder(CURRENT_NETWORK);
        let sum = 0, isDone = false, vinOrder = [];
        // utxos.forEach((utxo) => { sum += utxo.amountInSatoshi || 0 });
        txBuilder.setVersion(1)

        utxos.map((utxo, i) => {
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
        console.log({
            status: true,
            unsignedHex: txBuilder.buildIncomplete().toHex(),
            vinOrder: vinOrder
        });

        return ({
            status: true,
            unsignedHex: txBuilder.buildIncomplete().toHex(),
            vinOrder: vinOrder
        });
    } catch (error) {
        return ({ status: false, error: error.message || error });
    }

};

async function signTransaction(tx, privateKeys = {}) {
    if (privateKeys == null || tx == null || tx.vinOrder == null) { return ({ status: false, error: '[signTransaction] Txn params not provided' }); }
    try {
        let txObject = bitcoin.Transaction.fromHex(tx.unsignedHex);
        var unsignedTx = bitcoin.TransactionBuilder.fromTransaction(txObject, CURRENT_NETWORK);
        unsignedTx.tx.ins.forEach((vin, i) => {
            unsignedTx.sign(i, bitcoin.ECPair.fromWIF(privateKeys[tx.vinOrder[i]], CURRENT_NETWORK));
        });
    } catch (error) { console.error(error); return ({ status: false, error: error.message || error }); }
    console.log('signedTx', unsignedTx.build().toHex());
    return {
        status: true,
        signedHex: unsignedTx.build().toHex()
    };
}

async function broadcastTransaction(serializedTx) {
    btcHandler.broadcast = sysUtils.promisify(btcHandler.broadcast);
    try {
        var broadcastedTxn = await btcHandler.broadcast(serializedTx);
    } catch (error) {
        return ({ status: false, error: error.message || error });
    }
    return ({ status: true, message: broadcastedTxn });
}

async function getTxDetails(txHash) {
    if (txHash == null) { return ({ status: false, error: 'TxHash is null or empty' }); }
    btcHandler.requestGet = sysUtils.promisify(btcHandler.requestGet);
    try {
        var details = await btcHandler.requestGet('/api/tx/' + txHash);
        if (details.statusCode != 200) throw new Error(details.body);
    } catch (e) {
        console.error('[getTxDetails]', e);
        return ({ status: false, error: e.message || e });
    }
    // console.log(details);
    if (details == null || details.body == null || details.body == 'Not found')
        return ({ status: false, error: 'Not found' });
    console.log('[btcHelper-getTxDetails]', details.body);
    return ({ status: true, message: (details.body) });
}

async function balance(address) {
    if (address == undefined) { return ({ status: false, error: 'no address provided' }); }
    btcHandler.address = sysUtils.promisify(btcHandler.address);
    let bal = await btcHandler.address(address).catch(e => { return ({ status: false, error: e.message || e }); });
    return (bal.status == null) ? { status: true, balance: bal.balance.toString() } : bal;
};


module.exports = {
    getUTXO: getUtxos,
    createTx: createTransaction,
    signTx: signTransaction,
    broadcastTx: broadcastTransaction,
    txDetails: getTxDetails,
    balance: balance
};
