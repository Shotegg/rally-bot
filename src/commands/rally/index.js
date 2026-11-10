import { SlashCommandBuilder } from 'discord.js';

import { registerInfo, handleInfo } from './info.js';
import { registerList, handleList } from './list.js';
import { registerCalculate, handleCalculate } from './calculate.js';
import { registerExport, handleExport } from './export.js';
import { registerEnemies, handleEnemies } from './enemies.js';
import { registerHelp, handleHelp } from './help.js';
import { rallyRepo } from '../../storage/rallyRepo.js';

const data = new SlashCommandBuilder()
  .setName('rally')
  .setDescription('Rally tools');

registerInfo(data);
registerList(data);
registerCalculate(data);
registerExport(data);
registerEnemies(data);
registerHelp(data);

const handlers = new Map([
  ['info', handleInfo],
  ['list', handleList],
  ['calculate', handleCalculate],
  ['export', handleExport],
  ['enemies', handleEnemies],
  ['help', handleHelp]
]);

export const rallyCommand = {
  data,
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const handler = handlers.get(sub);
    if (!handler) {
      await interaction.reply({ content: `Unknown subcommand: ${sub}`, ephemeral: true });
      return;
    }

    await handler(interaction);
  },
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (!focused || !['name', 'enemy', 'ally'].includes(focused.name)) {
      await interaction.respond([]);
      return;
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const query = String(focused.value || '').toLowerCase().trim();

    const sideByField = {
      name: interaction.options.getString('side') === 'enemy' ? 'enemy' : 'ally',
      enemy: 'enemy',
      ally: 'ally'
    };

    const side = sideByField[focused.name];
    const creators = await rallyRepo.listCreators({ guildId, side });
    const choices = creators
      .filter(c => {
        const nameHit = c.name.toLowerCase().includes(query);
        const displayHit = (c.display_name || '').toLowerCase().includes(query);
        const idHit = (c.discord_user_id || '').toLowerCase().includes(query);
        return !query || nameHit || displayHit || idHit;
      })
      .slice(0, 25)
      .map(c => {
        const label = (c.display_name || c.name).slice(0, 100);
        return { name: label, value: c.name.slice(0, 100) };
      });

    try {
      await interaction.respond(choices);
    } catch (err) {
      if (err?.code !== 10062 && err?.code !== 40060) throw err;
    }
  }
};
