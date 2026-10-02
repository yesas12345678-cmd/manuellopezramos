import fs from 'fs/promises';
import path from 'path';

const dbPath = path.resolve('db.json');

/**
 * Lee la base de datos db.json de forma segura.
 */
export async function readDB() {
  try {
    const data = await fs.readFile(dbPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error leyendo db.json, inicializando base de datos vacía:', error);
    const emptyDB = {
      gym: [],
      sitemaps: [],
      security: { targets: [], logs: [] },
      leads: { productIdeas: [], leadsList: [] },
      gmail: { chatHistory: [] },
      grades: { subjects: ['Matemáticas', 'FyQ', 'Dibujo Técnico', 'Filosofía', 'Tecnología', 'Lengua', 'Inglés'], entries: [] }
    };
    await writeDB(emptyDB);
    return emptyDB;
  }
}

/**
 * Guarda los datos en db.json de forma estructurada.
 */
export async function writeDB(data) {
  try {
    await fs.writeFile(dbPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error escribiendo en db.json:', error);
    throw error;
  }
}
