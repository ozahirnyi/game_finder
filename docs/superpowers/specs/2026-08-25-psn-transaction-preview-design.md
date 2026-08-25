# PSN transaction import preview

## Goal

Import playable games from a PlayStation privacy-export workbook without
silently adding subscriptions, DLC, demos, bundles, or other purchases to a
user's library.

## Source handling

The importer reads the `Transaction Detail` sheet even when PlayStation wraps
its name in quotes. Its headers begin after the introductory text and section
label. `Game Name` is the candidate title; `Content Type` is not used to decide
whether the purchase is a game because real exports use values such as
`Violence` there.

Only purchase rows are candidates. Duplicated names are collapsed before
matching.

## Matching and preview

Each candidate is searched in the existing game catalog. A single confident
catalog match becomes a preselected import item. No match or an ambiguous match
becomes an unchecked review item and is not imported automatically.

The preview lists the candidate title, matching status, and selected state. The
user can include or exclude individual items before submitting. The server
imports only the selected catalog-backed matches.

## Safety and errors

If the workbook has no transaction candidates, show the existing clear empty
export message. If candidates exist but none can be matched, show them for
review instead of reporting that the export is empty. The flow must never add
an unmatched title automatically.

## Testing

Regression coverage uses a Transaction Detail worksheet shaped like the real
PSN export: quoted sheet name, introductory rows, `Violence` content type, and
game names. UI tests cover confirmed items being selected by default and
unmatched items remaining unselected.
