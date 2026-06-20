use std::vec::Vec;

#[no_mangle]
pub extern "C" fn alloc_u8(size: usize) -> *mut u8 {
    let mut buf = Vec::with_capacity(size);
    let ptr = buf.as_mut_ptr();
    std::mem::forget(buf);
    ptr
}

#[no_mangle]
pub extern "C" fn dealloc_u8(ptr: *mut u8, size: usize) {
    if ptr.is_null() || size == 0 {
        return;
    }
    unsafe {
        let _ = Vec::from_raw_parts(ptr, 0, size);
    }
}

#[no_mangle]
pub extern "C" fn alloc_f32(count: usize) -> *mut f32 {
    let mut buf = Vec::with_capacity(count);
    let ptr = buf.as_mut_ptr();
    std::mem::forget(buf);
    ptr
}

#[no_mangle]
pub extern "C" fn dealloc_f32(ptr: *mut f32, count: usize) {
    if ptr.is_null() || count == 0 {
        return;
    }
    unsafe {
        let _ = Vec::from_raw_parts(ptr, 0, count);
    }
}

unsafe fn read_be_i16(data: *const u8) -> i16 {
    let bits = u16::from_be(*(data as *const u16));
    bits as i16
}

unsafe fn read_be_i32(data: *const u8) -> i32 {
    let bits = u32::from_be(*(data as *const u32));
    bits as i32
}

unsafe fn read_be_f32(data: *const u8) -> f32 {
    let bits = u32::from_be(*(data as *const u32));
    f32::from_bits(bits)
}

unsafe fn read_be_f64(data: *const u8) -> f64 {
    let bits = u64::from_be(*(data as *const u64));
    f64::from_bits(bits)
}

#[no_mangle]
pub unsafe extern "C" fn parse_pixels_i16(
    input: *const u8,
    count: usize,
    bzero: f64,
    bscale: f64,
    output: *mut f32,
) -> i32 {
    for i in 0..count {
        let src = input.add(i * 2);
        let val = read_be_i16(src) as f64;
        *output.add(i) = (val * bscale + bzero) as f32;
    }
    0
}

#[no_mangle]
pub unsafe extern "C" fn parse_pixels_i32(
    input: *const u8,
    count: usize,
    bzero: f64,
    bscale: f64,
    output: *mut f32,
) -> i32 {
    for i in 0..count {
        let src = input.add(i * 4);
        let val = read_be_i32(src) as f64;
        *output.add(i) = (val * bscale + bzero) as f32;
    }
    0
}

#[no_mangle]
pub unsafe extern "C" fn parse_pixels_f32(
    input: *const u8,
    count: usize,
    bzero: f64,
    bscale: f64,
    output: *mut f32,
) -> i32 {
    for i in 0..count {
        let src = input.add(i * 4);
        let val = read_be_f32(src) as f64;
        *output.add(i) = (val * bscale + bzero) as f32;
    }
    0
}

#[no_mangle]
pub unsafe extern "C" fn parse_pixels_f64(
    input: *const u8,
    count: usize,
    bzero: f64,
    bscale: f64,
    output: *mut f32,
) -> i32 {
    for i in 0..count {
        let src = input.add(i * 8);
        let val = read_be_f64(src);
        *output.add(i) = (val * bscale + bzero) as f32;
    }
    0
}

#[no_mangle]
pub unsafe extern "C" fn parse_pixels_u8(
    input: *const u8,
    count: usize,
    bzero: f64,
    bscale: f64,
    output: *mut f32,
) -> i32 {
    for i in 0..count {
        let val = *input.add(i) as f64;
        *output.add(i) = (val * bscale + bzero) as f32;
    }
    0
}

#[no_mangle]
pub extern "C" fn bytes_per_pixel(bitpix: i32) -> i32 {
    match bitpix {
        8 => 1,
        16 => 2,
        32 | -32 => 4,
        -64 => 8,
        _ => 0,
    }
}

#[no_mangle]
pub extern "C" fn version() -> i32 {
    1
}
