const chokidar = require("chokidar");
const { replyModule, ignoreBase } = require("./utils");
const fs = require("fs");
const { promises: fsPromises } = fs;
const path = require("path");

// 处理文件复制的函数，特殊处理 package.json
async function handleFileCopy(src, dest) {
  // // 检查是否是 package.json 文件
  // if (path.basename(src) === 'package.json') {
  //   const success = await mergePackageJson(src, dest);
  //   // 如果合并失败，使用普通复制
  //   if (!success) {
  //     return await copyFileWithRetry(src, dest);
  //   }
  //   return success;
  // } else if (path.basename(src) === 'vite.config.ts') {
  //   const success = await mergeMultipleViteConfigs([src, dest], dest);
  //   // 如果合并失败，使用普通复制
  //   if (!success) {
  //     return await copyFileWithRetry(src, dest);
  //   }
  //   return success;
  // } else {
  //   // 其他文件使用重试复制
  //   return await copyFileWithRetry(src, dest);
  // }
  if (!['package.json', 'vite.config.ts'].includes(path.basename(src))) {
    return await copyFileWithRetry(src, dest);
  }
}

function copyFileWithRetry(src, dest, retries = 5, delay = 500) {
  return new Promise((resolve, reject) => {
    const attemptCopy = (remainingRetries) => {
      fs.copyFile(src, dest, (err) => {
        if (err) {
          if (remainingRetries > 0) {
            setTimeout(() => attemptCopy(remainingRetries - 1), delay);
          } else {
            reject(err);
          }
        } else {
          resolve();
        }
      });
    };

    attemptCopy(retries);
  });
}

// 文件监听
const watchRootDir = () => {
  const nuvaModules = replyModule();
  const watcher = chokidar.watch(".", { ignored: ignoreBase });

  watcher
    .on("add", async (path) => {
      await handleFileCopy(`${path}`, `.vite_mom/${path}`).catch((err) =>
        console.error("Error copying file:", err)
      );
    })
    .on("addDir", async (path) => {
      if (!(await fsPromises.stat(`.vite_mom/${path}`).catch(() => false))) {
        await fsPromises.mkdir(`.vite_mom/${path}`, { recursive: true });
      }
    })
    .on("unlink", async (path) => {
      if (nuvaModules.length) {
        await handleFileCopy(
          `node_modules/${nuvaModules[nuvaModules.length - 1].name}/${path}`,
          `.vite_mom/${path}`
        ).catch((err) => console.error("Error copying file:", err));
      } else if (fs.existsSync(`.vite_mom/${path}`)) {
        // 删除文件
        fs.unlink(".vite_mom/" + path, (err) => { });
      }
    })
    .on("change", async (path) => {
      await handleFileCopy(`${path}`, `.vite_mom/${path}`).catch((err) =>
        console.error("Error copying file:", err)
      );
    })
    .on("error", (error) => console.log(`Watcher error: ${error}`))
    .on("ready", () => console.log("Initial scan complete. Ready for changes"));
};

watchRootDir();
