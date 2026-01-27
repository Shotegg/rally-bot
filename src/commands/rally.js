import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  StringSelectMenuBuilder
} from 'discord.js';

import { rallyRepo } from '../storage/rallyRepo.js';
import { calculateAgainstEnemy, calculateAllSendTimes, formatUtcTime } from '../domain/calc.js';
import { resultEmbed } from '../ui/embeds.js';
import { TARGETS, NO_TARGET } from '../domain/targets.js';

const TARGET_CHOICES = TARGETS.map(t => ({ name: t, value: t }));

function asInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function makeExportPayload(creators, timings) {
  const timingMap = new Map();
  timings.forEach(t => {
    const key = `${t.creator_id}:${t.target}`;
    timingMap.set(key, t.travel_sec ?? 0);
  });

  return creators.map(c => {
    const counterTargets = {};
    TARGETS.forEach(t => {
      counterTargets[t] = Boolean(c.counter_targets?.[t]);
    });

    const boxes = {};
    TARGETS.forEach(t => {
      const travelSec = timingMap.get(`${c.id}:${t}`) ?? 0;
      const min = Math.floor(travelSec / 60);
      const sec = travelSec % 60;
      boxes[t] = { min, sec };
    });

    return {
      type: c.side,
      name: c.name,
      enabled: Boolean(c.enabled),
      target: c.default_target || NO_TARGET,
      buffer: c.buffer_sec ?? 0,
      counterTargets,
      boxes
    };
  });
}

