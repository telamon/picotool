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
