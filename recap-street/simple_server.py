#!/usr/bin/env python3
"""
简化的街景AI导游服务器 - 使用Gemini但不使用function calling
"""

import asyncio
import base64
import json
import logging
import os
from datetime import datetime
from PIL import Image
import io

import socketio
from aiohttp import web
import google.generativeai as genai

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SimpleStreetViewAI:
    def __init__(self):
        # 设置代理
        self.setup_proxy()
        
        # 配置 Gemini
        genai.configure(api_key="AIzaSyBt6CaRmn0WwVuiRYw9WyByjE2H1DZ2QoM")
        self.model = genai.GenerativeModel('gemini-1.5-flash')
        
        logger.info("Simple Street View AI initialized")
    
    def setup_proxy(self):
        """设置代理"""
        proxy_url = "http://localhost:7890"
        os.environ['HTTP_PROXY'] = proxy_url
        os.environ['HTTPS_PROXY'] = proxy_url
        os.environ['http_proxy'] = proxy_url
        os.environ['https_proxy'] = proxy_url
        logger.info(f"设置代理: {proxy_url}")
    
    async def analyze_streetview(self, image_data: str, options: list, visited_history: list = None) -> dict:
        """分析街景图像"""
        try:
            logger.info(f"开始分析街景，选项数量: {len(options)}")
            
            # 处理图像数据
            original_data = image_data
            if image_data.startswith('data:image'):
                image_data = image_data.split(',')[1]
            
            logger.info(f"原始图像数据长度: {len(original_data)} 字符")
            logger.info(f"Base64数据长度: {len(image_data)} 字符")
            
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))
            
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            logger.info(f"图像处理完成: {image.size}, 模式: {image.mode}")
            
            # 检查图像内容（简单的像素分析）
            pixels = list(image.getdata())
            unique_colors = len(set(pixels[:100]))  # 检查前100个像素的颜色多样性
            logger.info(f"图像颜色多样性: {unique_colors} 种不同颜色（前100像素）")
            
            # 保存调试图像（可选）
            # image.save(f"debug_image_{datetime.now().strftime('%H%M%S')}.jpg")
            
            # 构建提示
            prompt = self.build_prompt(options, visited_history)
            
            # 调用Gemini
            logger.info("调用Gemini API...")
            response = self.model.generate_content([prompt, image])
            
            logger.info("Gemini响应成功")
            logger.info(f"Gemini原始响应: {response.text[:200]}...")
            
            # 解析响应
            result = self.parse_response(response.text, options)
            
            logger.info(f"分析完成: {result['voiceResponse'][:50]}...")
            
            return result
            
        except Exception as e:
            logger.error(f"分析失败: {e}")
            import traceback
            logger.error(f"详细错误: {traceback.format_exc()}")
            return self.get_fallback_response(options)
    
    def build_prompt(self, options: list, visited_history: list = None) -> str:
        """构建分析提示"""
        prompt = """
你是一个专业的AI街景导游，正在拉斯维加斯带领用户探索。请分析这张图像（可能是真实街景或位置信息图）。

当前位置：拉斯维加斯大道 (Las Vegas Strip)
可选探索方向：
"""
        for i, option in enumerate(options):
            prompt += f"{i}. {option['description']} (方向: {option['heading']}°)\n"
        
        # 添加访问历史信息
        if visited_history:
            prompt += f"\n最近访问过的位置ID（避免重复访问）:\n"
            for i, pano_id in enumerate(visited_history[-5:]):  # 只显示最近5个
                prompt += f"- {pano_id}\n"
        
        prompt += """
作为专业导游，请：
1. 分析图像内容（如果是位置信息图，请基于文字信息分析）
2. 识别图像中的所有文字和地点信息
3. 基于拉斯维加斯的地理知识，智能选择最有趣的探索方向
4. 重要：避免选择会导致返回到最近访问过位置的方向
5. 考虑以下因素来选择方向：
   - Las Vegas Blvd（拉斯维加斯大道）通常最有趣
   - 数字较小的NV-592通常靠近市中心
   - 优先选择能发现新景点的方向
   - 避免来回重复的路径

请严格按照以下JSON格式回复：

{
    "sceneDescription": "基于图像内容描述当前位置的情况",
    "detectedText": ["从图像中识别的文字"],
    "landmarks": ["附近的地标或有趣地点"],
    "recommendedOptionIndex": 0,
    "recommendationReason": "详细解释选择理由，说明为什么这个方向比其他方向更好，以及如何避免重复访问",
    "voiceResponse": "用热情导游的语调解释选择，强调新发现和探索价值"
}

重要提示：
- recommendedOptionIndex 必须是 0 到 """ + str(len(options)-1) + """ 之间的数字
- 绝对避免选择会导致重复访问最近位置的方向
- 优先选择能带来新体验的探索路径
- 语音回复要体现探索的新鲜感和拉斯维加斯的魅力
"""
        return prompt
    
    def parse_response(self, response_text: str, options: list) -> dict:
        """解析Gemini响应"""
        try:
            # 清理响应文本
            clean_text = response_text.strip()
            if clean_text.startswith('```json'):
                clean_text = clean_text[7:]
            if clean_text.endswith('```'):
                clean_text = clean_text[:-3]
            clean_text = clean_text.strip()
            
            # 解析JSON
            parsed = json.loads(clean_text)
            
            # 处理推荐方向
            option_index = parsed.get('recommendedOptionIndex', 0)
            if 0 <= option_index < len(options):
                selected_option = options[option_index]
                next_direction = {
                    "panoId": selected_option["panoId"],
                    "heading": selected_option["heading"],
                    "reason": parsed.get('recommendationReason', '继续探索')
                }
            else:
                next_direction = None
            
            return {
                "sceneDescription": parsed.get('sceneDescription', ''),
                "detectedText": parsed.get('detectedText', []),
                "landmarks": parsed.get('landmarks', []),
                "nextDirection": next_direction,
                "voiceResponse": parsed.get('voiceResponse', '让我们继续探索吧！')
            }
            
        except Exception as e:
            logger.error(f"响应解析失败: {e}")
            logger.error(f"原始响应: {response_text}")
            return self.get_fallback_response(options)
    
    def get_fallback_response(self, options: list) -> dict:
        """备用响应"""
        import random
        
        selected_option = options[0] if options else None
        
        return {
            "sceneDescription": "我看到了一个有趣的街景场景",
            "detectedText": [],
            "landmarks": [],
            "nextDirection": {
                "panoId": selected_option["panoId"] if selected_option else None,
                "heading": selected_option["heading"] if selected_option else 0,
                "reason": "让我们继续探索"
            } if selected_option else None,
            "voiceResponse": "让我们继续这次街景探索之旅吧！"
        }

