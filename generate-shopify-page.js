import fs from 'fs';
import { SleeperAPI } from './sleeper-api.js';

const USERNAME = 'thegamethepodcast';

// Load existing data if available
function loadWeeklyData() {
  try {
    const data = fs.readFileSync('docs/weekly-data.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log('No existing weekly data found, will fetch fresh data');
    return { weeks: {}, leagueFlexSettings: {}, seasonLeaders: { allUsers: [], oneFlexUsers: [], twoFlexUsers: [] } };
  }
}

function generateShopifyHTML(seasonLeaders) {
  // Get top 10 for each category
  const top10OneFlexUsers = seasonLeaders.oneFlexUsers.slice(0, 10);
  const top10TwoFlexUsers = seasonLeaders.twoFlexUsers.slice(0, 10);

  // Generate 1-flex leaderboard
  const oneFlexRows = top10OneFlexUsers.map((user, index) => `
    <tr>
      <td><div class="rank-circle">${index + 1}</div></td>
      <td class="team-cell">
        <div class="team-name">${user.teamName}</div>
        <div class="username">@${user.topScorer}</div>
      </td>
      <td class="league-cell">
        <div class="league-name">${user.leagueName}</div>
      </td>
      <td class="points-cell">
        <div class="total-points">${user.totalPoints.toFixed(2)}</div>
      </td>
    </tr>
  `).join('');

  // Generate 2-flex leaderboard
  const twoFlexRows = top10TwoFlexUsers.map((user, index) => `
    <tr>
      <td><div class="rank-circle">${index + 1}</div></td>
      <td class="team-cell">
        <div class="team-name">${user.teamName}</div>
        <div class="username">@${user.topScorer}</div>
      </td>
      <td class="league-cell">
        <div class="league-name">${user.leagueName}</div>
      </td>
      <td class="points-cell">
        <div class="total-points">${user.totalPoints.toFixed(1)}</div>
      </td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Game - Leaderboard</title>
  <style>
    /* ==========================================================================
       FONT FACE
       ========================================================================== */
    @font-face {
      font-family: 'The Game';
      src: url('The GAME FONT REGULAR.woff2') format('woff2'),
           url('The GAME FONT REGULAR.woff') format('woff'),
           url('The GAME FONT.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }
    
    /* ==========================================================================
       RESET & GLOBAL STYLES
       ========================================================================== */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: Montserrat, 'Arial Black', sans-serif;
      background: url('thegame-field-bg.png') center center / cover no-repeat;
      min-height: 100vh;
      color: #333;
      position: relative;
      overflow-x: hidden;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    
    /* ==========================================================================
       HEADER & IMAGES
       ========================================================================== */
    .top-image-container {
      text-align: center;
      position: relative;
    }
    
    .top-image {
      max-width: 100%;
      height: auto;
      max-height: 300px;
    }
    
    .header {
      text-align: center;
      color: white;
      padding: 20px 0;
    }
    
    .season-title {
      font-family: 'The Game', 'Bebas Neue', 'Arial Black', sans-serif;
      font-size: 5rem;
      font-weight: 400;
      text-transform: uppercase;
      color: #1a365d;
      margin-bottom: 40px;
    }
    
    /* ==========================================================================
       TABS
       ========================================================================== */
    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-bottom: 20px;
      background: rgba(255, 255, 255, 0.1);
      padding: 10px;
      border-radius: 10px;
      backdrop-filter: blur(10px);
      justify-content: center;
    }
    
    .tab-button {
      background: #1a365d;
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 600;
      transition: all 0.3s ease;
      text-transform: uppercase;
    }
    
    .tab-button:hover {
      background: #2d4a66;
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
    
    /* ==========================================================================
       TABLE STRUCTURE
       ========================================================================== */
    .league-table {
      margin-bottom: 30px;
    }
    
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
    }
    
    thead {
      background: transparent;
      color: #1a365d;
    }
    
    th {
      font-family: 'The Game', 'Bebas Neue', 'Arial Black', sans-serif;
      text-align: left;
      font-weight: 400;
      font-size: 2rem;
      text-transform: uppercase;
      color: #DC143C;
    }
    
    th:first-child {
      width: 80px;
      text-align: center;
    }
    
    th:nth-child(3) {
      text-align: left;
      width: 200px;
    }
    
    th:last-child {
      text-align: center;
      width: 120px;
    }
    
    tbody tr {
      background: transparent;
      border-bottom: 1px solid rgba(26, 54, 93, 0.1);
      transition: all 0.3s ease;
    }
    
    tbody tr:hover {
      background: rgba(255,255,255,0.1);
      transform: scale(1.02);
      box-shadow: 0 5px 15px rgba(0,0,0,0.1);
    }
    
    /* ==========================================================================
       TABLE CELLS & OCTAGONS
       ========================================================================== */
    td {
      vertical-align: middle;
      position: relative;
      padding: 20px 15px;
      border: none;
    }
    
    /* Octagon background shape */
    td::before {
      content: '';
      position: absolute;
      top: 5px;
      left: 5px;
      right: 5px;
      bottom: 5px;
      clip-path: polygon(15px 0%, calc(100% - 15px) 0%, 100% 15px, 100% calc(100% - 15px), calc(100% - 15px) 100%, 15px 100%, 0% calc(100% - 15px), 0% 15px);
      z-index: -1;
      transition: all 0.3s ease;
    }
    
    /* Navy octagon for rank and points columns */
    td:first-child::before,
    td:last-child::before {
      background: #1a365d;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    
    /* White octagon for team and league columns */
    td:nth-child(2)::before,
    td:nth-child(3)::before {
      background: #ffffff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    /* Hover effects */
    tbody tr:hover td:first-child::before,
    tbody tr:hover td:last-child::before {
      background: #2d4a66;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    
    tbody tr:hover td:nth-child(2)::before,
    tbody tr:hover td:nth-child(3)::before {
      background: #ffffff;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    
    /* ==========================================================================
       CELL CONTENT STYLING
       ========================================================================== */
    
    /* Column alignment */
    td:first-child,
    td:last-child {
      text-align: center;
      color: #ffffff;
    }
    
    .team-cell,
    .league-cell {
      text-align: center;
    }
    
    /* Rank circle */
    .rank-circle {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 3rem;
      margin: 0 auto;
      font-family: 'The Game', 'Bebas Neue', 'Arial Black', sans-serif;
      font-weight: 400;
    }
    
    /* Team information */
    .team-name {
      font-size: 1.3rem;
      font-weight: 900;
      margin-bottom: 5px;
      color: rgba(26, 54, 93, 0.9);
    }
    
    .username {
      font-size: 1rem;
      color: rgba(26, 54, 93, 0.9);
      margin-bottom: 3px;
    }
    
    /* League information */
    .league-name {
      font-size: 1rem;
      color: rgba(26, 54, 93, 0.9);
      font-style: italic;
    }
    
    /* Points */
    .total-points {
      font-size: 2rem;
      font-family: 'The Game', 'Bebas Neue', 'Arial Black', sans-serif;
      font-weight: 400;
      color: #ffffff;
    }
    
    /* ==========================================================================
       FOOTER
       ========================================================================== */
    .footer {
      text-align: center;
      color: white;
    }
    
    .fantasy-footer {
      font-family: 'The Game', 'Bebas Neue', 'Arial Black', sans-serif;
      font-size: 4rem;
      font-weight: 400;
      text-transform: uppercase;
      margin-bottom: 20px;
      background: linear-gradient(45deg, #FFD700, #FFA500);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    /* ==========================================================================
       MOBILE RESPONSIVE
       ========================================================================== */
    /* Tablet styles */
    @media (max-width: 768px) {
      .container {
        padding: 15px;
      }
      
      .season-title {
        font-size: 3.5rem;
      }
      
      /* Tab scrolling for tablet */
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
        border-radius: 2px;
      }
      
      .tabs::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 2px;
      }
      
      .tab-button {
        font-size: 0.9rem;
        padding: 10px 16px;
        white-space: nowrap;
        flex-shrink: 0;
      }
      
      /* Table typography */
      th {
        font-size: 1.5rem;
      }
      
      td {
        padding: 8px 6px;
      }
      
      td::before {
        top: 2px;
        left: 2px;
        right: 2px;
        bottom: 2px;
        clip-path: polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px);
      }
      
      .rank-circle {
        width: 30px;
        height: 30px;
        font-size: 1.2rem;
      }
      
      .team-name {
        font-size: 0.9rem;
        margin-bottom: 2px;
      }
      
      .username {
        font-size: 0.75rem;
      }
      
      .league-name {
        font-size: 0.8rem;
      }
      
      .total-points {
        font-size: 1.2rem;
      }
      
      .fantasy-footer {
        font-size: 2rem;
      }
      
      /* Stack table content on mobile */
      .team-cell {
        max-width: 200px;
      }
   
    }
    
    /* Small mobile styles */
    @media (max-width: 480px) {
      .season-title {
        font-size: 1.5rem;
      }
      
      td {
        padding: 6px 4px;
      }
      
      td::before {
        top: 1px;
        left: 1px;
        right: 1px;
        bottom: 1px;
        clip-path: polygon(6px 0%, calc(100% - 6px) 0%, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0% calc(100% - 6px), 0% 6px);
      }
      
      .rank-circle {
        width: 25px;
        height: 25px;
        font-size: 0.9rem;
      }
      
      .team-name {
        font-size: 0.8rem;
        margin-bottom: 1px;
      }
      
      .username {
        font-size: 0.7rem;
      }
      
      .league-name {
        font-size: 0.7rem;
      }
      
      .total-points {
        font-size: 1rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="top-image-container">
        <img src="thegame-thegame_logo.png" alt="The Game Header" class="top-image" />
      </div>
      
 <div class="tabs">
      <button class="tab-button active" onclick="showTab('oneflex')">1-Flex Champions</button>
      <button class="tab-button" onclick="showTab('twoflex')">2-Flex Champions</button>
    </div>

      <div class="season-title">LEADERBOARD</div>
    </header>
    
   
    
    <!-- 1-Flex Leaderboard -->
    <div id="oneflex" class="tab-content active">
      <div class="leaderboard-section">
        <div class="league-table">
          <table>
            <thead>
              <tr>
                <th>NO</th>
                <th>TEAM</th>
                <th>LEAGUE</th>
                <th>PTS</th>
              </tr>
            </thead>
            <tbody>
              ${oneFlexRows}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    
    <!-- 2-Flex Leaderboard -->
    <div id="twoflex" class="tab-content">
      <div class="leaderboard-section">
        <div class="league-table">
          <table>
            <thead>
              <tr>
                <th>NO</th>
                <th>TEAM</th>
                <th>LEAGUE</th>
                <th>PTS</th>
              </tr>
            </thead>
            <tbody>
              ${twoFlexRows}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    
    <footer class="footer">
      <img src="thegame-living-in-fantasy.png" alt="living in fantasy" class="top-image" />

      <p style="font-size: 0.9rem; opacity: 0.8;">Updated: ${new Date().toLocaleString()}</p>
    </footer>
  </div>

  <script>
    function showTab(tabName) {
      // Hide all tab contents
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      
      // Remove active class from all tab buttons
      document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
      });
      
      // Show selected tab content
      document.getElementById(tabName).classList.add('active');
      
      // Add active class to selected tab button
      event.target.classList.add('active');
    }
  </script>
</body>
</html>`;
}

async function generateShopifyPage() {
  console.log('📱 Generating Shopify page...');
  
  // Load existing season leaders data
  const allData = loadWeeklyData();
  
  if (!allData.seasonLeaders || !allData.seasonLeaders.oneFlexUsers.length) {
    console.log('❌ No season leaders data found. Please run the main script first to generate season data.');
    return;
  }
  
  // Generate Shopify HTML
  const html = generateShopifyHTML(allData.seasonLeaders);
  
  // Write Shopify HTML file
  fs.writeFileSync('docs/shopify.html', html);
  
  console.log(`✅ Shopify page generated at docs/shopify.html`);
  console.log(`📊 Top 10 1-Flex Leaders: ${Math.min(10, allData.seasonLeaders.oneFlexUsers.length)} users`);
  console.log(`📊 Top 10 2-Flex Leaders: ${Math.min(10, allData.seasonLeaders.twoFlexUsers.length)} users`);
}

// Run the generator
generateShopifyPage().catch(console.error);