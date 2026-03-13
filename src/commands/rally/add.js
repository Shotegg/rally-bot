import { rallyRepo } from '../../storage/rallyRepo.js';
import { resultEmbed } from '../../ui/embeds.js';
import { TARGETS } from '../../domain/targets.js';
import { addSideOption, addTargetOption } from './shared.js';

export function registerAdd(builder) {
  builder.addSubcommand(sc => {
    sc.setName('add')
      .setDescription('Add/update creator (ally/enemy)')
      .addStringOption(o => o.setName('name').setDescription('Creator name').setRequired(true));

    addSideOption(sc);
    sc.addIntegerOption(o => o.setName('buffer_sec').setDescription('Buffer seconds (optional)').setRequired(false))
      .addBooleanOption(o => o.setName('enabled').setDescription('Include in calculate').setRequired(false));
    addTargetOption(sc, { required: false, name: 'default_target', description: 'Default target for calculate' });
    return sc;
  });
}

export async function handleAdd(interaction) {
  const guildId = interaction.guildId;
  const side = interaction.options.getString('side', true);
  const name = interaction.options.getString('name', true);
  const bufferSec = interaction.options.getInteger('buffer_sec') ?? 0;
  const defaultTarget = interaction.options.getString('default_target') || '';
  const enabled = interaction.options.getBoolean('enabled');

  const creator = await rallyRepo.upsertCreator({
    guildId,
    side,
    name,
    targets: TARGETS,
    bufferSec,
    enabled: enabled ?? true,
    defaultTarget
  });

  await interaction.reply({
    embeds: [resultEmbed({
      title: `Saved ${side}: ${creator.name}`,
      lines: [
        `enabled: **${creator.enabled ? 'yes' : 'no'}**`,
        `buffer: **${creator.buffer_sec}s**`,
        `default target: **${creator.default_target || '(none)'}**`,
        `targets: ${TARGETS.join(', ')}`
      ]
    })],
    ephemeral: true
  });
}
