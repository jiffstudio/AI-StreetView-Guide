#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

// 设置日志文件
const LOG_FILE = path.join(__dirname, 'proxy.log');

// 重定向console输出到日志文件
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

function writeToLog(level, ...args) {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  const logEntry = `[${timestamp}] [${level}] ${message}\n`;
  
  // 写入文件（同步写入确保顺序）
  fs.appendFileSync(LOG_FILE, logEntry, 'utf8');
  
  // 同时输出到控制台（可选）
  if (level === 'ERROR') {
    originalConsoleError(`[${timestamp}] [${level}] ${message}`);
  } else if (level === 'WARN') {
    originalConsoleWarn(`[${timestamp}] [${level}] ${message}`);
  } else {
    originalConsoleLog(`[${timestamp}] [${level}] ${message}`);
  }
}

console.log = (...args) => writeToLog('INFO', ...args);
console.error = (...args) => writeToLog('ERROR', ...args);
console.warn = (...args) => writeToLog('WARN', ...args);

// 清空日志文件（启动时）
fs.writeFileSync(LOG_FILE, '', 'utf8');

const app = express();
const PORT = 8090;

// 配置你的真实 Dify API 地址
const REAL_DIFY_BASE_URL = 'https://api.dify.ai/v1';

app.use(cors());
app.use(express.json());

// 确保临时目录存在
const TEMP_DIR = path.join(__dirname, 'temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// 从前端获取街景图片的函数
async function getStreetViewImage() {
  try {
    console.log('🖼️ Getting street view image from frontend API...');
    
    // 调用playground的API端点获取当前街景图片
    const response = await fetch('http://localhost:3001/api/current-streetview', {
      method: 'GET'
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log('📷 No street view image available yet');
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // 获取图片数据并转换为base64
    const imageBuffer = await response.buffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const base64Image = `data:${contentType};base64,${imageBuffer.toString('base64')}`;
    
    console.log(`✅ Got street view image from API, size: ${base64Image.length} characters`);
    return base64Image;
    
  } catch (error) {
    console.warn('⚠️ Failed to get street view image from API:', error.message);
    return null;
  }
}

// 从前端获取当前位置的邻近链接
async function getCurrentLinks() {
  try {
    console.log('🔗 Getting current street view links from frontend API...');
    
    const response = await fetch('http://localhost:3001/api/current-links', {
      method: 'GET'
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log('🔗 No street view links available yet');
        return [];
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    const links = data.links || [];
    
    console.log(`✅ Got ${links.length} available links from API`);
    return links;
    
  } catch (error) {
    console.warn('⚠️ Failed to get links from API:', error.message);
    return [];
  }
}

// 上传图片到 Dify
async function uploadImageToDify(base64Image, authHeader, userId) {
  try {
    console.log('📤 Uploading image to Dify...');
    
    // 解析 base64 图片
    const matches = base64Image.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error('Invalid base64 image format');
    }
    
    const imageType = matches[1];
    const imageData = matches[2];
    const buffer = Buffer.from(imageData, 'base64');
    
    // 创建临时文件
    const tempFileName = `streetview_${Date.now()}.${imageType}`;
    const tempFilePath = path.join(TEMP_DIR, tempFileName);
    fs.writeFileSync(tempFilePath, buffer);
    
    console.log(`💾 Created temp file: ${tempFilePath} (${buffer.length} bytes)`);
    
    // 准备上传表单
    const formData = new FormData();
    formData.append('file', fs.createReadStream(tempFilePath), {
      filename: tempFileName,
      contentType: `image/${imageType}`
    });
    formData.append('user', userId || 'TenAgent');
    
    // 上传到 Dify
    const uploadUrl = `${REAL_DIFY_BASE_URL}/files/upload`;
    console.log(`🚀 Uploading to: ${uploadUrl}`);
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        ...formData.getHeaders()
      },
      body: formData
    });
    
    // 清理临时文件
    fs.unlinkSync(tempFilePath);
    console.log(`🗑️ Cleaned up temp file: ${tempFilePath}`);
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
    }
    
    const fileInfo = await uploadResponse.json();
    console.log('✅ Image uploaded successfully:', fileInfo);
    
    return fileInfo;
    
  } catch (error) {
    console.error('❌ Failed to upload image to Dify:', error);
    throw error;
  }
}

