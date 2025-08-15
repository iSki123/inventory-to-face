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
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (src) {
      const img = new Image();
      img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight;
        setAspectRatio(ratio);
        setImageLoaded(true);
      };
      img.onerror = () => {
        setImageLoaded(false);
      };
      img.src = src;
    }
  }, [src]);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setImageLoaded(false);
    onError?.(e);
  };

  if (!imageLoaded) {
    // Loading state - show placeholder
    return (
      <div className={cn("w-full h-full bg-muted flex items-center justify-center", className)}>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  // Always use blur background for consistent 1:1 appearance
  // This creates the Instagram-style square frame with blur bars
  return (
    <div className={cn("relative w-full h-full overflow-hidden", className)}>
      {/* Blurred background that fills the entire container */}
      <div 
        className="absolute inset-0 bg-cover bg-center filter blur-lg scale-110"
        style={{ 
          backgroundImage: `url(${src})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      />
      
      {/* Dark overlay to soften the blur and improve contrast */}
      <div className="absolute inset-0 bg-black/30" />
      
      {/* Main image centered and contained within the square frame */}
      <div className="relative w-full h-full flex items-center justify-center p-1">
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          className="max-w-full max-h-full object-contain drop-shadow-md"
          onError={handleImageError}
        />
      </div>
    </div>
  );
};