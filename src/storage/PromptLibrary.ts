/**
 * PromptLibrary — AsyncStorage CRUD for user-created prompt templates.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PromptTemplate } from '../utils/promptTemplates';

const STORAGE_KEY = '@prompt_library';

export const PromptLibrary = {
  async getAll(): Promise<PromptTemplate[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async save(template: PromptTemplate): Promise<void> {
    const all = await this.getAll();
    const idx = all.findIndex(t => t.id === template.id);
    if (idx >= 0) {
      all[idx] = template;
    } else {
      all.push(template);
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  },

  async remove(id: string): Promise<void> {
    const all = await this.getAll();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all.filter(t => t.id !== id)));
  },
};
