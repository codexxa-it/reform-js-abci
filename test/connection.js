const test = require('ava')
const Connection = require('../src/connection.js')
const fixtures = require('./fixtures.js')
const { mockStream, wait } = require('./common.js')

test('create connection', (t) => {
  const stream = mockStream()
  const connection = new Connection(stream)
  t.true(connection instanceof Connection, 'created connection')
})

test('receive requests', async (t) => {
  const received = []
  const onMessage = (message, cb) => {
    received.push(message)
    cb()
  }
  const stream = mockStream()
  const connection = new Connection(stream, onMessage)
  t.true(connection instanceof Connection, 'created connection')

  stream.emit('data', fixtures.multiRequestBytes)
  await wait()

  t.is(received.length, 2)
  t.deepEqual(received[0].toJSON(), fixtures.infoRequest)
  t.deepEqual(received[1].toJSON(), { flush: {} })
})

test('requests not emitted while waiting for handler', async (t) => {
  let numMessages = 0
  let onMessageCb
  const onMessage = (message, cb) => {
    numMessages += 1
    onMessageCb = cb
  }
  const stream = mockStream()
  const connection = new Connection(stream, onMessage)
  t.true(connection instanceof Connection, 'created connection')

  stream.emit('data', fixtures.multiRequestBytes)
  await wait()
  t.is(numMessages, 1)
  onMessageCb()
  t.is(numMessages, 2)
  stream.emit('data', fixtures.multiRequestBytes)
  await wait()
  t.is(numMessages, 2)
  onMessageCb()
  t.is(numMessages, 3)
  onMessageCb()
  t.is(numMessages, 4)
})

test('send responses', async (t) => {
  const onMessage = (message, cb) => cb()
  const stream = mockStream()
  const connection = new Connection(stream, onMessage)

  connection.write(fixtures.infoResponse)
  await wait()
  t.is(
    stream.sent.toString('hex'),
    fixtures.infoResponseHex
  )
})

test('close', (t) => {
  const onMessage = (message, cb) => cb()
  const stream = mockStream()

  let destroyCalled = false
  stream.destroy = () => { destroyCalled = true }

  const connection = new Connection(stream, onMessage)
  connection.close()
  t.true(destroyCalled)
})

test('write errors are emitted', async (t) => {
  const onMessage = (message, cb) => cb()
  const stream = mockStream()

  const connection = new Connection(stream, onMessage)
  connection.on('error', (err) => {
    t.is(err.message, "Cannot read property 'exception' of undefined")
  })
  connection.write()

  await wait()
})
