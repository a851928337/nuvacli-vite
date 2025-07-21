const fs = require('fs');
const logger = require('./logger');

/**
 * 深度合并对象的辅助函数
 * @param {object} target - 目标对象
 * @param {object} source - 源对象
 * @param {object} strategy - 合并策略
 * @param {number} depth - 递归深度
 * @param {function} logFn - 日志函数
 * @returns {object} 合并后的对象
 */
function deepMergeFields(target, source, strategy = {}, depth = 0, logFn = console.log) {
  const result = { ...target };
  const indent = '  '.repeat(depth);

  for (const [key, value] of Object.entries(source)) {
    const mergeMode = strategy[key] || 'override';
    const existingValue = result[key];

    if (mergeMode === 'merge' && existingValue) {
      if (typeof existingValue === 'object' && typeof value === 'object' &&
        !Array.isArray(existingValue) && !Array.isArray(value)) {
        logFn(`${indent}🔧 合并字段 "${key}"：策略=merge，类型=object → 深度合并`);
        result[key] = deepMergeFields(existingValue, value, strategy, depth + 1, logFn);
        continue;
      }

      if (Array.isArray(existingValue) && Array.isArray(value)) {
        // 数组去重：基于元素值
        const existingItems = new Set(existingValue);
        const newItems = [];
        let addedCount = 0;

        for (const item of value) {
          if (!existingItems.has(item)) {
            newItems.push(item);
            existingItems.add(item);
            addedCount++;
          }
        }

        result[key] = [...existingValue, ...newItems];
        logFn(`${indent}🔧 合并字段 "${key}"：策略=merge，类型=array → 拼接 ${value.length} 个项，去重后新增 ${addedCount} 个项`);
        continue;
      }

      logFn(`${indent}⚠️ 字段 "${key}" 类型不兼容，使用 override`);
    }

    if (mergeMode === 'override') {
      logFn(`${indent}🔧 合并字段 "${key}"：策略=override → 直接覆盖`);
    }

    result[key] = value;
  }

  return result;
}

/**
 * 合并多个 json 文件
 * @param {string[]} jsonPaths - json文件路径数组
 * @param {string} outputPath - 输出路径
 * @param {Record<string, 'merge'|'override'>} mergeStrategy - 字段合并策略（默认全 override）
 * @returns {Promise<boolean>} 是否成功合并
 */
const mergeMultipleJson = (jsonPaths, outputPath, mergeStrategy = {}) => {
  try {
    let mergedContent = {};
    let validFileCount = 0;

    logger.info(`开始合并 ${jsonPaths.length} 个 json 文件`);

    for (const jsonPath of jsonPaths) {
      // 检查文件是否存在
      if (!fs.existsSync(jsonPath)) {
        logger.warn(`⚠️ json 文件不存在，跳过: ${jsonPath}`);
        continue;
      }

      try {
        const content = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        logger.info(`📖 读取配置文件: ${jsonPath}`);

        if (validFileCount === 0) {
          mergedContent = content;
          logger.info(`📝 使用第一个配置作为基础: ${jsonPath}`);
        } else {
          logger.info(`🔄 合并配置文件: ${jsonPath}`);
          mergedContent = deepMergeFields(mergedContent, content, mergeStrategy, 0, logger.info);
        }

        validFileCount++;
      } catch (parseError) {
        logger.error(`解析 json 失败: ${jsonPath} - ${parseError.message}`);
        continue;
      }
    }

    // 如果没有找到任何有效的配置文件
    if (validFileCount === 0) {
      logger.error('❌ 没有找到任何有效的 json 文件');
      return false;
    }

    // 写入合并后的内容
    fs.writeFileSync(outputPath, JSON.stringify(mergedContent, null, 2));
    logger.info(`✅ 合并成功，配置已写入 ${outputPath}`);
    return true;

  } catch (error) {
    logger.error(`❌ 合并失败: ${error.message}`);
    return false;
  }
};

module.exports = {
  mergeMultipleJson
};
