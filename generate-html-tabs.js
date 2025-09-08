import { SleeperAPI } from './sleeper-api.js';
import fs from 'fs';
import path from 'path';

const USERNAME = 'thegamethepodcast';
const DATA_FILE = 'docs/weekly-data.json';

async function getTopScorersForWeek(week = 1) {
  const api = new SleeperAPI();
  
  try {
    console.log(`🏈 Fetching Week ${week} top scorers for ${USERNAME}...`);
    
    const user = await api.getUser(USERNAME);
    console.log(`Found user: ${user.display_name} (ID: ${user.user_id})`);
    
    const leagues = await api.getUserLeagues(user.user_id);
    console.log(`Found ${leagues.length} leagues\n`);
    
    const leagueResults = [];
    let overallTopScore = 0;
    let overallTopScorer = null;
    let overallTopLeague = null;

    for (const league of leagues) {
      console.log(`Processing league: ${league.name}`);
      
      await api.delay(100);
      
      const [users, rosters, matchups] = await Promise.all([
        api.getLeagueUsers(league.league_id),
        api.getLeagueRosters(league.league_id),
        api.getWeekMatchups(league.league_id, week)
      ]);
      
      // Create user map: user_id -> user
      const userMap = users.reduce((acc, user) => {
        acc[user.user_id] = user;
        return acc;
      }, {});
      
      // Create roster map: roster_id -> owner_id
      const rosterMap = rosters.reduce((acc, roster) => {
        acc[roster.roster_id] = roster.owner_id;
        return acc;
      }, {});
      
      let topScore = 0;
      let topScorer = null;
      
      for (const matchup of matchups) {
        if (matchup.points > topScore) {
          topScore = matchup.points;
          const ownerId = rosterMap[matchup.roster_id];
          const user = ownerId && userMap[ownerId] ? userMap[ownerId] : { display_name: 'Unknown', user_id: matchup.roster_id };
          const teamName = user?.metadata?.team_name || user?.display_name || 'No Team Name';
          
          topScorer = {
            ...user,
            teamName: teamName
          };
        }
      }
      
      if (topScore > overallTopScore) {
        overallTopScore = topScore;
        overallTopScorer = topScorer;
        overallTopLeague = league.name;
      }
      
      leagueResults.push({
        leagueName: league.name,
        topScorer: topScorer?.display_name || 'Unknown',
        teamName: topScorer?.teamName || 'No Team Name',
        topScore: topScore
      });
      
      console.log(`  Top scorer: ${topScorer?.display_name || 'Unknown'} with ${topScore} points`);
      await api.delay(100);
    }
    
    // Sort leagues by top score descending
    leagueResults.sort((a, b) => b.topScore - a.topScore);
    
    return {
      week,
      userName: user.display_name,
      leagueResults,
      overallTopScorer: {
        display_name: overallTopScorer?.display_name || 'Unknown',
        teamName: overallTopScorer?.metadata?.team_name || overallTopScorer?.display_name || 'No Team Name'
      },
      overallTopScore,
      overallTopLeague,
      totalLeagues: leagues.length,
      lastUpdated: new Date().toLocaleString()
    };
    
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

function loadExistingData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.log('No existing data found, starting fresh');
  }
  return { weeks: {}, lastUpdated: new Date().toLocaleString() };
}

function saveWeeklyData(allData) {
  // Ensure docs directory exists
  if (!fs.existsSync('docs')) {
    fs.mkdirSync('docs', { recursive: true });
  }
  
  fs.writeFileSync(DATA_FILE, JSON.stringify(allData, null, 2));
}

