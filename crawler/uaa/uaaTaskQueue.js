/**
 * UAA 任务队列管理器
 * 支持多任务并发处理
 */

const { UaaSyncTask, TaskStatus } = require('./uaaSyncTask');
const UaaApiClient = require('./uaaApiClient');

class UaaTaskQueue {
  constructor(config) {
    this.config = config;
    this.tasks = new Map(); // taskId => UaaSyncTask
    this.queue = []; // 待执行任务队列
    this.running = []; // 正在执行的任务
    this.completed = []; // 已完成的任务
    this.failed = []; // 失败的任务
    this.maxConcurrent = config.maxWorkers || 3; // 最大并发数
    this.isRunning = false;
    this.progressCallback = null;
    
    // ✅ 添加互斥锁机制，防止并发重复
    this.syncLocks = new Map(); // audioId => Promise（正在同步的任务）
  }
  
  /**
   * 批量添加任务
   * @param {Array} items - 音频项目列表
   */
  async addTasks(items) {
    console.log(`[UaaTaskQueue] 准备添加 ${items.length} 个任务`);
    
    // Step 1: 批量检查哪些已同步
    const apiClient = new UaaApiClient(this.config);
    
    try {
      const checkResults = await apiClient.checkAudioNovelsExistsBatch(items, null);
      
      // 过滤已同步的项目，并收集跳过的数据
      const skippedItems = []; // 收集已同步的数据，用于通知前端
      
      const needSyncItems = items.filter(item => {
        const audioId = item.article_id || item.id;
        const checkResult = checkResults[audioId];
        
        if (checkResult && checkResult.exists) {
          console.log(`[UaaTaskQueue] 跳过已同步: ${item.title} (novel_id=${checkResult.novel_id})`);
          
          // 添加到已完成列表
          this.completed.push({
            id: audioId,
            title: item.title,
            status: TaskStatus.COMPLETED,
            result: {
              success: true,
              novelId: checkResult.novel_id,
              title: item.title,
              message: '已同步（跳过）'
            }
          });
          
          // 收集已同步数据，用于前端标记
          skippedItems.push({
            audioId: audioId,
            novelId: checkResult.novel_id,
            title: item.title
          });
          
          return false; // 不需要同步
        }
        
        return true; // 需要同步
      });
      
      console.log(`[UaaTaskQueue] 实际需要同步: ${needSyncItems.length} 个`);
      
      // Step 2: 创建任务
      needSyncItems.forEach((item, index) => {
        const audioId = item.article_id || item.id || `task-${Date.now()}-${index}`;
        const task = new UaaSyncTask(item, this.config);
        task.id = audioId;
        
        // 设置进度回调
        task.onProgress = (progressData) => {
          this._handleTaskProgress(progressData);
        };
        
        this.tasks.set(audioId, task);
        this.queue.push(audioId);
      });
      
      console.log(`[UaaTaskQueue] 任务队列准备完成，共 ${this.queue.length} 个待执行`);
      
      return {
        total: items.length,
        needSync: needSyncItems.length,
        alreadySynced: items.length - needSyncItems.length,
        skippedItems: skippedItems // 返回已跳过的数据
      };
      
    } catch (error) {
      console.error(`[UaaTaskQueue] 批量检查失败:`, error);
      
      // 检查失败时，全部添加到队列
      items.forEach((item, index) => {
        const audioId = item.article_id || item.id || `task-${Date.now()}-${index}`;
        const task = new UaaSyncTask(item, this.config);
        task.id = audioId;
        
        task.onProgress = (progressData) => {
          this._handleTaskProgress(progressData);
        };
        
        this.tasks.set(audioId, task);
        this.queue.push(audioId);
      });
      
      return {
        total: items.length,
        needSync: items.length,
        alreadySynced: 0,
        skippedItems: [] // 检查失败时没有跳过的数据
      };
    }
  }
  
  /**
   * 开始执行队列
   */
  async start() {
    if (this.isRunning) {
      console.warn('[UaaTaskQueue] 队列已在运行中');
      return;
    }
    
    this.isRunning = true;
    console.log(`[UaaTaskQueue] 开始执行队列，最大并发: ${this.maxConcurrent}`);
    
    while (this.queue.length > 0 || this.running.length > 0) {
      // 启动新任务直到达到最大并发数
      while (this.running.length < this.maxConcurrent && this.queue.length > 0) {
        const taskId = this.queue.shift();
        const task = this.tasks.get(taskId);
        
        if (task) {
          this.running.push(taskId);
          this._executeTask(task);
        }
      }
      
      // 等待一会儿再检查
      await this._sleep(500);
    }
    
    this.isRunning = false;
    console.log(`[UaaTaskQueue] 队列执行完成`);
    console.log(`  - 总任务数: ${this.tasks.size}`);
    console.log(`  - 成功: ${this.completed.length}`);
    console.log(`  - 失败: ${this.failed.length}`);
    
    // 触发完成回调
    if (this.progressCallback) {
      this.progressCallback({
        type: 'queue-completed',
        stats: this.getStats()
      });
    }
  }
  
