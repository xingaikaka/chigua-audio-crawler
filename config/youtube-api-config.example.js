/**
 * YouTube Data API v3 配置示例
 * 
 * 使用说明：
 * 1. 复制此文件并重命名为 youtube-api-config.js
 * 2. 将 YOUR_API_KEY_HERE 替换为你的真实 API Key
 * 3. 不要将 youtube-api-config.js 提交到 Git（已在 .gitignore 中排除）
 * 
 * 如何获取 API Key：
 * 1. 访问 Google Cloud Console: https://console.cloud.google.com/
 * 2. 创建新项目或选择现有项目
 * 3. 启用 YouTube Data API v3
 * 4. 创建凭据（API 密钥）
 * 5. 复制 API 密钥到下方
 * 
 * 安全提示：
 * - 不要将 API Key 分享给他人
 * - 不要将包含 API Key 的文件提交到公开仓库
 * - 在生产环境中，应该使用环境变量而非硬编码
 */

module.exports = {
  apiKey: 'YOUR_API_KEY_HERE', // 替换为你的 YouTube Data API v3 密钥
  baseURL: 'https://www.googleapis.com/youtube/v3',
  defaultMaxResults: 50, // 每次请求的最大结果数（API 限制 1-50）
  searchPart: 'snippet', // 返回的数据部分
  searchType: 'video', // 默认搜索类型
};
