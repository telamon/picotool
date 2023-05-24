import { test } from 'brittle'
import { Feed, b2h, isFeed } from 'picofeed'
import {
  pack,
  unpack
} from '../index.js'
import Silo from '../silo.js'
import { MemoryLevel } from 'memory-level'
import { readFileSync } from 'node:fs'

const HTML = `<!doctype html>
<html>
<head>
  <title>PicoWEB title</title>
</head>
<body>
  <h1>Hello World</h1>
</body>
</html>
`

test('POP-04 pack/unpack', async t => {
  const { sk } = Feed.signPair() // TODO: change algo
  const p = pack(HTML, sk)
  t.ok(Feed.isFeed(p))
  const out = unpack(p)
  t.is(out.html, HTML)
  t.ok(out.headers.get('date') instanceof Date)
  t.ok(out.date instanceof Date)
})

test('Silo', async t => {
  const db = new MemoryLevel()
  const silo = new Silo(db)
  // put
  const { pk, sk } = Feed.signPair()
  const stored = await silo.put(pack(HTML, sk))
  t.is(stored, true)
  // get
  const feed = await silo.get(pk)
  t.ok(feed)

  // list
  const list = await silo.list() // TBD
  t.is(list.length, 1)

  // update
  const html2 = HTML + '<update>lol</update>'
  const stored2 = await silo.put(pack(html2, sk))
  t.is(stored2, true)
  const site = unpack(await silo.get(pk))
  t.is(site.html, html2)
  // delete
  // TODO
})

test('Silo track hits', async t => {
  const db = new MemoryLevel()
  const silo = new Silo(db)
  const { pk, sk } = Feed.signPair()
  const stored = await silo.put(pack(HTML, sk))
  t.is(stored, true)

  // fetch stats for a site
  let stat = await silo.stat(pk)
  t.is(stat.hits, 0)

  // get
  const feed = await silo.get(pk)
  t.ok(feed)

  stat = await silo.stat(pk)
  t.is(stat.hits, 1)
})

test('POP-04: file.html => file.pwa', async t => {
  const source = readFileSync('./example.html') // File with embedded 'Secret'
  const pwa = pack(source.toString('utf8'))
  // writeFileSync('./example.pwa', pwa.buffer)
  t.ok(isFeed(pwa))
  const site = unpack(pwa)
  console.log(site)
  t.is(typeof site.html, 'string')
  t.ok(site.headers)
  t.ok(site.headers.get('date'))
  t.is(b2h(site.key), site.headers.get('key'))
  t.is(site.body)
})
