'use strict'

const EventEmitter = require('events')
const BufferList = require('bl')
const debug = require('debug')('abci')
const { varint } = require('protocol-buffers-encodings')
const { Request, Response } = require('../types.js').abci

const MAX_MESSAGE_SIZE = 104857600 // 100mb

class Connection extends EventEmitter {
  constructor (stream, onMessage) {
    super()

    this.stream = stream
    this.onMessage = onMessage
    this.recvBuf = new BufferList()
    this.waiting = false

    stream.on('data', this.onData.bind(this))
    stream.on('error', this.error.bind(this))
    stream.on('finish', this.finish.bind(this))
  }

  error (err) {
    this.close()
    this.emit('error', err)
  }

  finish (f) {
    this.close()
    this.emit('finish', f)
  }

  async onData (data) {
    this.recvBuf.append(data)
    if (this.waiting) return
    this.maybeReadNextMessage()
  }

  maybeReadNextMessage () {
    try {
      const length = varint.decode(this.recvBuf.slice(0, 8)) >> 1
      const lengthLength = varint.decode.bytes
    
      if (length > MAX_MESSAGE_SIZE) {
        this.error(Error('message is longer than maximum size'))
        return
      }

      if (lengthLength + length > this.recvBuf.length) {
        // buffering message, don't read yet
        return
      }

      const messageBytes = this.recvBuf.slice(
        lengthLength,
        lengthLength + length
      )
      this.recvBuf.consume(lengthLength + length)

      const message = Request.decode(messageBytes)

      this.waiting = true
      this.stream.pause()

      // log incoming messages, except for 'flush'
      if (!message.flush) {
        debug('<<', message)
      }

      this.onMessage(message, () => {
        this.waiting = false
        this.stream.resume()

        if (this.recvBuf.length > 0) {
          this.maybeReadNextMessage()
        }
      })
    } catch (e) {
      console.error(e);
      return;
    }
  }

  write (message) {
    // (async () => {
      this._write(message)
        .catch((err) => this.emit('error', err))
    // }).catch((err) => this.emit('error', err))
  }

  async _write (message) {
    Response.verify(message)
    // log outgoing messages, except for 'flush'
    if (debug.enabled && !message.flush) {
      debug('>>', Response.fromObject(message))
    }
    const messageBytes = Response.encode(message).finish()
    const lengthBytes = varint.encode(messageBytes.length << 1)
    this.stream.write(Buffer.from(lengthBytes))
    this.stream.write(messageBytes)
  }

  close () {
    this.stream.destroy()
  }
}

module.exports = Connection
