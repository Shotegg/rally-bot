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
    'Creator, enemy and march-time data are managed from the web page.',
    'Use `/rally info name:<name> side:<ally|enemy>` for one creator, or `/rally info target:<target>` for all march times to a target.',
    'Use `/rally calculate` for ally send times.',
    'Use the enemy matrix buttons from `/rally enemies` for enemy-based counter timings.',
    'Use `/rally export` to download the current data.',
    'For real Discord pings in results, creators must be real mentions (`<@userId>`), not plain `@username` text.'
  ];

  await interaction.editReply({
    embeds: [resultEmbed({ title: 'Rally Bot Help', lines })],
  });
}
