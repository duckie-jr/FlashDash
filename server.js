const { PeerServer } = require('peer');

const port = parseInt(process.env.PORT) || 9000;

const server = PeerServer({ port, path: '/peerjs' });

server.on('connection', (client) => {
  console.log('connected:', client.getId());
});

console.log('PeerJS server running on port', port);
