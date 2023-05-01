// SPDX-License-Identifier: AGPL-3.0-or-later
import { Feed, b2s, getPublicKey, cpy, s2b, usize } from 'picofeed'
import { b64e, b64d, byteLength } from './b64.js'

/**
 * Signs a Pico Web Application according to spec POP-04
 * Automatically appends `Key` and `Date` header.
 * Reads/filters `Secret` (nonstd/quirk)
 *
 * @param {string|Uint8Array} html Source code
 * @param {import('picofeed').SecretKey} [secret] Signing secret unless contained in body
 * @param {Headers} [headers] Additional headers
 * @param {number} [runlvl=0] PWA Runlevel
 * @param {Feed} [feed=new Feed()] Appends block on existing feed if provided.
 * @returns {Feed}
 */
export function pack (html, secret, headers = {}, runlvl = 0, feed = new Feed()) {
  let format = `html${runlvl}`
  const rawHeaders = new globalThis.Headers()
  let offset = 0
  try {
    const { docType, headers: hs, end } = bootParser(html, offset)
    offset = end
    if (docType) format = docType
    if (hs.has('secret')) {
      secret = hs.get('secret')
      hs.delete('secret')
    }
    for (const [key, value] of hs.entries()) rawHeaders.set(key, value)
  } catch (err) {
    if (err.message !== 'UnsupportedFormat') throw err
  }
  for (const key in headers) rawHeaders.append(key, headers[key])
  rawHeaders.set('key', getPublicKey(secret))
  rawHeaders.set('date', Date.now())
  let hdata = format + '\n'
  for (const [key, value] of rawHeaders.entries()) {
    if (typeof value === 'string') for (const v of value.split(',')) hdata += `${key}: ${v}\n`
    else hdata += `${key}: ${value}\n`
  }
  hdata += '\n'
  const buffer = new Uint8Array(hdata.length + html.length - offset)
  cpy(buffer, s2b(hdata))
  cpy(buffer, html.slice(offset), hdata.length)
  feed.append(buffer, secret)
  return feed
}

/** @typedef {format: string, key: PublicBin, date: Date, headers: Headers, html: string} Site */
/**
 * Parses headers and decodes html to string.
 * @param {Block|Feed} pico-block
 * @returns {Site} An unpacked site */
export function unpack (block) {
  if (Feed.isFeed(block)) block = block.last
  if (!Feed.isBlock(block)) throw new Error('Not a block')
  const { docType: format, headers, end } = bootParser(block.body)
  return {
    format,
    key: block.key,
    date: headers.get('date'),
    headers,
    html: b2s(block.body.slice(end))
  }
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

if (!globalThis.Headers) {
  globalThis.Headers = class Headers extends Map {
    /** @type {(string, string) => void} */
    append (key, value) {
      key = key.toLowerCase()
      if (this.has(key)) this.set(key, this.get(key) + ', ' + value)
      else this.set(key, value)
    }
  }
}

/**
 * Parses string/buffer and extracts headers
 * according to spec
 * @param {string|Uint8Array} str Input html/source
 * @param {number} o Input offset
 */
export function bootParser (str, o = 0) {
  if (typeof str !== 'string') str = b2s(str)

  const headers = new globalThis.Headers()
  let docType = null
  while (true) {
    const e = str.indexOf('\n', o)
    const line = str.slice(o, e)
    o = e + 1
    if (!docType) {
      switch (line) {
        case 'html0':
        case 'html1':
          docType = line
          continue
        default: throw new Error('UnsupportedFormat')
      }
    } else if (line === '') break
    const segs = line.split(':')
    const key = segs.shift().trim().toLowerCase()
    let value = segs.join(':').trim()
    if (key === 'date') {
      value = new Date(parseInt(value))
    }
    headers.append(key, value)
  }
  return { docType, headers, end: o }
}
