import { useState } from 'react';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Brand logo helper.
 * Expects an image at /brand/logo_vectra.jpg (put it in /public/brand/logo_vectra.jpg).
 * Falls back to the Package icon if the image is missing.
 */
export function BrandLogo({
  className,
  imgClassName,
  withText = true,
  size = 'md',
  iconWrapClassName = 'bg-sidebar-primary',
  textPrimaryClassName = 'text-sidebar-foreground',
  textSecondaryClassName = 'text-sidebar-muted',
}: {
  className?: string;
  imgClassName?: string;
  withText?: boolean;
  size?: 'sm' | 'md' | 'lg';
  iconWrapClassName?: string;
  textPrimaryClassName?: string;
  textSecondaryClassName?: string;
}) {
  const [imgError, setImgError] = useState(false);

  const sizeStyles =
    size === 'lg'
      ? {
          wrap: 'w-12 h-12 rounded-xl',
          img: 'w-8 h-8',
          icon: 'w-7 h-7',
          text: 'text-2xl',
        }
      : size === 'sm'
        ? {
            wrap: 'w-8 h-8 rounded-md',
            img: 'w-5 h-5',
            icon: 'w-5 h-5',
            text: 'text-base',
          }
        : {
            wrap: 'w-10 h-10 rounded-lg',
            img: 'w-7 h-7',
            icon: 'w-6 h-6',
            text: 'text-lg',
          };

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn(sizeStyles.wrap, 'flex items-center justify-center', iconWrapClassName)}>
        {!imgError ? (
          <img
            src="/brand/logo_vectra.jpg"
            alt="Vectra Hub Cargo"
            className={cn(sizeStyles.img, 'object-contain', imgClassName)}
            onError={() => setImgError(true)}
          />
        ) : (
          <Package className={cn(sizeStyles.icon, 'text-sidebar-primary-foreground')} />
        )}
      </div>

      {withText && (
        <div className="leading-tight">
          <span className={cn('font-bold', textPrimaryClassName, sizeStyles.text)}>Vectra</span>
          <span className={cn('font-bold', textSecondaryClassName, sizeStyles.text)}> Cargo</span>
        </div>
      )}
    </div>
  );
}
