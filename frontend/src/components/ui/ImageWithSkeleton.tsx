import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

interface ImageWithSkeletonProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
}

export function ImageWithSkeleton({
  src,
  alt,
  width,
  height,
  className,
  loading = "lazy",
  fetchPriority,
}: ImageWithSkeletonProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [src]);

  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  return (
    <div
      className={cn("relative w-full overflow-hidden bg-skeleton", className)}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-300 motion-reduce:transition-none",
          loaded ? "pointer-events-none opacity-0" : "opacity-100",
        )}
        aria-hidden={loaded}
      >
        <div className="absolute inset-0 bg-skeleton" />
        <div className="image-skeleton-shimmer absolute inset-0" />
      </div>

      <img
        ref={imgRef}
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        decoding="async"
        fetchPriority={fetchPriority}
        onLoad={() => setLoaded(true)}
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-300 motion-reduce:transition-none",
          loaded ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
