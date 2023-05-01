import { test, solo } from 'brittle'
import Feed from 'picofeed'
import { pack, unpack, pushHttp, fetchHttp } from '../index.js'
import WebSilo from '../web-silo.js'
import fetch from 'node-fetch'
import { MemoryLevel } from 'memory-level'

globalThis.fetch = fetch // shim fetch

async function listen () {
  const db = new MemoryLevel()
  await db.open()
  const silo = WebSilo(db)
  await new Promise(resolve => silo.listen(1337, resolve))
  return ['http://localhost:1337', () => silo.server.close()]
}

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

solo('WebSilo push', async t => {
  const [url, close] = await listen()
  const { pk, sk } = Feed.signPair()
  const site = pack(sk, HTML)
  const res = await pushHttp(url + '/' + pk.hexSlice(), site)
  t.is(res.status, 201)
  // Test fetch as text/html (unrestricted mode)
  const visit = await fetch(url + '/' + pk.hexSlice(), {
    method: 'GET',
    headers: { Accept: 'text/html' }
  })
  const original = unpack(site)
  const doc = await visit.text()
  t.is(doc, original.body)

  // Test fetch as pico/feed (for sandboxed bootloading)
  const feed = await fetchHttp(url + '/' + pk.hexSlice())
  t.is(Feed.isFeed(feed), true)
  close()
})

test('WebSilo update', async t => {
  const [url, close] = await listen()
  const { pk, sk } = Feed.signPair()
  const site1 = pack(sk, HTML)
  let res = await pushHttp(url + '/' + pk.hexSlice(), site1)
  t.is(res.status, 201)

  const HTML2 = HTML + '<footer>gray-sock</footer>'
  const site2 = pack(sk, HTML2)
  res = await pushHttp(url + '/' + pk.hexSlice(), site2)
  t.is(res.status, 201)

  const visit = await fetch(url + '/' + pk.hexSlice(), {
    method: 'GET',
    headers: { Accept: 'text/html' }
  })

  const original = unpack(site2)
  const doc = await visit.text()
  t.is(doc, original.body)
  close()
})

test('web-silo index', async t => {
  const [url, close] = await listen()
  const { pk, sk } = Feed.signPair()
  const site = pack(sk, HTML)
  await pushHttp(url + '/' + pk.hexSlice(), site)

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

test('web-silo stat', async t => {
  const [url, close] = await listen()
  const { pk, sk } = Feed.signPair()
  const site = pack(sk, HTML)
  await pushHttp(url + '/' + pk.hexSlice(), site)
  const res = await fetch(url + '/stat/' + pk.hexSlice(), {
    method: 'GET'
  })
  t.is(res.status, 200)
  const stat = await res.json()
  t.is(stat.hits, 0)
  t.is(stat.runlevel, 0)
  t.is(stat.title, 'PicoWEB title')
  close()
})
