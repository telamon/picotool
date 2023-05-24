#!/usr/bin/env node

// suffix-less executables cannot have pretty imports
(async () => {
  const { readFileSync, writeFileSync } = await import('node:fs')
  const { Feed, b2h, toU8 } = (await import('picofeed'))
  const { Command } = await import('commander')
  const { pack, pushHttp, pickle, unpickle } = await import('./index.js')
  const Silo = (await import('./web-silo.js')).default
  const { Level } = await import('level')

  const program = new Command()
  program.description(bq`
    General purpose tool for interacting with pico web apps.
  `)

  program.command('pub')
    .description('Sign HTML and publish as PWA')
    .option('-s, --secret <nsec>', 'Your signing secret using POP-1 format')
    .option('-o, --output <url|file|qr>', 'Destination File, Silo, default: STDOUT')
    .argument('<HTML file>', 'File path to html, use "-" for STDIN')
    .action(runRelease)

  program.command('silo')
    .description(bq`
      Run a local http-silo-server
    `)
    .option('-d, --database <path>', 'path to database', 'silo.lvl')
    .option('-p, --port <number>', 'listening port', '5000')
    .action(runSilo)

  program.command('dump')
    .description(bq`
      Preview a PWA in terminal
    `)
    .argument('<source>', 'URL, PicoURL, .pwa file')
    .action(() => console.error('Not implemented'))

  program.parse()

  async function runRelease (input, options) {
    let sk
    if (sk) sk = toU8(options.secret)
    else {
      console.error('No secret provided, generated new, keep it safe: \n')
      sk = Feed.signPair().sk
      console.error(sk, '\n')
    }
    // TODO: move to picofeed: const privKey = secp.utils.randomPrivateKey() // Secure random private key

    let html
    if (input !== '-') html = readFileSync(input).toString('utf8')
    const feed = pack(html, sk)
    const out = options.output || ''
    if (/^[\w\d]+:/.test(out)) {
      const url = new URL(out)
      switch (url.protocol) {
        case 'http:':
        case 'https:': {
          const site = url.href + b2h(feed.last.key)
          const res = await pushHttp(site, feed)
          if (res.status !== 201) {
            console.error('Something went wrong:', await res.text())
          } else {
            console.error('Successfully published to')
            console.log(site)
          }
        } break
        default:
          console.error(url.protocol, 'not yet implemented')
      }
    } else if (/\.pwa$/.test(out)) {
      writeFileSync(out, feed.buffer)
    } else {
      const s = pickle(feed)
      const f = unpickle(s)
      if (f.diff(feed) !== 0) throw new Error('Assertion Failed')
      console.log(s)
    }
  }

  async function runSilo (options) {
    const port = parseInt(options.port)
    const db = new Level(options.database)
    const silo = Silo(db)
    await new Promise(resolve => silo.listen(port, resolve))
    console.error('Listening on port: ', port)
    console.error('Press Ctrl+C to exit')
  }
})()

// quick'n'dirty block-quote template parser
function bq (str, ...tokens) {
  str = [...str]
  for (let i = tokens.length; i > 0; i--) str.splice(i, 0, tokens.pop())
  return str.join('').split('\n').map(t => t.trim()).join('\n').trim()
}
