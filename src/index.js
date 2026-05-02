import { Client, GatewayIntentBits, REST, Routes, Events } from 'discord.js';
import { config } from './config.js';
import { initDb } from './storage/db.js';
import { rallyCommand } from './commands/rally/index.js';
import { handleAllyTimingsButton, handleEnemyModeButton } from './components/allyTimingsButton.js';
import { handleCreatorQuickActionButton, handleCreatorQuickActionModal } from './components/creatorQuickActions.js';
import { startKeepAlive } from './keep_alive.js';

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(config.token);
  const body = [rallyCommand.data.toJSON()];

  for (const guildId of config.guildIds) {
    await rest.put(
      Routes.applicationGuildCommands(config.appId, guildId),
      { body }
    );

    console.log(`Commands registered to guild ${guildId}.`);
  }
}

async function main() {
  startKeepAlive();
  await initDb();
  await registerCommands();

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once(Events.ClientReady, () => {
    console.log(`Logged in as ${client.user.tag}`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'rally') {
          await rallyCommand.execute(interaction);
        }
        return;
      }

      if (interaction.isAutocomplete()) {
        if (interaction.commandName === 'rally') {
          await rallyCommand.autocomplete(interaction);
        }
        return;
      }

      if (interaction.isButton()) {
        if (interaction.customId.startsWith('creatorAction:')) {
          await handleCreatorQuickActionButton(interaction);
          return;
        }

        if (interaction.customId.startsWith('enemyMode:')) {
          await handleEnemyModeButton(interaction);
          return;
        }

        if (interaction.customId.startsWith('enemyCalc:')) {
          await handleAllyTimingsButton(interaction);
          return;
        }
      }

      if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('creatorModal:')) {
          await handleCreatorQuickActionModal(interaction);
          return;
        }
      }
    } catch (err) {
      console.error(err);
      if (interaction.isAutocomplete()) return;
      const msg = 'Something went wrong. Check console logs.';
      if (interaction.isRepliable()) {
        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: msg, ephemeral: true });
          } else {
            await interaction.reply({ content: msg, ephemeral: true });
          }
        } catch (replyErr) {
          console.error(replyErr);
        }
      }
    }
  });

  await client.login(config.token);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
