import { rallyRepo } from '../../storage/rallyRepo.js';
import { addSideOption } from './shared.js';

export function registerDelete(builder) {
  builder.addSubcommand(sc => {
    sc.setName('delete')
      .setDescription('Delete a creator by name')
      .addStringOption(o => o.setName('name').setDescription('Creator name').setRequired(true));

    addSideOption(sc);
    return sc;
  });
}

export async function handleDelete(interaction) {
  const guildId = interaction.guildId;
  const side = interaction.options.getString('side', true);
  const name = interaction.options.getString('name', true);

  const creator = await rallyRepo.getCreatorByName({ guildId, side, name });
  if (!creator) {
    await interaction.reply({ content: `Creator not found: ${side} ${name}`, ephemeral: true });
    return;
  }

  await rallyRepo.deleteCreatorByName({ guildId, side, name });
  await interaction.reply({ content: `Deleted ${side} creator: ${name}`, ephemeral: true });
}
