import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

// Card photos (seção 5.5): private bucket, one file per card at
// {user_id}/{card_id}.jpg, shown through short-lived signed URLs.
const BUCKET = 'card-photos'
const LONGEST_SIDE = 900
const QUALITY = 0.85
const SIGNED_SECONDS = 60 * 60

export const photoPath = (userId: string, cardId: string) =>
  `${userId}/${cardId}.jpg`

/** Resizes in the browser before uploading: longest side 900px, JPEG 0.85. */
export function shrinkImage(file: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const scale = Math.min(
        1,
        LONGEST_SIDE / Math.max(image.naturalWidth, image.naturalHeight),
      )
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      canvas
        .getContext('2d')!
        .drawImage(image, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error('Não consegui abrir essa imagem. Tenta outra.')),
        'image/jpeg',
        QUALITY,
      )
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não consegui abrir essa imagem. Tenta outra.'))
    }
    image.src = url
  })
}

export async function uploadCardPhoto(path: string, file: Blob) {
  const blob = await shrinkImage(file)
  const { error } = await supabase()
    .storage.from(BUCKET)
    .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
  if (error) throw new Error('Não consegui enviar a foto. Tenta de novo.')
}

export async function removeCardPhoto(path: string) {
  const { error } = await supabase().storage.from(BUCKET).remove([path])
  if (error) throw new Error('Não consegui tirar a foto. Tenta de novo.')
}

/** Signed URL for a card photo. After a new upload, invalidate ['card-photo', path]. */
export function useCardPhotoUrl(path: string | null) {
  return useQuery({
    queryKey: ['card-photo', path],
    enabled: Boolean(path),
    staleTime: (SIGNED_SECONDS - 300) * 1000,
    queryFn: async () => {
      const { data, error } = await supabase()
        .storage.from(BUCKET)
        .createSignedUrl(path!, SIGNED_SECONDS)
      if (error) throw error
      return data.signedUrl
    },
  }).data
}
