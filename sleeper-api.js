import fetch from 'node-fetch';

const BASE_URL = 'https://api.sleeper.app/v1';
const USERNAME = 'thegamethepodcast';

export class SleeperAPI {
  async getUser(username) {
    const url = `${BASE_URL}/user/${username}`;
    console.log(`🌐 GET ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch user: ${response.statusText}`);
    }
    return await response.json();
  }

  async getUserLeagues(userId, season = '2025') {
    const url = `${BASE_URL}/user/${userId}/leagues/nfl/${season}`;
    console.log(`🌐 GET ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch leagues: ${response.statusText}`);
    }
    return await response.json();
  }

  async getLeagueUsers(leagueId) {
    const url = `${BASE_URL}/league/${leagueId}/users`;
    console.log(`🌐 GET ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch league users: ${response.statusText}`);
    }
    return await response.json();
  }

  async getWeekMatchups(leagueId, week) {
    const url = `${BASE_URL}/league/${leagueId}/matchups/${week}`;
    console.log(`🌐 GET ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch matchups: ${response.statusText}`);
    }
    return await response.json();
  }

  async getLeagueRosters(leagueId) {
    const url = `${BASE_URL}/league/${leagueId}/rosters`;
    console.log(`🌐 GET ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch rosters: ${response.statusText}`);
    }
    return await response.json();
  }

  async getLeagueSettings(leagueId) {
    const url = `${BASE_URL}/league/${leagueId}`;
    console.log(`🌐 GET ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch league settings: ${response.statusText}`);
    }
    return await response.json();
  }

  async getPlayersInfo(playerIds) {
    // Sleeper API provides all players in one call
    const url = `${BASE_URL}/players/nfl`;
    console.log(`🌐 GET ${url} (fetching player info for ${playerIds.length} players)`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch players: ${response.statusText}`);
    }
    const allPlayers = await response.json();

    // Filter to only the players we need
    const requestedPlayers = {};
    playerIds.forEach(playerId => {
      if (allPlayers[playerId]) {
        requestedPlayers[playerId] = allPlayers[playerId];
      }
    });

    return requestedPlayers;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export async function getTopScorersForUser() {
  const api = new SleeperAPI();
  
  try {
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
        api.getWeekMatchups(league.league_id, 1)
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
    
    return {
      leagueResults,
      overallTopScorer: overallTopScorer?.display_name || 'Unknown',
      overallTopScore,
      overallTopLeague
    };
    
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}