import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';

import { rallyRepo } from '../storage/rallyRepo.js';
import { TARGETS, normalizeTargetName } from '../domain/targets.js';
import { resultEmbed } from '../ui/embeds.js';

function parseActionId(customId) {
  const parts = String(customId || '').split(':');
  if (parts.length !== 4 || parts[0] !== 'creatorAction') return null;
  return { action: parts[1], side: parts[2], creatorId: Number(parts[3]) };
}

function parseModalId(customId) {
  const parts = String(customId || '').split(':');
  if (parts.length !== 4 || parts[0] !== 'creatorModal') return null;
  return { action: parts[1], side: parts[2], creatorId: Number(parts[3]) };
}

export function buildCreatorQuickActionRows({ side, creator }) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`creatorAction:set-target:${side}:${creator.id}`)
        .setLabel('Set Target')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`creatorAction:set-time:${side}:${creator.id}`)
        .setLabel('Set Time')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`creatorAction:toggle-enabled:${side}:${creator.id}`)
        .setLabel(creator.enabled ? 'Disable' : 'Enable')
        .setStyle(creator.enabled ? ButtonStyle.Secondary : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`creatorAction:delete:${side}:${creator.id}`)
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger)
    )
  ];
}

export async function handleCreatorQuickActionButton(interaction) {
  const parsed = parseActionId(interaction.customId);
  if (!parsed) return false;

  const { action, side, creatorId } = parsed;
  if (action === 'set-target') {
    const modal = new ModalBuilder()
      .setCustomId(`creatorModal:set-target:${side}:${creatorId}`)
      .setTitle('Set target');
    const targetInput = new TextInputBuilder()
      .setCustomId('target')
      .setLabel('Target')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(targetInput));
    await interaction.showModal(modal);
    return true;
  }

  if (action === 'set-time') {
    const modal = new ModalBuilder()
      .setCustomId(`creatorModal:set-time:${side}:${creatorId}`)
      .setTitle('Set time');
    const targetInput = new TextInputBuilder()
      .setCustomId('target')
      .setLabel('Target')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setValue(TARGETS[0] || '');
    const minInput = new TextInputBuilder()
      .setCustomId('min')
      .setLabel('Minutes')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setValue('0');
    const secInput = new TextInputBuilder()
      .setCustomId('sec')
      .setLabel('Seconds')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setValue('0');
    modal.addComponents(
      new ActionRowBuilder().addComponents(targetInput),
      new ActionRowBuilder().addComponents(minInput),
      new ActionRowBuilder().addComponents(secInput)
    );
    await interaction.showModal(modal);
    return true;
  }

  const guildId = interaction.guildId;
  await interaction.deferReply({ ephemeral: true });
  const creator = await rallyRepo.getCreatorById({ guildId, creatorId });
  if (!creator || creator.side !== side) {
    await interaction.editReply({ content: 'Creator not found.' });
    return true;
  }

  if (action === 'toggle-enabled') {
    const nextEnabled = !creator.enabled;
    await rallyRepo.setEnabled({ guildId, creatorId: creator.id, enabled: nextEnabled });
    await interaction.editReply({
      embeds: [resultEmbed({ title: 'Enabled updated', lines: [`**${creator.name}** = **${nextEnabled ? 'on' : 'off'}**`] })],
    });
    return true;
  }

  if (action === 'delete') {
    await rallyRepo.deleteCreatorByName({ guildId, side: creator.side, name: creator.name });
    await interaction.editReply({ content: `Deleted ${creator.side} creator: ${creator.name}` });
    return true;
  }

  return false;
}

export async function handleCreatorQuickActionModal(interaction) {
  const parsed = parseModalId(interaction.customId);
  if (!parsed) return false;

  const { action, side, creatorId } = parsed;
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guildId;
  const creator = await rallyRepo.getCreatorById({ guildId, creatorId });
  if (!creator || creator.side !== side) {
    await interaction.editReply({ content: 'Creator not found.' });
    return true;
  }

  if (action === 'set-target') {
    const targetRaw = interaction.fields.getTextInputValue('target');
    const target = normalizeTargetName(targetRaw);
    if (!target) {
      await interaction.editReply({ content: `Invalid target. Use one of: ${TARGETS.join(', ')}` });
      return true;
    }

    await rallyRepo.setDefaultTarget({ guildId, creatorId: creator.id, target });
    await interaction.editReply({
      embeds: [resultEmbed({ title: 'Default target saved', lines: [`**${creator.name}** -> **${target}**`] })],
    });
    return true;
  }

  if (action === 'set-time') {
    const targetRaw = interaction.fields.getTextInputValue('target');
    const target = normalizeTargetName(targetRaw);
    const min = Number(interaction.fields.getTextInputValue('min'));
    const sec = Number(interaction.fields.getTextInputValue('sec'));
    if (!target) {
      await interaction.editReply({ content: `Invalid target. Use one of: ${TARGETS.join(', ')}` });
      return true;
    }
    if (!Number.isFinite(min) || !Number.isFinite(sec) || min < 0 || sec < 0) {
      await interaction.editReply({ content: 'Minutes/seconds must be non-negative numbers.' });
      return true;
    }

    const travelSec = Math.floor(min) * 60 + Math.floor(sec);
    await rallyRepo.setTiming({ guildId, creatorId: creator.id, target, travelSec });
    await interaction.editReply({
      embeds: [resultEmbed({ title: 'Timing saved', lines: [`**${creator.name}** @ **${target}** = **${travelSec}s**`] })],
    });
    return true;
  }

  return false;
}
