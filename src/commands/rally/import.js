import { rallyRepo } from '../../storage/rallyRepo.js';
import { TARGETS, NO_TARGET } from '../../domain/targets.js';

export function registerImport(builder) {
  builder.addSubcommand(sc =>
    sc.setName('import')
      .setDescription('Import data from web calculator export')
      .addAttachmentOption(o => o.setName('file').setDescription('JSON file').setRequired(true))
  );
}

export async function handleImport(interaction) {
  const guildId = interaction.guildId;
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
      await rallyRepo.setEnemyAllies({
        guildId,
        creatorId: creator.id,
        allies: side === 'enemy' ? (Array.isArray(entry.enemyAllies) ? entry.enemyAllies : []) : []
      });

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
}
