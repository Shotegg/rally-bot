import { rallyRepo } from '../../../storage/rallyRepo.js';
import { resultEmbed } from '../../../ui/embeds.js';
import { addSideOption } from '../shared.js';

export function registerSetEnabled(builder) {
  builder.addSubcommand(sc => {
    sc.setName('set-enabled')
      .setDescription('Include/exclude a creator in calculate')
      .addStringOption(o => o.setName('name').setDescription('Creator name').setRequired(true))
      .addBooleanOption(o => o.setName('enabled').setDescription('true/false').setRequired(true));

    addSideOption(sc);
    return sc;
  });
}

export async function handleSetEnabled(interaction) {
  const guildId = interaction.guildId;
  const side = interaction.options.getString('side', true);
  const name = interaction.options.getString('name', true);
  const enabled = interaction.options.getBoolean('enabled', true);

  const creator = await rallyRepo.getCreatorByName({ guildId, side, name });
  if (!creator) {
    await interaction.reply({ content: `Creator not found: ${side} ${name}`, ephemeral: true });
    return;
  }

  await rallyRepo.setEnabled({ guildId, creatorId: creator.id, enabled });
  await interaction.reply({
    embeds: [resultEmbed({ title: 'Enabled updated', lines: [`**${creator.name}** = **${enabled ? 'on' : 'off'}**`] })],
    ephemeral: true
  });
}
