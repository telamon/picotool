import Repo from 'picorepo'
// import { inspect } from 'picorepo/dot.js'
import { unpack } from './index.js'

/**
 * A naive peristent storage of websites
 */
export default class Silo {
  constructor (db) {
    this.db = db
    this.repo = new Repo(db.sublevel('repo', {
      valueEncoding: 'buffer',
      keyEncoding: 'buffer'
    }))
    this.idxMeta = db.sublevel('metadata', {
      keyEncoding: 'buffer',
      valueEncoding: 'json'
    })
    this.idxDate = db.sublevel('updates', {
      keyEncoding: 'utf8',
      valueEncoding: 'buffer'
    })
    this.hits = db.sublevel('hits', { keyEncoding: 'buffer', valueEncoding: 'json' })
  }

  async put (feed) {
    const block = feed.last
    const site = unpack(block)
    const { key } = site

    if (site.runlevel !== 0) throw new Error('Unsupported Runlevel')
    if (new Date(site.headers.date).getTime() > Date.now()) throw new Error('Site from future')

    // TODO: validate contents.
    const meta = await this.idxMeta.get(key).catch(ignore404)
    if (meta) {
      if (site.date <= meta.date) return false
    }

    // Purge previous version
    const evicted = await this.repo.rollback(key)
    if (evicted) {
      console.log('New version', key.hexSlice(0, 6), evicted.last.sig.hexSlice(0, 6), ' => ', block.sig.hexSlice(0, 6))
    }

    // store new version
    const nMerged = await this.repo.merge(feed)
    if (!nMerged) return false

    // store metadata
    const matchTitle = site.body.match(/<title>([^<]+)<\/title>/)
    await this.idxMeta.put(key, {
      date: site.date,
      title: matchTitle ? matchTitle[1] : '',
      runlevel: 0,
      size: feed.last.size
    })
    await this.idxDate.put(site.date, key)
    return true
  }

  async stat (key) {
    const meta = await this.idxMeta.get(key).catch(ignore404)
    if (!meta) return
    const hits = (await this.hits.get(key).catch(ignore404)) || 0
    return { ...meta, hits }
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
      const stat = await this.stat(head.key)
      out.push({
        key: head.key.hexSlice(),
        ...stat,
        signature: head.value.hexSlice()
      })
    }
    return out
  }
}

function ignore404 (err) {
  if (err.code !== 'LEVEL_NOT_FOUND') throw err
}
