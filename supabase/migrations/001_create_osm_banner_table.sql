-- Create the OSM Banner table for storing scouting information
CREATE TABLE IF NOT EXISTS osm_banner (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name VARCHAR(255) NOT NULL,
  age INTEGER NOT NULL,
  market_value VARCHAR(100) NOT NULL,
  position VARCHAR(10) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 10),
  image_url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_osm_banner_updated_at ON osm_banner(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE osm_banner ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to read the banner
CREATE POLICY "Allow public read access to osm_banner"
  ON osm_banner
  FOR SELECT
  USING (true);

-- Create policy to allow only authenticated users to insert/update
CREATE POLICY "Allow authenticated users to manage banner"
  ON osm_banner
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated_user');

CREATE POLICY "Allow authenticated users to update banner"
  ON osm_banner
  FOR UPDATE
  USING (auth.role() = 'authenticated_user');

-- Insert a default banner entry
INSERT INTO osm_banner (player_name, age, market_value, position, rating, image_url, description)
VALUES (
  'Palmason',
  15,
  '€500K',
  'ST',
  8,
  'https://i.ibb.co/tMSMxmwN/Gemini-Generated-Image-ticrt2ticrt2ticr.png',
  'Market with a player: Palmason of 15 years old'
)
ON CONFLICT DO NOTHING;