export const rallyCommand = {
  data: new SlashCommandBuilder()
    .setName('rally')
    .setDescription('Rally tools')
    .addSubcommand(sc =>
      sc.setName('add')
        .setDescription('Add/update creator (ally/enemy)')
        .addStringOption(o =>
          o.setName('side')
            .setDescription('ally or enemy')
            .setRequired(true)
            .addChoices(
              { name: 'ally', value: 'ally' },
              { name: 'enemy', value: 'enemy' }
            )
        )
        .addStringOption(o => o.setName('name').setDescription('Creator name').setRequired(true))
        .addIntegerOption(o => o.setName('buffer_sec').setDescription('Buffer seconds (optional)').setRequired(false))
        .addStringOption(o => o.setName('default_target').setDescription('Default target for calculate').setRequired(false).addChoices(...TARGET_CHOICES))
        .addBooleanOption(o => o.setName('enabled').setDescription('Include in calculate').setRequired(false))
    )
    .addSubcommand(sc =>
      sc.setName('set-time')
        .setDescription('Set travel time for a creator + target')
        .addStringOption(o =>
          o.setName('side')
            .setDescription('ally or enemy')
            .setRequired(true)
            .addChoices(
              { name: 'ally', value: 'ally' },
              { name: 'enemy', value: 'enemy' }
            )
        )
        .addStringOption(o => o.setName('name').setDescription('Creator name').setRequired(true))
        .addStringOption(o => o.setName('target').setDescription('Target key').setRequired(true).addChoices(...TARGET_CHOICES))
        .addIntegerOption(o => o.setName('min').setDescription('Minutes').setRequired(true))
        .addIntegerOption(o => o.setName('sec').setDescription('Seconds').setRequired(true))
    )
    .addSubcommand(sc =>
      sc.setName('set-target')
        .setDescription('Set default target for calculate')
        .addStringOption(o =>
          o.setName('side')
            .setDescription('ally or enemy')
            .setRequired(true)
            .addChoices(
              { name: 'ally', value: 'ally' },
              { name: 'enemy', value: 'enemy' }
            )
        )
        .addStringOption(o => o.setName('name').setDescription('Creator name').setRequired(true))
        .addStringOption(o => o.setName('target').setDescription('Target key').setRequired(true).addChoices(...TARGET_CHOICES))
    )
    .addSubcommand(sc =>
      sc.setName('set-counter')
        .setDescription('Enable/disable counter for a target')
        .addStringOption(o =>
          o.setName('name')
            .setDescription('Ally name')
            .setRequired(true)
        )
        .addStringOption(o => o.setName('target').setDescription('Target key').setRequired(true).addChoices(...TARGET_CHOICES))
        .addBooleanOption(o => o.setName('enabled').setDescription('true/false').setRequired(true))
    )
    .addSubcommand(sc =>
      sc.setName('set-enabled')
        .setDescription('Include/exclude a creator in calculate')
        .addStringOption(o =>
          o.setName('side')
            .setDescription('ally or enemy')
            .setRequired(true)
            .addChoices(
              { name: 'ally', value: 'ally' },
              { name: 'enemy', value: 'enemy' }
            )
        )
        .addStringOption(o => o.setName('name').setDescription('Creator name').setRequired(true))
        .addBooleanOption(o => o.setName('enabled').setDescription('true/false').setRequired(true))
    )
    .addSubcommand(sc =>
      sc.setName('delete')
        .setDescription('Delete a creator by name')
        .addStringOption(o =>
          o.setName('side')
            .setDescription('ally or enemy')
            .setRequired(true)
            .addChoices(
              { name: 'ally', value: 'ally' },
              { name: 'enemy', value: 'enemy' }
            )
        )
        .addStringOption(o => o.setName('name').setDescription('Creator name').setRequired(true))
    )
    .addSubcommand(sc =>
      sc.setName('info')
        .setDescription('Show creator details')
        .addStringOption(o =>
          o.setName('side')
            .setDescription('ally or enemy')
            .setRequired(true)
            .addChoices(
              { name: 'ally', value: 'ally' },
              { name: 'enemy', value: 'enemy' }
            )
        )
        .addStringOption(o => o.setName('name').setDescription('Creator name').setRequired(true))
    )
    .addSubcommand(sc =>
      sc.setName('list')
        .setDescription('List creators')
    )
    .addSubcommand(sc =>
      sc.setName('calculate')
        .setDescription('Calculate send times for allies')
        .addStringOption(o => o.setName('target').setDescription('Filter by target (optional)').setRequired(false).addChoices(...TARGET_CHOICES))
    )
    .addSubcommand(sc =>
      sc.setName('export')
        .setDescription('Export data for web calculator import')
    )
    .addSubcommand(sc =>
      sc.setName('import')
        .setDescription('Import data from web calculator export')
        .addAttachmentOption(o => o.setName('file').setDescription('JSON file').setRequired(true))
    )
    .addSubcommand(sc =>
      sc.setName('enemies')
        .setDescription('Show enemies with buttons')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'add') {
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
      return;
    }

    if (sub === 'set-time') {
      const side = interaction.options.getString('side', true);
      const name = interaction.options.getString('name', true);
      const target = interaction.options.getString('target', true);
      const min = asInt(interaction.options.getInteger('min', true), 0);
      const sec = asInt(interaction.options.getInteger('sec', true), 0);
      const travelSec = Math.max(0, min) * 60 + Math.max(0, sec);

      const creator = await rallyRepo.getCreatorByName({ guildId, side, name });
      if (!creator) {
        await interaction.reply({ content: `Creator not found: ${side} ${name}`, ephemeral: true });
        return;
      }

      await rallyRepo.setTiming({ guildId, creatorId: creator.id, target, travelSec });

      await interaction.reply({
        embeds: [resultEmbed({ title: 'Timing saved', lines: [`**${creator.name}** @ **${target}** = **${travelSec}s**`] })],
        ephemeral: true
      });
      return;
    }

    if (sub === 'set-target') {
      const side = interaction.options.getString('side', true);
      const name = interaction.options.getString('name', true);
      const target = interaction.options.getString('target', true);

      const creator = await rallyRepo.getCreatorByName({ guildId, side, name });
      if (!creator) {
        await interaction.reply({ content: `Creator not found: ${side} ${name}`, ephemeral: true });
        return;
      }

      await rallyRepo.setDefaultTarget({ guildId, creatorId: creator.id, target });
      await interaction.reply({
        embeds: [resultEmbed({ title: 'Default target saved', lines: [`**${creator.name}** -> **${target}**`] })],
        ephemeral: true
      });
      return;
    }

    if (sub === 'set-counter') {
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
      return;
    }

    if (sub === 'set-enabled') {
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
      return;
    }

    if (sub === 'delete') {
      const side = interaction.options.getString('side', true);
      const name = interaction.options.getString('name', true);

      const creator = await rallyRepo.getCreatorByName({ guildId, side, name });
      if (!creator) {
        await interaction.reply({ content: `Creator not found: ${side} ${name}`, ephemeral: true });
        return;
      }

      await rallyRepo.deleteCreatorByName({ guildId, side, name });
      await interaction.reply({ content: `Deleted ${side} creator: ${name}`, ephemeral: true });
      return;
    }

    if (sub === 'info') {
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
            `targets: ${TARGETS.join(', ')}`
          ]
        })],
        ephemeral: true
      });
      return;
    }

    if (sub === 'list') {
      const allies = await rallyRepo.listCreators({ guildId, side: 'ally' });
      const enemies = await rallyRepo.listCreators({ guildId, side: 'enemy' });

      const lines = [
        '**Allies**',
        ...(allies.length ? allies.map(c => `- ${c.name}`) : ['(none)']),
        '**Enemies**',
        ...(enemies.length ? enemies.map(c => `- ${c.name}`) : ['(none)'])
      ];

      await interaction.reply({
        embeds: [resultEmbed({ title: 'Creators', lines })],
        ephemeral: true
      });
      return;
    }

    if (sub === 'calculate') {
      const targetFilter = interaction.options.getString('target') || '';
      const now = new Date();
      const creators = targetFilter
        ? await rallyRepo.listCreatorsWithDefaultTarget({ guildId, side: 'ally', target: targetFilter })
        : await rallyRepo.listCreatorsWithDefaultTargets({ guildId, side: 'ally' });

      const results = calculateAllSendTimes({
        now,
        creators
      });

      const lines = results.length
        ? results.map(r => `**${r.name}** -> **${formatUtcTime(r.time)}** -> **${r.target}**`)
        : ['(no results)'];

      await interaction.reply({
        embeds: [resultEmbed({ title: `Results (UTC)${targetFilter ? ` @ ${targetFilter}` : ''}`, lines })]
      });
      return;
    }

    if (sub === 'export') {
      const allies = await rallyRepo.listCreators({ guildId, side: 'ally' });
      const enemies = await rallyRepo.listCreators({ guildId, side: 'enemy' });
      const timings = await rallyRepo.listAllTimings({ guildId });
      const payload = JSON.stringify(makeExportPayload([...allies, ...enemies], timings), null, 2);
      const filename = `rally-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;

      if (payload.length > 1800) {
        const file = new AttachmentBuilder(Buffer.from(payload, 'utf8'), { name: filename });
        await interaction.reply({ content: 'Export file:', files: [file], ephemeral: true });
        return;
      }

      await interaction.reply({
        content: `\`\`\`json\n${payload}\n\`\`\``,
        ephemeral: true
      });
      return;
    }

    if (sub === 'import') {
      const attachment = interaction.options.getAttachment('file', true);
      try {
        const res = await fetch(attachment.url);
        const text = await res.text();
        const data = JSON.parse(text);
        if (!Array.isArray(data)) {
          await interaction.reply({ content: 'Invalid import payload.', ephemeral: true });
          return;
        }

        for (const entry of data) {
          if (!entry || !entry.name || !entry.type) continue;
          const side = entry.type === 'enemy' ? 'enemy' : 'ally';
          const defaultTarget = entry.target && entry.target !== NO_TARGET ? entry.target : '';
          const bufferSec = Number(entry.buffer ?? 0) || 0;
          const enabled = entry.enabled !== false;

          const creator = await rallyRepo.upsertCreator({
            guildId,
            side,
            name: String(entry.name),
            targets: TARGETS,
            bufferSec,
            enabled,
            defaultTarget
          });

          const counterTargets = {};
          TARGETS.forEach(t => {
            counterTargets[t] = Boolean(entry.counterTargets?.[t]);
          });

          await rallyRepo.setCounterTargetsMap({ guildId, creatorId: creator.id, map: counterTargets });

          const boxes = entry.boxes || {};
          for (const target of TARGETS) {
            const box = boxes[target];
            if (!box) continue;
            const min = Number(box.min ?? 0) || 0;
            const sec = Number(box.sec ?? 0) || 0;
            const travelSec = Math.max(0, min) * 60 + Math.max(0, sec);
            await rallyRepo.setTiming({ guildId, creatorId: creator.id, target, travelSec });
          }
        }

        await interaction.reply({ content: 'Import complete.', ephemeral: true });
      } catch {
        await interaction.reply({ content: 'Failed to import file.', ephemeral: true });
      }
      return;
    }

    if (sub === 'enemies') {
      const enemies = await rallyRepo.listCreators({ guildId, side: 'enemy' });
      if (!enemies.length) {
        await interaction.reply({ content: 'No enemies found. Use /rally add side:enemy ...', ephemeral: true });
        return;
      }

      const fallbackTarget = enemies.find(e => e.default_target)?.default_target || '';
      const targetMenu = new StringSelectMenuBuilder()
        .setCustomId('enemyTargetSelect')
        .setPlaceholder('Select target')
        .addOptions(TARGETS.map(t => ({ label: t, value: t, default: t === fallbackTarget })));

      const selectRow = new ActionRowBuilder().addComponents(targetMenu);

      const buttons = enemies.slice(0, 5).map(e =>
        new ButtonBuilder()
          .setCustomId(`enemyCalc:${e.id}`)
          .setLabel(e.name)
          .setStyle(ButtonStyle.Primary)
      );

      const actionRow = new ActionRowBuilder().addComponents(buttons);

      await interaction.reply({
        embeds: [resultEmbed({ title: 'Enemies', lines: enemies.map(e => `**${e.name}** (default target: ${e.default_target || 'none'})`) })],
        components: [selectRow, actionRow],
        ephemeral: true
      });
    }
  }
};
