#!/usr/bin/env python3
"""
简化的测试服务器 - 模拟TEN Agent功能
用于测试AI街景导游系统
"""

import asyncio
import json
import logging
import random
from datetime import datetime

import socketio
from aiohttp import web

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 创建Socket.IO服务器
sio = socketio.AsyncServer(
    cors_allowed_origins="*",
    logger=True,
    engineio_logger=True
)

# 模拟AI响应数据
MOCK_RESPONSES = [
    {
        "sceneDescription": "这里是拉斯维加斯大道的中心地带，我看到华丽的赌场建筑和闪烁的霓虹灯标识。",
        "detectedText": ["CASINO", "HOTEL", "WELCOME TO LAS VEGAS", "BUFFET"],
        "landmarks": ["贝拉吉奥酒店", "音乐喷泉", "凯撒宫"],
        "voiceResponse": "哇！我们现在在著名的拉斯维加斯大道上，前方是贝拉吉奥酒店，以其壮观的音乐喷泉而闻名。让我们向前走去看看那些华丽的建筑吧！"
    },
    {
        "sceneDescription": "前方有一座现代化的商业建筑，玻璃幕墙反射着周围的灯光。",
        "detectedText": ["SHOPPING", "MALL", "OPEN 24/7", "PARKING"],
        "landmarks": ["购物中心", "停车场"],
        "voiceResponse": "我看到前方有一个大型购物中心，24小时营业呢！里面应该有很多有趣的商店和餐厅。要不要去探索一下？"
    },
    {
        "sceneDescription": "这里是一个繁忙的十字路口，有很多行人和车辆经过。",
        "detectedText": ["STOP", "WALK", "DON'T WALK", "TAXI"],
        "landmarks": ["交通信号灯", "人行横道"],
        "voiceResponse": "我们来到了一个热闹的十字路口，这里人来人往，很有城市的活力。注意看那些交通标识，这就是典型的美国街道景象。"
    }
]

@sio.event
async def connect(sid, environ):
    logger.info(f"客户端 {sid} 已连接")
    await sio.emit('connection_status', {'status': 'connected', 'message': 'AI导游服务已连接'}, room=sid)

@sio.event
async def disconnect(sid):
    logger.info(f"客户端 {sid} 已断开连接")

@sio.event
async def analyze_streetview(sid, data):
    """处理街景分析请求"""
    try:
        logger.info(f"收到来自 {sid} 的街景分析请求")
        
        # 模拟AI处理时间
        await asyncio.sleep(1)
        
        # 随机选择一个响应
        base_response = random.choice(MOCK_RESPONSES)
        
        # 如果有可选方向，选择一个作为推荐
        available_options = data.get("availableOptions", [])
        next_direction = None
        
        if available_options:
            selected_option = random.choice(available_options)
            next_direction = {
                "panoId": selected_option["panoId"],
                "heading": selected_option["heading"],
                "reason": f"我觉得{selected_option.get('description', '这个方向')}看起来很有趣，让我们去探索一下吧！"
            }
        
        # 构建响应
        response = {
            **base_response,
            "nextDirection": next_direction,
            "timestamp": datetime.now().isoformat(),
            "analysisId": f"analysis_{sid}_{datetime.now().timestamp()}"
        }
        
        logger.info(f"发送AI分析结果给 {sid}")
        await sio.emit('ai_response', response, room=sid)
        
    except Exception as e:
        logger.error(f"街景分析失败: {e}")
        await sio.emit('ai_error', {"error": str(e), "message": "AI分析出现错误，请稍后重试"}, room=sid)

@sio.event
async def voice_input(sid, data):
    """处理语音输入"""
    try:
        logger.info(f"收到来自 {sid} 的语音输入")
        
        # 模拟语音处理时间
        await asyncio.sleep(0.5)
        
        # 模拟语音识别结果
        voice_responses = [
            "我听到了您的指令，让我为您分析一下周围的环境。",
            "好的，我明白了。让我看看这里有什么有趣的地方。",
            "收到！我会根据您的喜好来选择探索方向。",
            "明白了，让我们继续我们的街景之旅吧！"
        ]
        
        response = {
            "voiceResponse": random.choice(voice_responses),
            "recognized_text": "用户语音指令已识别",
            "timestamp": datetime.now().isoformat()
        }
        
        await sio.emit('ai_response', response, room=sid)
        
    except Exception as e:
        logger.error(f"语音处理失败: {e}")
        await sio.emit('ai_error', {"error": str(e), "message": "语音处理出现错误"}, room=sid)

@sio.event
async def test_connection(sid, data):
    """测试连接"""
    logger.info(f"测试连接请求来自 {sid}")
    await sio.emit('test_response', {
        'status': 'ok',
        'message': 'AI导游服务运行正常',
        'timestamp': datetime.now().isoformat()
    }, room=sid)

# 创建web应用
app = web.Application()
sio.attach(app)

# 添加健康检查端点
async def health_check(request):
    return web.json_response({
        'status': 'healthy',
        'service': 'AI Street View Guide',
        'timestamp': datetime.now().isoformat()
    })

app.router.add_get('/health', health_check)

# 添加静态文件服务（如果需要）
async def index(request):
    return web.Response(text="""
    <h1>AI街景导游测试服务器</h1>
    <p>服务器运行正常，等待客户端连接...</p>
    <p>WebSocket端点: ws://localhost:8080/socket.io/</p>
    """, content_type='text/html')

app.router.add_get('/', index)

if __name__ == '__main__':
    print("🚀 启动AI街景导游测试服务器...")
    print("📍 服务地址: http://localhost:8080")
    print("🔌 WebSocket: ws://localhost:8080/socket.io/")
    print("💡 这是一个模拟服务器，用于测试前端功能")
    
    web.run_app(app, host='localhost', port=8080)