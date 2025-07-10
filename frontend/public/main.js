
function saveTeamName() {
  const name = document.getElementById('team-name').value.trim();
  if (!name) return;

  fetch('/api/teams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamName: name })
  })
  .then(res => res.json())
  .then(() => {
    localStorage.setItem('teamName', name);
    showMainApp();
  });
}

function showMainApp() {
  const teamName = localStorage.getItem('teamName');
  if (teamName) {
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    document.getElementById('team-display').textContent = teamName;
    fetchTeamsAndRender();
  }
}

function fetchTeamsAndRender() {
  fetch('/api/teams')
    .then(res => res.json())
    .then(teams => renderTeamsList(teams));
}

function renderTeamsList(teams) {
  const list = document.getElementById('teams-list');
  list.innerHTML = '';

  teams.forEach(team => {
    const li = document.createElement('li');
    li.innerHTML = `
      <strong>${team.teamName}</strong><br />
      Crediti: ${team.credits} <br />
      Giocatori: ${team.players.length}
    `;
    li.style.marginBottom = '1rem';
    list.appendChild(li);
  });
}

window.onload = showMainApp;
