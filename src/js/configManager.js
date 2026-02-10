/**
 * 配置管理器
 * 负责配置的加载、保存和验证
 */

class ConfigManager {
  constructor() {
    this.config = this.loadConfig();
    this.siteConfig = {}; // 当前站点的基础配置
    this.initEvents();
  }

  /**
   * 加载站点配置（从站点配置文件）
   */
  loadSiteConfig(siteConfig) {
    console.log('[ConfigManager] 加载站点配置:', siteConfig);
    this.siteConfig = siteConfig;
    
    // 合并站点配置和用户配置
    this.config = { ...this.config, ...siteConfig };
    
    // 渲染到UI
    this.renderConfig();
  }

  /**
   * 加载配置（从localStorage）
   */
  loadConfig() {
    const savedConfig = localStorage.getItem('sync_config');
    if (savedConfig) {
      try {
        return JSON.parse(savedConfig);
      } catch (e) {
        console.error('配置加载失败:', e);
      }
    }
    
    // 返回默认配置
    return this.getDefaultConfig();
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig() {
    return {
      // API配置
      apiBaseUrl: 'http://47.239.212.188:8880',
      syncUid: '1765988676000011375',
      roleCode: 'jianzhi',
      apiToken: '',
      authUuid: 'dd7d5b1b9f1348ec58eb3a1b884b93a2', // X-AUTH-UUID
      crawlerToken: 'UQ8k7P2nV6cXr9T1mK5Zs3YpH8dN4bJ0qL2vW7eA', // X-CRAWLER-TOKEN (必需)
      
      // R2配置
      r2WorkerUrl: 'https://khjghjghjjh.xyz/upload',
      r2ApiKey: '',
      r2PreviewDomain: 'https://khjghjghjjh.xyz',
      
      // 爬虫配置
      baseUrl: 'https://51cg1.com',
      requestTimeout: 60000,
      maxConcurrent: 3,
      maxWorkers: 5,
      
      // 图片解密配置（原站图片解密）
      imageDecryptKey: '102_53_100_57_54_53_100_102_55_53_51_51_54_50_55_48',
      imageDecryptIV: '57_55_98_54_48_51_57_52_97_98_99_50_102_98_101_49',
      
      // R2图片加密配置（上传到R2时的加密）
      r2ImageEncryptionKey: 'cYC8lOMnoUnqzeFhYcGCoLqNa44k9RMfmoorxeS7vIo=',
      r2ImageEncryptionIV: 'QuOHSIr6OPbRxShwqkaGQw=='
    };
  }

  /**
   * 保存配置
   */
  saveConfig(config) {
    this.config = { ...this.config, ...config };
    localStorage.setItem('sync_config', JSON.stringify(this.config));
    console.log('✅ 配置已保存');
    this.showToast('配置已保存', 'success');
    return true;
  }

  /**
   * 获取配置项
   */
  get(key) {
    return this.config[key];
  }

  /**
   * 获取所有配置
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * 重置为默认配置
   */
  reset() {
    localStorage.removeItem('sync_config');
    this.config = this.getDefaultConfig();
    this.renderConfig();
    console.log('✅ 配置已重置');
    this.showToast('配置已重置为默认值', 'success');
  }

  /**
   * 渲染配置到UI
   * 注意：现在配置面板由 siteConfigManager 管理，这个方法已不再使用
   */
  renderConfig() {
    console.log('[ConfigManager] renderConfig - 配置面板现在由 siteConfigManager 管理');
    // 配置面板由 siteConfigManager 动态管理，不再需要此方法
  }

  /**
   * 从UI读取配置
   */
  readFromUI() {
    return {
      apiBaseUrl: document.getElementById('apiBaseUrl').value.trim(),
      syncUid: document.getElementById('syncUid').value.trim(),
      roleCode: document.getElementById('roleCode').value.trim(),
      apiToken: document.getElementById('apiToken').value.trim(),
      authUuid: document.getElementById('authUuid').value.trim(),
      crawlerToken: document.getElementById('crawlerToken').value.trim(),
      r2WorkerUrl: document.getElementById('r2WorkerUrl').value.trim(),
      r2ApiKey: document.getElementById('r2ApiKey').value.trim(),
      r2PreviewDomain: document.getElementById('r2PreviewDomain').value.trim(),
      baseUrl: document.getElementById('baseUrl').value.trim(),
      requestTimeout: parseInt(document.getElementById('requestTimeout').value) || 60000,
      maxConcurrent: parseInt(document.getElementById('maxConcurrent').value) || 3,
      maxWorkers: parseInt(document.getElementById('maxWorkers').value) || 5,
      imageDecryptKey: this.config.imageDecryptKey,
      imageDecryptIV: this.config.imageDecryptIV,
      r2ImageEncryptionKey: document.getElementById('r2ImageEncryptionKey').value.trim(),
      r2ImageEncryptionIV: document.getElementById('r2ImageEncryptionIV').value.trim()
    };
  }

  /**
   * 验证配置
   */
  validateConfig(config) {
    const errors = [];
    
    if (!config.apiBaseUrl) {
      errors.push('API地址不能为空');
    }
    
    if (!config.syncUid) {
      errors.push('用户UID不能为空');
    }
    
    if (!config.r2WorkerUrl) {
      errors.push('R2 Worker URL不能为空');
    }
    
    if (!config.r2PreviewDomain) {
      errors.push('R2预览域名不能为空');
    }
    
    if (config.maxConcurrent < 1 || config.maxConcurrent > 10) {
      errors.push('最大并发数必须在1-10之间');
    }
    
    return errors;
  }

  /**
   * 测试API连接
   */
  async testConnection() {
    const config = this.readFromUI();
    const errors = this.validateConfig(config);
    
    if (errors.length > 0) {
      this.showToast('配置验证失败: ' + errors.join(', '), 'error');
      return false;
    }
    
    try {
      this.showToast('正在测试连接...', 'info');
      
      const result = await window.electronAPI.checkSyncStatus([], config);
      
      if (result.success) {
        this.showToast('✅ API连接测试成功！', 'success');
        return true;
      } else {
        this.showToast(`❌ API连接失败: ${result.error}`, 'error');
        return false;
      }
    } catch (error) {
      this.showToast(`❌ API连接失败: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * 显示提示消息
   */
  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  /**
   * 初始化事件监听
   */
  initEvents() {
    // 注意：配置保存按钮现在由 siteConfigManager 管理

    // 收起/展开配置面板
    document.getElementById('collapseConfigBtn').addEventListener('click', () => {
      const panel = document.getElementById('configPanel');
      const expandBtn = document.getElementById('expandConfigBtn');
      const collapseBtn = document.getElementById('collapseConfigBtn');
      
      panel.classList.toggle('collapsed');
      
      if (panel.classList.contains('collapsed')) {
        collapseBtn.textContent = '▶';
        expandBtn.style.display = 'block';
      } else {
        collapseBtn.textContent = '◀';
        expandBtn.style.display = 'none';
      }
    });

    // 展开配置面板
    document.getElementById('expandConfigBtn').addEventListener('click', () => {
      const panel = document.getElementById('configPanel');
      const expandBtn = document.getElementById('expandConfigBtn');
      const collapseBtn = document.getElementById('collapseConfigBtn');
      
      panel.classList.remove('collapsed');
      collapseBtn.textContent = '◀';
      expandBtn.style.display = 'none';
    });
  }
}

// 创建全局实例
window.configManager = new ConfigManager();
