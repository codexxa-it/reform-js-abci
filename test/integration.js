const test = require('ava')
const createTempDir = require('tempy').directory
const getPort = require('get-port')
const tm = require('tendermint-node')
const createAbciServer = require('..')

function startNode (home, ports) {
  return tm.node(home, {
    p2p: { laddr: `tcp://127.0.0.1:${ports.p2p}` },
    rpc: { laddr: `tcp://127.0.0.1:${ports.rpc}` },
    proxy_app: `tcp://127.0.0.1:${ports.abci}`
  })
}

test.beforeEach(async (t) => {
  const home = createTempDir()
  await tm.init(home)

  const ports = {
    p2p: await getPort(),
    rpc: await getPort(),
    abci: await getPort()
  }

  const node = startNode(home, ports)

  Object.assign(
    t.context,
    { home, ports, node }
  )
})

test.afterEach((t) => {
  return t.context.node.kill()
})

test('app info resolves over RPC', async (t) => {
  const { ports, node } = t.context

  const info = {
    data: 'test app',
    version: '1.2.3'
  }
  const server = createAbciServer({
    info: () => info
  })
  server.listen(ports.abci)

  await node.started()

  const rpcResponse = await node.rpc.abciInfo()
  t.deepEqual(rpcResponse, { response: info })
})

test('large tx', async (t) => {
  const { ports, node } = t.context

  const server = createAbciServer({
    info: () => ({
      data: 'test app',
      version: '1.2.3'
    }),

    initChain (req) {
      return {}
    },

    beginBlock (req) {
      return {}
    },

    checkTx (req) {
      return {}
    },

    deliverTx (req) {
      return {}
    }
  })
  server.listen(ports.abci)

  await node.started()

  const res = await node.rpc.broadcastTxCommit({
    tx: '0x' + Buffer.allocUnsafe(10e3).toString('hex')
  })
  t.falsy(res.check_tx.code)
  t.falsy(res.deliver_tx.code)
})

test('reinitialization', async (t) => {
  let { ports, node, home } = t.context

  let lastBlockHeight, lastBlockAppHash
  const hash = Buffer.alloc(32).fill(1)
  const server = createAbciServer({
    info: () => ({
      lastBlockHeight,
      lastBlockAppHash
    }),

    initChain (req) {
      return {}
    },

    beginBlock (req) {
      return {}
    },

    endBlock (req) {
      return {}
    },

    commit (req) {
      return {
        data: hash
      }
    }
  })
  server.listen(ports.abci)

  await node.started()
  await node.synced()

  // wait then get current height
  await delay(3000)
  let status = await node.rpc.status()

  // kill node
  await node.kill()

  // start new node
  lastBlockHeight = String(status.sync_info.latest_block_height)
  lastBlockAppHash = hash
  node = startNode(home, ports)
  t.context.node = node
  await node.started()
  await node.synced()

  await delay(2000)
  status = await node.rpc.status()
  t.true(Number(status.sync_info.latest_block_height) > 2)
})

function delay (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