function generateTabbedHTML(allData) {
  const weeks = Object.keys(allData.weeks).sort((a, b) => parseInt(a) - parseInt(b));
  const latestWeek = weeks[weeks.length - 1] || '1';
  const latestData = allData.weeks[latestWeek];
  
  // Generate tab headers
  const tabHeaders = weeks.map(week => 
    `<button class="tab-button ${week === latestWeek ? 'active' : ''}" onclick="showWeek(${week})">Week ${week}</button>`
  ).join('');
  
  // Generate tab content
  const tabContent = weeks.map(week => {
    const weekData = allData.weeks[week];
    const isActive = week === latestWeek;
    
    const leagueRows = weekData.leagueResults.map((league, index) => `
      <tr class="${index === 0 ? 'top-scorer' : ''}">
        <td>${index + 1}</td>
        <td>${league.leagueName}</td>
        <td>
          <div class="scorer-info">
            <div class="team-name">${league.teamName}</div>
            <div class="username">@${league.topScorer}</div>
          </div>
        </td>
        <td class="points">${league.topScore}</td>
      </tr>
    `).join('');

    // Generate mobile cards
    const mobileCards = weekData.leagueResults.map((league, index) => `
      <div class="league-card ${index === 0 ? 'top-scorer' : ''}">
        <div class="league-info">
          <div class="league-rank">#${index + 1}</div>
          <div class="league-name-mobile">${league.leagueName}</div>
          <div class="team-info-mobile">
            <div class="team-name-mobile">${league.teamName}</div>
            <div class="username-mobile">@${league.topScorer}</div>
          </div>
        </div>
        <div class="points-mobile">${league.topScore}</div>
      </div>
    `).join('');

    return `
      <div id="week${week}" class="tab-content ${isActive ? 'active' : ''}">
        <div class="stats">
          <div class="stat-card">
            <div class="stat-value">${weekData.totalLeagues}</div>
            <div class="stat-label">Total Leagues</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${week}</div>
            <div class="stat-label">Week Number</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${weekData.overallTopScore > 0 ? weekData.overallTopScore : 'TBD'}</div>
            <div class="stat-label">Highest Score</div>
          </div>
        </div>
        
        ${weekData.overallTopScore > 0 ? `
        <div class="champion-card">
          <h2>🏆 Week ${week} Champion</h2>
          <div class="champion-name">${weekData.overallTopScorer?.teamName || weekData.overallTopScorer?.display_name || 'No Team Name'}</div>
          <div class="champion-username">@${weekData.overallTopScorer?.display_name || weekData.overallTopScorer}</div>
          <div class="champion-score">${weekData.overallTopScore} pts</div>
          <div class="champion-league">from "${weekData.overallTopLeague}"</div>
        </div>
        ` : `
        <div class="champion-card">
          <h2>🏆 Week ${week} Champion</h2>
          <div class="champion-name">Week ${week} hasn't started yet!</div>
          <div class="champion-league">Check back after games begin</div>
        </div>
        `}
        
        <div class="league-table">
          <div class="table-header">
            <h3>📊 Week ${week} League Leaderboard</h3>
          </div>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>League Name</th>
                  <th>Team & Owner</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                ${leagueRows}
              </tbody>
            </table>
          </div>
        </div>
        
        <div class="mobile-league-list">
          <div class="table-header">
            <h3>📊 Week ${week} League Leaderboard</h3>
          </div>
          ${mobileCards}
        </div>
        
        <div class="week-updated">
          <p>Week ${week} updated: ${weekData.lastUpdated}</p>
        </div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fantasy Scoreboard - ${latestData?.userName || USERNAME}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a365d 0%, #2d4a66 100%);
      min-height: 100vh;
      color: #333;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .header {
      text-align: center;
      color: white;
      margin-bottom: 30px;
    }
    
    .header h1 {
      font-size: 3rem;
      margin-bottom: 10px;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }
    
    .header p {
      font-size: 1.2rem;
      opacity: 0.9;
    }
    
    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-bottom: 20px;
      background: rgba(255, 255, 255, 0.1);
      padding: 10px;
      border-radius: 10px;
      backdrop-filter: blur(10px);
    }
    
    .tab-button {
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 600;
      transition: all 0.3s ease;
      backdrop-filter: blur(5px);
    }
    
    .tab-button:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: translateY(-2px);
    }
    
    .tab-button.active {
      background: linear-gradient(135deg, #DC143C, #B91C1C);
      color: white;
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(220, 20, 60, 0.4);
    }
    
    .tab-content {
      display: none;
    }
    
    .tab-content.active {
      display: block;
      animation: fadeIn 0.3s ease-in-out;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .champion-card {
      background: linear-gradient(135deg, #DC143C, #B91C1C);
      border-radius: 15px;
      padding: 30px;
      margin-bottom: 30px;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      color: white;
    }
    
    .champion-card h2 {
      font-size: 2rem;
      margin-bottom: 15px;
    }
    
    .champion-name {
      font-size: 2.5rem;
      font-weight: bold;
      margin: 10px 0;
    }
    
    .champion-username {
      font-size: 1.2rem;
      opacity: 0.9;
      margin-bottom: 15px;
    }
    
    .champion-score {
      font-size: 3rem;
      font-weight: bold;
      color: #F7FAFC;
    }
    
    .champion-league {
      font-size: 1.2rem;
      margin-top: 10px;
      opacity: 0.8;
    }
    
    .league-table {
      background: white;
      border-radius: 15px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.1);
      margin-bottom: 30px;
    }
    
    .table-header {
      background: #1a365d;
      color: white;
      padding: 20px;
      text-align: center;
    }
    
    .table-header h3 {
      font-size: 1.5rem;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
    }
    
    thead {
      background: #2d4a66;
      color: white;
    }
    
    th {
      padding: 15px;
      text-align: left;
      font-weight: 600;
    }
    
    th:last-child, td:last-child {
      text-align: center;
    }
    
    tbody tr:nth-child(even) {
      background: #f8f9fa;
    }
    
    tbody tr:hover {
      background: #e9ecef;
      transition: background 0.3s ease;
    }
    
    td {
      padding: 12px 15px;
      border-bottom: 1px solid #dee2e6;
    }
    
    .points {
      font-weight: bold;
      color: #DC143C;
      font-size: 1.1rem;
    }
    
    .top-scorer {
      background: linear-gradient(135deg, #DC143C, #B91C1C) !important;
      font-weight: bold;
    }
    
    .top-scorer td {
      color: white;
    }
    
    .scorer-info {
      text-align: left;
    }
    
    .team-name {
      font-weight: bold;
      font-size: 1rem;
      margin-bottom: 2px;
    }
    
    .username {
      font-size: 0.85rem;
      opacity: 0.8;
      color: #666;
    }
    
    .top-scorer .username {
      color: rgba(255, 255, 255, 0.8);
    }
    
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .stat-card {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 10px;
      padding: 20px;
      text-align: center;
      color: white;
    }
    
    .stat-value {
      font-size: 2rem;
      font-weight: bold;
      margin-bottom: 5px;
    }
    
    .stat-label {
      font-size: 0.9rem;
      opacity: 0.8;
    }
    
    .week-updated {
      text-align: center;
      color: white;
      opacity: 0.8;
      font-size: 0.9rem;
      margin-top: 20px;
    }
    
    .footer {
      text-align: center;
      color: white;
      margin-top: 30px;
      opacity: 0.8;
    }
    
    /* Mobile card-based layout */
    .mobile-league-list {
      display: none;
    }
    
    .league-card {
      background: white;
      border-radius: 10px;
      margin-bottom: 15px;
      padding: 15px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .league-info {
      flex: 1;
    }
    
    .league-rank {
      font-size: 1.2rem;
      font-weight: bold;
      color: #DC143C;
      margin-bottom: 5px;
    }
    
    .league-name-mobile {
      font-size: 1rem;
      font-weight: 600;
      color: #1a365d;
      margin-bottom: 8px;
    }
    
    .team-info-mobile {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    
    .team-name-mobile {
      font-size: 0.9rem;
      font-weight: bold;
      color: #333;
    }
    
    .username-mobile {
      font-size: 0.8rem;
      color: #666;
    }
    
    .points-mobile {
      font-size: 1.4rem;
      font-weight: bold;
      color: #DC143C;
      text-align: right;
      flex-shrink: 0;
      margin-left: 15px;
    }
    
    .league-card.top-scorer {
      background: linear-gradient(135deg, #DC143C, #B91C1C);
    }
    
    .league-card.top-scorer .league-rank,
    .league-card.top-scorer .league-name-mobile,
    .league-card.top-scorer .team-name-mobile,
    .league-card.top-scorer .points-mobile {
      color: white;
    }
    
    .league-card.top-scorer .username-mobile {
      color: rgba(255, 255, 255, 0.8);
    }
    
    @media (max-width: 768px) {
      .container {
        padding: 15px;
      }
      
      .header h1 {
        font-size: 2.2rem;
      }
      
      .header p {
        font-size: 1rem;
      }
      
      .tabs {
        justify-content: flex-start;
        overflow-x: auto;
        scrollbar-width: thin;
        -webkit-overflow-scrolling: touch;
        padding-bottom: 5px;
      }
      
      .tabs::-webkit-scrollbar {
        height: 4px;
      }
      
      .tabs::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.1);
      }
      
      .tabs::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 2px;
      }
      
      .tab-button {
        padding: 12px 20px;
        font-size: 0.95rem;
        flex-shrink: 0;
        min-width: 80px;
      }
      
      .stats {
        grid-template-columns: 1fr;
        gap: 15px;
      }
      
      .champion-card {
        padding: 20px 15px;
      }
      
      .champion-name {
        font-size: 1.8rem;
      }
      
      .champion-username {
        font-size: 1rem;
      }
      
      .champion-score {
        font-size: 2.2rem;
      }
      
      .champion-league {
        font-size: 1rem;
      }
      
      /* Hide desktop table and show mobile cards */
      .league-table {
        display: none;
      }
      
      .mobile-league-list {
        display: block;
      }
      
      .week-updated {
        font-size: 0.85rem;
        margin-top: 15px;
      }
      
      .footer {
        margin-top: 20px;
        font-size: 0.85rem;
      }
    }
    
    @media (max-width: 480px) {
      .container {
        padding: 10px;
      }
      
      .header h1 {
        font-size: 1.8rem;
      }
      
      .champion-card {
        padding: 15px 10px;
      }
      
      .champion-name {
        font-size: 1.5rem;
      }
      
      .champion-score {
        font-size: 2rem;
      }
      
      .stats {
        gap: 10px;
      }
      
      .stat-card {
        padding: 15px 10px;
      }
      
      .stat-value {
        font-size: 1.5rem;
      }
      
      table {
        min-width: 550px;
        font-size: 0.8rem;
      }
      
      th, td {
        padding: 6px 4px;
      }
      
      .team-name {
        font-size: 0.85rem;
      }
      
      .username {
        font-size: 0.7rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <h1>🏈 Fantasy Football Scoreboard</h1>
      <p>Season Results for ${latestData?.userName || USERNAME}</p>
    </header>
    
    <div class="tabs">
      ${tabHeaders}
    </div>
    
    ${tabContent}
    
    <footer class="footer">
      <p>Data powered by Sleeper API</p>
      <p>Last site update: ${allData.lastUpdated}</p>
    </footer>
  </div>

  <script>
    function showWeek(week) {
      // Hide all tab contents
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      
      // Remove active class from all tab buttons
      document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
      });
      
      // Show selected week content
      document.getElementById('week' + week).classList.add('active');
      
      // Add active class to selected tab button
      event.target.classList.add('active');
    }
  </script>
</body>
</html>`;
}

async function main() {
  const week = parseInt(process.argv[2]) || 1;
  
  try {
    console.log(`Generating tabbed HTML for Week ${week}...`);
    
    // Load existing data
    const allData = loadExistingData();
    
    // Fetch new week data
    const weekData = await getTopScorersForWeek(week);
    
    // Add/update the week data
    allData.weeks[week] = weekData;
    allData.lastUpdated = new Date().toLocaleString();
    
    // Save updated data
    saveWeeklyData(allData);
    
    // Generate HTML
    const html = generateTabbedHTML(allData);
    
    // Write HTML file
    fs.writeFileSync('docs/index.html', html);
    
    console.log(`✅ HTML file updated with Week ${week} data at docs/index.html`);
    console.log(`📊 Total weeks tracked: ${Object.keys(allData.weeks).length}`);
    
  } catch (error) {
    console.error('❌ Error generating HTML:', error.message);
    process.exit(1);
  }
}

main();