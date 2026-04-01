// utils.rs — u128 split helpers, neighbor mask generation, position conversion

/// Valid board sizes
pub const VALID_SIZES: [u8; 5] = [9, 13, 15, 17, 19];

/// Convert (row, col) to flat position index
#[inline]
pub fn pos(row: u8, col: u8, size: u8) -> u16 {
    row as u16 * size as u16 + col as u16
}

/// Convert flat position index to (row, col)
#[inline]
pub fn row_col(position: u16, size: u8) -> (u8, u8) {
    ((position / size as u16) as u8, (position % size as u16) as u8)
}

/// Set a bit in a [u128; 3] array at the given position
#[inline]
pub fn bit_set(bits: &mut [u128; 3], position: u16) {
    let idx = position as usize / 128;
    let bit = position as usize % 128;
    bits[idx] |= 1u128 << bit;
}

/// Clear a bit in a [u128; 3] array at the given position
#[inline]
pub fn bit_clear(bits: &mut [u128; 3], position: u16) {
    let idx = position as usize / 128;
    let bit = position as usize % 128;
    bits[idx] &= !(1u128 << bit);
}

/// Test if a bit is set in a [u128; 3] array
#[inline]
pub fn bit_test(bits: &[u128; 3], position: u16) -> bool {
    let idx = position as usize / 128;
    let bit = position as usize % 128;
    (bits[idx] >> bit) & 1 == 1
}

/// Check if all bits are zero
#[inline]
pub fn bits_empty(bits: &[u128; 3]) -> bool {
    bits[0] == 0 && bits[1] == 0 && bits[2] == 0
}

/// Bitwise OR two [u128; 3] arrays
#[inline]
pub fn bits_or(a: &[u128; 3], b: &[u128; 3]) -> [u128; 3] {
    [a[0] | b[0], a[1] | b[1], a[2] | b[2]]
}

/// Bitwise AND two [u128; 3] arrays
#[inline]
pub fn bits_and(a: &[u128; 3], b: &[u128; 3]) -> [u128; 3] {
    [a[0] & b[0], a[1] & b[1], a[2] & b[2]]
}

/// Bitwise NOT of [u128; 3] (mask to board size needed after)
#[inline]
pub fn bits_not(a: &[u128; 3]) -> [u128; 3] {
    [!a[0], !a[1], !a[2]]
}

/// Count set bits in [u128; 3]
#[inline]
pub fn bits_count(bits: &[u128; 3]) -> u32 {
    bits[0].count_ones() + bits[1].count_ones() + bits[2].count_ones()
}

/// Generate neighbor positions for a given position on the board
/// Returns up to 4 neighbors (up, down, left, right)
pub fn neighbors(position: u16, size: u8) -> Vec<u16> {
    let (r, c) = row_col(position, size);
    let mut result = Vec::with_capacity(4);
    if r > 0 { result.push(pos(r - 1, c, size)); }
    if r < size - 1 { result.push(pos(r + 1, c, size)); }
    if c > 0 { result.push(pos(r, c - 1, size)); }
    if c < size - 1 { result.push(pos(r, c + 1, size)); }
    result
}

/// Stack-allocated neighbor array — zero allocation.
/// Returns (array, count) where count is 2-4.
#[inline]
pub fn neighbors_array(position: u16, size: u8) -> ([u16; 4], u8) {
    let (r, c) = row_col(position, size);
    let mut arr = [0u16; 4];
    let mut count = 0u8;
    if r > 0 { arr[count as usize] = pos(r - 1, c, size); count += 1; }
    if r < size - 1 { arr[count as usize] = pos(r + 1, c, size); count += 1; }
    if c > 0 { arr[count as usize] = pos(r, c - 1, size); count += 1; }
    if c < size - 1 { arr[count as usize] = pos(r, c + 1, size); count += 1; }
    (arr, count)
}

/// Iterate over set bits in a [u128; 3] bitboard. Returns positions.
#[inline]
pub fn bits_iter(bits: &[u128; 3]) -> BitsIter {
    BitsIter { chunks: *bits, chunk_idx: 0 }
}

pub struct BitsIter {
    chunks: [u128; 3],
    chunk_idx: usize,
}

impl Iterator for BitsIter {
    type Item = u16;

