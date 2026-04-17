import * as React from 'react';
import { cn } from '@/lib/utils';
import { useLazyImage, type UseLazyImageOptions } from '@/hooks/useLazyImage';

export interface LazyImageProps extends Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'onLoad' | 'onError'
> {
  /** The image URL to lazy-load */
  src: string;
  /** Optional node rendered while the image is loading (replaces default skeleton) */
  fallback?: React.ReactNode;
  /** Options forwarded to useLazyImage / IntersectionObserver */
  observerOptions?: UseLazyImageOptions;
}

/**
 * Drop-in replacement for `<img>` that defers loading until the element
 * enters the viewport.
 *
 * - Shows an animate-pulse skeleton while loading (or a custom `fallback`)
 * - Fades in the image with opacity 0→1 once loaded
 * - No layout shift: the wrapper preserves width/height at all times
 * - Forwards all standard img attributes (alt, width, height, className, etc.)
 *
 * @example
 * <LazyImage
 *   src="/brand/logo_vectra.jpg"
 *   alt="Vectra Hub Cargo"
 *   width={28}
 *   height={28}
 *   className="object-contain w-7 h-7"
 * />
 */
export const LazyImage = React.forwardRef<HTMLImageElement, LazyImageProps>(
  (
    { src, fallback, observerOptions, className, style, width, height, ...imgProps },
    forwardedRef
  ) => {
    const {
      ref: observerRef,
      src: lazySrc,
      isLoaded,
      isError,
      onLoad,
      onError,
    } = useLazyImage(src, observerOptions);

    // Merge the observer ref with any forwarded ref
    const mergedRef = React.useCallback(
      (node: HTMLImageElement | null) => {
        (observerRef as React.MutableRefObject<HTMLImageElement | null>).current = node;
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          (forwardedRef as React.MutableRefObject<HTMLImageElement | null>).current = node;
        }
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [forwardedRef]
    );

    const showSkeleton = !isLoaded && !isError;

    return (
      <span
        className="relative inline-block"
        style={{ width, height, ...style }}
        aria-hidden={showSkeleton ? true : undefined}
      >
        {/* Skeleton placeholder — shown until image loads or errors */}
        {showSkeleton && (
          <span className="absolute inset-0 rounded-sm bg-muted animate-pulse" aria-hidden="true">
            {fallback}
          </span>
        )}

        {/* The actual img element — always mounted so the ref can be observed */}
        <img
          ref={mergedRef}
          src={lazySrc}
          width={width}
          height={height}
          onLoad={onLoad}
          onError={onError}
          className={cn(
            'transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0',
            className
          )}
          {...imgProps}
        />
      </span>
    );
  }
);

LazyImage.displayName = 'LazyImage';
