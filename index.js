const http = require('http')
const request = require('request')
const {exec} = require('shelljs')
const {streams, serverPort} = require('./config')
const R = require('ramda')
const os = require('os')
const vlcPaths = {
  darwin: '/Applications/VLC.app/Contents/MacOS/VLC',
  linux: 'vlc'
}
const vlcBin = vlcPaths[os.platform()]
if(!vlcBin){
  return console.error('unsupported platform:', os.platform())
}

const vlcPortStart = 5000
const vlcCmd = (url, port) => `${vlcBin} -I rc ${url} --loop --repeat --http-reconnect --http-continuous --sout="#standard{mux=ts,access=http,dst=localhost:${port}}"`

var vlcInstances = []
var clients = streams.reduce((acc, cur) => R.assoc(cur.name, [], acc), {})

function getPort(port, cb){
  exec(`lsof -n -i4TCP:${port} | grep LISTEN`, function(code, stdout) {
    return stdout.length > 0 ? getPort(port + 1, cb) : cb(port)
  })
}

function startVlc(index, {name, url}){
  getPort(vlcPortStart, port => {
    console.log('starting vlc', name, port)
    vlcInstances.push(name)
    const vlc = exec(vlcCmd(url, port), {async: true})
    vlc.stdout.once('data', function(data) {
      console.log("vlc pid:", vlc.pid)

      const stream = request(`http://localhost:${port}`)

      const onEnd = function(){
        console.log("onEnd", name, vlc.pid)
        while(res = clients[name].shift()){
          res.end()
        }
        stream.removeListener('end', onEnd)
        exec(`kill -9 ${vlc.pid}`, {silent: true})
        vlcInstances.splice(vlcInstances.findIndex(item => item === name), 1)
      }

      var timeoutId
      const onData = function(){
        clearTimeout(timeoutId)
        timeoutId = setTimeout(onEnd, 10000)
      }
      onData()

      //TODO drop individual connections if they are not receiving any data
      stream
        .on('data', chunk => clients[name].map(res => res.write(chunk, onData)))
        .on('end', onEnd)
    })
  })
}

function getPlaylist(){
  return R.pipe(
    R.chain(({name}) => [`#EXTINF:0,${name}`, `http://localhost:${serverPort}/${name}`]),
    R.prepend('#EXTM3U'),
    R.join('\n')
  )(streams)
}

function handleStream(res, path){
  const streamIndex = streams.findIndex(({name}) => name === path)
  if(streamIndex === -1){
    console.log('unknown radio', path)
    return res.end()
  }
  clients[path].push(res)

  if(vlcInstances.find(name => name === path)){
    return
  }

  startVlc(streamIndex, streams[streamIndex])
}

function handlePlaylist(res){
  res.writeHead(200, {'Content-Type': 'application/x-mpegurl'})
  return res.end(getPlaylist())
}

function handleRequest(req, res){
  const path = req.url.slice(1)
  console.log('request:', path)

  return path === 'playlist.m3u8' ? handlePlaylist(res) : handleStream(res, path)
}

const server = http.createServer(handleRequest)

server.listen(serverPort, function(){
  console.log("Server listening on: http://localhost:%s", serverPort)
})