    #[inline]
    fn next(&mut self) -> Option<u16> {
        while self.chunk_idx < 3 {
            if self.chunks[self.chunk_idx] != 0 {
                let bit = self.chunks[self.chunk_idx].trailing_zeros() as u16;
                self.chunks[self.chunk_idx] &= self.chunks[self.chunk_idx] - 1; // clear lowest set bit
                return Some(self.chunk_idx as u16 * 128 + bit);
            }
            self.chunk_idx += 1;
        }
        None
    }
}

/// Get the nth set bit position from a [u128; 3] bitboard.
/// Used for uniform random selection from empty positions without building a Vec.
#[inline]
pub fn nth_set_bit(bits: &[u128; 3], mut n: u32) -> Option<u16> {
    for chunk_idx in 0..3usize {
        let mut chunk = bits[chunk_idx];
        let count = chunk.count_ones();
        if n < count {
            // The nth set bit is in this chunk
            for _ in 0..n {
                chunk &= chunk - 1; // clear lowest set bit
            }
            let bit = chunk.trailing_zeros() as u16;
            return Some(chunk_idx as u16 * 128 + bit);
        }
        n -= count;
    }
    None
}

/// Precompute neighbor masks for every position on the board.
/// neighbor_masks[i] has bits set for all orthogonal neighbors of position i.
pub fn precompute_neighbor_masks(size: u8) -> Vec<[u128; 3]> {
    let total = size as u16 * size as u16;
    let mut masks = vec![[0u128; 3]; total as usize];
    for p in 0..total {
        for n in neighbors(p, size) {
            bit_set(&mut masks[p as usize], n);
        }
    }
    masks
}

/// Create a bitmask with all valid board positions set
pub fn full_board_mask(size: u8) -> [u128; 3] {
    let total = size as u16 * size as u16;
    let mut mask = [0u128; 3];
    for p in 0..total {
        bit_set(&mut mask, p);
    }
    mask
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pos_roundtrip() {
        for size in VALID_SIZES {
            for r in 0..size {
                for c in 0..size {
                    let p = pos(r, c, size);
                    let (r2, c2) = row_col(p, size);
                    assert_eq!((r, c), (r2, c2));
                }
            }
        }
    }

    #[test]
    fn test_bit_set_clear_test() {
        let mut bits = [0u128; 3];
        bit_set(&mut bits, 0);
        assert!(bit_test(&bits, 0));
        assert!(!bit_test(&bits, 1));
        bit_clear(&mut bits, 0);
        assert!(!bit_test(&bits, 0));

        // Test position in second u128 chunk
        bit_set(&mut bits, 200);
        assert!(bit_test(&bits, 200));
        assert!(!bit_test(&bits, 199));
        bit_clear(&mut bits, 200);
        assert!(!bit_test(&bits, 200));

        // Test position in third u128 chunk
        bit_set(&mut bits, 300);
        assert!(bit_test(&bits, 300));
        bit_clear(&mut bits, 300);
        assert!(!bit_test(&bits, 300));
    }

    #[test]
    fn test_neighbors_center() {
        let n = neighbors(pos(4, 4, 9), 9);
        assert_eq!(n.len(), 4);
    }

    #[test]
    fn test_neighbors_corner() {
        let n = neighbors(pos(0, 0, 9), 9);
        assert_eq!(n.len(), 2);
    }

    #[test]
    fn test_neighbors_edge() {
        let n = neighbors(pos(0, 4, 9), 9);
        assert_eq!(n.len(), 3);
    }

    #[test]
    fn test_full_board_mask_9x9() {
        let mask = full_board_mask(9);
        assert_eq!(bits_count(&mask), 81);
    }

    #[test]
    fn test_full_board_mask_19x19() {
        let mask = full_board_mask(19);
        assert_eq!(bits_count(&mask), 361);
    }

    #[test]
    fn test_bits_or_and() {
        let mut a = [0u128; 3];
        let mut b = [0u128; 3];
        bit_set(&mut a, 10);
        bit_set(&mut b, 20);
        let combined = bits_or(&a, &b);
        assert!(bit_test(&combined, 10));
        assert!(bit_test(&combined, 20));
        let intersection = bits_and(&a, &b);
        assert!(bits_empty(&intersection));
    }
}
