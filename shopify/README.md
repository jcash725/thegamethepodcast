# Shopify Leaderboard Theme Files

This folder contains Shopify Liquid templates for integrating the fantasy football leaderboard into a Shopify store.

## File Structure

```
shopify/
├── templates/
│   ├── page.leaderboard.liquid           # Simple 1-flex/2-flex only
│   ├── page.leaderboard-dynamic.liquid   # Simple dynamic version
│   └── page.leaderboard-complete.liquid  # Full weekly + category tabs
├── sections/
│   ├── leaderboard-hero.liquid           # Header with tabs and title
│   ├── leaderboard-tabs.liquid           # Manual data entry (simple)
│   ├── leaderboard-dynamic.liquid        # Dynamic data (simple)
│   ├── leaderboard-complete.liquid       # Manual weekly + categories
│   └── leaderboard-complete-dynamic.liquid # Dynamic weekly + categories
├── assets/
│   └── leaderboard.css                   # All styling for leaderboard
├── snippets/
│   └── leaderboard-row.liquid            # Reusable table row
└── README.md                             # This file
```

## Setup Instructions

### 1. Upload Assets
Copy these files to your Shopify theme assets folder:
- `leaderboard.css`
- `the-game-font-regular.woff2`
- `the-game-font-regular.woff`
- `the-game-font.ttf`
- `field-bg.png`
- `thegame_logo.png`
- `living-in-fantasy.png`

### 2. Upload Templates & Sections
- Upload `page.leaderboard.liquid` to your templates folder
- Upload all section files to your sections folder

### 3. Create Leaderboard Page
1. In Shopify Admin, go to Online Store > Pages
2. Create a new page with template suffix `leaderboard`
3. The page will automatically use the `page.leaderboard.liquid` template

## Template Options

### Simple Templates
**Option 1: Manual Entry (leaderboard-tabs.liquid)**
- Uses Shopify's section settings
- Only 1-Flex and 2-Flex tabs (like Shopify-only version)
- Manually add each leaderboard entry through the theme customizer
- Best for: Small datasets, complete control over display

**Option 2: Dynamic Data (leaderboard-dynamic.liquid)**
- Only 1-Flex and 2-Flex tabs 
- Pulls data from metafields or external APIs
- Currently has sample data - replace with your data source
- Best for: Large datasets, automated updates

### Complete Templates (Weekly + Categories)
**Option 3: Complete Manual (leaderboard-complete.liquid)**
- Full nested tab structure: Week 1, Week 2, etc. → 1-Flex/2-Flex for each week → Season Leaders
- Uses Shopify section blocks for manual data entry
- Each entry specifies: week, flex type, rank, team data
- Best for: Full control, matches main site structure

**Option 4: Complete Dynamic (leaderboard-complete-dynamic.liquid)**
- Full nested tab structure with automated data loading
- Replace sample JSON data with your data source
- Supports weekly data + season totals
- Best for: Large datasets, automated weekly updates

## Customization

### Theme Settings
Both sections include schema settings for:
- Header and footer images
- Tab text customization
- Table headers
- Individual entry data (manual version)

### Data Integration
To connect your fantasy football data:

1. **Metafields Approach:**
   ```liquid
   {% assign oneflex_data = page.metafields.leaderboard.oneflex_users.value %}
   {% for entry in oneflex_data %}
     <!-- Display entry data -->
   {% endfor %}
   ```

2. **External API Approach:**
   Use Shopify Scripts or a custom app to fetch and store data

3. **Manual Updates:**
   Use the section blocks in the theme customizer

## Mobile Responsiveness

The CSS includes full mobile responsiveness with:
- Tablet breakpoint: 768px
- Mobile breakpoint: 480px
- Optimized octagon shapes for all screen sizes
- Scrollable tabs on mobile

## Custom Fonts

The Game font is loaded via CSS with proper fallbacks:
```css
font-family: 'The Game', 'Bebas Neue', 'Arial Black', sans-serif;
```

## Color Scheme

- Navy blue (#1a365d): Headers, rank/points octagons
- White (#ffffff): Team/league octagons, text on navy
- Crimson red (#DC143C): Headers, accent colors
- Gold (#FFD700): Champion highlights

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- CSS clip-path for octagon shapes
- Fallback styling for older browsers

## Updates

To update leaderboard data:
1. Manual: Use theme customizer section settings
2. Dynamic: Update your data source (API, metafields, etc.)
3. Automated: Set up webhooks or scheduled tasks to refresh data