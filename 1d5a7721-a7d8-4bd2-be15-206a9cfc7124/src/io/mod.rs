#[allow(deprecated)]
pub mod stream;

#[allow(deprecated)]
pub use stream::{
    async_read_file, async_read_file_chunks, async_read_file_stream, async_write_file,
    create_input_stream, create_output_stream, AsyncStreamReader, BatchReader, BinaryReader,
    InputStream, OutputStream, ProgressExt, ResultWriter, StreamProcessor,
};
