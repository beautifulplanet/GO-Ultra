// mcts.rs — Monte Carlo Tree Search AI

use crate::board::Board;
use crate::rules::{get_legal_moves, is_game_over, is_legal, place_stone, pass_turn, area_score, find_group, count_liberties};
use crate::utils::*;
use rand::prelude::*;
use rand::rngs::SmallRng;

struct MctsNode {
    position: Option<u16>, // None = pass
    visits: u32,
    wins: f32,
    children: Vec<MctsNode>,
    unexplored: Vec<Option<u16>>,
}

impl MctsNode {
    fn new(position: Option<u16>, legal_moves: Vec<u16>) -> Self {
        let mut unexplored: Vec<Option<u16>> = legal_moves.into_iter().map(Some).collect();
        unexplored.push(None); // pass is always an option
        MctsNode {
            position,
            visits: 0,
            wins: 0.0,
            children: Vec::new(),
            unexplored,
        }
    }

    fn ucb1(&self, parent_visits: u32) -> f64 {
        if self.visits == 0 {
            return f64::MAX;
        }
        let exploitation = self.wins as f64 / self.visits as f64;
        let exploration = (2.0f64 * (parent_visits as f64).ln() / self.visits as f64).sqrt();
        exploitation + exploration
    }
}

/// Scan for opponent groups in atari (exactly 1 liberty).
/// Returns the capturing move if any group with >= 2 stones can be taken.
fn find_urgent_capture(board: &Board, legal_moves: &[u16]) -> Option<u16> {
    let player = board.turn;
    let total = board.total_positions();
    let mut checked = [0u128; 3];

    for opp in 0..board.active_players {
        if opp == player { continue; }
        for p in 0..total {
            if !bit_test(&board.stones[opp as usize], p) || bit_test(&checked, p) {
                continue;
            }
            let group = find_group(board, p, opp);
            for i in 0..total {
                if bit_test(&group, i) { bit_set(&mut checked, i); }
            }

            if count_liberties(board, &group) == 1 && bits_count(&group) >= 2 {
                // Find the liberty position
                for i in 0..total {
                    if bit_test(&group, i) {
                        for n in neighbors(i, board.size) {
                            if board.is_empty(n) && legal_moves.contains(&n) {
                                return Some(n);
                            }
                        }
                    }
                }
            }
        }
    }
    None
}

/// Run MCTS from the current board state and return the best move.
/// Returns None if the AI decides to pass.
pub fn ai_best_move(board: &Board, iterations: u32) -> Option<u16> {
    let player = board.turn;
    let legal = get_legal_moves(board);

    if legal.is_empty() {
        return None; // pass
    }

    // Tactical shortcut: immediately capture large opponent groups in atari
    if let Some(capture) = find_urgent_capture(board, &legal) {
        return Some(capture);
    }

    let mut rng = SmallRng::from_entropy();
    let mut root = MctsNode::new(None, legal);

    for _ in 0..iterations {
        let mut sim_board = board.clone();
        mcts_iterate(&mut root, &mut sim_board, player, &mut rng);
    }

    // Pick child with most visits
    root.children
        .iter()
        .max_by_key(|c| c.visits)
        .and_then(|c| c.position)
}

