var StellarBase = require('stellar-base');
let k = new StellarBase.Keypair({ type: 'ed25519', secretKey: require('crypto').randomBytes(32) });
StellarBase.Network.useTestNetwork()
console.log(StellarBase.Keypair.random().publicKey())
console.log(StellarBase)