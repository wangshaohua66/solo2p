use crate::error::{AtcError, AtcResult};
use crate::types::{ConflictAlert, FusedTrack, OutputFormat, TrackPoint, TrafficStats};
use crossbeam_channel::{Receiver, Sender};
use indicatif::{ProgressBar, ProgressStyle};
use serde::Serialize;
use std::fs::File;
use std::io::{self, BufRead, BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::thread;

pub enum InputStream {
    File(PathBuf),
    Stdin,
}

pub enum OutputStream {
    File(PathBuf),
    Stdout,
    Stderr,
}

pub struct BinaryReader {
    reader: Box<dyn BufRead + Send>,
    #[allow(dead_code)]
    total_bytes: u64,
    bytes_read: u64,
    progress: Option<ProgressBar>,
}

impl BinaryReader {
    pub fn new(input: InputStream, show_progress: bool) -> AtcResult<Self> {
        let (reader, total_bytes) = match input {
            InputStream::File(path) => {
                if !path.exists() {
                    return Err(AtcError::FileNotFound(path.display().to_string()));
                }
                let metadata = std::fs::metadata(&path)?;
                let file = File::open(&path)?;
                let reader = BufReader::with_capacity(1024 * 1024, file);
                (Box::new(reader) as Box<dyn BufRead + Send>, metadata.len())
            }
            InputStream::Stdin => {
                let stdin = io::stdin();
                let reader = BufReader::with_capacity(1024 * 1024, stdin);
                (Box::new(reader) as Box<dyn BufRead + Send>, 0)
            }
        };

        let progress = if show_progress && total_bytes > 0 {
            let pb = ProgressBar::new(total_bytes);
            let style = ProgressStyle::default_bar()
                .template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {bytes}/{total_bytes} ({eta})")
                .map_err(|e| AtcError::Other(format!("进度条模板错误: {}", e)))?
                .progress_chars("=>-");
            pb.set_style(style);
            Some(pb)
        } else {
            None
        };

        Ok(Self {
            reader,
            total_bytes,
            bytes_read: 0,
            progress,
        })
    }

    pub fn read_bytes(&mut self, n: usize) -> AtcResult<Vec<u8>> {
        let mut buffer = vec![0u8; n];
        let mut bytes_read = 0;

        while bytes_read < n {
            match self.reader.read(&mut buffer[bytes_read..]) {
                Ok(0) => break,
                Ok(k) => bytes_read += k,
                Err(e) if e.kind() == io::ErrorKind::Interrupted => continue,
                Err(e) => return Err(AtcError::IoError(e)),
            }
        }

        if bytes_read == 0 {
            return Ok(Vec::new());
        }

        buffer.truncate(bytes_read);

        self.bytes_read += bytes_read as u64;
        if let Some(pb) = &self.progress {
            pb.inc(bytes_read as u64);
        }

        Ok(buffer)
    }

    pub fn read_exact(&mut self, n: usize) -> AtcResult<Vec<u8>> {
        let offset = self.bytes_read as usize;
        let data = self.read_bytes(n)?;
        if data.len() != n {
            return Err(AtcError::ParseError {
                message: format!("需要 {} 字节, 实际读取 {} 字节", n, data.len()),
                offset,
            });
        }
        Ok(data)
    }

    pub fn read_to_end(&mut self) -> AtcResult<Vec<u8>> {
        let mut buf = Vec::new();
        self.reader
            .read_to_end(&mut buf)
            .map_err(AtcError::IoError)?;

        if let Some(pb) = &self.progress {
            pb.inc(buf.len() as u64);
            pb.finish_with_message("读取完成");
        }

        Ok(buf)
    }

    pub fn finish(&self) {
        if let Some(pb) = &self.progress {
            pb.finish_with_message("处理完成");
        }
    }
}

pub struct StreamProcessor<T: Send + 'static> {
    sender: Sender<T>,
    receiver: Receiver<T>,
    #[allow(dead_code)]
    buffer_size: usize,
}

