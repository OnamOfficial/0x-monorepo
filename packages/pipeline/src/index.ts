import { web3Factory } from '@0x/dev-utils';
import { Web3ProviderEngine } from '@0x/subproviders';
import 'reflect-metadata';
import { Connection, createConnection } from 'typeorm';

import { ExchangeEventsSource } from './data_sources/contract-wrappers/exchange_events';
import { RelayerRegistrySource } from './data_sources/relayer-registry';
import { Web3Source } from './data_sources/web3';
import { Block } from './entities/Block';
import { ExchangeFillEvent } from './entities/ExchangeFillEvent';
import { Relayer } from './entities/Relayer';
import { Transaction } from './entities/Transaction';
import { deployConfig } from './ormconfig';
import { parseExchangeEvents } from './parsers/events';
import { parseRelayers } from './parsers/relayer_registry';
import { parseBlock, parseTransaction } from './parsers/web3';

const EXCHANGE_START_BLOCK = 6271590; // Block number when the Exchange contract was deployed to mainnet.
const RELAYER_REGISTRY_URL = 'https://raw.githubusercontent.com/0xProject/0x-relayer-registry/master/relayers.json';

let connection: Connection;

(async () => {
    connection = await createConnection(deployConfig);
    const provider = web3Factory.getRpcProvider({
        rpcUrl: 'https://mainnet.infura.io',
    });
    // await getExchangeEventsAsync(provider);
    // await getBlockAsync(provider);
    // await getTransactionAsync(provider);
    await getRelayers(RELAYER_REGISTRY_URL);
    process.exit(0);
})();

async function getExchangeEventsAsync(provider: Web3ProviderEngine): Promise<void> {
    console.log('Getting event logs...');
    const eventsRepository = connection.getRepository(ExchangeFillEvent);
    const exchangeEvents = new ExchangeEventsSource(provider, 1);
    const eventLogs = await exchangeEvents.getFillEventsAsync(EXCHANGE_START_BLOCK, EXCHANGE_START_BLOCK + 100000);
    console.log('Parsing events...');
    const events = parseExchangeEvents(eventLogs);
    console.log(`Retrieved and parsed ${events.length} total events.`);
    console.log('Saving events...');
    for (const event of events) {
        await eventsRepository.save(event);
    }
    console.log('Saved events.');
}

async function getBlockAsync(provider: Web3ProviderEngine): Promise<void> {
    console.log('Getting block info...');
    const blocksRepository = connection.getRepository(Block);
    const web3Source = new Web3Source(provider);
    const rawBlock = await web3Source.getBlockInfoAsync(EXCHANGE_START_BLOCK);
    const block = parseBlock(rawBlock);
    console.log('Saving block info...');
    await blocksRepository.save(block);
    console.log('Done saving block.');
}

async function getTransactionAsync(provider: Web3ProviderEngine): Promise<void> {
    console.log('Getting tx info...');
    const txsRepository = connection.getRepository(Transaction);
    const web3Source = new Web3Source(provider);
    const rawTx = await web3Source.getTransactionInfoAsync(
        '0x6dd106d002873746072fc5e496dd0fb2541b68c77bcf9184ae19a42fd33657fe',
    );
    const tx = parseTransaction(rawTx);
    console.log('Saving tx info...');
    await txsRepository.save(tx);
    console.log('Done saving tx.');
}

async function getRelayers(url: string): Promise<void> {
    console.log('Getting relayer info...');
    const relayerRepository = connection.getRepository(Relayer);
    const relayerSource = new RelayerRegistrySource(RELAYER_REGISTRY_URL);
    const relayersResp = await relayerSource.getRelayerInfoAsync();
    const relayers = parseRelayers(relayersResp);
    console.log('Saving relayer info...');
    // for (const relayer of relayers) {
    await relayerRepository.save(relayers);
    // }
    console.log('Done saving relayers.');
}