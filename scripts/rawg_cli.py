import os
import httpx
import argparse
from dotenv import load_dotenv
load_dotenv()
api_key = os.getenv("RAWG_API_KEY")
if api_key is None:
    raise Exception("RAWG_API_KEY not set")
parser = argparse.ArgumentParser(description="Enter the name of the game")
parser.add_argument("game", help="Name of the game")
args = parser.parse_args()
response = httpx.get(f"https://api.rawg.io/api/games?key={api_key}&search={args.game}")
if response.status_code != 200:
    print("Game not found")
    exit()
data = response.json()
results = data["results"]
if len(results) == 0:
    raise Exception("No games found")
limited_results = results[ :10]
for game in limited_results:
    platforms_list = []
    game_name = game.get("name")
    for platform_item in game["platforms"]:
        platforms_list.append(platform_item["platform"]["name"])
    released = game.get("released")
    if released is not None:
        released = (released[0:4])
    else:
        print("Release date not set")
        continue
    platforms_str = ", ".join(platforms_list)
    print(f"Name:{game_name},"
          f" Year: {released},"
          f" Platforms: {platforms_str}")