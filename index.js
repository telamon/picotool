// SPDX-License-Identifier: AGPL-3.0-or-later
import { Feed, b2s } from 'picofeed'
import { b64e, b64d, byteLength } from './b64.js'
/** @returns {Feed} */
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
  if (Feed.isFeed(block)) block = block.last
  if (!Feed.isBlock(block)) throw new Error('Not a block')
  const str = b2s(block.body)
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

/** @type {(feed: Feed) => string} */
export function pickle (feed) {
  return b64e(feed.buffer)
}
/** @type {(str: string) => Feed} */
export function unpickle (str) {
  const b = new Uint8Array(byteLength(str))
  b64d(b, str)
  return new Feed(b)
}
