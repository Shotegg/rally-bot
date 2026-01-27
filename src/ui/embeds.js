import { EmbedBuilder } from 'discord.js';

export function resultEmbed({ title, lines }) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(lines.length ? lines.join('\n') : '(no results)')
    .setTimestamp(new Date());
}
