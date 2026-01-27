import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { rallyRepo } from '../storage/rallyRepo.js';
import { calculateAgainstEnemy, formatUtcTime } from '../domain/calc.js';
import { TARGETS } from '../domain/targets.js';
import { resultEmbed } from '../ui/embeds.js';

export async function handleAllyTimingsButton(interaction) {
  const guildId = interaction.guildId;
  const parts = interaction.customId.split(':');
  const enemyId = Number(parts[1]);
  const selectedTarget = parts[2] ? decodeURIComponent(parts[2]) : '';

  const enemies = await rallyRepo.listCreators({ guildId, side: 'enemy' });
  const enemy = enemies.find(e => e.id === enemyId);
  if (!enemy) {
    await interaction.reply({ content: 'Enemy not found.', ephemeral: true });
    return;
  }

  const target = selectedTarget || enemy.default_target;
  if (!target) {
    await interaction.reply({ content: `Enemy ${enemy.name} has no target selected.`, ephemeral: true });
    return;
  }

  const [enemyTiming] = await rallyRepo.listTimingsForSide({
    guildId,
    side: 'enemy',
    target
  }).then(rows => rows.filter(r => r.id === enemy.id));

  if (!enemyTiming || !Number.isFinite(enemyTiming.travel_sec)) {
    await interaction.reply({ content: `Enemy ${enemy.name} has no timing for ${target}.`, ephemeral: true });
    return;
  }

  const allies = await rallyRepo.listTimingsForSide({
    guildId,
    side: 'ally',
    target
  });

  const enriched = allies.map(a => ({
    name: a.name,
    enabled: a.enabled,
    travel_sec: a.travel_sec,
    counter_enabled: Boolean(a.counter_targets?.[target])
  }));

  const now = new Date();
  const results = calculateAgainstEnemy({
    now,
    enemy: { name: enemy.name, target, travel_sec: enemyTiming.travel_sec },
    allies: enriched
  });

  const lines = results.length
    ? results.map(r => `**${r.name}** -> **${formatUtcTime(r.time)}** -> **${r.target}**`)
    : ['(no results)'];

  await interaction.reply({
    embeds: [resultEmbed({ title: `Ally timings vs ${enemy.name} (UTC)`, lines })]
  });
}

export async function handleEnemyTargetSelect(interaction) {
  const guildId = interaction.guildId;
  const target = interaction.values?.[0] || '';

  const enemies = await rallyRepo.listCreators({ guildId, side: 'enemy' });
  if (!enemies.length) {
    await interaction.update({ content: 'No enemies found.', components: [] });
    return;
  }

  const targetMenu = new StringSelectMenuBuilder()
    .setCustomId('enemyTargetSelect')
    .setPlaceholder('Select target')
    .addOptions(TARGETS.map(t => ({ label: t, value: t, default: t === target })));

  const selectRow = new ActionRowBuilder().addComponents(targetMenu);

  const buttons = enemies.slice(0, 5).map(e =>
    new ButtonBuilder()
      .setCustomId(`enemyCalc:${e.id}:${encodeURIComponent(target)}`)
      .setLabel(e.name)
      .setStyle(ButtonStyle.Primary)
  );

  const actionRow = new ActionRowBuilder().addComponents(buttons);

  await interaction.update({
    embeds: [resultEmbed({ title: `Enemies (target: ${target})`, lines: enemies.map(e => `**${e.name}**`) })],
    components: [selectRow, actionRow],
    ephemeral: true
  });
}
