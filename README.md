# PixelMapper

App web estática (sin frameworks) para visualizar un video original junto a su versión pixelada tipo matriz LED.

## Funcionalidades

- Carga de video por archivo local (`input type="file"`).
- Carga por URL pública.
- Vista side-by-side: original y pixelado.
- Matriz configurable (`cols x rows`) con presets.
- Modos de encuadre: `fit`, `fill`, `stretch`.
- Relación objetivo: `Original`, `1:1`, `1:2`, `2:1`.
- Selección manual de región sobre la vista original.
- Overlay de grilla y modo freeze.

## Ejecutar localmente

Como no requiere build, podés abrir `index.html` directamente en el navegador.

Si preferís servir por HTTP local:

```bash
python -m http.server 8000
```

Luego abrir `http://localhost:8000`.

## Deploy en GitHub Pages

1. Subir el contenido del proyecto al repositorio.
2. En GitHub: `Settings > Pages`.
3. Seleccionar deploy desde branch (`main` o `gh-pages`) y carpeta raíz.
4. Guardar y abrir la URL publicada.

## Notas sobre URL de video y CORS

- Para procesar frames de videos remotos en `<canvas>`, el servidor del video debe permitir CORS.
- Si no lo permite, el navegador bloquea la lectura de píxeles y la vista pixelada puede fallar.
- Con archivos locales no hay ese problema.

## Verificación manual sugerida

- Probar video 16:9 y 9:16.
- Cambiar matriz durante reproducción (`16x16`, `32x32`, personalizado).
- Cambiar relación objetivo (`Original`, `1:1`, `1:2`, `2:1`).
- Validar `fit`, `fill`, `stretch`.
- Activar selección manual, dibujar región y resetear.
