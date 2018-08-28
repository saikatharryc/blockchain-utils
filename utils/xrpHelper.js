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
            console.error(error.message)
        }
    };

    generateAddress() {
        try {
            return this.api.generateAddress();
        } catch (error) {
            console.error(error);
        }
    };

    async getBalance(address, currency) {
        try {
            let balance = await this.api.getBalances(address, { currency: currency.toUpperCase() });
            return balance;
        } catch (error) {
            console.error(error);
        }
    };
    async getTransaction(txHash) {
        try {
            let tx = await this.api.getTransaction(txHash);
            return tx;
        } catch (error) {
            console.error(error);
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
            return await this.api.preparePayment(srcAddress, payment, {
                maxLedgerVersionOffset: 3,
                // maxFee: this.api._maxFeeXRP
            });
        } catch (error) {
            console.error(error);
        }
    };

    signRawTx(txJSON, secret) {
        try {
            txJSON = (typeof txJSON == 'string') ? txJSON : JSON.stringify(txJSON);
            return this.api.sign(txJSON, secret);
        } catch (error) {
            console.error(error);
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
            return await this.api.submit(signedTransaction);
        } catch (error) {
            console.error(error);
        }
    }
};

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
    // console.log(await classObj.broadcast(r.signedTransaction))
    console.log(await classObj.getBalance('rEumNCFuxDinZJzD5jEgx7JvpPb6ipsqpB', 'XRP'))
})(); */
module.exports = {
    /* nonce: nonce,
    createTx: createTransaction,
    signTx: signTransaction,
    broadcastTx: broadcastTransaction,
    txDetails: getTxDetails,
    balance: balance */
};
/* resultCode:"tecNO_DST_INSUF_XRP"
resultMessage:"Destination does not exist. Too little XRP sent to create it." */