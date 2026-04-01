use wasm_bindgen::prelude::*;

mod board;
mod utils;
mod rules;
mod mcts;

pub use board::Board;
pub use rules::*;
pub use mcts::*;

// ── WASM-exported API ─────────────────────────────────────────────

/// GoGame wraps the engine for JavaScript consumption.
#[wasm_bindgen]
pub struct GoGame {
    board: Board,
}

#[wasm_bindgen]
impl GoGame {
    /// Create a new game. `size`: 9|13|15|17|19, `players`: 2|3
    #[wasm_bindgen(constructor)]
    pub fn new(size: u8, players: u8) -> GoGame {
        GoGame { board: Board::new(size, players) }
    }

    /// Board size
    pub fn size(&self) -> u8 {
        self.board.size
    }

    /// Current player (0=Black, 1=White, 2=Crimson)
    pub fn turn(&self) -> u8 {
        self.board.turn
    }

    /// Number of active players
    pub fn players(&self) -> u8 {
        self.board.active_players
    }

    /// Who has a stone at flat position? 255 = empty
    pub fn stone_at(&self, pos: u16) -> u8 {
        self.board.get_stone(pos).unwrap_or(255)
    }

    /// Is placing at `pos` legal for the current player?
    pub fn is_legal(&self, pos: u16) -> bool {
        rules::is_legal(&self.board, pos)
    }

    /// Place a stone. Returns false if illegal.
    pub fn play(&mut self, pos: u16) -> bool {
        if !rules::is_legal(&self.board, pos) {
            return false;
        }
        rules::place_stone(&mut self.board, pos);
        true
    }

    /// Pass the current player's turn.
    pub fn pass_turn(&mut self) {
        rules::pass_turn(&mut self.board);
    }

    /// Is the game over (all players passed consecutively)?
    pub fn is_game_over(&self) -> bool {
        rules::is_game_over(&self.board)
    }

    /// Get area scores as a JS array [black, white, (crimson)]
    pub fn scores(&self) -> Vec<f32> {
        rules::area_score(&self.board)
    }

    /// Get captures by player index
    pub fn captures(&self, player: u8) -> u32 {
        self.board.captures[player as usize]
    }

    /// All legal moves for the current player, as flat position indices
    pub fn legal_moves(&self) -> Vec<u16> {
        rules::get_legal_moves(&self.board)
    }

    /// AI best move via MCTS. Returns 65535 if AI passes.
    pub fn ai_move(&self, iterations: u32) -> u16 {
        mcts::ai_best_move(&self.board, iterations).unwrap_or(65535)
    }

    /// Detect dead stones at game end. Returns flat positions.
    pub fn dead_stones(&self) -> Vec<u16> {
        rules::detect_dead_stones(&self.board)
    }

    /// Get the full board state as a flat Vec: one u8 per intersection.
    /// 0=Black, 1=White, 2=Crimson, 255=Empty
    pub fn board_state(&self) -> Vec<u8> {
        let total = self.board.total_positions();
        (0..total).map(|p| self.board.get_stone(p).unwrap_or(255)).collect()
    }

    /// Ko point position, or 65535 if none
    pub fn ko_point(&self) -> u16 {
        self.board.ko.unwrap_or(65535)
    }

    /// Set suicide allowed/disallowed
    pub fn set_suicide(&mut self, allowed: bool) {
        self.board.allow_suicide = allowed;
    }

    /// Knight position for a player, 65535 if none
    pub fn knight_pos(&self, player: u8) -> u16 {
        self.board.knights[player as usize].unwrap_or(65535)
    }

    /// Execute a knight move to destination
    pub fn knight_move(&mut self, destination: u16) -> bool {
        rules::move_knight(&mut self.board, destination)
    }

    /// Place a knight for the current player at position (initial placement)
    pub fn place_knight(&mut self, pos: u16) -> bool {
        let player = self.board.turn;
        if self.board.knights[player as usize].is_some() {
            return false; // already placed
        }
        if !self.board.is_empty(pos) {
            return false;
        }
        self.board.knights[player as usize] = Some(pos);
        true
    }

    /// Komi value
    pub fn komi(&self) -> f32 {
        self.board.komi
    }

    /// Move count
    pub fn move_count(&self) -> u32 {
        self.board.move_count
    }
}
