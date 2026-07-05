# Registro TEA — prototipo

App web (PWA) para que padres de niños neurodivergentes registren cómo va el día: **ánimo, sueño, comidas y desajustes**, con la idea de más adelante detectar patrones y alertas.

Es un prototipo funcional para **usarlo unos días con datos reales** y validar si registrar es cómodo. Todo se guarda en el navegador (`localStorage`); no hay servidor ni cuenta.

## Cómo usarlo

**Opción rápida (ordenador):** abre `index.html` con doble clic. Funciona todo el registro y se guarda en ese navegador. (No hace falta Python ni Node.)

**Opción para el móvil / instalarla como app:** ejecuta `serve.ps1` (clic derecho → *Ejecutar con PowerShell*). Levanta un servidor local sin dependencias. Luego, desde el móvil en la misma wifi, abre `http://TU-IP:8123` y usa *Añadir a pantalla de inicio*. Para saber tu IP: `ipconfig` (busca "Dirección IPv4").

> Nota: los datos se guardan **por navegador y por origen**. Lo que registres abriendo el archivo (`file://`) y lo que registres vía `serve.ps1` (`http://…`) son almacenes distintos. Para usarla en serio, elige una sola forma de abrirla.

## Qué hace ahora

- **Registro rápido** de ánimo (Zonas de Regulación), sueño (latencia + calidad + detalle) y comidas (aceptación + reacción sensorial).
- **Botón de desajuste en caliente**: un toque marca la hora; luego completas el detalle (tipo de desregulación, intensidad, antecedente, señales tempranas, entorno sensorial, duración, qué ayudó) cuando el peque está tranquilo.
- **Historial** por días y **exportar** los datos a JSON.

## Pendiente (deuda anotada)

- Privacidad / RGPD: son datos de salud de un menor → antes de uso real, cifrado y modelo local-first serio.
- Multi-cuidador (varios padres/cuidadores compartiendo el registro).
- Pantalla de **análisis y patrones** (correlaciones sueño↔desajustes, disparadores frecuentes, qué ayuda, alertas suaves) e informes para profesionales.

## Estructura

- `index.html` — estructura y vistas
- `styles.css` — estilos (mobile-first, paleta calmada)
- `app.js` — lógica y almacenamiento local
- `manifest.webmanifest`, `sw.js`, `icon.svg` — soporte PWA (instalable / offline)
