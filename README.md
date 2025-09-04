# The Game The Podcast - Fantasy Football Scoreboard

A Node.js application that fetches Week 1 fantasy football scores for the Sleeper user "thegamethepodcast" and displays the top scorer from each league, plus the overall champion.

## Features

- 🏈 Fetches data from 100+ fantasy leagues
- 📊 Identifies top scorer in each league for any week
- 🏆 Finds overall champion across all leagues
- 🌐 Generates beautiful HTML scoreboard for GitHub Pages
- ⚡ Automated weekly updates via GitHub Actions

## Local Usage

### Console Output
```bash
npm start                    # Run for Week 1
npm run dev                 # Run with auto-reload
```

### HTML Generation
```bash
npm run generate-html       # Generate HTML for Week 1
npm run generate-html 2     # Generate HTML for Week 2
node generate-html.js 3     # Generate HTML for Week 3
```

## GitHub Actions

The project includes automated workflows that:

- **Manual Trigger**: Run anytime via GitHub Actions tab
- **Scheduled**: Runs every Tuesday at 6 AM EST (after Monday Night Football)
- **Deployment**: Automatically publishes results to GitHub Pages

### Setup GitHub Pages

1. Go to your repository Settings → Pages
2. Set Source to "GitHub Actions"
3. The workflow will automatically deploy to `https://[username].github.io/[repo-name]`

### Manual Trigger

1. Go to Actions tab in your GitHub repository
2. Click "Sleeper Fantasy Scoreboard"
3. Click "Run workflow"
4. Optionally specify a week number (defaults to Week 1)

## API Calls

The script logs all API calls made to the Sleeper API:
- `GET /user/thegamethepodcast` - Get user info
- `GET /user/{user_id}/leagues/nfl/2025` - Get user's leagues
- `GET /league/{league_id}/users` - Get league members
- `GET /league/{league_id}/matchups/{week}` - Get week scores

## Files

- `index.js` - Console application
- `generate-html.js` - HTML generator for GitHub Pages
- `sleeper-api.js` - Sleeper API wrapper with logging
- `.github/workflows/sleeper-scoreboard.yml` - GitHub Actions workflow
- `docs/index.html` - Generated HTML scoreboard (created by workflow)

## Dependencies

- `node-fetch` - HTTP client for API calls
- Node.js 18+ (ES modules)