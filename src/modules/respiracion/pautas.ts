// Pautas de respiración. Cada fase: qué hacer, segundos y tamaño del círculo al terminarla (0 vacío, 1 lleno).

export type Fase = { texto: string; seg: number; hasta: number };
export type Pauta = { id: 'lenta' | 'suspiro' | '478'; nombre: string; corta: string; porque: string; fases: Fase[]; aviso?: string; minutos: number[] };

export const PAUTAS: Pauta[] = [
  {
    id: 'lenta', nombre: 'Respiración lenta', corta: 'Unas 5-6 respiraciones por minuto, por la nariz.',
    porque: 'Respirar a este ritmo activa el freno del sistema nervioso (el vago) y ayuda a salir del modo alerta.',
    fases: [{ texto: 'Inspira', seg: 5.5, hasta: 1 }, { texto: 'Suelta', seg: 5.5, hasta: 0 }],
    minutos: [3, 5, 10],
  },
  {
    id: 'suspiro', nombre: 'Suspiro fisiológico', corta: 'Dos inspiraciones por la nariz y una espiración larga por la boca.',
    porque: 'La segunda inspiración abre los alvéolos y la espiración larga baja la activación. Útil en momentos de tensión.',
    fases: [{ texto: 'Inspira', seg: 2.5, hasta: 0.8 }, { texto: 'Un poco más', seg: 1, hasta: 1 }, { texto: 'Suelta despacio', seg: 6, hasta: 0 }],
    minutos: [1, 3, 5],
  },
  {
    id: '478', nombre: 'Respiración 4-7-8', corta: 'Inspira 4, retén 7, suelta 8.',
    porque: 'La retención y la espiración larga ralentizan el ritmo. Se suele usar antes de dormir.',
    fases: [{ texto: 'Inspira', seg: 4, hasta: 1 }, { texto: 'Retén', seg: 7, hasta: 1 }, { texto: 'Suelta', seg: 8, hasta: 0 }],
    aviso: 'Si te mareas, para y respira con normalidad.',
    minutos: [1, 2, 4],
  },
];

export const pauta = (id: string) => PAUTAS.find((p) => p.id === id) ?? PAUTAS[0];
