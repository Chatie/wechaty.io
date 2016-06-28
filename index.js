const EventEmitter = require('events')

const log = require('npmlog')
log.level = 'verbose'
log.level = 'silly'

const server = require('http').createServer()
  , url = require('url')
  , WebSocket = require('ws')
  , express = require('express')
  , app = express()
  // set the port of our application
  // process.env.PORT is set by Heroku/Cloud9
  var port = process.env.PORT || 8080

server.on('request', app);
server.listen(port, function () { console.log('Listening on ' + server.address().port) });

// https://github.com/websockets/ws/blob/master/doc/ws.md
const wss = new WebSocket.Server({
  // host: process.env.IP
  // , port: process.env.PORT
  handleProtocols
  , verifyClient
  , server
})

const dbUri = process.env.MONGODB_URI

app.use(function (req, res) {
  res.send(`
 <!DOCTYPE html>
  <meta charset="utf-8" />
  <title>WebSocket Test</title>
  <script language="javascript" type="text/javascript">

  var wsUri = "wss://echo.websocket.org/";
  wsUri = document.location.href.replace(/^http(.?):/, 'ws$1:') + 'websocket/token/zixia'

  var output;

  function init()
  {
    output = document.getElementById("output");
    testWebSocket();
  }

  function testWebSocket()
  {
    websocket = new WebSocket(wsUri, 'web|0.0.1')
    websocket.onopen = function(evt) { onOpen(evt) }
    websocket.onclose = function(evt) { onClose(evt) }
    websocket.onmessage = function(evt) { onMessage(evt) }
    websocket.onerror = function(evt) { onError(evt) }
  }

  function onOpen(evt)
  {
    console.log(evt)
    writeToScreen("CONNECTED");
    doSend("WebSocket rocks");
  }

  function onClose(evt)
  {
    console.log(evt)
    writeToScreen("DISCONNECTED");
  }

  function onMessage(evt)
  {
    console.log(evt)
    writeToScreen('<span style="color: blue;">RESPONSE ALL: ' + JSON.stringify(evt) +'</span>');
    writeToScreen('<span style="color: blue;">RESPONSE DATA: ' + evt.data+'</span>');
    // websocket.close();
  }

  function onError(evt)
  {
    writeToScreen('<span style="color: red;">ERROR:</span> ' + evt.data);
  }

  function doSend(message)
  {
    writeToScreen("SENT: " + message);
    websocket.send(message);
  }

  function writeToScreen(message)
  {
    var pre = document.createElement("p");
    pre.style.wordWrap = "break-word";
    pre.innerHTML = message;
    output.appendChild(pre);
  }

  window.addEventListener("load", init, false);

  </script>

  <h2>Wechaty.io WebSocket Test</h2>

  <div id="output"></div>

  `)
})





// var WebSocketServer = require('ws').Server
// https://github.com/websockets/ws/issues/326

// http://stackoverflow.com/a/19155613/1123955
function verifyClient(info, done) {
  console.log('verifyClient()')

  const {origin, secure, req} = info
//  console.log(origin)
//  console.log(secure)
  // console.log(req)
  console.log(req.url)


  let token = authToken(req.headers.authorization)
              || urlToken(req.url)

  if (!token) {
    return done(false, 400, 'Bad Request')
  }

  if (!auth(token)) {
    console.log('auth fail')
    return done(false, 401, 'Unauthorized')
  }

  req.user = token

  done(true, 200, 'Ok')

  function auth(token) {
    console.log('token: ' + token)
    return !!token
  }
}

function urlToken(url) {
  const matches = String(url).match(/token\/(.+)$/i)
  return matches && matches[1]
}

function authToken(authorization) {
  // https://github.com/KevinPHughes/ws-basic-auth-express/blob/master/index.js
  if (!authorization) {
    console.log('no authorization')
    return null
  }
  const parts = authorization.split(' ')
  if (parts.length !== 2) {
    console.log('authorization part is not 2')
    return null
  }
  const scheme = parts[0]
  const token = parts[1]
  if (!/Token/i.test(scheme) || !token) {
    console.log('authorization schema is not Token')
    return null
  }
  return token
}

function handleProtocols(protocols, done) {
  // https://bugs.chromium.org/p/chromium/issues/detail?id=398407#c2
  console.log('handleProtocols() protocols: ' + protocols)

  done(true, protocols[0])
}

