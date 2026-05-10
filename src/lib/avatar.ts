const colors = [
  "#0d9488", // teal
  "#0f766e", // teal-dark
  "#2563eb", // blue
  "#1e40af", // blue-dark
  "#7c3aed", // violet
  "#5b21b6", // violet-dark
  "#db2777", // pink
  "#be185d", // pink-dark
  "#d97706", // amber
  "#b45309", // amber-dark
];

export function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash;
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

export function getAvatarInitial(username: string): string {
  return username.charAt(0).toUpperCase();
}
