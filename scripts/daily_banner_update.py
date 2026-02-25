#!/usr/bin/env python3
"""
Daily Banner Auto-Update Script for OSM Counter NG

This script runs daily to fetch new OSM scouting options and update the banner.
It uses an LLM to generate realistic young talented players for OSM.

Usage:
    python3 scripts/daily_banner_update.py

Schedule with cron:
    0 8 * * * cd /path/to/osm-counter-pwa && python3 scripts/daily_banner_update.py
"""

import json
import os
import sys
from datetime import datetime
from typing import Optional, Dict, Any

import requests
from openai import OpenAI


class BannerUpdater:
    """Handles daily banner updates for OSM Counter NG"""

    def __init__(self):
        """Initialize the banner updater with Supabase and OpenAI clients"""
        self.supabase_url = "https://egzquylwclewcgpqnoig.supabase.co"
        self.supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        self.openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        if not self.supabase_key:
            print("❌ SUPABASE_SERVICE_ROLE_KEY environment variable is not set")
            sys.exit(1)

    def generate_new_player(self) -> Optional[Dict[str, Any]]:
        """Generate a new OSM scouting player using LLM"""
        prompt = """You are an OSM (Online Soccer Manager) scouting expert. Generate a realistic young talented player that would be interesting for the OSM community.

Generate a JSON response with the following structure:
{
  "playerName": "Player's full name",
  "age": number between 15-22,
  "marketValue": "Market value in euros (e.g., €500K, €1.2M)",
  "position": "Position code (ST, CM, LB, CB, GK, etc.)",
  "rating": number between 6-9,
  "description": "Brief scouting report (1-2 sentences about potential and playing style)"
}

Make sure the player is realistic and interesting for OSM players. Vary the positions and nationalities."""

        try:
            print("🤖 Generating new player with LLM...")
            response = self.openai_client.chat.completions.create(
                model="gpt-4.1-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=300,
            )

            content = response.choices[0].message.content or ""

            # Extract JSON from the response
            start_idx = content.find("{")
            end_idx = content.rfind("}") + 1

            if start_idx == -1 or end_idx == 0:
                print("❌ Could not extract JSON from LLM response")
                return None

            json_str = content[start_idx:end_idx]
            player_data = json.loads(json_str)

            # Validate the data
            required_fields = [
                "playerName",
                "age",
                "marketValue",
                "position",
                "rating",
                "description",
            ]
            if not all(field in player_data for field in required_fields):
                print("❌ Invalid player data structure")
                return None

            # Generate a placeholder image URL
            player_data["imageUrl"] = (
                "https://i.ibb.co/tMSMxmwN/Gemini-Generated-Image-ticrt2ticrt2ticr.png"
            )

            return player_data

        except Exception as error:
            print(f"❌ Error generating player: {error}")
            return None

    def update_banner(self, player: Dict[str, Any]) -> bool:
        """Update the banner with a new player"""
        try:
            url = f"{self.supabase_url}/rest/v1/osm_banner"
            headers = {
                "apikey": self.supabase_key,
                "Authorization": f"Bearer {self.supabase_key}",
                "Content-Type": "application/json",
            }

            payload = {
                "player_name": player["playerName"],
                "age": player["age"],
                "market_value": player["marketValue"],
                "position": player["position"],
                "rating": player["rating"],
                "image_url": player["imageUrl"],
                "description": player["description"],
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            }

            response = requests.post(url, json=payload, headers=headers, timeout=10)

            if response.status_code not in [200, 201]:
                print(f"❌ Supabase error: {response.status_code} - {response.text}")
                return False

            print(
                f"✅ Banner updated with: {player['playerName']} ({player['age']} years old, {player['position']})"
            )
            return True

        except Exception as error:
            print(f"❌ Error updating banner: {error}")
            return False

    def run(self) -> None:
        """Main execution function"""
        print("🎯 Starting daily banner auto-update...")
        print(f"📅 Time: {datetime.utcnow().isoformat()}")

        # Generate new player
        new_player = self.generate_new_player()
        if not new_player:
            print("❌ Failed to generate new player")
            sys.exit(1)

        print(f"📊 Generated player: {new_player['playerName']}")
        print(f"   Age: {new_player['age']}")
        print(f"   Position: {new_player['position']}")
        print(f"   Rating: {new_player['rating']}/10")
        print(f"   Market Value: {new_player['marketValue']}")

        # Update banner
        print("💾 Updating banner in Supabase...")
        success = self.update_banner(new_player)

        if success:
            print("✅ Daily banner update completed successfully!")
            sys.exit(0)
        else:
            print("❌ Failed to update banner")
            sys.exit(1)


if __name__ == "__main__":
    updater = BannerUpdater()
    updater.run()
