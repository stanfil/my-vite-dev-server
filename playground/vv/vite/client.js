const _cssMap = new Map()

export function updateStyle (id, content) {
  let style = _cssMap.get(id)
  if (style) {
    style.innerHTML = content
  } else {
    const ele = document.createElement('style')
    ele.setAttribute('type', 'text/css')
    ele.innerHTML = content
    document.head.appendChild(ele)
  }
  _cssMap.set(id, content)
}

export function removeStyle (id) {
  const style = _cssMap.get(id)
  if (style) {
    style.parentNode.removeChild(style)
    _cssMap.delete(id)
  }
}

let ws

function init() {
  console.log('[vite]: connecting...')

  ws = new WebSocket('ws://localhost:3000', 'vite-hmr')

  ws.addEventListener('message', ({ data }) => {
    handleHMRUpdate(JSON.parse(data))
  })
}

function handleHMRUpdate (data) {
  switch(data.type) {
    case 'connected': 
      console.log('[vite]: connected!')
      break
    case 'update':
      data.updates.forEach(async update => {
        if (update.type === 'js-update') {
          await import(update.path + `?timestamp=${update.timestamp}`)
          location.reload()
        }
      })
  }
}

init()