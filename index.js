const http = require('http')
const request = require('request')
const {exec} = require('shelljs')
const {streams, port} = require('./config')
const R = require('ramda')
const os = require('os')
const vlcPaths = {
  darwin: '/Applications/VLC.app/Contents/MacOS/VLC -I rc',
  linux: 'cvlc'
}
const vlcBin = vlcPaths[os.platform()]
if(!vlcBin){
  return console.error('unsupported platform:', os.platform())
}

const vlcPortStart = 5000
const vlcCmd = (url, port) => `${vlcBin} ${url} --loop --repeat --http-reconnect --http-continuous --sout="#standard{mux=ts,access=http,dst=localhost:${port}}"`

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
    vlc.stdout.on('data', function(data) {
      console.log(vlc.pid, data)

      const stream = request(`http://localhost:${port}`)

      const onEnd = function(){
        console.log("onEnd", name)
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

    vlc.stdout.on('error', function(err) {
      console.log("err:", err)
      onEnd()
    })
  })
}

function handleRequest(req, res){
  const radio = req.url.slice(1)
  console.log('request:', radio)
  const streamIndex = streams.findIndex(({name}) => name === radio)
  if(streamIndex === -1){
    console.log('unknown radio', radio)
    return res.end()
  }
  clients[radio].push(res)

  if(vlcInstances.find(name => name === radio)){
    return
  }

  startVlc(streamIndex, streams[streamIndex])
}

const server = http.createServer(handleRequest)
server.listen(port, function(){
  console.log("Server listening on: http://localhost:%s", port)
})
