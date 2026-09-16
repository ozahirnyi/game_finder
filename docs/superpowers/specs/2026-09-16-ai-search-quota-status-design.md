# AI search quota status

The AI search screen will query the existing authenticated recommendation quota endpoint when AI mode is selected. It will display the remaining daily requests, the daily reset time once exhausted, and the current cooldown time when applicable.

The submit button is disabled while the daily quota is exhausted or the one-minute cooldown is active. The quota query is invalidated after each AI request so the displayed count is refreshed from the server. Provider failures remain distinct from quota feedback.
