const PHOTOS_UPLOAD_URL = 'https://photoslibrary.googleapis.com/v1/uploads'
const PHOTOS_CREATE_URL = 'https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate'

export async function uploadProductPhotoToGooglePhotos(file, accessToken) {
  if (!file || !accessToken) throw new Error('Falta la imagen o la autorización de Google Photos.')

  const uploadResponse = await fetch(PHOTOS_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-type': 'application/octet-stream',
      'X-Goog-Upload-Content-Type': file.type || 'image/jpeg',
      'X-Goog-Upload-Protocol': 'raw',
    },
    body: file,
  })

  if (!uploadResponse.ok) {
    const detail = await uploadResponse.text().catch(() => '')
    throw new Error(`Google Photos rechazó la carga (${uploadResponse.status}). ${detail}`.trim())
  }

  const uploadToken = await uploadResponse.text()
  if (!uploadToken) throw new Error('Google Photos no devolvió un token de carga.')

  const createResponse = await fetch(PHOTOS_CREATE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      newMediaItems: [{
        simpleMediaItem: {
          fileName: file.name || `producto-${Date.now()}.jpg`,
          uploadToken,
        },
      }],
    }),
  })

  if (!createResponse.ok) {
    const detail = await createResponse.text().catch(() => '')
    throw new Error(`No se pudo crear la foto en Google Photos (${createResponse.status}). ${detail}`.trim())
  }

  const payload = await createResponse.json()
  const result = payload?.newMediaItemResults?.[0]
  if (result?.status?.code && result.status.code !== 0) {
    throw new Error(result.status.message || 'Google Photos no pudo crear el elemento multimedia.')
  }

  const item = result?.mediaItem
  if (!item?.id) throw new Error('Google Photos no devolvió el identificador de la foto.')

  return {
    id: item.id,
    productUrl: item.productUrl || '',
    filename: item.filename || file.name || '',
  }
}
