// rules.rs — Go game rules: legality, capture, ko, scoring, game-over detection

use crate::board::Board;
use crate::utils::*;

/// Find all stones in the same connected group as the stone at `position`.
/// Returns a bitmask of the group. `player` is the color to trace.
pub fn find_group(board: &Board, position: u16, player: u8) -> [u128; 3] {
    let mut group = [0u128; 3];
    let mut stack = vec![position];
    bit_set(&mut group, position);
    let player_stones = &board.stones[player as usize];

    while let Some(p) = stack.pop() {
        let (nbrs, cnt) = neighbors_array(p, board.size);
        for i in 0..cnt as usize {
            let n = nbrs[i];
            if !bit_test(&group, n) && bit_test(player_stones, n) {
                bit_set(&mut group, n);
                stack.push(n);
            }
        }
    }
    group
}

/// Count liberties of a group (empty positions adjacent to any stone in the group).
pub fn count_liberties(board: &Board, group: &[u128; 3]) -> u32 {
    let mut liberties = [0u128; 3];
    let occupied = board.all_stones();

    for p in bits_iter(group) {
        let (nbrs, cnt) = neighbors_array(p, board.size);
        for i in 0..cnt as usize {
            let n = nbrs[i];
            if !bit_test(&occupied, n) {
                bit_set(&mut liberties, n);
            }
        }
    }
    bits_count(&liberties)
}

/// Remove all stones in a group from the board and update captures.
/// `captured_by` is the player who gets credit for the capture.
fn remove_group(board: &mut Board, group: &[u128; 3], owner: u8, captured_by: u8) {
    let count = bits_count(group);
    board.captures[captured_by as usize] += count;
    for p in bits_iter(group) {
        board.remove_stone(owner, p);
    }
}

/// Check if placing a stone at `position` for the current player is legal.
pub fn is_legal(board: &Board, position: u16) -> bool {
    let player = board.turn;

    // Position must be on the board
    if position >= board.total_positions() {
        return false;
    }

    // Position must be empty
    if !board.is_empty(position) {
        return false;
    }

    // Ko check: cannot play at the ko point
    if board.ko == Some(position) {
        return false;
    }

    // Simulate the placement to check for suicide
    let mut test_board = board.clone();
    test_board.set_stone(player, position);

    // Check if any opponent groups are captured by this move
    let mut any_capture = false;
    let (nbrs, cnt) = neighbors_array(position, board.size);
    for opp in 0..board.active_players {
        if opp == player { continue; }
        for i in 0..cnt as usize {
            let n = nbrs[i];
            if bit_test(&test_board.stones[opp as usize], n) {
                let group = find_group(&test_board, n, opp);
                if count_liberties(&test_board, &group) == 0 {
                    any_capture = true;
                    for p in bits_iter(&group) {
                        test_board.remove_stone(opp, p);
                    }
                }
            }
        }
    }

    // If no captures, check if the placed stone's own group has liberties
    if !any_capture {
        let own_group = find_group(&test_board, position, player);
        let own_libs = count_liberties(&test_board, &own_group);
        if own_libs == 0 {
            // Suicide — only legal if allow_suicide is true
            return board.allow_suicide;
        }
    }

    true
}

