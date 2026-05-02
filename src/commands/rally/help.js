import { resultEmbed } from '../../ui/embeds.js';

export function registerHelp(builder) {
  builder.addSubcommand(sc =>
    sc.setName('help')
      .setDescription('Show help for rally commands')
  );
}

export async function handleHelp(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const lines = [
    'Use `/rally add` to create ally/enemy creators. Prefer the `user` option for real Discord pings.',
    'Use `/rally set-time` to save travel time per target.',
    'Use `/rally set-target` to set the default target used by `/rally calculate`.',
    'Use `/rally set-counter`, `/rally set-enemy-ally`, `/rally set-enabled` for filtering and toggles.',
    'Use `/rally calculate` for ally send times.',
    'Use the enemy matrix buttons from `/rally enemies` for enemy-based counter timings.',
    'Use `/rally export` and `/rally import` to sync creators/timings with your web UI.',
    'For real Discord pings in results, creators must be real mentions (`<@userId>`), not plain `@username` text.'
  ];

  await interaction.editReply({
    embeds: [resultEmbed({ title: 'Rally Bot Help', lines })],
  });
}
