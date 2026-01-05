
import { GoogleGenAI } from "@google/genai";
import { LevelInfo } from "../types.ts";

export async function getLevelNarrative(level: LevelInfo): Promise<string> {
  try {
    // Instanciação dentro da função para evitar erros globais de carregamento
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Conte um parágrafo curto, inspirador e educativo (máximo 150 palavras) sobre a história do universo/mundo especificamente sobre o estágio: "${level.storyEra}". Este é o Nível ${level.level} de uma jornada de evolução. Fale como se estivesse narrando a evolução de um planeta para seu guardião. Use português do Brasil.`,
      config: {
        temperature: 0.8,
        topP: 0.95,
      }
    });
    return response.text || "O cosmos aguarda sua próxima ação...";
  } catch (error) {
    console.error("Erro ao buscar narrativa Gemini:", error);
    return `Você alcançou a era: ${level.storyEra}. O conhecimento desta época está sendo descriptografado no registro universal...`;
  }
}
