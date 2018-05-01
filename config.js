module.exports = {
  clientConfig: {
    host: '',
    port: 8332,
    user: '',
    pass: 'c=',
    timeout: 30000
  },
  net: 'TESTNET',
  web3: {
    ws: 'wss://ropsten.infura.io/ws/',
    http: 'https://ropsten.infura.io/'
  },
  gasLimit: 211000,
  current: 'test', //live
  insightProvider: {
    test: 'https://test-insight.bitpay.com',
    live: 'https://insight.bitpay.com'
  },
  network: {
    BTC: {
      test: 'testnet',
      live: 'bitcoin'
    }
  }
};
