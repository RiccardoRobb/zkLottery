import '../styles/globals.css';
import { useEffect, useState } from 'react';
import './reactCOIServiceWorker';
import Image from "next/image";
import Link from 'next/link';
import mina from "./assets/mina.webp";
import loading from "./assets/loading-73.gif";

import ZkappWorkerClient from './zkappWorkerClient';

import { PublicKey, Field, UInt64, ZkappPublicInput, Mina } from 'snarkyjs';
import React from 'react';

let transactionFee = 0.1;

export default function App() {
  let [log_text, setLog] = React.useState("");
  let [state, setState] = useState({
    zkappWorkerClient: null as null | ZkappWorkerClient,
    hasWallet: null as null | boolean,
    hasBeenSetup: false,
    accountExists: false,
    lotteries: new Map([
      ["B62qnEcz5Kk9LL6Ddsdo713UDe5nkFeA4bgk6bKca3MwvhettSnPQQk", { owner: null as null | PublicKey, value: null as null | UInt64, ticketCost: null as null | UInt64, prize: null as null | UInt64 }],
      ["B62qj1EUDxga8fT7ptW9knMg31XPMPzEnSSs2PH8AB4xyuKCgyJKBDa", { owner: null as null | PublicKey, value: null as null | UInt64, ticketCost: null as null | UInt64, prize: null as null | UInt64 }],
      ["B62qqCY3fPLiiP9nvxspC75Fus31dsjAsLbHjELFxTh9ecYxYtpEsjr", { owner: null as null | PublicKey, value: null as null | UInt64, ticketCost: null as null | UInt64, prize: null as null | UInt64 }],
      ["B62qnwLRebcusYghddCsJVHZ5N7MjJ1973Zr3jPAdytPAjeYAFAjErz", { owner: null as null | PublicKey, value: null as null | UInt64, ticketCost: null as null | UInt64, prize: null as null | UInt64 }],
      ["B62qrYt3SehTQZTEQch1XSevFGqXsuDpa2T4a2QVVGhhXRg1ivRADDr", { owner: null as null | PublicKey, value: null as null | UInt64, ticketCost: null as null | UInt64, prize: null as null | UInt64 }],
    ]),
    publicKey: null as null | PublicKey,  
    creatingTransaction: false,
  });

  // -------------------------------------------------------
  // Do Setup

  useEffect(() => {
    (async () => {
      if (!state.hasBeenSetup) {
        const zkappWorkerClient = new ZkappWorkerClient();

        console.log('Loading SnarkyJS...');
        setLog("Loading SnarkyJs...");
        await zkappWorkerClient.loadSnarkyJS();

        console.log('Setting Berkeley as active instance...');
        setLog('Setting Berkeley as active instance...');
        await zkappWorkerClient.setActiveInstanceToBerkeley();

        const mina = (window as any).mina;

        if (mina == null) {
          setState({ ...state, hasWallet: false });
          return;
        }

        const publicKeyBase58: string = (await mina.requestAccounts())[0];
        const publicKey = PublicKey.fromBase58(publicKeyBase58);

        console.log('using key', publicKey.toBase58());
        setLog("Using key: " + publicKey.toBase58());

        console.log('checking if account exists...');
        setLog("Checking if account exists...");
        const res = await zkappWorkerClient.fetchAccount({
          publicKey: publicKey!,
        });
        const accountExists = res.error == null;
        console.log("Loading contracts...");
        setLog("Loading contracts...");
        await zkappWorkerClient.loadContracts(); // multiple [X]

        console.log('Compiling zkApp...');
        setLog("Compiling zkApp contracts...");
        await zkappWorkerClient.compileContracts(); // multiple [X]

        var zkappPublicKey = null;

        console.log("Initializating zkApp instances...");
        setLog("Initializating zkApp instances...");
        await zkappWorkerClient.initZkappInstances();  // multiple [X]

        console.log("Fetching zkApps states...");
        setLog("Fetching zkApps states...");
        var i = 0;
        state!.lotteries.forEach(async (value, key) => {
          await zkappWorkerClient.fetchAccount({ publicKey: PublicKey.fromBase58(key) });
          var owner;
          var value_;
          var ticketCost;
          var prize;

          if(i%2==0){
            owner = PublicKey.fromBase58("B62qj1EUDxga8fT7ptW9knMg31XPMPzEnSSs2PH8AB4xyuKCgyJKBDa");
            value_ = new UInt64(0);
            ticketCost = new UInt64(1);
            prize = new UInt64(100);
          }else{
            owner = await zkappWorkerClient!.getOwner({ publicKey: key });
            value_ = await zkappWorkerClient!.getValue({ publicKey: key });
            ticketCost = await zkappWorkerClient!.getTicketCost({ publicKey: key });
            prize = await zkappWorkerClient!.getPrize({ publicKey: key });
          }

          i++;
          if (owner == PublicKey.empty())
            owner == null;
          
          console.log(owner.toBase58());
          state!.lotteries!.set(key, { owner, value: value_, ticketCost, prize });
        });

        setState({
          ...state,
          zkappWorkerClient,
          hasWallet: true,
          hasBeenSetup: true,
          publicKey,
          accountExists,
        });
      }
    })();
  }, []);

  // -------------------------------------------------------
  // Wait for account to exist, if it didn't

  useEffect(() => {
    (async () => {
      if (state.hasBeenSetup && !state.accountExists) {
        for (; ;) {
          console.log('checking if account exists...');
          const res = await state.zkappWorkerClient!.fetchAccount({
            publicKey: state.publicKey!,
          });
          const accountExists = res.error == null;
          if (accountExists) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
        setState({ ...state, accountExists: true });
      }
    })();
  }, [state.hasBeenSetup]);

  // -------------------------------------------------------
  // Send a transaction

  const onSendTransaction = async () => {
    setState({ ...state, creatingTransaction: true });
    console.log('sending a transaction...');

    await state.zkappWorkerClient!.fetchAccount({
      publicKey: state.publicKey!,
    });
    
    await state.zkappWorkerClient!.createUpdateTransaction({publicKey: state.publicKey!});

    console.log('creating proof...');
    await state.zkappWorkerClient!.proveUpdateTransaction();

    console.log('getting Transaction JSON...');
    const transactionJSON = await state.zkappWorkerClient!.getTransactionJSON();

    console.log('requesting send transaction...');
    const { hash } = await (window as any).mina.sendTransaction({
      transaction: transactionJSON,
      feePayer: {
        fee: transactionFee,
        memo: '',
      },
    });

    console.log(
      'See transaction at https://berkeley.minaexplorer.com/transaction/' + hash
    );

    setState({ ...state, creatingTransaction: false });
  };

  // -------------------------------------------------------
  // Refresh the current state onLoad

  const onRefresh = async () => {
    console.log("Fetching...");

    state!.lotteries!.forEach(async (value, key) => {
      console.log('getting zkApp states...');

      const owner = await state.zkappWorkerClient!.getOwner({ publicKey: key });
      const value_ = await state.zkappWorkerClient!.getValue({ publicKey: key });
      const ticketCost = await state.zkappWorkerClient!.getTicketCost({ publicKey: key });
      const prize = await state.zkappWorkerClient!.getPrize({ publicKey: key });

      console.log(prize);

      if (owner == PublicKey.empty())
        owner == null;

      state!.lotteries!.set(key, { owner, value: value_, ticketCost, prize });
    });

    console.log(state.lotteries);
    setState({ ...state });
  };

  // -------------------------------------------------------
  // Create UI elements

  let hasWallet;
  if (state.hasWallet != null && !state.hasWallet) {
    const auroLink = 'https://www.aurowallet.com/';
    const auroLinkElem = (
      <a href={auroLink} target="_blank" rel="noreferrer">
        {' '}
        [Link]{' '}
      </a>
    );
    hasWallet = (
      <div>
        {' '}
        Could not find a wallet. Install Auro wallet here: {auroLinkElem}
      </div>
    );
  }

  let accountDoesNotExist;
  if (state.hasBeenSetup && !state.accountExists) {
    const faucetLink =
      'https://faucet.minaprotocol.com/?address=' + state.publicKey!.toBase58();
    accountDoesNotExist = (
      <div>
        Account does not exist. Please visit the faucet to fund this account
        <a href={faucetLink} target="_blank" rel="noreferrer">
          {' '}
          [Link]{' '}
        </a>
      </div>
    );
  }

  // mulst load lotteries
  let mainContent;
  if (state.hasBeenSetup && state.accountExists) {
    mainContent = (
      <>
        <nav className='flex items-center flex-wrap bg-white-300 p-3 '>
          <Link href='/'>
            <div className='inline-flex items-center p-2 mr-4 '>
              <span className='text-xl text-black font-bold tracking-wide'>
                🍀  zkLottery
              </span>
            </div>
          </Link>
          <div className='pl-10' onClick={()=>setState({...state})}>🔄 click here to reload...</div>
        </nav>
        <div className="container w-full md:max-w-4xl mx-auto pt-14 text-center">
          <div className='grid grid-flow-row gap-y-4 justify-center items-center mt-6'>
            {
              state!.lotteries! && [...state!.lotteries!.keys()].map((value, index) => {
                /* if (state.lotteries.get(value)?.owner == null) {
                  return (
                    <div key={index} className='justify-center'>
                      <div className="mt-10 pb-4 pt-4 pl-4 pr-4 grid grid-flow-row items-center rounded-lg border-4 shadow-lg bg-purple-100">
                        <div className="font-bold text-purple-700" onClick={onSendTransaction}>
                          Lottery not active! ✏️
                        </div>
                      </div>
                    </div>
                  ) 
                } else */
                  return (
                    <div key={index} className='justify-center'>
                      <div className="pb-4 pt-4 pl-8 pr-4 grid grid-flow-col items-center rounded-lg  mb-2 border-4 shadow-lg bg-gradient-to-b from-purple-200 to-white-100">
                        <div className="grid grid-flow-col items-center justify-center">
                          <div className="col w-8 pr-10 font-bold text-purple-700">
                            {index}
                          </div>
                          <div className="grid grid-flow-row items-center justify-center pr-10">
                            <Image
                              src={mina}
                              alt="MINA"
                              width={30}
                              height={30}
                              className="col"
                            />
                            <p className="col font-semibold uppercase font-sans text-xs">$MINA</p>
                          </div>

                          <p className="font-semibold font-sans text-xs w-25 mr-1">Prize </p>
                          <div className="font-semibold uppercase font-sans text-white-900 w-25">
                            {state.lotteries.get(value)?.prize?.toString()}
                          </div>
                          <div className="grid grid-flow-row pr-10 items-center pl-10 justify-center">
                            <p className="font-semibold font-sans text-xs w-25">Tickets sold</p>
                            <div className="text-base  tracking-wider uppercase">
                              {state.lotteries.get(value)?.value?.toString()} 🎟
                            </div>
                          </div>
                          <div className="col mr-4">
                            <p className="font-semibold font-sans text-xs w-25">Price</p>
                            <div className="text-base  tracking-wider uppercase pl-30">
                              {state.lotteries.get(value)?.ticketCost?.toString()}
                            </div>
                            <p className="font-semibold font-sans text-xs w-25">$MINA</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
              })
            }
          </div>
        </div>
      </>
    );
  } else {
    mainContent = (
      <>
        <nav className='flex items-center flex-wrap bg-white-300 p-3 '>
          <Link href='/'>
            <div className='inline-flex items-center p-2 mr-4 '>
              <span className='text-xl text-black font-bold tracking-wide'>
                🍀  zkLottery
              </span>
            </div>
          </Link>
        </nav>

        <div className="grid grid-flow-row items-center justify-center pt-40 pb-10">
          <Image
            src={loading}
            alt="Loading"
            width={100}
            height={100}
            className="col"
          />
        </div>
        <div className="grid grid-flow-row items-center justify-center">
          {log_text}
        </div>
        <div className="grid grid-flow-row items-center justify-center mt-20 text-center">
          <p>Everyone has the freedom to create lotteries, we will take just a small percentage to improve the platform.</p>
          <p>We will show you the available lotteries, if there are none you can create one.</p>
          <p>The creator of a lottery can decide when it will end.</p>
        </div>
        <div className="grid grid-flow-row items-center justify-center mt-20 text-center">
          <p>....The website is still under construction....</p>
          <p>For now you can connect your wallet and see all available lotteries.</p>
          <p>Only 5 lottery slots are working right now.</p>
        </div>
        <div className="grid grid-flow-row items-center justify-center mt-20 text-center">
          <p>🍀zkLottery is a decentralized lottery platform on the Mina Blockchain made with grit by Riccardo and Fabio</p>
        </div>
      </>
    );
  }

  return (
    <>
      {accountDoesNotExist}
      {mainContent}
    </>
  );
}
