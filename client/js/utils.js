/**
 * 工具函数模块
 * 通用的辅助函数
 */

const Utils = {
  /**
   * 显示Toast提示
   * @param {string} msg - 提示内容
   * @param {string} type - 类型：info/success/error/warning
   * @param {number} duration - 显示时长（毫秒）
   */
  toast(msg, type = 'info', duration = 3000) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
      if (container.children.length === 0) {
        container.remove();
      }
    }, duration);
  },

  /**
   * 获取URL参数
   * @param {string} name
   * @returns {string|null}
   */
  getUrlParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  },

  /**
   * 本地存储封装
   */
  storage: {
    get(key) {
      try {
        const val = localStorage.getItem(key);
        return val ? JSON.parse(val) : null;
      } catch (e) {
        return null;
      }
    },
    set(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    },
    remove(key) {
      localStorage.removeItem(key);
    },
  },

  /**
   * 格式化金币显示
   * @param {number} gold
   * @returns {string}
   */
  formatGold(gold) {
    if (gold >= 10000) {
      return (gold / 10000).toFixed(1) + '万';
    }
    return gold.toString();
  },

  /**
   * 格式化时间
   * @param {string} dateStr
   * @returns {string}
   */
  formatTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  },

  /**
   * 检查是否横屏
   * @returns {boolean}
   */
  isLandscape() {
    return window.innerWidth > window.innerHeight;
  },

  /**
   * 显示/隐藏竖屏提示
   */
  checkOrientation() {
    const overlay = document.querySelector('.rotate-device-overlay');
    if (!overlay) return;

    if (this.isLandscape()) {
      overlay.classList.add('hidden');
    } else {
      overlay.classList.remove('hidden');
    }
  },

  /**
   * 生成随机ID
   * @returns {string}
   */
  randomId() {
    return Math.random().toString(36).substr(2, 9);
  },

  /**
   * 防抖函数
   * @param {Function} fn
   * @param {number} delay
   * @returns {Function}
   */
  debounce(fn, delay = 300) {
    let timer = null;
    return function (...args) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  /**
   * 节流函数
   * @param {Function} fn
   * @param {number} interval
   * @returns {Function}
   */
  throttle(fn, interval = 100) {
    let lastTime = 0;
    return function (...args) {
      const now = Date.now();
      if (now - lastTime >= interval) {
        lastTime = now;
        fn.apply(this, args);
      }
    };
  },

  /**
   * 获取头像首字母
   * @param {string} name
   * @returns {string}
   */
  getAvatarLetter(name) {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  },

  /**
   * 深拷贝
   * @param {any} obj
   * @returns {any}
   */
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },
};

// 监听屏幕方向变化
window.addEventListener('resize', () => {
  Utils.checkOrientation();
});
window.addEventListener('orientationchange', () => {
  setTimeout(() => Utils.checkOrientation(), 100);
});
