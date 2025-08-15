import React, { useState, useEffect } from 'react';
import { VehicleImageWithBlur } from './VehicleImageWithBlur';

interface VehicleImageGalleryProps {
  images: string[];
  vehicleName: string;
  className?: string;
}

export const VehicleImageGallery: React.FC<VehicleImageGalleryProps> = ({
  images,
  vehicleName,
  className = ""
}) => {
  const [validImages, setValidImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const validateImages = async () => {
      if (!images || images.length === 0) {
        setValidImages([]);
        setLoading(false);
        return;
      }

      const imagePromises = images.map(async (imageUrl) => {
        try {
          return new Promise<string | null>((resolve) => {
            const img = new Image();
            const timeoutId = setTimeout(() => {
              resolve(null); // Timeout after 5 seconds
            }, 5000);

            img.onload = () => {
              clearTimeout(timeoutId);
              // Check if image has valid dimensions
              if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                resolve(imageUrl);
              } else {
                resolve(null);
              }
            };

            img.onerror = () => {
              clearTimeout(timeoutId);
              resolve(null);
            };

            // Handle CORS and other issues
            img.crossOrigin = 'anonymous';
            img.src = imageUrl;
          });
        } catch (error) {
          console.warn(`Failed to validate image: ${imageUrl}`, error);
          return null;
        }
      });

      const results = await Promise.all(imagePromises);
      const validUrls = results.filter((url): url is string => url !== null);
      
      setValidImages(validUrls);
      setLoading(false);
    };

    validateImages();
  }, [images]);

  if (loading) {
    return (
      <div className={`space-y-2 ${className}`}>
        <h3 className="text-sm font-medium text-muted-foreground">
          Vehicle Images (Validating...)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {Array.from({ length: Math.min(images?.length || 0, 4) }).map((_, index) => (
            <div
              key={index}
              className="aspect-video bg-muted animate-pulse rounded-lg"
            />
          ))}
        </div>
      </div>
    );
  }

  if (validImages.length === 0) {
    return (
      <div className={`space-y-2 ${className}`}>
        <h3 className="text-sm font-medium text-muted-foreground">
          Vehicle Images (0)
        </h3>
        <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
          <p className="text-sm text-muted-foreground">No valid images available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <h3 className="text-sm font-medium text-muted-foreground">
        Vehicle Images ({validImages.length})
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {validImages.map((imageUrl, index) => (
          <VehicleImageWithBlur
            key={`${imageUrl}-${index}`}
            src={imageUrl}
            alt={`${vehicleName} - Image ${index + 1}`}
            className="aspect-video object-cover rounded-lg border"
          />
        ))}
      </div>
    </div>
  );
};