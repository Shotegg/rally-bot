import { rallyRepo } from '../../storage/rallyRepo.js';
import { resultEmbed } from '../../ui/embeds.js';
import { TARGETS } from '../../domain/targets.js';
import { addSideOption } from './shared.js';
import { buildCreatorQuickActionRows } from '../../components/creatorQuickActions.js';

export function registerInfo(builder) {
  builder.addSubcommand(sc => {
    sc.setName('info')
      .setDescription('Show creator details')
      .addStringOption(o => o.setName('name').setDescription('Creator name').setRequired(true).setAutocomplete(true));

    addSideOption(sc);
    return sc;
  });
}

export async function handleInfo(interaction) {
  const guildId = interaction.guildId;
  const side = interaction.options.getString('side', true);
  const name = interaction.options.getString('name', true);

  const creator = await rallyRepo.getCreatorByName({ guildId, side, name });
  if (!creator) {
    await interaction.reply({ content: `Creator not found: ${side} ${name}`, ephemeral: true });
    return;
  }

  await interaction.reply({
    embeds: [resultEmbed({
      title: `${side}: ${creator.name}`,
      lines: [
        `enabled: **${creator.enabled ? 'yes' : 'no'}**`,
        `buffer: **${creator.buffer_sec}s**`,
        `default target: **${creator.default_target || '(none)'}**`,
        `targets: ${TARGETS.join(', ')}`,
        ...(side === 'enemy'
          ? [`enemy allies: ${(creator.enemy_allies?.length ? creator.enemy_allies.join(', ') : '(none)')}`]
          : [])
      ]
    })],
    components: buildCreatorQuickActionRows({ side, creator }),
    ephemeral: true
  });
}
