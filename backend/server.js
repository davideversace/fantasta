
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

const PORT = 3000;
const TEAMS_FILE = path.join(__dirname, 'data', 'teams.json');

app.use(express.static(path.join(__dirname, '../frontend/public')));
app.use(express.json());

// Ritorna tutte le squadre
app.get('/api/teams', (req, res) => {
  const teams = JSON.parse(fs.readFileSync(TEAMS_FILE));
  res.json(teams);
});

// Aggiunge una squadra se non esiste già
app.post('/api/teams', (req, res) => {
  const { teamName } = req.body;
  if (!teamName) return res.status(400).json({ error: 'Nome squadra richiesto' });

  let teams = JSON.parse(fs.readFileSync(TEAMS_FILE));
  const exists = teams.find(t => t.teamName === teamName);

  if (!exists) {
    const newTeam = {
      teamName,
      credits: 750,
      players: []
    };
    teams.push(newTeam);
    fs.writeFileSync(TEAMS_FILE, JSON.stringify(teams, null, 2));
    console.log(`Squadra aggiunta: ${teamName}`);
  }

  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server avviato su http://localhost:${PORT}`);
});