  /**
   * 执行单个任务（带互斥锁保护）
   */
  async _executeTask(task) {
    const audioId = task.item.article_id || task.item.id;
    
    try {
      const timestamp = new Date().toISOString();
      console.log(`[UaaTaskQueue] ${timestamp} 开始执行任务: ${task.id} (${task.item.title})`);
      console.log(`[UaaTaskQueue]   当前并发数: ${this.running.length}`);
      console.log(`[UaaTaskQueue]   正在执行: [${this.running.join(', ')}]`);
      
      // ✅ 检查是否有相同 audioId 的任务正在同步
      if (this.syncLocks.has(audioId)) {
        console.log(`[UaaTaskQueue] ⚠️ 检测到重复任务: ${audioId} (${task.item.title})`);
        console.log(`[UaaTaskQueue]   → 等待先前任务完成...`);
        
        // 等待先前的任务完成
        await this.syncLocks.get(audioId);
        
        console.log(`[UaaTaskQueue]   → 先前任务已完成，本任务标记为跳过`);
        
        // 标记为已完成（跳过）
        this.completed.push({
          id: task.id,
          title: task.item.title,
          status: TaskStatus.COMPLETED,
          result: {
            success: true,
            title: task.item.title,
            message: '重复任务，已跳过'
          }
        });
        
        return;
      }
      
      // ✅ 获取锁：创建一个 Promise，其他任务会等待这个 Promise
      let releaseLock;
      const lockPromise = new Promise(resolve => {
        releaseLock = resolve;
      });
      this.syncLocks.set(audioId, lockPromise);
      
      console.log(`[UaaTaskQueue]   ✅ 已获取锁: ${audioId}`);
      
      try {
        // 执行任务
        const result = await task.execute();
        
        const endTimestamp = new Date().toISOString();
        console.log(`[UaaTaskQueue] ${endTimestamp} 任务完成: ${task.id} (${task.item.title})`);
        
        this.completed.push({
          id: task.id,
          title: task.item.title,
          status: TaskStatus.COMPLETED,
          result: result
        });
        
      } finally {
        // ✅ 释放锁
        this.syncLocks.delete(audioId);
        releaseLock();
        console.log(`[UaaTaskQueue]   🔓 已释放锁: ${audioId}`);
      }
      
    } catch (error) {
      console.error(`[UaaTaskQueue] 任务失败: ${task.id}`, error);
      
      this.failed.push({
        id: task.id,
        title: task.item.title,
        status: TaskStatus.FAILED,
        error: error.message
      });
      
      // 向渲染进程发送任务失败通知，使卡片显示失败状态
      this._handleTaskProgress({
        taskId: task.id,
        status: TaskStatus.FAILED,
        step: '同步失败',
        progress: 0,
        details: { error: error.message, title: task.item.title }
      });
      
      // ✅ 失败时也要释放锁
      if (this.syncLocks.has(audioId)) {
        const lockPromise = this.syncLocks.get(audioId);
        this.syncLocks.delete(audioId);
        // 触发等待的任务
        if (lockPromise && lockPromise.resolve) {
          lockPromise.resolve();
        }
      }
      
    } finally {
      // 从运行列表中移除
      const index = this.running.indexOf(task.id);
      if (index > -1) {
        this.running.splice(index, 1);
      }
    }
  }
  
  /**
   * 处理任务进度
   */
  _handleTaskProgress(progressData) {
    if (this.progressCallback) {
      this.progressCallback({
        type: 'task-progress',
        data: progressData,
        stats: this.getStats()
      });
    }
  }
  
  /**
   * 获取队列统计信息
   */
  getStats() {
    return {
      total: this.tasks.size,
      pending: this.queue.length,
      running: this.running.length,
      completed: this.completed.length,
      failed: this.failed.length
    };
  }
  
  /**
   * 获取任务详情
   */
  getTaskDetail(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) {
      return null;
    }
    
    return {
      id: task.id,
      title: task.item.title,
      status: task.status,
      progress: task.progress,
      currentStep: task.currentStep,
      error: task.error,
      result: task.result,
      startTime: task.startTime,
      endTime: task.endTime
    };
  }
  
  /**
   * 停止队列
   */
  stop() {
    console.log('[UaaTaskQueue] 停止队列');
    this.isRunning = false;
    
    // 取消所有运行中的任务
    this.running.forEach(taskId => {
      const task = this.tasks.get(taskId);
      if (task) {
        task.cancel();
      }
    });
    
    // 清空待执行队列
    this.queue = [];
  }
  
  /**
   * 设置进度回调
   */
  onProgress(callback) {
    this.progressCallback = callback;
  }
  
  /**
   * 延时函数
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = UaaTaskQueue;
