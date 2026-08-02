import { auditSitemap } from './services/sitemapChecker.js';
import { runSecurityScan } from './services/pentest.js';
import { readDB, writeDB } from './services/dbHelper.js';

async function runTests() {
  console.log('=== [TEST] INICIANDO PRUEBAS DE SERVICIOS ===\n');

  // Test 1: Base de Datos Local
  console.log('[TEST 1] Probando lectura y escritura de db.json...');
  try {
    const db = await readDB();
    console.log('✔ Base de datos leída con éxito.');
    console.log(`- Rutinas de gimnasio registradas: ${db.gym?.length || 0}`);
    console.log(`- Sitemaps registrados: ${db.sitemaps?.length || 0}`);
    console.log(`- Objetivos de pentesting: ${db.security?.targets?.length || 0}\n`);
  } catch (err) {
    console.error('❌ Error en Test 1 (db.json):', err.message);
  }

  // Test 2: Escáner de Vulnerabilidades (Pentest)
  console.log('[TEST 2] Probando escáner de seguridad con "http://example.com"...');
  try {
    const result = await runSecurityScan('http://example.com');
    console.log('✔ Escaneo de seguridad finalizado con éxito.');
    console.log(`- Host escaneado: ${result.host}`);
    console.log(`- Fecha del escaneo: ${result.scanDate}`);
    console.log(`- Vulnerabilidades encontradas: ${result.vulnerabilities.length}`);
    result.vulnerabilities.forEach((v, idx) => {
      console.log(`  [${idx + 1}] [${v.severity}] ${v.title}: ${v.description.substring(0, 80)}...`);
    });
    console.log('');
  } catch (err) {
    console.error('❌ Error en Test 2 (Pentest):', err.message);
  }

  // Test 3: Auditoría de Sitemap XML
  console.log('[TEST 3] Probando parser de sitemap con sitemap de GitHub (mock o real)...');
  try {
    // Usamos el sitemap real de github.com/sitemap.xml o similar
    const result = await auditSitemap('https://github.com', 'https://github.com/sitemap.xml');
    console.log('✔ Auditoría de sitemap finalizada con éxito.');
    console.log(`- URL del Sitemap: ${result.sitemapUrl}`);
    console.log(`- URLs encontradas: ${result.sitemapCount}`);
    console.log(`- Artículos/enlaces en la web: ${result.webCount}`);
    console.log(`- Estado resultante: ${result.status}`);
    console.log(`- Mensaje: ${result.message}\n`);
  } catch (err) {
    console.error('❌ Error en Test 3 (Sitemap):', err.message);
  }

  console.log('=== [TEST] PRUEBAS FINALIZADAS ===');
}

runTests();
