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
