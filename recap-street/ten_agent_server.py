#!/usr/bin/env python3
"""
TEN Agent 服务器 - 街景AI导游 (使用 Gemini)
需要安装: pip install google-generativeai python-socketio uvicorn pillow
"""

import asyncio
import base64
import json
import logging
from typing import Dict, List, Optional
import io
from PIL import Image

import socketio
import google.generativeai as genai

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class StreetViewAIGuide:
    def __init__(self):
        # 设置代理
        self.setup_proxy()
        
        # 配置 Gemini
        genai.configure(api_key="AIzaSyBt6CaRmn0WwVuiRYw9WyByjE2H1DZ2QoM")
        
        # 定义function calling schema (使用正确的Gemini格式)
        self.analyze_streetview_function = genai.protos.FunctionDeclaration(
            name="analyze_streetview",
            description="分析街景图像并提供探索建议",
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "sceneDescription": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="详细描述当前街景中看到的内容，包括建筑、商店、标识等"
                    ),
                    "detectedText": genai.protos.Schema(
                        type=genai.protos.Type.ARRAY,
                        items=genai.protos.Schema(type=genai.protos.Type.STRING),
                        description="图像中识别到的所有文字内容，如招牌、标识、广告等"
                    ),
                    "landmarks": genai.protos.Schema(
                        type=genai.protos.Type.ARRAY,
                        items=genai.protos.Schema(type=genai.protos.Type.STRING),
                        description="识别出的著名地标或有趣建筑"
                    ),
                    "recommendedDirection": genai.protos.Schema(
                        type=genai.protos.Type.OBJECT,
                        properties={
                            "optionIndex": genai.protos.Schema(
                                type=genai.protos.Type.INTEGER,
                                description="推荐的方向选项索引（从0开始）"
                            ),
                            "reason": genai.protos.Schema(
                                type=genai.protos.Type.STRING,
                                description="选择这个方向的详细理由"
                            )
                        },
                        required=["optionIndex", "reason"]
                    ),
                    "voiceResponse": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="友好自然的语音回复内容，基于观察到的真实内容"
                    )
                },
                required=["sceneDescription", "detectedText", "landmarks", "recommendedDirection", "voiceResponse"]
            )
        )
        
        # 创建带function calling的模型
        self.model = genai.GenerativeModel(
            'gemini-1.5-flash',
            tools=[genai.protos.Tool(function_declarations=[self.analyze_streetview_function])]
        )
        
        # Agora 配置
        self.agora_app_id = "d83b679bc7b3406c83f63864cb74aa99"
    
    def setup_proxy(self):
        """设置代理"""
        import os
        proxy_url = "http://localhost:7890"
        os.environ['HTTP_PROXY'] = proxy_url
        os.environ['HTTPS_PROXY'] = proxy_url
        os.environ['http_proxy'] = proxy_url
        os.environ['https_proxy'] = proxy_url
        logger.info(f"设置代理: {proxy_url}")

    async def analyze_streetview(self, current_image_data: str, available_options: List[Dict], personality: str = "friendly") -> Dict:
        """使用 Gemini Function Calling 分析街景"""
        try:
            logger.info(f"Starting Gemini function calling analysis with {len(available_options)} options")
            
            # 处理base64图像数据
            if current_image_data.startswith('data:image'):
                image_data = current_image_data.split(',')[1]
            else:
                image_data = current_image_data
            
            logger.info(f"Image data size: {len(image_data)} characters")
            
            # 解码图像
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))
            
            logger.info(f"Image decoded successfully: {image.size}, mode: {image.mode}")
            
            # 确保图像格式正确
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # 构建function calling提示
            prompt = self.build_function_calling_prompt(available_options, personality)
            logger.info(f"Function calling prompt length: {len(prompt)} characters")
            
            # 调用 Gemini with function calling
            logger.info("Calling Gemini API with function calling...")
            response = self.model.generate_content([prompt, image])
            
            logger.info("Gemini response received")
            
            # 处理function calling响应
            ai_analysis = self.parse_function_calling_response(response, available_options)
            
            logger.info(f"Function calling analysis completed: {ai_analysis.get('voiceResponse', '')[:100]}...")
            
            return ai_analysis
            
        except Exception as e:
            logger.error(f"Gemini function calling analysis failed: {e}")
            logger.error(f"Error type: {type(e).__name__}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return self.get_fallback_response(available_options)

    def build_function_calling_prompt(self, options: List[Dict], personality: str) -> str:
        """构建 Function Calling 提示"""
        personality_traits = {
            "friendly": "友好、热情",
            "professional": "专业、详细", 
            "enthusiastic": "充满热情"
        }
        
        trait = personality_traits.get(personality, "友好、热情")
        
        prompt = f"""
你是一个{trait}的AI街景导游。请仔细分析这张街景图像。

可选探索方向：
"""
        for i, option in enumerate(options):
            prompt += f"{i}. {option['description']} (方向: {option['heading']}°)\n"
        
        prompt += f"""
请使用 analyze_streetview 函数来分析图像并提供建议：

1. 仔细观察图像中的具体细节
2. 识别所有可见的文字内容
3. 描述建筑、商店、标识等
4. 从可选方向中选择最有趣的一个
5. 用{trait}的语调生成自然的回复        

请调用 analyze_streetview 函数来提供结构化的分析结果。
"""
        return prompt

    def build_analysis_prompt(self, options: List[Dict], personality: str) -> str:
        """构建 Gemini 分析提示"""
        personality_traits = {
            "friendly": "友好、热情，像朋友一样介绍",
            "professional": "专业、详细，提供准确信息",
            "enthusiastic": "充满热情，对一切都很兴奋"
        }
        
        trait = personality_traits.get(personality, personality_traits["friendly"])
        
        prompt = f"""
你是一个{trait}的AI街景导游。我会给你一张真实的街景图像，请仔细观察并分析。

重要提示：
- 请仔细观察图像中的具体细节，不要使用通用描述
- 识别图像中的真实文字、建筑、商店名称
- 描述你真正看到的内容，而不是猜测

可选探索方向：
"""
        for i, option in enumerate(options):
            prompt += f"{i+1}. {option['description']} (方向: {option['heading']}°, ID: {option['panoId']})\n"
        
        prompt += f"""
请完成以下分析任务：

1. 场景分析：仔细观察图像，描述你看到的具体内容：
   - 建筑类型和颜色
   - 商店或场所的名称
   - 街道特征
   - 天气和光线情况
   - 人群或车辆情况

2. 文字识别：列出图像中所有可见的文字内容：
   - 商店招牌上的文字
   - 街道标识
   - 广告牌内容
   - 任何其他可见文字

3. 地标识别：识别任何著名建筑或地标

4. 方向选择：从可选方向中选择最有趣的一个，基于你在图像中看到的具体内容

5. 语音回复：用{trait}的语调，基于你真正观察到的内容生成回复

请严格按照JSON格式回复，确保内容基于图像的真实观察：

{{
    "sceneDescription": "基于图像观察的详细场景描述",
    "detectedText": ["图像中实际看到的文字1", "文字2", "文字3"],
    "landmarks": ["识别出的具体地标"],
    "nextDirection": {{
        "panoId": "选择的位置ID",
        "heading": 选择的方向角度,
        "reason": "基于图像内容的具体选择理由"
    }},
    "voiceResponse": "基于真实观察的自然语音回复"
}}
"""
        return prompt

    def parse_function_calling_response(self, response, available_options: List[Dict]) -> Dict:
        """解析 Function Calling 响应"""
        try:
            # 检查是否有function call
            if response.candidates and response.candidates[0].content.parts:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'function_call') and part.function_call:
                        function_call = part.function_call
                        if function_call.name == "analyze_streetview":
                            # 提取function call参数
                            args = function_call.args
                            
                            # 处理推荐方向
                            recommended_dir = args.get('recommendedDirection', {})
                            option_index = recommended_dir.get('optionIndex', 0)
                            
                            # 确保索引有效
                            if 0 <= option_index < len(available_options):
                                selected_option = available_options[option_index]
                                next_direction = {
                                    "panoId": selected_option["panoId"],
                                    "heading": selected_option["heading"],
                                    "reason": recommended_dir.get('reason', '继续探索')
                                }
                            else:
                                next_direction = None
                            
                            return {
                                "sceneDescription": args.get('sceneDescription', ''),
                                "detectedText": list(args.get('detectedText', [])),
                                "landmarks": list(args.get('landmarks', [])),
                                "nextDirection": next_direction,
                                "voiceResponse": args.get('voiceResponse', '让我们继续探索吧！')
                            }
            
            # 如果没有function call，尝试解析普通文本响应
            logger.warning("No function call found, trying to parse text response")
            return self.parse_ai_response(response.text)
            
        except Exception as e:
            logger.error(f"Function calling response parsing failed: {e}")
            return self.get_fallback_response(available_options)

    def parse_ai_response(self, response_text: str) -> Dict:
        """解析 Gemini 响应"""
        try:
            # 清理响应文本，移除可能的markdown格式
            clean_text = response_text.strip()
            
            # 移除markdown代码块标记
            if clean_text.startswith('```json'):
                clean_text = clean_text[7:]
            elif clean_text.startswith('```'):
                clean_text = clean_text[3:]
                
            if clean_text.endswith('```'):
                clean_text = clean_text[:-3]
                
            clean_text = clean_text.strip()
            
            logger.info(f"Cleaned JSON text: {clean_text[:200]}...")
            
            # 尝试解析JSON
            parsed_response = json.loads(clean_text)
            logger.info("JSON解析成功")
            return parsed_response
            
        except json.JSONDecodeError as e:
            logger.warning(f"JSON解析失败: {e}")
            logger.warning(f"原始响应: {response_text[:500]}...")
            
            # 尝试从响应中提取有用信息
            try:
                # 简单的文本解析作为备用
                voice_response = response_text.replace('```json', '').replace('```', '').strip()
                return {
                    "sceneDescription": "AI分析了当前场景",
                    "detectedText": [],
                    "landmarks": [],
                    "nextDirection": None,
                    "voiceResponse": voice_response[:200] + "..." if len(voice_response) > 200 else voice_response
                }
            except:
                return self.get_fallback_response([])

    def get_fallback_response(self, available_options: List[Dict]) -> Dict:
        """获取备用响应"""
        import random
        
        selected_option = available_options[0] if available_options else None
        
        fallback_descriptions = [
            "图像分析遇到了一些技术问题，但我们可以继续探索",
            "让我根据可选方向为您推荐下一步",
            "虽然详细分析暂时不可用，但我们可以继续前进"
        ]
        
        fallback_responses = [
            "抱歉，图像分析遇到了问题，让我们继续探索吧！",
            "技术上有点小问题，不过我们可以继续前进。",
            "让我们继续这次街景之旅，向前探索更多有趣的地方！"
        ]
        
        return {
            "sceneDescription": random.choice(fallback_descriptions),
            "detectedText": [],
            "landmarks": [],
            "nextDirection": {
                "panoId": selected_option["panoId"] if selected_option else None,
                "heading": selected_option["heading"] if selected_option else 0,
                "reason": f"选择{selected_option['description']}方向继续探索" if selected_option else "继续探索"
            } if selected_option else None,
            "voiceResponse": random.choice(fallback_responses)
        }

