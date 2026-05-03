import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatModelName(id: string, name: string) {
  let displayName = name || id;
  // Remove free labels
  displayName = displayName.replace(/\s*\(free\)\s*/gi, '').replace(/:free$/gi, '').trim();
  
  // Clean up if it has a colon prefix like "Tencent: " or "NVIDIA: "
  if (displayName.includes(':')) {
    const parts = displayName.split(':');
    displayName = parts[parts.length - 1].trim(); 
  }
  
  // Clean up if it has a slash prefix like "meta-llama/"
  if (displayName.includes('/')) {
    const parts = displayName.split('/');
    displayName = parts[parts.length - 1].trim();
  }

  // Nice casing
  if (/^llama/i.test(displayName)) displayName = displayName.replace(/^llama/i, 'Llama');
  if (/^gemini/i.test(displayName)) displayName = displayName.replace(/^gemini/i, 'Gemini');
  if (/^claude/i.test(displayName)) displayName = displayName.replace(/^claude/i, 'Claude');
  if (/^qwen/i.test(displayName)) displayName = displayName.replace(/^qwen/i, 'Qwen');
  if (/^mistral/i.test(displayName)) displayName = displayName.replace(/^mistral/i, 'Mistral');
  if (/^nemotron/i.test(displayName)) displayName = displayName.replace(/^nemotron/i, 'Nemotron');
  if (/^deepseek/i.test(displayName)) displayName = displayName.replace(/^deepseek/i, 'DeepSeek');

  return displayName || id;
}

export function sortModels(models: any[]) {
  const getScore = (id: string, name: string) => {
    let score = 0;
    const lowerId = id.toLowerCase();
    
    // Prioritize newest/most powerful models
    if (lowerId.includes('gemini-2')) score += 1000;
    if (lowerId.includes('gemini-1.5')) score += 500;
    
    if (lowerId.includes('llama-3.3')) score += 900;
    if (lowerId.includes('llama-3.2')) score += 800;
    if (lowerId.includes('llama-3.1')) score += 700;
    if (lowerId.includes('llama-3')) score += 600;

    if (lowerId.includes('claude-3.5')) score += 1000;
    if (lowerId.includes('claude-3')) score += 500;

    if (lowerId.includes('qwen-2.5') || lowerId.includes('qwen2.5')) score += 800;
    if (lowerId.includes('deepseek-v3') || lowerId.includes('deepseek-r1') || lowerId.includes('deepseek-chat')) score += 1000;
    if (lowerId.includes('mistral-large')) score += 800;
    if (lowerId.includes('mixtral-8x22')) score += 700;
    if (lowerId.includes('nemotron')) score += 700;
    if (lowerId.includes('phi-4')) score += 600;
    if (lowerId.includes('gemma-2')) score += 500;
    if (lowerId.includes('gemma-1') || lowerId.includes('gemma-7b')) score += 400;

    // Prefer instruct over base
    if (lowerId.includes('instruct') || lowerId.includes('-it')) score += 50;
    
    // Penalize older or smaller models slightly so larger/newer stay on top
    if (lowerId.includes('8b') || lowerId.includes('7b')) score -= 10;
    if (lowerId.includes('3b') || lowerId.includes('1b')) score -= 20;

    // Extra points for very large models (70B, 405B, etc)
    if (lowerId.includes('70b') || lowerId.includes('72b') || lowerId.includes('67b')) score += 50;
    if (lowerId.includes('405b') || lowerId.includes('nemotron-4')) score += 100;

    return score;
  };

  return [...models].sort((a, b) => {
    const scoreA = getScore(a.name, a.displayName);
    const scoreB = getScore(b.name, b.displayName);
    if (scoreA !== scoreB) {
      return scoreB - scoreA; // highest score first
    }
    // alphabetical fallback
    return a.displayName.localeCompare(b.displayName);
  });
}
