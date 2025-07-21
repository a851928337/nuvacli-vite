const fs = require('fs');
const path = require('path');
const logger = require("./logger");
const { promises: fsPromises } = fs;
const { mergePackageJson } = require('./mergePackageJson');
const { mergeMultipleViteConfigs } = require('./mergeViteConfig');

// 读取package.json配置（只读取一次）
let packageConfig = {};
try {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  packageConfig = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  logger.info('成功读取package.json配置');
} catch (error) {
  logger.error('读取package.json失败:', error.message);
  packageConfig = {};
}

// 判断是js文件还是ts文件
const jsOrTsFile = (filename) => {
  if (fs.existsSync(path.join(process.cwd(), `${filename}.ts`))) {
    return `${filename}.ts`
  }
  if (fs.existsSync(path.join(process.cwd(), `${filename}.js`))) {
    return `${filename}.js`
  }
}

var ignoreBase = [
  "node_modules",
  "dist",
  ".vite_mom",
  ".git",
  ".idea",
  ".vscode",
  ".hbuilderx",
  "commitlint.config.js",
  "prettier.config.js",
  "jest.config.js",
  "yarn.lock",
  ".editorconfig",
  ".eslintignore",
  ".eslintrc.js",
  ".gitattributes",
  ".gitignore",
  ".huskyrc.js",
  ".prettierrc",
  ".stylelintignore",
]

// 从package.json添加igNoreWacthFiles配置
if (packageConfig.igNoreWacthFiles && Array.isArray(packageConfig.igNoreWacthFiles)) {
  ignoreBase = ignoreBase.concat(packageConfig.igNoreWacthFiles);
  logger.info('加载igNoreWacthFiles配置:', packageConfig.igNoreWacthFiles);
}

// Function to copy files and directories recursively
const copyFolder = async (src, dest, ignore = []) => {
  try {
    const files = await fsPromises.readdir(src);

    if (!await fsPromises.stat(dest).catch(() => false)) {
      await fsPromises.mkdir(dest, { recursive: true });
    }

    for (const file of files) {
      if (ignore.includes(file)) {
        continue;
      }

      const srcPath = path.join(src, file);
      const destPath = path.join(dest, file);

      const stats = await fsPromises.stat(srcPath);

      if (stats.isDirectory()) {
        await copyFolder(srcPath, destPath, ignore);
      } else {
        // 特殊处理 package.json 文件
        if (file === 'package.json' && fs.existsSync(destPath)) {
          const success = await mergePackageJson(srcPath, destPath);
          // 如果合并失败，执行普通拷贝
          if (!success) {
            await fsPromises.copyFile(srcPath, destPath);
          }
        }
        else if (file !== 'vite.config.ts') {
          // 普通文件直接拷贝
          await fsPromises.copyFile(srcPath, destPath);
        }
      }
    }
  } catch (err) {
    console.error(`Error copying folder: ${err.message}`);
  }
}


// 读取配置文件动态加载模块
const replyModule = () => {
  if (packageConfig.nuvaModules && Array.isArray(packageConfig.nuvaModules)) {
    logger.info('加载nuvaModules配置:', packageConfig.nuvaModules);
    return packageConfig.nuvaModules;
  } else {
    logger.warn('未找到nuvaModules配置');
    return [];
  }
}



// 模块文件和项目文件进行拷贝到新目录
const generateNewDir = async () => {
  const nuvaModules = replyModule();
  // 第一部分：为每个 nuvaModules 创建拷贝任务
  const tasks = nuvaModules.map(module => ({
    srcDir: path.join(process.cwd(), "node_modules", module.name),
    desDir: path.join(process.cwd(), ".vite_mom"),
    excludes: ignoreBase
  }));

  // 第二部分：添加项目自身的拷贝任务
  tasks.push({
    srcDir: path.join(process.cwd()),
    desDir: path.join(process.cwd(), ".vite_mom"),
    excludes: ignoreBase
  })
  logger.info("start copyfile ....")
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    logger.info(`copyfile ${task.srcDir}`)
    // 不处理vite.config.ts
    await copyFolder(task.srcDir, task.desDir, task.excludes);
  }
  const configPaths = tasks.map(task => path.join(task.srcDir, 'vite.config.ts'))
  mergeMultipleViteConfigs(configPaths, path.join(process.cwd(), ".vite_mom/vite.config.ts"))
  logger.info("finish copyfile ....")
}

module.exports = {
  generateNewDir, jsOrTsFile, ignoreBase, replyModule
}
