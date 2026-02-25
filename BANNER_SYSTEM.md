# 🎯 OSM Counter NG — Banner Management System

This document describes the automated banner update system for displaying new OSM scouting options.

---

## Overview

The banner system allows you to:
- **Manually update** the banner with new scouting options via an admin interface
- **Automatically update** the banner daily with AI-generated realistic players
- **Track history** of all banner entries
- **Display dynamic content** that changes without redeploying the app

---

## Architecture

### Database Schema

The system uses a Supabase table called `osm_banner`:

```sql
CREATE TABLE osm_banner (
  id UUID PRIMARY KEY,
  player_name VARCHAR(255) NOT NULL,
  age INTEGER NOT NULL,
  market_value VARCHAR(100) NOT NULL,
  position VARCHAR(10) NOT NULL,
  rating INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Components

#### 1. **Banner Manager Library** (`src/lib/bannerManager.ts`)
Core functions for database operations:
- `fetchBannerData()` — Get the latest banner entry
- `createBannerEntry()` — Create a new banner entry
- `updateBannerData()` — Update existing banner
- `getBannerHistory()` — Retrieve all past banners

#### 2. **Admin Component** (`src/components/BannerAdmin.tsx`)
React component providing:
- Form to input player information
- Real-time validation
- Success/error messages
- History view of past banners
- Edit button on the banner itself

#### 3. **Frontend Integration** (`src/App.tsx`)
- Loads banner data on app startup
- Displays dynamic banner with image and player info
- Shows "Edit" button to open admin panel
- Automatically refreshes banner after updates

#### 4. **Auto-Update Scripts**
- `scripts/daily_banner_update.py` — Python version (recommended)
- `scripts/daily-banner-update.ts` — TypeScript version

---

## Setup Instructions

### Step 1: Run the Supabase Migration

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **SQL Editor**
4. Create a new query
5. Copy the contents of `supabase/migrations/001_create_osm_banner_table.sql`
6. Run the query

This will create the `osm_banner` table with proper permissions.

### Step 2: Deploy Updated App

Push the changes to GitHub:

```bash
git add .
git commit -m "feat: add automated banner management system"
git push origin main
```

Vercel will automatically deploy the updated app with the admin interface.

### Step 3: Set Up Environment Variables

For the daily auto-update to work, ensure these environment variables are set:

```bash
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_api_key
```

**Where to find these:**
- **SUPABASE_SERVICE_ROLE_KEY**: Supabase Dashboard → Project Settings → API → Service Role (secret)
- **OPENAI_API_KEY**: OpenAI Dashboard → API Keys

### Step 4: Test the Admin Interface

1. Visit your app: https://osm-counter-pwa.vercel.app
2. Look for the **✏️ Edit** button on the banner
3. Click it to open the admin panel
4. Fill in the player information
5. Click **✅ Update Banner**
6. The banner should update instantly

---

## Manual Banner Updates

### Using the Admin Interface

1. Click the **✏️ Edit** button on the banner
2. Fill in the player details:
   - **Player Name** — Full name of the player
   - **Age** — Player's age (15-22 recommended)
   - **Position** — Position code (ST, CM, LB, CB, GK, etc.)
   - **Rating** — Rating from 1-10
   - **Market Value** — Value in euros (e.g., €500K, €1.2M)
   - **Image URL** — URL to player image
   - **Description** — Brief scouting report

3. Click **✅ Update Banner**
4. See the confirmation message
5. The banner updates within seconds

### Using Direct Database Insert

You can also insert directly into Supabase:

```sql
INSERT INTO osm_banner (player_name, age, market_value, position, rating, image_url, description)
VALUES ('Palmason', 15, '€500K', 'ST', 8, 'https://...', 'Young striker with great potential');
```

---

## Automatic Daily Updates

### How It Works

1. **Daily Trigger**: Every day at **8 AM UTC**, the scheduled task runs
2. **LLM Generation**: OpenAI generates a realistic young player
3. **Database Insert**: The new player is added to the `osm_banner` table
4. **Frontend Update**: The app automatically fetches and displays the new banner

### Running Manually

#### Using Python (Recommended)

```bash
cd /home/ubuntu/osm-counter-pwa
python3 scripts/daily_banner_update.py
```

#### Using TypeScript

```bash
cd /home/ubuntu/osm-counter-pwa
npx ts-node scripts/daily-banner-update.ts
```

### Monitoring

Check the logs to verify the task is running:

```bash
# View recent executions
tail -f /var/log/osm-banner-update.log
```

---

## Customization

### Change the Update Time

Edit the cron expression in the scheduled task. Current: `0 8 * * *` (8 AM UTC daily)

Examples:
- `0 12 * * *` — 12 PM UTC daily
- `0 */6 * * *` — Every 6 hours
- `0 8 * * 1` — Every Monday at 8 AM UTC

### Modify Player Generation

Edit `scripts/daily_banner_update.py` and change the LLM prompt:

```python
prompt = """Your custom prompt here..."""
```

### Change Image URLs

Update the `imageUrl` in the script or use a real image service:

```python
# Example: Use a placeholder service
player_data["imageUrl"] = f"https://api.example.com/player/{player_data['playerName']}.png"
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Admin panel doesn't appear | Check browser console for errors; ensure BannerAdmin component is imported |
| Banner doesn't update | Verify Supabase connection; check SUPABASE_SERVICE_ROLE_KEY |
| Daily task doesn't run | Check environment variables are set; verify cron schedule |
| LLM generation fails | Ensure OPENAI_API_KEY is valid; check OpenAI account quota |
| Images don't load | Verify image URLs are accessible; use HTTPS URLs only |

---

## API Reference

### `fetchBannerData()`

Fetches the latest banner entry.

```typescript
const banner = await fetchBannerData();
// Returns: BannerData | null
```

### `createBannerEntry(bannerData)`

Creates a new banner entry.

```typescript
const success = await createBannerEntry({
  playerName: 'Palmason',
  age: 15,
  marketValue: '€500K',
  position: 'ST',
  rating: 8,
  imageUrl: 'https://...',
  description: 'Young striker with great potential',
});
// Returns: boolean
```

### `getBannerHistory()`

Retrieves all banner entries.

```typescript
const history = await getBannerHistory();
// Returns: BannerData[]
```

---

## Security Considerations

- **Row Level Security (RLS)**: The `osm_banner` table allows public read access but restricts writes to authenticated users
- **Service Role Key**: Never expose this in client-side code; only use in backend scripts
- **Image URLs**: Always use HTTPS URLs to avoid mixed content warnings

---

## Future Enhancements

- [ ] Add image upload functionality
- [ ] Integrate with real OSM API for live player data
- [ ] Add analytics to track banner impressions
- [ ] Support multiple banner slots
- [ ] Add A/B testing for different banners
- [ ] Integrate with Discord webhooks for notifications

---

## Support

For issues or questions, contact: support@osmtactical.com

---

**Last Updated**: February 25, 2026