fn mcts_iterate(node: &mut MctsNode, board: &mut Board, root_player: u8, rng: &mut SmallRng) -> Vec<f32> {
    if is_game_over(board) {
        return area_score(board);
    }

    let result;

    // Expansion: if there are unexplored moves, pick one
    if !node.unexplored.is_empty() {
        let idx = rng.gen_range(0..node.unexplored.len());
        let mv = node.unexplored.swap_remove(idx);

        match mv {
            Some(pos) => place_stone(board, pos),
            None => pass_turn(board),
        }

        let legal = get_legal_moves(board);
        let mut child = MctsNode::new(mv, legal);

        // Simulate (rollout)
        result = simulate(board, rng);
        update_node_stats(&mut child, &result, root_player);

        node.children.push(child);
    } else if node.children.is_empty() {
        // Terminal-like node with no children and no unexplored — rollout
        result = simulate(board, rng);
    } else {
        // Selection: pick child with highest UCB1
        let parent_visits = node.visits;
        let best_idx = node.children
            .iter()
            .enumerate()
            .max_by(|(_, a), (_, b)| a.ucb1(parent_visits).partial_cmp(&b.ucb1(parent_visits)).unwrap())
            .map(|(i, _)| i)
            .unwrap();

        let mv = node.children[best_idx].position;
        match mv {
            Some(pos) => place_stone(board, pos),
            None => pass_turn(board),
        }

        result = mcts_iterate(&mut node.children[best_idx], board, root_player, rng);
    }

    // Backpropagate at this level as recursion unwinds
    update_node_stats(node, &result, root_player);
    result
}

fn simulate(board: &mut Board, rng: &mut SmallRng) -> Vec<f32> {
    let mut moves_made = 0;
    let max_moves = (board.size as u32) * (board.size as u32) * 3;

    while !is_game_over(board) && moves_made < max_moves {
        let legal = get_legal_moves(board);
        if legal.is_empty() || rng.gen_bool(0.1) {
            pass_turn(board);
        } else {
            // Heavy playout: prefer capturing atari groups
            if let Some(cap) = find_urgent_capture(board, &legal) {
                place_stone(board, cap);
            } else {
                let idx = rng.gen_range(0..legal.len());
                place_stone(board, legal[idx]);
            }
        }
        moves_made += 1;
    }

    area_score(board)
}

fn update_node_stats(node: &mut MctsNode, scores: &[f32], root_player: u8) {
    node.visits += 1;
    let root_score = scores.get(root_player as usize).copied().unwrap_or(0.0);
    let max_score = scores.iter().cloned().fold(0.0f32, f32::max);
    if root_score >= max_score - f32::EPSILON {
        node.wins += 1.0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::pos;

    #[test]
    fn test_ai_returns_legal_move() {
        let b = Board::new(9, 2);
        let mv = ai_best_move(&b, 50);
        if let Some(p) = mv {
            assert!(p < 81);
        }
    }

    #[test]
    fn test_ai_finds_capture() {
        let mut b = Board::new(9, 2);
        // White group of 3 in corner with 1 liberty at (1,1)
        // Row 0: W W B . . . . . .
        // Row 1: W _ B . . . . . .
        // Row 2: B B . . . . . . .
        b.set_stone(1, pos(0, 0, 9)); // White
        b.set_stone(1, pos(0, 1, 9)); // White
        b.set_stone(1, pos(1, 0, 9)); // White
        b.set_stone(0, pos(0, 2, 9)); // Black
        b.set_stone(0, pos(1, 2, 9)); // Black
        b.set_stone(0, pos(2, 0, 9)); // Black
        b.set_stone(0, pos(2, 1, 9)); // Black
        // Only liberty for white group is (1,1) — capture is worth 3 stones
        b.turn = 0;
        let mv = ai_best_move(&b, 100); // Tactical pre-check handles this — low iterations fine
        assert_eq!(mv, Some(pos(1, 1, 9)));
    }

    #[test]
    fn test_ai_handles_no_legal_moves() {
        // This is a pathological case — fill the whole board
        let mut b = Board::new(9, 2);
        for r in 0..9u8 {
            for c in 0..9u8 {
                b.set_stone(0, pos(r, c, 9));
            }
        }
        b.turn = 1;
        let mv = ai_best_move(&b, 10);
        assert_eq!(mv, None); // Should pass
    }

    #[test]
    fn test_ai_handles_game_over() {
        let mut b = Board::new(9, 2);
        b.consecutive_passes = [true, true, false];
        pass_turn(&mut b); // now all have passed... actually let me set it up properly
        let mut b = Board::new(9, 2);
        pass_turn(&mut b);
        pass_turn(&mut b);
        // Game is over
        let mv = ai_best_move(&b, 10);
        assert_eq!(mv, None);
    }
}
