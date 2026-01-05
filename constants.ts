
import { LevelInfo } from './types';

export const XP_COMPLETED = 5;
export const XP_GAVE_UP = 3;
export const XP_IGNORED = -3;

export const LEVELS: LevelInfo[] = [
  { level: 1, name: "A Singularidade", xpRequired: 0, storyEra: "O Big Bang" },
  { level: 2, name: "Radiação Primordial", xpRequired: 50, storyEra: "A Inflação Cósmica" },
  { level: 3, name: "A Era das Trevas", xpRequired: 150, storyEra: "Formação dos Primeiros Átomos" },
  { level: 4, name: "Estrelas de Primeira Geração", xpRequired: 300, storyEra: "O Reacendimento do Universo" },
  { level: 5, name: "Cadinho de Elementos", xpRequired: 500, storyEra: "Supernovas e Metalicidade" },
  { level: 6, name: "Arquitetura Galáctica", xpRequired: 800, storyEra: "Formação da Via Láctea" },
  { level: 7, name: "Nascimento Solar", xpRequired: 1200, storyEra: "O Sistema Solar Primitivo" },
  { level: 8, name: "Mundo de Magma", xpRequired: 1700, storyEra: "Hadeano: A Terra Recém-Nascida" },
  { level: 9, name: "Sopa Orgânica", xpRequired: 2300, storyEra: "O Surgimento da Vida (ABIOGÊNESE)" },
  { level: 10, name: "Grande Oxidação", xpRequired: 3000, storyEra: "Cianobactérias e a Mudança Atmosférica" },
  { level: 11, name: "Complexidade Celular", xpRequired: 4000, storyEra: "A Ascensão dos Eucariontes" },
  { level: 12, name: "Explosão Cambriana", xpRequired: 5500, storyEra: "A Diversificação da Vida Marinha" },
  { level: 13, name: "Conquista da Terra", xpRequired: 7500, storyEra: "Plantas e Anfíbios nos Continentes" },
  { level: 14, name: "Era dos Gigantes", xpRequired: 10000, storyEra: "O Reinado dos Dinossauros" },
  { level: 15, name: "Aurora Humana", xpRequired: 13000, storyEra: "Hominídeos e o Domínio do Fogo" },
  { level: 16, name: "Civilização", xpRequired: 17000, storyEra: "Escrita, Agricultura e Impérios" },
  { level: 17, name: "O Presente", xpRequired: 22000, storyEra: "Era Digital e Exploração Espacial" }
];