# 创建AI导游实例
ai_guide = StreetViewAIGuide()

# Socket.IO 服务器
sio = socketio.AsyncServer(cors_allowed_origins="*")
app = socketio.ASGIApp(sio)

@sio.event
async def connect(sid, environ):
    logger.info(f"Client {sid} connected")

@sio.event
async def disconnect(sid):
    logger.info(f"Client {sid} disconnected")

@sio.event
async def analyze_streetview(sid, data):
    """处理街景分析请求"""
    try:
        logger.info(f"Analyzing streetview for client {sid}")
        
        current_image = data.get("currentImage", "")
        available_options = data.get("availableOptions", [])
        personality = data.get("personality", "friendly")
        
        # 使用 Gemini 分析街景
        analysis_result = await ai_guide.analyze_streetview(
            current_image, 
            available_options, 
            personality
        )
        
        logger.info(f"Analysis completed: {analysis_result.get('voiceResponse', '')[:100]}...")
        
        await sio.emit('ai_response', analysis_result, room=sid)
        
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        error_response = {
            "sceneDescription": "分析过程中出现了问题，让我们继续探索。",
            "detectedText": [],
            "landmarks": [],
            "nextDirection": None,
            "voiceResponse": "抱歉，分析过程中出现了问题，让我们继续探索吧。"
        }
        await sio.emit('ai_response', error_response, room=sid)

@sio.event
async def voice_input(sid, data):
    """处理语音输入"""
    try:
        logger.info(f"Received voice input from {sid}")
        
        # 这里可以集成语音识别服务
        # 目前返回一个简单的响应
        response = {
            "voiceResponse": "我听到了您的指令。让我为您分析一下当前的街景环境。"
        }
        
        await sio.emit('ai_response', response, room=sid)
        
    except Exception as e:
        logger.error(f"Voice processing failed: {e}")

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting Gemini-powered Street View AI Guide server...")
    logger.info(f"Agora App ID: {ai_guide.agora_app_id}")
    uvicorn.run(app, host="0.0.0.0", port=8080)