import { resultEmbed } from '../../ui/embeds.js';

export function registerHelp(builder) {
  builder.addSubcommand(sc =>
    sc.setName('help')
      .setDescription('Show help for rally commands')
  );
}

export async function handleHelp(interaction) {
  const lines = [
    'Use `/rally add` to create ally/enemy creators.',
    'Use `/rally set-time` to save travel time per target.',
    'Use `/rally set-target` to set the default target used by `/rally calculate`.',
    'Use `/rally set-counter`, `/rally set-enemy-ally`, `/rally set-enabled` for filtering and toggles.',
    'Use `/rally calculate` for ally send times.',
    'Use the enemy matrix buttons from `/rally enemies` for enemy-based counter timings.',
    'Use `/rally export` and `/rally import` to sync creators/timings with your web UI.',
    'For real Discord pings in results, save creators as user mentions (example: `<@123456789012345678>`), not plain `@username` text.'
  ];

  await interaction.reply({
    embeds: [resultEmbed({ title: 'Rally Bot Help', lines })],
    ephemeral: true
  });
}
