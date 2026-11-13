---
id: scholars-mate
title: Scholar's Mate
category: animation
variant: open
subject: chess-explainer
version: 1
---
Create a polished, 2D animated chess lesson explaining Scholar’s Mate.

Aim for the clarity and feel of a chess.com-style lesson: a flat, top-down green
and cream chessboard, crisp readable pieces, a restrained dark interface, move
notation and concise coaching captions. Make your own design and piece artwork;
no logos or external assets. This must look like a 2D chess interface, not a 3D
board or a perspective scene. With the supplied three.js environment, an
orthographic flat board is appropriate; HTML overlays are welcome.

Show the entire lesson from Black's perspective: Black's pieces start at the
bottom and White's at the top. Rotate the board 180 degrees, including its square
labels: files run h to a from left to right, and ranks run 1 to 8 from top to
bottom. Keep this orientation throughout playback, seeking and replay. Piece
movement, arrows and highlights must follow the rotated coordinates; keep the
pieces, labels and coaching text upright and readable. Standard algebraic
notation retains its usual meaning.

Start from the standard chess position and animate exactly this supplied line:

1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#

The move order is supplied and verified. Do not search for or reconstruct a
sequence, and do not enumerate alternative games. Build the lesson directly
from these seven half-moves, with correct notation, turns, the capture on f7,
and final checkmate. Every displayed position must follow the supplied moves.
Verify the final position and that Black is checkmated.

Explain White’s bishop-and-queen attack on f7, why 3...Nf6 fails to stop the
immediate mate, and why the final king cannot capture the protected queen or
escape. Use well-timed arrows and square highlights to make these ideas clear.
Explain that this is an avoidable beginner trap, not a forced win; emphasize
noticing the threat, defending f7 and developing safely. Do not invent engine
evaluations or animate extra variations.

The lesson should start playing automatically, with smooth piece movement and
enough pauses to read the explanations. Include play/pause, replay and previous /
next move controls, a progress indicator, and a move list with the current move
highlighted. Seeking backwards and replaying must restore the exact board state,
including captures. Keep each caption short and tied to the position on screen.

Finish with a useful takeaway rather than an endless loop of moves: develop,
protect f7 and check the opponent’s threats before chasing the queen.
The board and lesson controls must remain legible on desktop and mobile. You
choose the composition, visual details and pacing. Deliver the complete working
lesson, not a static mockup.