impl<T: Send + 'static> StreamProcessor<T> {
    pub fn new(buffer_size: usize) -> Self {
        let (sender, receiver) = crossbeam_channel::bounded::<T>(buffer_size);
        Self {
            sender,
            receiver,
            buffer_size,
        }
    }

    pub fn sender(&self) -> Sender<T> {
        self.sender.clone()
    }

    pub fn receiver(&self) -> Receiver<T> {
        self.receiver.clone()
    }

    pub fn process_stream<F>(self, processor: F) -> AtcResult<()>
    where
        F: Fn(T) -> AtcResult<()> + Send + 'static,
    {
        let receiver = self.receiver;

        thread::spawn(move || -> AtcResult<()> {
            for item in receiver.iter() {
                processor(item)?;
            }
            Ok(())
        })
        .join()
        .map_err(|e| AtcError::Other(format!("处理线程异常: {:?}", e)))??;

        Ok(())
    }

    pub fn process_parallel<F>(self, processor: F, num_threads: usize) -> AtcResult<()>
    where
        F: Fn(T) -> AtcResult<()> + Send + Sync + 'static,
    {
        let processor = Arc::new(processor);
        let mut handles = Vec::new();

        for _ in 0..num_threads {
            let receiver = self.receiver.clone();
            let processor = processor.clone();

            handles.push(thread::spawn(move || -> AtcResult<()> {
                for item in receiver.iter() {
                    processor(item)?;
                }
                Ok(())
            }));
        }

        for handle in handles {
            handle
                .join()
                .map_err(|e| AtcError::Other(format!("处理线程异常: {:?}", e)))??;
        }

        Ok(())
    }
}

pub struct ResultWriter {
    writer: Box<dyn Write + Send>,
    format: OutputFormat,
    pretty: bool,
}

impl ResultWriter {
    pub fn new(output: OutputStream, format: OutputFormat, pretty: bool) -> AtcResult<Self> {
        let writer: Box<dyn Write + Send> = match output {
            OutputStream::File(path) => {
                if let Some(parent) = path.parent() {
                    std::fs::create_dir_all(parent)?;
                }
                let file = File::create(&path)?;
                Box::new(BufWriter::with_capacity(1024 * 1024, file))
            }
            OutputStream::Stdout => Box::new(BufWriter::new(io::stdout())),
            OutputStream::Stderr => Box::new(BufWriter::new(io::stderr())),
        };

        Ok(Self {
            writer,
            format,
            pretty,
        })
    }

    pub fn write_track_point(&mut self, point: &TrackPoint) -> AtcResult<()> {
        self.write_serializable(point)
    }

    pub fn write_fused_track(&mut self, track: &FusedTrack) -> AtcResult<()> {
        self.write_serializable(track)
    }

    pub fn write_alert(&mut self, alert: &ConflictAlert) -> AtcResult<()> {
        self.write_serializable(alert)
    }

    pub fn write_stats(&mut self, stats: &TrafficStats) -> AtcResult<()> {
        self.write_serializable(stats)
    }

    pub fn write_raw(&mut self, data: &[u8]) -> AtcResult<()> {
        self.writer.write_all(data)?;
        Ok(())
    }

    pub fn write_line(&mut self, line: &str) -> AtcResult<()> {
        self.writer.write_all(line.as_bytes())?;
        self.writer.write_all(b"\n")?;
        Ok(())
    }

    fn write_serializable<T: Serialize + std::fmt::Display>(&mut self, item: &T) -> AtcResult<()> {
        match self.format {
            OutputFormat::Json => {
                let json = if self.pretty {
                    serde_json::to_string_pretty(item)?
                } else {
                    serde_json::to_string(item)?
                };
                self.writer.write_all(json.as_bytes())?;
                self.writer.write_all(b"\n")?;
            }
            OutputFormat::Csv => {
                let json = serde_json::to_value(item)?;
                let csv_line = self.json_to_csv_line(&json);
                self.writer.write_all(csv_line.as_bytes())?;
                self.writer.write_all(b"\n")?;
            }
            OutputFormat::Text => {
                self.writer.write_all(item.to_string().as_bytes())?;
                self.writer.write_all(b"\n")?;
            }
        }
        Ok(())
    }

