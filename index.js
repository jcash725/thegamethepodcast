import { getTopScorersForUser } from './sleeper-api.js';

async function main() {
  console.log('🏈 Fetching Week 1 top scorers for thegamethepodcast...\n');
  
  try {
    const results = await getTopScorersForUser();
    
    console.log('\n📊 WEEK 1 TOP SCORERS BY LEAGUE:');
    console.log('=' .repeat(50));
    
    results.leagueResults.forEach((league, index) => {
      console.log(`${index + 1}. ${league.leagueName}`);
      console.log(`   Top Scorer: ${league.topScorer} (${league.topScore} pts)\n`);
    });
    
    console.log('🏆 OVERALL TOP SCORER ACROSS ALL LEAGUES:');
    console.log('=' .repeat(50));
    console.log(`Champion: ${results.overallTopScorer}`);
    console.log(`Score: ${results.overallTopScore} points`);
    console.log(`League: ${results.overallTopLeague}`);
    
  } catch (error) {
    console.error('❌ Error fetching data:', error.message);
    process.exit(1);
  }
}

main();