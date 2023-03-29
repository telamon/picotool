// SPDX-License-Identifier: AGPL-3.0-or-later
/*
 * Foreword, this is an prototype implementation
 * of a serverside "http" silo, the intention is
 * to create a functional sketch and refine
 * into a pure silo that runs in frontend.
 */
import polka from 'polka'
import reuse from 'buffer-reuse-pool'
import Feed from 'picofeed'
import send from '@polka/send-type'
import { unpack } from './index.js'
import Silo from './silo.js'

export default function WebSilo (db, opts = {}) {
  opts = {
    static: 'pub/',
    port: '1337',
    ...opts
  }
  const silo = new Silo(db)

  const server = polka()
    .use(logger)
    .use(CryptoPickle())
    .use(Macros)
    .post('/:key', async (req, res) => {
      const feed = req.feed
      const key = Buffer.from(req.params.key, 'hex')
      if (!feed.last.key.equals(key)) return res.error('Verification failed', 401)
      try {
        await silo.put(feed)
        send(res, 201, { done: true })
      } catch (err) {
        console.error('Failed unpack()', err)
        return res.error(err.message, 400)
      }
    })
    .get('/:key', async (req, res) => {
      const key = Buffer.from(req.params.key, 'hex')
      const feed = await silo.get(key)
      if (!feed) return res.error('Site not Found', 404)
      switch (req.headers.accept) {
        case 'pico/feed':
          send(res, 200, feed.buf, { 'Content-Type': 'pico/feed' })
          break

        case 'text/html':
        default: {
          // Server side bootloading, very boring;
          const site = unpack(feed)
          send(res, 200, site.body, {
            ...site.headers,
            'Content-Type': 'text/html'
          })
        }
      }
    })
    .get('/', async (req, res) => {
      const out = await silo.list()
      send(res, 200, out)
    })
  return server
}

// Log every request
function logger (req, res, next) {
  console.log(`${req.method} ${req.url}`)
  next()
}

// Picofeed Middleware
function CryptoPickle () {
  const pool = reuse.pool(Feed.MAX_FEED_SIZE)
  return function (req, res, next) {
    const type = req.headers['content-type']
    if (type !== 'pico/feed') return next()

    const size = parseInt(req.headers['content-length'])

    const buffer = pool.alloc()
    let released = 0
    const release = () => !released && (reuse.free(buffer), ++released)
    res.once('close', release)

    let offset = 0
    new Promise((resolve, reject) => {
      req.on('data', chunk => {
        try {
          if (offset + chunk.length > size) throw new Error('Buffer overflow')
          offset += chunk.copy(buffer, offset)
        } catch (err) { reject(err) }
      })
      req.once('error', reject)
      req.once('end', resolve)
    }).then(() => {
      // TODO: alternate constructor: new Feed(buffer, tail)
      if (size !== offset) throw new Error('Buffer underflow')
      req.feed = new Feed()
      req.feed.buf = buffer
      req.feed.tail = offset
      req.feed._reIndex(true)
      next()
    }).catch(err => {
      console.info('Pool free() via err', pool.free.length)
      release()
      next(err)
    })
  }
}

function Macros (req, res, next) {
  res.error = (error, code = 400) => send(res, code, { error })
  res.redirect = uri => send(res, 302, '', { Location: uri })
  next()
}
