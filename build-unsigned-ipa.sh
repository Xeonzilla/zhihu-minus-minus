#!/bin/bash

# 遇到任何错误立即退出
set -e

# 获取脚本所在目录作为项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "🚀 [1/3] 开始生成 iOS 原生工程 (Expo Prebuild)..."
# 如果 ios 目录不存在则进行 prebuild
if [ ! -d "ios" ]; then
  npx expo prebuild --platform ios
else
  echo "✨ ios 目录已存在，跳过 prebuild 步骤。"
fi

echo "📦 [2/3] 开始编译 iOS App 产物 (未签名 Release)..."
xcodebuild -workspace ios/app.xcworkspace \
  -scheme app \
  -configuration Release \
  -sdk iphoneos \
  SYMROOT="$PROJECT_ROOT/build" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGN_ENTITLEMENTS="" \
  clean build

echo "🗜️ [3/3] 开始打包成 .ipa 文件..."
APP_VERSION=$(node -p "require('./package.json').version")
IPA_NAME="zhihu-minus-minus-v${APP_VERSION}-unsigned.ipa"

# 清理可能存在的旧包和临时目录
rm -f zhihu-minus-minus-v*.ipa
rm -rf Payload

# 打包
mkdir -p Payload
cp -r build/Release-iphoneos/*.app Payload/
zip -r "$IPA_NAME" Payload

# 清理临时 Payload 文件夹
rm -rf Payload

echo "✅ 打包完成！未签名 IPA 生成成功！"
echo "👉 产物路径: $PROJECT_ROOT/$IPA_NAME"