/// Place a stone and resolve captures. Returns the updated board.
/// Assumes the move is legal (caller must check with `is_legal`).
pub fn place_stone(board: &mut Board, position: u16) {
    let player = board.turn;
    board.set_stone(player, position);
    board.ko = None;

    let mut total_captured = 0u32;
    let mut last_captured_pos: Option<u16> = None;
    let mut single_capture = false;

    // Check all opponent groups adjacent to the placed stone
    for opp in 0..board.active_players {
        if opp == player { continue; }
        // Use stack-allocated neighbors — no heap allocation
        let (nbrs, cnt) = neighbors_array(position, board.size);
        for i in 0..cnt as usize {
            let n = nbrs[i];
            if bit_test(&board.stones[opp as usize], n) {
                let group = find_group(board, n, opp);
                if count_liberties(board, &group) == 0 {
                    let count = bits_count(&group);
                    total_captured += count;
                    if count == 1 {
                        // Track for ko detection
                        last_captured_pos = Some(bits_iter(&group).next().unwrap());
                        single_capture = true;
                    } else {
                        single_capture = false;
                    }
                    remove_group(board, &group, opp, player);
                }
            }
        }
    }

    // Ko detection: if exactly one stone was captured and the placed stone
    // has exactly one liberty (the captured position), set ko
    if single_capture && total_captured == 1 {
        if let Some(cap_pos) = last_captured_pos {
            let own_group = find_group(board, position, player);
            if bits_count(&own_group) == 1 && count_liberties(board, &own_group) == 1 {
                board.ko = Some(cap_pos);
            }
        }
    }

    // Reset consecutive passes for this player
    board.consecutive_passes[player as usize] = false;
    board.next_turn();
}

/// Pass the current player's turn.
pub fn pass_turn(board: &mut Board) {
    let player = board.turn;
    board.consecutive_passes[player as usize] = true;
    board.ko = None; // Ko is reset on pass
    board.next_turn();
}

/// Check if the game is over (all active players have passed consecutively).
pub fn is_game_over(board: &Board) -> bool {
    for p in 0..board.active_players as usize {
        if !board.consecutive_passes[p] {
            return false;
        }
    }
    true
}

/// Get all legal moves for the current player.
pub fn get_legal_moves(board: &Board) -> Vec<u16> {
    let mut moves = Vec::new();
    let total = board.total_positions();
    for p in 0..total {
        if is_legal(board, p) {
            moves.push(p);
        }
    }
    moves
}

/// Compute area scores using Chinese rules.
/// Returns a Vec<f32> of scores for each player (includes komi for White).
pub fn area_score(board: &Board) -> Vec<f32> {
    let mut scores = vec![0.0f32; board.active_players as usize];
    let total = board.total_positions();

    // Count stones
    for p in 0..board.active_players as usize {
        scores[p] += bits_count(&board.stones[p]) as f32;
    }

    // Count territory: empty positions surrounded entirely by one player's stones
    let mut visited = [0u128; 3];
    for p in 0..total {
        if !board.is_empty(p) || bit_test(&visited, p) {
            continue;
        }

        // Flood fill empty region
        let mut region = [0u128; 3];
        let mut border_players: u8 = 0; // bitmask of which players border this region
        let mut stack = vec![p];
        bit_set(&mut region, p);
        bit_set(&mut visited, p);

        while let Some(pos) = stack.pop() {
            let (nbrs, cnt) = neighbors_array(pos, board.size);
            for i in 0..cnt as usize {
                let n = nbrs[i];
                if bit_test(&visited, n) || bit_test(&region, n) {
                    continue;
                }
                if board.is_empty(n) {
                    bit_set(&mut region, n);
                    bit_set(&mut visited, n);
                    stack.push(n);
                } else if let Some(owner) = board.get_stone(n) {
                    border_players |= 1 << owner;
                }
            }
        }

        let region_size = bits_count(&region) as f32;

        // If exactly one player borders this region, they own it
        if border_players.count_ones() == 1 {
            let owner = border_players.trailing_zeros() as usize;
            scores[owner] += region_size;
        }
        // If multiple players border, or no one does: neutral (no points)
    }

    // Apply komi to White (player 1) in 2-player games
    if board.active_players == 2 {
        scores[1] += board.komi;
    }

    scores
}

