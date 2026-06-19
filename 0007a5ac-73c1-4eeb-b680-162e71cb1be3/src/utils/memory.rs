use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;
use anyhow::{Result, anyhow};

pub const MEMORY_LIMIT_BYTES: usize = 200 * 1024 * 1024;

pub struct MemoryGuard {
    current_usage: AtomicUsize,
    limit: usize,
    cleanup_handlers: Mutex<Vec<Box<dyn Fn() -> usize + Send + Sync>>>,
}

impl MemoryGuard {
    pub fn new(limit: usize) -> Self {
        MemoryGuard {
            current_usage: AtomicUsize::new(0),
            limit,
            cleanup_handlers: Mutex::new(Vec::new()),
        }
    }

    pub fn global() -> &'static MemoryGuard {
        use std::sync::OnceLock;
        static INSTANCE: OnceLock<MemoryGuard> = OnceLock::new();
        INSTANCE.get_or_init(|| MemoryGuard::new(MEMORY_LIMIT_BYTES))
    }

    pub fn alloc(&self, size: usize) -> Result<()> {
        loop {
            let current = self.current_usage.load(Ordering::Acquire);
            let new_usage = current + size;

            if new_usage > self.limit {
                let freed = self.trigger_cleanup();
                if freed == 0 {
                    return Err(anyhow!(
                        "内存超出限制: 已用{}MB, 申请{}MB, 限制{}MB",
                        current / 1024 / 1024,
                        size / 1024 / 1024,
                        self.limit / 1024 / 1024
                    ));
                }
                continue;
            }

            match self.current_usage.compare_exchange(
                current,
                new_usage,
                Ordering::AcqRel,
                Ordering::Acquire,
            ) {
                Ok(_) => return Ok(()),
                Err(_) => continue,
            }
        }
    }

    pub fn dealloc(&self, size: usize) {
        self.current_usage.fetch_sub(size, Ordering::AcqRel);
    }

    pub fn current_usage(&self) -> usize {
        self.current_usage.load(Ordering::Acquire)
    }

    pub fn limit(&self) -> usize {
        self.limit
    }

    pub fn usage_percent(&self) -> f64 {
        (self.current_usage() as f64 / self.limit as f64) * 100.0
    }

    pub fn register_cleanup_handler<F>(&self, handler: F)
    where
        F: Fn() -> usize + Send + Sync + 'static,
    {
        let mut handlers = self.cleanup_handlers.lock().unwrap();
        handlers.push(Box::new(handler));
    }

    fn trigger_cleanup(&self) -> usize {
        let handlers = self.cleanup_handlers.lock().unwrap();
        let mut total_freed = 0usize;
        for handler in handlers.iter() {
            total_freed += handler();
        }
        if total_freed > 0 {
            self.current_usage.fetch_sub(total_freed.min(self.current_usage()), Ordering::AcqRel);
        }
        total_freed
    }

    pub fn check_and_cleanup_if_needed(&self, threshold_percent: f64) -> bool {
        if self.usage_percent() >= threshold_percent {
            self.trigger_cleanup();
            true
        } else {
            false
        }
    }
}

pub struct TrackedVec<T> {
    vec: Vec<T>,
    element_size: usize,
    guard: &'static MemoryGuard,
}

impl<T> TrackedVec<T> {
    pub fn new(element_size: usize) -> Self {
        TrackedVec {
            vec: Vec::new(),
            element_size,
            guard: MemoryGuard::global(),
        }
    }

    pub fn push(&mut self, value: T) -> Result<()> {
        self.guard.alloc(self.element_size)?;
        self.vec.push(value);
        Ok(())
    }

    pub fn extend(&mut self, iter: impl IntoIterator<Item = T>) -> Result<()> {
        for item in iter {
            self.push(item)?;
        }
        Ok(())
    }

    pub fn len(&self) -> usize {
        self.vec.len()
    }

    pub fn is_empty(&self) -> bool {
        self.vec.is_empty()
    }

    pub fn into_inner(self) -> Vec<T> {
        let total_size = self.vec.len() * self.element_size;
        self.guard.dealloc(total_size);
        self.vec
    }

    pub fn get(&self, index: usize) -> Option<&T> {
        self.vec.get(index)
    }

    pub fn iter(&self) -> std::slice::Iter<T> {
        self.vec.iter()
    }

    pub fn clear(&mut self) {
        let total_size = self.vec.len() * self.element_size;
        self.vec.clear();
        self.guard.dealloc(total_size);
    }

    pub fn drain_batch(&mut self, count: usize) -> Vec<T> {
        let drain_count = count.min(self.vec.len());
        let drained: Vec<T> = self.vec.drain(..drain_count).collect();
        let freed_size = drained.len() * self.element_size;
        self.guard.dealloc(freed_size);
        drained
    }
}

impl<T> Drop for TrackedVec<T> {
    fn drop(&mut self) {
        let total_size = self.vec.len() * self.element_size;
        self.guard.dealloc(total_size);
    }
}

pub struct BatchedProcessor<T, F>
where
    F: FnMut(Vec<T>) -> Result<()>,
{
    buffer: Vec<T>,
    batch_size: usize,
    element_size: usize,
    guard: &'static MemoryGuard,
    callback: F,
}

impl<T, F> BatchedProcessor<T, F>
where
    F: FnMut(Vec<T>) -> Result<()>,
{
    pub fn new(batch_size: usize, element_size: usize, callback: F) -> Self {
        BatchedProcessor {
            buffer: Vec::with_capacity(batch_size),
            batch_size,
            element_size,
            guard: MemoryGuard::global(),
            callback,
        }
    }

    pub fn push(&mut self, item: T) -> Result<()> {
        if self.buffer.len() >= self.batch_size {
            self.flush()?;
        }

        if self.guard.usage_percent() > 85.0 && !self.buffer.is_empty() {
            self.flush()?;
        }

        self.guard.alloc(self.element_size)?;
        self.buffer.push(item);
        Ok(())
    }

    pub fn flush(&mut self) -> Result<()> {
        if self.buffer.is_empty() {
            return Ok(());
        }

        let total_size = self.buffer.len() * self.element_size;
        let batch = std::mem::replace(&mut self.buffer, Vec::with_capacity(self.batch_size));

        let result = (self.callback)(batch);

        self.guard.dealloc(total_size);

        result
    }

    pub fn buffered_count(&self) -> usize {
        self.buffer.len()
    }
}

impl<T, F> Drop for BatchedProcessor<T, F>
where
    F: FnMut(Vec<T>) -> Result<()>,
{
    fn drop(&mut self) {
        let _ = self.flush();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_memory_guard_alloc_dealloc() {
        let guard = MemoryGuard::new(1024 * 1024);
        assert_eq!(guard.current_usage(), 0);

        guard.alloc(1024).unwrap();
        assert_eq!(guard.current_usage(), 1024);

        guard.dealloc(1024);
        assert_eq!(guard.current_usage(), 0);
    }

    #[test]
    fn test_memory_guard_overflow() {
        let guard = MemoryGuard::new(100);
        assert!(guard.alloc(200).is_err());
    }
}
