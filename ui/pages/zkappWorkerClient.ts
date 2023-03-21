import {
    fetchAccount,
    PublicKey,
    PrivateKey,
    Field,
    UInt64,
  } from 'snarkyjs'
  
  import type { ZkappWorkerRequest, ZkappWorkerReponse, WorkerFunctions } from './zkappWorker';
  
  export default class ZkappWorkerClient {
  
    // ---------------------------------------------------------------------------------------
  
    loadSnarkyJS() {
      return this._call('loadSnarkyJS', {});
    }
  
    setActiveInstanceToBerkeley() {
      return this._call('setActiveInstanceToBerkeley', {});
    }
  
    loadContracts() {
      return this._call('loadContracts', {});
    }
  
    compileContracts() {
      return this._call('compileContracts', {});
    }
  
    fetchAccount({ publicKey }: { publicKey: PublicKey }): ReturnType<typeof fetchAccount> {
      const result = this._call('fetchAccount', { publicKey58: publicKey.toBase58() });
      return (result as ReturnType<typeof fetchAccount>);
    }
  
    initZkappInstances() {   // modify args [X]
      return this._call('initZkappInstances', {});
    }

    async getOwner({ publicKey }: { publicKey: string }): Promise<PublicKey> {
      const result = await this._call('getOwner', { publicKey58: publicKey });
      return PublicKey.fromJSON(JSON.parse(result as string));
    }

    async getValue({ publicKey }: { publicKey: string }): Promise<UInt64> {
      const result = await this._call('getValue', { publicKey58: publicKey });
      return UInt64.fromJSON(JSON.parse(result as string));
    }

    async getTicketCost({ publicKey }: { publicKey: string }): Promise<UInt64> {
      const result = await this._call('getTicketCost', { publicKey58: publicKey });
      return UInt64.fromJSON(JSON.parse(result as string));
    }

    async getPrize({ publicKey }: { publicKey: string }): Promise<UInt64> {
      const result = await this._call('getPrize', { publicKey58: publicKey });
      return UInt64.fromJSON(JSON.parse(result as string));
    }
  
    createUpdateTransaction({ publicKey }: { publicKey: PublicKey }) {
      return this._call('createUpdateTransaction', {publicKey: publicKey});
    }
  
    proveUpdateTransaction() {
      return this._call('proveUpdateTransaction', {});
    }
  
    async getTransactionJSON() {
      const result = await this._call('getTransactionJSON', {});
      return result;
    }
  
    // ---------------------------------------------------------------------------------------
  
    worker: Worker;
  
    promises: { [id: number]: { resolve: (res: any) => void, reject: (err: any) => void } };
  
    nextId: number;
  
    constructor() {
      this.worker = new Worker(new URL('./zkappWorker.ts', import.meta.url))
      this.promises = {};
      this.nextId = 0;
  
      this.worker.onmessage = (event: MessageEvent<ZkappWorkerReponse>) => {
        this.promises[event.data.id].resolve(event.data.data);
        delete this.promises[event.data.id];
      };
    }
  
    _call(fn: WorkerFunctions, args: any) {
      return new Promise((resolve, reject) => {
        this.promises[this.nextId] = { resolve, reject }
  
        const message: ZkappWorkerRequest = {
          id: this.nextId,
          fn,
          args,
        };
  
        this.worker.postMessage(message);
  
        this.nextId++;
      });
    }
  }
  
  