import 'dotenv/config';

export const config = {
  token: process.env.DISCORD_TOKEN,
  appId: process.env.APP_ID,
  guildId: process.env.GUILD_ID
};

if (!config.token || !config.appId || !config.guildId) {
  console.error('Missing env vars. Need DISCORD_TOKEN, APP_ID, GUILD_ID');
  process.exit(1);
}