// 解析AI响应并控制地图，返回commentary用于显示
async function parseAndExecuteAIDecision(responseText) {
  try {
    console.log('🤖 Parsing AI response for navigation commands...');
    
    // 解析SSE格式响应
    let aiDecision = null;
    
    // 从SSE流中提取最终的AI回复
    const lines = responseText.split('\n');
    let finalAnswer = '';
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const eventData = JSON.parse(line.substring(6));
          
          // 查找包含答案的event
          if (eventData.event === 'node_finished' && eventData.data && eventData.data.outputs) {
            const outputs = eventData.data.outputs;
            if (outputs.answer || outputs.text || outputs.result) {
              finalAnswer = outputs.answer || outputs.text || outputs.result;
              console.log('📝 Found AI answer:', finalAnswer.substring(0, 500) + '...');
              break;
            }
          }
          
          // 或者查找workflow_finished事件
          if (eventData.event === 'workflow_finished' && eventData.data && eventData.data.outputs) {
            finalAnswer = eventData.data.outputs.answer || eventData.data.outputs.text || '';
            console.log('📝 Found workflow result:', finalAnswer.substring(0, 500) + '...');
            break;
          }
          
        } catch (parseError) {
          // 跳过解析失败的行
          continue;
        }
      }
    }
    
    if (!finalAnswer) {
      console.log('📝 No AI answer found in SSE response');
      return null;
    }
    
    // 尝试从答案中提取JSON决策
    try {
      // 清理markdown代码块标记
      let cleanAnswer = finalAnswer.trim();
      if (cleanAnswer.startsWith('```json')) {
        cleanAnswer = cleanAnswer.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanAnswer.startsWith('```')) {
        cleanAnswer = cleanAnswer.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // 直接解析清理后的JSON
      aiDecision = JSON.parse(cleanAnswer.trim());
      console.log('✅ Successfully parsed JSON from AI answer');
    } catch (e) {
      // 尝试提取JSON片段
      const jsonMatch = finalAnswer.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        try {
          aiDecision = JSON.parse(jsonMatch[0]);
          console.log('✅ Successfully extracted and parsed JSON fragment');
        } catch (innerE) {
          console.log('📝 Could not parse JSON from answer:', finalAnswer.substring(0, 200) + '...');
          return null;
        }
      } else {
        console.log('📝 No JSON found in AI answer');
        return null;
      }
    }
    
    if (!aiDecision) {
      console.log('📝 No JSON decision found in AI response');
      return null;
    }
    
    console.log('🎯 AI Decision parsed:', JSON.stringify(aiDecision, null, 2));
    
    // 检查简化的JSON结构
    if (!aiDecision.panoId) {
      console.log('🚫 No panoId found in AI decision');
      return aiDecision.commentary || null; // 即使没有导航也返回解说
    }
    
    const panoId = aiDecision.panoId;
    const heading = aiDecision.heading || 0;
    const commentary = aiDecision.commentary || 'AI导游解说';
    
    console.log('🧭 Navigation command found:', { panoId, heading, commentary });
    
    // 执行导航命令
    console.log(`⏱️ Waiting 1 second before movement...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(`🎯 Executing AI navigation: Move to ${panoId} with heading ${heading}`);
    console.log(`📍 Commentary: ${commentary}`);
    
    // 通过API控制地图
    try {
      const controlResponse = await fetch('http://localhost:3001/api/streetview-control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'moveToLocation',
          panoId: panoId,
          heading: heading
        })
      });
      
      if (controlResponse.ok) {
        const result = await controlResponse.json();
        console.log('✅ AI navigation command sent successfully:', result);
      } else {
        console.error('❌ Failed to send navigation command:', controlResponse.status);
      }
      
    } catch (controlError) {
      console.error('❌ Failed to control map via API:', controlError.message);
    }
    
    // 返回commentary给用户显示
    return commentary;
    
  } catch (error) {
    console.error('❌ Failed to parse or execute AI decision:', error.message);
    return null;
  }
}

// 代理聊天消息请求
app.post('/chat-messages', async (req, res) => {
  console.log('\n🔄 === New chat request ===');
  console.log('📝 Original request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }
    
    // 同时获取街景图片和邻近链接
    const [streetViewImage, currentLinks] = await Promise.all([
      getStreetViewImage(),
      getCurrentLinks()
    ]);
    
    let finalRequestBody = { ...req.body };
    
    // 添加邻近链接信息到查询中
    if (currentLinks && currentLinks.length > 0) {
      const linksInfo = currentLinks.map((link, index) => 
        `${index + 1}. ${link.description || '方向'} (ID: ${link.panoId}, 角度: ${link.heading}°)`
      ).join('\n');
      
      finalRequestBody.query = `${req.body.query}\n\n可选导航方向:\n${linksInfo}`;
      console.log(`🔗 Added ${currentLinks.length} navigation options to query`);
    }
    
    if (streetViewImage) {
      console.log('🖼️ Street view image available, uploading to Dify...');
      
      try {
        // 上传图片到 Dify
        const fileInfo = await uploadImageToDify(
          streetViewImage, 
          authHeader, 
          req.body.user
        );
        
        // 添加文件信息到请求中
        finalRequestBody.files = [
          {
            type: "image",
            transfer_method: "local_file",
            upload_file_id: fileInfo.id
          }
        ];
        
        console.log('🎯 Enhanced request with image file:', fileInfo.id);
        
      } catch (uploadError) {
        console.warn('⚠️ Failed to upload image, proceeding without it:', uploadError.message);
      }
    } else {
      console.log('📷 No street view image available, proceeding with text only');
    }
    
    // 转发请求到真实的 Dify API
    const forwardUrl = `${REAL_DIFY_BASE_URL}/chat-messages`;
    console.log(`🔄 Forwarding to: ${forwardUrl}`);
    console.log(`📤 Final request payload:`, JSON.stringify(finalRequestBody, null, 2));
    
    const forwardResponse = await fetch(forwardUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'User-Agent': 'DifyProxyServer/1.0'
      },
      body: JSON.stringify(finalRequestBody)
    });
    
    console.log(`📡 Response status: ${forwardResponse.status}`);
    console.log(`📡 Response headers:`, Object.fromEntries(forwardResponse.headers.entries()));
    
    // 如果是错误响应，读取内容并打印
    if (!forwardResponse.ok) {
      const responseText = await forwardResponse.text();
      console.log(`❌ Error response status: ${forwardResponse.status}`);
      console.log(`❌ Error response body (${responseText.length} chars):`, responseText);
      console.log(`❌ Error response content-type:`, forwardResponse.headers.get('content-type'));
      
      // 重新创建响应对象，因为body已经被读取了
      res.status(forwardResponse.status);
      forwardResponse.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
      res.send(responseText);
      return;
    }
    
    // 设置响应头
    res.status(forwardResponse.status);
    forwardResponse.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    
    // 读取完整响应以便解析AI决策和修改返回内容
    console.log(`📡 Reading response for AI decision parsing...`);
    let responseText = '';
    let aiCommentary = null;
    
    // 设置响应流处理
    forwardResponse.body.on('data', (chunk) => {
      const chunkStr = chunk.toString();
      responseText += chunkStr;
      // 暂时不转发给客户端，等解析完AI决策后再处理
    });
    
    forwardResponse.body.on('end', async () => {
      console.log(`📄 Complete response received (${responseText.length} chars)`);
      console.log('📄 Raw response content:', responseText.substring(0, 2000) + (responseText.length > 2000 ? '...' : ''));
      
      // 尝试解析AI决策并控制地图
      if (responseText.trim()) {
        aiCommentary = await parseAndExecuteAIDecision(responseText);
      }
      
      // 如果有AI解说，只返回解说内容；否则返回原始响应
      if (aiCommentary) {
        console.log('📢 Returning AI commentary only:', aiCommentary);
        res.write(`data: {"event": "message", "answer": "${aiCommentary}"}\n\n`);
        res.write(`data: {"event": "message_end"}\n\n`);
      } else {
        // 返回原始响应
        res.write(responseText);
      }
      
      res.end();
    });
    
    forwardResponse.body.on('error', (error) => {
      console.error('❌ Response stream error:', error);
      res.end();
    });
    
  } catch (error) {
    console.error('💥 Proxy error:', error);
    res.status(500).json({ 
      error: 'Proxy server error', 
      message: error.message 
    });
  }
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    realDifyUrl: REAL_DIFY_BASE_URL
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log('🚀 Dify Proxy Server Started');
  console.log(`📍 Listening on: http://localhost:${PORT}`);
  console.log(`🎯 Proxying to: ${REAL_DIFY_BASE_URL}`);
  console.log('💡 Usage: Set your Dify base_url to http://localhost:8080');
  console.log('');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Dify Proxy Server...');
  
  // 清理临时文件
  if (fs.existsSync(TEMP_DIR)) {
    const files = fs.readdirSync(TEMP_DIR);
    files.forEach(file => {
      const filePath = path.join(TEMP_DIR, file);
      fs.unlinkSync(filePath);
      console.log(`🗑️ Cleaned up: ${filePath}`);
    });
  }
  
  console.log('✅ Cleanup completed');
  process.exit(0);
});