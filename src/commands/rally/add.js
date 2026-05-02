import { rallyRepo } from '../../storage/rallyRepo.js';
import { resultEmbed } from '../../ui/embeds.js';
import { TARGETS } from '../../domain/targets.js';
import { addSideOption, addTargetOption } from './shared.js';

export function registerAdd(builder) {
  builder.addSubcommand(sc => {
    sc.setName('add')
      .setDescription('Add/update creator (ally/enemy)');

    addSideOption(sc);
    sc.addUserOption(o => o.setName('user').setDescription('Discord user to mention in results').setRequired(false))
      .addStringOption(o => o.setName('name').setDescription('Creator name (fallback/manual)').setRequired(false))
      .addStringOption(o => o.setName('nickname').setDescription('Friendly display name (optional)').setRequired(false));
    sc.addIntegerOption(o => o.setName('buffer_sec').setDescription('Buffer seconds (optional)').setRequired(false))
      .addBooleanOption(o => o.setName('enabled').setDescription('Include in calculate').setRequired(false));
    addTargetOption(sc, { required: false, name: 'default_target', description: 'Default target for calculate' });
    return sc;
  });
}

export async function handleAdd(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guildId;
  const side = interaction.options.getString('side', true);
  const pickedUser = interaction.options.getUser('user');
  const manualName = interaction.options.getString('name');
  const nickname = (interaction.options.getString('nickname') || '').trim();
  const name = pickedUser ? `<@${pickedUser.id}>` : (manualName ? manualName.trim() : '');
  const displayName = nickname || (pickedUser ? (pickedUser.globalName || pickedUser.username) : name);
  const discordUserId = pickedUser?.id || '';
  const bufferSec = interaction.options.getInteger('buffer_sec') ?? 0;
  const defaultTarget = interaction.options.getString('default_target') || '';
  const enabled = interaction.options.getBoolean('enabled');

  if (!name) {
    await interaction.editReply({
      content: 'You must provide either `user` or `name`.',
    });
    return;
  }

  const creator = await rallyRepo.upsertCreator({
    guildId,
    side,
    name,
    displayName,
    discordUserId,
    targets: TARGETS,
    bufferSec,
    enabled: enabled ?? true,
    defaultTarget
  });

  const looksLikePlainAt = /^@[^<\s].+/.test(creator.name) && !/^<@!?\d+>$/.test(creator.name);
  const mentionHint = looksLikePlainAt
    ? 'warning: plain `@username` text will not ping. Use a real mention token like `<@123456789012345678>`.'
    : null;

  await interaction.editReply({
    embeds: [resultEmbed({
      title: `Saved ${side}: ${creator.display_name || creator.name}`,
      lines: [
        `creator key: **${creator.name}**`,
        `display name: **${creator.display_name || creator.name}**`,
        `enabled: **${creator.enabled ? 'yes' : 'no'}**`,
        `buffer: **${creator.buffer_sec}s**`,
        `default target: **${creator.default_target || '(none)'}**`,
        `targets: ${TARGETS.join(', ')}`,
        ...(mentionHint ? [mentionHint] : [])
      ]
    })]
  });
}
