/**
 * NEON PONG - Next-Gen Cyberpunk Pong Game Engine
 * Features: Web Audio API synth, Canvas Particle System, Smart AI, Power-up mechanics.
 */

// --- Audio Synth Engine (Web Audio API) ---
class SoundEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTone(freq, type = 'sine', duration = 0.1, startVol = 0.3) {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            
            gain.gain.setValueAtTime(startVol, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {
            // Audio context errors ignored gracefully
        }
    }

    playHit(pitch = 1) {
        this.playTone(320 * pitch, 'triangle', 0.08, 0.4);
    }

    playWall() {
        this.playTone(180, 'sine', 0.06, 0.25);
    }

    playScore() {
        if (!this.enabled) return;
        this.playTone(440, 'square', 0.1, 0.3);
        setTimeout(() => this.playTone(554.37, 'square', 0.1, 0.3), 100);
        setTimeout(() => this.playTone(659.25, 'square', 0.2, 0.4), 200);
    }

    playPowerup() {
        if (!this.enabled) return;
        this.playTone(523.25, 'sine', 0.08, 0.3);
        setTimeout(() => this.playTone(659.25, 'sine', 0.08, 0.3), 80);
        setTimeout(() => this.playTone(783.99, 'sine', 0.15, 0.4), 160);
    }

    playWin() {
        if (!this.enabled) return;
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];
        notes.forEach((n, idx) => {
            setTimeout(() => this.playTone(n, 'triangle', 0.2, 0.4), idx * 100);
        });
    }
}

const audio = new SoundEngine();

// --- Particle System ---
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 4 + 2;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 6 + 1;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.alpha = 1;
        this.decay = Math.random() * 0.03 + 0.015;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= this.decay;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.alpha);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// --- Power-up Object ---
class PowerUp {
    constructor(w, h) {
        this.x = w * 0.3 + Math.random() * (w * 0.4);
        this.y = 50 + Math.random() * (h - 100);
        this.radius = 16;
        this.type = ['speed', 'expand', 'shield', 'freeze'][Math.floor(Math.random() * 4)];
        this.colorMap = {
            speed: '#ff0844',
            expand: '#00ff87',
            shield: '#00f2fe',
            freeze: '#e0c3fc'
        };
        this.symbolMap = {
            speed: '⚡',
            expand: '↕️',
            shield: '🛡️',
            freeze: '❄️'
        };
        this.color = this.colorMap[this.type];
        this.symbol = this.symbolMap[this.type];
        this.active = true;
        this.pulse = 0;
    }

    draw(ctx) {
        if (!this.active) return;
        this.pulse += 0.05;
        const currentR = this.radius + Math.sin(this.pulse) * 2;

        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fillStyle = 'rgba(10, 15, 25, 0.85)';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.symbol, this.x, this.y);
        ctx.restore();
    }
}

// --- Main Game Class ---
class NeonPongGame {
    constructor() {
        this.canvas = document.getElementById('pongCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Settings State
        this.mode = 'ai'; // 'ai' or 'pvp'
        this.difficulty = 'medium'; // easy, medium, hard, insane
        this.variant = 'classic'; // classic, powerups
        this.theme = 'cyber';

        // Match State
        this.isPlaying = false;
        this.isPaused = false;
        this.targetScore = 10;
        this.p1Score = 0;
        this.p2Score = 0;

        // Stats tracking
        this.currentRally = 0;
        this.maxRally = 0;
        this.maxBallSpeed = 0;
        this.startTime = 0;

        // Visual Entities
        this.paddleWidth = 14;
        this.paddleHeight = 100;
        this.p1 = { x: 30, y: 0, w: 14, h: 100, vy: 0, speed: 8, shield: false, frozen: false };
        this.p2 = { x: 0, y: 0, w: 14, h: 100, vy: 0, speed: 8, shield: false, frozen: false };
        
        this.balls = [];
        this.particles = [];
        this.powerUps = [];

        this.keys = {};
        this.screenShake = 0;

        this.initDOM();
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.setupEvents();
    }

    initDOM() {
        this.startMenu = document.getElementById('startMenu');
        this.pauseMenu = document.getElementById('pauseMenu');
        this.gameOverMenu = document.getElementById('gameOverMenu');
        this.overlayContainer = document.getElementById('overlayContainer');
        this.hudStats = document.getElementById('hudStats');
        this.pauseBtn = document.getElementById('pauseBtn');
        
        this.p1ScoreEl = document.getElementById('p1Score');
        this.p2ScoreEl = document.getElementById('p2Score');
        this.p1NameEl = document.getElementById('p1Name');
        this.p2NameEl = document.getElementById('p2Name');

        // Theme colors lookup
        this.themeColors = {
            cyber: { p1: '#00f2fe', p2: '#ff0844', ball: '#ffffff', net: 'rgba(0, 242, 254, 0.2)' },
            synthwave: { p1: '#ffb199', p2: '#ff0844', ball: '#ffe600', net: 'rgba(255, 8, 68, 0.2)' },
            matrix: { p1: '#00ff87', p2: '#60efff', ball: '#ffffff', net: 'rgba(0, 255, 135, 0.2)' },
            gold: { p1: '#f6d365', p2: '#fda085', ball: '#ffffff', net: 'rgba(246, 211, 101, 0.2)' }
        };
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;

        this.p1.x = 30;
        this.p2.x = this.canvas.width - 30 - this.p2.w;

        if (!this.isPlaying) {
            this.p1.y = (this.canvas.height - this.p1.h) / 2;
            this.p2.y = (this.canvas.height - this.p2.h) / 2;
        }
    }

    setupEvents() {
        // Controls
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
                if (this.isPlaying) this.togglePause();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });

