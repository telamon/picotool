import esbuild from 'esbuild'
import plugin from 'node-stdlib-browser/helpers/esbuild/plugin'
import stdLibBrowser from 'node-stdlib-browser'

const config = {
  entryPoints: ['index.js'],
  outfile: 'index.esm.js',
  format: 'esm',
  platform: 'browser',
  bundle: true,
  keepNames: true,
  sourcemap: false,
  metafile: true,
  inject: ['./node_modules/node-stdlib-browser/helpers/esbuild/shim.js'],
  define: {
    global: 'global',
    // process: 'process',
    Buffer: 'Buffer'
  },
  plugins: [
    plugin(stdLibBrowser)
  ]
}

async function build () {
  const result = await esbuild.build(config)

  // print summary
  console.log('=== Build Summary ===')
  const { outputs } = result.metafile
  for (const k in outputs) {
    console.log(`${k} ${outputs[k].bytes}B`)
  }
  console.log('\n')
}
build()
