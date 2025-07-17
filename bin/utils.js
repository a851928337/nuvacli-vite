const fs = require('fs');
const path = require('path');
const logger = require("./logger");
const chokidar = require("chokidar");
const { promises: fsPromises } = fs;

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
  'node_modules',
  'dist',
  '.vite_mom',
  '.git',
  '.idea',
  '.vscode',
  '.hbuilderx',
  'commitlint.config.js',
  'prettier.config.js',
  'jest.config.js',
  'yarn.lock',
  '.editorconfig',
  '.eslintignore',
  '.eslintrc.js',
  '.gitattributes',
  '.gitignore',
  '.huskyrc.js',
  '.prettierrc',
  '.stylelintignore',
]

const configFile = jsOrTsFile('vite.config');
const viteconfig = fs.readFileSync(path.join(process.cwd(), configFile), 'utf-8')
if (viteconfig.match(/(igNoreWacthFiles):((|[^])*?\])/)) {
  igNoreWacthFilesstr = viteconfig.match(/(igNoreWacthFiles):((|[^])*?\])/)[0].replace(/(\s*?{\s*?|\s*?,\s*?)(['"])?([a-zA-Z0-9]+)(['"])?:/g, '$1"$3":').replace("igNoreWacthFiles:", "")
  if (igNoreWacthFilesstr) {
    ignoreBase = ignoreBase.concat(igNoreWacthFilesstr.replace('[', '').replace(']', '').replace(/'/g, "").split(','))
  }
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
        await fsPromises.copyFile(srcPath, destPath);
      }
    }
  } catch (err) {
    console.error(`Error copying folder: ${err.message}`);
  }
}


// 读取配置文件动态加载模块
const replyModule = () => {
  const configFile = jsOrTsFile('vite.config');
  const viteconfig = fs.readFileSync(path.join(process.cwd(), configFile), 'utf-8')

  // 移除interface定义和import语句，只保留export default配置部分
  const cleanConfig = viteconfig
    .replace(/import\s+.*?from\s+['"][^'"]*['"]\s*;?\s*/g, '') // 移除import语句
    .replace(/interface\s+\w+[^}]*}\s*/g, '') // 移除interface定义
    .replace(/type\s+\w+\s*=\s*[^;]*;\s*/g, '') // 移除type定义
    .replace(/\/\/.*$/gm, '') // 移除单行注释
    .replace(/\/\*[\s\S]*?\*\//g, '') // 移除多行注释

  // 提取nuvaModules配置，匹配从nuvaModules开始到对应的]结束
  const nuvaModulesMatch = cleanConfig.match(/nuvaModules\s*:\s*\[[\s\S]*?\]/);

  if (!nuvaModulesMatch) {
    console.warn('未找到nuvaModules配置');
    return [];
  }

  const viteStr = nuvaModulesMatch[0].replace('nuvaModules:', '').trim();
  console.log('提取的nuvaModules配置:', viteStr);

  try {
    const nuvaModules = new Function(`return ${viteStr}`)();
    return nuvaModules;
  } catch (error) {
    console.error('解析nuvaModules配置失败:', error.message);
    return [];
  }
}



// 模块文件和项目文件进行拷贝到新目录
const generateNewDir = async () => {
  const nuvaModules = replyModule();
  const tasks = nuvaModules.map(module => ({
    srcDir: path.join(process.cwd(), "node_modules", module.name),
    desDir: path.join(process.cwd(), ".vite_mom"),
    excludes: ignoreBase
  }));
  tasks.push({
    srcDir: path.join(process.cwd()),
    desDir: path.join(process.cwd(), ".vite_mom"),
    excludes: ignoreBase
  })
  logger.info("start copyfile ....")
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    logger.info(`copyfile ${task.srcDir}`)
    await copyFolder(task.srcDir, task.desDir, task.excludes);
  }
  logger.info("finish copyfile ....")
}


module.exports = {
  generateNewDir, jsOrTsFile, ignoreBase, replyModule
}
