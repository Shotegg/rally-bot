import { AttachmentBuilder } from 'discord.js';

import { rallyRepo } from '../../storage/rallyRepo.js';
import { TARGETS, NO_TARGET, TARGET_ALIASES } from '../../domain/targets.js';

function legacyTargetName(target) {
  const match = Object.entries(TARGET_ALIASES).find(([, current]) => current === target);
  return match ? match[0] : target;
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
      counterTargets[legacyTargetName(t)] = Boolean(c.counter_targets?.[t]);
    });

    const boxes = {};
    TARGETS.forEach(t => {
      const travelSec = timingMap.get(`${c.id}:${t}`) ?? 0;
      const min = Math.floor(travelSec / 60);
      const sec = travelSec % 60;
      boxes[legacyTargetName(t)] = { min, sec };
    });

    return {
      type: c.side,
      name: c.name,
      enabled: Boolean(c.enabled),
      target: c.default_target ? legacyTargetName(c.default_target) : NO_TARGET,
      buffer: c.buffer_sec ?? 0,
      counterTargets,
      enemyAllies: Array.isArray(c.enemy_allies) ? c.enemy_allies : [],
      boxes
    };
  });
}

export function registerExport(builder) {
  builder.addSubcommand(sc =>
    sc.setName('export')
      .setDescription('Export data for web calculator import')
  );
}

export async function handleExport(interaction) {
  const guildId = interaction.guildId;
  const allies = await rallyRepo.listCreators({ guildId, side: 'ally' });
  const enemies = await rallyRepo.listCreators({ guildId, side: 'enemy' });
  const timings = await rallyRepo.listAllTimings({ guildId });
  const payload = JSON.stringify(makeExportPayload([...allies, ...enemies], timings), null, 2);
  const filename = `rally-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
  const file = new AttachmentBuilder(Buffer.from(payload, 'utf8'), { name: filename });
  await interaction.reply({ content: 'Export file:', files: [file], ephemeral: true });
}