        // Mouse controls for P1
        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.isPlaying || this.isPaused) return;
            const rect = this.canvas.getBoundingClientRect();
            const mouseY = e.clientY - rect.top;
            this.p1.y = mouseY - this.p1.h / 2;
            this.clampPaddles();
        });

        // Touch controls
        this.canvas.addEventListener('touchmove', (e) => {
            if (!this.isPlaying || this.isPaused) return;
            const rect = this.canvas.getBoundingClientRect();
            const touchY = e.touches[0].clientY - rect.top;
            this.p1.y = touchY - this.p1.h / 2;
            this.clampPaddles();
            e.preventDefault();
        }, { passive: false });

        // Menu UI Handlers
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.mode = btn.dataset.mode;
                document.getElementById('diffSelection').style.display = (this.mode === 'ai') ? 'block' : 'none';
            });
        });

        document.querySelectorAll('.diff-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.difficulty = btn.dataset.diff;
            });
        });

        document.querySelectorAll('.variant-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.variant = btn.dataset.variant;
            });
        });

        document.querySelectorAll('.theme-opt').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.theme-opt').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.theme = btn.dataset.theme;
                document.body.setAttribute('data-theme', this.theme);
            });
        });

        document.getElementById('startGameBtn').addEventListener('click', () => {
            audio.init();
            this.startMatch();
        });

        document.getElementById('resumeBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        
        document.getElementById('restartBtn').addEventListener('click', () => {
            this.startMatch();
        });

        document.getElementById('quitBtn').addEventListener('click', () => {
            this.returnToMenu();
        });

        document.getElementById('playAgainBtn').addEventListener('click', () => {
            this.startMatch();
        });

        document.getElementById('returnMenuBtn').addEventListener('click', () => {
            this.returnToMenu();
        });

        document.getElementById('audioToggleBtn').addEventListener('click', () => {
            audio.enabled = !audio.enabled;
            document.getElementById('audioIcon').textContent = audio.enabled ? '🔊' : '🔇';
        });
    }

    startMatch() {
        this.isPlaying = true;
        this.isPaused = false;
        this.p1Score = 0;
        this.p2Score = 0;
        this.currentRally = 0;
        this.maxRally = 0;
        this.maxBallSpeed = 0;
        this.startTime = Date.now();

        this.updateHUD();
        this.hudStats.style.display = 'flex';
        this.pauseBtn.style.display = 'flex';
        this.overlayContainer.classList.add('hidden');
        this.startMenu.classList.add('hidden');
        this.pauseMenu.classList.add('hidden');
        this.gameOverMenu.classList.add('hidden');

        this.p1NameEl.textContent = 'PLAYER 1';
        this.p2NameEl.textContent = (this.mode === 'ai') ? `CPU (${this.difficulty.toUpperCase()})` : 'PLAYER 2';

        this.resetRound(1);
        requestAnimationFrame(() => this.loop());
    }

    resetRound(server = 1) {
        this.p1.h = 100;
        this.p2.h = 100;
        this.p1.shield = false;
        this.p2.shield = false;
        this.p1.frozen = false;
        this.p2.frozen = false;

        const baseSpeed = 7;
        const angle = (Math.random() * 0.8 - 0.4); // radian angle offset
        const dir = server === 1 ? 1 : -1;

        this.balls = [{
            x: this.canvas.width / 2,
            y: this.canvas.height / 2,
            radius: 8,
            vx: Math.cos(angle) * baseSpeed * dir,
            vy: Math.sin(angle) * baseSpeed,
            speed: baseSpeed,
            trail: []
        }];

        this.powerUps = [];
        this.currentRally = 0;
    }

    togglePause() {
        if (!this.isPlaying) return;
        this.isPaused = !this.isPaused;
        if (this.isPaused) {
            this.overlayContainer.classList.remove('hidden');
            this.pauseMenu.classList.remove('hidden');
        } else {
            this.overlayContainer.classList.add('hidden');
            this.pauseMenu.classList.add('hidden');
            requestAnimationFrame(() => this.loop());
        }
    }

    returnToMenu() {
        this.isPlaying = false;
        this.isPaused = false;
        this.hudStats.style.display = 'none';
        this.pauseBtn.style.display = 'none';
        this.overlayContainer.classList.remove('hidden');
        this.startMenu.classList.remove('hidden');
        this.pauseMenu.classList.add('hidden');
        this.gameOverMenu.classList.add('hidden');
    }

    triggerGameOver(winner) {
        this.isPlaying = false;
        audio.playWin();

        const matchDurationSec = Math.floor((Date.now() - this.startTime) / 1000);
        document.getElementById('winnerText').textContent = `${winner.toUpperCase()} WINS!`;
        document.getElementById('finalScoreText').textContent = `Final Score: ${this.p1Score} - ${this.p2Score}`;
        document.getElementById('statMaxRally').textContent = this.maxRally;
        document.getElementById('statSpeed').textContent = `${Math.round(this.maxBallSpeed * 12)} mph`;
        document.getElementById('statDuration').textContent = `${matchDurationSec}s`;

        this.overlayContainer.classList.remove('hidden');
        this.gameOverMenu.classList.remove('hidden');
    }

    clampPaddles() {
        this.p1.y = Math.max(10, Math.min(this.canvas.height - this.p1.h - 10, this.p1.y));
        this.p2.y = Math.max(10, Math.min(this.canvas.height - this.p2.h - 10, this.p2.y));
    }

    updateAI() {
        if (this.mode !== 'ai' || this.balls.length === 0) return;
        
        // Find nearest ball moving towards CPU
        let targetBall = this.balls[0];
        let minDist = Infinity;
        for (let b of this.balls) {
            if (b.vx > 0 && b.x < minDist) {
                targetBall = b;
                minDist = b.x;
            }
        }

        const paddleCenter = this.p2.y + this.p2.h / 2;
        let targetY = targetBall.y;

        // Difficulty variations
        if (this.difficulty === 'easy') {
            if (Math.random() < 0.25) return; // Reaction delay
            targetY += (Math.random() - 0.5) * 60;
        } else if (this.difficulty === 'medium') {
            targetY += (Math.random() - 0.5) * 30;
        } else if (this.difficulty === 'hard') {
            // Predictive aiming
            const timeToReach = (this.p2.x - targetBall.x) / (targetBall.vx || 1);
            if (timeToReach > 0) {
                targetY = targetBall.y + targetBall.vy * timeToReach;
            }
        } else if (this.difficulty === 'insane') {
            // Unbeatable precision
            const timeToReach = (this.p2.x - targetBall.x) / (targetBall.vx || 1);
            if (timeToReach > 0) {
                targetY = targetBall.y + targetBall.vy * timeToReach;
            }
        }

        const diff = targetY - paddleCenter;
        const step = this.p2.frozen ? 2 : (this.difficulty === 'insane' ? 12 : 7);

        if (Math.abs(diff) > 8) {
            this.p2.y += Math.sign(diff) * Math.min(Math.abs(diff), step);
        }
    }

    updatePhysics() {
        // Player 1 Keyboard movement
        const p1Speed = this.p1.frozen ? 3 : 8;
        if (this.keys['w']) this.p1.y -= p1Speed;
        if (this.keys['s']) this.p1.y += p1Speed;

        // Player 2 Keyboard movement (PVP)
        if (this.mode === 'pvp') {
            const p2Speed = this.p2.frozen ? 3 : 8;
            if (this.keys['arrowup']) this.p2.y -= p2Speed;
            if (this.keys['arrowdown']) this.p2.y += p2Speed;
        } else {
            this.updateAI();
        }

        this.clampPaddles();

        // Spawn Power-ups periodically in variant mode
        if (this.variant === 'powerups' && Math.random() < 0.003 && this.powerUps.length < 2) {
            this.powerUps.push(new PowerUp(this.canvas.width, this.canvas.height));
        }

        // Update Balls
        for (let i = this.balls.length - 1; i >= 0; i--) {
            const b = this.balls[i];

            // Store trail
            b.trail.push({ x: b.x, y: b.y });
            if (b.trail.length > 10) b.trail.shift();

            b.x += b.vx;
            b.y += b.vy;

            // Max Speed Tracking
            const currentSpeed = Math.hypot(b.vx, b.vy);
            if (currentSpeed > this.maxBallSpeed) this.maxBallSpeed = currentSpeed;

            // Top / Bottom Wall Collision
            if (b.y - b.radius <= 0) {
                b.y = b.radius;
                b.vy *= -1;
                audio.playWall();
                this.spawnParticles(b.x, b.y, '#ffffff', 6);
            } else if (b.y + b.radius >= this.canvas.height) {
                b.y = this.canvas.height - b.radius;
                b.vy *= -1;
                audio.playWall();
                this.spawnParticles(b.x, b.y, '#ffffff', 6);
            }

            // Paddle 1 Collision
            if (b.vx < 0 && b.x - b.radius <= this.p1.x + this.p1.w && b.x + b.radius >= this.p1.x) {
                if (b.y >= this.p1.y - b.radius && b.y <= this.p1.y + this.p1.h + b.radius) {
                    this.handlePaddleHit(b, this.p1, 1);
                }
            }

            // Paddle 2 Collision
            if (b.vx > 0 && b.x + b.radius >= this.p2.x && b.x - b.radius <= this.p2.x + this.p2.w) {
                if (b.y >= this.p2.y - b.radius && b.y <= this.p2.y + this.p2.h + b.radius) {
                    this.handlePaddleHit(b, this.p2, 2);
                }
            }

            // Power-up Collision
            for (let pIdx = this.powerUps.length - 1; pIdx >= 0; pIdx--) {
                const p = this.powerUps[pIdx];
                if (p.active && Math.hypot(b.x - p.x, b.y - p.y) < b.radius + p.radius) {
                    p.active = false;
                    audio.playPowerup();
                    this.applyPowerup(p.type, b.vx > 0 ? 1 : 2);
                    this.spawnParticles(p.x, p.y, p.color, 16);
                }
            }

            // Scoring Goals
            if (b.x < 0) {
                if (this.p1.shield) {
                    this.p1.shield = false;
                    b.vx *= -1;
                    b.x = 20;
                    audio.playHit();
                } else {
                    this.handleGoal(2, i);
                }
            } else if (b.x > this.canvas.width) {
                if (this.p2.shield) {
                    this.p2.shield = false;
                    b.vx *= -1;
                    b.x = this.canvas.width - 20;
                    audio.playHit();
                } else {
                    this.handleGoal(1, i);
                }
            }
        }

        // Update Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update();
            if (this.particles[i].alpha <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Screen Shake decay
        if (this.screenShake > 0) this.screenShake -= 0.5;
    }

    handlePaddleHit(b, paddle, playerNum) {
        audio.playHit(1 + Math.random() * 0.2);
        this.currentRally++;
        if (this.currentRally > this.maxRally) this.maxRally = this.currentRally;

        // Calculate bounce angle offset based on impact point
        const relativeIntersectY = (paddle.y + paddle.h / 2) - b.y;
        const normalizedIntersect = relativeIntersectY / (paddle.h / 2);
        const maxBounceAngle = Math.PI / 3; // 60 degrees max
        const bounceAngle = normalizedIntersect * maxBounceAngle;

        // Speed acceleration on hit
        b.speed = Math.min(b.speed * 1.05, 18);
        const dir = playerNum === 1 ? 1 : -1;

        b.vx = dir * b.speed * Math.cos(bounceAngle);
        b.vy = -b.speed * Math.sin(bounceAngle);

        const theme = this.themeColors[this.theme];
        const hitColor = playerNum === 1 ? theme.p1 : theme.p2;
        this.spawnParticles(b.x, b.y, hitColor, 12);
        this.screenShake = 3;
    }

    applyPowerup(type, playerNum) {
        const target = playerNum === 1 ? this.p1 : this.p2;
        const opponent = playerNum === 1 ? this.p2 : this.p1;

        if (type === 'speed') {
            this.balls.forEach(b => { b.speed *= 1.25; b.vx *= 1.25; });
        } else if (type === 'expand') {
            target.h = 160;
            setTimeout(() => { target.h = 100; }, 8000);
        } else if (type === 'shield') {
            target.shield = true;
        } else if (type === 'freeze') {
            opponent.frozen = true;
            setTimeout(() => { opponent.frozen = false; }, 4000);
        }
    }

    handleGoal(scorer, ballIndex) {
        audio.playScore();
        this.screenShake = 10;
        const theme = this.themeColors[this.theme];
        this.spawnParticles(
            scorer === 1 ? this.canvas.width : 0, 
            this.canvas.height / 2, 
            scorer === 1 ? theme.p1 : theme.p2, 
            40
        );

        this.balls.splice(ballIndex, 1);

        if (scorer === 1) this.p1Score++;
        else this.p2Score++;

        this.updateHUD();

        if (this.p1Score >= this.targetScore) {
            this.triggerGameOver('Player 1');
        } else if (this.p2Score >= this.targetScore) {
            this.triggerGameOver(this.mode === 'ai' ? 'CPU' : 'Player 2');
        } else {
            if (this.balls.length === 0) {
                setTimeout(() => this.resetRound(scorer === 1 ? 2 : 1), 600);
            }
        }
    }

    updateHUD() {
        this.p1ScoreEl.textContent = this.p1Score;
        this.p2ScoreEl.textContent = this.p2Score;
    }

    spawnParticles(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    draw() {
        this.ctx.save();

        // Apply Screen Shake
        if (this.screenShake > 0) {
            const rx = (Math.random() - 0.5) * this.screenShake;
            const ry = (Math.random() - 0.5) * this.screenShake;
            this.ctx.translate(rx, ry);
        }

        // Clear Canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const theme = this.themeColors[this.theme];

        // Draw Center Court Line
        this.ctx.strokeStyle = theme.net;
        this.ctx.lineWidth = 4;
        this.ctx.setLineDash([12, 12]);
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width / 2, 0);
        this.ctx.lineTo(this.canvas.width / 2, this.canvas.height);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Draw Power-ups
        this.powerUps.forEach(p => p.draw(this.ctx));

        // Draw Paddles
        this.drawPaddle(this.p1, theme.p1);
        this.drawPaddle(this.p2, theme.p2);

        // Draw Balls & Trails
        this.balls.forEach(b => {
            // Trail
            b.trail.forEach((pt, idx) => {
                const alpha = (idx / b.trail.length) * 0.4;
                this.ctx.save();
                this.ctx.globalAlpha = alpha;
                this.ctx.fillStyle = theme.p1;
                this.ctx.beginPath();
                this.ctx.arc(pt.x, pt.y, b.radius * (idx / b.trail.length), 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.restore();
            });

            // Ball Body
            this.ctx.save();
            this.ctx.shadowBlur = 16;
            this.ctx.shadowColor = theme.ball;
            this.ctx.fillStyle = theme.ball;
            this.ctx.beginPath();
            this.ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });

        // Draw Particles
        this.particles.forEach(p => p.draw(this.ctx));

        this.ctx.restore();
    }

    drawPaddle(p, color) {
        this.ctx.save();
        this.ctx.shadowBlur = 12;
        this.ctx.shadowColor = color;
        this.ctx.fillStyle = p.frozen ? '#e0c3fc' : color;

        // Rounded paddle box
        const r = 6;
        this.ctx.beginPath();
        this.ctx.roundRect(p.x, p.y, p.w, p.h, r);
        this.ctx.fill();

        // Draw Shield barrier if active
        if (p.shield) {
            this.ctx.strokeStyle = '#00f2fe';
            this.ctx.lineWidth = 3;
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = '#00f2fe';
            this.ctx.beginPath();
            const sx = p.x < this.canvas.width / 2 ? p.x - 10 : p.x + p.w + 10;
            this.ctx.moveTo(sx, p.y - 10);
            this.ctx.lineTo(sx, p.y + p.h + 10);
            this.ctx.stroke();
        }

        this.ctx.restore();
    }

    loop() {
        if (!this.isPlaying || this.isPaused) return;

        this.updatePhysics();
        this.draw();

        requestAnimationFrame(() => this.loop());
    }
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
    window.game = new NeonPongGame();
});
