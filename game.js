// --- Definição da Cena Principal do Jogo ---
class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        // Variáveis do jogador
        this.player = null;
        this.cursors = null;
        this.playerSpeed = 160;
        this.maxPlayerHealth = 10;
        this.playerHealth = 10;

        // Variáveis de combate e inimigos
        this.projectiles = null;
        this.enemies = null;
        this.reticle = null;

        // Variáveis de estado do jogo
        this.wave = 0;
        this.enemySpeed = 40;
        this.baseEnemyHealth = 3;
        this.isGameOver = false;
        
        // Variáveis para controle de tiro
        this.lastFired = 0;
        this.fireRate = 200;

        // Variáveis da Interface do Utilizador (UI)
        this.waveText = null;
        this.healthBar = null;
        this.healthBarBg = null;
        
        // <<< INÍCIO: Variáveis para a barra de vida sobre o jogador >>>
        this.playerHealthBarContainer = null;
        this.playerHealthBarFill = null;
        // <<< FIM: Variáveis para a barra de vida sobre o jogador >>>
    }

    preload() {
        // --- CARREGANDO OS ARQUIVOS ---
        this.load.image('tileset_img', 'src/assets/images/background/mapatail/tilemap_packed.png');
        this.load.tilemapTiledJSON('map', 'src/assets/images/background/mapatail/map.json');
        this.load.image('player_sprite', 'src/assets/images/player/player.png');
        
        this.load.image('particle', 'https://placehold.co/4x4/ffffff/ffffff.png');
        this.load.image('spark', 'https://placehold.co/16x16/ffff00/ffff00.png');
        this.load.image('blood_particle', 'https://placehold.co/5x5/ff0000/ff0000.png');

        for (let i = 1; i <= 5; i++) {
            this.load.image(`enemy_frame_${i}`, `src/assets/images/enemy/enemy${i}.png`);
        }
        
        // <<< INÍCIO: Carregando as imagens da barra de vida (geradas internamente) >>>
        const grayPixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8d/d/PQAI9gM8aC5hBAAAAABJRU5ErkJggg==';
        const greenPixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
        this.load.image('health_bar_bg_overhead', grayPixel);
        this.load.image('health_bar_fill_overhead', greenPixel);
        // <<< FIM: Carregando as imagens da barra de vida >>>
    }

    create() {
        this.isGameOver = false;

        // --- GERAÇÃO DE TEXTURAS DINÂMICAS ---
        if (!this.textures.exists('projectile_texture')) {
            const graphics = this.add.graphics();
            graphics.fillStyle(0x00ffff, 1);
            graphics.fillCircle(4, 4, 4);
            graphics.generateTexture('projectile_texture', 8, 8);
            graphics.destroy();
        }

        if (!this.textures.exists('blood_particle')) {
            const graphics = this.add.graphics();
            graphics.fillStyle(0xff0000, 1);
            graphics.fillRect(0, 0, 5, 5);
            graphics.generateTexture('blood_particle', 5, 5);
            graphics.destroy();
        }

        // --- ANIMAÇÃO DO INIMIGO ---
        this.anims.create({
            key: 'enemy_walk',
            frames: [
                { key: 'enemy_frame_1' }, { key: 'enemy_frame_2' },
                { key: 'enemy_frame_3' }, { key: 'enemy_frame_4' },
                { key: 'enemy_frame_5' },
            ],
            frameRate: 10,
            repeat: -1
        });

        // --- CRIANDO O MAPA ---
        const map = this.make.tilemap({ key: 'map' });
        const tileset1 = map.addTilesetImage('objetos_com_colisao', 'tileset_img');
        const tileset2 = map.addTilesetImage('tilemap_packed', 'tileset_img');
        const mapScaleFactor = 4;
        const chaoLayer = map.createLayer('chao', [tileset1, tileset2], 0, 0).setScale(mapScaleFactor);
        const trilhosLayer = map.createLayer('trilhos', [tileset1, tileset2], 0, 0).setScale(mapScaleFactor);
        const vagoesLayer = map.createLayer('vagoes', [tileset1, tileset2], 0, 0).setScale(mapScaleFactor);

        const mapWidth = map.widthInPixels * mapScaleFactor;
        const mapHeight = map.heightInPixels * mapScaleFactor;

        // --- GRUPOS DE FÍSICA ---
        this.projectiles = this.physics.add.group({ classType: Projectile, runChildUpdate: true });
        this.enemies = this.physics.add.group({ classType: Enemy, runChildUpdate: true });

        // --- JOGADOR ---
        const mapCenterX = mapWidth / 2;
        const mapCenterY = mapHeight / 2;
        this.player = this.physics.add.sprite(mapCenterX, mapCenterY, 'player_sprite');
        
        this.player.setScale(1.8);
        const playerBodyRadius = this.player.width / 4;
        this.player.body.setCircle(playerBodyRadius, (this.player.width - playerBodyRadius*2)/2, (this.player.height - playerBodyRadius*2)/2);
        this.player.setCollideWorldBounds(true);

        this.add.tween({
            targets: this.player,
            scaleY: 1.65,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // <<< INÍCIO: Criando os objetos da barra de vida sobre o jogador >>>
        this.playerHealthBarContainer = this.add.container(this.player.x, this.player.y);
        let bg = this.add.image(0, 0, 'health_bar_bg_overhead').setDisplaySize(32, 5).setOrigin(0.5);
        this.playerHealthBarFill = this.add.image(0, 0, 'health_bar_fill_overhead').setDisplaySize(32, 5).setOrigin(0.5);
        this.playerHealthBarContainer.add([bg, this.playerHealthBarFill]).setDepth(10);
        // <<< FIM: Criando os objetos da barra de vida >>>

        // --- MIRA (RETÍCULO) ---
        this.reticle = this.physics.add.sprite(this.player.x, this.player.y, null).setAlpha(0);
        this.reticle.body.setAllowGravity(false);

        // --- COLISÃO ---
        trilhosLayer.setCollisionByProperty({ colider: true });
        vagoesLayer.setCollisionByProperty({ colider: true });

        this.physics.world.setBounds(0, 0, mapWidth, mapHeight);
        
        this.physics.add.collider(this.player, trilhosLayer);
        this.physics.add.collider(this.player, vagoesLayer);
        this.physics.add.collider(this.enemies, vagoesLayer);

        this.physics.add.collider(this.projectiles, trilhosLayer, (projectile) => projectile.destroy());
        this.physics.add.collider(this.projectiles, vagoesLayer, (projectile) => projectile.destroy());
        this.physics.add.overlap(this.projectiles, this.enemies, this.handleProjectileEnemyCollision, null, this);
        this.physics.add.overlap(this.player, this.enemies, this.handlePlayerEnemyCollision, null, this);
        
        // --- CÂMARA ---
        this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
        this.cameras.main.startFollow(this.player, true);
        this.cameras.main.setZoom(1.5);

        // --- INTERFACE DO UTILIZADOR (UI) ---
        this.createHUD();
        
        // --- CONTROLES ---
        this.cursors = this.input.keyboard.addKeys('W,A,S,D');
        
        this.spawnWave();
    }
    
    createHUD() {
        const barWidth = 200;
        const barHeight = 20;
        const margin = 15;
    
        this.healthBarBg = this.add.graphics();
        this.healthBarBg.fillStyle(0x3d3d3d, 1);
        this.healthBarBg.fillRect(margin, margin, barWidth, barHeight);
        this.healthBarBg.setScrollFactor(0).setDepth(1);
    
        this.healthBar = this.add.graphics();
        this.healthBar.setScrollFactor(0).setDepth(1);
    
        this.waveText = this.add.text(margin, margin + barHeight + 5, 'Onda: 0', { 
            fontSize: '20px', 
            fill: '#ffffff', 
            stroke: '#000000', 
            strokeThickness: 4 
        });
        this.waveText.setScrollFactor(0).setOrigin(0, 0).setDepth(1);
    
        this.updateHealthBar();
    }

    updateHealthBar() {
        // Barra de vida no canto da tela
        this.healthBar.clear();
        this.healthBar.fillStyle(0x00ff00, 1);
        const healthPercentage = this.playerHealth / this.maxPlayerHealth;
        const currentBarWidth = 200 * healthPercentage;
        if (healthPercentage > 0) {
            this.healthBar.fillRect(15, 15, currentBarWidth, 20);
        }

        // <<< INÍCIO: Atualizando o preenchimento da barra de vida sobre o jogador >>>
        this.playerHealthBarFill.scaleX = Math.max(0, healthPercentage);
        // <<< FIM: Atualizando o preenchimento da barra de vida >>>
    }

    update(time, delta) {
        if (this.isGameOver) return;

        const pointer = this.input.activePointer;
        this.reticle.setPosition(pointer.worldX, pointer.worldY);

        this.player.setVelocity(0);
        if (this.cursors.A.isDown) this.player.setVelocityX(-this.playerSpeed);
        else if (this.cursors.D.isDown) this.player.setVelocityX(this.playerSpeed);
        if (this.cursors.W.isDown) this.player.setVelocityY(-this.playerSpeed);
        else if (this.cursors.S.isDown) this.player.setVelocityY(this.playerSpeed);
        
        if (this.player.x < this.reticle.x) this.player.setFlipX(false);
        else this.player.setFlipX(true);
        
        // <<< INÍCIO: Atualizando posição e visibilidade da barra de vida sobre o jogador >>>
        this.playerHealthBarContainer.setPosition(this.player.x, this.player.y - this.player.height * 1.2);
        this.playerHealthBarContainer.setVisible(this.playerHealth < this.maxPlayerHealth && this.playerHealth > 0);
        // <<< FIM: Atualizando posição e visibilidade >>>

        if (pointer.isDown) {
            if (time > this.lastFired) {
                const projectile = this.projectiles.get(this.player.x, this.player.y, 'projectile_texture');
                if (projectile) {
                    projectile.fire(this.reticle.x, this.reticle.y);
                    this.lastFired = time + this.fireRate;
                }
            }
        }

        if (this.enemies.countActive(true) === 0) {
            this.time.delayedCall(1000, this.spawnWave, [], this); // Atraso para a próxima onda
        }
    }

    spawnWave() {
        if (this.isGameOver || this.enemies.countActive(true) > 0) return; // Evita ondas sobrepostas
        
        this.wave++;
        this.waveText.setText(`Onda: ${this.wave}`);
        this.enemySpeed += 5;
        const enemiesToSpawn = 1 + this.wave; // Lógica original da sua versão funcional
        
        const currentEnemyHealth = this.baseEnemyHealth + (this.wave - 1);

        for (let i = 0; i < enemiesToSpawn; i++) {
            const enemy = this.enemies.get(undefined, undefined, 'enemy_frame_1');
            if (enemy) {
                enemy.spawn(this.player, this.enemySpeed, currentEnemyHealth);
            }
        }
    }

    handleProjectileEnemyCollision(projectile, enemy) {
        if (!enemy.active) return;
        
        projectile.destroy();
        enemy.takeDamage(1);
    }

    handlePlayerEnemyCollision(player, enemy) {
        if (this.isGameOver || !enemy.active) return;
        
        this.playerHealth--;
        this.updateHealthBar();
        enemy.destroy();

        this.cameras.main.shake(150, 0.015);
        this.cameras.main.flash(150, 255, 0, 0);

        if (this.playerHealth <= 0) {
            this.isGameOver = true;
            this.physics.pause();
            this.player.setTint(0xff0000);
            
            const centerX = this.cameras.main.worldView.x + this.cameras.main.width / 2;
            const centerY = this.cameras.main.worldView.y + this.cameras.main.height / 2;

            this.add.text(centerX, centerY - 50, 'FIM DE JOGO', { fontSize: '48px', fill: '#ffffff', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5).setScrollFactor(0).setDepth(2);
            
            const restartButton = this.add.text(centerX, centerY + 50, 'Reiniciar', { fontSize: '32px', fill: '#0f0', backgroundColor: '#333', padding: { x: 20, y: 10 } })
                .setOrigin(0.5)
                .setInteractive()
                .setScrollFactor(0)
                .setDepth(2);

            restartButton.on('pointerover', () => restartButton.setStyle({ fill: '#fff' }));
            restartButton.on('pointerout', () => restartButton.setStyle({ fill: '#0f0' }));
            restartButton.on('pointerdown', () => {
                // Reiniciando as variáveis para um novo jogo
                this.wave = 0;
                this.enemySpeed = 40;
                this.playerHealth = this.maxPlayerHealth; 
                this.scene.restart();
            });
        }
    }
}

// --- CLASSE DO PROJÉTIL ---
class Projectile extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'projectile_texture');
        
        this.projectileSpeed = 300;

        this.emitter = this.scene.add.particles(0, 0, 'particle', {
            speed: 50, scale: { start: 0.5, end: 0 },
            blendMode: 'ADD', lifespan: 300
        });
        
        this.emitter.startFollow(this);
    }

    fire(targetX, targetY) {
        this.body.setCircle(8);
        this.setActive(true).setVisible(true);
        this.scene.physics.moveTo(this, targetX, targetY, this.projectileSpeed);
    }

    destroy(fromScene) {
        if (this.emitter) this.emitter.destroy();
        super.destroy(fromScene);
    }
    
    update() {
        // Destroi o projétil se sair dos limites do mundo para economizar memória
        if (!Phaser.Geom.Rectangle.Overlaps(this.scene.physics.world.bounds, this.getBounds())) {
            this.destroy();
        }
    }
}

