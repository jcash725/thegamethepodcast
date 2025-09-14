# Shopify Metafields Upload Instructions

## Step 1: Go to your Shopify page
1. In Shopify Admin, go to **Online Store > Pages**
2. Find your leaderboard page (or create new page with template suffix "leaderboard-metafields")
3. Click **"Edit"**

## Step 2: Add metafields
1. Scroll down and click **"Show all"** or look for **"Metafields"** section
2. Click **"Add metafield"**

Add these three metafields:

### Metafield 1: weeks_data
- **Namespace**: `leaderboard`
- **Key**: `weeks_data`
- **Type**: `JSON`
- **Value**: Copy entire content from `weeks_data.json`

### Metafield 2: season_data
- **Namespace**: `leaderboard`
- **Key**: `season_data`
- **Type**: `JSON`
- **Value**: Copy entire content from `season_data.json`

### Metafield 3: settings
- **Namespace**: `leaderboard`
- **Key**: `settings`
- **Type**: `JSON`
- **Value**: Copy entire content from `settings.json`

## Step 3: Update page template
Make sure your page uses the metafields section:
```liquid
{% section 'leaderboard-metafields' %}
```

## Weekly Updates
1. Run your main Node.js script to update weekly-data.json
2. Run: `node shopify/convert-to-metafields.js`
3. Copy-paste the new JSON content into the three metafields
4. Save the page - it will automatically update!

---
Generated: 9/13/2025, 10:55:10 PM
Total weeks: 2
Active week: 2
Season leaders (1-Flex): 10
Season leaders (2-Flex): 10
