import { rallyRepo } from '../../storage/rallyRepo.js';
import { resultEmbed } from '../../ui/embeds.js';

export function registerList(builder) {
  builder.addSubcommand(sc =>
    sc.setName('list')
      .setDescription('List creators')
  );
}

export async function handleList(interaction) {
  const guildId = interaction.guildId;
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
}
