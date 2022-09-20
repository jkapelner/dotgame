'use strict';
const node = document.getElementById('app');
const app = Elm.Main.embed(node, {
    api: 'Client',
    hostname: '',
});

app.ports.startTimer.subscribe((int) => {
    setTimeout(() => {
        app.ports.timeout.send(int);
    }, 10000);
});

window.server.createGameServer(app, {x: 4, y: 4});
