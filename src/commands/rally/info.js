import { rallyRepo } from '../../storage/rallyRepo.js';
import { resultEmbed } from '../../ui/embeds.js';
import { TARGETS } from '../../domain/targets.js';
import { creatorTravelTime } from '../../domain/creatorTiming.js';
import { addSideOption, addTargetOption } from './shared.js';

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
      .setDescription('Show a creator or all timings for a target')
      .addStringOption(o => o.setName('name').setDescription('Creator name').setRequired(false).setAutocomplete(true));

    addSideOption(sc, { required: false });
    addTargetOption(sc, { required: false, description: 'Show every creator march time to this target' });
    return sc;
  });
}

async function showTargetInfo(interaction, { guildId, target }) {
  const [allies, enemies] = await Promise.all([
    rallyRepo.listCreators({ guildId, side: 'ally' }),
    rallyRepo.listCreators({ guildId, side: 'enemy' })
  ]);
  const toLines = (label, creators) => {
    const rows = creators
      .map(creator => ({ creator, travelSec: creatorTravelTime(creator, target) }))
      .sort((a, b) => (b.travelSec ?? -Infinity) - (a.travelSec ?? -Infinity));
    return [
      `**${label}**`,
      ...(rows.length
        ? rows.map(({ creator, travelSec }) => `${creator.display_name || creator.name}: **${formatTravelSec(travelSec)}**${creator.enabled ? '' : ' _(disabled)_'}`)
        : ['(none)'])
    ];
  };

  await interaction.editReply({
    embeds: [resultEmbed({
      title: `March times → ${target}`,
      lines: [...toLines('Allies', allies), ...toLines('Enemies', enemies)]
    })]
  });
}

export async function handleInfo(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guildId;
  const side = interaction.options.getString('side');
  const name = interaction.options.getString('name');
  const target = interaction.options.getString('target');

  if (target && !name) {
    await showTargetInfo(interaction, { guildId, target });
    return;
  }
  if (!name || !side) {
    await interaction.editReply({ content: 'Choose either a `target`, or both a creator `name` and `side`.' });
    return;
  }
  if (target) {
    await interaction.editReply({ content: 'Use either a creator name or a target, not both.' });
    return;
  }

  const creator = await rallyRepo.getCreatorByName({ guildId, side, name });
  if (!creator) {
    await interaction.editReply({ content: `Creator not found: ${side} ${name}` });
    return;
  }
  const timingLines = TARGETS.map(t => `${t}: **${formatTravelSec(creatorTravelTime(creator, t))}**`);
  const enabledCounters = TARGETS.filter(t => Boolean(creator.counter_targets?.[t]));
  const counterSummary = enabledCounters.length ? enabledCounters.join(', ') : 'none';

  await interaction.editReply({
    embeds: [resultEmbed({
      title: `${side}: ${creator.display_name || creator.name}`,
      lines: [
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
  });
}
