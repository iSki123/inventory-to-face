import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { VehicleImageWithBlur } from './VehicleImageWithBlur';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

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

  const handleImageClick = (index: number) => {
    setSelectedImageIndex(index);
  };

  const handlePrevImage = () => {
    if (selectedImageIndex !== null && selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1);
    }
  };

  const handleNextImage = () => {
    if (selectedImageIndex !== null && selectedImageIndex < validImages.length - 1) {
      setSelectedImageIndex(selectedImageIndex + 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      handlePrevImage();
    } else if (e.key === 'ArrowRight') {
      handleNextImage();
    } else if (e.key === 'Escape') {
      setSelectedImageIndex(null);
    }
  };

  if (loading) {
    return (
      <div className={`space-y-2 ${className}`}>
        <h3 className="text-sm font-medium text-muted-foreground">
          Vehicle Images (Validating...)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: Math.min(images?.length || 0, 4) }).map((_, index) => (
            <div
              key={index}
              className="aspect-[4/3] bg-muted animate-pulse rounded-lg"
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
        <div className="aspect-[4/3] bg-muted rounded-lg flex items-center justify-center">
          <p className="text-sm text-muted-foreground">No valid images available</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`space-y-3 ${className}`}>
        <h3 className="text-sm font-medium text-muted-foreground">
          Vehicle Images ({validImages.length})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {validImages.map((imageUrl, index) => (
            <div
              key={`${imageUrl}-${index}`}
              className="aspect-[4/3] relative group cursor-pointer overflow-hidden rounded-lg border border-border hover:border-primary/50 transition-all duration-200"
              onClick={() => handleImageClick(index)}
            >
              <VehicleImageWithBlur
                src={imageUrl}
                alt={`${vehicleName} - Image ${index + 1}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/90 rounded-full p-2">
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Image Viewer Modal */}
      {selectedImageIndex !== null && (
        <Dialog open={selectedImageIndex !== null} onOpenChange={() => setSelectedImageIndex(null)}>
          <DialogContent 
            className="max-w-4xl w-full h-[80vh] p-0 overflow-hidden"
            onKeyDown={handleKeyDown}
          >
            <div className="relative w-full h-full bg-black flex items-center justify-center">
              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-10 bg-black/50 text-white hover:bg-black/70"
                onClick={() => setSelectedImageIndex(null)}
              >
                <X className="h-4 w-4" />
              </Button>

              {/* Navigation buttons */}
              {validImages.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-black/50 text-white hover:bg-black/70 disabled:opacity-30"
                    onClick={handlePrevImage}
                    disabled={selectedImageIndex === 0}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-black/50 text-white hover:bg-black/70 disabled:opacity-30"
                    onClick={handleNextImage}
                    disabled={selectedImageIndex === validImages.length - 1}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                </>
              )}

              {/* Main image */}
              <img
                src={validImages[selectedImageIndex]}
                alt={`${vehicleName} - Image ${selectedImageIndex + 1}`}
                className="max-w-full max-h-full object-contain"
              />

              {/* Image counter */}
              {validImages.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                  {selectedImageIndex + 1} of {validImages.length}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};