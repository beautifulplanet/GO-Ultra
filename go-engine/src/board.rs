// board.rs — Board struct, creation, stone placement/removal

use crate::utils::*;

/// The core Go board representation using bitboards.
/// Each player has a [u128; 3] = 384 bits, covering boards up to 19×19 (361 intersections).
#[derive(Clone)]
pub struct Board {
    pub size: u8,
    /// Bitboards: stones[0]=Black, stones[1]=White, stones[2]=Crimson(experimental)
    pub stones: [[u128; 3]; 3],
    /// Knight positions: None if not placed / captured
    pub knights: [Option<u16>; 3],
    /// Ko point: position that cannot be immediately recaptured
    pub ko: Option<u16>,
    /// Whether each player passed on their last turn
    pub consecutive_passes: [bool; 3],
    /// Current player index (0=Black, 1=White, 2=Crimson)
    pub turn: u8,
    /// Number of active players: 2 (core) or 3 (experimental)
    pub active_players: u8,
    /// Compensation points for White (6.5 for 2P, 0.0 for 3P)
    pub komi: f32,
    /// Whether self-capture (suicide) is allowed
    pub allow_suicide: bool,
    /// Captured stone counts per player (stones captured BY this player)
    pub captures: [u32; 3],
    /// Precomputed neighbor masks for every position
    pub neighbor_masks: Vec<[u128; 3]>,
    /// Bitmask of all valid positions on the board
    pub board_mask: [u128; 3],
    /// Move history for ko detection
    pub move_count: u32,
}

impl Board {
    /// Create a new empty board.
    /// `size` must be one of: 9, 13, 15, 17, 19
    /// `players` must be 2 or 3
    pub fn new(size: u8, players: u8) -> Self {
        assert!(VALID_SIZES.contains(&size), "Invalid board size: {}", size);
        assert!(players == 2 || players == 3, "Players must be 2 or 3");
        if players == 3 {
            assert!(size >= 13, "3-player requires board size >= 13");
        }

        let neighbor_masks = precompute_neighbor_masks(size);
        let board_mask = full_board_mask(size);
        let komi = if players == 2 { 6.5 } else { 0.0 };

        Board {
            size,
            stones: [[0u128; 3]; 3],
            knights: [None; 3],
            ko: None,
            consecutive_passes: [false; 3],
            turn: 0,
            active_players: players,
            komi,
            allow_suicide: false,
            captures: [0; 3],
            neighbor_masks,
            board_mask,
            move_count: 0,
        }
    }

    /// Get which player (0, 1, 2) occupies a position, or None if empty.
    pub fn get_stone(&self, position: u16) -> Option<u8> {
        for p in 0..self.active_players as usize {
            if bit_test(&self.stones[p], position) {
                return Some(p as u8);
            }
        }
        None
    }

    /// Place a stone for the given player at the given position.
    /// Does NOT check legality — use rules::is_legal() for that.
    pub fn set_stone(&mut self, player: u8, position: u16) {
        bit_set(&mut self.stones[player as usize], position);
    }

    /// Remove a stone at the given position for the given player.
    pub fn remove_stone(&mut self, player: u8, position: u16) {
        bit_clear(&mut self.stones[player as usize], position);
    }

    /// Check if a position is empty (no stone from any player).
    pub fn is_empty(&self, position: u16) -> bool {
        self.get_stone(position).is_none()
    }

    /// Get all occupied positions (union of all player bitboards).
    pub fn all_stones(&self) -> [u128; 3] {
        let mut result = self.stones[0];
        for p in 1..self.active_players as usize {
            result = bits_or(&result, &self.stones[p]);
        }
        result
    }

    /// Get all empty positions on the board.
    pub fn empty_positions(&self) -> [u128; 3] {
        let occupied = self.all_stones();
        bits_and(&bits_not(&occupied), &self.board_mask)
    }

    /// Total number of intersections
    pub fn total_positions(&self) -> u16 {
        self.size as u16 * self.size as u16
    }

    /// Advance turn to the next player
    pub fn next_turn(&mut self) {
        self.turn = (self.turn + 1) % self.active_players;
        self.move_count += 1;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_board_9x9() {
        let b = Board::new(9, 2);
        assert_eq!(b.size, 9);
        assert_eq!(b.active_players, 2);
        assert_eq!(b.turn, 0);
        assert_eq!(b.komi, 6.5);
        assert!(!b.allow_suicide);
        assert_eq!(b.total_positions(), 81);
        // All positions should be empty
        for p in 0..81u16 {
            assert!(b.is_empty(p));
        }
    }

    #[test]
    fn test_new_board_19x19() {
        let b = Board::new(19, 2);
        assert_eq!(b.size, 19);
        assert_eq!(b.total_positions(), 361);
        assert_eq!(bits_count(&b.board_mask), 361);
        // Neighbor masks precomputed
        assert_eq!(b.neighbor_masks.len(), 361);
    }

    #[test]
    fn test_new_board_3p() {
        let b = Board::new(13, 3);
        assert_eq!(b.active_players, 3);
        assert_eq!(b.komi, 0.0);
    }

    #[test]
    #[should_panic(expected = "Invalid board size")]
    fn test_invalid_size() {
        Board::new(10, 2);
    }

    #[test]
    #[should_panic(expected = "3-player requires")]
    fn test_3p_on_small_board() {
        Board::new(9, 3);
    }

    #[test]
    fn test_place_and_get_stone() {
        let mut b = Board::new(9, 2);
        let p = pos(4, 4, 9);
        b.set_stone(0, p);
        assert_eq!(b.get_stone(p), Some(0));
        assert!(!b.is_empty(p));
    }

    #[test]
    fn test_remove_stone() {
        let mut b = Board::new(9, 2);
        let p = pos(4, 4, 9);
        b.set_stone(0, p);
        b.remove_stone(0, p);
        assert!(b.is_empty(p));
        assert_eq!(b.get_stone(p), None);
    }

    #[test]
    fn test_all_stones() {
        let mut b = Board::new(9, 2);
        b.set_stone(0, pos(0, 0, 9));
        b.set_stone(1, pos(1, 1, 9));
        let all = b.all_stones();
        assert!(bit_test(&all, pos(0, 0, 9)));
        assert!(bit_test(&all, pos(1, 1, 9)));
        assert!(!bit_test(&all, pos(2, 2, 9)));
    }

    #[test]
    fn test_empty_positions() {
        let mut b = Board::new(9, 2);
        b.set_stone(0, pos(0, 0, 9));
        let empty = b.empty_positions();
        assert!(!bit_test(&empty, pos(0, 0, 9)));
        assert!(bit_test(&empty, pos(0, 1, 9)));
        assert_eq!(bits_count(&empty), 80);
    }

    #[test]
    fn test_next_turn() {
        let mut b = Board::new(9, 2);
        assert_eq!(b.turn, 0);
        b.next_turn();
        assert_eq!(b.turn, 1);
        b.next_turn();
        assert_eq!(b.turn, 0);
    }

    #[test]
    fn test_next_turn_3p() {
        let mut b = Board::new(13, 3);
        assert_eq!(b.turn, 0);
        b.next_turn();
        assert_eq!(b.turn, 1);
        b.next_turn();
        assert_eq!(b.turn, 2);
        b.next_turn();
        assert_eq!(b.turn, 0);
    }
}
