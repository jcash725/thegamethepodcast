console.log('[Leaderboard] Script file loaded');

function showWeek(week) {
  console.log('[Leaderboard] showWeek called:', week);

  // Hide all week contents
  document.querySelectorAll('.week-content').forEach(content => {
    content.classList.remove('active');
  });

  // Remove active class from all tab buttons
  document.querySelectorAll('.tab-button').forEach(button => {
    button.classList.remove('active');
  });

  // Show selected week content
  const weekElement = document.getElementById('week' + week);
  if (weekElement) {
    weekElement.classList.add('active');
  }

  // Add active class to selected tab button
  if (event && event.target) {
    event.target.classList.add('active');
  }

  // Show default category (1-flex) for the selected week
  showCategory(week, 'oneflex');
}

function showCategory(week, category) {
  console.log('[Leaderboard] showCategory called:', week, category);

  // Hide all category contents for this week
  document.querySelectorAll(`#week${week}-oneflex, #week${week}-twoflex`).forEach(content => {
    content.classList.remove('active');
  });

  // Remove active class from category tab buttons in the active week
  const weekElement = document.querySelector('#week' + week + ' .category-tabs');
  if (weekElement) {
    weekElement.querySelectorAll('.category-tab-button').forEach(button => {
      button.classList.remove('active');
    });
  }

  // Show selected category content
  const categoryElement = document.getElementById(`week${week}-${category}`);
  if (categoryElement) {
    categoryElement.classList.add('active');
  }

  // Add active class to selected category button
  if (event && event.target) {
    event.target.classList.add('active');
  }
}

// Load real data from JSON asset
async function loadLeaderboardData() {
  console.log('🚀 loadLeaderboardData() started');

  try {
    // Get the JSON URL from a data attribute or construct it
    const jsonUrl = document.querySelector('[data-json-url]')?.dataset.jsonUrl ||
                   (window.Shopify?.routes?.root || '') + 'assets/thegame-weekly-data.json';

    console.log('📡 Fetching data from:', jsonUrl);

    const response = await fetch(jsonUrl);
    console.log('📥 Response status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Data loaded successfully:', data);

    // Replace sample data with real data
    populateLeaderboards(data);
    console.log('🎯 Tables populated');
  } catch (error) {
    console.error('❌ Error loading leaderboard data:', error);
    console.log('🔄 Falling back to sample data');
  }
}

function populateLeaderboards(data) {
  console.log('[Leaderboard] populateLeaderboards called with:', data);

  // Process each week
  Object.keys(data.weeks).forEach(weekNum => {
    const weekData = data.weeks[weekNum];

    // Separate by flex count
    const oneFlexResults = weekData.leagueResults.filter(result => result.flexCount === 1);
    const twoFlexResults = weekData.leagueResults.filter(result => result.flexCount === 2);

    // Sort by score descending
    oneFlexResults.sort((a, b) => b.topScore - a.topScore);
    twoFlexResults.sort((a, b) => b.topScore - a.topScore);

    // Populate 1-flex table for this week
    populateTable(`week${weekNum}-oneflex`, oneFlexResults);

    // Populate 2-flex table for this week
    populateTable(`week${weekNum}-twoflex`, twoFlexResults);
  });

  // Also populate season leaders if available
  if (data.seasonLeaders) {
    populateTable('weekseason-oneflex', data.seasonLeaders.oneFlexUsers || []);
    populateTable('weekseason-twoflex', data.seasonLeaders.twoFlexUsers || []);
  }
}

function populateTable(containerId, results) {
  console.log(`[Leaderboard] populateTable called for ${containerId} with ${results.length} results`);

  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`[Leaderboard] Container ${containerId} not found`);
    return;
  }

  const tbody = container.querySelector('tbody');
  if (!tbody) {
    console.warn(`[Leaderboard] No tbody found in ${containerId}`);
    return;
  }

  // Clear existing rows
  tbody.innerHTML = '';

  // Add new rows
  results.forEach((result, index) => {
    const rank = index + 1;
    const rowClass = rank === 1 ? 'champion' : rank <= 3 ? 'podium' : '';

    const row = document.createElement('tr');
    row.className = rowClass;
    row.innerHTML = `
      <td><div class="rank-circle">${rank}</div></td>
      <td class="team-cell">
        <div class="team-name">${result.teamName}</div>
        <div class="username">@${result.topScorer}</div>
      </td>
      <td class="league-cell">
        <div class="league-name">${result.leagueName}</div>
      </td>
      <td class="points-cell">
        <div class="total-points">${result.topScore}</div>
      </td>
    `;
    tbody.appendChild(row);
  });

  console.log(`[Leaderboard] Added ${results.length} rows to ${containerId}`);
}

// Load data when page loads
console.log('🔧 Setting up event listeners');

// Try multiple ways to ensure the function runs
document.addEventListener('DOMContentLoaded', function() {
  console.log('📅 DOMContentLoaded fired');
  loadLeaderboardData();
});

// Backup: run after a short delay
setTimeout(function() {
  console.log('⏰ Timeout backup fired');
  loadLeaderboardData();
}, 1000);

// Also try immediate execution if DOM already loaded
if (document.readyState === 'loading') {
  console.log('📖 Document still loading, waiting for DOMContentLoaded');
} else {
  console.log('✅ Document already loaded, running immediately');
  loadLeaderboardData();
}

// Make functions globally available for onclick handlers
window.showWeek = showWeek;
window.showCategory = showCategory;