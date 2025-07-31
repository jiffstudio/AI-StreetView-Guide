import { useJsApiLoader } from "@react-google-maps/api";
import styles from "./page.module.scss";
import { useEffect, useRef, useState } from "react";
import { AIGuideService } from "../services/AIGuideService";

import VoiceControl from "../components/VoiceControl";

export default function Page() {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: "AIzaSyBX1tyMdVh62Z_h7Snbs9A8DnQcHbhPoGs",
  });
  const panoramaRef = useRef<HTMLDivElement>(null);
  const panorama = useRef<google.maps.StreetViewPanorama | null>(null);
  const [links, setLinks] = useState<google.maps.StreetViewLink[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [visitedPanos, setVisitedPanos] = useState<Set<string>>(new Set());
  const [currentPanoId, setCurrentPanoId] = useState<string>("");

  const [aiGuideService, setAiGuideService] = useState<AIGuideService | null>(null);
  const [isAIEnabled, setIsAIEnabled] = useState(false);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [aiResponse, setAiResponse] = useState<string>("");
  const [capturedImage, setCapturedImage] = useState<string>("");
  useEffect(() => {
    if (isLoaded && panoramaRef.current) {
      panorama.current = new window.google.maps.StreetViewPanorama(
        panoramaRef.current,
        {
          position: { lat: 36.1147, lng: -115.1728 },
          pov: { heading: 0, pitch: 0 },
          zoom: 1,
          addressControlOptions: {
            position: google.maps.ControlPosition.TOP_RIGHT,
          },
          linksControl: false,
          panControl: false,
          enableCloseButton: false,
          fullscreenControl: false,
        }
      );

      // 初始化AI导游服务
      initializeAIGuide();

      // 监听街景位置变化事件
      panorama.current.addListener('pano_changed', () => {
        const newPanoId = panorama.current?.getPano();
        if (newPanoId) {
          console.log('街景位置已变化到:', newPanoId);
          setCurrentPanoId(newPanoId);
          
          // 将新位置添加到访问历史
          setVisitedPanos(prev => new Set([...prev, newPanoId]));
          
          // 延迟一下确保新位置完全加载
          setTimeout(updateLinksForCurrentPosition, 500);
        }
      });

      // 初始加载完成后自动获取相邻位置
      panorama.current.addListener('pano_changed', () => {
        setTimeout(() => {
          if (links.length === 0) { // 只在初次加载时自动显示
            updateLinksForCurrentPosition();
          }
        }, 1000);
      });
    }
  }, [isLoaded]);
  const getLinksInfo = () => {
    const currentLinks = panorama.current?.getLinks()?.filter(link => link !== null) || [];
    setLinks(currentLinks as google.maps.StreetViewLink[]);
    console.log("当前位置的相邻链接:");
    currentLinks.forEach((link, index) => {
      console.log(`${index + 1}. 方向: ${link?.description}, ID: ${link?.pano}`);
    });
  };

  const smoothTransitionToPano = async (targetPanoId: string, targetHeading: number, description: string) => {
    if (!panorama.current || isTransitioning) return;

    setIsTransitioning(true);
    console.log(`AI带您移动到: ${description} (ID: ${targetPanoId})`);

    try {
      // 第一步：转向目标方向
      const currentPov = panorama.current.getPov();
      await animateHeading(currentPov.heading!, targetHeading);

      // 第二步：添加淡出效果
      const panoramaElement = panoramaRef.current;
      if (panoramaElement) {
        panoramaElement.style.transition = 'opacity 0.3s ease-in-out';
        panoramaElement.style.opacity = '0.3';
      }

      // 第三步：等待一下再切换位置
      await new Promise(resolve => setTimeout(resolve, 200));

      // 第四步：切换到新位置
      panorama.current.setPano(targetPanoId);

      // 第五步：等待新位置加载完成
      await new Promise(resolve => setTimeout(resolve, 300));

      // 第六步：恢复透明度
      if (panoramaElement) {
        panoramaElement.style.opacity = '1';
        setTimeout(() => {
          panoramaElement.style.transition = '';
        }, 300);
      }

      // 第七步：自动更新新位置的相邻链接
      await new Promise(resolve => setTimeout(resolve, 100));
      updateLinksForCurrentPosition();

      // 第八步：直接继续AI分析，不依赖状态检查
      setTimeout(async () => {
        // 检查按钮文本来判断AI状态
        const aiButtons = document.querySelectorAll('button');
        let aiModeActive = false;
        
        for (const button of aiButtons) {
          if (button.textContent?.includes('AI导游中')) {
            aiModeActive = true;
            break;
          }
        }
        
        console.log("🔄 检查是否继续AI分析:", { 
          isAIEnabled, 
          aiModeActive,
          buttonText: Array.from(aiButtons).find(b => b.textContent?.includes('AI'))?.textContent
        });
        
        if (aiModeActive) {
          console.log("✅ AI模式开启，开始下一轮分析");
          setTimeout(async () => {
            console.log("🔄 开始下一轮AI分析...");
            await requestAIAnalysis(true); // 强制传递true确保继续
          }, 1000);
        } else {
          console.log("❌ AI模式未开启，停止自动分析");
        }
      }, 500); // 等待DOM更新

    } catch (error) {
      console.error('过渡动画出错:', error);
    } finally {
      setIsTransitioning(false);
    }
  };

  // 计算角度差异（选择最短路径）
  const getAngleDifference = (currentHeading: number, targetHeading: number): number => {
    let diff = targetHeading - currentHeading;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return Math.abs(diff);
  };

  // 获取方向标签
  const getDirectionLabel = (currentHeading: number, targetHeading: number): string => {
    let diff = targetHeading - currentHeading;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    const absDiff = Math.abs(diff);

    if (absDiff <= 30) return "⬆️ 直行";
    if (absDiff >= 150) return "⬇️ 后退";
    if (diff > 0) {
      if (absDiff <= 90) return "↗️ 右转";
      return "↘️ 右后";
    } else {
      if (absDiff <= 90) return "↖️ 左转";
      return "↙️ 左后";
    }
  };

  // 根据当前视角方向对链接进行排序
  const sortLinksByDirection = (links: google.maps.StreetViewLink[]): google.maps.StreetViewLink[] => {
    if (!panorama.current) return links;

    const currentPov = panorama.current.getPov();
    const currentHeading = currentPov.heading || 0;

    return [...links].sort((a, b) => {
      const headingA = a.heading || 0;
      const headingB = b.heading || 0;

      const diffA = getAngleDifference(currentHeading, headingA);
      const diffB = getAngleDifference(currentHeading, headingB);

      return diffA - diffB;
    });
  };

  const updateLinksForCurrentPosition = () => {
    const allLinks = panorama.current?.getLinks()?.filter(link => link !== null) || [];
    // 过滤掉已经访问过的位置
    const unvisitedLinks = allLinks.filter(link =>
      link?.pano && !visitedPanos.has(link.pano)
    );

    // 根据当前视角方向排序
    const sortedLinks = sortLinksByDirection(unvisitedLinks as google.maps.StreetViewLink[]);

    setLinks(sortedLinks);
    console.log(`已更新到新位置的相邻链接: ${allLinks.length} 个方向，${unvisitedLinks.length} 个未访问`);

    if (unvisitedLinks.length === 0 && allLinks.length > 0) {
      console.log("所有相邻位置都已访问过！");
    }
  };

  const animateHeading = (fromHeading: number, toHeading: number): Promise<void> => {
    return new Promise((resolve) => {
      const duration = 800; // 动画持续时间
      const startTime = Date.now();

      // 处理角度差异（选择最短路径）
      let angleDiff = toHeading - fromHeading;
      if (angleDiff > 180) angleDiff -= 360;
      if (angleDiff < -180) angleDiff += 360;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // 使用缓动函数让动画更自然
        const easeProgress = 1 - Math.pow(1 - progress, 3);

        const currentHeading = fromHeading + (angleDiff * easeProgress);

        if (panorama.current) {
          const currentPov = panorama.current.getPov();
          panorama.current.setPov({
            ...currentPov,
            heading: currentHeading
          });
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      animate();
    });
  };

  const jumpToPano = (panoId: string, description: string, heading?: number) => {
    console.log("🎯 jumpToPano called with:", { panoId, description, heading });
    const targetHeading = heading || 0;
    console.log("🎯 Calling smoothTransitionToPano with:", { panoId, targetHeading, description });
    smoothTransitionToPano(panoId, targetHeading, description);
  };

  const resetVisitedHistory = () => {
    setVisitedPanos(new Set([currentPanoId])); // 保留当前位置
    updateLinksForCurrentPosition();
    console.log("已重置访问历史");
  };

  const initializeAIGuide = async () => {
    try {
      const aiService = new AIGuideService({
        personality: 'friendly'
      });

      await aiService.initialize();
      setAiGuideService(aiService);

      console.log('AI Guide initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AI Guide:', error);
    }
  };



  const toggleAIMode = async () => {
    if (!aiGuideService) return;

    const newAIEnabled = !isAIEnabled;
    setIsAIEnabled(newAIEnabled);

    if (newAIEnabled) {
      // 启动AI自主导游模式
      setAiResponse("🤖 AI导游模式已启动！我将为您自主选择探索路径...");
      await requestAIAnalysis(true); // 传递AI模式状态
    } else {
      // 停止AI模式
      setAiResponse("AI导游模式已停止，您可以手动选择方向。");
    }
  };

  const requestAIAnalysis = async (forceAIMode?: boolean) => {
    if (!aiGuideService || !panorama.current) return;

    // 使用传入的参数或当前状态
    const currentAIMode = forceAIMode !== undefined ? forceAIMode : isAIEnabled;

    try {
      setAiResponse("🤖 正在捕获街景图像...");

      // 等待一下确保街景完全加载
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 捕获当前街景图像
      const currentImage = await captureStreetViewImage();

      if (!currentImage || currentImage.length < 1000) {
        setAiResponse("图像捕获失败，请稍后重试。");
        console.error("Image capture failed or too small:", currentImage.length);
        return;
      }

      // 保存捕获的图像用于显示
      setCapturedImage(currentImage);

      console.log("Image captured successfully, size:", currentImage.length);
      setAiResponse("🤖 正在分析街景内容...");

      // 获取当前视角信息
      const currentPov = panorama.current.getPov();
      const currentPosition = panorama.current.getPosition();

      // 获取可选方向，排除当前位置
      const currentPanoId = panorama.current.getPano();
      const availableOptions = links
        .filter(link => link.pano !== currentPanoId) // 排除当前位置
        .map(link => ({
          panoId: link.pano!,
          heading: link.heading || 0,
          description: link.description || '',
          previewImage: getStreetViewImageUrl(link.pano!, link.heading || 0)
        }));
      
      console.log("过滤后的可选方向:", {
        currentPanoId,
        totalLinks: links.length,
        availableOptions: availableOptions.length,
        filteredOut: links.length - availableOptions.length
      });

      if (availableOptions.length === 0) {
        setAiResponse("当前位置没有可探索的方向。");
        return;
      }

      // 准备访问历史信息
      const visitedHistory = Array.from(visitedPanos).slice(-5); // 最近5个访问过的位置
      
      console.log("Sending to AI:", {
        imageSize: currentImage.length,
        optionsCount: availableOptions.length,
        currentHeading: currentPov.heading,
        position: currentPosition?.toString(),
        visitedHistory: visitedHistory.length
      });

      // 发送给AI分析，包含访问历史
      const analysis = await aiGuideService.analyzeStreetView(currentImage, availableOptions, visitedHistory);

      console.log("AI Analysis result:", analysis);
      setAiResponse(analysis.voiceResponse);

      // 如果AI模式开启且有推荐方向，自动导航
      console.log("检查自动导航条件:", {
        isAIEnabled,
        currentAIMode,
        hasNextDirection: !!analysis.nextDirection,
        nextDirection: analysis.nextDirection
      });

      if (currentAIMode && analysis.nextDirection) {
        console.log(`✅ AI选择了方向: ${analysis.nextDirection.reason}`);
        console.log(`将在3秒后移动到: ${analysis.nextDirection.panoId}`);

        setTimeout(() => {
          console.log("🚀 开始执行AI导航...");
          jumpToPano(
            analysis.nextDirection.panoId,
            analysis.nextDirection.reason,
            analysis.nextDirection.heading
          );
        }, 3000); // 给用户3秒时间听AI的解说
      } else {
        console.log("❌ 自动导航条件不满足:", {
          isAIEnabled,
          currentAIMode,
          hasNextDirection: !!analysis.nextDirection
        });
      }

    } catch (error) {
      console.error('AI analysis failed:', error);
      setAiResponse("AI分析失败，请稍后重试。");
    }
  };

  const captureStreetViewImage = async (): Promise<string> => {
    if (!panorama.current) return '';

    try {
      // 直接使用Google Street View Static API获取当前位置的图片
      const currentPanoId = panorama.current.getPano();
      const currentPov = panorama.current.getPov();

      if (!currentPanoId) {
        console.error('No pano ID available');
        return '';
      }

      console.log(`Using pano ID: ${currentPanoId}, heading: ${currentPov.heading}`);

      // 构建Street View Static API URL
      const apiKey = "AIzaSyBX1tyMdVh62Z_h7Snbs9A8DnQcHbhPoGs";
      const staticImageUrl = `https://maps.googleapis.com/maps/api/streetview?size=800x600&pano=${currentPanoId}&heading=${currentPov.heading || 0}&pitch=${currentPov.pitch || 0}&fov=90&key=${apiKey}`;

      console.log('Fetching street view image from Static API:', staticImageUrl);

      // 获取图片并转换为base64
      const response = await fetch(staticImageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch street view image: ${response.status}`);
      }

      const blob = await response.blob();

      // 转换为base64
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          console.log(`Successfully fetched street view image, size: ${result.length} characters`);
          resolve(result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

    } catch (error) {
      console.error('Failed to get street view image from Static API:', error);
      return createEnhancedFallbackImage();
    }
  };

  const createEnhancedFallbackImage = (): string => {
    // 创建一个包含当前位置信息的图像
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');

    if (ctx && panorama.current) {
      // 绘制更真实的街景背景
      const gradient = ctx.createLinearGradient(0, 0, 0, 600);
      gradient.addColorStop(0, '#87CEEB'); // 天空蓝
      gradient.addColorStop(0.7, '#F0E68C'); // 地面黄
      gradient.addColorStop(1, '#8B4513'); // 道路棕
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 800, 600);

      // 绘制简单的建筑轮廓
      ctx.fillStyle = '#696969';
      ctx.fillRect(50, 300, 150, 200);
      ctx.fillRect(250, 250, 120, 250);
      ctx.fillRect(400, 280, 180, 220);
      ctx.fillRect(620, 320, 130, 180);

      // 添加窗户
      ctx.fillStyle = '#4169E1';
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 4; j++) {
          ctx.fillRect(70 + i * 40, 320 + j * 40, 20, 30);
        }
      }

      // 获取当前位置信息
      const position = panorama.current.getPosition();
      const pov = panorama.current.getPov();

      // 添加位置信息
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(50, 50, 700, 120);

      ctx.fillStyle = '#333';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('拉斯维加斯街景 - Las Vegas Street View', 400, 80);

      ctx.font = '16px Arial';
      ctx.fillText(`位置: ${position?.lat().toFixed(6)}, ${position?.lng().toFixed(6)}`, 400, 110);
      ctx.fillText(`视角: ${pov.heading?.toFixed(1)}° | 可选方向: ${links.length} 个`, 400, 135);

      // 添加方向信息
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(50, 450, 700, 100);

      ctx.fillStyle = '#333';
      ctx.font = '14px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('可探索方向:', 70, 475);

      links.slice(0, 4).forEach((link, index) => {
        const x = 70 + (index % 2) * 350;
        const y = 495 + Math.floor(index / 2) * 25;
        ctx.fillText(`${index + 1}. ${link.description} (${link.heading}°)`, x, y);
      });

      // 添加说明
      ctx.font = '12px Arial';
      ctx.fillStyle = '#666';
      ctx.textAlign = 'center';
      ctx.fillText('注意: 由于技术限制，显示的是位置信息而非实际街景图像', 400, 580);
    }

    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const handleVoiceInput = async (audioBlob: Blob) => {
    if (!aiGuideService) return;

    try {
      await aiGuideService.sendVoiceMessage(audioBlob);
    } catch (error) {
      console.error('Voice input failed:', error);
    }
  };

  const toggleVoiceListening = () => {
    setIsVoiceListening(!isVoiceListening);
  };

  // 生成街景静态图片URL
  const getStreetViewImageUrl = (panoId: string, heading: number = 0) => {
    const apiKey = "AIzaSyBX1tyMdVh62Z_h7Snbs9A8DnQcHbhPoGs";
    return `https://maps.googleapis.com/maps/api/streetview?size=200x150&pano=${panoId}&heading=${heading}&pitch=0&key=${apiKey}`;
  };

  return (
    <div className={styles["container"]}>
      <div className={styles["controls"]}>
        <div className={styles["buttonGroup"]}>
          <button onClick={getLinksInfo}>
            刷新相邻位置
          </button>
          <button onClick={resetVisitedHistory} className={styles["resetButton"]}>
            重置历史
          </button>
          <button
            onClick={toggleAIMode}
            className={`${styles["aiButton"]} ${isAIEnabled ? styles["active"] : ""}`}
          >
            {isAIEnabled ? "🤖 AI导游中" : "🤖 启动AI"}
          </button>
        </div>

        <VoiceControl
          onVoiceInput={handleVoiceInput}
          isListening={isVoiceListening}
          onToggleListening={toggleVoiceListening}
        />

        {aiResponse && (
          <div className={styles["aiResponse"]}>
            <h5>🤖 AI导游说：</h5>
            <p>{aiResponse}</p>
          </div>
        )}

        {capturedImage && (
          <div className={styles["capturedImage"]}>
            <h5>📸 发送给AI的图像：</h5>
            <img
              src={capturedImage}
              alt="Captured street view"
              className={styles["debugImage"]}
            />
            <p className={styles["imageInfo"]}>
              图像大小: {Math.round(capturedImage.length / 1024)}KB
            </p>
          </div>
        )}

        <div className={styles["stats"]}>
          <span>已访问: {visitedPanos.size} 个位置</span>
        </div>

        {isAIEnabled ? (
          <div className={styles["aiMode"]}>
            <h4>🤖 AI自主导游模式</h4>
            <p>AI正在为您选择最佳探索路径...</p>
            {links.length > 0 && (
              <div className={styles["aiOptions"]}>
                <span>可选方向: {links.length} 个</span>
                <div className={styles["optionPreviews"]}>
                  {links.slice(0, 3).map((link, index) => (
                    <img
                      key={link.pano}
                      src={getStreetViewImageUrl(link.pano!, link.heading || 0)}
                      alt={link.description || `选项 ${index + 1}`}
                      className={styles["miniPreview"]}
                    />
                  ))}
                  {links.length > 3 && <span className={styles["moreOptions"]}>+{links.length - 3}</span>}
                </div>
              </div>
            )}
          </div>
        ) : links.length > 0 ? (
          <div className={styles["links"]}>
            <h4>手动选择方向 ({links.length}):</h4>
            {links.map((link, index) => {
              const currentPov = panorama.current?.getPov();
              const currentHeading = currentPov?.heading || 0;
              const targetHeading = link.heading || 0;
              const directionLabel = getDirectionLabel(currentHeading, targetHeading);

              return (
                <button
                  key={link.pano}
                  onClick={() => jumpToPano(link.pano!, link.description!, link.heading || 0)}
                  disabled={isTransitioning}
                  className={`${styles["linkButton"]} ${index === 0 ? styles["primaryDirection"] : ""}`}
                >
                  <img
                    src={getStreetViewImageUrl(link.pano!, link.heading || 0)}
                    alt={link.description || `方向 ${index + 1}`}
                    className={styles["previewImage"]}
                  />
                  <div className={styles["linkInfo"]}>
                    <span className={styles["directionLabel"]}>
                      {directionLabel}
                    </span>
                    <span className={styles["linkText"]}>
                      {link.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className={styles["noLinks"]}>
            <p>🎯 所有相邻位置都已探索过！</p>
            <p>点击"重置历史"继续探索</p>
          </div>
        )}
      </div>

      <div ref={panoramaRef} className={styles["panorama"]}></div>
    </div>
  );
}
