# Imagen base Node.js 20 LTS Alpine
FROM node:20-alpine

# Directorio de trabajo en el contenedor
WORKDIR /app

# Copiar manifiestos de dependencias
COPY package*.json ./

# Instalar dependencias para producción
RUN npm install --omit=dev

# Copiar el resto del código de la aplicación
COPY . .

# Exponer el puerto del servidor
EXPOSE 3000

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000

# Comando para ejecutar la aplicación
CMD ["npm", "start"]
