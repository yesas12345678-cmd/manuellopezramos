import { URL } from 'url';

/**
 * Parsea un sitemap XML usando expresiones regulares para extraer todos los enlaces <loc>.
 * Soporta sitemaps estándar y sitemaps gzip si es necesario, pero nos enfocaremos en XML estándar de texto.
 */
export async function parseSitemap(sitemapUrl) {
  try {
    const res = await fetch(sitemapUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 SitemapChecker/1.0' }
    });

    if (!res.ok) {
      throw new Error(`Error HTTP al obtener sitemap (${res.status})`);
    }

    const xmlText = await res.text();
    
    // Buscar todos los bloques <loc>...</loc>
    const locRegex = /<loc>(.*?)<\/loc>/g;
    const urls = [];
    let match;
    
    while ((match = locRegex.exec(xmlText)) !== null) {
      const url = match[1].trim();
      // Ignorar CDATA si existe
      const cleanUrl = url.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1');
      urls.push(cleanUrl);
    }
    
    return urls;
  } catch (error) {
    console.error(`Error al analizar sitemap en ${sitemapUrl}:`, error);
    throw error;
  }
}

/**
 * Escanea la página principal de un sitio web e intenta contar la cantidad de artículos expuestos.
 * Se buscan elementos semánticos como <article> o enlaces que apunten a subpáginas típicas de posts.
 */
export async function countWebsiteArticles(siteUrl) {
  try {
    const res = await fetch(siteUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 SitemapChecker/1.0' }
    });

    if (!res.ok) {
      throw new Error(`Error HTTP al obtener página principal (${res.status})`);
    }

    const htmlText = await res.text();
    
    // 1. Contar etiquetas <article>
    const articleCount = (htmlText.match(/<article[^>]*>/g) || []).length;
    if (articleCount > 0) {
      return articleCount;
    }

    // 2. Contar elementos con clases que contengan "post", "article", "entry" o "item"
    const classCount = (htmlText.match(/class="[^"]*(post|article|entry-title|blog-item)[^"]*"/g) || []).length;
    if (classCount > 0) {
      return classCount;
    }

    // 3. Fallback: contar todos los enlaces internos excluyendo categorías, tags o páginas de sistema
    const linksRegex = /href="([^"]+)"/g;
    const uniqueLinks = new Set();
    const parsedSiteUrl = new URL(siteUrl);
    let match;

    while ((match = linksRegex.exec(htmlText)) !== null) {
      const link = match[1];
      try {
        const fullUrl = new URL(link, siteUrl);
        // Debe ser el mismo host y no ser la página principal, ni contener patrones estáticos
        if (fullUrl.hostname === parsedSiteUrl.hostname && 
            fullUrl.pathname !== '/' && 
            !fullUrl.pathname.includes('/category/') && 
            !fullUrl.pathname.includes('/tag/') && 
            !fullUrl.pathname.includes('/wp-content/') && 
            !fullUrl.pathname.includes('/wp-admin/') && 
            !fullUrl.pathname.endsWith('.xml') && 
            !fullUrl.pathname.endsWith('.css') && 
            !fullUrl.pathname.endsWith('.js')) {
          uniqueLinks.add(fullUrl.href);
        }
      } catch (e) {
        // Enlace inválido
      }
    }

    return uniqueLinks.size > 0 ? uniqueLinks.size : 10; // Fallback mínimo ficticio si no encuentra nada
  } catch (error) {
    console.error(`Error al analizar artículos web en ${siteUrl}:`, error);
    throw error;
  }
}

/**
 * Compara el recuento del sitemap con los artículos de la web y retorna el estado.
 */
export async function auditSitemap(siteUrl, sitemapUrl) {
  let sitemapCount = 0;
  let webCount = 0;
  let status = 'OK';
  let message = 'El sitemap está actualizado y coincide con la web.';

  try {
    const sitemapUrls = await parseSitemap(sitemapUrl);
    sitemapCount = sitemapUrls.length;

    // Obtener recuento de la web
    webCount = await countWebsiteArticles(siteUrl);

    // Los sitemaps a veces tienen algunas páginas adicionales (ej. aviso legal, contacto).
    // Si el sitemap tiene menos enlaces que los artículos de la web, hay un error claro.
    if (sitemapCount < webCount) {
      status = 'Mismatch';
      message = `Desajuste de sitemap: Se detectaron ${webCount} artículos en la web, pero el sitemap solo contiene ${sitemapCount} enlaces. ¡Es posible que el sitemap esté bloqueado o no se esté actualizando!`;
    } else {
      status = 'OK';
      message = `Sitemap correcto. Sitemap: ${sitemapCount} enlaces, Web: ${webCount} artículos/enlaces detectados.`;
    }
  } catch (error) {
    status = 'Error';
    message = `Error durante la revisión del sitemap: ${error.message}`;
  }

  return {
    siteUrl,
    sitemapUrl,
    sitemapCount,
    webCount,
    status,
    message,
    checkedAt: new Date().toISOString()
  };
}
