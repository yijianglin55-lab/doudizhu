/**
 * HTTP API模块
 * 封装所有与服务端的HTTP接口调用
 */

const API = {
  // API基础路径
  BASE_URL: '',

  /**
   * 获取认证头
   * @returns {object}
   */
  getAuthHeaders() {
    const token = Utils.storage.get('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };
  },

  /**
   * 通用请求方法
   * @param {string} url
   * @param {object} options
   * @returns {Promise<object>}
   */
  async request(url, options = {}) {
    try {
      const response = await fetch(this.BASE_URL + url, {
        headers: this.getAuthHeaders(),
        ...options,
      });
      const data = await response.json();

      // Token过期，跳转登录
      if (data.code === 401) {
        Utils.storage.remove('token');
        Utils.storage.remove('user');
        window.location.href = '/login.html';
        return data;
      }

      return data;
    } catch (err) {
      console.error('API请求失败:', err);
      return { code: -1, msg: '网络请求失败', data: null };
    }
  },

  /**
   * 用户注册
   * @param {string} username
   * @param {string} password
   * @param {string} nickname
   * @returns {Promise<object>}
   */
  async register(username, password, nickname) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, nickname }),
    });
  },

  /**
   * 用户登录
   * @param {string} username
   * @param {string} password
   * @returns {Promise<object>}
   */
  async login(username, password) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  /**
   * 获取个人信息
   * @returns {Promise<object>}
   */
  async getProfile() {
    return this.request('/api/auth/profile');
  },

  /**
   * 修改昵称
   * @param {string} nickname
   * @returns {Promise<object>}
   */
  async updateNickname(nickname) {
    return this.request('/api/auth/nickname', {
      method: 'PUT',
      body: JSON.stringify({ nickname }),
    });
  },

  /**
   * 获取房间列表
   * @returns {Promise<object>}
   */
  async getRoomList() {
    return this.request('/api/rooms/list');
  },

  /**
   * 获取活跃房间
   * @returns {Promise<object>}
   */
  async getActiveRooms() {
    return this.request('/api/rooms/active');
  },

  // ==================== 管理员接口 ====================

  /**
   * 检查管理员权限
   * @returns {Promise<object>}
   */
  async adminCheck() {
    return this.request('/api/admin/check');
  },

  /**
   * 获取所有用户
   * @returns {Promise<object>}
   */
  async adminGetUsers() {
    return this.request('/api/admin/users');
  },

  /**
   * 修改用户金币
   * @param {number} userId
   * @param {number} gold
   * @returns {Promise<object>}
   */
  async adminSetGold(userId, gold) {
    return this.request(`/api/admin/users/${userId}/gold`, {
      method: 'PUT',
      body: JSON.stringify({ gold }),
    });
  },

  /**
   * 封禁/解封用户
   * @param {number} userId
   * @param {boolean} banned
   * @returns {Promise<object>}
   */
  async adminSetBanned(userId, banned) {
    return this.request(`/api/admin/users/${userId}/ban`, {
      method: 'PUT',
      body: JSON.stringify({ banned }),
    });
  },

  /**
   * 获取活跃房间（管理员）
   * @returns {Promise<object>}
   */
  async adminGetRooms() {
    return this.request('/api/admin/rooms');
  },

  /**
   * 获取历史记录
   * @param {number} limit
   * @param {number} offset
   * @returns {Promise<object>}
   */
  async adminGetHistory(limit, offset) {
    return this.request(`/api/admin/history?limit=${limit || 50}&offset=${offset || 0}`);
  },

  /**
   * 获取系统统计
   * @returns {Promise<object>}
   */
  async adminGetStats() {
    return this.request('/api/admin/stats');
  },

  /**
   * 获取匹配配置
   * @returns {Promise<object>}
   */
  async adminGetMatchConfig() {
    return this.request('/api/admin/config/match');
  },

  /**
   * 修改匹配配置
   * @param {object} config
   * @returns {Promise<object>}
   */
  async adminUpdateMatchConfig(config) {
    return this.request('/api/admin/config/match', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  },
};
