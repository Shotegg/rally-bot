import { rallyRepo } from '../../../storage/rallyRepo.js';
import { resultEmbed } from '../../../ui/embeds.js';

export function registerSetEnemyAlly(builder) {
  builder.addSubcommand(sc =>
    sc.setName('set-enemy-ally')
      .setDescription('Enable/disable one ally for enemy-counter mode')
      .addStringOption(o => o.setName('enemy').setDescription('Enemy name').setRequired(true))
      .addStringOption(o => o.setName('ally').setDescription('Ally name').setRequired(true))
      .addBooleanOption(o => o.setName('enabled').setDescription('true/false').setRequired(true))
  );
}

export async function handleSetEnemyAlly(interaction) {
  const guildId = interaction.guildId;
  const enemyName = interaction.options.getString('enemy', true);
  const allyName = interaction.options.getString('ally', true);
  const enabled = interaction.options.getBoolean('enabled', true);

  const enemy = await rallyRepo.getCreatorByName({ guildId, side: 'enemy', name: enemyName });
  if (!enemy) {
    await interaction.reply({ content: `Creator not found: enemy ${enemyName}`, ephemeral: true });
    return;
  }

  const ally = await rallyRepo.getCreatorByName({ guildId, side: 'ally', name: allyName });
  if (!ally) {
    await interaction.reply({ content: `Creator not found: ally ${allyName}`, ephemeral: true });
    return;
  }

  await rallyRepo.setEnemyAlly({ guildId, creatorId: enemy.id, allyName: ally.name, enabled });
  const nextEnemy = await rallyRepo.getCreatorByName({ guildId, side: 'enemy', name: enemyName });
  const allyList = nextEnemy.enemy_allies?.length ? nextEnemy.enemy_allies.join(', ') : '(none)';

  await interaction.reply({
    embeds: [resultEmbed({
      title: 'Enemy allies updated',
      lines: [
        `enemy: **${enemy.name}**`,
        `ally: **${ally.name}** -> **${enabled ? 'on' : 'off'}**`,
        `enemy allies: ${allyList}`
      ]
    })],
    ephemeral: true
  });
}
