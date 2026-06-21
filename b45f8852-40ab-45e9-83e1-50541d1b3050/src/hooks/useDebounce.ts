import { useState, useEffect } from 'react';

/**
 * 防抖Hook：延迟更新值，直到在指定延迟时间内没有新的变化
 *
 * @template T 值的类型
 * @param value 需要防抖的值
 * @param delay 延迟时间（毫秒），默认300ms
 * @returns 防抖后的值
 *
 * @example
 * ```tsx
 * const [search, setSearch] = useState('');
 * const debouncedSearch = useDebounce(search, 500);
 *
 * useEffect(() => {
 *   // 当用户停止输入500ms后才会执行搜索
 *   fetchResults(debouncedSearch);
 * }, [debouncedSearch]);
 * ```
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
