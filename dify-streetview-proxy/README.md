# Dify Street View Proxy

一个独立的代理服务器，自动将街景图片注入到 Dify API 请求中，实现 TEN Framework 与 Dify 的街景图像集成。

## 🎯 功能特性

- **透明代理**：完全兼容 Dify API，无需修改现有代码
- **自动注入**：自动获取当前街景图片并上传到 Dify
- **实时同步**：街景位置变化时自动更新图片
- **错误处理**：图片获取失败时优雅降级为纯文本模式
- **轻量级**：独立运行，不影响主项目

## 🚀 快速开始

### 1. 安装依赖并启动
```bash
cd /Users/huangboheng/WebstormProjects/recap-agent/dify-streetview-proxy
./start.sh
```

### 2. 修改 TEN Framework 配置
在 TEN Framework 的 Dify extension 配置中，将 `base_url` 修改为：

**如果TEN Framework运行在本地：**
```json
{
  "base_url": "http://localhost:8090"
}
```

**如果TEN Framework运行在Docker容器内：**
```json
{
  "base_url": "http://host.docker.internal:8090"
}
```

### 3. 确保依赖服务运行
- ✅ Playground 运行在 `http://localhost:3001`
- ✅ 街景地图组件已加载完成
- ✅ 网络可访问 Dify API

## 🔧 架构原理

```
TEN Framework ──→ Proxy Server (8090) ──→ Dify API
                       ↑
              Street View Image
           (from Playground:3001)
```

1. TEN Framework 发送聊天请求到代理服务器
2. 代理服务器从 Playground 获取当前街景图片
3. 上传图片到 Dify 文件服务，获取 `upload_file_id`
4. 修改原始请求，添加 `files` 字段
5. 转发完整请求到真实 Dify API
6. 流式返回响应给 TEN Framework

## 📋 API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/chat-messages` | POST | 代理 Dify 聊天请求（自动注入图片） |
| `/health` | GET | 健康检查和状态信息 |

## 🛠️ 配置选项

在 `server.js` 中可以修改：

```javascript
const PORT = 8090;  // 代理服务器端口
const REAL_DIFY_BASE_URL = 'https://api.dify.ai/v1';  // 真实 Dify API 地址
```

## 📝 依赖项目

| 项目 | 端口 | 作用 |
|------|------|------|
| **TEN Framework** | - | 发送 Dify 请求的主项目 |
| **Playground** | 3001 | 提供街景图片的前端应用 |
| **Dify API** | - | 真实的 Dify 服务 |

## 🔍 调试与监控

### 查看实时日志
```bash
# 方法1: 使用日志查看脚本
./logs.sh

# 方法2: 直接查看日志文件
tail -f proxy.log
```

日志包含：
- 🖼️ 街景图片获取状态
- 📤 文件上传到 Dify 的结果  
- 🔄 API 请求转发情况
- ⚠️ 错误和警告信息

## ⚠️ 注意事项

1. **端口占用**：确保 8090 端口未被占用
2. **网络连接**：需要能访问 Dify API 和 Playground
3. **图片格式**：支持 JPG、PNG 等常见格式
4. **Dify 配置**：工作流需要支持文件输入和视觉模型

## 🎯 使用场景

- **AI 街景分析**：让 AI 理解和描述当前街景
- **智能导游**：基于视觉的位置推荐和解说
- **视觉问答**：用户询问街景相关问题
- **位置识别**：自动识别建筑物、地标等

## 🚨 故障排除

| 问题 | 解决方案 |
|------|----------|
| 代理服务器启动失败 | 检查端口 8090 是否被占用 |
| 获取不到街景图片 | 确认 Playground 在 3001 端口运行 |
| Dify 请求失败 | 检查网络连接和 API Key |
| 图片上传失败 | 确认 Dify 工作流支持文件输入 |

## 📄 许可证

MIT License

---

🎉 现在你的 Dify 工作流可以看到街景了！