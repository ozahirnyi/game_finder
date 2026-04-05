import os
import sys
import httpx
import argparse
from dotenv import load_dotenv
load_dotenv()
api_key = os.getenv("RAWG_API_KEY")
if api_key is None:
    print("API key not set")
    sys.exit(1)
parser = argparse.ArgumentParser(description="Enter the name of the game")
parser.add_argument("game", help="Name of the game")
args = parser.parse_args()
URL = "https://api.rawg.io/api/games"
params = {
    "key": api_key,
    "search": args.game
}
response = httpx.get(URL, params=params)
if response.status_code == 401 or response.status_code == 403:
    print("Invalid API key")
    sys.exit(1)
elif response.status_code == 429:
    print("Rate limit exceeded, try later")
    sys.exit(1)
elif response.status_code != 200:
    print(f"API error: {response.status_code}")
    sys.exit(1)
data = response.json()
results = data["results"]
if len(results) == 0:
    print("Game not found")
    sys.exit(1)
limited_results = results[ :10]
for game in limited_results:
    platforms_list = []
    game_name = game.get("name")
    platforms = game.get("platforms")
    if platforms is None:
        platforms = []
    for platform_item in platforms:
        platforms_list.append(platform_item["platform"]["name"])
    released = game.get("released")
    if released is not None:
        released = (released[0:4])
    else:
        released = "N/A"
    platforms_str = ", ".join(platforms_list)
    print(f"Name:{game_name},"
          f" Year: {released},"
          f" Platforms: {platforms_str}")