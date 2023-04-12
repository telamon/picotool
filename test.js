import test from 'brittle'
import Feed from 'picofeed'
import { pack, unpack } from './index.js'
import WebSilo from './web-silo.js'
import Silo from './silo.js'
import fetch from 'node-fetch'
import { MemoryLevel } from 'memory-level'

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

test('POP-04 pack/unpack', async (t) => {
  const { sk } = Feed.signPair() // TODO: change algo
  const p = pack(sk, HTML)
  t.ok(Feed.isFeed(p))
  const out = unpack(p)
  // console.log(out)
  t.is(out.body, HTML)
  t.ok(out.headers.date)
  t.is(out.runlevel, 0)
})

test('WebSilo push', async (t) => {
  const [url, close] = await listen()
  const { pk, sk } = Feed.signPair()
  const site = pack(sk, HTML)
  const res = await fetch(url + '/' + pk.hexSlice(), {
    method: 'POST',
    headers: { 'Content-Type': 'pico/feed' },
    body: site.buf.slice(0, site.tail)
  })
  t.is(res.status, 201)
  const visit = await fetch(url + '/' + pk.hexSlice(), {
    method: 'GET',
    headers: { Accept: 'text/html' }
  })
  const original = unpack(site)
  const doc = await visit.text()
  t.is(doc, original.body)
  close()
})

test.skip('WebSilo update', async (t) => {
  const [url, close] = await listen()
  const { pk, sk } = Feed.signPair()
  const site = pack(sk, HTML)
  let res = await fetch(url + '/' + pk.hexSlice(), {
    method: 'POST',
    headers: { 'Content-Type': 'pico/feed' },
    body: site.buf.slice(0, site.tail)
  })
  t.is(res.status, 201)

  const HTML2 = HTML + '<footer>gray-sock</footer>'
  const update = pack(sk, HTML2)
  res = await fetch(url + '/' + pk.hexSlice(), {
    method: 'POST',
    headers: { 'Content-Type': 'pico/feed' },
    body: update.buf.slice(0, update.tail)
  })
  t.is(res.status, 201)

  const visit = await fetch(url + '/' + pk.hexSlice(), {
    method: 'GET',
    headers: { Accept: 'text/html' }
  })

  const original = unpack(site)
  const doc = await visit.text()
  t.is(doc, original.body)
  close()
})

test('web-silo index', async (t) => {
  const [url, close] = await listen()
  const { pk, sk } = Feed.signPair()
  const site = pack(sk, HTML)
  await fetch(url + '/' + pk.hexSlice(), {
    method: 'POST',
    headers: { 'Content-Type': 'pico/feed' },
    body: site.buf.slice(0, site.tail)
  })

  const res = await fetch(url, {
    method: 'GET'
  })
  const [entry] = await res.json()
  t.ok(entry)
  t.ok(entry.key, pk.hexSlice())
  // t.is(entry.revision, 0) // TODO: remove from spec, date is as good revision as any.
  t.ok(entry.date)
  t.is(entry.title, 'PicoWEB title')
  t.is(entry.size, 142)
  close()
})

async function listen () {
  const db = new MemoryLevel()
  const silo = WebSilo(db)
  await new Promise((resolve) => silo.listen(1337, resolve))
  return ['http://localhost:1337', () => silo.server.close()]
}

test('Silo', async (t) => {
  const db = new MemoryLevel()
  const silo = new Silo(db)
  // put
  const { pk, sk } = Feed.signPair()
  const stored = await silo.put(pack(sk, HTML))
  t.is(stored, true)
  // get
  const feed = await silo.get(pk)
  t.ok(feed)

  // list
  const list = await silo.list() // TBD
  t.is(list.length, 1)
  // delete
  // TODO
})

test('Silo track hits', async (t) => {
  const db = new MemoryLevel()
  const silo = new Silo(db)
  const { pk, sk } = Feed.signPair()
  const stored = await silo.put(pack(sk, HTML))
  t.is(stored, true)

  // fetch stats for a site
  // TODO: implement silo.stat(pk) => { hits: Number }
  let stat = await silo.stat(pk)
  t.is(stat.hits, 0)

  // get
  const feed = await silo.get(pk)
  t.ok(feed)

  stat = await silo.stat(pk)
  t.is(stat.hits, 1)
})
