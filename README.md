[`pure | 📦`](https://github.com/telamon/create-pure)
[`code style | standard`](https://standardjs.com/)
# picotool

> A pico web app signer and silo

This is a tool to build and host
decentralized single file progressive web applications
whose maximum allowed filesize is `64K`.

## Use

Create an cool `index.html`
Then run:

```bash
$ npx picotool pub index.html -o https://pyra.se/silo
```

Or host your own silo:

```bash
$ npx picotool silo
```

## API

```js
import { pack, unpack } from 'picotool'
import silo from 'picotool/silo.js'
// TODO: create typedefs and docs
```

## Where to go from here

There is an effort to interconnect all silos using any transport.

Checkout the [POPs](https://github.com/decentlabs-north/pops)
Or join our [discord](https://discord.gg/8RMRUPZ9RS)


[AGPL-3.0-or-later](./LICENSE)

2023 &#x1f12f; Tony Ivanov
