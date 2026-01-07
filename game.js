const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const UI_MARGIN = 24;
let gameState = "PLAYING";
let startTime = performance.now();
let score = 0;
let difficultyLevel = 1;
let lastDifficultyIncrease = 0;
let flashTimer=0;
let pausedTime = 0;
let pauseStartTime = 0;
const dashTrail=[];
//PLAYER
const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 10,
    speed: 3,
    dashSpeed: 8,
    dashDuration: 10,
    dashCooldown: 180,
    dashTimer: 0,
    cooldownTimer: 0,
    isDashing: false
};
//AMBUSH VELOCITY
let lastPlayerX = player.x;
let lastPlayerY = player.y;
let playerVX = 0;
let playerVY = 0;
const keys = {};
window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);
window.addEventListener("keydown", e => {
    if (e.key.toLowerCase() === "p") {
        if (gameState === "PLAYING") {
            gameState = "PAUSED";
            pauseStartTime = performance.now();
        } else if (gameState === "PAUSED") {
            gameState = "PLAYING";
            pausedTime += performance.now() - pauseStartTime;
        }
    }
});
window.addEventListener("keydown", e => {
    if (e.key.toLowerCase() === "i") {
        if (gameState === "PLAYING") {
            gameState = "INFO";
            pauseStartTime = performance.now();
        } else if (gameState === "INFO") {
            gameState = "PLAYING";
            pausedTime += performance.now() - pauseStartTime;
        }
    }
});
//ENEMY LEVEL
function getEnemyTypeByLevel() {
    if (difficultyLevel < 5) return "NORMAL";
    if (difficultyLevel < 10) return Math.random() < 0.5 ? "NORMAL" : "FAST";
    return Math.random() < 0.4 ? "AMBUSH" : "FAST";
}
function getSafeSpawnPosition(minDistance) {
    let x, y, dist;
    do {
        x = Math.random() * canvas.width;
        y = Math.random() * canvas.height;
        dist = Math.hypot(x - player.x, y - player.y);
    } while (dist < minDistance);
    return { x, y };
}
//ENEMY
function createEnemies(count) {
    const list = [];
    for (let i = 0; i < count; i++) {
        const pos = getSafeSpawnPosition(150);
        const type = getEnemyTypeByLevel();
        const baseSpeed =
            type === "FAST" ? 2.0 :
            type === "AMBUSH" ? 1.6 :
            1.2;
        list.push({
            x: pos.x,
            y: pos.y,
            radius: 12,
            type,
            baseSpeed,
            speed: baseSpeed,
            state: "PATROL",
            detectionRadius: 120,
            loseRadius: 150,
            angle: Math.random() * Math.PI * 2,
            patrolTimer: Math.random() * 100
        });
    }
    return list;
}
let enemies = createEnemies(1);
//UPDATE
function update() {
    if (gameState !== "PLAYING") return;
    const isMoving =keys["ArrowUp"] || keys["ArrowDown"] ||keys["ArrowLeft"] || keys["ArrowRight"];
    const currentSpeed = player.isDashing ? player.dashSpeed : player.speed;
    if (keys["ArrowUp"]) player.y -= currentSpeed;
    if (keys["ArrowDown"]) player.y += currentSpeed;
    if (keys["ArrowLeft"]) player.x -= currentSpeed;
    if (keys["ArrowRight"]) player.x += currentSpeed;
    // DASH
    if (keys["Shift"] && isMoving && !player.isDashing && player.cooldownTimer <= 0) {
        player.isDashing = true;
        player.dashTimer = player.dashDuration;
        player.cooldownTimer = player.dashCooldown;
    }
    if(player.isDashing && dashTrail.length<50){
        dashTrail.push({
            x:player.x,
            y:player.y,
            life:10
        });
    }
    // BOUNDARY
    player.x = Math.max(player.radius, Math.min(player.x, canvas.width - player.radius));
    player.y = Math.max(player.radius, Math.min(player.y, canvas.height - player.radius));
    // PLAYER VELOCITY (AMBUSH)
    playerVX = player.x - lastPlayerX;
    playerVY = player.y - lastPlayerY;
    lastPlayerX = player.x;
    lastPlayerY = player.y;
    enemies.forEach(updateEnemy);
    score = Math.floor(
    (performance.now() - startTime - pausedTime) / 1000
);
    handleDifficultyScaling();
    // DASH TIMERS
    if (player.isDashing && --player.dashTimer <= 0) player.isDashing = false;
    if (player.cooldownTimer > 0) player.cooldownTimer--;
}
//ENEMY UPDATE
function updateEnemy(enemy) {
    let dx = player.x - enemy.x;
    let dy = player.y - enemy.y;
    let distance = Math.hypot(dx, dy);
//AMBUSH LEVEL 10
    if (enemy.type === "AMBUSH" && difficultyLevel >= 10&& enemy.state==="CHASE") {
        const predictionTime = 20;
        const futureX = player.x + playerVX * predictionTime;
        const futureY = player.y + playerVY * predictionTime;
        const adx = futureX - enemy.x;
        const ady = futureY - enemy.y;
        const adist = Math.hypot(adx, ady);
        if (adist > 0) {
            enemy.x += (adx / adist) * enemy.speed;
            enemy.y += (ady / adist) * enemy.speed;
        }
    }
//FSH
    if (enemy.type !== "AMBUSH") {
        if (enemy.state === "PATROL" && distance < enemy.detectionRadius)
            enemy.state = "CHASE";

        if (enemy.state === "CHASE" && distance > enemy.loseRadius)
            enemy.state = "PATROL";

        if (enemy.state === "CHASE" && distance > 0) {
            enemy.x += (dx / distance) * enemy.speed;
            enemy.y += (dy / distance) * enemy.speed;
        }
    }
//PATROL
    if (enemy.state === "PATROL") {
        enemy.patrolTimer--;
        if (enemy.patrolTimer <= 0) {
            enemy.angle = Math.random() * Math.PI * 2;
            enemy.patrolTimer = 60 + Math.random() * 120;
        }
        enemy.x += Math.cos(enemy.angle) * enemy.speed * 0.5;
        enemy.y += Math.sin(enemy.angle) * enemy.speed * 0.5;
    }
    // BOUNDARY
    enemy.x = Math.max(enemy.radius, Math.min(enemy.x, canvas.width - enemy.radius));
    enemy.y = Math.max(enemy.radius, Math.min(enemy.y, canvas.height - enemy.radius));
    // COLLISION
    const fx = player.x - enemy.x;
    const fy = player.y - enemy.y;
    if (gameState === "PLAYING" && Math.hypot(fx, fy) < player.radius + enemy.radius) {
        gameOver();
    }
}
//DIFFICULTY
function handleDifficultyScaling() {
    if (gameState !== "PLAYING") return;
    if (score - lastDifficultyIncrease >= 10) {
        difficultyLevel++;
        lastDifficultyIncrease += 10;
        if (enemies.length < 10) {
            enemies.push(createEnemies(1)[0]);
        }
        enemies.forEach(enemy => {
            enemy.speed = Math.min(3, enemy.baseSpeed + difficultyLevel * 0.1);
        });
    }
}
//DRAW
function draw() {
    if(flashTimer>0){
        ctx.fillStyle="rgba(255,0,0,0.2)";
        ctx.fillRect(0,0,canvas.width,canvas.height);
        flashTimer--;
    }
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.font = "14px Arial";
    ctx.textAlign = "left";
    ctx.fillText(`Time: ${score}s`, UI_MARGIN, UI_MARGIN);
    ctx.fillText(`Level: ${difficultyLevel}`, UI_MARGIN, UI_MARGIN + 18);
    ctx.fillText(`Dash CD: ${Math.ceil(player.cooldownTimer / 60)}s`,
        UI_MARGIN, UI_MARGIN + 36);
    ctx.font = "12px Arial";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText("I: Info", UI_MARGIN, UI_MARGIN + 56);
    ctx.fillText("P: Pause", UI_MARGIN, UI_MARGIN + 72);
    dashTrail.forEach(t=>{
        ctx.fillStyle=`rgba(255,255,0,${t.life/10})`;
        ctx.beginPath();
        ctx.arc(t.x,t.y,player.radius,0,Math.PI*2);
        ctx.fill();
        t.life--;
    });
    for(let i=dashTrail.length-1;i>=0;i--){
        if(dashTrail[i].life<=0) dashTrail.splice(i,1);
    }
    // PLAYER
    ctx.fillStyle = player.isDashing ? "yellow" : "cyan";
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fill();
    // ENEMIES
    enemies.forEach(enemy => {
        ctx.fillStyle =
            enemy.type === "FAST" ? "orange" :
            enemy.type === "AMBUSH" ? "lime" :
            "red";
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        ctx.fill();
    });
    if(gameState==="PAUSED"){
        ctx.fillStyle="rgba(0,0,0,0.6)"
        ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle="white";
        ctx.font="28px Arial";
        ctx.textAlign="center";
        ctx.fillText("PAUSED",canvas.width/2,canvas.height/2);
        ctx.font="14px Arial";
        ctx.fillText("Press P to Resume",canvas.width/2,canvas.height/2+30);
    }
    if (gameState === "GAME_OVER") {
        ctx.fillStyle = "white";
        ctx.font = "24px Arial";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2);
        ctx.font = "16px Arial";
        ctx.fillText("Press ENTER to Restart", canvas.width / 2, canvas.height / 2 + 30);
    }
    if (gameState === "INFO") {
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.font = "26px Arial";
    ctx.fillText("HOW TO PLAY", canvas.width / 2, 80);
    ctx.font = "16px Arial";
    ctx.fillText("Survive as long as you can.", canvas.width / 2, 120);
    ctx.fillText("Enemies get faster and smarter over time.", canvas.width / 2, 145);
    ctx.font = "20px Arial";
    ctx.fillText("CONTROLS", canvas.width / 2, 190);
    ctx.font = "14px Arial";
    ctx.fillText("Arrow Keys  — Move", canvas.width / 2, 220);
    ctx.fillText("Shift        — Dash (Cooldown)", canvas.width / 2, 240);
    ctx.fillText("P            — Pause", canvas.width / 2, 260);
    ctx.fillText("I            — Toggle Info", canvas.width / 2, 280);
    ctx.font = "20px Arial";
    ctx.fillText("ENEMIES", canvas.width / 2, 320);
    ctx.font = "14px Arial";
    ctx.fillText("Red     — Normal (Chases you)", canvas.width / 2, 350);
    ctx.fillText("Orange  — Fast (Quick reaction)", canvas.width / 2, 370);
    ctx.fillText("Green   — Ambush (Predicts movement, Level 10+)", canvas.width / 2, 390);
    ctx.font = "14px Arial";
    ctx.fillText("Press I to Resume", canvas.width / 2, canvas.height - 60);
}

}
//LOOP
function gameLoop() {
    if (gameState === "PLAYING"){
        update();
    }
    draw();
    requestAnimationFrame(gameLoop);
}
gameLoop();
function gameOver() {
    gameState = "GAME_OVER";
    flashTimer=20;
}

window.addEventListener("keydown", e => {
    if (gameState === "GAME_OVER" && e.key === "Enter") resetGame();
});
function resetGame() {
    pausedTime = 0;
    pauseStartTime = 0;
    startTime = performance.now();
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    enemies = createEnemies(1);
    difficultyLevel = 1;
    lastDifficultyIncrease = 0;
    startTime = performance.now();
    gameState = "PLAYING";
}
