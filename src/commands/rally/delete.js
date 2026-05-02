import { rallyRepo } from '../../storage/rallyRepo.js';
import { addSideOption } from './shared.js';

export function registerDelete(builder) {
  builder.addSubcommand(sc => {
    sc.setName('delete')
      .setDescription('Delete a creator by name')
      .addStringOption(o => o.setName('name').setDescription('Creator name').setRequired(true).setAutocomplete(true));

    addSideOption(sc);
    return sc;
  });
}

export async function handleDelete(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guildId;
  const side = interaction.options.getString('side', true);
  const name = interaction.options.getString('name', true);

  const creator = await rallyRepo.getCreatorByName({ guildId, side, name });
  if (!creator) {
    await interaction.editReply({ content: `Creator not found: ${side} ${name}` });
    return;
  }

  await rallyRepo.deleteCreatorByName({ guildId, side, name });
  await interaction.editReply({ content: `Deleted ${side} creator: ${name}` });
}
