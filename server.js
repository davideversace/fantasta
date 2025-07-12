const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const XLSX = require('xlsx');
const http = require('http');
const { Server } = require('socket.io');
const playersList = require('./players.json');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

let teams = {};
let history = [];
let currentAuction = {
  player: "—",
  playerRole: "",
  bestBid: 1,
  bestBidder: "Nessuno"
};
let bidHistory = [];

// -- SOCKET.IO SETUP --
const httpServer = http.createServer(app);
const io = new Server(httpServer);
httpServer.listen(port, () => {
  console.log(`✅ Server avviato su http://localhost:${port}`);
});
io.on('connection', socket => {
  console.log("🔌 Nuovo client connesso");
  socket.emit('auction-update', currentAuction);
  socket.emit('history-update', history);
  socket.emit('teams-update', teams);
});

// -- ENDPOINTS --

app.get('/search-player', (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  const results = playersList.filter(p => p.name.toLowerCase().startsWith(q)).slice(0, 10);
  res.json(results);
});

app.post('/update-auction', (req, res) => {
  const { bestBid, bestBidder, player } = req.body;
  const found = playersList.find(x => x.name === player);
  bidHistory.push({ bestBid: currentAuction.bestBid, bestBidder: currentAuction.bestBidder });
  currentAuction = {
    player,
    playerRole: found ? found.role : "",
    bestBid,
    bestBidder
  };
  io.emit('auction-update', currentAuction);
  res.json({ ok: true });
});

app.get('/current-auction', (req, res) => {
  res.json(currentAuction);
});

app.post('/finalize', (req, res) => {
  const { player, bestBidder, bestBid, playerRole } = currentAuction;

  if (!teams[bestBidder]) return res.status(400).json({ error: `Squadra '${bestBidder}' non trovata` });
  if (teams[bestBidder].credits < bestBid) return res.status(400).json({ error: "Crediti insufficienti" });

  teams[bestBidder].credits -= bestBid;
  teams[bestBidder].players.push({ name: player, role: playerRole, price: bestBid });
  history.unshift({ player, role: playerRole, team: bestBidder, price: bestBid });
  if (history.length > 10) history.pop();

  currentAuction = { player: "—", playerRole: "", bestBid: 1, bestBidder: "Nessuno" };

  io.emit('teams-update', teams);
  io.emit('history-update', history);
  io.emit('auction-update', currentAuction);
  res.json({ ok: true });
});

app.post('/undo-last-assignment', (req, res) => {
  const last = history.shift();
  if (!last) return res.status(400).json({ error: "Nessuna assegnazione da annullare" });

  const team = teams[last.team];
  if (!team) return res.status(400).json({ error: `Squadra ${last.team} non trovata` });

  team.credits += last.price;
  team.players = team.players.filter(p => p.name !== last.player);

  io.emit('teams-update', teams);
  io.emit('history-update', history);
  res.json({ ok: true });
});

app.post('/cancel-auction', (req, res) => {
  currentAuction = {
    player: "—",
    playerRole: "",
    bestBid: 1,
    bestBidder: "Nessuno"
  };
  io.emit('auction-update', currentAuction);
  res.json({ ok: true });
});

app.post('/set-teams', (req, res) => {
    teams = req.body;
    console.log("Teams aggiornati:", teams);
    io.emit('teams-update', teams); // 🔥 aggiornamento live a tutti i client
    res.json({ ok: true });
  });

app.post('/delete-team', (req, res) => {
    const { teamName } = req.body;
    if (!teams[teamName]) {
      return res.status(400).json({ error: "Squadra non trovata" });
    }
  
    delete teams[teamName];
    console.log(`🗑 Squadra eliminata: ${teamName}`);
  
    io.emit('teams-update', teams);
    res.json({ ok: true });
  });

app.get('/get-teams', (req, res) => {
  res.json(teams);
});

app.post('/new-player', (req, res) => {
  const name = req.body.name;
  const found = playersList.find(p => p.name === name);
  currentAuction = {
    player: name,
    playerRole: found ? found.role : "",
    bestBid: 1,
    bestBidder: req.body.caller || "Nessuno"
  };
  io.emit('auction-update', currentAuction);
  res.json({ ok: true });
});

app.post('/undo-bid', (req, res) => {
    if (bidHistory.length === 0) {
      return res.status(400).json({ error: "Nessuna offerta da annullare" });
    }
  
    const last = bidHistory.pop();
    currentAuction.bestBid = last.bestBid;
    currentAuction.bestBidder = last.bestBidder;
  
    io.emit('auction-update', currentAuction);
    res.json({ ok: true });
  });



app.post('/bid', (req, res) => {
  const { team, amount } = req.body;

  if (!teams[team]) return res.status(400).json({ error: "Squadra non trovata" });
  if (teams[team].credits < amount) return res.status(400).json({ error: "Crediti insufficienti" });

  bidHistory.push({ bestBid: currentAuction.bestBid, bestBidder: currentAuction.bestBidder });

  currentAuction.bestBid = amount;
  currentAuction.bestBidder = team;

  io.emit('auction-update', currentAuction);
  res.json({ ok: true });
});

app.get('/history', (req, res) => {
  res.json(history);
});

app.get('/export', (req, res) => {
  const rows = [];
  for (const [team, data] of Object.entries(teams)) {
    data.players.forEach(player => {
      rows.push({ Team: team, Player: `${player.name} (${player.role})`, Credits: data.credits });
    });
  }

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Asta');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', 'attachment; filename=risultati.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});
