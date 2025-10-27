# ---- Etapa base ----
FROM node:18-alpine AS base

# Establecer el directorio de trabajo dentro del contenedor
WORKDIR /usr/src/app

# Copiar los archivos de dependencias
COPY package*.json ./

# Instalar dependencias (solo producción por defecto)
RUN npm install --production

# Copiar el resto del código fuente
COPY . .

# Exponer el puerto de la aplicación (ajústalo si tu app usa otro)
EXPOSE 3000

# Comando por defecto para ejecutar la app
CMD ["npm", "start"]
