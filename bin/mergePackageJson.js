const fs = require('fs');
const { promises: fsPromises } = fs;
const logger = require('./logger');

/**
 * 合并两个 package.json 文件
 * @param {string} srcPath - 源 package.json 路径
 * @param {string} destPath - 目标 package.json 路径
 * @returns {Promise<boolean>} 是否成功合并
 */
const mergePackageJson = async (srcPath, destPath) => {
  try {
    const srcContent = JSON.parse(await fsPromises.readFile(srcPath, 'utf-8'));

    let destContent = {};
    if (fs.existsSync(destPath)) {
      destContent = JSON.parse(await fsPromises.readFile(destPath, 'utf-8'));
    }

    const mergedContent = {
      ...srcContent,
      dependencies: {
        ...(destContent.dependencies || {}),
        ...(srcContent.dependencies || {})
      },
      devDependencies: {
        ...(destContent.devDependencies || {}),
        ...(srcContent.devDependencies || {})
      }
    };

    await fsPromises.writeFile(destPath, JSON.stringify(mergedContent, null, 2));
    logger.info(`合并 package.json: ${destPath}`);
    return true;
  } catch (error) {
    logger.error(`处理 package.json 失败: ${error.message}`);
    return false;
  }
};

module.exports = { mergePackageJson };
