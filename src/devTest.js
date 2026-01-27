import { initDb } from './storage/db.js';
import { rallyRepo } from './storage/rallyRepo.js';
import { calculateAllSendTimes, formatUtcTime } from './domain/calc.js';

async function run() {
  const guildId = 'DEV_GUILD';

  await initDb();

  const alice = await rallyRepo.upsertCreator({
    guildId,
    side: 'ally',
    name: 'Alice',
    targets: ['Castle'],
    bufferSec: 10,
    defaultTarget: 'Castle'
  });

  await rallyRepo.setTiming({
    guildId,
    creatorId: alice.id,
    target: 'Castle',
    travelSec: 17 * 60 + 12
  });

  const bob = await rallyRepo.upsertCreator({
    guildId,
    side: 'ally',
    name: 'Bob',
    targets: ['Castle'],
    bufferSec: 0,
    defaultTarget: 'Castle'
  });

  await rallyRepo.setTiming({
    guildId,
    creatorId: bob.id,
    target: 'Castle',
    travelSec: 15 * 60 + 5
  });

  const creators = await rallyRepo.listCreatorsWithDefaultTargets({ guildId, side: 'ally' });
  const results = calculateAllSendTimes({ now: new Date(), creators });
  results.forEach(r => {
    console.log(`${r.name} -> ${formatUtcTime(r.time)} -> ${r.target}`);
  });
}

run();
