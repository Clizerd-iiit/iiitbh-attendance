const http = require('http');
const net = require('net');
const url = require('url');

const proxy = http.createServer();
proxy.on('connect', (req, clientSocket, head) => {
  const { port, hostname } = url.parse(`//${req.url}`, false, true);
  const targetHost = hostname === 'github.com' ? '20.207.73.82' : hostname;
  
  const serverSocket = net.connect(port || 443, targetHost, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    serverSocket.write(head);
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);
  });
  serverSocket.on('error', (err) => {
    console.error(err);
    clientSocket.end();
  });
  clientSocket.on('error', (err) => {
    console.error(err);
    serverSocket.end();
  });
});
proxy.listen(8080, () => console.log('Proxy running on 8080'));
