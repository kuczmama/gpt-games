const enemyCanvas = document.getElementById('enemyCanvas');
const enemyCtx = enemyCanvas.getContext('2d');
const enemyGrid = [];

let enemyBlock = null;
let level = 1;  // Starting level
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const grid = [];
const gridSize = 30;
const gridRows = canvas.height / gridSize;
const gridCols = canvas.width / gridSize;
let nextBlock = null;
let score = 0;
let highScore = localStorage.getItem('highScore') || 0;
document.getElementById('highScore').innerText = highScore;
let currentBlock = null;
let gameInterval;

class BlockPair {
    constructor(targetGrid) {
        this.grid = targetGrid; // Storing the grid this block belongs to
        this.primary = {
            row: 0,
            col: Math.floor(gridCols / 2),
            color: this.randomColor()
        };
        this.secondary = {
            row: -1,
            col: Math.floor(gridCols / 2),
            color: this.randomColor()
        };
        this.rotationState = 0;  // Initialize to 0
    }

    rotate() {
        let newRow = this.secondary.row;
        let newCol = this.secondary.col;

        switch (this.rotationState) {
            case 0:
                newRow = this.primary.row;
                newCol = this.primary.col + 1;
                break;
            case 1:
                newRow = this.primary.row + 1;
                newCol = this.primary.col;
                break;
            case 2:
                newRow = this.primary.row;
                newCol = this.primary.col - 1;
                break;
            case 3:
                newRow = this.primary.row - 1;
                newCol = this.primary.col;
                break;
        }

        // Check if the new position is valid
        if (newRow >= 0 && newRow < gridRows && newCol >= 0 && newCol < gridCols && !this.grid[newRow][newCol]) {
            this.secondary.row = newRow;
            this.secondary.col = newCol;
            this.rotationState = (this.rotationState + 1) % 4;  // Update the rotation state
        }
    }


    randomColor() {
        return ['red', 'blue', 'green', 'yellow'][Math.floor(Math.random() * 4)];
    }

    draw() {
        this.drawBlock(this.primary);
        this.drawBlock(this.secondary);
    }

    drawBlock(block) {
        ctx.fillStyle = block.color;
        ctx.fillRect(block.col * gridSize, block.row * gridSize, gridSize, gridSize);
    }

    collision(rowDelta, colDelta, block) {
        const newRow = block.row + rowDelta;
        const newCol = block.col + colDelta;

        if (newRow >= gridRows || newRow < 0 || newCol >= gridCols || newCol < 0 || this.grid[newRow][newCol]) {
            return true;
        }

        return false;
    }

    moveDown() {
        const primaryCollision = this.collision(1, 0, this.primary);
        const secondaryCollision = this.collision(1, 0, this.secondary);

        if (!primaryCollision && !secondaryCollision) {
            this.primary.row++;
            this.secondary.row++;
        } else {
            if (primaryCollision) {
                this.grid[this.primary.row][this.primary.col] = this.primary.color;
                while (!this.collision(1, 0, this.secondary)) {
                    this.secondary.row++;
                }
                if (this.secondary.row >= 0) {
                    this.grid[this.secondary.row][this.secondary.col] = this.secondary.color;
                }
            } else if (secondaryCollision) {
                this.grid[this.secondary.row][this.secondary.col] = this.secondary.color;
                while (!this.collision(1, 0, this.primary)) {
                    this.primary.row++;
                }
                this.grid[this.primary.row][this.primary.col] = this.primary.color;
            }

            this.checkRemoval();

            currentBlock = nextBlock;
            nextBlock = new BlockPair(this.grid);
            drawNextBlock();
            if (this.collision(0, 0, currentBlock.primary) && this.collision(0, 0, currentBlock.secondary)) {
                pauseGame();
                alert('Game Over!');
            }
        }
    }

    moveLeft() {
        if (!this.collision(0, -1, this.primary) && !this.collision(0, -1, this.secondary)) {
            this.primary.col--;
            this.secondary.col--;
        }
    }

    moveRight() {
        if (!this.collision(0, 1, this.primary) && !this.collision(0, 1, this.secondary)) {
            this.primary.col++;
            this.secondary.col++;
        }
    }
    checkRemoval() {
        let removedAny;

        do {
            removedAny = false;
            let toRemove = [];

            let visited = Array(gridRows).fill(null).map(() => Array(gridCols).fill(false));

            const dfs = (r, c, color) => {
                if (r < 0 || r >= gridRows || c < 0 || c >= gridCols || visited[r][c] || this.grid[r][c] !== color) {
                    return [];
                }
                visited[r][c] = true;
                let cells = [{ r, c }];
                cells = cells.concat(dfs(r + 1, c, color));
                cells = cells.concat(dfs(r - 1, c, color));
                cells = cells.concat(dfs(r, c + 1, color));
                cells = cells.concat(dfs(r, c - 1, color));
                return cells;
            }

            for (let r = 0; r < gridRows; r++) {
                for (let c = 0; c < gridCols; c++) {
                    if (this.grid[r][c] && !visited[r][c]) {
                        const blocks = dfs(r, c, this.grid[r][c]);
                        if (blocks.length >= 4) {
                            toRemove = toRemove.concat(blocks);
                        }
                    }
                }
            }

            toRemove.forEach(cell => {
                this.grid[cell.r][cell.c] = null;
            });

            if (toRemove.length > 0) {
                increaseScore(toRemove.length);
                removedAny = true;
            }

            // Gravity: make blocks fall down after removal
            for (let c = 0; c < gridCols; c++) {
                let dropRow = gridRows - 1; // Start from the bottom-most row

                for (let r = gridRows - 1; r >= 0; r--) {
                    if (this.grid[r][c]) {
                        if (dropRow !== r) { // If there's a gap
                            this.grid[dropRow][c] = this.grid[r][c]; // Move the block down to the lowest empty spot
                            this.grid[r][c] = null; // Clear the original spot
                        }
                        dropRow--; // Move up the drop position for the next block
                    }
                }
            }


        } while (removedAny);
    }

}

