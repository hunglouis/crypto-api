const WebSocket = require('ws');

function initWebSocket(server) {

  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {

    console.log('Client connected');

    const interval = setInterval(async () => {

      try {

        const res =
          await fetch(
            'http://localhost:3002/api/rates'
          );

        const data =
          await res.json();

        ws.send(
          JSON.stringify(data)
        );

      } catch (err) {

        console.log(err);

      }

    }, 5000);

    ws.on('close', () => {
      clearInterval(interval);
    });

  });

}

module.exports = {
  initWebSocket
};