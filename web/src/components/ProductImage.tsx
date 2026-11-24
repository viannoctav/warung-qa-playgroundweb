import { useState } from 'react'
import { categoryLabel } from '../validation/product'

type Props = {
  imageUrl: string | null
  name: string
  category: string
  testId: string
  size?: 'thumb' | 'card' | 'large'
}

// Gambar produk; kalau belum ada (atau gagal dimuat) tampil kotak bertuliskan kategori
export default function ProductImage({ imageUrl, name, category, testId, size = 'card' }: Props) {
  const [failed, setFailed] = useState(false)
  const showImage = imageUrl && !failed

  return (
    <div className={`product-image product-image-${size} cat-${category}`} id={testId} data-testid={testId}>
      {showImage ? (
        <img src={imageUrl} alt={name} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span className="product-image-placeholder" aria-label={`${name} (belum ada gambar)`} role="img">
          {size === 'thumb' ? categoryLabel(category).slice(0, 2) : categoryLabel(category)}
        </span>
      )}
    </div>
  )
}
