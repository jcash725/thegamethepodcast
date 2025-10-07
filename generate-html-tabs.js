import { SleeperAPI } from './sleeper-api.js';
import fs from 'fs';
import path from 'path';

const USERNAME = 'thegamethepodcast';
const DATA_FILE = 'docs/weekly-data.json';

async function getTopScorersForWeek(week = 1, existingFlexSettings = {}) {
  const api = new SleeperAPI();

  try {
    console.log(`🏈 Fetching Week ${week} top scorers for ${USERNAME}...`);

    const user = await api.getUser(USERNAME);
    console.log(`Found user: ${user.display_name} (ID: ${user.user_id})`);

    const leagues = await api.getUserLeagues(user.user_id);
    console.log(`Found ${leagues.length} leagues\n`);

    const flexSettings = { ...existingFlexSettings };

    // Track season leaders across all leagues
    let oneFlexSeasonLeaders = [];
    let twoFlexSeasonLeaders = [];

    let oneFlexLeagues = [];
    let twoFlexLeagues = [];
    let overallTopScore = 0;
    let overallTopScorer = null;
    let overallTopLeague = null;
    let oneFlexTopScore = 0;
    let oneFlexTopScorer = null;
    let oneFlexTopLeague = null;
    let twoFlexTopScore = 0;
    let twoFlexTopScorer = null;
    let twoFlexTopLeague = null;

    // Track bench scoring champions for both flex types
    let oneFlexTopBenchTeam = null;
    let twoFlexTopBenchTeam = null;

    // Track bench players across all leagues for position analysis
    let allBenchPlayers = new Map(); // playerId -> { teamCount, score }

    for (const league of leagues) {
      console.log(`Processing league: ${league.name}`);
      
      await api.delay(100);
      
      // Check if we already have flex settings for this league
      let flexCount = flexSettings[league.league_id];
      
      if (flexCount === undefined) {
        console.log(`  Fetching flex settings for ${league.name}...`);
        const leagueSettings = await api.getLeagueSettings(league.league_id);
        flexCount = leagueSettings.roster_positions?.filter(pos => pos === 'FLEX').length || 0;
        flexSettings[league.league_id] = flexCount;
        console.log(`  Cached ${flexCount} FLEX positions for ${league.name}`);
      } else {
        console.log(`  Using cached flex settings: ${flexCount} FLEX positions`);
      }
      
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

      // Process rosters for season leaders using fpts (season total fantasy points)
      for (const roster of rosters) {
        const user = userMap[roster.owner_id];
        const fpts = roster.settings?.fpts || 0;
        const fpts_decimal = roster.settings?.fpts_decimal || 0;
        const seasonPoints = parseFloat(fpts) + (parseFloat(fpts_decimal) / 100);

        console.log(`User: ${user?.display_name}, Raw fpts: ${fpts}, fpts_decimal: ${fpts_decimal}, Combined seasonPoints: ${seasonPoints}`);

        if (user && seasonPoints > 0) {
          const teamName = user?.metadata?.team_name || user?.display_name || 'No Team Name';
          const userEntry = {
            leagueName: league.name,
            topScorer: user.display_name,
            teamName: teamName,
            flexCount: flexCount,
            totalPoints: seasonPoints,
            weeksPlayed: week, // Current week number
            averagePoints: seasonPoints / week
          };

          if (flexCount === 1) {
            oneFlexSeasonLeaders.push(userEntry);
            // Keep only top 10, sorted by total points
            oneFlexSeasonLeaders.sort((a, b) => b.totalPoints - a.totalPoints);
            oneFlexSeasonLeaders = oneFlexSeasonLeaders.slice(0, 10);
          } else if (flexCount === 2) {
            twoFlexSeasonLeaders.push(userEntry);
            // Keep only top 10, sorted by total points
            twoFlexSeasonLeaders.sort((a, b) => b.totalPoints - a.totalPoints);
            twoFlexSeasonLeaders = twoFlexSeasonLeaders.slice(0, 10);
          }
        }
      }

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

      // Process bench scoring for this league
      const benchData = await processBenchScoring(matchups, userMap, rosterMap, league.name, flexCount, allBenchPlayers);

      if (topScore > overallTopScore) {
        overallTopScore = topScore;
        overallTopScorer = topScorer;
        overallTopLeague = league.name;
      }

      // Track flex-specific champions
      if (flexCount === 1) {
        if (topScore > oneFlexTopScore) {
          oneFlexTopScore = topScore;
          oneFlexTopScorer = topScorer;
          oneFlexTopLeague = league.name;
        }

        // Track top bench team for 1-flex leagues
        if (benchData.topBenchTeam && (!oneFlexTopBenchTeam || benchData.topBenchTeam.benchPoints > oneFlexTopBenchTeam.benchPoints)) {
          oneFlexTopBenchTeam = benchData.topBenchTeam;
        }

        oneFlexLeagues.push({
          leagueName: league.name,
          topScorer: topScorer?.display_name || 'Unknown',
          teamName: topScorer?.teamName || 'No Team Name',
          topScore: topScore,
          flexCount: 1
        });
      } else if (flexCount === 2) {
        if (topScore > twoFlexTopScore) {
          twoFlexTopScore = topScore;
          twoFlexTopScorer = topScorer;
          twoFlexTopLeague = league.name;
        }

        // Track top bench team for 2-flex leagues
        if (benchData.topBenchTeam && (!twoFlexTopBenchTeam || benchData.topBenchTeam.benchPoints > twoFlexTopBenchTeam.benchPoints)) {
          twoFlexTopBenchTeam = benchData.topBenchTeam;
        }

        twoFlexLeagues.push({
          leagueName: league.name,
          topScorer: topScorer?.display_name || 'Unknown',
          teamName: topScorer?.teamName || 'No Team Name',
          topScore: topScore,
          flexCount: 2
        });
      }

      console.log(`  Top scorer: ${topScorer?.display_name || 'Unknown'} with ${topScore} points`);
      await api.delay(100);
    }
    
    // Sort leagues by top score descending and limit to top 10
    oneFlexLeagues.sort((a, b) => b.topScore - a.topScore);
    twoFlexLeagues.sort((a, b) => b.topScore - a.topScore);
    
    // Limit to top 10 for each category for display/storage
    oneFlexLeagues = oneFlexLeagues.slice(0, 10);
    twoFlexLeagues = twoFlexLeagues.slice(0, 10);

    // Process bench players by position
    let topBenchPlayersByPosition = {
      QB: { points: 0, player: null, team: null },
      RB: { points: 0, player: null, team: null },
      WR: { points: 0, player: null, team: null },
      TE: { points: 0, player: null, team: null },
      K: { points: 0, player: null, team: null },
      DEF: { points: 0, player: null, team: null }
    };

    if (allBenchPlayers.size > 0) {
      console.log(`Looking up position data for ${allBenchPlayers.size} bench players...`);

      // Get player info for all bench players
      const playerIds = Array.from(allBenchPlayers.keys());
      const playersInfo = await api.getPlayersInfo(playerIds);

      // Find top 5 most commonly owned bench players for each position
      // First, group players by position
      const playersByPosition = {
        QB: [], RB: [], WR: [], TE: [], K: [], DEF: []
      };

      for (const [playerId, benchData] of allBenchPlayers) {
        const playerInfo = playersInfo[playerId];
        if (!playerInfo || !playerInfo.position) continue;

        const position = playerInfo.position;
        if (playersByPosition[position]) {
          playersByPosition[position].push({
            playerId,
            benchData,
            playerInfo
          });
        }
      }

      // For each position, find the top 5 most commonly owned players
      for (const [position, players] of Object.entries(playersByPosition)) {
        if (players.length === 0) continue;

        // Sort by: 1) Weekly score (descending), 2) Team count (descending)
        players.sort((a, b) => {
          if (b.benchData.score !== a.benchData.score) {
            return b.benchData.score - a.benchData.score;
          }
          return b.benchData.teamCount - a.benchData.teamCount;
        });

        // Take top 5 and format them
        const top5Players = players.slice(0, 5).map(player => ({
          name: `${player.playerInfo.first_name || ''} ${player.playerInfo.last_name || ''}`.trim() || 'Unknown',
          team: player.playerInfo.team || 'FA',
          position: position,
          teamCount: player.benchData.teamCount,
          score: player.benchData.score
        }));

        topBenchPlayersByPosition[position] = top5Players;
      }
    }
    
    return {
      week,
      userName: user.display_name,
      oneFlexLeagues,
      twoFlexLeagues,
      overallTopScorer: {
        display_name: overallTopScorer?.display_name || 'Unknown',
        teamName: overallTopScorer?.metadata?.team_name || overallTopScorer?.display_name || 'No Team Name'
      },
      overallTopScore,
      overallTopLeague,
      oneFlexTopScorer: {
        display_name: oneFlexTopScorer?.display_name || 'Unknown',
        teamName: oneFlexTopScorer?.teamName || 'No Team Name'
      },
      oneFlexTopScore,
      oneFlexTopLeague,
      twoFlexTopScorer: {
        display_name: twoFlexTopScorer?.display_name || 'Unknown',
        teamName: twoFlexTopScorer?.teamName || 'No Team Name'
      },
      twoFlexTopScore,
      twoFlexTopLeague,
      // Bench scoring champions
      oneFlexTopBenchTeam,
      twoFlexTopBenchTeam,
      // Top bench players by position
      topBenchPlayersByPosition,
      totalLeagues: leagues.length,
      oneFlexCount: oneFlexLeagues.length,
      twoFlexCount: twoFlexLeagues.length,
      lastUpdated: new Date().toLocaleString(),
      flexSettings: flexSettings,
      seasonLeaders: {
        oneFlexUsers: oneFlexSeasonLeaders,
        twoFlexUsers: twoFlexSeasonLeaders,
        overallSeasonLeader: [...oneFlexSeasonLeaders, ...twoFlexSeasonLeaders].sort((a, b) => b.totalPoints - a.totalPoints)[0] || null,
        oneFlexSeasonLeader: oneFlexSeasonLeaders[0] || null,
        twoFlexSeasonLeader: twoFlexSeasonLeaders[0] || null,
        totalWeeks: week,
        oneFlexCount: oneFlexSeasonLeaders.length,
        twoFlexCount: twoFlexSeasonLeaders.length
      }
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
  return { weeks: {}, leagueFlexSettings: {}, lastUpdated: new Date().toLocaleString() };
}

// Function to process bench scoring data from matchups
async function processBenchScoring(matchups, userMap, rosterMap, leagueName, flexCount, allBenchPlayers) {
  let topBenchPoints = 0;
  let topBenchTeam = null;

  for (const matchup of matchups) {
    if (!matchup.players_points || !matchup.starters) continue;

    const ownerId = rosterMap[matchup.roster_id];
    const user = ownerId && userMap[ownerId] ? userMap[ownerId] : null;
    if (!user) continue;

    const teamName = user?.metadata?.team_name || user?.display_name || 'No Team Name';

    // Calculate bench points (players not in starters)
    const starterIds = new Set(matchup.starters);
    let benchPoints = 0;

    for (const [playerId, points] of Object.entries(matchup.players_points)) {
      if (!starterIds.has(playerId) && points > 0) {
        benchPoints += points;

        // Track this bench player across all leagues
        if (!allBenchPlayers.has(playerId)) {
          allBenchPlayers.set(playerId, {
            teamCount: 0,
            score: 0
          });
        }

        const playerData = allBenchPlayers.get(playerId);
        playerData.teamCount += 1;
        playerData.score = points; // All leagues have same scoring
      }
    }

    // Track top bench points
    if (benchPoints > topBenchPoints) {
      topBenchPoints = benchPoints;
      topBenchTeam = {
        teamName,
        username: user.display_name,
        leagueName,
        benchPoints: parseFloat(benchPoints.toFixed(2)),
        flexCount
      };
    }
  }

  return {
    topBenchTeam
  };
}


function saveWeeklyData(allData, currentWeek) {
  // Ensure docs directory exists
  if (!fs.existsSync('docs')) {
    fs.mkdirSync('docs', { recursive: true });
  }

  // Save the main consolidated data file
  fs.writeFileSync(DATA_FILE, JSON.stringify(allData, null, 2));

  // Save individual weekly data files for comparison
  const weeklyDataFile = `docs/week-${currentWeek}-data.json`;
  const weekData = {
    week: currentWeek,
    data: allData.weeks[currentWeek],
    generatedAt: new Date().toISOString(),
    seasonLeaders: allData.seasonLeaders
  };
  fs.writeFileSync(weeklyDataFile, JSON.stringify(weekData, null, 2));

  // Also update the Shopify JSON file
  const shopifyDataFile = 'shopify/assets/thegame-weekly-data.json';
  fs.writeFileSync(shopifyDataFile, JSON.stringify(allData, null, 2));

  // Save weekly Shopify file too for backup
  const shopifyWeeklyFile = `shopify/assets/week-${currentWeek}-data.json`;
  fs.writeFileSync(shopifyWeeklyFile, JSON.stringify(weekData, null, 2));
}

function generateTabbedHTML(allData) {
  const weeks = Object.keys(allData.weeks).sort((a, b) => parseInt(a) - parseInt(b));
  const latestWeek = weeks[weeks.length - 1] || '1';
  const latestData = allData.weeks[latestWeek];
  
  // Generate tab headers
  const tabHeaders = weeks.map(week => 
    `<button class="tab-button ${week === latestWeek ? 'active' : ''}" onclick="showWeek(${week})">Week ${week}</button>`
  ).join('') + `<button class="tab-button" onclick="showWeek('season')">Season Leaders</button>`;
  
  // Generate tab content
  const tabContent = weeks.map(week => {
    const weekData = allData.weeks[week];
    const isActive = week === latestWeek;
    
    // Generate 1-flex league content
    const oneFlexRows = (weekData.oneFlexLeagues || []).map((league, index) => `
      <tr class="${index === 0 ? 'top-scorer' : ''}">
        <td><div class="rank-circle">${index + 1}</div></td>
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

    const oneFlexMobileCards = (weekData.oneFlexLeagues || []).map((league, index) => `
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

    // Generate 2-flex league content
    const twoFlexRows = (weekData.twoFlexLeagues || []).map((league, index) => `
      <tr class="${index === 0 ? 'top-scorer' : ''}">
        <td><div class="rank-circle">${index + 1}</div></td>
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

    const twoFlexMobileCards = (weekData.twoFlexLeagues || []).map((league, index) => `
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
            <div class="stat-value">${weekData.oneFlexCount || 0}</div>
            <div class="stat-label">1-Flex Leagues</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${weekData.twoFlexCount || 0}</div>
            <div class="stat-label">2-Flex Leagues</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${weekData.overallTopScore > 0 ? weekData.overallTopScore : 'TBD'}</div>
            <div class="stat-label">Highest Score</div>
          </div>
        </div>
        
        ${weekData.oneFlexTopScore > 0 ? `
        <div class="champion-card">
          <h2>🏆 Week ${week} 1-Flex Champion</h2>
          <div class="champion-name">${weekData.oneFlexTopScorer?.teamName || weekData.oneFlexTopScorer?.display_name || 'No Team Name'}</div>
          <div class="champion-username">@${weekData.oneFlexTopScorer?.display_name || weekData.oneFlexTopScorer}</div>
          <div class="champion-score">${weekData.oneFlexTopScore} pts</div>
          <div class="champion-league">from "${weekData.oneFlexTopLeague}"</div>
        </div>
        ` : `
        <div class="champion-card">
          <h2>🏆 Week ${week} 1-Flex Champion</h2>
          <div class="champion-name">Week ${week} hasn't started yet!</div>
          <div class="champion-league">Check back after games begin</div>
        </div>
        `}

        ${weekData.twoFlexTopScore > 0 ? `
        <div class="champion-card">
          <h2>🏆 Week ${week} 2-Flex Champion</h2>
          <div class="champion-name">${weekData.twoFlexTopScorer?.teamName || weekData.twoFlexTopScorer?.display_name || 'No Team Name'}</div>
          <div class="champion-username">@${weekData.twoFlexTopScorer?.display_name || weekData.twoFlexTopScorer}</div>
          <div class="champion-score">${weekData.twoFlexTopScore} pts</div>
          <div class="champion-league">from "${weekData.twoFlexTopLeague}"</div>
        </div>
        ` : `
        <div class="champion-card">
          <h2>🏆 Week ${week} 2-Flex Champion</h2>
          <div class="champion-name">Week ${week} hasn't started yet!</div>
          <div class="champion-league">Check back after games begin</div>
        </div>
        `}

        ${weekData.oneFlexTopBenchTeam ? `
        <div class="champion-card bench-champion">
          <h2>🪑 Week ${week} 1-Flex Bench Champion</h2>
          <div class="champion-name">${weekData.oneFlexTopBenchTeam.teamName}</div>
          <div class="champion-username">@${weekData.oneFlexTopBenchTeam.username}</div>
          <div class="champion-score">${weekData.oneFlexTopBenchTeam.benchPoints} bench pts</div>
          <div class="champion-league">from "${weekData.oneFlexTopBenchTeam.leagueName}"</div>
        </div>
        ` : ''}

        ${weekData.twoFlexTopBenchTeam ? `
        <div class="champion-card bench-champion">
          <h2>🪑 Week ${week} 2-Flex Bench Champion</h2>
          <div class="champion-name">${weekData.twoFlexTopBenchTeam.teamName}</div>
          <div class="champion-username">@${weekData.twoFlexTopBenchTeam.username}</div>
          <div class="champion-score">${weekData.twoFlexTopBenchTeam.benchPoints} bench pts</div>
          <div class="champion-league">from "${weekData.twoFlexTopBenchTeam.leagueName}"</div>
        </div>
        ` : ''}

        ${weekData.topBenchPlayersByPosition ? `
        <div class="bench-players-section">
          <h3>🏆 Top 5 Most Common Bench Players by Position</h3>
          <div class="bench-positions-grid">
            ${Object.entries(weekData.topBenchPlayersByPosition).filter(([pos, players]) => players && players.length > 0).map(([position, players]) => `
              <div class="position-section">
                <h4 class="position-title">${position}</h4>
                <div class="position-players">
                  ${players.map((player, index) => `
                    <div class="bench-player-row">
                      <div class="player-rank">${index + 1}</div>
                      <div class="player-info">
                        <div class="player-name">${player.name}</div>
                        <div class="player-team">${player.team}</div>
                      </div>
                      <div class="player-stats">
                        <div class="team-count">${player.teamCount} teams</div>
                        <div class="weekly-score">${(player.score || 0).toFixed(1)} pts</div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}

        ${weekData.oneFlexCount > 0 ? `
        <div class="league-table">
          <div class="table-header">
            <h3>📊 1-Flex Leagues (${weekData.oneFlexCount})</h3>
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
                ${oneFlexRows}
              </tbody>
            </table>
          </div>
        </div>
        
        <div class="mobile-league-list">
          <div class="table-header">
            <h3>📊 1-Flex Leagues (${weekData.oneFlexCount})</h3>
          </div>
          ${oneFlexMobileCards}
        </div>
        ` : ''}

        ${weekData.twoFlexCount > 0 ? `
        <div class="league-table">
          <div class="table-header">
            <h3>📊 2-Flex Leagues (${weekData.twoFlexCount})</h3>
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
                ${twoFlexRows}
              </tbody>
            </table>
          </div>
        </div>
        
        <div class="mobile-league-list">
          <div class="table-header">
            <h3>📊 2-Flex Leagues (${weekData.twoFlexCount})</h3>
          </div>
          ${twoFlexMobileCards}
        </div>
        ` : ''}
        
        <div class="week-updated">
          <p>Week ${week} updated: ${weekData.lastUpdated}</p>
        </div>
      </div>
    `;
  }).join('');

  // Generate season leaders tab content
  const seasonLeaders = allData.seasonLeaders || { allUsers: [], oneFlexUsers: [], twoFlexUsers: [] };
  
  const seasonOneFlexRows = seasonLeaders.oneFlexUsers.map((user, index) => `
    <tr class="${index === 0 ? 'top-scorer' : ''}">
      <td><div class="rank-circle">${index + 1}</div></td>
      <td>${user.leagueName}</td>
      <td>
        <div class="scorer-info">
          <div class="team-name">${user.teamName}</div>
          <div class="username">@${user.topScorer}</div>
        </div>
      </td>
      <td class="points">${user.totalPoints.toFixed(2)}</td>
      <td class="average-points">${user.averagePoints.toFixed(1)}</td>
    </tr>
  `).join('');

  const seasonOneFlexCards = seasonLeaders.oneFlexUsers.map((user, index) => `
    <div class="league-card ${index === 0 ? 'top-scorer' : ''}">
      <div class="league-info">
        <div class="league-rank">#${index + 1}</div>
        <div class="league-name-mobile">${user.leagueName}</div>
        <div class="team-info-mobile">
          <div class="team-name-mobile">${user.teamName}</div>
          <div class="username-mobile">@${user.topScorer}</div>
        </div>
      </div>
      <div class="season-points-mobile">
        <div class="points-mobile">${user.totalPoints.toFixed(2)}</div>
        <div class="average-mobile">Avg: ${user.averagePoints.toFixed(1)}</div>
      </div>
    </div>
  `).join('');

  const seasonTwoFlexRows = seasonLeaders.twoFlexUsers.map((user, index) => `
    <tr class="${index === 0 ? 'top-scorer' : ''}">
      <td><div class="rank-circle">${index + 1}</div></td>
      <td>${user.leagueName}</td>
      <td>
        <div class="scorer-info">
          <div class="team-name">${user.teamName}</div>
          <div class="username">@${user.topScorer}</div>
        </div>
      </td>
      <td class="points">${user.totalPoints.toFixed(2)}</td>
      <td class="average-points">${user.averagePoints.toFixed(1)}</td>
    </tr>
  `).join('');

  const seasonTwoFlexCards = seasonLeaders.twoFlexUsers.map((user, index) => `
    <div class="league-card ${index === 0 ? 'top-scorer' : ''}">
      <div class="league-info">
        <div class="league-rank">#${index + 1}</div>
        <div class="league-name-mobile">${user.leagueName}</div>
        <div class="team-info-mobile">
          <div class="team-name-mobile">${user.teamName}</div>
          <div class="username-mobile">@${user.topScorer}</div>
        </div>
      </div>
      <div class="season-points-mobile">
        <div class="points-mobile">${user.totalPoints.toFixed(2)}</div>
        <div class="average-mobile">Avg: ${user.averagePoints.toFixed(1)}</div>
      </div>
    </div>
  `).join('');

  const seasonTabContent = `
    <div id="weekseason" class="tab-content">
      <div class="stats">
        <div class="stat-card">
          <div class="stat-value">${seasonLeaders.totalWeeks || 1}</div>
          <div class="stat-label">Weeks Played</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${seasonLeaders.oneFlexCount || 0}</div>
          <div class="stat-label">1-Flex Leagues</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${seasonLeaders.twoFlexCount || 0}</div>
          <div class="stat-label">2-Flex Leagues</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${seasonLeaders.overallSeasonLeader?.totalPoints.toFixed(1) || 'TBD'}</div>
          <div class="stat-label">Total Points Leader</div>
        </div>
      </div>
      
      ${seasonLeaders.oneFlexSeasonLeader ? `
      <div class="champion-card">
        <h2>🏆 Season 1-Flex Leader</h2>
        <div class="champion-name">${seasonLeaders.oneFlexSeasonLeader.teamName}</div>
        <div class="champion-username">@${seasonLeaders.oneFlexSeasonLeader.topScorer}</div>
        <div class="champion-score">${seasonLeaders.oneFlexSeasonLeader.totalPoints.toFixed(2)} pts</div>
        <div class="champion-league">from "${seasonLeaders.oneFlexSeasonLeader.leagueName}" (${seasonLeaders.oneFlexSeasonLeader.averagePoints.toFixed(1)} avg)</div>
      </div>
      ` : ''}

      ${seasonLeaders.twoFlexSeasonLeader ? `
      <div class="champion-card">
        <h2>🏆 Season 2-Flex Leader</h2>
        <div class="champion-name">${seasonLeaders.twoFlexSeasonLeader.teamName}</div>
        <div class="champion-username">@${seasonLeaders.twoFlexSeasonLeader.topScorer}</div>
        <div class="champion-score">${seasonLeaders.twoFlexSeasonLeader.totalPoints.toFixed(2)} pts</div>
        <div class="champion-league">from "${seasonLeaders.twoFlexSeasonLeader.leagueName}" (${seasonLeaders.twoFlexSeasonLeader.averagePoints.toFixed(1)} avg)</div>
      </div>
      ` : ''}
      
      ${seasonLeaders.oneFlexCount > 0 ? `
      <div class="league-table">
        <div class="table-header">
          <h3>📊 Season Total: 1-Flex Leagues (${seasonLeaders.oneFlexCount})</h3>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>League Name</th>
                <th>Team & Owner</th>
                <th>Total Points</th>
                <th>Average</th>
              </tr>
            </thead>
            <tbody>
              ${seasonOneFlexRows}
            </tbody>
          </table>
        </div>
      </div>
      
      <div class="mobile-league-list">
        <div class="table-header">
          <h3>📊 Season Total: 1-Flex Leagues (${seasonLeaders.oneFlexCount})</h3>
        </div>
        ${seasonOneFlexCards}
      </div>
      ` : ''}

      ${seasonLeaders.twoFlexCount > 0 ? `
      <div class="league-table">
        <div class="table-header">
          <h3>📊 Season Total: 2-Flex Leagues (${seasonLeaders.twoFlexCount})</h3>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>League Name</th>
                <th>Team & Owner</th>
                <th>Total Points</th>
                <th>Average</th>
              </tr>
            </thead>
            <tbody>
              ${seasonTwoFlexRows}
            </tbody>
          </table>
        </div>
      </div>
      
      <div class="mobile-league-list">
        <div class="table-header">
          <h3>📊 Season Total: 2-Flex Leagues (${seasonLeaders.twoFlexCount})</h3>
        </div>
        ${seasonTwoFlexCards}
      </div>
      ` : ''}
      
      <div class="week-updated">
        <p>Season data updated: ${allData.lastUpdated}</p>
      </div>
    </div>
  `;

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
      font-family: 'Bebas Neue', 'Arial Black', sans-serif;
      background: 
        radial-gradient(circle at 20% 80%, rgba(255,255,255,0.1) 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(255,255,255,0.1) 0%, transparent 50%),
        linear-gradient(45deg, #2E7D32 0%, #4CAF50 25%, #388E3C 50%, #2E7D32 75%, #1B5E20 100%);
      min-height: 100vh;
      color: #333;
      position: relative;
      overflow-x: hidden;
    }
    
    body::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: 
        repeating-linear-gradient(90deg, transparent 0px, transparent 49px, rgba(255,255,255,0.1) 50px, rgba(255,255,255,0.1) 51px),
        radial-gradient(ellipse at top, rgba(255,255,255,0.2) 0%, transparent 70%);
      z-index: -1;
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
      padding: 40px 0;
    }
    
    .game-logo {
      margin-bottom: 20px;
    }
    
    .game-logo .stars {
      font-size: 1.5rem;
      color: #FFD700;
      margin-bottom: 10px;
    }
    
    .game-logo .the-game {
      font-size: 3.5rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 3px;
      text-shadow: 3px 3px 6px rgba(0,0,0,0.5);
      margin-bottom: 10px;
    }
    
    .game-logo .the-text {
      color: #1976D2;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }
    
    .game-logo .game-text {
      color: #DC143C;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }
    
    .leaderboard-title {
      font-size: 4rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 5px;
      color: #1a365d;
      text-shadow: 3px 3px 0px rgba(255,255,255,0.8);
      margin-bottom: 20px;
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

    .bench-champion {
      background: linear-gradient(135deg, #8B4513, #A0522D) !important;
    }

    .bench-players-section {
      margin: 30px 0;
    }

    .bench-players-section h3 {
      text-align: center;
      color: white;
      margin-bottom: 20px;
      font-size: 1.5rem;
    }

    .bench-positions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 20px;
      margin: 0 auto;
      max-width: 1400px;
    }

    .position-section {
      background: linear-gradient(135deg, #2D4A22, #3A5F2A);
      border-radius: 10px;
      padding: 20px;
      color: white;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    }

    .position-title {
      font-size: 1.4rem;
      font-weight: bold;
      color: #90EE90;
      margin-bottom: 15px;
      text-align: center;
      border-bottom: 2px solid rgba(255,255,255,0.2);
      padding-bottom: 8px;
    }

    .position-players {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .bench-player-row {
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 12px;
    }

    .player-rank {
      font-size: 1.2rem;
      font-weight: bold;
      color: #FFD700;
      min-width: 25px;
      text-align: center;
    }

    .player-info {
      flex: 1;
    }

    .player-name {
      font-size: 1rem;
      font-weight: bold;
      margin-bottom: 2px;
    }

    .player-team {
      font-size: 0.85rem;
      color: #CCC;
    }

    .player-stats {
      display: flex;
      flex-direction: column;
      gap: 2px;
      text-align: right;
      font-size: 0.8rem;
    }

    .team-count {
      font-weight: bold;
      color: #90EE90;
    }

    .total-points {
      color: #FFD700;
    }

    .best-score {
      color: #FFA500;
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
      background: rgba(255,255,255,0.95);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 15px 35px rgba(0,0,0,0.2);
      margin-bottom: 30px;
      backdrop-filter: blur(10px);
    }
    
    .table-header {
      background: transparent;
      color: #1a365d;
      padding: 30px 20px 10px;
      text-align: center;
    }
    
    .table-header h3 {
      font-size: 2rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin: 0;
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
      padding: 20px 25px;
      text-align: left;
      font-weight: 700;
      font-size: 1.2rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      border-bottom: 2px solid #1a365d;
    }
    
    th:first-child {
      width: 80px;
      text-align: center;
    }
    
    th:last-child {
      text-align: center;
      width: 100px;
    }
    
    tbody tr {
      background: rgba(255,255,255,0.9);
      border-bottom: 1px solid rgba(26, 54, 93, 0.1);
    }
    
    tbody tr:hover {
      background: rgba(255,255,255,1);
      transform: scale(1.02);
      transition: all 0.3s ease;
      box-shadow: 0 5px 15px rgba(0,0,0,0.1);
    }
    
    td {
      padding: 20px 25px;
      vertical-align: middle;
    }
    
    td:first-child {
      text-align: center;
    }
    
    .rank-circle {
      width: 50px;
      height: 50px;
      background: #1a365d;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      font-weight: 900;
      margin: 0 auto;
      box-shadow: 0 4px 10px rgba(26, 54, 93, 0.3);
    }
    
    .points {
      font-weight: 900;
      color: #1a365d;
      font-size: 1.8rem;
      text-align: center;
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
      margin-top: 50px;
      padding: 40px 0;
      position: relative;
    }
    
    .fantasy-footer {
      font-size: 3rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 3px;
      text-shadow: 3px 3px 6px rgba(0,0,0,0.5);
      margin-bottom: 20px;
      background: linear-gradient(45deg, #FFD700, #FFA500);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .footer-subtitle {
      font-size: 1.2rem;
      opacity: 0.9;
      margin-bottom: 10px;
    }
    
    /* Season leaders styling */
    .week-badge {
      background: #DC143C;
      color: white;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: bold;
    }
    
    .week-badge-mobile {
      background: #DC143C;
      color: white;
      padding: 2px 6px;
      border-radius: 8px;
      font-size: 0.7rem;
      font-weight: bold;
      margin-top: 4px;
    }
    
    .season-points-mobile {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      flex-shrink: 0;
      margin-left: 15px;
    }
    
    .average-points {
      font-weight: 600;
      color: #666;
      font-size: 0.9rem;
    }
    
    .average-mobile {
      color: #666;
      font-size: 0.75rem;
      margin-top: 2px;
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

      .bench-positions-grid {
        grid-template-columns: 1fr;
        gap: 15px;
      }

      .position-section {
        padding: 15px;
      }

      .bench-player-row {
        flex-direction: column;
        gap: 8px;
        align-items: stretch;
      }

      .player-stats {
        flex-direction: row;
        justify-content: space-between;
        text-align: left;
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
    <!-- Top Image -->
    <div class="top-image-container">
      <img src="top-image.jpg" alt="The Game Logo" class="top-image" />
    </div>
    
    <header class="header">
      <div class="game-logo">
        <div class="stars">★★ </div>
        <div class="the-game">
          <span class="the-text">THE</span>
          <span class="game-text">GAME</span>
        </div>
        <div class="stars"> ★★</div>
      </div>
      <div class="leaderboard-title">LEADERBOARD</div>
    </header>
    
    <div class="tabs">
      ${tabHeaders}
    </div>
    
    ${tabContent}
    ${seasonTabContent}
    
    <footer class="footer">
      <div class="fantasy-footer">LIVING IN A FANTASY</div>
      <p class="footer-subtitle">NFL FANTASY FOR THE GIRLS</p>
      <p>Data powered by Sleeper API</p>
      <p>Last site update: <span id="last-updated">${allData.lastUpdated}</span></p>
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
      const targetId = week === 'season' ? 'weekseason' : 'week' + week;
      document.getElementById(targetId).classList.add('active');
      
      // Add active class to selected tab button
      event.target.classList.add('active');
    }

    // Convert UTC timestamp to local time
    document.addEventListener('DOMContentLoaded', function() {
      const lastUpdatedElement = document.getElementById('last-updated');
      if (lastUpdatedElement) {
        const utcTime = new Date(lastUpdatedElement.textContent);
        lastUpdatedElement.textContent = utcTime.toLocaleString();
      }
    });
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
    const { flexSettings, seasonLeaders, ...weekData } = await getTopScorersForWeek(week, allData.leagueFlexSettings || {});

    // Add/update the week data and flex settings
    allData.weeks[week] = weekData;
    allData.leagueFlexSettings = { ...allData.leagueFlexSettings, ...flexSettings };

    // Use season leaders from the weekly calculation (most up-to-date)
    allData.seasonLeaders = seasonLeaders;
    allData.lastUpdated = new Date().toISOString();
    
    // Save updated data
    saveWeeklyData(allData, week);
    
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