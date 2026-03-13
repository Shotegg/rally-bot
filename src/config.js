import 'dotenv/config';

const parsedGuildIds = (process.env.GUILD_IDS || process.env.GUILD_ID || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

export const config = {
  token: process.env.DISCORD_TOKEN,
  appId: process.env.APP_ID,
  guildIds: [...new Set(parsedGuildIds)]
};

if (!config.token || !config.appId || !config.guildIds.length) {
  console.error('Missing env vars. Need DISCORD_TOKEN, APP_ID, and GUILD_IDS (or GUILD_ID).');
  process.exit(1);
}
