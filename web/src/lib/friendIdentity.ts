export function friendDisplayName(friend: { display_name: string; steam_persona_name?: string | null }) {
  return friend.steam_persona_name?.trim() || friend.display_name;
}
