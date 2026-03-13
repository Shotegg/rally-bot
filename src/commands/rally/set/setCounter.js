import { rallyRepo } from '../../../storage/rallyRepo.js';
import { resultEmbed } from '../../../ui/embeds.js';
import { addTargetOption } from '../shared.js';

export function registerSetCounter(builder) {
  builder.addSubcommand(sc => {
    sc.setName('set-counter')
      .setDescription('Enable/disable counter for a target')
      .addStringOption(o =>
        o.setName('name')
          .setDescription('Ally name')
          .setRequired(true)
      )
      .addBooleanOption(o => o.setName('enabled').setDescription('true/false').setRequired(true));

    addTargetOption(sc);
    return sc;
  });
}

export async function handleSetCounter(interaction) {
  const guildId = interaction.guildId;
  const name = interaction.options.getString('name', true);
  const target = interaction.options.getString('target', true);
  const enabled = interaction.options.getBoolean('enabled', true);

  const creator = await rallyRepo.getCreatorByName({ guildId, side: 'ally', name });
  if (!creator) {
    await interaction.reply({ content: `Creator not found: ally ${name}`, ephemeral: true });
    return;
  }

  await rallyRepo.setCounterTarget({ guildId, creatorId: creator.id, target, enabled });
  await interaction.reply({
    embeds: [resultEmbed({ title: 'Counter updated', lines: [`**${creator.name}** @ **${target}** = **${enabled ? 'on' : 'off'}**`] })],
    ephemeral: true
  });
}
