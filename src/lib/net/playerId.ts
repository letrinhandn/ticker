const KEY = "plotparty_player_id";
const NAME_KEY = "plotparty_display_name";

export function getOrCreatePlayerId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function getDisplayName(): string {
  if (typeof window === "undefined") return "Guest";
  return localStorage.getItem(NAME_KEY) ?? "";
}

export function setDisplayName(name: string) {
  localStorage.setItem(NAME_KEY, name.slice(0, 16));
}

export function randomRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}
