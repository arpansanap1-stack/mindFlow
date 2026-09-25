import React from 'react';

/**
 * Subtle pulse skeleton for calm loading states.
 */
export default function Skeleton({
  className = '',
  width,
  height,
  rounded = 'rounded-lg',
  ...props
}) {
  const style = {};
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <div
      className={`animate-pulse bg-[#f4f2ee] dark:bg-[#282623] ${rounded} ${className}`}
      style={style}
      aria-hidden="true"
      {...props}
    />
  );
}
