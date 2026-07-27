# Auth home link position design

## Goal

Place the existing home-navigation link outside the auth form card.

## Layout

On both `/login` and `/register`, the `← Back to PlayFinder` link is an absolutely
positioned child of the full-screen auth section, at the top-left of the viewport.
The centred authentication card does not contain the link and keeps its existing size
and content flow.

## Verification

Frontend tests retain the existing home destination assertion and add a layout assertion
that the link is outside the form card.
