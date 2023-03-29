#!/usr/bin/env node
// suffix-less executables cannot have pretty imports
(async () => {
  const { readFileSync } = await import('node:fs')
  const Feed = (await import('picofeed')).default
  const { Command } = await import('commander')
  const { pack } = await import('./index.js')
  const Silo = (await import('./web-silo.js')).default
  const { Level } = await import('level')
  const fetch = (await import('node-fetch')).default

  // TODO: pico-ecosystem uses sodium instead of the new cool bip-driven
  // libs, I don't mind switching. And Buffer also seems dead.
  /*
  if (!globalThis.crypto) { // node <= 18 shim
    globalThis.crypto = {
      getRandomValues: typedArray => { // My node does not provide this method :'(
        const b = globalThis.crypto.randomBytes(typedArray.length)
        b.copy(typedArray)
        return typedArray
      },
      ...(await import('node:crypto'))
    }
  }*/


  const program = new Command()
  program.description(bq`

    General purpose tool for interacting with pico web app.
     ,_ __  _  ___ ___
    | '_ \\| |/ __/ _ \\
    | |_) | | (_| (_) | WEB
    | .__/|_|\\___\\___/
    | |

  `)

  program.command('release')
    .description(bq`
      Sign HTML and publish as PWA
    `)
    .option('-s, --secret <nsec>', 'Your signing secret using POP-1 format')
    .option('-o, --output <url>', 'File or silo URL, default STDOUT')
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
    console.log(input, options)
    let sk
    if (sk) sk = Buffer.from(options.secret, 'hex')
    else {
      console.error('No secret provided, generating, keep it safe')
      sk = Feed.signPair().sk
      console.error(sk.hexSlice())
    }
    // TODO: move to picofeed: const privKey = secp.utils.randomPrivateKey() // Secure random private key

    let html
    if (input !== '-') html = readFileSync(input)
    const feed = pack(sk, html)
    const out = options.output || ''
    if (/^[\w\d]+:/.test(out)) {
      const url = new URL(out)
      switch (url.protocol) {
        case 'http:':
        case 'https:': {
          const site = url.href + feed.last.key.hexSlice()
          const res = await fetch(site, {
            method: 'POST',
            headers: { 'Content-Type': 'pico/feed' },
            body: feed.buf.slice(0, feed.tail)
          })
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
    } else console.log(feed.pickle())
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