    fn json_to_csv_line(&self, json: &serde_json::Value) -> String {
        let mut values = Vec::new();
        self.flatten_json(json, "", &mut values);

        values
            .iter()
            .map(|v| {
                if v.contains(|c| c == ',' || c == '"' || c == '\n') {
                    format!("\"{}\"", v.replace('"', "\"\""))
                } else {
                    v.clone()
                }
            })
            .collect::<Vec<_>>()
            .join(",")
    }

    fn flatten_json(&self, json: &serde_json::Value, prefix: &str, values: &mut Vec<String>) {
        match json {
            serde_json::Value::Object(obj) => {
                for (key, value) in obj {
                    let new_key = if prefix.is_empty() {
                        key.clone()
                    } else {
                        format!("{}.{}", prefix, key)
                    };
                    self.flatten_json(value, &new_key, values);
                }
            }
            serde_json::Value::Array(arr) => {
                for (i, value) in arr.iter().enumerate() {
                    let new_key = format!("{}[{}]", prefix, i);
                    self.flatten_json(value, &new_key, values);
                }
            }
            serde_json::Value::String(s) => values.push(s.clone()),
            serde_json::Value::Number(n) => values.push(n.to_string()),
            serde_json::Value::Bool(b) => values.push(if *b { "true".to_string() } else { "false".to_string() }),
            serde_json::Value::Null => values.push("".to_string()),
        }
    }

    pub fn flush(&mut self) -> AtcResult<()> {
        self.writer.flush().map_err(AtcError::IoError)
    }
}

pub fn create_input_stream(path: Option<&Path>) -> InputStream {
    match path {
        Some(p) => InputStream::File(p.to_path_buf()),
        None => InputStream::Stdin,
    }
}

pub fn create_output_stream(path: Option<&Path>) -> OutputStream {
    match path {
        Some(p) => OutputStream::File(p.to_path_buf()),
        None => OutputStream::Stdout,
    }
}

pub struct BatchReader<'a> {
    reader: &'a mut BinaryReader,
    batch_size: usize,
}

impl<'a> BatchReader<'a> {
    pub fn new(reader: &'a mut BinaryReader, batch_size: usize) -> Self {
        Self { reader, batch_size }
    }

    pub fn next_batch(&mut self) -> AtcResult<Vec<u8>> {
        let data = self.reader.read_bytes(self.batch_size)?;
        Ok(data.to_vec())
    }

    pub fn read_all_batches(&mut self) -> AtcResult<Vec<Vec<u8>>> {
        let mut batches = Vec::new();
        loop {
            let batch = self.next_batch()?;
            if batch.is_empty() {
                break;
            }
            batches.push(batch);
        }
        Ok(batches)
    }
}

#[deprecated(since = "1.1.0", note = "使用 async_read_file_stream 进行流式读取，避免大文件内存溢出")]
pub async fn async_read_file(path: &Path) -> AtcResult<Vec<u8>> {
    use tokio::io::AsyncReadExt;

    let mut file = tokio::fs::File::open(path)
        .await
        .map_err(|e| AtcError::IoError(e))?;

    let mut contents = Vec::new();
    file.read_to_end(&mut contents)
        .await
        .map_err(|e| AtcError::IoError(e))?;

    Ok(contents)
}

const DEFAULT_CHUNK_SIZE: usize = 64 * 1024;

pub struct AsyncStreamReader {
    reader: tokio::io::BufReader<tokio::fs::File>,
    chunk_size: usize,
    bytes_read: u64,
    total_bytes: u64,
}

