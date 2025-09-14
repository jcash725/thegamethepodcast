#!/usr/bin/env node

/**
 * Convert weekly-data.json to Shopify metafields format
 * 
 * Usage: node convert-to-metafields.js
 * 
 * This will read your weekly-data.json and output three JSON files
 * that you can upload to Shopify page metafields
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the weekly data file
const dataPath = path.join(__dirname, '../docs/weekly-data.json');

if (!fs.existsSync(dataPath)) {
  console.error('❌ weekly-data.json not found at:', dataPath);
  console.log('Make sure to run your main script first to generate the data.');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Convert weeks data to metafields format
const weeksData = {};
const weeks = Object.keys(data.weeks || {});

weeks.forEach(week => {
  const weekData = data.weeks[week];
  
  // Separate by flex count and sort by score (already limited to top 10 from source data)
  const oneFlexResults = weekData.oneFlexLeagues || [];
  const twoFlexResults = weekData.twoFlexLeagues || [];
  
  weeksData[`week_${week}`] = {
    oneflex: oneFlexResults.map(result => ({
      team_name: result.teamName,
      username: result.topScorer,
      league_name: result.leagueName,
      points: result.topScore.toFixed(1)
    })),
    twoflex: twoFlexResults.map(result => ({
      team_name: result.teamName,
      username: result.topScorer,
      league_name: result.leagueName,
      points: result.topScore.toFixed(1)
    }))
  };
});

// Convert season data to metafields format
const seasonData = {
  oneflex: data.seasonLeaders?.oneFlexUsers?.map(user => ({
    team_name: user.teamName,
    username: user.topScorer,
    league_name: user.leagueName,
    total_points: user.totalPoints.toFixed(1),
    average_points: user.averagePoints?.toFixed(1) || '0'
  })) || [],
  twoflex: data.seasonLeaders?.twoFlexUsers?.map(user => ({
    team_name: user.teamName,
    username: user.topScorer,
    league_name: user.leagueName,
    total_points: user.totalPoints.toFixed(1),
    average_points: user.averagePoints?.toFixed(1) || '0'
  })) || []
};

// Settings data
const settingsData = {
  total_weeks: weeks.length || 1,
  active_week: Math.max(...weeks.map(Number)) || 1,
  last_updated: new Date().toISOString()
};

// Create output directory
const outputDir = path.join(__dirname, 'metafields-output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Write the three metafield files
fs.writeFileSync(
  path.join(outputDir, 'weeks_data.json'),
  JSON.stringify(weeksData, null, 2)
);

fs.writeFileSync(
  path.join(outputDir, 'season_data.json'),
  JSON.stringify(seasonData, null, 2)
);

fs.writeFileSync(
  path.join(outputDir, 'settings.json'),
  JSON.stringify(settingsData, null, 2)
);

// Create instructions file
const instructions = `# Shopify Metafields Upload Instructions

## Step 1: Go to your Shopify page
1. In Shopify Admin, go to **Online Store > Pages**
2. Find your leaderboard page (or create new page with template suffix "leaderboard-metafields")
3. Click **"Edit"**

## Step 2: Add metafields
1. Scroll down and click **"Show all"** or look for **"Metafields"** section
2. Click **"Add metafield"**

Add these three metafields:

### Metafield 1: weeks_data
- **Namespace**: \`leaderboard\`
- **Key**: \`weeks_data\`
- **Type**: \`JSON\`
- **Value**: Copy entire content from \`weeks_data.json\`

### Metafield 2: season_data
- **Namespace**: \`leaderboard\`
- **Key**: \`season_data\`
- **Type**: \`JSON\`
- **Value**: Copy entire content from \`season_data.json\`

### Metafield 3: settings
- **Namespace**: \`leaderboard\`
- **Key**: \`settings\`
- **Type**: \`JSON\`
- **Value**: Copy entire content from \`settings.json\`

## Step 3: Update page template
Make sure your page uses the metafields section:
\`\`\`liquid
{% section 'leaderboard-metafields' %}
\`\`\`

## Weekly Updates
1. Run your main Node.js script to update weekly-data.json
2. Run: \`node shopify/convert-to-metafields.js\`
3. Copy-paste the new JSON content into the three metafields
4. Save the page - it will automatically update!

---
Generated: ${new Date().toLocaleString()}
Total weeks: ${weeks.length}
Active week: ${Math.max(...weeks.map(Number)) || 1}
Season leaders (1-Flex): ${data.seasonLeaders?.oneFlexUsers?.length || 0}
Season leaders (2-Flex): ${data.seasonLeaders?.twoFlexUsers?.length || 0}
`;

fs.writeFileSync(path.join(outputDir, 'INSTRUCTIONS.md'), instructions);

console.log('✅ Conversion complete!');
console.log(`📁 Files created in: ${outputDir}`);
console.log('📄 Files created:');
console.log('   - weeks_data.json');
console.log('   - season_data.json');  
console.log('   - settings.json');
console.log('   - INSTRUCTIONS.md');
console.log('');
console.log('📊 Data Summary:');
console.log(`   - Total weeks: ${weeks.length}`);
console.log(`   - Active week: ${Math.max(...weeks.map(Number)) || 1}`);
console.log(`   - Season leaders (1-Flex): ${data.seasonLeaders?.oneFlexUsers?.length || 0}`);
console.log(`   - Season leaders (2-Flex): ${data.seasonLeaders?.twoFlexUsers?.length || 0}`);
console.log('');
console.log('📋 Next steps:');
console.log('1. Copy the JSON content from each file');
console.log('2. Upload to Shopify page metafields (see INSTRUCTIONS.md)');
console.log('3. Use the leaderboard-metafields.liquid section');