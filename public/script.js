let teams = {};
let myTeamName = localStorage.getItem('teamName') || null;
let bestBid = 22;
let bestBidder = "Team 5";
let timer = 10;
let timerInterval = null;
let timerRunning = true;
let bidHistory = []; 

const socket = io();

fetchCurrentAuction();
renderHistory();

const input = document.getElementById('new-player');
const suggestions = document.getElementById('suggestions');

input.addEventListener('input', async () => {
  const q = input.value.trim();
  if (q.length < 2) {
    suggestions.style.display = 'none';
    return;
  }
  const res = await fetch(`/search-player?q=${encodeURIComponent(q)}`);
  const players = await res.json();

  suggestions.innerHTML = '';
  if (players.length === 0) {
    suggestions.style.display = 'none';
    return;
  }

  players.forEach(p => {
    const li = document.createElement('li');
    li.textContent = `${p.name} (${p.role})`;
    li.style.cursor = 'pointer';
    li.style.padding = '4px 8px';
    li.addEventListener('click', () => {
      input.value = p.name;
      suggestions.style.display = 'none';
    });
    suggestions.appendChild(li);
  });

  suggestions.style.display = 'block';
});

document.addEventListener('click', e => {
  if (e.target !== input) {
    suggestions.style.display = 'none';
  }
});

socket.on('auction-update', data => {
  const { player, playerRole, bestBid: newBid, bestBidder: newBidder } = data;

  const playerText = player === "—" ? "—" : `${player}${playerRole ? ` (${playerRole})` : ""}`;
  document.getElementById('current-player').textContent = playerText;

  const offerRow = document.getElementById('best-offer-row');
  offerRow.style.display = player === "—" ? "none" : "block";

  bestBid = newBid;
  bestBidder = newBidder;
  updateBidUI();
});

socket.on('history-update', data => {
  const list = document.getElementById('history');
  list.innerHTML = '';
  data.forEach(entry => {
    const li = document.createElement('li');
    li.textContent = `${entry.player} (${entry.role}) → ${entry.team} (${entry.price} cr)`;
    list.appendChild(li);
  });
});

socket.on('teams-update', data => {
  Object.assign(teams, data);
  renderTeams();
  renderMyPlayers();
});

function submitTeamName() {
  const input = document.getElementById('team-name-input');
  const name = input.value.trim();
  if (!name) return;

  fetch('/get-teams')
    .then(res => res.json())
    .then(data => {
      if (!data[name]) {
        data[name] = { credits: 100, players: [] };
        return fetch('/set-teams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      }
    })
    .then(() => {
      myTeamName = name;
      localStorage.setItem('teamName', myTeamName);
      showApp();
    });
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('main-app').style.display = 'block';

  // imposta titolo con il nome della squadra
  const titleEl = document.getElementById('my-team-title');
  if (titleEl && myTeamName) {
    titleEl.textContent = "La tua squadra - " + myTeamName;
  }

  renderTeams();
  renderMyPlayers();

  if (myTeamName === "U.S. Bi") {
    document.getElementById("admin-buttons").style.display = "block";
  }
}

function increaseBid(amount) {
  fetch('/get-teams')
    .then(res => res.json())
    .then(data => {
      const credits = data[myTeamName]?.credits ?? 0;
      if ((bestBid + amount) > credits) {
        alert("Non hai abbastanza crediti per offrire");
        return;
      }
      bidHistory.push({ team: bestBidder, amount: bestBid });
      bestBid += amount;
      bestBidder = myTeamName;
      updateBidUI();
      syncAuction();
    });
}

function submitBid() {
  const val = parseInt(document.getElementById('custom-bid').value);
  if (isNaN(val) || val <= bestBid) return;

  fetch('/get-teams')
    .then(res => res.json())
    .then(data => {
      const credits = data[myTeamName]?.credits ?? 0;
      if (val > credits) {
        alert("Non hai abbastanza crediti");
        return;
      }
      bidHistory.push({ team: bestBidder, amount: bestBid });
      bestBid = val;
      bestBidder = myTeamName;
      updateBidUI();
      syncAuction();
    });
    document.getElementById('custom-bid').value = ""; 
}

function undoLastBid() {
  fetch('/undo-bid', { method: 'POST' })
    .then(res => {
      if (!res.ok) throw new Error("Errore");
      return res.json();
    })
    .catch(err => {
      console.error("Errore nell'annullare l'offerta:", err);
      alert("Non è stato possibile annullare l'offerta.");
    });
}
function cancelAuction() {
  fetch('/cancel-auction', { method: 'POST' })
    .then(res => res.json())
    .then(() => {
      document.getElementById('current-player').textContent = "—";
      bestBid = 1;
      bestBidder = "Nessuno";
      updateBidUI();
    })
    .catch(err => console.error("Errore nel ritiro giocatore:", err));
}

function syncAuction() {
  const playerRaw = document.getElementById('current-player').textContent;
  const player = playerRaw.split(' (')[0]; // Rimuove il ruolo
  fetch('/update-auction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bestBid,
      bestBidder,
      player
    })
  }).catch(err => {
    console.error("Errore nel sync dell'asta:", err);
  });
}

