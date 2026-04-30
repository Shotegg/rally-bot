import { SlashCommandBuilder } from 'discord.js';

import { registerAdd, handleAdd } from './add.js';
import { registerSetTime, handleSetTime } from './set/setTime.js';
import { registerSetTarget, handleSetTarget } from './set/setTarget.js';
import { registerSetCounter, handleSetCounter } from './set/setCounter.js';
import { registerSetEnemyAlly, handleSetEnemyAlly } from './set/setEnemyAlly.js';
import { registerSetEnabled, handleSetEnabled } from './set/setEnabled.js';
import { registerDelete, handleDelete } from './delete.js';
import { registerInfo, handleInfo } from './info.js';
import { registerList, handleList } from './list.js';
import { registerCalculate, handleCalculate } from './calculate.js';
import { registerExport, handleExport } from './export.js';
import { registerImport, handleImport } from './import.js';
import { registerEnemies, handleEnemies } from './enemies.js';
import { registerHelp, handleHelp } from './help.js';

const data = new SlashCommandBuilder()
  .setName('rally')
  .setDescription('Rally tools');

registerAdd(data);
registerSetTime(data);
registerSetTarget(data);
registerSetCounter(data);
registerSetEnemyAlly(data);
registerSetEnabled(data);
registerDelete(data);
registerInfo(data);
registerList(data);
registerCalculate(data);
registerExport(data);
registerImport(data);
registerEnemies(data);
registerHelp(data);

const handlers = new Map([
  ['add', handleAdd],
  ['set-time', handleSetTime],
  ['set-target', handleSetTarget],
  ['set-counter', handleSetCounter],
  ['set-enemy-ally', handleSetEnemyAlly],
  ['set-enabled', handleSetEnabled],
  ['delete', handleDelete],
  ['info', handleInfo],
  ['list', handleList],
  ['calculate', handleCalculate],
  ['export', handleExport],
  ['import', handleImport],
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
  }
};
