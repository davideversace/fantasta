const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let giocatoreInAsta = null;
let offertaAttuale = 0;
let offerente = null;

io.on("connection", (socket) => {
  console.log("Utente connesso:", socket.id);

  socket.on("chiamaGiocatore", (nomeGiocatore) => {
    giocatoreInAsta = nomeGiocatore;
    offertaAttuale = 0;
    offerente = null;
    io.emit("nuovaAsta", { giocatore: giocatoreInAsta });
  });

  socket.on("faiOfferta", (dati) => {
    if (dati.offerta > offertaAttuale) {
      offertaAttuale = dati.offerta;
      offerente = dati.nome;
      io.emit("nuovaOfferta", { offerta: offertaAttuale, nome: offerente });
    }
  });

  socket.on("disconnect", () => {
    console.log("Utente disconnesso:", socket.id);
  });
});

server.listen(3000, () => {
  console.log("Server attivo su http://localhost:3000");
});
