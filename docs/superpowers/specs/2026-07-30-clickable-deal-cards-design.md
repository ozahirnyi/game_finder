# Clickable Deals Cards Design

## Goal

Open the internal PlayFinder game page when a user clicks the non-action area of a Deals card, while preserving a separate Steam link for the storefront.

## Interaction

- The hero deal and every compact deal card use the existing resolved internal game link.
- Clicking the card, cover, title, price, or empty card area opens that internal link.
- The Steam action remains a visible text link labelled `Open in Steam` and opens the Steam Store in a new tab.
- The `View on Playfinder` label is removed.

## Safety and Testing

The card must not contain nested anchors. The internal card link is rendered as a positioned overlay behind the Steam action, which keeps the Steam action independently clickable. A route test verifies the Steam-derived internal URL and the storefront URL.
