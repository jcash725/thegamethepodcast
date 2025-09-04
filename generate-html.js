import { SleeperAPI } from './sleeper-api.js';
import fs from 'fs';
import path from 'path';

const USERNAME = 'thegamethepodcast';

async function getTopScorersForUserHTML(week = 1) {
  const api = new SleeperAPI();
  
  try {
    console.log(`🏈 Fetching Week ${week} top scorers for ${USERNAME}...\n`);
    
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
      
      const [users, matchups] = await Promise.all([
        api.getLeagueUsers(league.league_id),
        api.getWeekMatchups(league.league_id, week)
      ]);
      
      const userMap = users.reduce((acc, user) => {
        acc[user.user_id] = user;
        return acc;
      }, {});
      
      let topScore = 0;
      let topScorer = null;
      
      for (const matchup of matchups) {
        if (matchup.points > topScore) {
          topScore = matchup.points;
          topScorer = userMap[matchup.roster_id] ? userMap[matchup.roster_id] : { display_name: 'Unknown', user_id: matchup.roster_id };
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
      overallTopScorer: overallTopScorer?.display_name || 'Unknown',
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

function generateHTML(data) {
  const { week, userName, leagueResults, overallTopScorer, overallTopScore, overallTopLeague, totalLeagues, lastUpdated } = data;
  
  const leagueRows = leagueResults.map((league, index) => `
    <tr class="${index === 0 ? 'top-scorer' : ''}">
      <td>${index + 1}</td>
      <td>${league.leagueName}</td>
      <td>${league.topScorer}</td>
      <td class="points">${league.topScore}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Week ${week} Fantasy Scoreboard - ${userName}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
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
    
    .champion-card {
      background: linear-gradient(135deg, #FFD700, #FFA500);
      border-radius: 15px;
      padding: 30px;
      margin-bottom: 30px;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      color: #333;
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
    
    .champion-score {
      font-size: 3rem;
      font-weight: bold;
      color: #8B4513;
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
      background: #2c3e50;
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
      background: #34495e;
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
      color: #28a745;
      font-size: 1.1rem;
    }
    
    .top-scorer {
      background: linear-gradient(135deg, #FFD700, #FFA500) !important;
      font-weight: bold;
    }
    
    .top-scorer td {
      color: #333;
    }
    
    .footer {
      text-align: center;
      color: white;
      margin-top: 30px;
      opacity: 0.8;
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
    
    @media (max-width: 768px) {
      .header h1 {
        font-size: 2rem;
      }
      
      .champion-card {
        padding: 20px;
      }
      
      .champion-name {
        font-size: 2rem;
      }
      
      .champion-score {
        font-size: 2.5rem;
      }
      
      table {
        font-size: 0.9rem;
      }
      
      th, td {
        padding: 10px 8px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <h1>🏈 Fantasy Football Scoreboard</h1>
      <p>Week ${week} Results for ${userName}</p>
    </header>
    
    <div class="stats">
      <div class="stat-card">
        <div class="stat-value">${totalLeagues}</div>
        <div class="stat-label">Total Leagues</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${week}</div>
        <div class="stat-label">Week Number</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${overallTopScore > 0 ? overallTopScore : 'TBD'}</div>
        <div class="stat-label">Highest Score</div>
      </div>
    </div>
    
    ${overallTopScore > 0 ? `
    <div class="champion-card">
      <h2>🏆 Overall Champion</h2>
      <div class="champion-name">${overallTopScorer}</div>
      <div class="champion-score">${overallTopScore} pts</div>
      <div class="champion-league">from "${overallTopLeague}"</div>
    </div>
    ` : `
    <div class="champion-card">
      <h2>🏆 Overall Champion</h2>
      <div class="champion-name">Week ${week} hasn't started yet!</div>
      <div class="champion-league">Check back after games begin</div>
    </div>
    `}
    
    <div class="league-table">
      <div class="table-header">
        <h3>📊 League Leaderboard</h3>
      </div>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>League Name</th>
            <th>Top Scorer</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          ${leagueRows}
        </tbody>
      </table>
    </div>
    
    <footer class="footer">
      <p>Last updated: ${lastUpdated}</p>
      <p>Data powered by Sleeper API</p>
    </footer>
  </div>
</body>
</html>`;
}

async function main() {
  const week = process.argv[2] || 1;
  
  try {
    console.log(`Generating HTML for Week ${week}...`);
    
    const data = await getTopScorersForUserHTML(parseInt(week));
    const html = generateHTML(data);
    
    // Ensure docs directory exists
    if (!fs.existsSync('docs')) {
      fs.mkdirSync('docs', { recursive: true });
    }
    
    // Write HTML file
    fs.writeFileSync('docs/index.html', html);
    
    console.log('✅ HTML file generated successfully at docs/index.html');
    
  } catch (error) {
    console.error('❌ Error generating HTML:', error.message);
    process.exit(1);
  }
}

main();