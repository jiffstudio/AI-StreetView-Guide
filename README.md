# AI StreetView Guide

[中文](#中文) | [English](#english)

---

## 中文

一个基于AI的自主街景导航系统，结合了Google街景和人工智能，可以自动分析街景图像并进行智能导航。

### 系统架构

本项目采用分离式架构，包含以下核心组件：

1. **TEN Framework Playground** - 基于React的前端界面，集成Google街景地图
2. **Dify Proxy Server** - 独立的代理服务器，负责图像上传和AI决策解析
3. **Dify AI平台** - 提供GPT-4 Vision分析和决策能力

#### 数据流程
```
TEN Framework → Dify API → AI分析 → 代理服务器解析 → 控制街景移动
```

### 核心功能

- 🗺️ **实时街景浏览** - 集成Google Street View API
- 🤖 **AI自主导航** - GPT-4 Vision分析街景图像并自动选择移动方向
- 🎯 **智能决策** - 基于视觉分析的路径选择
- 📸 **图像传输** - 自动捕获并上传街景图像到AI分析服务
- 🔄 **实时控制** - 代理服务器实时解析AI决策并控制地图移动

### 快速开始

#### 环境要求
- Node.js 18+
- Docker (用于TEN Framework后端)
- Google Maps API Key
- Dify平台账号

#### 1. 克隆项目
```bash
git clone git@github.com:jiffstudio/AI-StreetView-Guide.git
cd AI-StreetView-Guide
```

#### 2. 配置环境变量

##### TEN Framework Playground配置
```bash
cd ten-framework/ai_agents/playground
cp .env.example .env.local
```

编辑 `.env.local` 文件，填入你的API密钥：
```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=你的Google_Maps_API密钥
AGORA_APP_ID=你的Agora应用ID
DEEPGRAM_API_KEY=你的Deepgram API密钥
ELEVENLABS_API_KEY=你的ElevenLabs API密钥
```

#### 3. 启动TEN Framework
```bash
cd ten-framework
# 确保Docker已启动
docker compose up -d
```

等待所有容器启动完成后：
```bash
cd ai_agents/playground
npm install
npm run dev
```

#### 4. 启动代理服务器
```bash
cd dify-streetview-proxy
npm install
node server.js
```

#### 5. 访问应用
- 打开浏览器访问: http://localhost:3001
- 点击麦克风开始语音对话
- AI将自动分析街景并进行导航

### 项目结构

```
AI-StreetView-Guide/
├── ten-framework/                 # TEN Framework主项目
│   └── ai_agents/playground/      # React前端应用
│       ├── src/components/StreetView/  # 街景组件
│       └── src/app/api/          # API路由
├── dify-streetview-proxy/        # 独立代理服务器
│   ├── server.js                # 主服务器文件
│   └── temp/                    # 临时文件目录
└── README.md                    # 项目说明
```

### API接口

#### 代理服务器端点
- `POST /chat-messages` - 代理Dify聊天接口，自动注入街景图像
- `GET /health` - 健康检查

#### 前端API路由
- `GET/POST /api/current-streetview` - 街景图像存储
- `GET/POST /api/current-links` - 邻近链接信息
- `POST /api/streetview-control` - 街景控制命令

### 配置说明

#### Google Maps API
需要启用以下API：
- Maps JavaScript API
- Street View Static API

#### Dify平台配置
1. 创建新的AI应用
2. 配置GPT-4 Vision模型
3. 设计街景分析工作流
4. 获取API密钥

### 开发说明

#### 核心技术栈
- **前端**: Next.js, React, TypeScript, Google Maps API
- **后端**: Node.js, Express
- **AI服务**: Dify平台, GPT-4 Vision
- **语音服务**: Agora RTC, Deepgram ASR, ElevenLabs TTS

#### 关键实现
1. **图像捕获**: 使用Google Street View Static API获取当前视角图像
2. **AI分析**: 将图像上传至Dify平台进行GPT-4 Vision分析
3. **决策解析**: 代理服务器解析AI返回的JSON决策
4. **地图控制**: 通过API调用控制街景地图移动

### 故障排除

#### 常见问题
1. **Docker容器启动失败**: 检查Docker设置，确保已分配足够资源
2. **API密钥错误**: 验证所有环境变量配置正确
3. **网络连接问题**: 确保代理服务器可以访问localhost:3001

#### 日志查看
```bash
# 查看代理服务器日志
tail -f dify-streetview-proxy/proxy.log

# 查看TEN Framework日志
docker compose logs -f
```

---

## English

An AI-powered autonomous street view navigation system that combines Google Street View with artificial intelligence to automatically analyze street view images and perform intelligent navigation.

### System Architecture

This project uses a decoupled architecture with the following core components:

1. **TEN Framework Playground** - React-based frontend interface with integrated Google Street View map
2. **Dify Proxy Server** - Independent proxy server responsible for image upload and AI decision parsing
3. **Dify AI Platform** - Provides GPT-4 Vision analysis and decision-making capabilities

#### Data Flow
```
TEN Framework → Dify API → AI Analysis → Proxy Server Parsing → Control Street View Movement
```

### Core Features

- 🗺️ **Real-time Street View** - Integrated Google Street View API
- 🤖 **AI Autonomous Navigation** - GPT-4 Vision analyzes street view images and automatically selects movement directions
- 🎯 **Intelligent Decisions** - Path selection based on visual analysis
- 📸 **Image Transmission** - Automatically captures and uploads street view images to AI analysis service
- 🔄 **Real-time Control** - Proxy server parses AI decisions in real-time and controls map movement

### Quick Start

#### Requirements
- Node.js 18+
- Docker (for TEN Framework backend)
- Google Maps API Key
- Dify platform account

#### 1. Clone the Project
```bash
git clone git@github.com:jiffstudio/AI-StreetView-Guide.git
cd AI-StreetView-Guide
```

#### 2. Configure Environment Variables

##### TEN Framework Playground Configuration
```bash
cd ten-framework/ai_agents/playground
cp .env.example .env.local
```

Edit the `.env.local` file and fill in your API keys:
```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
AGORA_APP_ID=your_agora_app_id
DEEPGRAM_API_KEY=your_deepgram_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

#### 3. Start TEN Framework
```bash
cd ten-framework
# Make sure Docker is running
docker compose up -d
```

After all containers are started:
```bash
cd ai_agents/playground
npm install
npm run dev
```

#### 4. Start Proxy Server
```bash
cd dify-streetview-proxy
npm install
node server.js
```

#### 5. Access the Application
- Open browser and visit: http://localhost:3001
- Click the microphone to start voice conversation
- AI will automatically analyze street view and navigate

### Project Structure

```
AI-StreetView-Guide/
├── ten-framework/                 # Main TEN Framework project
│   └── ai_agents/playground/      # React frontend application
│       ├── src/components/StreetView/  # Street view components
│       └── src/app/api/          # API routes
├── dify-streetview-proxy/        # Independent proxy server
│   ├── server.js                # Main server file
│   └── temp/                    # Temporary files directory
└── README.md                    # Project documentation
```

### API Endpoints

#### Proxy Server Endpoints
- `POST /chat-messages` - Proxy Dify chat interface, automatically inject street view images
- `GET /health` - Health check

#### Frontend API Routes
- `GET/POST /api/current-streetview` - Street view image storage
- `GET/POST /api/current-links` - Adjacent links information
- `POST /api/streetview-control` - Street view control commands

### Configuration

#### Google Maps API
Enable the following APIs:
- Maps JavaScript API
- Street View Static API

#### Dify Platform Configuration
1. Create a new AI application
2. Configure GPT-4 Vision model
3. Design street view analysis workflow
4. Obtain API key

### Development

#### Core Tech Stack
- **Frontend**: Next.js, React, TypeScript, Google Maps API
- **Backend**: Node.js, Express
- **AI Service**: Dify Platform, GPT-4 Vision
- **Voice Services**: Agora RTC, Deepgram ASR, ElevenLabs TTS

#### Key Implementation
1. **Image Capture**: Use Google Street View Static API to get current view images
2. **AI Analysis**: Upload images to Dify platform for GPT-4 Vision analysis
3. **Decision Parsing**: Proxy server parses AI returned JSON decisions
4. **Map Control**: Control street view map movement through API calls

### Troubleshooting

#### Common Issues
1. **Docker container startup failure**: Check Docker settings, ensure sufficient resources are allocated
2. **API key errors**: Verify all environment variables are configured correctly
3. **Network connection issues**: Ensure proxy server can access localhost:3001

#### Log Viewing
```bash
# View proxy server logs
tail -f dify-streetview-proxy/proxy.log

# View TEN Framework logs
docker compose logs -f
```

## License

This project is for learning and research purposes only.

## Contributing

Issues and Pull Requests are welcome!

---

**Note**: Please ensure you protect your API keys properly and do not commit them to public repositories.