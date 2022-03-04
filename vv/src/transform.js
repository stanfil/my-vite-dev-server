import { transformSync } from 'esbuild';
import { extname, dirname, join } from 'path'
import { existsSync } from 'fs'

export function transformCode(opts) {
  return transformSync(opts.code, {
    loader: opts.loader || 'js',
    sourcemap: true,
    format: 'esm'
  })
}

// 把 css 封装成 js 里，通过 style 绑定到页面去
export function transformCss(opts) {
  return `
    import { updateStyle } from '/@vite/client';

    const id = "${opts.path}";
    const css = "${opts.code.replace(/\n/g, '')}";

    updateStyle(id, css);
    export default css;
  `.trim()
}

export function transformJSX(opts) {
  const ext = extname(opts.path).slice(1); // 'jsx'
  const ret = transformCode({ // jsx -> js
    loader: ext,
    code: opts.code
  });

  let { code } = ret;
  // 分析代码字符串的 import
  // 为啥要分析 import 呢？

  // import type { XXXX } from 'xxx.ts';
  // import React from 'react';
  // 下面的正则取出 from 后面的 "react", 然后通过有没有 "." 判断是引用的本地文件还是三方库
  // 本地文件就拼路径
  // 三方库就从我们预先编译的缓存里面取
  code = code.replace(
    /\bimport(?!\s+type)(?:[\w*{}\n\r\t, ]+from\s*)?\s*("([^"]+)"|'([^']+)')/gm,
    (a, b, c) => {
      let from;
      if (c.charAt(0) === '.') { // 本地文件
        from = join(dirname(opts.path), c);
        const filePath = join(opts.appRoot, from);
        if (!existsSync(filePath)) {
          if (existsSync(`${filePath}.js`)) {
            from = `${from}.js`
          }
        }

        if (['svg'].includes(extname(from).slice(1))) {
          from = `${from}?import`
        }
      }
      else { // 从 node_modules 里来的
        from = `/target/.cache/${c}/cjs/${c}.development.js`;
      }

      return a.replace(b, `"${from}"`)
    }
  )

  return {
    ...ret,
    code
  }
}