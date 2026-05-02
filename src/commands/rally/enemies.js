import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

import { rallyRepo } from '../../storage/rallyRepo.js';
import { resultEmbed } from '../../ui/embeds.js';

export function registerEnemies(builder) {
  builder.addSubcommand(sc =>
    sc.setName('enemies')
      .setDescription('Show enemies with buttons')
  );
}

export async function handleEnemies(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guildId;
  const enemies = await rallyRepo.listCreators({ guildId, side: 'enemy' });
  if (!enemies.length) {
    await interaction.editReply({ content: 'No enemies found. Use /rally add side:enemy ...' });
    return;
  }

  const modeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('enemyMode:target')
      .setLabel('counter by target')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('enemyMode:enemy')
      .setLabel('counter by enemy')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.editReply({
    embeds: [resultEmbed({
      title: 'Counter mode',
      lines: [
        'Choose how allies are selected for counter calculations.',
        `enemies loaded: **${enemies.length}**`
      ]
    })],
    components: [modeRow]
  });
}
