/**
 * 草榴社区 (t66y.com) 任务队列管理器
 */

const { T66YSyncTask, TaskStatus } = require('./t66ySyncTask');
const ApiClient = require('../apiClient');

class T66YTaskQueue {
  constructor(config) {
    this.config = config;
    this.tasks = new Map();
    this.queue = [];
    this.running = [];
    this.completed = [];
    this.failed = [];
    this.maxConcurrent = config.maxWorkers || 2;
    this.isRunning = false;
    this.progressCallback = null;
  }

  onProgress(callback) {
    this.progressCallback = callback;
  }

  _handleTaskProgress(progressData) {
    if (this.progressCallback) {
      this.progressCallback(progressData);
    }
  }

  /**
   * 批量添加任务（先检查已同步，再添加未同步的）
   */
  async addTasks(items) {
    console.log(`[T66YTaskQueue] 准备添加 ${items.length} 个任务`);

    const apiClient = new ApiClient(this.config);
    const skippedItems = [];

    try {
      // 批量检查哪些已同步
      const tids = items
        .filter(item => item.tid && !isNaN(parseInt(item.tid)))
        .map(item => String(item.tid));

      let existsMap = {};
      if (tids.length > 0) {
        try {
          existsMap = await Promise.race([
            apiClient.checkPostsExistsBatch(tids),
            new Promise((_, rej) => setTimeout(() => rej(new Error('超时')), 8000))
          ]);
        } catch (e) {
          console.warn('[T66YTaskQueue] 批量检查失败（继续添加所有任务）:', e.message);
        }
      }

      const needSyncItems = items.filter(item => {
        const tid = item.tid ? String(item.tid) : null;
        if (tid && existsMap[tid] && existsMap[tid].exists) {
          console.log(`[T66YTaskQueue] 跳过已同步: ${item.title} (tid=${tid})`);

          this.completed.push({
            id: item.id,
            title: item.title,
            status: TaskStatus.COMPLETED,
            result: { success: true, skipped: true, message: '已同步（跳过）' }
          });

          skippedItems.push({
            taskId: item.id,
            tid: tid,
            title: item.title
          });

          return false;
        }
        return true;
      });

      console.log(`[T66YTaskQueue] 需要同步: ${needSyncItems.length} 个`);

      needSyncItems.forEach((item, index) => {
        const taskId = item.id || `t66y-${item.tid || Date.now()}-${index}`;
        const task = new T66YSyncTask(item, this.config);
        task.id = taskId;
        task.onProgress = (data) => this._handleTaskProgress(data);

        this.tasks.set(taskId, task);
        this.queue.push(taskId);
      });

      return {
        total: items.length,
        needSync: needSyncItems.length,
        alreadySynced: items.length - needSyncItems.length,
        skippedItems
      };
    } catch (error) {
      console.error('[T66YTaskQueue] addTasks 失败:', error);
      // 出错时全部加入队列
      items.forEach((item, index) => {
        const taskId = item.id || `t66y-task-${index}`;
        const task = new T66YSyncTask(item, this.config);
        task.id = taskId;
        task.onProgress = (data) => this._handleTaskProgress(data);
        this.tasks.set(taskId, task);
        this.queue.push(taskId);
      });
      return { total: items.length, needSync: items.length, alreadySynced: 0, skippedItems: [] };
    }
  }

  /**
   * 开始执行队列
   */
  async start() {
    if (this.isRunning) {
      console.log('[T66YTaskQueue] 队列已在运行中');
      return;
    }

    this.isRunning = true;
    console.log(`[T66YTaskQueue] 开始执行队列, 共 ${this.queue.length} 个任务, 并发: ${this.maxConcurrent}`);

    while (this.queue.length > 0 || this.running.length > 0) {
      // 填充并发槽
      while (this.running.length < this.maxConcurrent && this.queue.length > 0) {
        const taskId = this.queue.shift();
        const task = this.tasks.get(taskId);
        if (!task) continue;

        this.running.push(taskId);

        task.execute()
          .then(result => {
            this.running = this.running.filter(id => id !== taskId);
            this.completed.push(taskId);
            console.log(`[T66YTaskQueue] ✅ 任务完成: ${taskId}`);
          })
          .catch(error => {
            this.running = this.running.filter(id => id !== taskId);
            this.failed.push(taskId);
            console.error(`[T66YTaskQueue] ❌ 任务失败: ${taskId}`, error.message);
          });
      }

      // 等待一段时间再检查
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.isRunning = false;

    const stats = this.getStats();
    console.log(`[T66YTaskQueue] 队列执行完毕 - 成功: ${stats.completed}, 失败: ${stats.failed}`);
    return stats;
  }

  stop() {
    this.isRunning = false;
    this.queue = [];
    console.log('[T66YTaskQueue] 队列已停止');
  }

  getStats() {
    return {
      total: this.tasks.size,
      pending: this.queue.length,
      running: this.running.length,
      completed: this.completed.length,
      failed: this.failed.length
    };
  }

  getTaskDetail(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    return {
      id: task.id,
      status: task.status,
      progress: task.progress,
      currentStep: task.currentStep,
      error: task.error,
      result: task.result,
      startTime: task.startTime,
      endTime: task.endTime
    };
  }
}

module.exports = T66YTaskQueue;