impl AsyncStreamReader {
    pub fn new(file: tokio::fs::File, chunk_size: usize, total_bytes: u64) -> Self {
        let reader = tokio::io::BufReader::with_capacity(
            chunk_size.max(4096),
            file,
        );
        Self {
            reader,
            chunk_size,
            bytes_read: 0,
            total_bytes,
        }
    }

    pub fn bytes_read(&self) -> u64 {
        self.bytes_read
    }

    pub fn total_bytes(&self) -> u64 {
        self.total_bytes
    }

    pub fn is_finished(&self) -> bool {
        self.total_bytes > 0 && self.bytes_read >= self.total_bytes
    }

    pub async fn read_chunk(&mut self) -> AtcResult<Option<Vec<u8>>> {
        use tokio::io::AsyncReadExt;

        let mut buffer = vec![0u8; self.chunk_size];
        let n = self.reader.read(&mut buffer).await.map_err(AtcError::IoError)?;

        if n == 0 {
            return Ok(None);
        }

        buffer.truncate(n);
        self.bytes_read += n as u64;
        Ok(Some(buffer))
    }

    pub async fn read_all_chunks(&mut self) -> AtcResult<Vec<Vec<u8>>> {
        let mut chunks = Vec::new();
        while let Some(chunk) = self.read_chunk().await? {
            chunks.push(chunk);
        }
        Ok(chunks)
    }
}

pub async fn async_read_file_stream(
    path: &Path,
    chunk_size: Option<usize>,
) -> AtcResult<AsyncStreamReader> {
    let chunk_size = chunk_size.unwrap_or(DEFAULT_CHUNK_SIZE);
    let file = tokio::fs::File::open(path)
        .await
        .map_err(AtcError::IoError)?;
    let total_bytes = tokio::fs::metadata(path)
        .await
        .map(|m| m.len())
        .unwrap_or(0);
    Ok(AsyncStreamReader::new(file, chunk_size, total_bytes))
}

pub async fn async_read_file_chunks<F>(
    path: &Path,
    chunk_size: Option<usize>,
    mut handler: F,
) -> AtcResult<u64>
where
    F: FnMut(&[u8]) -> AtcResult<bool>,
{
    let mut reader = async_read_file_stream(path, chunk_size).await?;
    let mut total_read = 0u64;

    while let Some(chunk) = reader.read_chunk().await? {
        total_read += chunk.len() as u64;
        let should_continue = handler(&chunk)?;
        if !should_continue {
            break;
        }
    }

    Ok(total_read)
}

pub async fn async_write_file(path: &Path, data: &[u8]) -> AtcResult<()> {
    use tokio::io::AsyncWriteExt;

    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| AtcError::IoError(e))?;
    }

    let mut file = tokio::fs::File::create(path)
        .await
        .map_err(|e| AtcError::IoError(e))?;

    file.write_all(data)
        .await
        .map_err(|e| AtcError::IoError(e))?;

    file.flush().await.map_err(|e| AtcError::IoError(e))?;

    Ok(())
}

pub trait ProgressExt {
    fn set_atc_style(&self, message: &str);
    fn increment_with_rate(&self, delta: u64, rate: f64);
}

impl ProgressExt for ProgressBar {
    fn set_atc_style(&self, message: &str) {
        self.set_style(
            ProgressStyle::default_bar()
                .template(&format!(
                    "{{spinner:.green}} [{{elapsed_precise}}] [{{bar:40.cyan/blue}}] {{pos}}/{{len}} ({{eta}}) - {}",
                    message
                ))
                .unwrap()
                .progress_chars("=>-"),
        );
    }

    fn increment_with_rate(&self, delta: u64, rate: f64) {
        self.inc(delta);
        self.set_message(format!("{:.0} 条/秒", rate));
    }
}

#[cfg(test)]
mod stream_tests {
    use super::*;
    use std::io::Write as StdWrite;

