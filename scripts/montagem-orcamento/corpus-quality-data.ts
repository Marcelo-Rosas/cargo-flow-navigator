import { buildSummaryFromSections } from './format.ts';
import type { MontagemOrcamento } from './types.ts';

const sections: MontagemOrcamento['sections'] = [
  {
    title: '1. CARDIO — BIKES',
    rows: [
      { code: 'HOS-W019', description: 'Magnetic Spinning Bike', qty: 40, unit: 80 },
      { code: 'HOS-W121C', description: 'Horizontal Magnetic Bike', qty: 4, unit: 130 },
    ],
  },
  {
    title: '2. CARDIO — ESTEIRAS',
    rows: [{ code: 'HOS-W507B', description: 'Commercial Treadmill LCD', qty: 18, unit: 250 }],
  },
  {
    title: '3. CARDIO — ELÍPTICOS',
    rows: [{ code: 'HOS-W056', description: 'Folding Elliptical Machine', qty: 2, unit: 120 }],
  },
  {
    title: '4. CARDIO — ESCADA',
    rows: [{ code: 'HOS-W111', description: 'Stairmaster', qty: 3, unit: 150 }],
  },
  {
    title: '5. CARDIO — REMO',
    rows: [{ code: 'HOS-W098', description: 'Motor Rowing Machine', qty: 2, unit: 80 }],
  },
  {
    title: '6. BANCOS',
    rows: [
      { code: 'HOS-G026', description: 'Multi Adjustable Bench', qty: 8, unit: 60 },
      { code: 'HOS-Z032', description: 'Utility Bench', qty: 1, unit: 60 },
      { code: 'HOS-Z031', description: 'Adjustable Decline Bench', qty: 1, unit: 60 },
      { code: 'HOS-G033', description: 'Flat Olympic Press', qty: 1, unit: 60 },
      { code: 'HOS-G024', description: 'Olympic Incline Bench', qty: 1, unit: 60 },
    ],
  },
  {
    title: '7. MÁQUINAS COM TORRE DE PESO',
    rows: [
      { code: 'HOS-Z004', description: 'Pectoral Fly / Rear Delt', qty: 2, unit: 150 },
      { code: 'HOS-Z015', description: 'Seated Leg Curl', qty: 6, unit: 150 },
      { code: 'HOS-Z022', description: 'Hip Adduction / Abduction', qty: 4, unit: 150 },
      { code: 'HOS-Z001', description: 'Shoulder Press', qty: 1, unit: 150 },
      { code: 'HOS-Z016', description: 'Leg Curl', qty: 2, unit: 150 },
      { code: 'HOS-Z048', description: 'Leg Raise', qty: 1, unit: 150 },
      { code: 'HOS-UC019', description: 'Standing Abductor', qty: 1, unit: 150 },
      { code: 'HOS-UG023', description: 'Alternate Leg Extension', qty: 1, unit: 150 },
      { code: 'HOS-UC030', description: 'Calf Machine', qty: 2, unit: 150 },
      { code: 'HOS-UC009', description: 'Lat Pull Down', qty: 1, unit: 150 },
      { code: 'HOS-UC011', description: 'Seated Row', qty: 1, unit: 150 },
      { code: 'HOS-UC016', description: 'Biceps Curl', qty: 1, unit: 150 },
      { code: 'HOS-UC028', description: 'Alternate Arm Curl', qty: 1, unit: 150 },
      { code: 'HOS-UC032', description: 'Super French Press', qty: 1, unit: 150 },
      { code: 'HOS-HT041', description: 'Lat Pulldown', qty: 1, unit: 150 },
      { code: 'HOS-HT042', description: 'Row Machine', qty: 1, unit: 150 },
      { code: 'HOS-HT049', description: 'Incline Chest Press', qty: 1, unit: 150 },
      { code: 'HOS-HT038', description: 'Flat Chest Press', qty: 1, unit: 150 },
      { code: 'HOS-HT039', description: 'Decline Chest Press', qty: 1, unit: 150 },
      { code: 'HOS-HT040', description: 'Shoulder Press', qty: 1, unit: 150 },
      { code: 'HOS-HT043', description: 'Abdominal Machine', qty: 1, unit: 150 },
      { code: 'HOS-E115', description: 'Abductor', qty: 2, unit: 150 },
    ],
  },
  {
    title: '8. MÁQUINAS ARTICULADAS / PLATE LOADED',
    rows: [
      { code: 'HOS-E079', description: 'Incline Chest Fly', qty: 1, unit: 115 },
      { code: 'HOS-E080B', description: 'Hip Lift', qty: 1, unit: 115 },
      { code: 'HOS-E019', description: 'Decline Chest Press', qty: 2, unit: 115 },
      { code: 'HOS-X008', description: 'Rear Kick', qty: 1, unit: 115 },
      { code: 'HOS-E033', description: '45 Degree Linear Leg Press', qty: 2, unit: 115 },
      { code: 'HOS-E117', description: 'Belted Squat Machine', qty: 1, unit: 115 },
      { code: 'HOS-E044', description: 'Hack Squat Lunge', qty: 1, unit: 115 },
      { code: 'HOS-E020', description: 'D.Y. Row Machine', qty: 1, unit: 115 },
      { code: 'HOS-E011', description: 'Super Incline Press', qty: 1, unit: 115 },
      { code: 'HOS-E017', description: 'Seated Bench Press', qty: 1, unit: 115 },
      { code: 'HOS-E012', description: 'Wide Chest Press', qty: 1, unit: 115 },
      { code: 'HOS-UG093', description: 'Super Leg Press Bridge', qty: 1, unit: 115 },
      { code: 'HOS-UG020', description: 'Calf Hack Squat Machine', qty: 1, unit: 115 },
      { code: 'HOS-UG014', description: 'Pendulum Squat', qty: 1, unit: 115 },
      { code: 'HOS-UG068', description: 'Kneeling Leg Curl', qty: 2, unit: 115 },
      { code: 'HOS-UG072', description: 'Calf Trainer', qty: 2, unit: 115 },
      { code: 'HOS-NDS007', description: 'Seated Rowing Machine', qty: 1, unit: 115 },
      { code: 'HOS-UG052', description: 'Adjustable Lat Pull Down', qty: 1, unit: 115 },
      { code: 'HOS-UG001', description: 'Lat Pulldown', qty: 1, unit: 115 },
      { code: 'HOS-UG015', description: 'Super Low Row', qty: 1, unit: 115 },
      { code: 'HOS-UG029', description: 'Super Horizontal Bench Press', qty: 1, unit: 115 },
      { code: 'HOS-UG004', description: 'Incline Chest Press', qty: 1, unit: 115 },
      { code: 'HOS-UG054', description: 'Adjustable Chest & Shoulder Press', qty: 1, unit: 115 },
      { code: 'HOS-HT046', description: 'Leg Press', qty: 1, unit: 115 },
      { code: 'HOS-Z019', description: 'Seated Leg Press', qty: 2, unit: 115 },
    ],
  },
  {
    title: '9. FUNCIONAL / CROSSOVER / POLIAS',
    rows: [
      { code: 'HOS-Z040', description: 'Dual Adjustable Pulley', qty: 4, unit: 300 },
      { code: 'HOS-R023', description: 'Single Pulley', qty: 4, unit: 300 },
      { code: 'HOSQ030', description: 'Pull Down / Long Pull', qty: 3, unit: 300 },
    ],
  },
  {
    title: '10. SMITH',
    rows: [{ code: 'HOS-E008', description: 'Smith Machine', qty: 2, unit: 200 }],
  },
];

/** Orçamento padrão Corpus Quality — referência para smoke e skill. */
export const CORPUS_QUALITY_ORCAMENTO: MontagemOrcamento = {
  clientName: 'CORPUS QUALITY CONVENIENCIA E ACADEMIA LTDA',
  outputSlug: 'corpus-quality',
  sections,
  summary: buildSummaryFromSections(sections, [
    { label: 'Cardio Bikes', sectionIndex: 0 },
    { label: 'Esteiras', sectionIndex: 1 },
    { label: 'Elípticos', sectionIndex: 2 },
    { label: 'Escada', sectionIndex: 3 },
    { label: 'Remo', sectionIndex: 4 },
    { label: 'Bancos', sectionIndex: 5 },
    { label: 'Torre de Peso', sectionIndex: 6, qtyOverride: 33 },
    { label: 'Articuladas', sectionIndex: 7, qtyOverride: 29 },
    { label: 'Funcional / Cross', sectionIndex: 8 },
    { label: 'Smith', sectionIndex: 9 },
  ]),
  excluded: [
    {
      code: 'HOS-D003B',
      description: 'TPU Weight Plate',
      reason: 'Sem montagem técnica relevante',
    },
  ],
};
