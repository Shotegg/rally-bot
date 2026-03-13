import { TARGETS } from '../../domain/targets.js';

export const TARGET_CHOICES = TARGETS.map(t => ({ name: t, value: t }));

export const SIDE_CHOICES = [
  { name: 'ally', value: 'ally' },
  { name: 'enemy', value: 'enemy' }
];

export function addSideOption(builder, { required = true } = {}) {
  return builder.addStringOption(o =>
    o.setName('side')
      .setDescription('ally or enemy')
      .setRequired(required)
      .addChoices(...SIDE_CHOICES)
  );
}

export function addTargetOption(builder, { required = true, name = 'target', description = 'Target key' } = {}) {
  return builder.addStringOption(o =>
    o.setName(name)
      .setDescription(description)
      .setRequired(required)
      .addChoices(...TARGET_CHOICES)
  );
}
