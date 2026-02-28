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
- Ajuste de selección con `handles` en esquinas y arrastre del área.
- Opción para bloquear la selección a una relación de aspecto fija.
- Selector de aspecto de selección: salida, video, matriz o presets (`1:1`, `1:2`, `2:1`).
- Overlay de grilla y modo freeze.

## Ejecutar localmente

Como no requiere build, se ejecuta con un servidor HTTP local:

```bash
python -m http.server 8000
```

Luego abrir `http://localhost:8000`.

## Deploy en GitHub Pages

1. Subir el contenido del proyecto al repositorio.
2. En GitHub: `Settings > Pages`.
3. Seleccionar deploy desde branch (`main` o `gh-pages`) y carpeta raíz.
4. Guardar y abrir la URL publicada.

## Notas sobre URL de video

- La URL debe apuntar al archivo de video directo (por ejemplo `.mp4`, `.webm`), no a una página HTML.
- Algunos servidores bloquean hotlinking o no soportan `range requests`; en esos casos el video puede no cargar.
- Si un host aplica restricciones adicionales del navegador, puede haber diferencias entre proveedores.

## Verificación manual sugerida

- Probar video 16:9 y 9:16.
- Cambiar matriz durante reproducción (`16x16`, `32x32`, personalizado).
- Cambiar relación objetivo (`Original`, `1:1`, `1:2`, `2:1`).
- Validar `fit`, `fill`, `stretch`.
- Activar selección manual, dibujar región y resetear.
