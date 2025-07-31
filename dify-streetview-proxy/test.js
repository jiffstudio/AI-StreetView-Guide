#!/usr/bin/env node

const fetch = require('node-fetch');

async function test() {
  console.log('🧪 Testing Dify Street View Proxy Server...\n');

  // 1. 测试健康检查
  console.log('1️⃣ Testing health check...');
  try {
    const healthResponse = await fetch('http://localhost:8090/health');
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    return;
  }

  // 2. 向 playground 推送测试图片
  console.log('\n2️⃣ Pushing test image to playground...');
  const testImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/wAALCAABAAEBAREA/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
  
  try {
    const pushResponse = await fetch('http://localhost:3001/api/current-streetview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: testImage })
    });
    const pushData = await pushResponse.json();
    console.log('✅ Image pushed to playground:', pushData);
  } catch (error) {
    console.log('⚠️ Could not push to playground (maybe not running):', error.message);
  }

  // 3. 测试代理服务器的聊天请求处理
  console.log('\n3️⃣ Testing proxy chat request...');
  try {
    const chatResponse = await fetch('http://localhost:8090/chat-messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key'  // 使用测试密钥
      },
      body: JSON.stringify({
        inputs: {},
        query: '请分析这张街景图片',
        response_mode: 'streaming',
        user: 'test-user'
      }),
      timeout: 5000
    });

    console.log('📡 Proxy response status:', chatResponse.status);
    console.log('📡 Proxy response headers:', Object.fromEntries(chatResponse.headers.entries()));
    
    if (chatResponse.status === 401) {
      console.log('✅ Proxy correctly forwarded request (401 = invalid API key, expected)');
    } else if (chatResponse.status === 400) {
      console.log('✅ Proxy processed request, but Dify rejected it (400 = bad request)');
    } else {
      const responseText = await chatResponse.text();
      console.log('📄 Response body:', responseText.substring(0, 200) + '...');
    }

  } catch (error) {
    console.log('❌ Chat request failed:', error.message);
  }

  console.log('\n🎉 Test completed!');
  console.log('\n📋 To use the proxy:');
  console.log('1. Set TEN Framework Dify base_url to: http://localhost:8090');
  console.log('2. Ensure playground runs on: http://localhost:3001');
  console.log('3. Use your real Dify API key in TEN Framework');
}

test().catch(console.error);