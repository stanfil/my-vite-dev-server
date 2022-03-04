import express from 'express';
import { createServer } from 'http';
import { join, extname, posix } from 'path'
import { readFileSync } from 'fs';
import chokidar from 'chokidar'
import WebSocket from 'ws';
import { transformCode, transformCss, transformJSX } from './transform';

// esm 机制：import 的内容都会走请求去拉取资源，我们自己起一个服务，就可以对这些请求的返回进行拦截处理，返回我们处理过后的内容
// 整个应用就完全基于 node 服务，静态资源加载，没有编译构建的过程，肯定就会很快了。

const targetRootPath = join(__dirname, '../target');

// 建立一个 websocket 服务，封装 send 方法
function createWebSocketServer(server) {
  const wss = new WebSocket.Server({ noServer: true })

  server.on('upgrade', (req, socket, head) => {
    if (req.headers['sec-websocket-protocol'] === 'vite-hmr') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
  });

  wss.on('connection', (socket) => {
    socket.send(JSON.stringify({ type: 'connected' }));
  });

  wss.on('error', (e) => {
    if (e.code !== 'EADDRINUSE') {
      console.error(
        chalk.red(`WebSocket server error:\n${e.stack || e.message}`),
      );
    }
  });

  return {
    send(payload) {
      const stringified = JSON.stringify(payload);
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(stringified);
        }
      });
    },

    close() {
      wss.close();
    },
  }
}

// 监听文件变更
function watch() {
  return chokidar.watch(targetRootPath, {
    ignored: ['**/node_modules/**', '**/.cache/**'],
    ignoreInitial: true,
    ignorePermissionErrors: true,
    disableGlobbing: true,
  })
}

function getShortName(file, root) {
  return file.startsWith(root + '/') ? posix.relative(root, file) : file;
}

// 文件变化了执行的回调，里面其实就是用 websocket 推送变更数据
function handleHMRUpdate(opts) {
  const {file, ws} = opts;
  const shortFile = getShortName(file, targetRootPath);
  const timestamp = Date.now();
  let updates
  if (shortFile.endsWith('.css') || shortFile.endsWith('.jsx')) {
    updates = [
      {
        type: 'js-update',
        timestamp,
        path:  `/${shortFile}`,
        acceptedPath: `/${shortFile}`
      }
    ]
  }

  ws.send({
    type: 'update',
    updates
  })
}

// --------------------- 梳理 ----------------------
/**
 * 1. 起一个 node 服务
 * 2. 模版项目的文件，就都走静态资源路径了
 * 3. html 返回
 * 4. html 返回之前呢，塞一个 client 进去，<script src="/a/client" type="module"/>
 * 5. 写这个接口 /a/client -> 内置的 client.js -> HMR
 * 6. server - websocket - client
 * 7. 监听文件变更（三方库）-> 封装一个数据结构（变更） -> websocket -> client
 * 8. 其它文件 .css .jsx 的处理
 * 9. css -> js -> createElement('style') -> header
 * 10. .jsx -> .js (引用三方，本地) / 三方（缓存） + 本地（拼路径）
 * 11. plugin 系统等
 */
// --------------------- 梳理 ----------------------

// 1. 起一个服务，express, koa, golang...
// 2. 拦截入口请求: localhost:3002 -> 返回它 html 文件
// 3. 加一些骚操作，比如 「热更新」 HMR
export async function dev() {
  const app = express();

  // 拦截这个入口请求，返回给用户处理过的 html 文件
  app.get('/', (req, res) => {
    // content-type
    res.set('Content-Type', 'text/html');
    // html 文件的绝对路径
    const htmlPath = join(__dirname, '../target', 'index.html');
    // 根据路径取读文件，获取到文件的字符串
    let html = readFileSync(htmlPath, 'utf-8');
    // 塞入客户端代码（包含了热更新等）
    html = html.replace('<head>', `<head>\n  <script type="module" src="/@vite/client"></script>`).trim()
    res.send(html);
  })

  // 把客户端代码塞给浏览器，给 html
  app.get('/@vite/client', (req, res) => {
    res.set('Content-Type', 'application/javascript');
    res.send(
      // 这里返回的才是真正的内置的客户端代码
      transformCode({
        code: readFileSync(join(__dirname, 'client.js'), 'utf-8')
      }).code
    )
  })

  // 静态文件的处理，返回给浏览器能认识的
  app.get('/target/*', (req, res) => {
    // req.path -----> /target/main.jsx
    // 完整的文件路径
    const filePath = join(__dirname, '..', req.path.slice(1));

    // 静态资源给一个 flag
    if ('import' in req.query) {
      res.set('Content-Type', 'application/javascript');
      res.send(`export default "${req.path}"`);
      return;
    }

    // 对不同类型的文件做不同的处理，返回的是浏览器能够认识的结构，比如如果是 jsx 文件，就需要转成 js
    // 如果是 css 文件，就需要放 style 标签，然后塞到 html header 
    switch(extname(req.path)) {
      case '.svg':
        res.set('Content-Type', 'image/svg+xml');
        res.send(
          readFileSync(filePath, 'utf-8')
        )
        break;
      case ".css":
        res.set('Content-Type', 'application/javascript');
        res.send(
          transformCss({
            path: req.path,
            code: readFileSync(filePath, 'utf-8')
          })
        )
        break;
      default:
        res.set('Content-Type', 'application/javascript');
        res.send(
          transformJSX({
            appRoot: join(__dirname, '../target'),
            path: req.path,
            code: readFileSync(filePath, 'utf-8')
          }).code
        )
        break;
    }
  })

  const server = createServer(app);
  const ws = createWebSocketServer(server);

  // 监听文件的变化
  watch().on('change', async (file) => {
    handleHMRUpdate({ file, ws });
  })

  const port = 3002;
  server.listen(port, () => {
    console.log('App is runing at 127.0.0.1:' + port);
  })
}
