import asyncio
import json

from app.price_alerts import run_price_alerts_once


async def main() -> None:
    result = await run_price_alerts_once()
    print(json.dumps(result.__dict__, sort_keys=True))


if __name__ == "__main__":
    asyncio.run(main())
