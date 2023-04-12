import test from 'brittle'
import Feed from 'picofeed'
import {
  pack,
  unpack
} from '../index.js'
import Silo from '../silo.js'
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

test('POP-04 pack/unpack', async t => {
  const { sk } = Feed.signPair() // TODO: change algo
  const p = pack(sk, HTML)
  t.ok(Feed.isFeed(p))
  const out = unpack(p)
  // console.log(out)
  t.is(out.body, HTML)
  t.ok(out.headers.date)
  t.is(out.runlevel, 0)
})

test('Silo', async t => {
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

  // update
  const html2 = HTML + '<update>lol</update>'
  const stored2 = await silo.put(pack(sk, html2))
  t.is(stored2, true)
  const site = unpack(await silo.get(pk))
  t.is(site.body, html2)
  // delete
  // TODO
})

test.skip('Silo track hits', async t => {
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
