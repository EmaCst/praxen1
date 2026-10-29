# Praxen Analytics · React

Panel administrativo de Praxen para consultar sesiones, métricas por ejercicio, evolución, atletas, grupos, usuarios y auditoría.

## Tecnologías

- React 19 (componentes, hooks y estado)
- Vite 6 (desarrollo y compilación)
- Lucide React (iconografía accesible)
- CSS responsivo con modo móvil y preferencias de movimiento reducido
- API-Praxen (Node / PostgreSQL) como fuente de datos. No se guardan contraseñas ni JWT en localStorage.

## Desarrollo local

Requiere Node 20.19+ o Node 22.12+.

```bash
npm install
npm run dev
```

La aplicación usa `https://api-praxen.onrender.com` por defecto. Para apuntar a otra API crea un archivo `.env.local` (no lo subas a GitHub):

```env
VITE_API_URL=https://tu-api.ejemplo.com
```

**Importante:** autoriza el origen local `http://localhost:5173` en `CORS_ORIGINS` de la API si deseas realizar pruebas desde Vite.

## Compilar

```bash
npm run build
npm run preview
```

Los archivos de producción se generan en `dist/`.

## Despliegue en Vercel

- Framework Preset: **Vite**
- Build command: **npm run build**
- Output directory: **dist**
- Install command: **npm install**
- Root directory: **.**
- Variable opcional: `VITE_API_URL`

`vercel.json` incluye la reescritura necesaria para SPA. Permite el dominio de Vercel en el CORS de Render.

## Funcionalidades

- Inicio de sesión administrativo con token JWT mantenido exclusivamente en memoria.
- Pantalla obligatoria para cambio de contraseña temporal cuando la API retorna `mustChangePassword`.
- Resumen general, filtros por fecha/federación/ejercicio/grupo, KPIs y gráficos.
- Directorio y perfil individual de atletas; sesiones y detalles.
- Comparación entre dos atletas por ejercicio.
- Grupos: administración y pertenencia múltiple de deportistas.
- Super Admin: usuarios, restablecimiento de contraseña, administradores y auditoría.
- Exportación CSV de las sesiones **visibles**, no de todo el historial.

## Antes de producción

1. Comprobar `npm run build` y el workflow de GitHub Actions.
2. Verificar la API nueva desplegada y las migraciones de grupos/contraseñas sobre una base de pruebas.
3. Verificar login de Admin y Super Admin, restablecimiento y cambio de contraseña, filtro por grupo y acceso denegado a usuarios sin permisos.
4. Probar responsive en móvil y ordenador.

El archivo `app.js` anterior se conserva temporalmente como respaldo de la implementación estática, pero **ya no se carga** en `index.html`.
