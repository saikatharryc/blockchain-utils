
var bip39 = require('bip39')
var hdkey = require('hdkey');
var bitcoin = require('bitcoinjs-lib');
var ethereumUtils = require('ethereumjs-util');
var config = require('../config');
const CHAIN_TYPE = {
    RECEIVE: { BTC: 0, ETH: 0 },
    CHANGE: { BTC: 0, ETH: 1 }
};
var MAX_GENERATOR_LIMIT = 100;
var SUPPORTED_COINS = ['BTC', 'ETH'];
var getCurrentNetwork = (coinType) => {
    let CURRENT_NETWORK = '', CURRENT_NETWORK_VERSION = '';
    switch (coinType.toUpperCase()) {
        case 'BTC':
            let btcConfig = config.network.BTC
            CURRENT_NETWORK = bitcoin.networks[btcConfig[btcConfig.current]];
            CURRENT_NETWORK_VERSION = bitcoin.networks[btcConfig[btcConfig.current]].bip32;
            break;
        case 'ETH':
            CURRENT_NETWORK = '';
            CURRENT_NETWORK_VERSION = '';
            break;
        case 'ZEC':
            let zcash = config.network.ZEC;
            CURRENT_NETWORK = zecUtils.networks[zcash[zcash.current]];
            CURRENT_NETWORK_VERSION = zecUtils.networks[zcash[zcash.current]].bip32;
            break;
        default:
            CURRENT_NETWORK = '';
            CURRENT_NETWORK_VERSION = '';
            break;
    }
    return {
        CURRENT_NETWORK: CURRENT_NETWORK,
        CURRENT_NETWORK_VERSION: CURRENT_NETWORK_VERSION
    };

};
var addressDerivation = {
    ETH: function (xpub, index) {
        let account = hdkey.fromExtendedKey(xpub).deriveChild(index)._publicKey;
        let nonCheckSumAddress = ethereumUtils.publicToAddress(account, true).toString('hex');
        return ethereumUtils.toChecksumAddress(nonCheckSumAddress);
    },
    BTC: function (xpub, index) {
        let pubKey = bitcoin.bip32.fromBase58(xpub, getCurrentNetwork('BTC').CURRENT_NETWORK).derive(index).publicKey;
        return bitcoin.payments.p2pkh({ pubkey: pubKey, network: getCurrentNetwork('BTC').CURRENT_NETWORK }).address;
    },
    ZEC: function (xpub, index) {
        let pubKey = zecUtils.HDNode.fromBase58(xpub, getCurrentNetwork('ZEC').CURRENT_NETWORK).derive(index).keyPair;
        return pubKey.getAddress();
    }
};

async function importAccFromMnemonic(mnemonic, coinType) {
    if (!bip39.validateMnemonic(mnemonic))
        return ({ status: false, error: 'Invalid 12 words mnemonic string' });

    let purpose = 44, coin = '', accountIndex = 0, chainType = 0; //External = 0 (receiving addresses); Internal =1 (change addresses); 
    let path = "m/";
    var account = {
        coin: coinType.toUpperCase(),
        mnemonicPhrase: '',
        accountXpriv: '',
        accountXpub: '',
        addressDerivationXpub: '',
        addresses: []
    };
    switch (coinType.toUpperCase()) {
        case 'BTC': {
            coin = 0;
            accountIndex = 0;
            path += purpose + "'/";
            path += coin + "'/";
            path += accountIndex + "'";
            let mnemonicString = mnemonic;
            let hdNode = bitcoin.HDNode.fromSeedBuffer(bip39.mnemonicToSeed(mnemonicString), getCurrentNetwork(coinType).CURRENT_NETWORK);
            let xprivImport = hdNode.derivePath(path).toBase58();
            let xpubImport = hdNode.derivePath(path).neutered().toBase58();
            let neuteredXpub = hdkey.fromExtendedKey(xpubImport, getCurrentNetwork(coinType).CURRENT_NETWORK_VERSION).deriveChild(chainType).toJSON().xpub;
            let receivingAddresses = await generateAddressesFromXpub(neuteredXpub, coinType.toUpperCase(), 5);
            account.mnemonicPhrase = mnemonicString;
            account.accountXpriv = xprivImport.toString();
            account.accountXpub = xpubImport.toString();
            account.addressDerivationXpub = neuteredXpub;
            account.addresses = receivingAddresses;
            break;
        }
        case 'ETH': {
            coin = 60;
            accountIndex = 0;
            path += purpose + "'/";
            path += coin + "'/";
            path += accountIndex + "'";
            let mnemonicString = mnemonic;
            let hdNode = bitcoin.HDNode.fromSeedBuffer(bip39.mnemonicToSeed(mnemonicString));
            let xprivImport = hdNode.derivePath(path).toBase58();
            let xpubImport = hdNode.derivePath(path).neutered().toBase58();
            let neuteredXpub = hdkey.fromExtendedKey(xpubImport).deriveChild(chainType).toJSON().xpub;
            let receivingAddresses = await generateAddressesFromXpub(neuteredXpub, coinType.toUpperCase(), 5);
            account.mnemonicPhrase = mnemonicString;
            account.accountXpriv = xprivImport.toString();
            account.accountXpub = xpubImport.toString();
            account.addressDerivationXpub = neuteredXpub;
            account.addresses = receivingAddresses;
            break;
        }
        default: {
            return { status: false, error: 'No such coin supported' }
            break;
        }
    }
    console.log('[offlineTool-generateAccount]', account);
    return ({ status: true, message: account });
}

