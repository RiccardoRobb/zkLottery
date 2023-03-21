import { Mina, isReady, PublicKey, fetchAccount, UInt64 } from 'snarkyjs';

type Transaction = Awaited<ReturnType<typeof Mina.transaction>>;

// ---------------------------------------------------------------------------------------

import { Lottery } from '../../contracts/src/lottery.js'; 

/* const state = {
  Lottery: null as null | typeof Lottery,
  zkapp: null as null | Lottery,
  transaction: null as null | Transaction,
}; */

const state: {[addr: string]: { lottery: null | typeof Lottery, zkapp: null | Lottery, transaction: null | Transaction }} = {
  "B62qnEcz5Kk9LL6Ddsdo713UDe5nkFeA4bgk6bKca3MwvhettSnPQQk" : { lottery: null as null, zkapp: null as null | Lottery, transaction: null as null | Transaction },
  "B62qj1EUDxga8fT7ptW9knMg31XPMPzEnSSs2PH8AB4xyuKCgyJKBDa" : { lottery: null as null, zkapp: null as null | Lottery, transaction: null as null | Transaction,},
  "B62qqCY3fPLiiP9nvxspC75Fus31dsjAsLbHjELFxTh9ecYxYtpEsjr" : { lottery: null as null, zkapp: null as null | Lottery, transaction: null as null | Transaction,},
  "B62qnwLRebcusYghddCsJVHZ5N7MjJ1973Zr3jPAdytPAjeYAFAjErz" : { lottery: null as null, zkapp: null as null | Lottery, transaction: null as null | Transaction,},
  "B62qrYt3SehTQZTEQch1XSevFGqXsuDpa2T4a2QVVGhhXRg1ivRADDr" : { lottery: null as null, zkapp: null as null | Lottery, transaction: null as null | Transaction,},
};

// ---------------------------------------------------------------------------------------

const functions = {
  loadSnarkyJS: async (args: {}) => {
    await isReady;
  },
  setActiveInstanceToBerkeley: async (args: {}) => {
    const Berkeley = Mina.Network(
      'https://proxy.berkeley.minaexplorer.com/graphql'
    );
    Mina.setActiveInstance(Berkeley);
  },
  loadContracts: async (args: {}) => {
    const { Lottery } = await import('../../contracts/build/src/lottery.js');

    for(let key in state){
      //console.log(key);
      state![key].lottery = Lottery;
      
    }
  },
  compileContracts: async (args: {}) => {
    for(let key in state)
      await state![key].lottery!.compile();
  },
  fetchAccount: async (args: { publicKey58: string }) => {
    const publicKey = PublicKey.fromBase58(args.publicKey58);
    return await fetchAccount({ publicKey });
  },
  initZkappInstances: async (args: {}) => { //modify args [X]
    for(let key in state)
      state![key].zkapp = new state![key].lottery!(PublicKey.fromBase58(key))
  },
  //                                                     GETTERS
  getOwner: async (args: { publicKey58: string }) => {
    const owner = await state![args.publicKey58].zkapp!.owner.get();
    return JSON.stringify(owner.toJSON());
  },
  getValue: async (args: { publicKey58: string }) => {
    const value = await state![args.publicKey58].zkapp!.value.get();
    return JSON.stringify(value.toJSON());
  },
  getTicketCost: async (args: { publicKey58: string }) => {
    const ticketCost = await state![args.publicKey58].zkapp!.ticketCost.get();
    return JSON.stringify(ticketCost.toJSON());
  },
  getPrize: async (args: { publicKey58: string }) => {
    const prize = await state![args.publicKey58].zkapp!.prize.get();
    return JSON.stringify(prize.toJSON());
  },
  createUpdateTransaction: async (args: { publicKey: PublicKey }) => {    // create similar functions for other smartcontract calls
    const ticketCost: UInt64 = new UInt64(1).toConstant();
    const prize: UInt64 = new UInt64(100).toConstant();

    //console.log(args!.publicKey!.toBase58());
    console.log("building tnx...");

    const transaction = await Mina.transaction({sender: args!.publicKey!, fee: 0.1},  () => {
      state!["B62qnEcz5Kk9LL6Ddsdo713UDe5nkFeA4bgk6bKca3MwvhettSnPQQk"].zkapp!.createLottery(ticketCost, prize);
    });
    state!["B62qnEcz5Kk9LL6Ddsdo713UDe5nkFeA4bgk6bKca3MwvhettSnPQQk"].transaction = transaction;
  },
  proveUpdateTransaction: async (args: {}) => {
    console.log("proving...");
    await state!["B62qnEcz5Kk9LL6Ddsdo713UDe5nkFeA4bgk6bKca3MwvhettSnPQQk"].transaction!.prove();
  },
  getTransactionJSON: async (args: {}) => {
    console.log("getting JSON...");
    return state!["B62qnEcz5Kk9LL6Ddsdo713UDe5nkFeA4bgk6bKca3MwvhettSnPQQk"].transaction!.toJSON();
  },
};

// ---------------------------------------------------------------------------------------

export type WorkerFunctions = keyof typeof functions;

export type ZkappWorkerRequest = {
  id: number;
  fn: WorkerFunctions;
  args: any;
};

export type ZkappWorkerReponse = {
  id: number;
  data: any;
};
// process.window
if (typeof process == typeof window) {
  addEventListener(
    'message',
    async (event: MessageEvent<ZkappWorkerRequest>) => {
      const returnData = await functions[event.data.fn](event.data.args);

      const message: ZkappWorkerReponse = {
        id: event.data.id,
        data: returnData,
      };
      postMessage(message);
    }
  );
}
