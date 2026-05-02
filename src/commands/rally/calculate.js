import { rallyRepo } from '../../storage/rallyRepo.js';
import { calculateAllSendTimes, formatUtcTime } from '../../domain/calc.js';
import { addTargetOption } from './shared.js';

export function registerCalculate(builder) {
  builder.addSubcommand(sc => {
    sc.setName('calculate')
      .setDescription('Calculate send times for allies');

    addTargetOption(sc, { required: false, description: 'Filter by target (optional)' });
    return sc;
  });
}

export async function handleCalculate(interaction) {
  await interaction.deferReply();
  const guildId = interaction.guildId;
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
    ? results.map(r => `${r.name} -> ${formatUtcTime(r.time)} -> ${r.target}`)
    : ['(no results)'];

  await interaction.editReply({
    content: `Results (UTC)${targetFilter ? ` @ ${targetFilter}` : ''}\n${lines.join('\n')}`,
    allowedMentions: { parse: ['users'] }
  });
}
