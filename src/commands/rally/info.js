import { rallyRepo } from '../../storage/rallyRepo.js';
import { resultEmbed } from '../../ui/embeds.js';
import { TARGETS } from '../../domain/targets.js';
import { addSideOption } from './shared.js';
import { buildCreatorQuickActionRows } from '../../components/creatorQuickActions.js';

function formatTravelSec(total) {
  const n = Number(total);
  if (!Number.isFinite(n) || n < 0) return '-';
  const min = Math.floor(n / 60);
  const sec = n % 60;
  return `${min}m ${String(sec).padStart(2, '0')}s`;
}

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
  const timings = await rallyRepo.listTimingsForCreator({ guildId, creatorId: creator.id });
  const timingByTarget = new Map(timings.map(t => [t.target, t.travel_sec]));
  const timingLines = TARGETS.map(t => `${t}: **${formatTravelSec(timingByTarget.get(t))}**`);
  const enabledCounters = TARGETS.filter(t => Boolean(creator.counter_targets?.[t]));
  const counterSummary = enabledCounters.length ? enabledCounters.join(', ') : 'none';

  await interaction.reply({
    embeds: [resultEmbed({
      title: `${side}: ${creator.display_name || creator.name}`,
      lines: [
        `creator key: **${creator.name}**`,
        ...(creator.discord_user_id ? [`user id: **${creator.discord_user_id}**`] : []),
        `enabled: **${creator.enabled ? 'yes' : 'no'}**`,
        `buffer: **${creator.buffer_sec}s**`,
        `default target: **${creator.default_target || '(none)'}**`,
        `counter: **${counterSummary}**`,
        ...timingLines,
        ...(side === 'enemy'
          ? [`enemy allies: ${(creator.enemy_allies?.length ? creator.enemy_allies.join(', ') : '(none)')}`]
          : [])
      ]
    })],
    components: buildCreatorQuickActionRows({ side, creator }),
    ephemeral: true
  });
}
