import { useState, useEffect, useRef, useCallback } from 'react';

export type LazyImageStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface UseLazyImageOptions {
  /** Root margin passed to IntersectionObserver. Default: '0px' */
  rootMargin?: string;
  /** Threshold passed to IntersectionObserver. Default: 0 */
  threshold?: number | number[];
}

export interface UseLazyImageResult {
  /** Ref to attach to the container/img element so the observer can watch it */
  ref: React.RefObject<HTMLImageElement | null>;
  /** Current load status */
  status: LazyImageStatus;
  /** True once the image has fully loaded */
  isLoaded: boolean;
  /** True while in viewport and image hasn't finished loading */
  isLoading: boolean;
  /** True if the image failed to load */
  isError: boolean;
  /** Call when the img onLoad event fires */
  onLoad: () => void;
  /** Call when the img onError event fires */
  onError: () => void;
  /** The src to set on the img element (undefined until element enters viewport) */
  src: string | undefined;
}

/**
 * Defers image loading until the element enters the viewport.
 * Uses the native IntersectionObserver API — no external dependencies.
 *
 * @example
 * const { ref, src, isLoaded, onLoad, onError } = useLazyImage('/photo.jpg');
 * return <img ref={ref} src={src} onLoad={onLoad} onError={onError} />;
 */
export function useLazyImage(
  imageSrc: string,
  options: UseLazyImageOptions = {}
): UseLazyImageResult {
  const { rootMargin = '0px', threshold = 0 } = options;

  const ref = useRef<HTMLImageElement>(null);
  const [status, setStatus] = useState<LazyImageStatus>('idle');
  const [src, setSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // If IntersectionObserver is not supported, load immediately
    if (typeof IntersectionObserver === 'undefined') {
      setSrc(imageSrc);
      setStatus('loading');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setSrc(imageSrc);
          setStatus('loading');
          observer.disconnect();
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [imageSrc, rootMargin, threshold]);

  const onLoad = useCallback(() => {
    setStatus('loaded');
  }, []);

  const onError = useCallback(() => {
    setStatus('error');
  }, []);

  return {
    ref,
    status,
    isLoaded: status === 'loaded',
    isLoading: status === 'loading',
    isError: status === 'error',
    onLoad,
    onError,
    src,
  };
}
