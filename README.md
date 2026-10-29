# Super Inventario PRO V9 — Fotos + Google Photos + Responsive

V9 conserva el sistema multiusuario/multitienda de V8 y añade un flujo mejorado para imágenes de productos y una revisión responsive global.

## Novedades V9

- El producto puede usar una **URL de imagen** como antes.
- También puede **subir una foto directamente desde PC o celular**.
- La imagen principal se guarda en **Firebase Storage** y Firestore guarda su URL estable.
- Opción **“Guardar también en Google Photos”** para crear una copia en la biblioteca Google del usuario.
- Firestore conserva `googlePhotosMediaItemId` y `googlePhotosProductUrl` cuando la copia se crea correctamente.
- El catálogo, POS e inventario usan la URL de Firebase Storage porque Google Photos no entrega una URL pública permanente para usar como CDN.
- Nueva revisión responsive para dashboard, POS, finanzas, calendario, inventario, formularios, modales, tablas, catálogo, marketing y login.

## Por qué se usan Firebase Storage + Google Photos

Google Photos permite subir fotos mediante `photoslibrary.appendonly`, pero las URLs base (`baseUrl`) que devuelve la API son temporales. Por eso Google Photos se usa como copia personal y Firebase Storage como origen estable de la imagen que debe mostrarse en el catálogo público.

## Configurar Firebase

En Firebase Console activa:

1. Authentication → Email/Password.
2. Authentication → Google.
3. Storage.
4. Firestore.

Copia `.env.example` a `.env` y agrega la configuración real:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## Activar Google Photos

La integración usa el mismo proyecto de Google Cloud asociado a Firebase.

1. Abre Google Cloud Console.
2. Selecciona el proyecto asociado a Firebase.
3. Ve a **APIs & Services → Library**.
4. Busca **Photos Library API** y actívala.
5. Ve a **APIs & Services → OAuth consent screen**.
6. Configura la pantalla de consentimiento de la aplicación.
7. La aplicación solicitará el scope:

```text
https://www.googleapis.com/auth/photoslibrary.appendonly
```

Si la pantalla OAuth está en modo **Testing**, agrega como usuarios de prueba las cuentas Google que vayan a probar la función.

La autorización de Photos se solicita únicamente cuando el usuario marca **Guardar también en Google Photos** y elige una imagen.

## Cómo funciona una foto de producto

Al crear o editar un producto:

1. Puedes pegar `Imagen por URL`, o pulsar **Elegir foto**.
2. El archivo se valida (imagen y máximo 5 MB).
3. Se guarda en:

```text
Firebase Storage:
stores/{uid}/products/{archivo}
```

4. La URL de Storage se guarda como `imageUrl` del producto.
5. Si la copia Google Photos está activada, el usuario autoriza Google y la app también sube la misma foto a Google Photos.
6. Se guardan en Firestore los identificadores de Google Photos, pero la vista pública continúa usando `imageUrl`.

## Multiusuario

Cada usuario mantiene su espacio aislado:

```text
users/{uid}

stores/{uid}
  products/{productId}
  sales/{saleId}
  purchases/{purchaseId}
  expenses/{expenseId}
  inventoryMovements/{movementId}
  customers/{customerId}
  documents/{documentId}
```

Las imágenes también quedan separadas por UID en Firebase Storage.

## Responsive V9

Se revisaron rangos aproximados de:

- Escritorio grande: más de 1200 px.
- Laptop/tablet horizontal: 980–1200 px.
- Tablet: 640–980 px.
- Móvil: 360–640 px.
- Pantallas muy pequeñas: menos de 360 px.

En móvil:

- Navegación mediante menú lateral.
- Acciones se apilan cuando no caben.
- Dashboard y paneles financieros bajan a una columna.
- POS reduce progresivamente su cuadrícula.
- Modales ocupan el ancho y se comportan como panel inferior.
- Las tablas complejas usan scroll horizontal táctil.
- Calendario conserva su cuadrícula mediante scroll para no deformar los días.
- La carga de imagen pasa a vista vertical.

## Reglas

Publica las reglas incluidas:

```powershell
firebase login
firebase use TU_PROJECT_ID
firebase deploy --only firestore:rules
firebase deploy --only storage
```

Storage permite lectura pública de las imágenes de tienda para que el catálogo público pueda mostrarlas, pero solamente el propietario autenticado del UID puede escribir en su carpeta.

## Ejecutar

```powershell
npm install
npm run dev
```

## Prueba recomendada

1. Inicia sesión con una cuenta.
2. Crea un producto.
3. Activa **Guardar también en Google Photos**.
4. Pulsa **Elegir foto** y selecciona JPG/PNG/WEBP.
5. Autoriza el permiso de Google Photos cuando aparezca.
6. Comprueba que la vista previa se muestre en Inventario.
7. Guarda el producto.
8. Abre el catálogo público y verifica la imagen.
9. Desde el producto, usa **Ver copia en Google Photos** para confirmar el respaldo.
10. Repite en móvil para revisar el comportamiento responsive.
