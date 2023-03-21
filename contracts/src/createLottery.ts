import { Lottery } from './lottery.js';
import { isReady, shutdown, Mina, PrivateKey, fetchAccount, UInt64 } from 'snarkyjs';
import fs from 'fs';

await isReady;
console.log('SnarkyJS loaded');

// ----------------------------------------------------

const Berkeley = Mina.Network(
    'https://proxy.berkeley.minaexplorer.com/graphql'
);
Mina.setActiveInstance(Berkeley);

// ----------------------------------------------------

const transactionFee = 100_000_000;
const deployAlias = process.argv[2];
const deployerKeysFileContents = fs.readFileSync(
    'keys/' + deployAlias + '.json',
    'utf8'
);
const deployerPrivateKeyBase58 = JSON.parse(
    deployerKeysFileContents
).privateKey;
const deployerPrivateKey = PrivateKey.fromBase58(deployerPrivateKeyBase58);
const deployerPublicKey = deployerPrivateKey.toPublicKey();

const zkAppPrivateKey = deployerPrivateKey;

const payerAlias = process.argv[3];
const payerKeysFileContents = fs.readFileSync(
    'keys/' + payerAlias + '.json',
    'utf8'
);
const payerPrivateKeyBase58 = JSON.parse(
    payerKeysFileContents
).privateKey;
const payerPrivateKey = PrivateKey.fromBase58(payerPrivateKeyBase58);
const payerPublicKey = payerPrivateKey.toPublicKey();

// ----------------------------------------------------

let account = await fetchAccount({publicKey: deployerPublicKey}); 

let accountPayer = await fetchAccount({publicKey: payerPublicKey});

// ----------------------------------------------------

console.log('Compiling smart contract...');
let { verificationKey } = await Lottery.compile();
const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
let zkapp = new Lottery(zkAppPublicKey);

// ----------------------------------------------------
const ticketCost: UInt64 = new UInt64(1).toConstant();
const prize: UInt64 = new UInt64(100).toConstant();

let transaction = await Mina.transaction(
    { sender: payerPublicKey, fee: transactionFee },
    () => {
        zkapp.createLottery(ticketCost, prize);
    }
);
// fill in the proof - this can take a while...
console.log('Creating an execution proof...');
let time0 = performance.now();
await transaction.prove();
let time1 = performance.now();
console.log(`creating proof took ${(time1 - time0) / 1e3} seconds`);
// sign transaction with the deployer account
transaction.sign([payerPrivateKey]);
console.log('Sending the transaction...');
let pendingTransaction = await transaction.send();

// ----------------------------------------------------

if (!pendingTransaction.isSuccess) {
    console.log('error sending transaction (see above)');
    //process.exit(0);
}
console.log(
    `See transaction at https://berkeley.minaexplorer.com/transaction/${pendingTransaction.hash()}
  Waiting for transaction to be included...`
);
await pendingTransaction.wait();

// ----------------------------------------------------

console.log('Shutting down');
await shutdown();
