#!/usr/bin/env python3
"""
测试图像分析功能
"""

import google.generativeai as genai
import base64
import json
from PIL import Image
import io

def test_with_sample_image():
    """使用示例图像测试Gemini分析"""
    try:
        # 设置代理
        import os
        proxy_url = "http://localhost:7890"
        os.environ['HTTP_PROXY'] = proxy_url
        os.environ['HTTPS_PROXY'] = proxy_url
        os.environ['http_proxy'] = proxy_url
        os.environ['https_proxy'] = proxy_url
        print(f"🌐 设置代理: {proxy_url}")
        
        # 配置 API
        genai.configure(api_key="AIzaSyBt6CaRmn0WwVuiRYw9WyByjE2H1DZ2QoM")
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        # 创建一个测试图像
        test_image = Image.new('RGB', (800, 600), color='lightblue')
        
        # 在图像上添加一些文字（模拟街景）
        from PIL import ImageDraw, ImageFont
        draw = ImageDraw.Draw(test_image)
        
        try:
            # 尝试使用系统字体
            font = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", 40)
        except:
            # 如果没有找到字体，使用默认字体
            font = ImageFont.load_default()
        
        # 添加模拟的街景元素
        draw.rectangle([100, 100, 300, 200], fill='red', outline='black')
        draw.text((120, 130), "CASINO", fill='white', font=font)
        
        draw.rectangle([400, 150, 600, 250], fill='blue', outline='black')
        draw.text((420, 180), "HOTEL", fill='white', font=font)
        
        draw.text((300, 400), "WELCOME TO LAS VEGAS", fill='black', font=font)
        
        # 构建测试提示
        prompt = """
请分析这张图像，识别其中的文字和内容。

请以JSON格式回复：
{
    "sceneDescription": "场景描述",
    "detectedText": ["识别到的文字"],
    "landmarks": ["地标"],
    "voiceResponse": "语音回复"
}
"""
        
        print("🧪 测试Gemini图像分析...")
        response = model.generate_content([prompt, test_image])
        
        print("✅ Gemini响应成功！")
        print(f"原始响应: {response.text}")
        
        # 尝试解析JSON
        try:
            parsed = json.loads(response.text.strip())
            print("✅ JSON解析成功！")
            print(f"检测到的文字: {parsed.get('detectedText', [])}")
            print(f"语音回复: {parsed.get('voiceResponse', '')}")
        except json.JSONDecodeError:
            print("⚠️ JSON解析失败，但Gemini响应正常")
        
        return True
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False

def test_base64_processing():
    """测试base64图像处理"""
    try:
        # 创建测试图像
        test_image = Image.new('RGB', (400, 300), color='green')
        
        # 转换为base64
        buffer = io.BytesIO()
        test_image.save(buffer, format='JPEG')
        image_bytes = buffer.getvalue()
        base64_string = base64.b64encode(image_bytes).decode()
        
        # 模拟前端发送的格式
        data_url = f"data:image/jpeg;base64,{base64_string}"
        
        print("🧪 测试base64图像处理...")
        
        # 解析base64
        if data_url.startswith('data:image'):
            image_data = data_url.split(',')[1]
        else:
            image_data = data_url
        
        # 解码
        decoded_bytes = base64.b64decode(image_data)
        decoded_image = Image.open(io.BytesIO(decoded_bytes))
        
        print(f"✅ Base64处理成功！")
        print(f"原始图像大小: {test_image.size}")
        print(f"解码图像大小: {decoded_image.size}")
        print(f"Base64长度: {len(base64_string)} 字符")
        
        return True
        
    except Exception as e:
        print(f"❌ Base64处理失败: {e}")
        return False

def main():
    print("🧪 图像分析测试工具")
    print("=" * 40)
    
    # 测试base64处理
    if not test_base64_processing():
        return
    
    print()
    
    # 测试Gemini图像分析
    if not test_with_sample_image():
        return
    
    print()
    print("🎉 所有图像分析测试通过！")
    print("系统已准备好处理真实的街景图像。")

if __name__ == "__main__":
    main()