/// Detect dead stones on the board after the game ends.
/// Uses a simple heuristic: groups with <= 1 liberty surrounded by
/// a single opponent in a scored territory are considered dead.
/// Returns positions of dead stones.
pub fn detect_dead_stones(board: &Board) -> Vec<u16> {
    let mut dead = Vec::new();
    let mut checked = [0u128; 3];
    let total = board.total_positions();

    for p in 0..total {
        if board.is_empty(p) || bit_test(&checked, p) {
            continue;
        }
        let owner = board.get_stone(p).unwrap();
        let group = find_group(board, p, owner);

        // Mark as checked
        for g in bits_iter(&group) {
            bit_set(&mut checked, g);
        }

        let libs = count_liberties(board, &group);
        let group_size = bits_count(&group);

        // Heuristic: a small group (<=6 stones) with very few liberties
        // entirely surrounded by a single opponent is likely dead.
        if libs <= 1 && group_size <= 6 {
            // Check if surrounded by single opponent
            let mut surrounding_players: u8 = 0;
            for g in bits_iter(&group) {
                let (nbrs, cnt) = neighbors_array(g, board.size);
                for i in 0..cnt as usize {
                    if let Some(adj_owner) = board.get_stone(nbrs[i]) {
                        if adj_owner != owner {
                            surrounding_players |= 1 << adj_owner;
                        }
                    }
                }
            }
            if surrounding_players.count_ones() == 1 {
                for g in bits_iter(&group) {
                    dead.push(g);
                }
            }
        }
    }
    dead
}

// ── Knight mechanics ──────────────────────────────────────────────────

/// All valid L-shaped (knight) destinations from a position.
pub fn knight_moves(position: u16, size: u8) -> Vec<u16> {
    let (r, c) = row_col(position, size);
    let offsets: [(i16, i16); 8] = [
        (-2, -1), (-2, 1), (-1, -2), (-1, 2),
        (1, -2), (1, 2), (2, -1), (2, 1),
    ];
    let mut moves = Vec::with_capacity(8);
    for (dr, dc) in offsets {
        let nr = r as i16 + dr;
        let nc = c as i16 + dc;
        if nr >= 0 && nr < size as i16 && nc >= 0 && nc < size as i16 {
            moves.push(pos(nr as u8, nc as u8, size));
        }
    }
    moves
}

/// Get all positions in the 3×3 blast radius around a landing position.
/// Only includes valid board positions.
pub fn blast_radius(position: u16, size: u8) -> Vec<u16> {
    let (r, c) = row_col(position, size);
    let mut cells = Vec::with_capacity(9);
    for dr in -1i16..=1 {
        for dc in -1i16..=1 {
            let nr = r as i16 + dr;
            let nc = c as i16 + dc;
            if nr >= 0 && nr < size as i16 && nc >= 0 && nc < size as i16 {
                cells.push(pos(nr as u8, nc as u8, size));
            }
        }
    }
    cells
}

