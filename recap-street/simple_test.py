#!/usr/bin/env python3
"""
简化的Gemini测试 - 使用代理
"""

import google.generativeai as genai
import os
import time

def setup_proxy():
    """设置代理"""
    proxy_url = "http://localhost:7890"
    os.environ['HTTP_PROXY'] = proxy_url
    os.environ['HTTPS_PROXY'] = proxy_url
    os.environ['http_proxy'] = proxy_url
    os.environ['https_proxy'] = proxy_url
    print(f"🌐 设置代理: {proxy_url}")

def test_gemini_simple():
    """简单测试Gemini连接"""
    try:
        print("🔧 设置代理...")
        setup_proxy()
        
        print("🔧 配置Gemini API...")
        genai.configure(api_key="AIzaSyBt6CaRmn0WwVuiRYw9WyByjE2H1DZ2QoM")
        
        print("🤖 创建模型...")
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        print("📝 发送测试请求...")
        response = model.generate_content("Hello, can you respond with just 'OK'?")
        
        print(f"✅ 成功！响应: {response.text}")
        return True
        
    except Exception as e:
        print(f"❌ 失败: {e}")
        return False

if __name__ == "__main__":
    test_gemini_simple()