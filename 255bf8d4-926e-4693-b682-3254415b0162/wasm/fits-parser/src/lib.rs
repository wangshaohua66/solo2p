use wasm_bindgen::prelude::*;
use web_sys::DataView;

#[wasm_bindgen]
pub fn parse_fits_pixels(
    data_view: &DataView,
    offset: usize,
    width: usize,
    height: usize,
    bitpix: i32,
    bzero: f64,
    bscale: f64,
) -> Result<Vec<f32>, JsValue> {
    let total_pixels = width * height;
    let mut result = Vec::with_capacity(total_pixels);

    match bitpix {
        8 => {
            for i in 0..total_pixels {
                let byte_offset = (offset + i) as u32;
                let val = data_view.get_uint8(byte_offset) as f64;
                result.push((val * bscale + bzero) as f32);
            }
        }
        16 => {
            for i in 0..total_pixels {
                let byte_offset = (offset + i * 2) as u32;
                let val = data_view.get_int16(byte_offset).map_err(|e| {
                    JsValue::from_str(&format!("Failed to read int16 at {}: {:?}", byte_offset, e))
                })? as f64;
                result.push((val * bscale + bzero) as f32);
            }
        }
        32 => {
            for i in 0..total_pixels {
                let byte_offset = (offset + i * 4) as u32;
                let val = data_view.get_int32(byte_offset).map_err(|e| {
                    JsValue::from_str(&format!("Failed to read int32 at {}: {:?}", byte_offset, e))
                })? as f64;
                result.push((val * bscale + bzero) as f32);
            }
        }
        -32 => {
            for i in 0..total_pixels {
                let byte_offset = (offset + i * 4) as u32;
                let val = data_view.get_float32(byte_offset).map_err(|e| {
                    JsValue::from_str(&format!("Failed to read float32 at {}: {:?}", byte_offset, e))
                })? as f64;
                result.push((val * bscale + bzero) as f32);
            }
        }
        -64 => {
            for i in 0..total_pixels {
                let byte_offset = (offset + i * 8) as u32;
                let val = data_view.get_float64(byte_offset).map_err(|e| {
                    JsValue::from_str(&format!("Failed to read float64 at {}: {:?}", byte_offset, e))
                })?;
                result.push((val * bscale + bzero) as f32);
            }
        }
        _ => {
            return Err(JsValue::from_str(&format!(
                "Unsupported BITPIX value: {}",
                bitpix
            )));
        }
    }

    Ok(result)
}

#[wasm_bindgen]
pub fn parse_fits_pixels_tile(
    data_view: &DataView,
    offset: usize,
    image_width: usize,
    bitpix: i32,
    bzero: f64,
    bscale: f64,
    tile_x: usize,
    tile_y: usize,
    tile_width: usize,
    tile_height: usize,
) -> Result<Vec<f32>, JsValue> {
    let bytes_per_pixel = match bitpix {
        8 => 1,
        16 => 2,
        32 | -32 => 4,
        -64 => 8,
        _ => {
            return Err(JsValue::from_str(&format!(
                "Unsupported BITPIX value: {}",
                bitpix
            )));
        }
    };

    let total_pixels = tile_width * tile_height;
    let mut result = Vec::with_capacity(total_pixels);

    for y in 0..tile_height {
        let src_y = tile_y + y;
        for x in 0..tile_width {
            let src_x = tile_x + x;
            let pixel_index = src_y * image_width + src_x;
            let byte_offset = (offset + pixel_index * bytes_per_pixel) as u32;

            let val: f64 = match bitpix {
                8 => data_view.get_uint8(byte_offset) as f64,
                16 => data_view.get_int16(byte_offset).map_err(|e| {
                    JsValue::from_str(&format!("Failed to read int16 at {}: {:?}", byte_offset, e))
                })? as f64,
                32 => data_view.get_int32(byte_offset).map_err(|e| {
                    JsValue::from_str(&format!("Failed to read int32 at {}: {:?}", byte_offset, e))
                })? as f64,
                -32 => data_view.get_float32(byte_offset).map_err(|e| {
                    JsValue::from_str(&format!("Failed to read float32 at {}: {:?}", byte_offset, e))
                })? as f64,
                -64 => data_view.get_float64(byte_offset).map_err(|e| {
                    JsValue::from_str(&format!("Failed to read float64 at {}: {:?}", byte_offset, e))
                })?,
                _ => 0.0,
            };

            result.push((val * bscale + bzero) as f32);
        }
    }

    Ok(result)
}

#[wasm_bindgen]
pub fn bytes_per_pixel(bitpix: i32) -> usize {
    match bitpix {
        8 => 1,
        16 => 2,
        32 | -32 => 4,
        -64 => 8,
        _ => 0,
    }
}

#[wasm_bindgen]
pub fn tile_grid_size(
    width: usize,
    height: usize,
    tile_size: usize,
) -> (usize, usize, usize) {
    let tiles_x = (width + tile_size - 1) / tile_size;
    let tiles_y = (height + tile_size - 1) / tile_size;
    let total = tiles_x * tiles_y;
    (tiles_x, tiles_y, total)
}