/// Execute a knight move: move knight from current position to destination.
/// Captures all opponent stones in 3×3 blast radius around landing.
/// Returns true if the move was executed.
pub fn move_knight(board: &mut Board, destination: u16) -> bool {
    let player = board.turn;
    let knight_pos = match board.knights[player as usize] {
        Some(p) => p,
        None => return false,
    };

    // Check destination is a valid L-move from current position
    let valid_dests = knight_moves(knight_pos, board.size);
    if !valid_dests.contains(&destination) {
        return false;
    }

    // Check if an opponent knight is at the destination (knight captures knight)
    for opp in 0..board.active_players {
        if opp == player { continue; }
        if board.knights[opp as usize] == Some(destination) {
            board.knights[opp as usize] = None;
        }
    }

    // Move the knight
    board.knights[player as usize] = Some(destination);

    // Blast radius: capture all opponent stones in 3×3
    let blast = blast_radius(destination, board.size);
    for opp in 0..board.active_players {
        if opp == player { continue; }
        for &cell in &blast {
            if bit_test(&board.stones[opp as usize], cell) {
                board.remove_stone(opp, cell);
                board.captures[player as usize] += 1;
            }
        }
    }

    board.consecutive_passes[player as usize] = false;
    board.next_turn();
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── Group & Liberty tests ─────────────────────────────────────

    #[test]
    fn test_single_stone_group() {
        let mut b = Board::new(9, 2);
        b.set_stone(0, pos(4, 4, 9));
        let group = find_group(&b, pos(4, 4, 9), 0);
        assert_eq!(bits_count(&group), 1);
        assert_eq!(count_liberties(&b, &group), 4);
    }

    #[test]
    fn test_connected_group() {
        let mut b = Board::new(9, 2);
        b.set_stone(0, pos(4, 4, 9));
        b.set_stone(0, pos(4, 5, 9));
        b.set_stone(0, pos(4, 6, 9));
        let group = find_group(&b, pos(4, 4, 9), 0);
        assert_eq!(bits_count(&group), 3);
    }

    // ── Capture tests ─────────────────────────────────────────────

    #[test]
    fn test_single_stone_capture() {
        let mut b = Board::new(9, 2);
        // White stone at center
        b.set_stone(1, pos(4, 4, 9));
        // Black surrounds it
        b.set_stone(0, pos(3, 4, 9));
        b.set_stone(0, pos(5, 4, 9));
        b.set_stone(0, pos(4, 3, 9));
        // Black's turn, place the last surrounding stone
        b.turn = 0;
        assert!(is_legal(&b, pos(4, 5, 9)));
        place_stone(&mut b, pos(4, 5, 9));
        // White stone should be captured
        assert!(b.is_empty(pos(4, 4, 9)));
        assert_eq!(b.captures[0], 1); // Black captured 1
    }

    #[test]
    fn test_group_capture() {
        let mut b = Board::new(9, 2);
        // White group of 2
        b.set_stone(1, pos(0, 0, 9));
        b.set_stone(1, pos(0, 1, 9));
        // Black surrounds
        b.set_stone(0, pos(1, 0, 9));
        b.set_stone(0, pos(1, 1, 9));
        b.set_stone(0, pos(0, 2, 9));
        b.turn = 0;
        // The group at corner: (0,0) has neighbors (1,0) and (0,1).
        // (0,1) has neighbors (0,0), (1,1), (0,2).
        // All liberties are covered by black.
        // White group should already be captured when we check.
        // Actually, we need one more move. Let me recalculate.
        // (0,0) neighbors: (1,0)=Black, (0,1)=White. Liberty: none from (0,0) directly? No, we need to check the group.
        // Group = {(0,0), (0,1)}. Neighbors: (1,0)=Black, (1,1)=Black, (0,2)=Black. All occupied. 0 liberties.
        let group = find_group(&b, pos(0, 0, 9), 1);
        assert_eq!(count_liberties(&b, &group), 0);
    }

    // ── Suicide tests ─────────────────────────────────────────────

    #[test]
    fn test_suicide_blocked_by_default() {
        let mut b = Board::new(9, 2);
        // Create a position where Black playing at (0,0) would be suicide
        b.set_stone(1, pos(0, 1, 9));
        b.set_stone(1, pos(1, 0, 9));
        b.turn = 0;
        assert!(!is_legal(&b, pos(0, 0, 9)));
    }

    #[test]
    fn test_suicide_allowed_when_enabled() {
        let mut b = Board::new(9, 2);
        b.allow_suicide = true;
        b.set_stone(1, pos(0, 1, 9));
        b.set_stone(1, pos(1, 0, 9));
        b.turn = 0;
        assert!(is_legal(&b, pos(0, 0, 9)));
    }

    // ── Ko tests ──────────────────────────────────────────────────

    #[test]
    fn test_ko_detection() {
        // Classic ko pattern:
        //   . B W .
        //   B . B W
        //   . B W .
        // White captures at (1,1), creating ko
        let mut b = Board::new(9, 2);
        b.set_stone(0, pos(0, 1, 9)); // B
        b.set_stone(1, pos(0, 2, 9)); // W
        b.set_stone(0, pos(1, 0, 9)); // B
        b.set_stone(0, pos(1, 2, 9)); // B
        b.set_stone(1, pos(1, 3, 9)); // W
        b.set_stone(0, pos(2, 1, 9)); // B
        b.set_stone(1, pos(2, 2, 9)); // W

        // Place Black at (1,1) first
        b.set_stone(0, pos(1, 1, 9));

        // Now White captures at (1,2)... wait, let me set up a proper ko.
        // Simple ko: two single-stone captures alternating.
        let mut b = Board::new(9, 2);
        //   . B .
        //   B . W
        //   . W .
        // Black at (0,1), (1,0). White at (1,2), (2,1).
        // Black plays (1,1) — no, that doesn't capture.
        // Let me use a textbook ko:
        //
        //   col 0 1 2 3
        // r0:  . B W .
        // r1:  B [.] W .   <- Black plays here to capture White at ?
        // r2:  . B W .
        //
        // Hmm, let me think of a real ko shape.
        // Ko:  . B W .
        //      B . . W
        //      . B W .
        // Black plays at (1,1) captures White at... no White there.

        // Standard ko setup:
        //   col: 0 1 2
        //   r0:  . B W
        //   r1:  B W .   <- White at (1,1), surrounded by B(0,1),B(1,0),W is at (0,2) — not useful.

        // Let me use a simple direct setup:
        // Black: (0,1), (1,0), (2,1)
        // White: (0,2), (1,2), (2,2), and W at (1,1)
        // Now Black plays (1,1)... no, White is there.
        // OK: just test that after a single-stone capture where the capturing stone
        // itself only has 1 liberty, ko is set.

        let mut b = Board::new(9, 2);
        // Setup: Black about to capture a single white stone
        // W at (1,1). B at (0,1), (1,0), (2,1). Empty at (1,2).
        // Black to play (1,2) — but that doesn't capture (1,1) since (1,1) still has liberty? No.
        // W(1,1) neighbors: (0,1)=B, (2,1)=B, (1,0)=B, (1,2)=empty. One liberty.
        // If B plays at (1,2), W(1,1) has 0 liberties → captured.
        // After capture: B at (0,1),(1,0),(2,1),(1,2). Ko at (1,1)?
        // B(1,2) group: just (1,2). Liberties: (0,2),(2,2),(1,1). 3 liberties. Not ko.
        // For ko, capturing stone needs exactly 1 liberty at the captured pos.
        // Setup for ko:
        // B at (0,1), (1,0). W at (1,1). B turn, play (1,2)... still not right.

        // True ko: B(0,0), B(1,1), W(0,1), W(1,0) — nope.
        // Let me just test the simplest ko pattern on a 9x9:
        //
        //     0 1 2 3
        //  0: . B W .
        //  1: B W . W
        //  2: . B W .
        //
        // Black plays at (1,2): captures W(1,1)? No, W(1,1) has neighbors (0,1)=B,(2,1)=B,(1,0)=B,(1,2)=now B.
        // Hmm W(1,1) neighbors: up=(0,1)=B, down=(2,1)=B, left=(1,0)=B, right=(1,2)=B now. Captured!
        // After: B at (0,1),(1,0),(1,2),(2,1). (1,1) empty. B(1,2) liberties: (0,2)=W,(2,2)=W,(1,1)=empty,(1,3)=W-oops.
        // B(1,2) has only 1 liberty at (1,1)? Let me check: (0,2)=W, (2,2)=W, (1,3)=W, (1,1)=empty.Yes! 1 liberty.
        // So ko is set at (1,1). White cannot immediately recapture there. ✓

        b.set_stone(0, pos(0, 1, 9)); // B
        b.set_stone(1, pos(0, 2, 9)); // W
        b.set_stone(0, pos(1, 0, 9)); // B
        b.set_stone(1, pos(1, 1, 9)); // W — will be captured
        b.set_stone(1, pos(1, 3, 9)); // W
        b.set_stone(0, pos(2, 1, 9)); // B
        b.set_stone(1, pos(2, 2, 9)); // W
        b.turn = 0;

        // Black captures at (1,2)
        place_stone(&mut b, pos(1, 2, 9));
        assert!(b.is_empty(pos(1, 1, 9))); // Captured
        assert_eq!(b.ko, Some(pos(1, 1, 9))); // Ko set

        // White cannot immediately recapture at (1,1)
        assert!(!is_legal(&b, pos(1, 1, 9)));
    }

    #[test]
    fn test_ko_allows_recapture_after_intervening_move() {
        let mut b = Board::new(9, 2);
        b.set_stone(0, pos(0, 1, 9));
        b.set_stone(1, pos(0, 2, 9));
        b.set_stone(0, pos(1, 0, 9));
        b.set_stone(1, pos(1, 1, 9));
        b.set_stone(1, pos(1, 3, 9));
        b.set_stone(0, pos(2, 1, 9));
        b.set_stone(1, pos(2, 2, 9));
        b.turn = 0;

        place_stone(&mut b, pos(1, 2, 9)); // Black captures, ko at (1,1)
        assert_eq!(b.ko, Some(pos(1, 1, 9)));

        // White plays elsewhere
        place_stone(&mut b, pos(8, 8, 9));

        // Ko should be cleared (it's reset when the ko-holder's turn comes around with a new move)
        // Actually, ko is only valid for the immediate next move. After White plays elsewhere,
        // Black plays, then White can recapture.
        // But here after White plays at (8,8), it's Black's turn. Black plays somewhere.
        place_stone(&mut b, pos(8, 7, 9));

        // Now it's White's turn again. Ko was set to None when White played (8,8).
        // So (1,1) should be legal if White can play there.
        // White's turn now:
        assert_eq!(b.turn, 1);
        assert_eq!(b.ko, None);
    }

    // ── Scoring tests ─────────────────────────────────────────────

    #[test]
    fn test_area_scoring_simple() {
        let mut b = Board::new(9, 2);
        // Black owns top row, White owns bottom row
        for c in 0..9u8 {
            b.set_stone(0, pos(0, c, 9));
            b.set_stone(1, pos(8, c, 9));
        }
        let scores = area_score(&b);
        // Black: 9 stones + territory above/around
        // White: 9 stones + territory below/around + 6.5 komi
        assert!(scores[0] > 0.0);
        assert!(scores[1] > 0.0);
        // White has komi
        assert!(scores[1] >= 6.5);
    }

    #[test]
    fn test_area_scoring_komi() {
        let b = Board::new(9, 2);
        let scores = area_score(&b);
        // Empty board: all territory is neutral (bordered by nobody)
        // Actually, on an empty board no one borders any region, so both get 0.
        // White gets komi.
        assert_eq!(scores[0], 0.0);
        assert_eq!(scores[1], 6.5);
    }

    #[test]
    fn test_3p_scoring_neutral() {
        let mut b = Board::new(13, 3);
        // Place stones from all 3 players adjacent to an empty region
        b.set_stone(0, pos(5, 5, 13));
        b.set_stone(1, pos(5, 7, 13));
        b.set_stone(2, pos(7, 6, 13));
        let scores = area_score(&b);
        // Each player has 1 stone. Most territory is neutral.
        assert_eq!(scores[0], 1.0);
        assert_eq!(scores[1], 1.0);
        assert_eq!(scores[2], 1.0);
    }

    // ── Game over tests ───────────────────────────────────────────

    #[test]
    fn test_game_over_both_pass() {
        let mut b = Board::new(9, 2);
        assert!(!is_game_over(&b));
        pass_turn(&mut b); // Black passes
        assert!(!is_game_over(&b));
        pass_turn(&mut b); // White passes
        assert!(is_game_over(&b));
    }

    #[test]
    fn test_game_not_over_one_pass() {
        let mut b = Board::new(9, 2);
        pass_turn(&mut b); // Black passes
        place_stone(&mut b, pos(0, 0, 9)); // White plays
        assert!(!is_game_over(&b));
    }

    // ── Knight tests ──────────────────────────────────────────────

    #[test]
    fn test_knight_moves_center() {
        let moves = knight_moves(pos(4, 4, 9), 9);
        assert_eq!(moves.len(), 8);
    }

    #[test]
    fn test_knight_moves_corner() {
        let moves = knight_moves(pos(0, 0, 9), 9);
        assert_eq!(moves.len(), 2);
    }

    #[test]
    fn test_knight_moves_edge() {
        let moves = knight_moves(pos(0, 4, 9), 9);
        // From (0,4): valid L-moves that stay on board
        // (-2,3)=no, (-2,5)=no, (-1,2)=no, (-1,6)=no, (1,2)=yes, (1,6)=yes, (2,3)=yes, (2,5)=yes
        assert_eq!(moves.len(), 4);
    }

    #[test]
    fn test_blast_radius_center() {
        let cells = blast_radius(pos(4, 4, 9), 9);
        assert_eq!(cells.len(), 9);
    }

    #[test]
    fn test_blast_radius_corner() {
        let cells = blast_radius(pos(0, 0, 9), 9);
        assert_eq!(cells.len(), 4); // (0,0),(0,1),(1,0),(1,1)
    }

    #[test]
    fn test_blast_captures_opponents() {
        let mut b = Board::new(9, 2);
        b.knights[0] = Some(pos(4, 4, 9)); // Black knight at center
        // Place some white stones in blast radius
        b.set_stone(1, pos(3, 3, 9));
        b.set_stone(1, pos(3, 4, 9));
        b.set_stone(1, pos(5, 5, 9));
        // Place a black stone that should NOT be captured
        b.set_stone(0, pos(4, 5, 9));

        b.turn = 0;
        let dest = pos(4, 2, 9); // L-move: (4,4) -> (4,2)? No, that's not L-shaped.
        // L-move from (4,4): (2,3),(2,5),(3,2),(3,6),(5,2),(5,6),(6,3),(6,5)
        let dest = pos(2, 3, 9);
        // Blast at (2,3): cells (1,2),(1,3),(1,4),(2,2),(2,3),(2,4),(3,2),(3,3),(3,4)
        // White stones at (3,3) and (3,4)=not there, (3,3) is in blast. (3,4) not in blast of (2,3).
        // W(3,3) is in blast. W(3,4) is at row 3, col 4. |4-3|=1. In blast? (2,3) blast: rows 1-3, cols 2-4. col 4 is at boundary. Yes!
        // W(5,5) is NOT in blast.
        assert!(move_knight(&mut b, dest));
        assert!(b.is_empty(pos(3, 3, 9))); // Captured by blast
    }

    #[test]
    fn test_knight_on_knight_capture() {
        let mut b = Board::new(9, 2);
        b.knights[0] = Some(pos(4, 4, 9));
        b.knights[1] = Some(pos(2, 3, 9)); // White knight at an L-move destination

        b.turn = 0;
        assert!(move_knight(&mut b, pos(2, 3, 9)));
        assert_eq!(b.knights[0], Some(pos(2, 3, 9)));
        assert_eq!(b.knights[1], None); // White knight captured
    }

    // ── Dead stone detection ──────────────────────────────────────

    #[test]
    fn test_dead_stone_detection() {
        let mut b = Board::new(9, 2);
        // Single white stone completely surrounded by black
        b.set_stone(1, pos(4, 4, 9));
        b.set_stone(0, pos(3, 4, 9));
        b.set_stone(0, pos(5, 4, 9));
        b.set_stone(0, pos(4, 3, 9));
        b.set_stone(0, pos(4, 5, 9));
        // W(4,4) has 0 liberties — technically already captured, but
        // detect_dead_stones works on end-of-game state.
        let dead = detect_dead_stones(&b);
        assert!(dead.contains(&pos(4, 4, 9)));
    }
}
