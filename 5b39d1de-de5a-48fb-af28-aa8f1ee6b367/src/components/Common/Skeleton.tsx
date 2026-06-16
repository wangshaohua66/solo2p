interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  rounded?: string;
  className?: string;
}

export const Skeleton = ({ width, height, rounded = 'rounded-md', className = '' }: SkeletonProps) => {
  return (
    <div
      className={`skeleton ${rounded} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width ?? '100%',
        height: typeof height === 'number' ? `${height}px` : height ?? '16px',
      }}
    />
  );
};

export default Skeleton;
