import { rallyRepo } from '../../../storage/rallyRepo.js';
import { resultEmbed } from '../../../ui/embeds.js';
import { addSideOption, addTargetOption } from '../shared.js';

function asInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function registerSetTime(builder) {
  builder.addSubcommand(sc => {
    sc.setName('set-time')
      .setDescription('Set travel time for a creator + target')
      .addStringOption(o => o.setName('name').setDescription('Creator name').setRequired(true))
      .addIntegerOption(o => o.setName('min').setDescription('Minutes').setRequired(true))
      .addIntegerOption(o => o.setName('sec').setDescription('Seconds').setRequired(true));

    addSideOption(sc);
    addTargetOption(sc);
    return sc;
  });
}

export async function handleSetTime(interaction) {
  const guildId = interaction.guildId;
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
}
