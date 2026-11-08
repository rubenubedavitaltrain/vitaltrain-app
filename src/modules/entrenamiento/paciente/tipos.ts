// Textos compartidos del módulo de entrenamiento.

export const MOTIVOS = {
  pain: 'Dolor o molestia',
  no_equipment: 'No tengo el material',
  dont_know: 'No sé hacerlo',
  other: 'Otro motivo'
} as const;

export type Motivo = keyof typeof MOTIVOS;