function mnemonicGenerate() {
    let generatedMnemonic = bip39.generateMnemonic();
    return bip39.validateMnemonic(generatedMnemonic) ? generatedMnemonic.toString() : '';
}

function generateAddressesFromXpub(neuteredXpub, coinType, index) {
    console.log('generateAddressesFromXpub(', coinType, index);
    if (neuteredXpub == null || parseInt(index) < 0 || coinType == null || !SUPPORTED_COINS.includes(coinType.toUpperCase()))
        throw new Error('XPUB length');

    if (hdkey.fromExtendedKey(neuteredXpub, getCurrentNetwork(coinType).CURRENT_NETWORK_VERSION).depth !== 4) {
        throw new Error('Please provide neutered Xpub at depth 4')
    };
    let genrtdAddress = {
        path: 'm/' + index,
        index: index,
        publicAddress: addressDerivation[coinType.toUpperCase()].call(null, neuteredXpub, index),
        privateKey: ''
    }
    console.log('[genrtdAddress]', genrtdAddress);
    return genrtdAddress || null;
};
async function generateKeyPairFromXpriv(xpriv, coinType, total = 10) {
    if (!SUPPORTED_COINS.includes(coinType.toUpperCase())) { throw new Error('Coin not supported'); }
    if (hdkey.fromExtendedKey(xpriv, getCurrentNetwork(coinType).CURRENT_NETWORK_VERSION).depth !== 3) { throw new Error('Please provide Master Private key at Account depth or at 3') };
    let hdNode = bitcoin.HDNode.fromBase58(xpriv, getCurrentNetwork(coinType).CURRENT_NETWORK);
    let chainType = CHAIN_TYPE.RECEIVE[coinType.toUpperCase()];
    let result = generatePubPrivFromHDNode(hdNode, chainType, total, coinType);
    console.log('[offlineTool-generatePubPrivFromHDNode]', result);
    return result || null;
}
function generatePubPrivFromHDNode(HDNode, chainType, total = 10, coinType) {
    let chainWallet = HDNode.derive(chainType);
    let resultArray = []
    switch (coinType.toUpperCase()) {
        case 'BTC': {
            for (let i = 0; i < total; i++) {
                resultArray.push({
                    path: 'm/' + chainType + '/' + i,
                    index: i,
                    publicAddress: chainWallet.derive(i).keyPair.getAddress(),
                    privateKey: chainWallet.derive(i).keyPair.toWIF()
                });
            }
            break;
        }
        case 'ETH': {
            for (let i = 0; i < total; i++) {
                resultArray.push({
                    path: 'm/' + chainType + '/' + i,
                    index: i,
                    publicAddress: ethereumUtils.toChecksumAddress(ethereumUtils.publicToAddress(chainWallet.derive(i).getPublicKeyBuffer(), true).toString('hex')),
                    privateKey: ethereumUtils.addHexPrefix(chainWallet.derive(i).keyPair.d.toBuffer(32).toString('hex'))
                });
            }
            break;
        }
        default: { throw new Error('No such coin supported'); break; }
    }
    return resultArray || null;
}

async function generateAddresses(extendedKey, coinType, total = 10) {
    let addressArray = [];
    if (!SUPPORTED_COINS.includes(coinType.toUpperCase())) { return ({ status: false, error: error.message || error }); }
    if (bitcoin.HDNode.fromBase58(extendedKey, getCurrentNetwork(coinType).CURRENT_NETWORK).isNeutered()) {
        try {
            addressArray = await generateAddressesFromXpub(extendedKey, coinType.toUpperCase(), total);
        } catch (error) {
            return ({ status: false, error: error.message || error });
        }
    } else {
        try {
            addressArray = await generateKeyPairFromXpriv(extendedKey, coinType.toUpperCase(), total);
        } catch (error) {
            return ({ status: false, error: error.message || error });
        }
    }
    return ({ status: true, message: addressArray || ['Some error happened'] });
};

async function generateMnemonic() {
    let mnemonicString = mnemonicGenerate();
    return (!mnemonicString) ? { status: false, error: 'Invalid mnemonic string' } : { status: true, message: mnemonicString };
};
module.exports = {
    importMnemonic: importAccFromMnemonic,
    generateAddresses: generateAddresses,
    getMnemonic: generateMnemonic
};
