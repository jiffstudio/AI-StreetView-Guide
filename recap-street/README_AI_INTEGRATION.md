# 街景AI导游集成指南

## 🚀 快速开始

### 1. 安装依赖
```bash
# 前端依赖
npm install

# 后端依赖
pip install google-generativeai python-socketio uvicorn pillow
```

### 2. 配置API密钥

#### Agora RTC 配置
- App ID: `d83b679bc7b3406c83f63864cb74aa99` (已配置)

#### Google Gemini API 配置
- API Key: `AIzaSyBt6CaRmn0WwVuiRYw9WyByjE2H1DZ2QoM` (已配置)
- 使用 Gemini Pro Vision 模型进行图像分析

### 3. 测试和启动

#### 测试Gemini连接
```bash
python test_gemini.py
```

#### 测试图像分析
```bash
python test_image_analysis.py
```

#### 启动后端服务
```bash
python start_ai_guide.py
# 或者直接运行
python ten_agent_server.py
```

#### 启动前端应用
```bash
npm install
npm run dev
```

## 🎯 功能特性

### AI导游模式
- **自动探索**: AI分析街景并自动选择下一个方向
- **场景描述**: 实时描述看到的建筑、标识和有趣细节
- **文字识别**: OCR识别街景中的文字内容
- **智能决策**: 基于视觉内容选择最有趣的探索路径

### 语音交互
- **语音输入**: 通过麦克风与AI对话
- **语音输出**: AI回复转换为语音播放
- **实时对话**: 边探索边聊天的沉浸式体验
- **多语言支持**: 支持中英文语音交互

### 技术架构
```
前端 React App
    ↓
AIGuideService (Agora RTC + Socket.IO)
    ↓
Python Server (Socket.IO)
    ↓
Google Gemini Pro Vision
```

## 🔧 高级配置

### AI个性化设置
```typescript
const aiConfig = {
  personality: 'friendly',    // friendly | professional | enthusiastic
  autoExplore: true,         // 自动探索模式
  voiceEnabled: true,        // 语音交互
  explorationSpeed: 3000,    // 自动移动间隔(ms)
};
```

### 语音参数调整
```typescript
const voiceConfig = {
  language: 'zh-CN',         // 语音识别语言
  continuous: true,          // 连续识别
  interimResults: true,      // 实时结果
};
```

## 🎮 使用方法

### 基础操作
1. **启动AI导游**: 点击 "🤖 启动AI" 按钮
2. **语音交互**: 点击麦克风按钮开始语音对话
3. **自动探索**: AI会自动分析并选择下一个方向
4. **手动控制**: 随时可以手动选择方向

### 语音命令示例
- "这是什么地方？"
- "带我去有趣的地方"
- "告诉我这个建筑的信息"
- "慢一点" / "快一点"
- "停止自动探索"

### AI回复示例
- 场景描述: "我们现在在拉斯维加斯大道上，前方是贝拉吉奥酒店..."
- 导航建议: "左边有一家有趣的艺术画廊，让我们去看看..."
- 实时解说: "注意看那个霓虹灯标牌，上面写着..."

## 🛠️ 开发扩展

### 添加新的AI模型
```python
# 在 ten_agent_server.py 中
class CustomAIExtension(StreetViewAIExtension):
    def __init__(self):
        super().__init__()
        self.custom_model = load_custom_model()
    
    async def analyze_with_custom_model(self, image_data):
        # 自定义AI分析逻辑
        pass
```

### 集成其他语音服务
```typescript
// 替换默认的Web Speech API
import { ElevenLabsService } from './ElevenLabsService';

const ttsService = new ElevenLabsService({
  apiKey: 'your_elevenlabs_key',
  voice: 'friendly_guide'
});
```

## 🐛 故障排除

### 常见问题
1. **语音不工作**: 检查浏览器麦克风权限
2. **AI无响应**: 确认后端服务运行正常
3. **音频质量差**: 调整Agora RTC音频参数
4. **API限制**: 检查OpenAI API配额

### 调试模式
```typescript
// 启用详细日志
const aiService = new AIGuideService({
  ...config,
  debug: true
});
```

## 📈 性能优化

### 图像压缩
```typescript
const compressImage = (canvas: HTMLCanvasElement): string => {
  return canvas.toDataURL('image/jpeg', 0.6); // 降低质量减少传输
};
```

### 缓存策略
```typescript
// 缓存AI分析结果
const analysisCache = new Map<string, StreetViewAnalysis>();
```

## 🔒 安全考虑

1. **API密钥安全**: 使用环境变量存储敏感信息
2. **用户隐私**: 语音数据不存储，仅用于实时处理
3. **访问控制**: 限制API调用频率
4. **数据加密**: 传输过程中加密敏感数据

## 📚 参考资源

- [TEN Framework 文档](https://github.com/TEN-framework/TEN-Agent)
- [Agora RTC SDK](https://docs.agora.io/en/voice-calling/get-started/get-started-sdk)
- [OpenAI API 文档](https://platform.openai.com/docs)
- [Google Street View API](https://developers.google.com/maps/documentation/streetview)