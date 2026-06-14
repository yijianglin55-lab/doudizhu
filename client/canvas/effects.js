/**
 * Canvas特效动画模块
 * 使用requestAnimationFrame实现流畅的特效动画
 */

const Effects = {
  // Canvas上下文
  ctx: null,

  // Canvas元素
  canvas: null,

  // 动画队列
  animations: [],

  // 是否正在运行
  isRunning: false,

  /**
   * 初始化Canvas
   * @param {string} canvasId - Canvas元素ID
   */
  init(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.error('Canvas元素不存在:', canvasId);
      return;
    }

    this.ctx = this.canvas.getContext('2d');
    this.resize();

    // 监听窗口大小变化
    window.addEventListener('resize', () => this.resize());
  },

  /**
   * 调整Canvas尺寸
   */
  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  /**
   * 开始动画循环
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.animate();
  },

  /**
   * 停止动画循环
   */
  stop() {
    this.isRunning = false;
  },

  /**
   * 动画主循环（使用requestAnimationFrame）
   */
  animate() {
    if (!this.isRunning) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 更新并绘制所有动画
    this.animations = this.animations.filter(anim => {
      anim.update();
      anim.draw(this.ctx);
      return !anim.isFinished;
    });

    requestAnimationFrame(() => this.animate());
  },

  /**
   * 炸弹特效
   * @param {number} x - 中心X坐标
   * @param {number} y - 中心Y坐标
   */
  bombEffect(x, y) {
    // 屏幕震动
    this.screenShake();

    // 闪光
    this.flashEffect();

    // 粒子爆炸
    this.particleExplosion(x, y, '#ff6b00', 30);
    this.particleExplosion(x, y, '#ffd700', 20);

    // 爆炸圈
    this.shockwave(x, y);
  },

  /**
   * 王炸特效
   * @param {number} x
   * @param {number} y
   */
  rocketEffect(x, y) {
    this.screenShake(800);
    this.flashEffect('#ff0000');

    // 大量粒子
    this.particleExplosion(x, y, '#ff0000', 40);
    this.particleExplosion(x, y, '#ffd700', 30);
    this.particleExplosion(x, y, '#ff6b00', 20);

    this.shockwave(x, y, 300);

    // 倍数飘字
    this.floatingText('王炸！×2', x, y - 50, '#ff0000', 40);
  },

  /**
   * 粒子爆炸效果
   * @param {number} x - 中心X
   * @param {number} y - 中心Y
   * @param {string} color - 颜色
   * @param {number} count - 粒子数量
   */
  particleExplosion(x, y, color, count = 20) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 2 + Math.random() * 5;
      const size = 2 + Math.random() * 4;

      this.animations.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size,
        color,
        alpha: 1,
        life: 60 + Math.random() * 40,
        maxLife: 100,
        isFinished: false,
        update() {
          this.x += this.vx;
          this.y += this.vy;
          this.vy += 0.1; // 重力
          this.vx *= 0.98; // 阻力
          this.life--;
          this.alpha = this.life / this.maxLife;
          if (this.life <= 0) this.isFinished = true;
        },
        draw(ctx) {
          ctx.save();
          ctx.globalAlpha = this.alpha;
          ctx.fillStyle = this.color;
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        },
      });
    }

    this.start();
  },

  /**
   * 冲击波效果
   * @param {number} x
   * @param {number} y
   * @param {number} maxRadius
   */
  shockwave(x, y, maxRadius = 200) {
    this.animations.push({
      x, y,
      radius: 10,
      maxRadius,
      alpha: 1,
      lineWidth: 3,
      isFinished: false,
      update() {
        this.radius += 8;
        this.alpha = 1 - (this.radius / this.maxRadius);
        if (this.radius >= this.maxRadius) this.isFinished = true;
      },
      draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = this.lineWidth;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      },
    });

    this.start();
  },

  /**
   * 屏幕震动效果
   * @param {number} duration
   */
  screenShake(duration = 500) {
    const gameTable = document.querySelector('.game-table');
    if (!gameTable) return;

    gameTable.classList.add('screen-shake');
    setTimeout(() => {
      gameTable.classList.remove('screen-shake');
    }, duration);
  },

  /**
   * 闪光效果
   * @param {string} color
   */
  flashEffect(color = '#ff6b00') {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: ${color}; opacity: 0.4; z-index: 998;
      pointer-events: none; transition: opacity 0.5s ease;
    `;
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 500);
    });
  },

  /**
   * 飘字效果
   * @param {string} text
   * @param {number} x
   * @param {number} y
   * @param {string} color
   * @param {number} fontSize
   */
  floatingText(text, x, y, color = '#ffd700', fontSize = 32) {
    const div = document.createElement('div');
    div.className = 'multiplier-float';
    div.textContent = text;
    div.style.cssText = `
      left: ${x}px; top: ${y}px;
      color: ${color}; font-size: ${fontSize}px;
    `;
    document.body.appendChild(div);

    setTimeout(() => div.remove(), 1500);
  },

  /**
   * 金币掉落效果
   * @param {number} x
   * @param {number} y
   * @param {number} count
   */
  coinDrop(x, y, count = 10) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const coin = document.createElement('div');
        coin.className = 'coin-drop';
        coin.textContent = '🪙';
        coin.style.cssText = `
          left: ${x + (Math.random() - 0.5) * 100}px;
          top: ${y}px;
        `;
        document.body.appendChild(coin);

        setTimeout(() => coin.remove(), 1500);
      }, i * 100);
    }
  },

  /**
   * 牌型标签动画
   * @param {string} text - 牌型名称
   * @param {number} x
   * @param {number} y
   */
  showCardType(text, x, y) {
    const label = document.createElement('div');
    label.className = 'card-type-label';
    label.textContent = text;
    label.style.cssText = `left: ${x}px; top: ${y}px;`;
    document.body.appendChild(label);

    setTimeout(() => {
      label.style.transition = 'all 0.5s ease';
      label.style.opacity = '0';
      label.style.transform = 'translate(-50%, -50%) scale(1.2)';
      setTimeout(() => label.remove(), 500);
    }, 1000);
  },

  /**
   * 清除所有动画
   */
  clearAll() {
    this.animations = [];
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  },
};
