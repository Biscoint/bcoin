/* eslint-env mocha */
/* eslint prefer-arrow-callback: "off" */

'use strict';

const assert = require('bsert');
const FullNode = require('../lib/node/fullnode');
const WalletDB = require('../lib/wallet/walletdb');

describe('TXDB Rescan', function() {
  let node, userWDB, userWallet, minerWDB, minerWallet;
  let userAddr, minerAddr1, minerAddr2;
  let tx1hash;

  async function mineBlocks(n) {
    for (let i = 0; i < n; i++) {
      const block = await node.miner.mineBlock();
      const entry = await node.chain.add(block);
      await minerWDB.addBlock(entry, block.txs);
    }
  }

  before(async () => {
    // Node
    node = new FullNode({
      memory: true,
      network: 'regtest',
      plugins: [require('../lib/wallet/plugin')]
    });

    await node.open();

    // User's wallet (plugged in to node)
    userWDB = node.require('walletdb').wdb;
    userWallet = await userWDB.create();
    userAddr = await userWallet.receiveAddress();

    // Miner's wallet
    minerWDB = new WalletDB({
      network: 'regtest'
    });
    await minerWDB.open();
    minerWallet = await minerWDB.create();
    minerAddr1 = await minerWallet.receiveAddress();
    minerAddr2 = await minerWallet.createReceive('default');
    minerAddr2 = minerAddr2.getAddress();

    // Mine initial blocks
    node.miner.addAddress(minerAddr1);
    await mineBlocks(101);

    assert.strictEqual(node.chain.height, 101);
    assert.strictEqual(minerWDB.height, 101);
    assert.strictEqual(userWDB.height, 101);
  });

  after(async () => {
    await node.close();
    await minerWDB.close();
  });

  it('should send TX from miner to user AND miner', async () => {
    // Send
    const tx1 = await minerWallet.send({
      outputs: [
        { value: 1020304, address: userAddr },
        { value: 4030201, address: minerAddr2 }
      ]
    });
    tx1hash = tx1.hash();
    await node.sendTX(tx1);

    // Confirm
    await mineBlocks(1);

    // Check
    const bal = await userWallet.getBalance();
    assert.strictEqual(bal.tx, 1);
    assert.strictEqual(bal.coin, 1);
    assert.strictEqual(bal.confirmed, 1020304);
    assert.strictEqual(bal.unconfirmed, 1020304);
  });

  it('should import miner\'s private key into user\'s wallet', async () => {
    assert(!await userWallet.hasAddress(minerAddr2));

    const key = await minerWallet.getPrivateKey(minerAddr2);
    await userWallet.importKey('default', key);

    assert(await userWallet.hasAddress(minerAddr2));
  });

  it('should rescan user\'s wallet', async () => {
    await userWDB.rescan(0);

    const bal = await userWallet.getBalance();
    assert.strictEqual(bal.confirmed, bal.unconfirmed);
    assert.strictEqual(bal.confirmed, 5050505);

    const pending = await userWallet.getPending();
    assert.strictEqual(pending.length, 0);

    const history = await userWallet.getHistory();
    const wtxs = await userWallet.toDetails(history);
    assert.bufferEqual(wtxs[0].hash, tx1hash);
  });
});