    #[tokio::test]
    async fn test_async_stream_reader_small_file() {
        let data: Vec<u8> = (0..1024).map(|i| (i % 256) as u8).collect();
        let mut tmp = tempfile::NamedTempFile::new().unwrap();
        tmp.write_all(&data).unwrap();
        tmp.flush().unwrap();

        let path = tmp.path().to_path_buf();
        let mut reader = async_read_file_stream(&path, Some(256)).await.unwrap();

        let mut all_data = Vec::new();
        let mut chunk_count = 0;
        while let Some(chunk) = reader.read_chunk().await.unwrap() {
            all_data.extend_from_slice(&chunk);
            chunk_count += 1;
        }

        assert_eq!(all_data, data);
        assert!(chunk_count >= 4);
        assert_eq!(reader.bytes_read(), 1024);
        assert!(reader.is_finished());
    }

    #[tokio::test]
    async fn test_async_stream_reader_large_file() {
        let chunk_data: Vec<u8> = (0..4096).map(|i| (i % 256) as u8).collect();
        let total_size = chunk_data.len() * 256;
        let mut tmp = tempfile::NamedTempFile::new().unwrap();
        for _ in 0..256 {
            tmp.write_all(&chunk_data).unwrap();
        }
        tmp.flush().unwrap();

        let path = tmp.path().to_path_buf();
        let chunk_size = 64 * 1024;
        let mut reader = async_read_file_stream(&path, Some(chunk_size)).await.unwrap();

        assert_eq!(reader.total_bytes(), total_size as u64);

        let mut total_read = 0u64;
        let mut max_chunk_size = 0usize;
        while let Some(chunk) = reader.read_chunk().await.unwrap() {
            total_read += chunk.len() as u64;
            max_chunk_size = max_chunk_size.max(chunk.len());
        }

        assert_eq!(total_read, total_size as u64);
        assert!(max_chunk_size <= chunk_size);
    }

    #[tokio::test]
    async fn test_async_read_file_chunks_callback() {
        let data: Vec<u8> = (0..2048).map(|i| (i % 256) as u8).collect();
        let mut tmp = tempfile::NamedTempFile::new().unwrap();
        tmp.write_all(&data).unwrap();
        tmp.flush().unwrap();

        let path = tmp.path().to_path_buf();
        let mut collected = Vec::new();
        let total_read = async_read_file_chunks(&path, Some(512), |chunk| {
            collected.extend_from_slice(chunk);
            Ok(true)
        })
        .await
        .unwrap();

        assert_eq!(collected, data);
        assert_eq!(total_read, 2048);
    }

    #[tokio::test]
    async fn test_async_read_file_chunks_early_stop() {
        let data = vec![0xABu8; 4096];
        let mut tmp = tempfile::NamedTempFile::new().unwrap();
        tmp.write_all(&data).unwrap();
        tmp.flush().unwrap();

        let path = tmp.path().to_path_buf();
        let mut chunk_count = 0;
        let total_read = async_read_file_chunks(&path, Some(1024), |_chunk| {
            chunk_count += 1;
            Ok(chunk_count < 2)
        })
        .await
        .unwrap();

        assert_eq!(chunk_count, 2);
        assert!(total_read <= 2048);
        assert!(total_read > 0);
    }

    #[tokio::test]
    async fn test_stream_reader_does_not_load_all_into_memory() {
        let chunk_data: Vec<u8> = (0..1024).map(|i| (i % 256) as u8).collect();
        let mut tmp = tempfile::NamedTempFile::new().unwrap();
        for _ in 0..1024 {
            tmp.write_all(&chunk_data).unwrap();
        }
        tmp.flush().unwrap();

        let path = tmp.path().to_path_buf();
        let small_chunk = 4096;
        let mut reader = async_read_file_stream(&path, Some(small_chunk)).await.unwrap();

        let mut total = 0u64;
        while let Some(chunk) = reader.read_chunk().await.unwrap() {
            assert!(chunk.len() <= small_chunk);
            total += chunk.len() as u64;
        }

        assert_eq!(total, 1024 * 1024);
    }
}
