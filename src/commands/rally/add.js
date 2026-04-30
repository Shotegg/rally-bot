import { rallyRepo } from '../../storage/rallyRepo.js';
import { resultEmbed } from '../../ui/embeds.js';
import { TARGETS } from '../../domain/targets.js';
import { addSideOption, addTargetOption } from './shared.js';

export function registerAdd(builder) {
  builder.addSubcommand(sc => {
    sc.setName('add')
      .setDescription('Add/update creator (ally/enemy)')
      .addUserOption(o => o.setName('user').setDescription('Discord user to mention in results').setRequired(false))
      .addStringOption(o => o.setName('name').setDescription('Creator name (fallback/manual)').setRequired(false));

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
  const pickedUser = interaction.options.getUser('user');
  const manualName = interaction.options.getString('name');
  const name = pickedUser ? `<@${pickedUser.id}>` : (manualName ? manualName.trim() : '');
  const bufferSec = interaction.options.getInteger('buffer_sec') ?? 0;
  const defaultTarget = interaction.options.getString('default_target') || '';
  const enabled = interaction.options.getBoolean('enabled');

  if (!name) {
    await interaction.reply({
      content: 'You must provide either `user` or `name`.',
      ephemeral: true
    });
    return;
  }

  const creator = await rallyRepo.upsertCreator({
    guildId,
    side,
    name,
    targets: TARGETS,
    bufferSec,
    enabled: enabled ?? true,
    defaultTarget
  });

  const looksLikePlainAt = /^@[^<\s].+/.test(creator.name) && !/^<@!?\d+>$/.test(creator.name);
  const mentionHint = looksLikePlainAt
    ? 'warning: plain `@username` text will not ping. Use a real mention token like `<@123456789012345678>`.'
    : null;

  await interaction.reply({
    embeds: [resultEmbed({
      title: `Saved ${side}: ${creator.name}`,
      lines: [
        `enabled: **${creator.enabled ? 'yes' : 'no'}**`,
        `buffer: **${creator.buffer_sec}s**`,
        `default target: **${creator.default_target || '(none)'}**`,
        `targets: ${TARGETS.join(', ')}`,
        ...(mentionHint ? [mentionHint] : [])
      ]
    })],
    ephemeral: true
  });
}
