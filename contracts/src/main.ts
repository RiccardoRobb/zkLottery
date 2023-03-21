import { Lottery } from "./lottery.js";

import {
    isReady,
    shutdown,
    Mina,
    UInt64,
    Field,
    PublicKey,
    PrivateKey,
    fetchAccount,
    AccountUpdate
} from "snarkyjs";

function printAll(app: Lottery) {
    console.log(`
    owner: ${app.owner.get().toBase58()}
    ticket cost: ${app.ticketCost.get().toString()}
    prize: ${app.prize.get().toString()}
    value: ${app.value.get().toString()}
    `);
}

await isReady;
console.log("SnarkyJS loaded!");

//--- Setup local network

const Local = Mina.LocalBlockchain({ proofsEnabled: false });
Mina.setActiveInstance(Local);

//--- Load accounts

const { privateKey: creatorKey, publicKey: creatorAccount } = Local.testAccounts[0];
const { privateKey: ownerKey, publicKey: ownerAccount } = Local.testAccounts[1];
const { privateKey: user1Key, publicKey: user1Account } = Local.testAccounts[2];
const { privateKey: user2Key, publicKey: user2Account } = Local.testAccounts[3];
const { privateKey: user3Key, publicKey: user3Account } = Local.testAccounts[4];

//--- Compiling contract

const zkAppPrivateKey = creatorKey;

let { verificationKey } = await Lottery.compile();

const zkAppPublicKey = zkAppPrivateKey.toPublicKey();

let zkapp = new Lottery(zkAppPublicKey);

//--- Contract deploy

const deployTnx = await Mina.transaction(creatorAccount, () => {
    zkapp.deploy();
});

await deployTnx.prove();

await deployTnx.sign([creatorKey, zkAppPrivateKey]).send();

//--- Lottery creation

const ticketCost: UInt64 = new UInt64(1).toConstant();
const prize: UInt64 = new UInt64(10).toConstant();

let transaction = await Mina.transaction(
    { sender: ownerAccount },
    () => {
        zkapp.createLottery(
            ticketCost,
            prize
        );
    }
);

await transaction.prove();
let pendingTransaction = await transaction.sign([ownerKey]).send();

await pendingTransaction.wait();

//--- Payers

interface Player {
    sk: PrivateKey,
    pk: PublicKey,
    tickets: Field[]
}

let ticket: Field = Field(0);
let payers: Player[] = [
    {sk: user1Key, pk: user1Account, tickets: []},
    {sk: user2Key, pk: user2Account, tickets: []},
    {sk: user3Key, pk: user3Account, tickets: []}
];

for (let i=0; i<7; i++){
    let payer = i % payers.length;

    let tnx = await Mina.transaction(payers[payer].pk, () => {
        ticket = zkapp.buyTicket();
    });

    await tnx.prove();
    pendingTransaction = await tnx.sign([payers[payer].sk]).send();

    await pendingTransaction.wait();

    //console.log(ticket.toString());
    payers[payer].tickets.push(ticket);
    console.log(`Payer ${payer} -> ${ticket.toString()}`);
}

//--- Lottery closing

let tnx = await Mina.transaction(ownerAccount, () => {
    zkapp.closeLottery();
});

await tnx.prove();
pendingTransaction = await tnx.sign([ownerKey]).send();

await pendingTransaction.wait();

console.log("Lottery closed!");

//--- Check for the winner

async function verifyTicket(payer: Player, ticket: Field) {
    let tnx = await Mina.transaction((payer.pk), () => {
        zkapp.verifyWinner(ticket);
    });

    await tnx.prove();
    pendingTransaction = await tnx.sign([payer.sk]).send();
    
    await pendingTransaction.wait();

    return pendingTransaction.isSuccess;

}

for (const payer of payers) {
    for (const ticket of payer.tickets) {
        try {
            let succes = await verifyTicket(payer, ticket);
            
            if (zkapp.prize.get().equals(UInt64.zero) && succes)
            console.log(`winner: ${payer.pk.toBase58()}`);
        } catch (error) {}
    }
}

console.log('Shutting down');
await shutdown();