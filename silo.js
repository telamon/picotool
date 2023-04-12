import Repo from 'picorepo'
import { unpack } from './index.js'

export default class Silo {
  constructor (db) {
    this.db = db
    this.idxMeta = db.sublevel('metadata', {
      keyEncoding: 'buffer',
      valueEncoding: 'json'
    })
    this.idxDate = db.sublevel('updates', {
      keyEncoding: 'utf8',
      valueEncoding: 'buffer'
    })
    this.repo = new Repo(db.sublevel('repo', {
      valueEncoding: 'buffer',
      keyEncoding: 'buffer'
    }))
    this.hits = db.sublevel('hits', { keyEncoding: 'buffer', valueEncoding: 'json' })
  }

  async put (feed) {
    const block = feed.last
    const site = unpack(block)
    // TODO: validate contents.
    const meta = await this.idxMeta.get(site.key).catch(ignore404)
    if (meta) {
      if (site.date <= meta.date) return false
    }
    const matchTitle = site.body.match(/<title>([^<]+)<\/title>/)
    await this.idxMeta.put(site.key, {
      date: site.date,
      title: matchTitle ? matchTitle[1] : '',
      runlevel: 0,
      size: feed.last.size
    })
    if (site.runlevel !== 0) throw new Error('Unsupported Runlevel')
    if (new Date(site.headers.date).getTime() > Date.now()) throw new Error('Site from future')
    // Purge previous version
    const id = await this.repo.headOf(block.key)
    if (id) await this.repo.repo.rollback(block.key)
    // store new
    await this.repo.merge(feed)
    return true
  }

  async stat (key) {
    const hits = await this.hits.get(key).catch(ignore404)
    return { hits: hits || 0 }
  }

  async get (key) {
    const counter = await this.hits.get(key).catch(ignore404)
    await this.hits.put(key, (counter || 0) + 1)
    return this.repo.loadHead(key)
  }

  async list (filter = {}) {
    const heads = await this.repo.listHeads()
    const out = []
    for (const head of heads) {
      const metadata = await this.idxMeta.get(head.key)
      out.push({
        key: head.key.hexSlice(),
        ...metadata,
        signature: head.value.hexSlice()
      })
    }
    return out
  }
}

function ignore404 (err) {
  if (err.code !== 'LEVEL_NOT_FOUND') throw err
}
