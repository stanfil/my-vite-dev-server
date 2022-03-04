import { build } from 'esbuild'
import { join } from 'path'

const _deps = ['react', 'react-dom']

function optimize() {
  const entryPoints = _deps.map(name => join(__dirname, '..', 'node_modules', name, `cjs/${name}.development.js`))
  build({
    entryPoints,
    outdir: join(__dirname, '../target/.cache'),
    sourcemap: true,
    bundle: true,
    format: 'esm',
    logLevel: 'error',
    splitting: true,
    metafile: true,
    define: {
      "process.env.NODE_ENV": JSON.stringify("development")
    }
  })
}

// 预构建依赖
optimize()