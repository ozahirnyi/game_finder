# Trending recommendation data fallback

## Goal

Return visible recommendations when Steam deal candidates are unavailable or empty.

## Behaviour

- Use Steam deal candidates for personalised recommendations when they exist.
- If that source yields no usable candidates, load up to six RAWG trending games.
- Exclude titles already owned in Steam or saved in the PlayFinder Library.
- Label these results as popular games; preserve the current cache and response shape.

## Verification

Cover an empty Steam candidate response and assert that non-owned RAWG trending games are returned as recommendations.
