import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { rallyRepo } from '../storage/rallyRepo.js';
import { calculateAgainstEnemy, formatUtcTime } from '../domain/calc.js';
import { TARGETS } from '../domain/targets.js';
import { resultEmbed } from '../ui/embeds.js';

function buildEnemyMatrixPayload({ enemies, start, mode }) {
  const pageEnemies = enemies.slice(start, start + 5);
  const rows = pageEnemies.map((enemy) => {
    const row = [];
    TARGETS.forEach((_, targetIndex) => {
      row.push({
        customId: `enemyCalc:${mode}:${enemy.id}:${targetIndex}`,
        label: enemy.name
      });
    });
    return row;
  });

  const shownCount = Math.min(start + pageEnemies.length, enemies.length);
  return { rows, shownCount };
}

async function sendModeMatrixFollowUps(interaction, mode) {
  const guildId = interaction.guildId;
  const enemies = await rallyRepo.listCreators({ guildId, side: 'enemy' });
  if (!enemies.length) {
    await interaction.editReply({ content: 'No enemies found.' });
    return;
  }

  await interaction.editReply({
    content: `Mode selected: **${mode === 'enemy' ? 'counter by enemy' : 'counter by target'}**`,
  });

  for (let start = 0; start < enemies.length; start += 5) {
    const { rows, shownCount } = buildEnemyMatrixPayload({ enemies, start, mode });
    const components = rows.map((row) => new ActionRowBuilder().addComponents(
      ...row.map((btn) => (
        new ButtonBuilder()
          .setCustomId(btn.customId)
          .setLabel(btn.label)
          .setStyle(ButtonStyle.Primary)
      ))
    ));

    await interaction.followUp({
      embeds: [resultEmbed({
        title: 'Enemies matrix (row = enemy, column = target)',
        lines: [
          '```',
          '            Turret 1  Turret 2  Turret 3  Turret 4  Castle',
          'enemy',
          '```',
          `shown: **${shownCount}/${enemies.length}**`
        ]
      })],
      components,
      ephemeral: true
    });
  }
}

export async function handleEnemyModeButton(interaction) {
  const mode = interaction.customId.split(':')[1];
  if (mode !== 'target' && mode !== 'enemy') {
    await interaction.reply({ content: 'Invalid mode.', ephemeral: true });
    return;
  }
  await interaction.deferReply({ ephemeral: true });
  await sendModeMatrixFollowUps(interaction, mode);
}

export async function handleAllyTimingsButton(interaction) {
  await interaction.deferReply();
  const guildId = interaction.guildId;
  const parts = interaction.customId.split(':');
  const hasMode = parts.length >= 4 && (parts[1] === 'target' || parts[1] === 'enemy');
  const mode = hasMode ? parts[1] : 'target';
  const enemyId = Number(hasMode ? parts[2] : parts[1]);
  const targetIndex = Number(hasMode ? parts[3] : parts[2]);

  const enemies = await rallyRepo.listCreators({ guildId, side: 'enemy' });
  const enemy = enemies.find(e => e.id === enemyId);
  if (!enemy) {
    await interaction.editReply({ content: 'Enemy not found.' });
    return;
  }

  const target = Number.isInteger(targetIndex) && targetIndex >= 0 && targetIndex < TARGETS.length
    ? TARGETS[targetIndex]
    : '';
  if (!target) {
    await interaction.editReply({ content: 'Invalid target.' });
    return;
  }

  const [enemyTiming] = await rallyRepo.listTimingsForSide({
    guildId,
    side: 'enemy',
    target
  }).then(rows => rows.filter(r => r.id === enemy.id));

  if (!enemyTiming || !Number.isFinite(enemyTiming.travel_sec)) {
    await interaction.editReply({ content: `Enemy ${enemy.name} has no timing for ${target}.` });
    return;
  }

  const allies = await rallyRepo.listTimingsForSide({
    guildId,
    side: 'ally',
    target
  });

  const selectedAllyNames = mode === 'enemy'
    ? new Set((enemy.enemy_allies || []).map(name => String(name).trim()).filter(Boolean))
    : null;

  const enriched = allies.map(a => ({
    name: a.name,
    enabled: a.enabled,
    travel_sec: a.travel_sec,
    counter_enabled: mode === 'enemy'
      ? selectedAllyNames.has(a.name)
      : Boolean(a.counter_targets?.[target])
  }));

  const now = new Date();
  const results = calculateAgainstEnemy({
    now,
    enemy: { name: enemy.name, target, travel_sec: enemyTiming.travel_sec },
    allies: enriched
  });

  if (!results.length) {
    await interaction.editReply({ content: `(no results) for ${enemy.name} @ ${target}` });
    return;
  }

  const toLine = (r) => `${r.name} -> ${formatUtcTime(r.time)} -> ${r.target}`;

  await interaction.editReply({ content: toLine(results[0]), allowedMentions: { parse: ['users'] } });
  for (let i = 1; i < results.length; i += 1) {
    await interaction.followUp({ content: toLine(results[i]), allowedMentions: { parse: ['users'] } });
  }
}
