import { build, transformSync } from 'esbuild'
import { extname, join, dirname } from 'path'
export function transformCSS (opts) {
  const { path, code } = opts

  const result = `
    import { updateStyle } from '/@vite/client'
    updateStyle('${path}', \`${code}\`)
  `.trim()
  return {
    ...opts,
    code: result
  }
}

export function transformJS (opts) {
  const { path, code, root } = opts
  const result = transformSync(code, {
    loader: 'jsx',
    sourcemap: true,
    format: 'esm'
  })
  const importRE = /import\s+(?:[\*{}\s\w]+from\s+)?("([^"]+)"|'([^']+)')/g
  result.code = result.code.replace(importRE, (match, a, b, c) => {
    b = b || c
    // console.log('replace >>>>', match, a, b)
    let from
    // 内部文件
    if (b.startsWith('.')) {
      const url = join(dirname(path), b)
      const ext = extname(url).slice(1)
      switch(ext) {
        case 'svg':
          from = `${b}?import`
          break
        // case 'css':
        //   return match.replace(a, `"${b}?css"`)
        default:
          from = url
      }
    // 外部文件
    } else {
      from = `/target/.cache/${b}/cjs/${b}.development.js`
    }
    return match.replace(a, `"${from}"`)
  })
  return result
}