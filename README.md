Mom Web 应用新一代构建工具
1. mom运行包生成
2. 监听代码变化快速同步执行
3. 原生vue-cli-service运行环境
4. 更小的安装包跟依赖，开发人员可以根据需要再应用中自行添加依赖
5. 支持项目添加module.config.js或module.config.ts文件，配置。开发者根据需要的模块进行配置，从上往下顺序添加
   安装

# 推荐使用 Yarn 来安装依赖

yarn add @mega-apps/nuvavite-clie --dev

# 或使用 pnPm 安装依赖

pnpm add -D @mega-apps/nuvavite-cli

# 配置

`vite.config.ts`项目根目录添加nuvaModules 表示要引入的包，igNoreWacthFiles不需要拷贝的目录
```js
const viteConfig = defineConfig((mode: ConfigEnv) => {
	const env = loadEnv(mode.mode, process.cwd());
	const { dependencies, devDependencies, name, version } = pkg;
	const __APP_INFO__ = {
		pkg: { dependencies, devDependencies, name, version },
		lastBuildTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
	};
	return {
		nuvaModules:[{
			name:"@mega-apps/vue3testpk"
		}],
		igNoreWacthFiles:["src/2222"],
		plugins: [
			vue(),
			vueJsx(),
			vueSetupExtend(),
			AutoImport({
				resolvers: [ElementPlusResolver()],
			}),
			viteCompression(),
			JSON.parse(env.VITE_OPEN_CDN) ? buildConfig.cdn() : null,
		],
```

配置`package.json`文件
```json
{
  "scripts": {
    "dev": "nuvavite-cli",
    "build":"nuvavite-clibuild"
  }
}
```
