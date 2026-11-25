import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { rallyRepo } from '../../storage/rallyRepo.js';
import { calculateAllSendTimes, formatUtcTime } from '../../domain/calc.js';
import { creatorTravelTime } from '../../domain/creatorTiming.js';
import { TARGETS } from '../../domain/targets.js';

const CALCULATE_TARGET_BUTTON_PREFIX = 'calculateTarget:';

const TARGET_BUTTONS = [
  { target: 'South Turret', label: 'south' },
  { target: 'East Turret', label: 'east' },
  { target: 'West Turret', label: 'west' },
  { target: 'North Turret', label: 'north' },
  { target: 'Castle', label: 'castle' }
];

export function registerCalculate(builder) {
  builder.addSubcommand(sc => {
    sc.setName('calculate')
      .setDescription('Calculate send times for allies');
    return sc;
  });
}

export async function handleCalculate(interaction) {
  await interaction.reply({
    content: 'Choose a target to calculate ally send times.',
    components: [
      new ActionRowBuilder().addComponents(
        ...TARGET_BUTTONS.map(({ target, label }) => (
          new ButtonBuilder()
            .setCustomId(`${CALCULATE_TARGET_BUTTON_PREFIX}${TARGETS.indexOf(target)}`)
            .setLabel(label)
            .setStyle(ButtonStyle.Primary)
        ))
      )
    ],
    ephemeral: true
  });
}

export async function handleCalculateTargetButton(interaction) {
  const targetIndex = Number(interaction.customId.slice(CALCULATE_TARGET_BUTTON_PREFIX.length));
  const target = TARGETS[targetIndex];
  if (!target) {
    await interaction.reply({ content: 'Invalid target.', ephemeral: true });
    return;
  }

  await interaction.deferReply();
  const guildId = interaction.guildId;
  const now = new Date();
  const creators = await rallyRepo.listCreatorsWithDefaultTarget({ guildId, side: 'ally', target });

  const timedCreators = creators.map(creator => ({
    ...creator,
    travel_sec: creatorTravelTime(creator, creator.default_target)
  }));
  const results = calculateAllSendTimes({
    now,
    creators: timedCreators
  });

  if (!results.length) {
    await interaction.editReply({ content: `(no results) for ${target}` });
    return;
  }

  const toLine = (result) => `${result.name} -> ${formatUtcTime(result.time)} -> ${result.target}`;
  await interaction.editReply({
    content: toLine(results[0]),
    allowedMentions: { parse: ['users'] }
  });

  for (let i = 1; i < results.length; i += 1) {
    await interaction.followUp({
      content: toLine(results[i]),
      allowedMentions: { parse: ['users'] }
    });
  }
}
