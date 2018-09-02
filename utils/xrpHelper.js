const RippleAPI = require('ripple-lib').RippleAPI;

class xrpHelper {

    constructor() {
        this.api = new RippleAPI({
            // server: 'wss://s1.ripple.com' // Public rippled server hosted by Ripple, Inc.
            server: 'wss://s.altnet.rippletest.net:51233', // Public rippled server hosted by Ripple, Inc.,
            maxFeeXRP: '0.5'
        });
    }

    async connect() {
        try {
            await this.api.connect();
            return this.api.isConnected();
        } catch (error) {
            return Promise.reject({ status: false, reason: error.message || error });
        }
    };

    generateAddress() {
        try {
            return this.api.generateAddress();
        } catch (error) {
            return Promise.reject({ status: false, reason: error.message || error });
        }
    };
    isConnected() {
        if (this.api.isConnected()) {
            return;
        } else throw Error('Not connected to node');
    }
    async getBalance(address, currency) {
        try {
            this.isConnected();
            let balance = await this.api.getBalances(address, { currency: currency.toUpperCase() });
            return balance;
        } catch (error) {
            return Promise.reject({ status: false, reason: error.message || error });
        }
    };
    async getTransaction(txHash) {
        try {
            this.isConnected();
            let tx = await this.api.getTransaction(txHash);
            return tx;
        } catch (error) {
            return Promise.reject({ status: false, reason: error.message || error });
        }
    };

    async prepareRawTx(srcAddress, destinationAddr, destinationTag, amount) {
        try {
            const payment = {
                "source": {
                    "address": `${srcAddress}`,
                    "maxAmount": {
                        "value": `${amount}`,
                        "currency": "XRP",
                        "counterparty": `${destinationAddr}`
                    }
                },
                "destination": {
                    "address": `${destinationAddr}`,
                    "tag": destinationTag,
                    "amount": {
                        "value": `${amount}`,
                        "currency": "XRP",
                        "counterparty": `${srcAddress}`
                    }
                }
            };
            this.isConnected();
            return await this.api.preparePayment(srcAddress, payment, {
                maxLedgerVersionOffset: 3,
                // maxFee: this.api._maxFeeXRP
            });
        } catch (error) {
            return Promise.reject({ status: false, reason: error.message || error });
        }
    };

    signRawTx(txJSON, secret) {
        try {
            txJSON = (typeof txJSON == 'string') ? txJSON : JSON.stringify(txJSON);
            return this.api.sign(txJSON, secret);
        } catch (error) {
            return Promise.reject({ status: false, reason: error.message || error });
        }
    }
    static isJson(str) {
        try {
            JSON.parse(str);
        } catch (e) {
            return false;
        }
        return true;
    }

    async broadcast(signedTransaction) {
        try {
            this.isConnected();
            return await this.api.submit(signedTransaction);
        } catch (error) {
            return Promise.reject({ status: false, reason: error.message || error });
        }
    }
};
let exporterInstance = new xrpHelper();
module.exports = {
    getNewAccount: exporterInstance.generateAddress,
    createTx: exporterInstance.prepareRawTx,
    signTx: exporterInstance.signRawTx,
    broadcastTx: exporterInstance.broadcast,
    txDetails: exporterInstance.getTransaction,
    balance: exporterInstance.getBalance
};
/* resultCode:"tecNO_DST_INSUF_XRP"
resultMessage:"Destination does not exist. Too little XRP sent to create it." */


/* (async () => {
    let classObj = new xrpHelper();
    console.log(await classObj.connect());
    console.log(await classObj.getBalance('rEumNCFuxDinZJzD5jEgx7JvpPb6ipsqpB', 'XRP'))
    console.log(await classObj.getTransaction('ADEC6CE2D1F0A5A8B603DD6A6F7012511FACDBC3524381B4CC2D8EC10B16697C'))


    let raw = await classObj.prepareRawTx('rEumNCFuxDinZJzD5jEgx7JvpPb6ipsqpB',
        'r9kiSEUEw6iSCNksDVKf9k3AyxjW3r1qPf', 55, 100);
    const j = raw.txJSON;
    const r = classObj.signRawTx(j, 'shDprshePuAjYtjRgMvysqNHT3rs3');
    console.log(r);
    console.log(await classObj.broadcast(r.signedTransaction))
    console.log(await classObj.getBalance('rEumNCFuxDinZJzD5jEgx7JvpPb6ipsqpB', 'XRP'))
})(); */