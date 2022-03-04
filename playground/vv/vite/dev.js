import express from 'express'
import { join, extname, posix } from 'path'
import { existsSync, readFile, readFileSync } from 'fs'
import { transformCSS, transformJS } from './transform.js'
import chokidar from 'chokidar'
import { createServer } from 'http'
import WebSocket, { Server } from 'ws'
const ROOT_PATH = join(__dirname, '..')
const SOURCE_ROOT_PATH = join(ROOT_PATH, 'target')
const app = express()

app.get('/', (req, res) => {
  let indexHTML = readFileSync(join(SOURCE_ROOT_PATH, 'index.html'), 'utf-8')
  indexHTML = indexHTML.replace(/<head>/, `
    <head>
      <script type="module" src="/@vite/client"></script>
  `.trim())
  res.setHeader('content-type', 'text/html')
  res.send(indexHTML)
})

app.get('/@vite/client', (req, res) => {
  const file = readFileSync(join(__dirname, 'client.js'))
  res.setHeader('content-type', 'application/javascript')
  res.send(file)
})

app.get('/target/.cache/*', (req, res) => {
  const content = readFileSync(join(__dirname, '..', req.url.slice(1)), 'utf-8')
  res.setHeader('content-type', 'application/javascript')
  res.send(content)
})

app.get('/target/*', (req, res) => {
  console.log('express >>>> path', req.url.replace(/\?.*$/, ''))
  const path = req.url.replace(/\?.*$/, '')

  const ext = extname(req.url).slice(1)

  const filePath = join(ROOT_PATH, path.slice(1))
  let fileStr = null
  if ('import' in req.query) {
    const content = `export default \`${req.url.replace(`?import`, '')}\``
    res.setHeader('content-type', 'application/javascript')
    res.send(content)
    return
  }

  switch(ext) {
    case 'svg':
      console.log(ext)
      fileStr = readFileSync(filePath, 'utf-8')
      res.setHeader('content-type', 'image/svg+xml')
      res.send(fileStr)
      break
    case 'css':
      fileStr = readFileSync(filePath, 'utf-8')
      res.setHeader('content-type', 'application/javascript')
      res.send(transformCSS({
        path: req.url,
        code: fileStr
      }).code)
      break
    default: 
      fileStr = readFileSync(filePath, 'utf-8')
      res.setHeader('content-type', 'application/javascript')
      const result = transformJS({
        path: req.url,
        root: SOURCE_ROOT_PATH,
        code: fileStr
      })
      res.send(result.code)
  }
})

const server = createServer(app)
const ws = createWebSocketServer(server)

server.listen('3000', () => {
  console.log('app is listening on port 3000!')
})

function createWebSocketServer (server) {
  const wss = new WebSocket.Server({ noServer: true })

  server.on('upgrade', (req, socket, head) => {
    if (req.headers['sec-websocket-protocol'] === 'vite-hmr') {
      console.log('upgrade >>> 2')

      wss.handleUpgrade(req, socket, head, (ws) => {
        console.log('upgrade >>> 3')
        wss.emit('connection', ws)
      })
    } else {
      socket.destroy()
    }
  })

  wss.on('connection', (ws) => {

    ws.send(JSON.stringify({
      type: 'connected'
    }))
  })

  wss.on('error', (err) => {
    console.error(err.stack || err.message)
  })

  return {
    send(data) {
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data))
        }
      })
    },

    close() {
      wss.close()
    }
  }
}

function createWatcher() {
  return chokidar.watch(SOURCE_ROOT_PATH, {
    ignoreInitial: true,
    disableGlobbing: true,
    ignorePermissionErrors: true
  })
}

function getShortPath (fullname) {
  return posix.relative(ROOT_PATH, fullname)
}

function handleHMRUpdate(opts) {
  const { file, ws } = opts
  const path = `/${getShortPath(file)}`
  console.log('handleHMRUpdate >>>', path)

  ws.send({
    type: 'update',
    updates: [{
      type: 'js-update',
      path,
      timestamp: Date.now()
    }]
  })
}

createWatcher().on('change', (file) => {
  console.log('chokidar file change >>> ', file)
  handleHMRUpdate({ file, ws })
})