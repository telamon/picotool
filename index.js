// SPDX-License-Identifier: AGPL-3.0-or-later
import PicoFeed from 'picofeed'
export const Feed = PicoFeed

export function pack (secret, body, headers = {}, runlvl = 0, feed = new Feed()) {
  let hdata = ''
  headers.date = Date.now()
  for (const key in headers) hdata += `${key.toLowerCase()}: ${headers[key]}\n`
  const data = Buffer.concat([
    Buffer.from(`html${runlvl}\n${hdata}\n`, 'utf8'),
    Buffer.from(body, 'utf8')
  ])
  feed.append(data, secret)
  return feed
}

export function unpack (block) {
  if (Feed.isFeed(block)) return unpack(block.last)
  if (!block[Feed.BLOCK_SYMBOL]) throw new Error('Not a block')
  const str = block.body.toString('utf8')
  let o = str.indexOf('\n')
  const type = str.slice(0, o)
  if (type !== 'html0') throw new Error('Unsupported type')
  const headers = {}
  let date = 0
  while (true) {
    const e = str.indexOf('\n', ++o)
    const line = str.slice(o, e)
    o = e
    if (line === '') break
    let [key, value] = line.split(':')
    key = key.trim().toLowerCase()
    value = value.trim()
    if (key === 'date') {
      value = parseInt(value)
      date = value
    }
    headers[key.trim().toLowerCase()] = value
  }
  return {
    key: block.key,
    date,
    runlevel: 0,
    headers,
    body: str.slice(++o)
  }
  //  block.body
}

export async function pushHttp (siloUrl, site) {
  site = PicoFeed.from(site)
  return globalThis.fetch(siloUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'pico/feed' },
    body: site.buf.slice(0, site.tail)
  })
}

export async function fetchHttp (siloUrl) {
  const res = await globalThis.fetch(siloUrl, {
    method: 'GET',
    headers: { accept: 'pico/feed' }
  })
  if (res.status !== 200) return res
  const ctype = res.headers.get('Content-Type')
  if (ctype !== 'pico/feed') throw new Error('Expected pico/feed, received ' + ctype)
  // TODO: For PicoFeed 4.x redesign API so that this should never happen.
  // also most likely just write the whole thing in wasm/zig. Cause this is not nice.
  const feed = new Feed()
  feed.buf = Buffer.from(await res.arrayBuffer())
  feed.tail = feed.buf.length
  feed._reIndex(true)
  return feed
}
