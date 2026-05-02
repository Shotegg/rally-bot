import { rallyRepo } from '../../../storage/rallyRepo.js';
import { resultEmbed } from '../../../ui/embeds.js';
import { addSideOption, addTargetOption } from '../shared.js';

export function registerSetTarget(builder) {
  builder.addSubcommand(sc => {
    sc.setName('set-target')
      .setDescription('Set default target for calculate')
      .addStringOption(o => o.setName('name').setDescription('Creator name').setRequired(true).setAutocomplete(true));

    addSideOption(sc);
    addTargetOption(sc);
    return sc;
  });
}

export async function handleSetTarget(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guildId;
  const side = interaction.options.getString('side', true);
  const name = interaction.options.getString('name', true);
  const target = interaction.options.getString('target', true);

  const creator = await rallyRepo.getCreatorByName({ guildId, side, name });
  if (!creator) {
    await interaction.editReply({ content: `Creator not found: ${side} ${name}` });
    return;
  }

  await rallyRepo.setDefaultTarget({ guildId, creatorId: creator.id, target });
  await interaction.editReply({
    embeds: [resultEmbed({ title: 'Default target saved', lines: [`**${creator.name}** -> **${target}**`] })],
  });
}