// --- CLASSE DO INIMIGO ---
class Enemy extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'enemy_frame_1');
        this.breathTween = null;
        this.hp = 3;
        this.maxHp = 3;

        this.targetOffsetX = 0;
        this.targetOffsetY = 0;
        this.recalculatePathTimer = 0;
    }

    spawn(player, speed, health) {
        this.setActive(true).setVisible(true);
        
        this.maxHp = health;
        this.hp = this.maxHp;

        this.player = player;
        this.speed = speed;
        
        this.setTexture('enemy_frame_1');
        this.setScale(0.10); 
        this.setCollideWorldBounds(true);
        this.body.setBounce(1, 1);
        
        const bodyRadius = this.displayWidth * 0.5;
        this.body.setCircle(bodyRadius, this.width * 0.5 - bodyRadius, this.height * 0.5 - bodyRadius);

        this.play('enemy_walk');

        if (this.breathTween) this.breathTween.resume();
        else {
            this.breathTween = this.scene.add.tween({
                targets: this, scaleY: this.scaleY * 0.95,
                duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
            });
        }

        const spawnEdge = Phaser.Math.Between(0, 3);
        const mapWidth = this.scene.physics.world.bounds.width;
        const mapHeight = this.scene.physics.world.bounds.height;
        let spawnX, spawnY;

        if (spawnEdge === 0) { spawnX = 0; spawnY = Phaser.Math.Between(0, mapHeight); }
        else if (spawnEdge === 1) { spawnX = mapWidth; spawnY = Phaser.Math.Between(0, mapHeight); }
        else if (spawnEdge === 2) { spawnY = 0; spawnX = Phaser.Math.Between(0, mapWidth); }
        else { spawnY = mapHeight; spawnX = Phaser.Math.Between(0, mapWidth); }

        this.setPosition(spawnX, spawnY);
    }

    takeDamage(damage) {
        if (!this.active) return;
        this.hp -= damage;
        if (this.hp <= 0) {
            this.scene.cameras.main.shake(200, 0.02);

            const deathExplosion = this.scene.add.particles(0, 0, 'spark', {
                speed: { min: 100, max: 200 }, angle: { min: 0, max: 360 },
                scale: { start: 0.3, end: 0 }, blendMode: 'ADD',
                lifespan: 500, gravityY: 300, emitting: false
            });
            deathExplosion.emitParticleAt(this.x, this.y, 30);
            this.scene.time.delayedCall(500, () => deathExplosion.destroy());
            this.destroy();
        } else {
            this.setTint(0xff0000); // Mudei para vermelho para indicar dano
            this.scene.time.delayedCall(100, () => { this.clearTint(); });

            const bloodEmitter = this.scene.add.particles(0, 0, 'blood_particle', {
                speed: { min: 50, max: 250 },
                angle: { min: 180, max: 360 },
                scale: { start: 1, end: 0 },
                lifespan: 1000,
                gravityY: 800,
                emitting: false
            });
            bloodEmitter.emitParticleAt(this.x, this.y, 15);
            this.scene.time.delayedCall(1200, () => {
                bloodEmitter.destroy();
            });
        }
    }
    
    destroy(fromScene) {
        if (this.breathTween) this.breathTween.stop();
        super.destroy(fromScene);
    }

    update(time, delta) {
        if (this.active && this.player) {
            // Lógica de movimento
            this.recalculatePathTimer -= delta;
            if (this.recalculatePathTimer <= 0) {
                this.recalculatePathTimer = 1000;
                this.targetOffsetX = Phaser.Math.Between(-60, 60);
                this.targetOffsetY = Phaser.Math.Between(-60, 60);
            }
            const targetX = this.player.x + this.targetOffsetX;
            const targetY = this.player.y + this.targetOffsetY;
            this.scene.physics.moveTo(this, targetX, targetY, this.speed);

            // Correção do bug visual de "flip"
            const flipThreshold = 2; 
            if (this.body.velocity.x < -flipThreshold) {
                this.setFlipX(true);
            } else if (this.body.velocity.x > flipThreshold) {
                this.setFlipX(false);
            }
        }
    }
}

// --- Configurações Gerais do Jogo (sem alterações) ---
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false // Mudei para false para uma aparência mais limpa
        }
    },
    pixelArt: true, // Adicionado para melhor visualização dos sprites
    scene: [
        GameScene
    ]
};

const game = new Phaser.Game(config);