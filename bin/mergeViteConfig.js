const fs = require('fs');
const path = require('path');
const recast = require('recast');
const babelParser = require('@babel/parser');

const parser = {
  parse(source) {
    return babelParser.parse(source, {
      sourceType: 'module',
      plugins: ['typescript'],
    });
  },
};

function extractConfigObject(ast) {
  let configNode = null;
  recast.types.visit(ast, {
    visitCallExpression(path) {
      const { callee, arguments: args } = path.node;
      if (
        recast.types.namedTypes.Identifier.check(callee) &&
        callee.name === 'defineConfig' &&
        args.length &&
        recast.types.namedTypes.ObjectExpression.check(args[0])
      ) {
        configNode = args[0];
        return false;
      }
      this.traverse(path);
    },
  });
  return configNode;
}

function extractImports(ast) {
  const imports = [];
  recast.types.visit(ast, {
    visitImportDeclaration(path) {
      imports.push(path.node);
      this.traverse(path);
    },
  });
  return imports;
}

function mergeImportDeclarations(importGroups) {
  const seen = new Map();
  for (const imports of importGroups) {
    for (const imp of imports) {
      const source = imp.source.value;
      const key = source;
      if (!seen.has(key)) {
        seen.set(key, imp);
      } else {
        const existing = seen.get(key);
        const existingSpecifiers = new Set(existing.specifiers.map((s) => recast.print(s).code));
        for (const s of imp.specifiers) {
          const code = recast.print(s).code;
          if (!existingSpecifiers.has(code)) {
            existing.specifiers.push(s);
          }
        }
      }
    }
  }
  return [...seen.values()];
}

function mergeFieldsByStrategy(existing, incoming, strategy = {}, depth = 0, logFn = console.log) {
  const existingMap = new Map();
  for (const prop of existing.properties) {
    if (prop.key && prop.key.name) {
      existingMap.set(prop.key.name, prop);
    }
  }

  for (const prop of incoming.properties) {
    const key = prop.key.name;
    const mergeMode = strategy[key] || 'merge';
    const indent = '  '.repeat(depth);
    const existingProp = existingMap.get(key);
    const a = existingProp?.value;
    const b = prop.value;

    if (mergeMode === 'merge' && existingProp) {
      if (
        recast.types.namedTypes.ArrayExpression.check(a) &&
        recast.types.namedTypes.ArrayExpression.check(b)
      ) {
        // 数组去重：基于序列化后的字符串
        const existingItems = new Set(a.elements.map(el => recast.print(el).code));
        const newItems = [];
        let addedCount = 0;

        for (const el of b.elements) {
          const code = recast.print(el).code;
          if (!existingItems.has(code)) {
            newItems.push(el);
            existingItems.add(code);
            addedCount++;
          }
        }

        a.elements = [...a.elements, ...newItems];
        logFn(`${indent}🔧 合并字段 "${key}"：策略=merge，类型=array → 拼接 ${b.elements.length} 个项，去重后新增 ${addedCount} 个项`);
        continue;
      }

      if (
        recast.types.namedTypes.ObjectExpression.check(a) &&
        recast.types.namedTypes.ObjectExpression.check(b)
      ) {
        logFn(`${indent}🔧 合并字段 "${key}"：策略=merge，类型=object → 深度合并`);
        existingProp.value = mergeFieldsByStrategy(a, b, strategy, depth + 1, logFn);
        continue;
      }

      logFn(`${indent}⚠️ 字段 "${key}" 类型不兼容，使用 override`);
    }

    if (mergeMode === 'override') {
      logFn(`${indent}🔧 合并字段 "${key}"：策略=override → 直接覆盖`);
    }

    existingMap.set(key, prop);
  }

  return recast.types.builders.objectExpression([...existingMap.values()]);
}

function generateDefineConfig(configObject) {
  return recast.types.builders.exportDefaultDeclaration(
    recast.types.builders.callExpression(
      recast.types.builders.identifier('defineConfig'),
      [configObject]
    )
  );
}

/**
 * 合并多个 Vite 配置文件
 * @param {string[]} configPaths 配置文件路径数组
 * @param {string} outputPath 输出路径
 * @param {Record<string, 'merge'|'override'>} mergeStrategy 字段合并策略（默认全 merge）
 */
function mergeMultipleViteConfigs(configPaths, outputPath = 'vite.config.merged.ts', mergeStrategy = {}) {
  try {
    const allImports = [];
    let mergedConfig = null;

    for (const configPath of configPaths) {
      // 检查文件是否存在
      if (!fs.existsSync(configPath)) {
        console.log(`⚠️ 配置文件不存在，跳过: ${configPath}`);
        continue;
      }

      const content = fs.readFileSync(configPath, 'utf-8');
      const ast = recast.parse(content, { parser });

      const imports = extractImports(ast);
      allImports.push(imports);

      const configObject = extractConfigObject(ast);
      if (!configObject) throw new Error(`找不到 defineConfig({...}) in ${configPath}`);

      if (!mergedConfig) {
        mergedConfig = configObject;
      } else {
        mergedConfig = mergeFieldsByStrategy(mergedConfig, configObject, mergeStrategy, 0, console.log);
      }
    }

    // 如果没有找到任何有效的配置文件
    if (!mergedConfig) {
      console.log('❌ 没有找到任何有效的配置文件');
      return false;
    }

    const importDecls = mergeImportDeclarations(allImports);
    const ast = recast.types.builders.program([
      ...importDecls,
      generateDefineConfig(mergedConfig),
    ]);

    const code = recast.print(ast, { tabWidth: 2 }).code;
    fs.writeFileSync(outputPath, code, 'utf-8');
    console.log(`\n✅ 合并成功，配置已写入 ${outputPath}`);
    return true
  } catch (e) {
    console.log(`\n❌ 合并失败:`, e);
    return false
  }

}

module.exports = {
  mergeMultipleViteConfigs,
};