function undoLastAssignment() {
  fetch('/undo-last-assignment', { method: 'POST' })
    .then(res => res.json())
    .then(() => {
      renderTeams();
      renderMyPlayers();
      renderHistory();
    })
    .catch(err => console.error("Errore nell'annullare l'assegnazione:", err));
}

function updateBidUI() {
  document.getElementById('best-bid').textContent = bestBid;
  document.getElementById('best-bidder').textContent = bestBidder;

  const offerRow = document.getElementById('best-offer-row');
  const currentPlayer = document.getElementById('current-player').textContent;

  offerRow.style.display = currentPlayer === "—" ? 'none' : 'block';
}

function callPlayer() {
  const player = document.getElementById('new-player').value.trim();
  if (player !== "") {
    document.getElementById('current-player').textContent = player;
    bestBid = 1;
    bestBidder = localStorage.getItem('teamName');
    updateBidUI();
    syncAuction();
  }
  document.getElementById('new-player').value = ""; 
}

function fetchCurrentAuction() {
  fetch('/current-auction')
    .then(res => res.json())
    .then(data => {
      bestBid = data.bestBid;
      bestBidder = data.bestBidder;

      const playerText = data.player === "—" ? "—" : `${data.player}${data.playerRole ? ` (${data.playerRole})` : ""}`;
      document.getElementById('current-player').textContent = playerText;

      updateBidUI();
    })
    .catch(err => console.error("Errore fetch currentAuction:", err));
}

function endAuction() {
  const player = document.getElementById('current-player').textContent;

  fetch('/finalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teamName: bestBidder,
      player: player,
      price: bestBid
    })
  })
    .then(res => res.json())
    .then(result => {
      if (result.error) {
        alert("Errore: " + result.error);
        return;
      }

      renderTeams();
      renderMyPlayers();
      renderHistory();

      bidHistory = [];
      document.getElementById('current-player').textContent = "—";
      bestBid = 1;
      bestBidder = "Nessuno";
      updateBidUI();
    })
    .catch(err => {
      console.error("Errore nella richiesta /finalize:", err);
    });
}

function showTimerEffect(value) {
  const display = document.getElementById("timer-display");
  display.textContent = value;
  display.style.animation = 'none';
  display.offsetHeight;
  display.style.animation = null;
}

function startTimer() {
  stopTimer(); // evita timer multipli
  timerRunning = true;
  timer = 10; // o il valore che vuoi resettare ogni volta
  timerInterval = setInterval(() => {
    if (!timerRunning) return;
    if (timer <= 0) {
      showTimerEffect("🛎");
      clearInterval(timerInterval);
      return;
    }
    showTimerEffect(timer);
    timer--;
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
}

function toggleTimer() {
  startTimer();
  timerRunning = !timerRunning;
}

function deleteTeam(teamName) {
  if (!confirm(`Sei sicuro di voler eliminare la squadra "${teamName}"?`)) return;

  fetch('/delete-team', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamName })
  })
    .then(res => res.json())
    .then(result => {
      if (result.ok) {
        alert(`Squadra "${teamName}" eliminata.`);
        renderTeams();
        renderMyPlayers();
      } else {
        alert("Errore: " + result.error);
      }
    })
    .catch(err => console.error("Errore durante l'eliminazione squadra:", err));
}

function renderTeams() {
  fetch('/get-teams')
    .then(res => res.json())
    .then(data => {
      const ul = document.querySelector('.teams');
      ul.innerHTML = '';
      for (const team in data) {
        const { credits, players } = data[team];
        const li = document.createElement('li');
        li.innerHTML = `
          ${team} - ${credits} cr - ${players.length} giocatori
          <button class="delete-btn" onclick="deleteTeam('${team}')">❌</button>
        `;
        ul.appendChild(li);
      }
    });
}

function renderMyPlayers() {
  const ul = document.querySelector('.players');
  ul.innerHTML = '';

  if (!myTeamName || !teams[myTeamName] || !Array.isArray(teams[myTeamName].players)) return;

  teams[myTeamName].players.forEach(player => {
    const li = document.createElement('li');
    if (typeof player === 'string') {
      li.textContent = player;
    } else {
      const priceText = player.price ? ` - ${player.price} cr` : '';
      li.textContent = `${player.name} (${player.role})${priceText}`;
    }
    ul.appendChild(li);
  });
}

function renderHistory() {
  fetch('/history')
    .then(res => res.json())
    .then(data => {
      const list = document.getElementById('history');
      list.innerHTML = '';
      data.forEach(entry => {
        const li = document.createElement('li');
        li.textContent = `${entry.player} (${entry.role}) → ${entry.team} (${entry.price} cr)`;
        list.appendChild(li);
      });
    })
    .catch(err => console.error("Errore nel recupero dello storico:", err));
}

window.onload = () => {
  const savedName = localStorage.getItem('teamName');
  if (savedName && savedName.trim().length > 0) {
    myTeamName = savedName;
    showApp();
  } else {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';
  }
};
