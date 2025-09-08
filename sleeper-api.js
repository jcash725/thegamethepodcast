import fetch from 'node-fetch';

const BASE_URL = 'https://api.sleeper.app/v1';

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

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

