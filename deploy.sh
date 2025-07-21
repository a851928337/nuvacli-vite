#!/bin/bash

# 设置颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 错误处理函数
handle_error() {
    echo -e "${RED}错误: $1${NC}"
    exit 1
}

# 成功消息函数
success_msg() {
    echo -e "${GREEN}✓ $1${NC}"
}

# 警告消息函数
warning_msg() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

echo "=== 开始执行发版脚本 ==="

# 检查 package.json 是否存在
if [ ! -f "package.json" ]; then
    handle_error "找不到 package.json 文件，请在项目根目录执行此脚本"
fi

# 从 package.json 读取 name 和 version
NAME=$(node -p "require('./package.json').name" 2>/dev/null)
VERSION=$(node -p "require('./package.json').version" 2>/dev/null)

if [ -z "$NAME" ] || [ -z "$VERSION" ]; then
    handle_error "无法从 package.json 中读取 name 或 version"
fi

# # 处理包名中的 @ 和 /，转换为合适的文件夹名
# FOLDER_NAME=$(echo "$NAME" | sed 's/@//g' | sed 's/\//-/g')

echo "项目名称: $NAME"
echo "项目版本: $VERSION"
# echo "目标文件夹: deploy/$FOLDER_NAME"

# 检查 deploy/.list 文件是否存在
# if [ ! -f "deploy/.list" ]; then
#     warning_msg "deploy/.list 文件不存在，创建示例文件..."
#     cat > deploy/.list << EOF
# 发版文件列表
# 每行一个文件或文件夹路径
# 以 # 开头的行将被忽略

# 示例：
# src/
# dist/
# index.html
# README.md
# EOF
#     echo -e "${YELLOW}请编辑 deploy/.list 文件，添加需要发布的文件和文件夹，然后重新运行此脚本${NC}"
#     exit 0
# fi

# # 创建目标文件夹
# TARGET_DIR="deploy/$FOLDER_NAME"
# if [ -d "$TARGET_DIR" ]; then
#     warning_msg "目标文件夹 $TARGET_DIR 已存在，将被覆盖"
#     rm -rf "$TARGET_DIR"
# fi

# mkdir -p "$TARGET_DIR"
# success_msg "创建目标文件夹: $TARGET_DIR"

# # 将发布文件夹添加到 .gitignore
# GITIGNORE_ENTRY="$TARGET_DIR/"
# if [ -f ".gitignore" ]; then
#     # 检查是否已经在 .gitignore 中
#     if ! grep -q "^${GITIGNORE_ENTRY}$" .gitignore; then
#         echo "$GITIGNORE_ENTRY" >> .gitignore
#         success_msg "已将 $GITIGNORE_ENTRY 添加到 .gitignore"
#     else
#         echo "✓ $GITIGNORE_ENTRY 已在 .gitignore 中"
#     fi
# else
#     # 创建 .gitignore 并添加条目
#     echo "$GITIGNORE_ENTRY" > .gitignore
#     success_msg "创建 .gitignore 并添加 $GITIGNORE_ENTRY"
# fi

# # 创建版本信息文件
# echo "{
#   \"name\": \"$NAME\",
#   \"version\": \"$VERSION\",
#   \"buildTime\": \"$(date +'%Y-%m-%d %H:%M:%S')\",
#   \"buildUser\": \"$(whoami)\",
#   \"buildHost\": \"$(hostname)\"
# }" > "$TARGET_DIR/version.json"
# success_msg "创建版本信息文件: $TARGET_DIR/version.json"

# 询问版本号
echo ""
# echo "当前版本: $VERSION"
read -p "请输入新版本号（直接回车自动递增补丁版本）: " NEW_VERSION

# 如果没有输入版本号，自动递增补丁版本
if [ -z "$NEW_VERSION" ]; then
    # 分解版本号为主版本.次版本.补丁版本
    IFS='.' read -r -a VERSION_PARTS <<< "$VERSION"
    MAJOR="${VERSION_PARTS[0]}"
    MINOR="${VERSION_PARTS[1]}"
    PATCH="${VERSION_PARTS[2]}"

    # 递增补丁版本
    PATCH=$((PATCH + 1))
    NEW_VERSION="$MAJOR.$MINOR.$PATCH"
    echo "自动递增版本号: $VERSION → $NEW_VERSION"
else
    # 验证版本号格式
    if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        handle_error "版本号格式不正确，应为 x.x.x 格式（如 1.0.1）"
    fi
fi

# 更新根目录的 package.json
echo ""
echo "更新版本号..."
if command -v jq >/dev/null 2>&1; then
    # 如果有 jq，使用 jq 更新
    jq ".version = \"$NEW_VERSION\"" package.json > package.json.tmp && mv package.json.tmp package.json
else
    # 否则使用 sed
    sed -i.bak "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" package.json && rm package.json.bak
fi
success_msg "更新根目录 package.json 版本号: $VERSION → $NEW_VERSION"

# 执行 npm publish
echo ""
echo "准备发布到 npm..."

# 检查是否登录 npm
# 当通过yarn运行时，需要特殊处理
if [ -n "$npm_execpath" ] && [[ "$npm_execpath" == *"yarn"* ]]; then
    echo "检测到通过 yarn 运行，跳过 npm 登录检查"
    echo "注意：请确保您已经通过 npm login 登录"
else
    if ! npm whoami >/dev/null 2>&1; then
        warning_msg "您尚未登录 npm，请先执行 npm login"
        exit 1
    fi
fi

# 执行发布
echo "执行 npm publish..."
# 强制使用npm官方registry，避免yarn环境的干扰
if npm publish --access public --registry https://registry.npmjs.org/; then
    success_msg "发布成功！"
    echo "包名: $NAME"
    echo "版本: $NEW_VERSION"
else
    handle_error "npm publish 失败"
fi

# 返回原目录
cd - >/dev/null

echo ""
success_msg "发版完成！"