# 创建AI实例
ai_guide = SimpleStreetViewAI()

# Socket.IO 服务器
sio = socketio.AsyncServer(cors_allowed_origins="*")
app = web.Application()
sio.attach(app)

@sio.event
async def connect(sid, environ):
    logger.info(f"客户端 {sid} 已连接")

@sio.event
async def disconnect(sid):
    logger.info(f"客户端 {sid} 已断开连接")

@sio.event
async def analyze_streetview(sid, data):
    """处理街景分析请求"""
    try:
        logger.info(f"收到分析请求来自 {sid}")
        
        current_image = data.get("currentImage", "")
        available_options = data.get("availableOptions", [])
        visited_history = data.get("visitedHistory", [])
        
        if not current_image:
            await sio.emit('ai_response', {
                "voiceResponse": "没有收到图像数据，请重试"
            }, room=sid)
            return
        
        if not available_options:
            await sio.emit('ai_response', {
                "voiceResponse": "没有可选的探索方向"
            }, room=sid)
            return
        
        # 使用Gemini分析，包含访问历史
        result = await ai_guide.analyze_streetview(current_image, available_options, visited_history)
        
        await sio.emit('ai_response', result, room=sid)
        
    except Exception as e:
        logger.error(f"处理分析请求失败: {e}")
        await sio.emit('ai_response', {
            "voiceResponse": "分析过程中出现错误，请稍后重试"
        }, room=sid)

@sio.event
async def voice_input(sid, data):
    """处理语音输入"""
    try:
        logger.info(f"收到语音输入来自 {sid}")
        
        response = {
            "voiceResponse": "我听到了您的指令，让我继续为您分析街景环境。"
        }
        
        await sio.emit('ai_response', response, room=sid)
        
    except Exception as e:
        logger.error(f"语音处理失败: {e}")

# 健康检查
async def health_check(request):
    return web.json_response({
        'status': 'healthy',
        'service': 'Simple Street View AI Guide',
        'timestamp': datetime.now().isoformat()
    })

# HTTP分析端点
async def analyze_http(request):
    """HTTP分析端点"""
    try:
        data = await request.json()
        logger.info("收到HTTP分析请求")
        
        current_image = data.get("image", "")
        available_options = data.get("options", [])
        visited_history = data.get("visitedHistory", [])
        
        if not current_image:
            return web.json_response({
                "voiceResponse": "没有收到图像数据，请重试"
            }, status=400)
        
        if not available_options:
            return web.json_response({
                "voiceResponse": "没有可选的探索方向"
            }, status=400)
        
        # 使用Gemini分析
        result = await ai_guide.analyze_streetview(current_image, available_options, visited_history)
        
        return web.json_response(result)
        
    except Exception as e:
        logger.error(f"HTTP分析请求失败: {e}")
        return web.json_response({
            "voiceResponse": "分析过程中出现错误，请稍后重试"
        }, status=500)

# 添加CORS中间件
@web.middleware
async def cors_middleware(request, handler):
    if request.method == 'OPTIONS':
        return web.Response(
            headers={
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        )
    
    response = await handler(request)
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

app.middlewares.append(cors_middleware)
app.router.add_get('/health', health_check)
app.router.add_post('/analyze', analyze_http)

if __name__ == '__main__':
    logger.info("🚀 启动简化版街景AI导游服务器...")
    logger.info("📍 服务地址: http://localhost:8080")
    web.run_app(app, host='localhost', port=8080)