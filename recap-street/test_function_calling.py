#!/usr/bin/env python3
"""
测试 Gemini Function Calling 功能
"""

import google.generativeai as genai
import json
from PIL import Image, ImageDraw, ImageFont
import os

def setup_proxy():
    """设置代理"""
    proxy_url = "http://localhost:7890"
    os.environ['HTTP_PROXY'] = proxy_url
    os.environ['HTTPS_PROXY'] = proxy_url
    os.environ['http_proxy'] = proxy_url
    os.environ['https_proxy'] = proxy_url

def test_function_calling():
    """测试 Function Calling"""
    try:
        # 设置代理
        setup_proxy()
        
        # 配置 API
        genai.configure(api_key="AIzaSyBt6CaRmn0WwVuiRYw9WyByjE2H1DZ2QoM")
        
        # 定义function schema (使用正确的Gemini格式)
        analyze_function = genai.protos.FunctionDeclaration(
            name="analyze_image",
            description="分析图像内容",
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "description": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="图像内容描述"
                    ),
                    "detected_text": genai.protos.Schema(
                        type=genai.protos.Type.ARRAY,
                        items=genai.protos.Schema(type=genai.protos.Type.STRING),
                        description="检测到的文字"
                    ),
                    "recommendation": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="建议"
                    )
                },
                required=["description", "detected_text", "recommendation"]
            )
        )
        
        # 创建模型
        model = genai.GenerativeModel(
            'gemini-1.5-flash',
            tools=[genai.protos.Tool(function_declarations=[analyze_function])]
        )
        
        # 创建测试图像
        test_image = Image.new('RGB', (400, 300), color='lightblue')
        draw = ImageDraw.Draw(test_image)
        
        # 添加文字
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", 30)
        except:
            font = ImageFont.load_default()
        
        draw.text((50, 100), "HELLO WORLD", fill='black', font=font)
        draw.text((50, 150), "TEST IMAGE", fill='red', font=font)
        
        print("🧪 测试 Gemini Function Calling...")
        
        # 发送请求
        prompt = "请使用 analyze_image 函数分析这张图像，识别其中的文字并提供描述。"
        response = model.generate_content([prompt, test_image])
        
        print("✅ 收到响应")
        
        # 解析function call
        if response.candidates and response.candidates[0].content.parts:
            for part in response.candidates[0].content.parts:
                if hasattr(part, 'function_call') and part.function_call:
                    function_call = part.function_call
                    print(f"📞 Function Call: {function_call.name}")
                    print(f"📋 参数: {dict(function_call.args)}")
                    
                    args = function_call.args
                    print(f"🖼️ 描述: {args.get('description', 'N/A')}")
                    print(f"📝 检测文字: {list(args.get('detected_text', []))}")
                    print(f"💡 建议: {args.get('recommendation', 'N/A')}")
                    
                    return True
        
        print("⚠️ 没有找到 function call")
        print(f"普通响应: {response.text}")
        return False
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        print(f"详细错误: {traceback.format_exc()}")
        return False

def main():
    print("🧪 Gemini Function Calling 测试")
    print("=" * 40)
    
    if test_function_calling():
        print("\n🎉 Function Calling 测试成功！")
        print("可以开始使用结构化的AI分析了。")
    else:
        print("\n❌ Function Calling 测试失败")
        print("可能需要检查网络连接或API配置")

if __name__ == "__main__":
    main()