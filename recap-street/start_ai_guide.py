#!/usr/bin/env python3
"""
街景AI导游启动脚本
"""

import subprocess
import sys
import os

def install_dependencies():
    """安装Python依赖"""
    print("🔧 安装Python依赖...")
    dependencies = [
        "google-generativeai",
        "python-socketio",
        "uvicorn",
        "pillow"
    ]
    
    for dep in dependencies:
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", dep])
            print(f"✅ {dep} 安装成功")
        except subprocess.CalledProcessError:
            print(f"❌ {dep} 安装失败")
            return False
    
    return True

def check_api_keys():
    """检查API密钥配置"""
    print("🔑 检查API密钥配置...")
    
    # 检查Gemini API Key
    gemini_key = "AIzaSyBt6CaRmn0WwVuiRYw9WyByjE2H1DZ2QoM"
    if gemini_key and len(gemini_key) > 20:
        print("✅ Gemini API Key 已配置")
    else:
        print("❌ Gemini API Key 未正确配置")
        return False
    
    # 检查Agora App ID
    agora_id = "d83b679bc7b3406c83f63864cb74aa99"
    if agora_id and len(agora_id) > 20:
        print("✅ Agora App ID 已配置")
    else:
        print("❌ Agora App ID 未正确配置")
        return False
    
    return True

def start_server():
    """启动服务器"""
    print("🚀 启动街景AI导游服务器...")
    print("服务器地址: http://localhost:8080")
    print("按 Ctrl+C 停止服务器")
    print("-" * 50)
    
    try:
        subprocess.run([sys.executable, "ten_agent_server.py"])
    except KeyboardInterrupt:
        print("\n👋 服务器已停止")

def main():
    print("🤖 街景AI导游服务器启动器")
    print("=" * 50)
    
    # 安装依赖
    if not install_dependencies():
        print("❌ 依赖安装失败，请检查网络连接")
        return
    
    # 检查配置
    if not check_api_keys():
        print("❌ API密钥配置有问题，请检查配置")
        return
    
    # 启动服务器
    start_server()

if __name__ == "__main__":
    main()