const userSocks = {}

wss.on('connection', function connection(ws) {
  log.verbose('Io', 'wss.on event connection')
  //console.log(ws)
  // console.log(': ' + ws.upgradeReq.client.user)
//  upgradeReq.socket/connection/client

  const user      = ws.upgradeReq.user
  const protocol  = ws.protocol

  console.log('user: ' + user)
  console.log('protocol: ' + protocol)

  const [module, version] = protocol.split('|')

  Object.assign(ws, {
    user, module
  })
  if (!userSocks[user]) {
    userSocks[user] = {}
  }
  if (!userSocks[user][module]) {
    userSocks[user][module] = []
  }
  userSocks[user][module].push(ws)

  switch(module.toLowerCase()) {
    case 'web':
      onWebConnection(ws)
      break
    case 'io':
      onIoConnection(ws)
      break
    default:
      log.error('Io', 'protocol module [%s] not supported', module)
      break
  }
})

function onWebConnection(ws) {
  var location = url.parse(ws.upgradeReq.url, true);
  // you might use location.query.access_token to authenticate or share sessions
  // or ws.upgradeReq.headers.cookie (see http://stackoverflow.com/a/16395220/151312)

  ws.on('message', function incoming(message) {
    console.log('received: %s', message);
  })
  ws.on('error', gone)
  ws.on('close', gone)

  function gone(ws) {
    log.verbose('Io', 'onWebConnection() gone()')
    if (!ws.user || !userSocks || !userSocks[ws.user]) {
      return
    }
    const webSocks = userSocks[ws.user].web
    if (webSocks) {
      const index = webSocks.indexOf(ws)
      if (index > -1) {
        webSocks.splice(index, 1)
      }
    }
    ws.close()

    wsCast(ws.user, 'io', 'connect lost')
  }

  ws.send('something from c9');
}

function onIoConnection(ws) {
  log.verbose('Io', 'onIoConnection()')

  ws
  .on('message', function incoming(message) {
    log.verbose('onIo', '%s, %s, recv msg: %s', message.length, typeof message, message)

    wsCast(ws.user, 'web', message)
    // const webSocks = userSocks[ws.user].web
    // if (webSocks) {
    //   webSocks.forEach(s => s.readyState === WebSocket.OPEN && s.send('IO[' + ws.user + ']: ' + message))
    // }

    console.log('reply roger')
    ws.send('roger')
  })
  .on('error', e => {
    console.log('error:' + e)
    wsCast(ws.user, 'web', 'event[error]: ' + e)
  })
  .on('close', e => {
    console.log('srv on close:' + e)
    ws.close()
    wsCast(ws.user, 'web', 'event[close]: ' + e)
  })

  ws.send('something from srv')

}

function wsCast(user, channel, msg) {
  log.verbose('wsCast', '%s, %s, %s', user, channel, msg)

  const socks = userSocks[user][channel]
  if (socks) {
    log.verbose('wsCast', 'found %d socks', socks.length)
    socks.forEach(s => {
      if (s.readyState === WebSocket.OPEN) {
        s.send(channel + '[' + user + ']: ' + msg)
      }
    })
  }
}


class SocketPool extends EventEmitter {
  constructor() {
    super()
    this.pool = []
  }

  add({
    sock
    , owner
    , protocol
  }) {
    sock.spMeta = {
      owner
      , protocol
    }
    this.pool.push(sock)
  }

  get({
    sock
    , owner
    , protocol
  } = {}) {

    if (!sock && !owner && !protocol) {
      return this.pool
    }

    else if (sock && !owner && !protocol) {
      return this.pool.filter(s => s === sock)
    } else if (protocol && !sock && !owner) {
      return this.pool.filter(s => s.spMeta.protocol === protocol)
    } else if (owner && !sock && !protocol) {
      return this.pool.filter(s => s.spMeta.owner === owner)
    }

    else if (owner && protocol && !sock) {
      return this.pool.filter(
        s =>
          s.spMeta.owner === owner
          && s.spMeta.protocol === protocol
      )
    }

    else {
      throw new Error('unsupported get call')
    }
  }

  del({
    sock
    , owner
    , protocol
  }) {
    const delList = this.get({sock, owner, protocol})
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_Operators#Bitwise_NOT
    this.pool = this.pool.filter(s => !~delList.indexOf(s))
  }
}