class EnemyBlockPair extends BlockPair {
    constructor(targetGrid) {
        super(targetGrid);
    }
    // Override draw method to draw on enemy canvas
    drawBlock(block) {
        enemyCtx.fillStyle = block.color;
        enemyCtx.fillRect(block.col * gridSize, block.row * gridSize, gridSize, gridSize);
    }

    // Override checkRemoval to introduce sending garbage
    checkRemoval() {
        // ... (rest of the code)
        if (toRemove.length > 0) {
            sendGarbageToPlayer(toRemove.length / 4);  // Send garbage blocks to player
        }
    }
}

function initializeEnemyGrid() {
    for (let r = 0; r < gridRows; r++) {
        enemyGrid[r] = [];
        for (let c = 0; c < gridCols; c++) {
            enemyGrid[r][c] = null;
        }
    }
}

function drawEnemyGrid() {
    enemyCtx.clearRect(0, 0, enemyCanvas.width, enemyCanvas.height);
    for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
            if (enemyGrid[r][c]) {
                enemyCtx.fillStyle = enemyGrid[r][c];
                enemyCtx.fillRect(c * gridSize, r * gridSize, gridSize, gridSize);
            }
        }
    }
}

function enemyAI() {
    const move = ['left', 'right', 'down', 'rotate'][Math.floor(Math.random() * 4)];
    switch (move) {
        case 'left':
            enemyBlock.moveLeft();
            break;
        case 'right':
            enemyBlock.moveRight();
            break;
        case 'down':
            enemyBlock.moveDown();
            break;
        case 'rotate':
            enemyBlock.rotate();
            break;
    }
}

function sendGarbageToPlayer(amount) {
    // Add `amount` of garbage rows at the bottom of player's grid
    // For simplicity, garbage blocks are just grey colored blocks
    for (let i = 0; i < amount; i++) {
        const garbageRow = [];
        for (let j = 0; j < gridCols; j++) {
            garbageRow.push('grey');
        }
        grid.unshift(garbageRow);  // Add to top
        grid.pop();  // Remove bottom-most row
    }
}

function initializeGrid() {
    for (let r = 0; r < gridRows; r++) {
        grid[r] = [];
        for (let c = 0; c < gridCols; c++) {
            grid[r][c] = null;
        }
    }
}

function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
            if (grid[r][c]) {
                ctx.fillStyle = grid[r][c];
                ctx.fillRect(c * gridSize, r * gridSize, gridSize, gridSize);
            }
        }
    }
}

function increaseScore(points) {
    score += points * 10;
    document.getElementById('score').innerText = score;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('highScore', highScore);
        document.getElementById('highScore').innerText = highScore;
    }
}

function startGame() {
    initializeGrid();
    initializeEnemyGrid();
    score = 0;
    document.getElementById('score').innerText = score;
    nextBlock = new BlockPair(grid);
    drawNextBlock();
    currentBlock = new BlockPair(grid);
    enemyBlock = new EnemyBlockPair(enemyGrid);
    gameInterval = setInterval(() => {
        drawGrid();
        currentBlock.draw();

        drawEnemyGrid();
        enemyBlock.draw();

        currentBlock.moveDown();
        enemyAI();
        enemyBlock.moveDown();
    }, 500 - (level * 50));
}

function drawNextBlock() {
    const canvas = document.getElementById('nextBlockCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const offsetX = canvas.width / 2;
    const offsetY = canvas.height / 2;
    ctx.fillStyle = nextBlock.primary.color;
    ctx.fillRect(offsetX, offsetY, gridSize, gridSize);
    ctx.fillStyle = nextBlock.secondary.color;
    ctx.fillRect(offsetX + (nextBlock.secondary.col - nextBlock.primary.col) * gridSize, offsetY + (nextBlock.secondary.row - nextBlock.primary.row) * gridSize, gridSize, gridSize);
}



function pauseGame() {
    clearInterval(gameInterval);
}


// Keyboard control
document.addEventListener('keydown', function (e) {
    if (!currentBlock) return;

    switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
            currentBlock.moveLeft();
            break;
        case 'ArrowRight':
        case 'KeyD':
            currentBlock.moveRight();
            break;
        case 'ArrowDown':
        case 'KeyS':
            currentBlock.moveDown();
            break;
        case 'ArrowUp':
            currentBlock.rotate();
            break;
    }

    drawGrid();
    currentBlock.draw();
});
