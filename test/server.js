const net = require('net')
const test = require('ava')
const Connection = require('../src/connection.js')
const { createServer } = require('..')
const fixtures = require('./fixtures.js')
const { mockStream, wait } = require('./common.js')

test('create server', (t) => {
  const server = createServer({})
  t.true(server instanceof net.Server)
})

test('respond', async (t) => {
  await Connection.loaded

  const server = createServer({
    info (message) {
      t.deepEqual(
        message.toJSON(),
        fixtures.infoRequest.info
      )
      return fixtures.infoResponse.info
    }
  })

  const stream = mockStream()
  server.emit('connection', stream)

  stream.emit('data', fixtures.infoRequestBytes)

  await wait()
  t.is(
    stream.sent.toString('hex'),
    fixtures.infoResponseHex
  )
})

test('respond async', async (t) => {
  await Connection.loaded

  const server = createServer({
    async info (message) {
      t.deepEqual(
        message.toJSON(),
        fixtures.infoRequest.info
      )
      return fixtures.infoResponse.info
    }
  })

  const stream = mockStream()
  server.emit('connection', stream)

  stream.emit('data', fixtures.infoRequestBytes)

  await wait()
  t.is(
    stream.sent.toString('hex'),
    fixtures.infoResponseHex
  )
})

test('respond to non-implemented functions', async (t) => {
  await Connection.loaded

  const server = createServer({})

  const stream = mockStream()
  server.emit('connection', stream)

  stream.emit('data', fixtures.infoRequestBytes)
  await wait()
  t.is(
    stream.sent.toString('hex'),
    fixtures.emptyInfoResponseHex
  )
})

test('respond to special functions', async (t) => {
  await Connection.loaded

  const server = createServer({})

  const stream = mockStream()
  server.emit('connection', stream)

  stream.emit('data', fixtures.flushRequestBytes)
  stream.emit('data', fixtures.echoRequestBytes)
  await wait()
  t.is(
    stream.sent.toString('hex'),
    fixtures.flushResponseHex +
    fixtures.echoResponseHex
  )
})

test('respond with callback error', async (t) => {
  await Connection.loaded

  const server = createServer({
    info (message) {
      throw Error('test error')
    }
  })

  const stream = mockStream()
  server.emit('connection', stream)

  stream.emit('data', fixtures.multiRequestBytes)
  await wait()
  t.is(
    stream.sent.toString('hex'),
    fixtures.exceptionResponseHex
  )
})

test('respond with async callback error', async (t) => {
  await Connection.loaded

  const server = createServer({
    async info (message) {
      throw Error('test error')
    }
  })

  const stream = mockStream()
  server.emit('connection', stream)

  stream.emit('data', fixtures.multiRequestBytes)

  await wait()
  t.is(
    stream.sent.toString('hex'),
    fixtures.exceptionResponseHex
  )
})
