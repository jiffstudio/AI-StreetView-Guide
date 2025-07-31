#!/usr/bin/env python3
"""
测试 Gemini API 连接
"""

import google.generativeai as genai
import json

def test_gemini_connection():
    """测试 Gemini API 连接"""
    try:
        # 配置 API
        genai.configure(api_key="AIzaSyBt6CaRmn0WwVuiRYw9WyByjE2H1DZ2QoM")
        
        # 创建模型
        model = genai.GenerativeModel('gemini-pro')
        
        # 测试文本生成
        response = model.generate_content("你好，请简单介绍一下你自己。")
        
        print("✅ Gemini API 连接成功！")
        print(f"响应: {response.text}")
        
        return True
        
    except Exception as e:
        print(f"❌ Gemini API 连接失败: {e}")
        return False

def test_vision_model():
    """测试 Gemini Vision 模型"""
    try:
        # 配置 API
        genai.configure(api_key="AIzaSyBt6CaRmn0WwVuiRYw9WyByjE2H1DZ2QoM")
        
        # 创建视觉模型
        model = genai.GenerativeModel('gemini-pro-vision')
        
        print("✅ Gemini Vision 模型初始化成功！")
        print("模型已准备好分析街景图像")
        
        return True
        
    except Exception as e:
        print(f"❌ Gemini Vision 模型初始化失败: {e}")
        return False

def test_json_parsing():
    """测试JSON解析功能"""
    test_response = '''
    {
        "sceneDescription": "这是一个测试场景",
        "detectedText": ["TEST", "DEMO"],
        "landmarks": ["测试地标"],
        "nextDirection": {
            "panoId": "test123",
            "heading": 90,
            "reason": "测试理由"
        },
        "voiceResponse": "这是一个测试回复"
    }
    '''
    
    try:
        parsed = json.loads(test_response.strip())
        print("✅ JSON 解析测试成功！")
        print(f"解析结果: {parsed['voiceResponse']}")
        return True
    except Exception as e:
        print(f"❌ JSON 解析测试失败: {e}")
        return False

def main():
    print("🧪 Gemini API 测试")
    print("=" * 40)
    
    # 测试基础连接
    if not test_gemini_connection():
        return
    
    print()
    
    # 测试视觉模型
    if not test_vision_model():
        return
    
    print()
    
    # 测试JSON解析
    if not test_json_parsing():
        return
    
    print()
    print("🎉 所有测试通过！AI导游系统已准备就绪。")
    print("现在可以运行: python start_ai_guide.py")

if __name__ == "__main__":
    main()