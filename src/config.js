import 'dotenv/config';

const parsedGuildIds = (process.env.GUILD_IDS || process.env.GUILD_ID || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

const dashboardGuildId = process.env.DASHBOARD_GUILD_ID || '1438650222489239575';

export const config = {
  token: process.env.DISCORD_TOKEN,
  appId: process.env.APP_ID,
  guildIds: [...new Set(parsedGuildIds)],
  dashboardToken: process.env.DASHBOARD_TOKEN || '',
  dashboardGuildId,
  ownKingdomId: process.env.OWN_KINGDOM_ID || '342',
  dashboardOrigin: process.env.DASHBOARD_ORIGIN || 'https://shotegg.github.io',
  mightPulseApiKey: process.env.MIGHTPULSE_API_KEY || ''
};

if (!config.token || !config.appId || !config.guildIds.length) {
  console.error('Missing env vars. Need DISCORD_TOKEN, APP_ID, and GUILD_IDS (or GUILD_ID).');
  process.exit(1);
}
