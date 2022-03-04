// node_modules 里的包，预先编译，并且缓存起来
import { build } from 'esbuild'
import { join } from 'path'

const appRoot = join(__dirname, '..')
const cache = join(appRoot, 'target', '.cache');

// import React from 'react' 这里的 react 肯定是要从 node_modules 里去拿的
// 可以预先把相关文件从 node_modules 取出来，build 成 esm 模块，放进一个缓存文件中，这些依赖的三方库一般是不会变更的，所以可以这样预先处理
// 这样更快！
export async function optmize (pkgs = ['react', 'react-dom']) {
  const ep = pkgs.reduce((c, n) => {
    c.push(join(appRoot, "node_modules", n, `cjs/${n}.development.js`));
    return c;
  }, []);

  // console.log(111, ep);

  await build({
    entryPoints: ep,
    bundle: true,
    format: 'esm',
    logLevel: 'error',
    splitting: true,
    sourcemap: true,
    outdir: cache,
    treeShaking: 'ignore-annotations',
    metafile: true,
    define: {
      "process.env.NODE_ENV": JSON.stringify("development")
    }
  })
}