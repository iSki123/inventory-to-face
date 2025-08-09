import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface VehicleImageWithBlurProps {
  src: string;
  alt: string;
  className?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

export const VehicleImageWithBlur = ({ src, alt, className, onError }: VehicleImageWithBlurProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [showBlur, setShowBlur] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (src) {
      const img = new Image();
      img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight;
        setAspectRatio(ratio);
        // Show blur bars if image is not close to 1:1 (allowing 10% tolerance)
        setShowBlur(ratio < 0.9 || ratio > 1.1);
        setImageLoaded(true);
      };
      img.onerror = () => {
        setImageLoaded(false);
        setShowBlur(false);
      };
      img.src = src;
    }
  }, [src]);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setImageLoaded(false);
    setShowBlur(false);
    onError?.(e);
  };

  if (!imageLoaded || !showBlur) {
    // For square images or when loading, show normally
    return (
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        className={cn("w-full h-full object-cover", className)}
        onError={handleImageError}
      />
    );
  }

  // For non-square images, show with blur background
  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Blurred background */}
      <div 
        className="absolute inset-0 bg-cover bg-center filter blur-md scale-110"
        style={{ 
          backgroundImage: `url(${src})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      />
      
      {/* Dark overlay to reduce blur intensity */}
      <div className="absolute inset-0 bg-black/20" />
      
      {/* Main image centered and contained */}
      <div className="relative w-full h-full flex items-center justify-center p-2">
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          className="max-w-full max-h-full object-contain drop-shadow-lg"
          onError={handleImageError}
        />
      </div>
    </div>
  );
};